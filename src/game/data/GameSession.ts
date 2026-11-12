import type * as Phaser from "phaser";

/** Volatile prototype state: shared between Phaser scenes, not saved to disk. */
export interface CampusBountySession {
    level: number;
    xp: number;
    xpToNext: number;
    coins: number;
    questFindingCleared: boolean;
}

export interface QuestFindingReward {
    xp: number;
    coins: number;
    firstClear: boolean;
}

const KEY = "campusbounty:session:v1";

const newSession = (): CampusBountySession => ({
    level: 1,
    xp: 0,
    xpToNext: 100,
    coins: 0,
    questFindingCleared: false,
});

/** Stored only in Phaser's in-memory registry until the browser reloads. */
export function getGameSession(scene: Phaser.Scene): CampusBountySession {
    const existing = scene.registry.get(KEY) as CampusBountySession | undefined;
    if (existing && Number.isFinite(existing.level) && Number.isFinite(existing.coins)) {
        return existing;
    }
    const state = newSession();
    scene.registry.set(KEY, state);
    return state;
}

/** A local prototype award, NOT an on-chain transaction or validated payout. */
export function awardQuestFinding(scene: Phaser.Scene): QuestFindingReward {
    const state = getGameSession(scene);
    if (state.questFindingCleared) {
        return { xp: 0, coins: 0, firstClear: false };
    }

    const reward = { xp: 75, coins: 20, firstClear: true };
    state.xp += reward.xp;
    state.coins += reward.coins;
    state.questFindingCleared = true;

    while (state.xp >= state.xpToNext) {
        state.xp -= state.xpToNext;
        state.level += 1;
        state.xpToNext = 100 + (state.level - 1) * 50;
    }

    // Set a new object so subscribers could react later if needed.
    scene.registry.set(KEY, { ...state });
    return reward;
}
