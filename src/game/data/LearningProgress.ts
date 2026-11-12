import type * as Phaser from "phaser";
import { getGameSession } from "./GameSession";

export interface LessonMastery {
    attempts: number;
    bestScore: number;
    mastered: boolean;
    lastPracticedAt?: string;
}
export interface LearningProgress {
    version: 2;
    lessons: Record<string, LessonMastery>;
    /** Persistent local demo ledger. NEVER a trusted server-side or on-chain claim. */
    academyXpEarned: number;
    mistakes: Record<string, number>;
    /** First-masteries grouped by local calendar day. */
    days: Record<string, readonly string[]>;
    achievements: readonly string[];
}
export interface LessonResult {
    score: number; total: number; passed: boolean; firstMastery: boolean;
    awardedXp: number; attempts: number;
}
const LEARNING_KEY = "campusbounty:learning:v1"; // Maintain G3.7 registry contract.
const STORAGE_KEY = "campusbounty:academy-progress:v2";
const APPLIED_KEY = "campusbounty:academy-applied:v2";
const SESSION_KEY = "campusbounty:session:v1";
const VERIFIED_KEY = "campusbounty:progression:verified-user";
const SERVER_BASELINE_KEY = "campusbounty:progression:server-baseline";
interface ServerBaseline { userId: string; totalXp: number; coins: number }
function totalFromLevel(level: number, xp: number): number {
    const steps = Math.max(0, Math.floor(level) - 1);
    return Math.floor(xp) + steps * 100 + ((steps * (steps - 1)) / 2) * 50;
}
function levelFromTotal(totalXp: number): { level: number; xp: number; xpToNext: number } {
    let level = 1, xp = Math.max(0, Math.floor(totalXp)), xpToNext = 100;
    while (xp >= xpToNext) { xp -= xpToNext; level++; xpToNext += 50; }
    return { level, xp, xpToNext };
}


/** A trusted snapshot returned by authenticated FastAPI; never construct from localStorage. */
export interface VerifiedSnapshot {
    authority: "server";
    userId: string;
    profile: { level: number; xp: number; xpToNext: number; totalXp: number;
        coins: number; questFindingCleared: boolean };
    learning: LearningProgress;
    adventureRewardsVerified: false;
}

/** Hydrate game-wide registry without importing unverified local XP into the database. */
export function applyVerifiedSnapshot(scene: Phaser.Scene, snapshot: VerifiedSnapshot): void {
    if (snapshot.authority !== "server") throw new Error("Expected authoritative progression snapshot");
    // Keep locally earned dungeon/Quest Finding rewards visible during the same account
    // session, but NEVER upload these provisional values to the backend.
    const baseline = scene.registry.get(SERVER_BASELINE_KEY) as ServerBaseline | undefined;
    const previous = scene.registry.get(SESSION_KEY) as {
        level: number; xp: number; coins: number; questFindingCleared: boolean;
    } | undefined;
    const sameAccount = scene.registry.get(VERIFIED_KEY) === snapshot.userId &&
        baseline?.userId === snapshot.userId;
    const localXp = sameAccount && previous
        ? Math.max(0, totalFromLevel(previous.level, previous.xp) - baseline.totalXp) : 0;
    const localCoins = sameAccount && previous
        ? Math.max(0, previous.coins - baseline.coins) : 0;
    const display = levelFromTotal(snapshot.profile.totalXp + localXp);
    scene.registry.set(VERIFIED_KEY, snapshot.userId);
    scene.registry.set(SERVER_BASELINE_KEY, { userId: snapshot.userId,
        totalXp: snapshot.profile.totalXp, coins: snapshot.profile.coins } satisfies ServerBaseline);
    scene.registry.set(LEARNING_KEY, snapshot.learning);
    scene.registry.set(APPLIED_KEY, snapshot.learning.academyXpEarned);
    scene.registry.set(SESSION_KEY, { ...display,
        coins: snapshot.profile.coins + localCoins,
        questFindingCleared: sameAccount && previous?.questFindingCleared === true });
}
/** Removes the signed-in account view; guest data is stored separately in localStorage. */
export function clearVerifiedSnapshot(scene: Phaser.Scene): void {
    if (!scene.registry.get(VERIFIED_KEY)) return;
    scene.registry.set(VERIFIED_KEY, undefined);
    scene.registry.set(SERVER_BASELINE_KEY, undefined);
    scene.registry.set(LEARNING_KEY, undefined);
    scene.registry.set(APPLIED_KEY, 0);
    scene.registry.set(SESSION_KEY, undefined);
}

