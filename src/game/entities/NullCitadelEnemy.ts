import * as Phaser from "phaser";
import { DungeonActorAnimator } from "../animations/DungeonSpriteAnimations";
import {
    newTacticalMemory,
    shouldPursue,
    type TacticalMemory,
} from "../systems/DungeonEnemyAI";

/** Legacy discriminator names preserve combat/ranged/boss integration from G4.3. */
export type CitadelEnemyKind = "slime" | "knight" | "archer" | "guardian";
export type EnemyAttackKind = "contact" | "shot" | "slam" | "volley" | "charge";
export interface EnemyCue {
    kind: EnemyAttackKind;
    firesAt: number;
    graphic: Phaser.GameObjects.GameObject;
    tx: number;
    ty: number;
}
export interface EnemyAttackRequest {
    kind: EnemyAttackKind;
    tx: number;
    ty: number;
    windupMs: number;
    cooldownMs: number;
}
export interface EnemyPlan {
    vx: number;
    vy: number;
    attack?: EnemyAttackRequest;
}
export interface EnemySense {
    now: number;
    dt: number;
    index: number;
    playerX: number;
    playerY: number;
    distance: number;
    clearSight: boolean;
    path: (tx: number, ty: number) => {x: number; y: number};
    canStand: (x: number, y: number, pad: number) => boolean;
    separation: () => {x: number; y: number};
    tryAttack: (durationMs: number) => boolean;
}

interface EnemyStats {
    hp: number;
    speed: number;
    radius: number;
    color: number;
    title: string;
}

/**
 * Shared entity ownership: scene node, animator, health, AI memory, telegraph,
 * collider-free movement intent, and death presentation all live here.
 * The DungeonConquer scene remains authoritative for projectile collision,
 * pathfinding and damage to the player.
 */
export abstract class NullCitadelEnemy {
    readonly kind: CitadelEnemyKind;
    readonly room: number;
    readonly node: Phaser.GameObjects.Container;
    readonly visual: DungeonActorAnimator;
    readonly hpBar: Phaser.GameObjects.Rectangle;
    readonly maxHp: number;
    readonly speed: number;
    readonly radius: number;
    readonly tactics: TacticalMemory;
    readonly title: string;
    hp: number;
    alive = true;
    nextAttack: number;
    nextPath = 0;
    stunnedUntil = 0;
    summoned = 0;
    aggro = false;
    attackCycle = 0;
    cue?: EnemyCue;
    protected readonly scene: Phaser.Scene;
    protected readonly glow: Phaser.GameObjects.Ellipse;
    protected readonly shadow: Phaser.GameObjects.Ellipse;
    private readonly coreLight?: Phaser.GameObjects.Arc;

    protected constructor(
        scene: Phaser.Scene,
        kind: CitadelEnemyKind,
        stats: EnemyStats,
        room: number,
        x: number,
        y: number,
        time: number,
        stagger = 0,
    ) {
        this.scene = scene;
        this.kind = kind;
        this.title = stats.title;
        this.room = room;
        this.maxHp = stats.hp;
        this.hp = stats.hp;
        this.speed = stats.speed;
        this.radius = stats.radius;
        this.tactics = newTacticalMemory(x, y);
        this.nextAttack = time + 850 + stagger;
        const shadowWidth = kind === "guardian" ? 205 : stats.radius * 2.0;
        const glowWidth = kind === "guardian" ? 220 : stats.radius * 2.3;
        this.shadow = scene.add.ellipse(0, stats.radius * .58, shadowWidth, stats.radius * .48, 0x03040a, .68);
        this.glow = scene.add.ellipse(0, -5, glowWidth, stats.radius * 1.65, stats.color, .09);
        this.visual = new DungeonActorAnimator(scene, kind, 0, -6);
        this.visual.sync(0, -6, 0, 0, time);
        const isBoss = kind === "guardian";
        const healthY = isBoss ? -155 : -69;
        const healthW = isBoss ? 150 : 66;
        const barBack = scene.add.rectangle(0, healthY, healthW + 4, 13, 0x0a0b14);
        const barInner = scene.add.rectangle(0, healthY, healthW, 9, 0x3f2230);
        this.hpBar = scene.add.rectangle(-healthW / 2, healthY, healthW, 7, stats.color).setOrigin(0, .5);
        const children: Phaser.GameObjects.GameObject[] = [this.shadow, this.glow];
        if (isBoss) {
            this.coreLight = scene.add.circle(0, -10, 78, 0xc34773, .075);
            children.push(this.coreLight);
        }
        children.push(this.visual.sprite, barBack, barInner, this.hpBar);
        this.node = scene.add.container(x, y, children).setDepth(y + 20);
    }

