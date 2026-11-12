import * as Phaser from "phaser";
import {NullCitadelEnemy, type EnemyPlan, type EnemySense} from "./NullCitadelEnemy";

/** Null Wisp: cracked relic-mask specter; circles the player before a readable lunge. */
export class NullWisp extends NullCitadelEnemy {
    constructor(scene: Phaser.Scene, room: number, x: number, y: number, time: number, stagger = 0) {
        super(scene, "slime", {hp: 4, speed: 82, radius: 27, color: 0x9b8abb, title: "NULL WISP"}, room, x, y, time, stagger);
    }
    plan(s: EnemySense): EnemyPlan {
        const aware = this.perceive(s, 350);
        if (!this.ready(s) || !aware) {
            if (!aware) this.tactics.behavior = "idle";
            return {vx: 0, vy: 0};
        }
        const visible = s.clearSight && s.distance <= 350;
        if (visible && s.distance < 112) {
            const attack = this.request(s, "contact", 630, 1950);
            if (attack) return attack;
        }
        if (s.distance < 60) {
            this.tactics.behavior = "position";
            return {vx: 0, vy: 0};
        }
        // Slow lateral drift while approaching, avoiding straight-line swarm behavior.
        const goal = this.target(s);
        const approach = this.moveTo(s, goal.x, goal.y, 31);
        if (visible && s.distance < 220) {
            const strafe = Math.sin(s.now / 850 + this.room * .71) * 18;
            const dx = (s.playerY - this.node.y) / Math.max(1, s.distance);
            const dy = -(s.playerX - this.node.x) / Math.max(1, s.distance);
            approach.vx += dx * strafe;
            approach.vy += dy * strafe;
        }
        return approach;
    }
}
