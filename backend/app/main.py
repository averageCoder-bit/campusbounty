"""G4.6 FastAPI server-authoritative Academy progression.

Browser is never allowed to submit XP, coins, pass/fail, or scores to this API.
Adventure completion remains local until trustworthy server-side game verification exists.
"""
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

import httpx
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field
from typing import Literal

from .auth import current_user_id
from .web3_achievements import router as web3_router
from .config import get_settings
from .db import make_pool
from .grading import MANIFEST, get_lesson, grade_attempt, level_from_xp, prepare_questions, prerequisites
from .byte_mentor import router as byte_router

load_dotenv(Path(__file__).parents[1] / ".env")


class StartAttempt(BaseModel):
    model_config = ConfigDict(extra="forbid")
    lessonId: str = Field(pattern=r"^[a-z0-9-]{1,80}$", max_length=80)


class SubmitAttempt(BaseModel):
    model_config = ConfigDict(extra="forbid")
    answers: list[int | list[int] | str | None] = Field(min_length=3, max_length=5)


class AdventureRun(BaseModel):
    model_config = ConfigDict(extra="forbid")
    runId: UUID
    mode: Literal["quest-finding", "dungeon-conquer"]
    seed: int = Field(ge=0, lt=4294967296)
    outcome: Literal["cleared", "failed", "abandoned"]
    durationSeconds: int = Field(ge=0, le=14400)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    app.state.settings = settings
    app.state.http = httpx.AsyncClient()
    app.state.db = await make_pool(settings.database_url)
    try:
        yield
    finally:
        await app.state.db.close()
        await app.state.http.aclose()


app = FastAPI(title="CampusBounty Progression API", version="4.6.0", lifespan=lifespan)
app.include_router(web3_router)
app.include_router(byte_router)
# Set explicit origins, never wildcard for authenticated calls.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[x.strip() for x in __import__('os').getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if x.strip()],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["authorization", "content-type"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "campusbounty-progression", "version": MANIFEST["version"]}


async def ensure_profile(conn: Any, uid: UUID) -> None:
    await conn.execute("INSERT INTO public.cb_profiles(user_id) VALUES($1) ON CONFLICT DO NOTHING", uid)


async def snapshot(conn: Any, uid: UUID) -> dict[str, Any]:
    profile = await conn.fetchrow(
        "SELECT total_xp, coins FROM public.cb_profiles WHERE user_id = $1", uid
    )
    if not profile:
        raise HTTPException(500, "Profile was not created")
    progress = await conn.fetch(
        "SELECT lesson_id, attempts, best_score, mastered, last_practiced_at, first_mastered_at "
        "FROM public.cb_lesson_mastery WHERE user_id = $1 ORDER BY lesson_id", uid
    )
    badges = await conn.fetch(
        "SELECT achievement_id FROM public.cb_achievements WHERE user_id = $1 ORDER BY achievement_id", uid
    )
    wrong = await conn.fetch(
        "SELECT question_id, mistakes FROM public.cb_review_mistakes WHERE user_id = $1 ORDER BY question_id", uid
    )
    runs = await conn.fetch(
        "SELECT run_id, mode, seed, outcome, duration_seconds, created_at "
        "FROM public.cb_adventure_runs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10", uid
    )
    awarded = await conn.fetchval(
        "SELECT COALESCE(SUM(xp),0)::bigint FROM public.cb_reward_ledger "
        "WHERE user_id = $1 AND source = 'academy'", uid
    )
    level = level_from_xp(int(profile["total_xp"]))
    lessons = {
        row["lesson_id"]: {
            "attempts": row["attempts"], "bestScore": row["best_score"],
            "mastered": row["mastered"], "lastPracticedAt": row["last_practiced_at"].isoformat(),
        }
        for row in progress
    }
    days: dict[str, list[str]] = {}
    for row in progress:
        if row["first_mastered_at"]:
            day = row["first_mastered_at"].date().isoformat()
            days.setdefault(day, []).append(row["lesson_id"])
    return {
        "authority": "server", "userId": str(uid),
        "profile": {**level, "totalXp": int(profile["total_xp"]), "coins": int(profile["coins"]),
                    "questFindingCleared": False},
        "learning": {"version": 2, "lessons": lessons, "academyXpEarned": int(awarded),
                     "mistakes": {r["question_id"]: r["mistakes"] for r in wrong},
                     "days": days, "achievements": [r["achievement_id"] for r in badges]},
        "adventureRewardsVerified": False,
        "adventureHistory": [
            {"runId": str(r["run_id"]), "mode": r["mode"], "seed": int(r["seed"]),
             "outcome": r["outcome"], "durationSeconds": r["duration_seconds"],
             "createdAt": r["created_at"].isoformat(), "verified": False} for r in runs
        ],
    }