    protected perceive(sense: EnemySense, range: number, alwaysAware = false): boolean {
        const b = this.tactics;
        if (sense.now >= b.nextPerception) {
            b.nextPerception = sense.now + 190 + (sense.index % 5) * 25;
            if (sense.distance <= range && sense.clearSight) {
                b.lastSeenAt = sense.now;
                b.lastSeenX = sense.playerX;
                b.lastSeenY = sense.playerY;
            }
        }
        this.aggro = alwaysAware || shouldPursue(b, sense.now);
        return this.aggro;
    }

    protected ready(sense: EnemySense): boolean {
        if (!this.alive) return false;
        if (sense.now < this.stunnedUntil) {
            this.tactics.behavior = "stunned";
            return false;
        }
        if (this.cue) return false;
        if (sense.now < this.tactics.recoverUntil) {
            this.tactics.behavior = "recover";
            return false;
        }
        return true;
    }

    protected moveTo(sense: EnemySense, x: number, y: number, separation = 0): EnemyPlan {
        const b = this.tactics;
        b.behavior = "chase";
        const d = sense.path(x, y);
        const s = separation ? sense.separation() : {x: 0, y: 0};
        return {vx: d.x * this.speed + s.x * separation, vy: d.y * this.speed + s.y * separation};
    }

    protected target(sense: EnemySense): {x: number; y: number} {
        return sense.clearSight
            ? {x: sense.playerX, y: sense.playerY}
            : {x: this.tactics.lastSeenX, y: this.tactics.lastSeenY};
    }

    protected request(sense: EnemySense, kind: EnemyAttackKind, windupMs: number, cooldownMs: number): EnemyPlan | undefined {
        if (sense.now < this.nextAttack || !sense.tryAttack(windupMs + 120)) return undefined;
        this.nextAttack = sense.now + cooldownMs;
        this.tactics.behavior = "windup";
        return {vx: 0, vy: 0, attack: {
            kind, tx: sense.playerX, ty: sense.playerY, windupMs, cooldownMs,
        }};
    }

    abstract plan(sense: EnemySense): EnemyPlan;

    /** Overridden by shield units. Return the actual damage to apply. */
    absorbDamage(damage: number, _time: number, _heroX: number, _heroY: number): {damage: number; blocked: boolean} {
        return {damage, blocked: false};
    }

    applyDamage(amount: number, now: number): void {
        this.hp = Math.max(0, this.hp - amount);
        this.stunnedUntil = now + (this.kind === "guardian" ? 85 : 170);
        this.hpBar.setScale(this.hp / this.maxHp, 1);
        this.visual.hit(now);
    }

    frame(now: number): void {
        this.node.setDepth(this.node.y + 20).setAlpha(now < this.stunnedUntil ? .64 : 1);
        const pulsing = .065 + Math.sin(now / (this.kind === "guardian" ? 240 : 380) + this.room) * .035;
        this.glow.setAlpha(this.cue ? .23 : pulsing);
        if (this.coreLight) this.coreLight.setAlpha(.08 + Math.sin(now / 175) * .035);
    }

    die(onCorpse?: (sprite: Phaser.GameObjects.Sprite) => void): void {
        if (!this.alive) return;
        this.alive = false;
        this.cue?.graphic.destroy();
        this.cue = undefined;
        const corpse = this.visual.sprite;
        this.node.remove(corpse, false);
        this.scene.add.existing(corpse);
        corpse.setPosition(this.node.x, this.node.y - 6).setDepth(this.node.y + 20);
        onCorpse?.(corpse);
        this.visual.die();
        this.node.destroy(true);
    }
}
