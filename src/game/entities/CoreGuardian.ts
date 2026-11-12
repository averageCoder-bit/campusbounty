import * as Phaser from "phaser";
import {NullCitadelEnemy, type EnemyPlan, type EnemySense} from "./NullCitadelEnemy";

/**
 * Null Citadel final boss: three visual/behavior phases, readably telegraphed
 * shockwave, cursed volleys, and a directional charge. Only scene executes hits.
 */
export class CoreGuardian extends NullCitadelEnemy {
    private previousPhase: 1 | 2 | 3 = 1;
    constructor(scene: Phaser.Scene, room: number, x: number, y: number, time: number) {
        super(scene, "guardian", {hp: 48, speed: 68, radius: 63, color: 0xe66b90, title: "THE NULL CORE GUARDIAN"}, room, x, y, time);
        this.nextAttack = time + 1500;
    }
    get phase(): 1 | 2 | 3 {
        const ratio = this.hp / this.maxHp;
        return ratio > .70 ? 1 : ratio > .35 ? 2 : 3;
    }
    override applyDamage(amount: number, now: number): void {
        super.applyDamage(amount, now);
        const phase = this.phase;
        if (phase !== this.previousPhase) {
            this.previousPhase = phase;
            this.visual.setBossPhase(phase);
            this.glow.setFillStyle(phase === 2 ? 0xe17dba : 0xfb456d);
            this.node.setScale(phase === 3 ? 1.045 : 1);
            this.tactics.recoverUntil = now + 650; // brief, readable transition pause
            this.cue?.graphic.destroy();
            this.cue = undefined;
        }
    }
    plan(s: EnemySense): EnemyPlan {
        this.perceive(s, 800, true);
        if (!this.ready(s)) return {vx: 0, vy: 0};
        if (s.distance < 670 && s.now >= this.nextAttack) {
            // Cycle remains deterministic within a seed/run, with phase-based complexity.
            const available = this.phase === 1 ? 2 : 3;
            const pattern = this.attackCycle % available;
            const attackKind = pattern === 0 ? "slam" : pattern === 1 ? "volley" : "charge";
            const windupMs = this.phase === 3 ? 890 : this.phase === 2 ? 960 : 1120;
            const cooldown = this.phase === 3 ? 2550 : this.phase === 2 ? 2900 : 3300;
            const attack = this.request(s, attackKind, windupMs, cooldown);
            if (attack) {
                this.attackCycle++;
                return attack;
            }
        }
        if (s.distance > (this.phase === 3 ? 155 : 180)) {
            const target = this.target(s);
            this.tactics.behavior = "chase";
            const move = this.moveTo(s, target.x, target.y, 0);
            const multiplier = this.phase === 3 ? 1.35 : this.phase === 2 ? 1.16 : 1;
            move.vx *= multiplier;
            move.vy *= multiplier;
            return move;
        }
        this.tactics.behavior = "position";
        return {vx: 0, vy: 0};
    }
    override frame(now: number): void {
        super.frame(now);
        const color = this.phase === 3 ? 0xff6b90 : this.phase === 2 ? 0xd4a4db : 0xdf819d;
        this.hpBar.setFillStyle(color);
    }
}
