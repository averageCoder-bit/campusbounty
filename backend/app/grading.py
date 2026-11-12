"""Server-owned curriculum and deterministic grading (no client XP/score input)."""
import json
from pathlib import Path
from typing import Any
import secrets

MANIFEST = json.loads((Path(__file__).parent / "content" / "academy_manifest.json").read_text())
LESSONS: dict[str, dict[str, Any]] = MANIFEST["lessons"]


def get_lesson(lesson_id: str) -> dict[str, Any]:
    try:
        return LESSONS[lesson_id]
    except KeyError:
        raise ValueError("Lesson not published") from None


def prerequisites(lesson_id: str) -> list[str]:
    lesson = get_lesson(lesson_id)
    return [id for id, item in LESSONS.items()
            if item["unitId"] == lesson["unitId"] and id < lesson_id]


def prepare_questions(lesson: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Returns public sanitized challenges and private (ID, permutation) manifest.

    The browser never provides a score, answer key, or XP amount to the API.
    """
    rng = secrets.SystemRandom()
    items = list(lesson["assessment"])
    rng.shuffle(items)
    public: list[dict[str, Any]] = []
    private: list[dict[str, Any]] = []
    for item in items:
        opts = item.get("options") if item["kind"] != "sequence" else item.get("steps")
        permutation = list(range(len(opts))) if opts else []
        rng.shuffle(permutation)
        public.append({
            "id": item["id"], "kind": item["kind"], "title": item["title"],
            "prompt": item["prompt"], "context": item.get("context", ""),
            "hint": item.get("hint", ""),
            "options": [opts[i] for i in permutation] if opts else [],
        })
        private.append({"id": item["id"], "order": permutation})
    return public, private


def normalize(value: str) -> str:
    return " ".join(value.strip().lower().split())


def grade_attempt(lesson: dict[str, Any], private: list[dict[str, Any]], answers: list[Any]) -> dict[str, Any]:
    by_id = {item["id"]: item for item in lesson["assessment"]}
    if len(private) != len(by_id) or len(answers) != len(private):
        raise ValueError("Incorrect attempt size")
    score = 0
    wrong: list[str] = []
    seen: set[str] = set()
    for info, answer in zip(private, answers):
        qid, order = info["id"], info["order"]
        if qid not in by_id or qid in seen:
            raise ValueError("Invalid attempt manifest")
        seen.add(qid)
        q = by_id[qid]
        kind = q["kind"]
        right = False
        if kind in ("choice", "trace"):
            right = (type(answer) is int and 0 <= answer < len(order) and
                     order[answer] == q["answerIndex"])
        elif kind == "sequence":
            right = (isinstance(answer, list) and len(answer) == len(order) == 3 and
                     all(type(x) is int for x in answer) and sorted(answer) == [0, 1, 2] and
                     [order[idx] for idx in answer] == [0, 1, 2])
        elif kind == "fill":
            right = isinstance(answer, str) and len(answer) <= 120 and normalize(answer) in {
                normalize(x) for x in q["accepted"]
            }
        if right:
            score += 1
        else:
            wrong.append(qid)
    return {"score": score, "total": len(private), "passed": score >= lesson["minScore"], "wrongIds": wrong}


def level_from_xp(total_xp: int) -> dict[str, int]:
    level, remaining, threshold = 1, max(0, total_xp), 100
    while remaining >= threshold:
        remaining -= threshold
        level += 1
        threshold += 50
    return {"level": level, "xp": remaining, "xpToNext": threshold}
