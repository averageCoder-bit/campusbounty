/** G4.3 — deterministic attack timeline. Hit events come from active frames, not input clicks. */
export type CombatWeapon = "blade" | "spear" | "crossbow";
export interface StrikeSpec {
    weapon: CombatWeapon;
    combo: 1 | 2 | 3;
    windup: number; active: number; recovery: number;
    range: number; arc: number; damage: number; maxTargets: number;
}
export interface ActiveStrike { spec: StrikeSpec; angle: number; }
export interface CombatTick { started?: ActiveStrike; activated?: ActiveStrike; }
const STRIKES: Record<CombatWeapon, readonly StrikeSpec[]> = {
    blade: [
        { weapon: "blade", combo: 1, windup: 105, active: 70, recovery: 145, range: 118, arc: .88, damage: 2, maxTargets: 3 },
        { weapon: "blade", combo: 2, windup: 120, active: 85, recovery: 160, range: 128, arc: .96, damage: 2, maxTargets: 3 },
        { weapon: "blade", combo: 3, windup: 185, active: 105, recovery: 230, range: 151, arc: .79, damage: 4, maxTargets: 4 },
    ],
    spear: [ { weapon: "spear", combo: 1, windup: 190, active: 95, recovery: 245, range: 194, arc: .28, damage: 3, maxTargets: 2 } ],
    crossbow: [ { weapon: "crossbow", combo: 1, windup: 220, active: 35, recovery: 380, range: 640, arc: .16, damage: 2, maxTargets: 1 } ],
};
interface PendingStrike { attack: ActiveStrike; beginsAt: number; activationDone: boolean; }
export class DungeonCombatSystem {
    private pending?: PendingStrike;
    private buffered?: { weapon: CombatWeapon; angle: number };
    private bladeCombo: 0 | 1 | 2 | 3 = 0;
    private chainUntil = -Infinity;
    get busy(): boolean { return Boolean(this.pending); }
    get current(): ActiveStrike | undefined { return this.pending?.attack; }
    reset(): void { this.pending = undefined; this.buffered = undefined; this.bladeCombo = 0; this.chainUntil = -Infinity; }
    interrupt(): void { this.pending = undefined; this.buffered = undefined; }
    request(weapon: CombatWeapon, angle: number, time: number): ActiveStrike | undefined {
        if (this.pending) {
            const end = this.endAt(this.pending);
            if (end - time <= 190) this.buffered = { weapon, angle };
            return;
        }
        return this.start(weapon, angle, time);
    }
    private start(weapon: CombatWeapon, angle: number, time: number): ActiveStrike {
        let combo: 1 | 2 | 3 = 1;
        if (weapon === "blade") {
            combo = time <= this.chainUntil ? (this.bladeCombo === 3 ? 1 : this.bladeCombo + 1) as 1 | 2 | 3 : 1;
            this.bladeCombo = combo;
        } else this.bladeCombo = 0;
        const spec = STRIKES[weapon][combo - 1] ?? STRIKES[weapon][0];
        this.chainUntil = time + spec.windup + spec.active + spec.recovery + 520;
        const attack = { spec, angle };
        this.pending = { attack, beginsAt: time, activationDone: false };
        return attack;
    }
    private endAt(a: PendingStrike): number {
        return a.beginsAt + a.attack.spec.windup + a.attack.spec.active + a.attack.spec.recovery;
    }
    tick(time: number): CombatTick {
        const result: CombatTick = {};
        const p = this.pending;
        if (!p) return result;
        if (!p.activationDone && time >= p.beginsAt + p.attack.spec.windup) {
            p.activationDone = true;
            result.activated = p.attack;
        }
        if (time >= this.endAt(p)) {
            this.pending = undefined;
            if (this.buffered) {
                const b = this.buffered; this.buffered = undefined;
                result.started = this.start(b.weapon, b.angle, time);
            }
        }
        return result;
    }
}
