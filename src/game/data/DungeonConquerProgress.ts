import type * as Phaser from "phaser";
import { getGameSession } from "./GameSession";

const DUNGEON_KEY = "campusbounty:dungeon-conquer-cleared:v1";
const SESSION_KEY = "campusbounty:session:v1";

export interface DungeonReward {
    firstClear: boolean;
    xp: number;
    coins: number;
}

/** One-time prototype award in the same Phaser registry used by Quest Finding and lessons. */
export function awardDungeonConquer(scene: Phaser.Scene): DungeonReward {
    if (scene.registry.get(DUNGEON_KEY) === true) {
        return { firstClear: false, xp: 0, coins: 0 };
    }
    const state = getGameSession(scene);
    const xp = 100;
    const coins = 30;
    state.xp += xp;
    state.coins += coins;
    while (state.xp >= state.xpToNext) {
        state.xp -= state.xpToNext;
        state.level += 1;
        state.xpToNext = 100 + (state.level - 1) * 50;
    }
    scene.registry.set(DUNGEON_KEY, true);
    scene.registry.set(SESSION_KEY, { ...state });
    return { firstClear: true, xp, coins };
}
