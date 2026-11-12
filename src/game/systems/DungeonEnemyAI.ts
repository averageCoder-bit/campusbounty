/** G4.3 — pure perception, tactical ranges, and limited simultaneous attack budget. */
export type EnemyBehavior = "idle" | "investigate" | "chase" | "position" | "windup" | "recover" | "stunned";
export type EnemyClass = "slime" | "knight" | "archer" | "guardian";
export interface TacticalMemory {
    behavior: EnemyBehavior; lastSeenX: number; lastSeenY: number;
    lastSeenAt: number; nextPerception: number; recoverUntil: number;
    blockedFor: number; previousX: number; previousY: number;
}
export const TACTICS: Record<EnemyClass, { sight: number; ideal: number; retreat: number; windup: number; cooldown: number }> = {
    slime: { sight: 320, ideal: 62, retreat: 0, windup: 550, cooldown: 1750 },
    knight: { sight: 400, ideal: 84, retreat: 0, windup: 740, cooldown: 2400 },
    archer: { sight: 510, ideal: 310, retreat: 175, windup: 620, cooldown: 2150 },
    guardian: { sight: 760, ideal: 190, retreat: 0, windup: 920, cooldown: 3000 },
};
export function newTacticalMemory(x: number, y: number): TacticalMemory {
    return { behavior: "idle", lastSeenX: x, lastSeenY: y, lastSeenAt: -Infinity,
        nextPerception: 0, recoverUntil: 0, blockedFor: 0, previousX: x, previousY: y };
}
/** No global aggro across walls: recent sighting must be fresh. */
export function shouldPursue(memory: TacticalMemory, time: number): boolean {
    return time - memory.lastSeenAt < 4200;
}
/** Attack slots prevent a roomful of enemies from telegraphing simultaneously. */
export class DungeonAttackDirector {
    private readonly slots = new Map<number, number>();
    constructor(private readonly maxConcurrent = 2) {}
    refresh(now: number): void {
        for (const [id, until] of this.slots) if (until <= now) this.slots.delete(id);
    }
    tryAcquire(enemyId: number, until: number, now: number): boolean {
        this.refresh(now);
        if (this.slots.has(enemyId)) return true;
        if (this.slots.size >= this.maxConcurrent) return false;
        this.slots.set(enemyId, until); return true;
    }
    release(enemyId: number): void { this.slots.delete(enemyId); }
    clear(): void { this.slots.clear(); }
    get count(): number { return this.slots.size; }
}