@app.get("/api/v1/progression/me")
async def my_progress(request: Request, uid: UUID = Depends(current_user_id)) -> dict[str, Any]:
    async with request.app.state.db.acquire() as conn:
        await ensure_profile(conn, uid)
        return await snapshot(conn, uid)


@app.post("/api/v1/academy/attempts", status_code=201)
async def start_attempt(body: StartAttempt, request: Request,
                        uid: UUID = Depends(current_user_id)) -> dict[str, Any]:
    try:
        lesson = get_lesson(body.lessonId)
    except ValueError:
        raise HTTPException(404, "Lesson not published") from None
    async with request.app.state.db.acquire() as conn:
        await ensure_profile(conn, uid)
        prereq = prerequisites(body.lessonId)
        if prereq:
            learned = await conn.fetch(
                "SELECT lesson_id FROM public.cb_lesson_mastery "
                "WHERE user_id = $1 AND mastered = true AND lesson_id = ANY($2::text[])", uid, prereq
            )
            if len(learned) != len(prereq):
                raise HTTPException(409, "Master the preceding chapter lessons first")
        public, private = prepare_questions(lesson)
        attempt_id = uuid4()
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=30)
        await conn.execute(
            "INSERT INTO public.cb_academy_attempts "
            "(id, user_id, lesson_id, manifest_version, question_order, expires_at) "
            "VALUES($1,$2,$3,$4,$5::jsonb,$6)",
            attempt_id, uid, body.lessonId, MANIFEST["version"], json.dumps(private), expires_at,
        )
        return {"attemptId": str(attempt_id), "lessonId": body.lessonId,
                "expiresAt": expires_at.isoformat(), "questions": public}


