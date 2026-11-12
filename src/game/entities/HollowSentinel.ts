import * as Phaser from "phaser";
import {NullCitadelEnemy, type EnemyPlan, type EnemySense} from "./NullCitadelEnemy";

/** Hollow Sentinel: iron shield-bearing construct; deliberate guard + heavy punish. */
export class HollowSentinel extends NullCitadelEnemy {
    constructor(scene: Phaser.Scene, room: number, x: number, y: number, time: number, stagger = 0) {
        super(scene, "knight", {hp: 8, speed: 70, radius: 34, color: 0xbb8294, title: "HOLLOW SENTINEL"}, room, x, y, time, stagger);
    }
    override absorbDamage(amount: number, now: number, heroX: number, heroY: number): {damage: number; blocked: boolean} {
        // Shield is held while patrolling or positioning; heavy windup/recovery opens it.
        const activeGuard = this.tactics.behavior !== "windup" &&
            this.tactics.behavior !== "recover" && now >= this.stunnedUntil;
        const facing = Math.atan2(this.tactics.lastSeenY - this.node.y, this.tactics.lastSeenX - this.node.x);
        const from = Math.atan2(heroY - this.node.y, heroX - this.node.x);
        const angle = Math.atan2(Math.sin(from - facing), Math.cos(from - facing));
        const blocked = activeGuard && Math.abs(angle) < .84 && amount <= 3;
        return {damage: blocked ? Math.max(1, amount - 2) : amount, blocked};
    }
    plan(s: EnemySense): EnemyPlan {
        const aware = this.perceive(s, 425);
        if (!this.ready(s) || !aware) {
            if (!aware) this.tactics.behavior = "idle";
            return {vx: 0, vy: 0};
        }
        if (s.clearSight && s.distance < 123) {
            const attack = this.request(s, "contact", 900, 2550);
            if (attack) return attack;
        }
        if (s.distance < 91) {
            this.tactics.behavior = "position";
            return {vx: 0, vy: 0};
        }
        const target = this.target(s);
        return this.moveTo(s, target.x, target.y, 15);
    }
}
