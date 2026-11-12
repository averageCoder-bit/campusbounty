import type * as Phaser from "phaser";
import { getGameSession } from "./GameSession";

/** In-memory learning mastery. Matches the existing volatile GameSession scope. */
export interface LessonMastery {
    attempts: number;
    bestScore: number;
    mastered: boolean;
}

export interface LearningProgress {
    lessons: Record<string, LessonMastery>;
}

export interface LessonResult {
    score: number;
    total: number;
    passed: boolean;
    firstMastery: boolean;
    awardedXp: number;
    attempts: number;
}

const LEARNING_KEY = "campusbounty:learning:v1";
const SESSION_KEY = "campusbounty:session:v1"; // Existing GameSession registry key.

export function getLearningProgress(scene: Phaser.Scene): LearningProgress {
    const stored = scene.registry.get(LEARNING_KEY) as LearningProgress | undefined;
    if (stored && stored.lessons && typeof stored.lessons === "object") return stored;
    const initial: LearningProgress = { lessons: {} };
    scene.registry.set(LEARNING_KEY, initial);
    return initial;
}

export function getLessonMastery(scene: Phaser.Scene, id: string): LessonMastery {
    return getLearningProgress(scene).lessons[id] ?? {
        attempts: 0,
        bestScore: 0,
        mastered: false,
    };
}

/**
 * Mastery requires a perfect three-case assessment. Award XP exactly once per
 * lesson per browser session; all grading happens locally for this MVP.
 */
export function submitLearningAssessment(
    scene: Phaser.Scene,
    lessonId: string,
    score: number,
    total: number,
    xpReward: number,
): LessonResult {
    if (!lessonId || !Number.isInteger(score) || !Number.isInteger(total) ||
        total <= 0 || score < 0 || score > total || !Number.isFinite(xpReward) || xpReward < 0) {
        throw new Error("Invalid learning assessment result");
    }
    const previous = getLearningProgress(scene);
    const prior = getLessonMastery(scene, lessonId);
    const passed = score === total;
    const firstMastery = passed && !prior.mastered;
    const nextRecord: LessonMastery = {
        attempts: prior.attempts + 1,
        bestScore: Math.max(prior.bestScore, score),
        mastered: prior.mastered || passed,
    };
    scene.registry.set(LEARNING_KEY, {
        lessons: { ...previous.lessons, [lessonId]: nextRecord },
    } satisfies LearningProgress);

    let awardedXp = 0;
    if (firstMastery) {
        const session = getGameSession(scene);
        awardedXp = Math.floor(xpReward);
        session.xp += awardedXp;
        while (session.xp >= session.xpToNext) {
            session.xp -= session.xpToNext;
            session.level += 1;
            session.xpToNext = 100 + (session.level - 1) * 50;
        }
        // Reassign the registry entry to notify potential UI listeners.
        scene.registry.set(SESSION_KEY, { ...session });
    }
    return {
        score, total, passed, firstMastery, awardedXp,
        attempts: nextRecord.attempts,
    };
}