export function isVerifiedAccount(scene: Phaser.Scene): boolean {
    return typeof scene.registry.get(VERIFIED_KEY) === "string";
}


const empty = (): LearningProgress => ({ version: 2, lessons: {}, academyXpEarned: 0,
    mistakes: {}, days: {}, achievements: [] });
const safeNumber = (n: unknown): number => typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
function normalize(raw: unknown): LearningProgress {
    const data = raw && typeof raw === "object" ? raw as Partial<LearningProgress> : {};
    const out = empty();
    if (data.lessons && typeof data.lessons === "object") {
        for (const [id, entry] of Object.entries(data.lessons)) {
            if (!/^[a-z0-9-]{1,80}$/.test(id) || !entry || typeof entry !== "object") continue;
            out.lessons[id] = {
                attempts: safeNumber(entry.attempts), bestScore: safeNumber(entry.bestScore),
                mastered: entry.mastered === true,
                ...(typeof entry.lastPracticedAt === "string" ? { lastPracticedAt: entry.lastPracticedAt.slice(0, 40) } : {}),
            };
        }
    }
    out.academyXpEarned = Math.min(1000000, safeNumber(data.academyXpEarned));
    if (data.mistakes && typeof data.mistakes === "object") {
        for (const [id, count] of Object.entries(data.mistakes))
            if (/^[a-z0-9-]{1,80}$/.test(id) && safeNumber(count) > 0) out.mistakes[id] = Math.min(99, safeNumber(count));
    }
    if (data.days && typeof data.days === "object") {
        for (const [day, ids] of Object.entries(data.days))
            if (/^\d{4}-\d{2}-\d{2}$/.test(day) && Array.isArray(ids))
                out.days[day] = [...new Set(ids.filter((id): id is string => typeof id === "string" && /^[a-z0-9-]+$/.test(id)))].slice(0, 100);
    }
    if (Array.isArray(data.achievements))
        out.achievements = [...new Set(data.achievements.filter((id): id is string => typeof id === "string" && /^[a-z0-9-]+$/.test(id)))].slice(0, 100);
    return out;
}
function loadLocal(): LearningProgress | undefined {
    try {
        if (typeof localStorage === "undefined") return;
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? normalize(JSON.parse(raw) as unknown) : undefined;
    } catch { return; }
}
function persist(value: LearningProgress): void {
    try { if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); }
    catch { /* Browsers may disable storage. Phaser registry remains functional. */ }
}
export function isLearningStorageAvailable(): boolean {
    try { if (typeof localStorage === "undefined") return false;
        const key = "campusbounty:storage-check";
        localStorage.setItem(key, "1"); localStorage.removeItem(key); return true;
    } catch { return false; }
}
export function getLearningProgress(scene: Phaser.Scene): LearningProgress {
    const stored = scene.registry.get(LEARNING_KEY) as LearningProgress | undefined;
    if (stored && stored.lessons && typeof stored.lessons === "object") {
        if (stored.version === 2) return stored;
        const migrated = normalize(stored); scene.registry.set(LEARNING_KEY, migrated); persist(migrated); return migrated;
    }
    const loaded = loadLocal() ?? empty();
    scene.registry.set(LEARNING_KEY, loaded);
    return loaded;
}
function save(scene: Phaser.Scene, value: LearningProgress): void {
    scene.registry.set(LEARNING_KEY, value);
    if (!isVerifiedAccount(scene)) persist(value);
}
export function getLessonMastery(scene: Phaser.Scene, id: string): LessonMastery {
    return getLearningProgress(scene).lessons[id] ?? { attempts: 0, bestScore: 0, mastered: false };
}
function awardXP(scene: Phaser.Scene, xp: number): void {
    if (!xp) return;
    const session = getGameSession(scene);
    session.xp += xp;
    while (session.xp >= session.xpToNext) {
        session.xp -= session.xpToNext;
        session.level++;
        session.xpToNext = 100 + (session.level - 1) * 50;
    }
    scene.registry.set(SESSION_KEY, { ...session });
}
/** Restores only previously earned Academy XP after a refresh; never reclaims Dungeon awards. */
export function syncAcademyXP(scene: Phaser.Scene): number {
    if (isVerifiedAccount(scene)) return 0; // Cloud XP is already included in server profile.
    const progress = getLearningProgress(scene);
    const already = safeNumber(scene.registry.get(APPLIED_KEY));
    const delta = Math.max(0, progress.academyXpEarned - already);
    if (delta) awardXP(scene, delta);
    scene.registry.set(APPLIED_KEY, Math.max(already, progress.academyXpEarned));
    return delta;
}
function dayStamp(): string {
    const now = new Date();
    return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
}
export function dailyMasteries(scene: Phaser.Scene): number {
    return (getLearningProgress(scene).days[dayStamp()] ?? []).length;
}
export function getReviewQueue(scene: Phaser.Scene): string[] {
    const items = Object.entries(getLearningProgress(scene).mistakes);
    return items.filter(([, count]) => count > 0)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([id]) => id);
}
export function recordPracticeMistake(scene: Phaser.Scene, questionId: string): void {
    if (!/^[a-z0-9-]{1,80}$/.test(questionId)) return;
    const p = getLearningProgress(scene);
    save(scene, { ...p, mistakes: { ...p.mistakes, [questionId]: Math.min(99, (p.mistakes[questionId] ?? 0) + 1) } });
}
export function resolveReview(scene: Phaser.Scene, questionId: string, correct: boolean): void {
    const p = getLearningProgress(scene);
    const mistakes = { ...p.mistakes };
    if (correct) delete mistakes[questionId];
    else mistakes[questionId] = Math.min(99, (mistakes[questionId] ?? 0) + 1);
    save(scene, { ...p, mistakes });
}
function complete(scene: Phaser.Scene, lessonId: string, score: number, total: number,
    xpReward: number, passingScore: number, wrongIds: readonly string[]): LessonResult {
    if (!/^[a-z0-9-]{1,80}$/.test(lessonId) || !Number.isInteger(score) || !Number.isInteger(total) ||
        total < 1 || total > 30 || score < 0 || score > total || !Number.isInteger(passingScore) ||
        passingScore < 1 || passingScore > total || !Number.isFinite(xpReward) || xpReward < 0 || xpReward > 1000)
        throw new Error("Invalid learning assessment result");
    syncAcademyXP(scene);
    const p = getLearningProgress(scene);
    const prior = getLessonMastery(scene, lessonId);
    const passed = score >= passingScore;
    const firstMastery = passed && !prior.mastered;
    // Legacy G3.7 bridge lessons are still local demo checks when signed in.
    // Only the backend can grant server-verified XP to signed-in accounts.
    const awardedXp = firstMastery && !isVerifiedAccount(scene) ? Math.floor(xpReward) : 0;
    const now = new Date().toISOString();
    const lessons = { ...p.lessons, [lessonId]: { attempts: prior.attempts + 1,
        bestScore: Math.max(score, prior.bestScore), mastered: prior.mastered || passed,
        lastPracticedAt: now } };
    const mistakes = { ...p.mistakes };
    for (const id of wrongIds) if (/^[a-z0-9-]{1,80}$/.test(id))
        mistakes[id] = Math.min(99, (mistakes[id] ?? 0) + 1);
    const days = { ...p.days };
    if (firstMastery) days[dayStamp()] = [...new Set([...(days[dayStamp()] ?? []), lessonId])];
    const achievements = [...p.achievements];
    const track = lessonId.startsWith("cs-") ? "cs" : lessonId.startsWith("web3-") ? "web3" : "";
    const capstoneKey = track === "cs" ? "cs-06-capstone" : "web3-06-capstone";
    if (track && lessonId === capstoneKey && firstMastery)
        achievements.push(track === "cs" ? "computing-apprentice" : "ledger-explorer");
    const next = { ...p, lessons, mistakes, days, achievements: [...new Set(achievements)],
        academyXpEarned: p.academyXpEarned + awardedXp } satisfies LearningProgress;
    save(scene, next);
    if (awardedXp) {
        awardXP(scene, awardedXp);
        scene.registry.set(APPLIED_KEY, next.academyXpEarned);
    }
    return { score, total, passed, firstMastery, awardedXp, attempts: lessons[lessonId].attempts };
}
/** G3.7 backwards-compatible strict 3/3 scoring and signature. */
export function submitLearningAssessment(scene: Phaser.Scene, lessonId: string,
    score: number, total: number, xpReward: number): LessonResult {
    return complete(scene, lessonId, score, total, xpReward, total, []);
}
export function submitAcademyAssessment(scene: Phaser.Scene, lessonId: string,
    score: number, total: number, passingScore: number, xpReward: number,
    wrongIds: readonly string[]): LessonResult {
    return complete(scene, lessonId, score, total, xpReward, passingScore, wrongIds);
}
