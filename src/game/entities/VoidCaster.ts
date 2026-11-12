import * as Phaser from "phaser";
import {NullCitadelEnemy, type EnemyPlan, type EnemySense} from "./NullCitadelEnemy";

/** Void Caster: line-of-sight spell artillery; retreats, strafes, predicts corridors. */
export class VoidCaster extends NullCitadelEnemy {
    constructor(scene: Phaser.Scene, room: number, x: number, y: number, time: number, stagger = 0) {
        super(scene, "archer", {hp: 5, speed: 79, radius: 29, color: 0xb9a0d9, title: "VOID CASTER"}, room, x, y, time, stagger);
    }
    plan(s: EnemySense): EnemyPlan {
        const aware = this.perceive(s, 525);
        if (!this.ready(s) || !aware) {
            if (!aware) this.tactics.behavior = "idle";
            return {vx: 0, vy: 0};
        }
        if (s.distance < 200 && s.clearSight) {
            this.tactics.behavior = "position";
            let dx = (this.node.x - s.playerX) / Math.max(1, s.distance);
            let dy = (this.node.y - s.playerY) / Math.max(1, s.distance);
            if (!s.canStand(this.node.x + dx * 31, this.node.y + dy * 31, 18)) {
                const sign = s.index % 2 ? 1 : -1;
                const tx = -dy * sign;
                dy = dx * sign;
                dx = tx;
            }
            return {vx: dx * this.speed, vy: dy * this.speed};
        }
        if (s.distance > 370 || !s.clearSight) {
            const goal = this.target(s);
            return this.moveTo(s, goal.x, goal.y);
        }
        if (s.clearSight && s.distance >= 175 && s.distance < 490) {
            const attack = this.request(s, "shot", 850, 2450);
            if (attack) return attack;
        }
        this.tactics.behavior = "position";
        // Circle while reloading, never shoot through geometry.
        const dx = (s.playerX - this.node.x) / Math.max(1, s.distance);
        const dy = (s.playerY - this.node.y) / Math.max(1, s.distance);
        const sign = s.index % 2 ? -1 : 1;
        const vx = -dy * this.speed * .39 * sign;
        const vy = dx * this.speed * .39 * sign;
        return s.canStand(this.node.x + vx * s.dt, this.node.y + vy * s.dt, 18)
            ? {vx, vy} : {vx: 0, vy: 0};
    }
}