@app.post("/api/v1/academy/attempts/{attempt_id}/submit")
async def submit_attempt(attempt_id: UUID, body: SubmitAttempt, request: Request,
                         uid: UUID = Depends(current_user_id)) -> dict[str, Any]:
    async with request.app.state.db.acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow(
                "SELECT lesson_id, question_order, manifest_version, submitted_at, expires_at "
                "FROM public.cb_academy_attempts WHERE id = $1 AND user_id = $2 FOR UPDATE", attempt_id, uid
            )
            if row is None:
                raise HTTPException(404, "Attempt not found")
            if row["submitted_at"] is not None:
                raise HTTPException(409, "Attempt already submitted")
            if datetime.now(timezone.utc) >= row["expires_at"]:
                raise HTTPException(410, "Attempt expired; start a new assessment")
            if row["manifest_version"] != MANIFEST["version"]:
                raise HTTPException(409, "Curriculum version changed; start again")
            lesson = get_lesson(row["lesson_id"])
            private = row["question_order"]
            if isinstance(private, str):
                private = json.loads(private)
            try:
                grade = grade_attempt(lesson, private, body.answers)
            except ValueError:
                raise HTTPException(422, "Invalid submitted answers") from None

            # Mark first; transaction and row lock make simultaneous submissions idempotent.
            await conn.execute(
                "UPDATE public.cb_academy_attempts SET submitted_at = now() WHERE id = $1", attempt_id
            )
            previous = await conn.fetchrow(
                "SELECT attempts, mastered FROM public.cb_lesson_mastery "
                "WHERE user_id = $1 AND lesson_id = $2 FOR UPDATE", uid, row["lesson_id"]
            )
            first_mastery = grade["passed"] and (previous is None or not previous["mastered"])
            await conn.execute(
                "INSERT INTO public.cb_lesson_mastery "
                "(user_id, lesson_id, attempts, best_score, mastered, first_mastered_at) "
                "VALUES ($1,$2,1,$3,$4, CASE WHEN $4 THEN now() ELSE NULL END) "
                "ON CONFLICT (user_id, lesson_id) DO UPDATE SET "
                "attempts = public.cb_lesson_mastery.attempts + 1, "
                "best_score = GREATEST(public.cb_lesson_mastery.best_score, EXCLUDED.best_score), "
                "mastered = public.cb_lesson_mastery.mastered OR EXCLUDED.mastered, "
                "first_mastered_at = COALESCE(public.cb_lesson_mastery.first_mastered_at, EXCLUDED.first_mastered_at), "
                "last_practiced_at = now()",
                uid, row["lesson_id"], grade["score"], grade["passed"],
            )
            xp = 0
            if first_mastery:
                inserted = await conn.fetchrow(
                    "INSERT INTO public.cb_reward_ledger (user_id,reward_key,source,xp,coins) "
                    "VALUES ($1,$2,'academy',$3,0) ON CONFLICT DO NOTHING RETURNING xp",
                    uid, f"mastery:{row['lesson_id']}", lesson["xpReward"],
                )
                if inserted is not None:
                    xp = int(inserted["xp"])
                    await conn.execute(
                        "UPDATE public.cb_profiles SET total_xp = total_xp + $2, updated_at = now() "
                        "WHERE user_id = $1", uid, xp
                    )
                if row["lesson_id"] in ("cs-06-capstone", "web3-06-capstone"):
                    badge = ("computing-apprentice" if row["lesson_id"].startswith("cs-")
                             else "ledger-explorer")
                    await conn.execute(
                        "INSERT INTO public.cb_achievements(user_id, achievement_id) VALUES($1,$2) "
                        "ON CONFLICT DO NOTHING", uid, badge,
                    )
            for qid in grade["wrongIds"]:
                await conn.execute(
                    "INSERT INTO public.cb_review_mistakes(user_id,question_id) VALUES ($1,$2) "
                    "ON CONFLICT(user_id,question_id) DO UPDATE SET "
                    "mistakes = LEAST(99,public.cb_review_mistakes.mistakes+1), updated_at=now()",
                    uid, qid,
                )
            attempt_count = (0 if previous is None else previous["attempts"]) + 1
            result = {**grade, "firstMastery": xp > 0,
                      "awardedXp": xp, "attempts": attempt_count}
        # Fresh authoritative profile, read after commit.
        return {"result": result, "snapshot": await snapshot(conn, uid)}


@app.post("/api/v1/adventure-runs", status_code=202)
async def report_adventure_run(body: AdventureRun, request: Request,
                               uid: UUID = Depends(current_user_id)) -> dict[str, Any]:
    """Client-reported play history. Never awards XP/coins or sets verified-clear flags."""
    async with request.app.state.db.acquire() as conn:
        await ensure_profile(conn, uid)
        await conn.execute(
            "INSERT INTO public.cb_adventure_runs "
            "(user_id,run_id,mode,seed,outcome,duration_seconds) VALUES($1,$2,$3,$4,$5,$6) "
            "ON CONFLICT(user_id,run_id) DO NOTHING",
            uid, body.runId, body.mode, body.seed, body.outcome, body.durationSeconds,
        )
    return {"saved": True, "verificationStatus": "client_reported", "xpAwarded": 0, "coinsAwarded": 0}
