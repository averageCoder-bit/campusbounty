import * as Phaser from "phaser";
import { paintNullCitadelEnemy } from "./NullCitadelEnemyArt";

/**
 * G4.2: runtime-generated PIXEL-ART SPRITESHEETS + real Phaser frame animations.
 * No PNG dependencies. Texture frames are generated once, and Phaser's animation
 * system advances them; the procedural pixel art is not a per-frame Graphics tween.
 * Actor sprites are VISUAL ONLY. The existing Player Arcade body remains authoritative.
 */
export type DungeonActorKind =
    | "hero"
    | "slime"
    | "knight"
    | "archer"
    | "guardian";
export type DungeonWeapon = "blade" | "spear" | "crossbow";
type Direction =
    | "down"
    | "down-left"
    | "left"
    | "up-left"
    | "up"
    | "up-right"
    | "right"
    | "down-right";
type AnimState =
    | "idle"
    | "walk"
    | "run"
    | "blade"
    | "blade2"
    | "blade3"
    | "spear"
    | "crossbow"
    | "dodge"
    | "hit"
    | "knockback"
    | "death"
    | "windup"
    | "attack";

const FRAME_W = 100;
const FRAME_H = 104;
const COLS = 20;
const PREFIX = "cb-g4-5-null-citadel-atelier-v1";
const REGISTERED = new WeakSet<Phaser.Scene>();
const DIRS: Direction[] = [
    "down",
    "down-left",
    "left",
    "up-left",
    "up",
    "up-right",
    "right",
    "down-right",
];
const HERO_STATES: readonly AnimState[] = [
    "idle",
    "walk",
    "run",
    "blade",
    "blade2",
    "blade3",
    "spear",
    "crossbow",
    "dodge",
    "hit",
    "knockback",
    "death",
];
const MOB_STATES: readonly AnimState[] = [
    "idle",
    "walk",
    "windup",
    "attack",
    "hit",
    "death",
];
const FRAMES: Record<AnimState, number> = {
    idle: 4,
    walk: 6,
    run: 6,
    blade: 6,
    blade2: 6,
    blade3: 8,
    spear: 6,
    crossbow: 6,
    dodge: 6,
    hit: 4,
    knockback: 5,
    death: 7,
    windup: 8,
    attack: 7,
};
const FPS: Record<AnimState, number> = {
    idle: 4,
    walk: 10,
    run: 14,
    blade: 18,
    blade2: 17,
    blade3: 16,
    spear: 12,
    crossbow: 11,
    dodge: 22,
    hit: 13,
    knockback: 12,
    death: 11,
    windup: 9,
    attack: 12,
};
const REPEAT = new Set<AnimState>(["idle", "walk", "run"]);

type Painter = {
    rect: (
        x: number,
        y: number,
        width: number,
        height: number,
        color: string,
    ) => void;
    ellipse: (
        x: number,
        y: number,
        width: number,
        height: number,
        color: string,
    ) => void;
};

function px(ctx: CanvasRenderingContext2D): Painter {
    return {
        rect: (x, y, w, h, color) => {
            ctx.fillStyle = color;
            ctx.fillRect(Math.round(x), Math.round(y), w, h);
        },
        ellipse: (x, y, w, h, color) => {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2);
            ctx.fill();
        },
    };
}

/**
 * G4.3.1: the hero's BODY is copied from the actual Player.ts texture.
 * Player's public sprite is the authoritative source of art and direction frames:
 * 20x28 px, 8 directions x 4 poses, displayed at the Player's original 3x scale.
 * Only weapon trails / combat effects are drawn in this dungeon-specific atlas.
 * Never redraw the student's anatomy here: that is what caused the wide torso.
 */
const SHARED_FRAME_W = 20;
const SHARED_FRAME_H = 28;
const SHARED_POSES = 4;
const SHARED_SCALE = 3;
const POSE_BY_STATE: Record<AnimState, readonly number[]> = {
    idle: [0, 3, 0, 3],
    walk: [0, 1, 0, 2, 0, 1],
    run: [0, 1, 0, 2, 0, 1],
    blade: [0, 1, 1, 2, 0, 0],
    blade2: [0, 2, 2, 1, 0, 0],
    blade3: [0, 1, 1, 2, 0, 0, 0, 3],
    spear: [0, 0, 1, 2, 0, 0],
    crossbow: [0, 0, 1, 1, 0, 0],
    dodge: [0, 1, 2, 1, 0, 0],
    hit: [0, 0, 3, 0],
    knockback: [0, 3, 3, 0, 0],
    death: [0, 3, 3, 3, 3, 3, 3],
    windup: [0],
    attack: [0],
};

function dirAngle(dir: Direction): number {
    switch (dir) {
        case "right":
            return 0;
        case "down-right":
            return Math.PI / 4;
        case "down":
            return Math.PI / 2;
        case "down-left":
            return (3 * Math.PI) / 4;
        case "left":
            return Math.PI;
        case "up-left":
            return (-3 * Math.PI) / 4;
        case "up":
            return -Math.PI / 2;
        case "up-right":
            return -Math.PI / 4;
    }
}

function drawHero(
    ctx: CanvasRenderingContext2D,
    state: AnimState,
    dir: Direction,
    frame: number,
    source: CanvasImageSource,
): void {
    const p = px(ctx);
    const poseSequence = POSE_BY_STATE[state];
    const pose = poseSequence[Math.min(frame, poseSequence.length - 1)];
    const sourceFrame = DIRS.indexOf(dir) * SHARED_POSES + pose;
    const width = SHARED_FRAME_W * SHARED_SCALE;
    const height = SHARED_FRAME_H * SHARED_SCALE;

    // Draw the precise rounded 20x28 sprite from Player.ts at native 3x size.
    // The source already contains correctly mirrored left / right directions.
    // Never mirror this canvas a second time (double-mirroring breaks the profile).
    ctx.imageSmoothingEnabled = false;
    const isDodging = state === "dodge";
    const isDead = state === "death";
    const nudge = state === "knockback" ? -Math.min(9, frame * 2) : 0;
    ctx.save();
    ctx.translate(nudge, isDodging ? Math.abs(frame - 2) : 0);
    if (isDodging && frame > 0 && frame < 4) ctx.globalAlpha = 0.82;
    if (isDead) ctx.globalAlpha = Math.max(0.14, 1 - frame / 7);
    ctx.drawImage(
        source,
        sourceFrame * SHARED_FRAME_W,
        0,
        SHARED_FRAME_W,
        SHARED_FRAME_H,
        -width / 2,
        -height / 2,
        width,
        height,
    );
    ctx.globalAlpha = 1;
    if (state === "hit" || state === "knockback") {
        if (frame % 2 === 0) {
            ctx.fillStyle = "rgba(251,113,133,0.26)";
            ctx.fillRect(-17, -19, 34, 39);
        }
    }
    if (isDodging) {
        p.rect(-16, 27, 32, 2, "#67e8f9");
        if (frame === 1 || frame === 2) p.rect(-23, 33, 46, 2, "#38bdf8");
    }
    ctx.restore();

    // Attacks have individually timed, genuinely different frames.
    // The sword/spear/bow is a VFX layer; the player's original anatomy stays intact.
    if (
        state !== "blade" &&
        state !== "blade2" &&
        state !== "blade3" &&
        state !== "spear" &&
        state !== "crossbow"
    )
        return;
    const total = FRAMES[state];
    const progress = frame / Math.max(1, total - 1);
    const aim = dirAngle(dir);
    // The gold badge / hands of the original Player land near this height.
    // Shift the pivot to the appropriate facing edge of the torso.
    // Attach weapons to the visible hand, not the body's centerline.
    const leftHand = dir === "left" || dir.endsWith("-left");

    const handX = dir === "up" || dir === "down" ? 18 : leftHand ? -12 : 12;

    const handY = 14;

    ctx.save();
    ctx.translate(handX, handY);

    if (state === "blade" || state === "blade2" || state === "blade3") {
        const reverse = state === "blade2";
        const heavy = state === "blade3";

        const sweep = heavy ? 1.8 : 1.55;

        const offset = reverse
            ? 0.8 - progress * sweep
            : -0.8 + progress * sweep;

        // Rotate sword forward from the character's hand.
        ctx.rotate(aim + Math.PI / 2 + offset);

        const reach = heavy ? 32 : 27;

        // Handle
        p.rect(-2, -3, 5, 12, "#9c7045");

        // Guard
        p.rect(-5, -7, 11, 4, "#fbbf24");

        // Blade
        p.rect(-2, -reach, 5, reach - 8, heavy ? "#fff1bb" : "#cbd5e1");

        // Blade highlight
        p.rect(-1, -reach, 2, reach - 10, "#f8fafc");

        // Swing trail
        if (frame >= 2 && frame <= (heavy ? 5 : 4)) {
            p.rect(6, -reach + 4, 2, reach - 13, "#7dd3fc");
        }
    } else if (state === "spear") {
        // Spear shares the same hand anchor as the sword.
        // No extra translation toward the body.
        ctx.rotate(aim + Math.PI / 2);

        const thrust = frame < 2 ? -2 : frame === 2 ? 2 : frame === 3 ? 6 : 0;

        // Wooden shaft
        p.rect(-2, -17 - thrust, 4, 29 + thrust, "#9c7045");

        // Spearhead
        p.rect(-5, -23 - thrust, 10, 8, "#cbd5e1");
        p.rect(-2, -30 - thrust, 4, 9, "#f8fafc");

        // Thrust trail
        if (frame === 2 || frame === 3) {
            p.rect(6, -25 - thrust, 2, 15, "#67e8f9");
        }
    } else {
        ctx.rotate(aim + Math.PI / 2);
        const kick = frame === 3 ? 5 : 0;
        ctx.translate(0, kick);
        p.rect(-11, -9, 22, 8, "#825e40");
        p.rect(-8, -10, 16, 3, "#d8a85e");
        p.rect(-2, -20, 4, 22, "#a5f3fc");
        p.rect(-10, -19, 20, 2, "#a5f3fc");
        if (frame === 3 || frame === 4) p.rect(-5, -28, 10, 6, "#fef3c7");
    }
    ctx.restore();
}

// G4.5 enemy artwork lives in its own pixel-art atelier; hero remains Player.ts art.
function drawMob(
    ctx: CanvasRenderingContext2D,
    kind: Exclude<DungeonActorKind, "hero">,
    state: AnimState,
    dir: Direction,
    frame: number,
): void {
    if (
        state === "blade" ||
        state === "blade2" ||
        state === "blade3" ||
        state === "spear" ||
        state === "crossbow" ||
        state === "dodge" ||
        state === "knockback" ||
        state === "run"
    )
        return;
    paintNullCitadelEnemy(ctx, kind, state, dir, frame);
}

function textureKey(kind: DungeonActorKind): string {
    return `${PREFIX}-${kind}`;
}
function animationKey(
    kind: DungeonActorKind,
    state: AnimState,
    dir: Direction,
): string {
    return `${PREFIX}-${kind}-${state}-${dir}`;
}

export function registerDungeonSpriteAnimations(
    scene: Phaser.Scene,
    heroSource?: Phaser.GameObjects.Sprite,
): void {
    if (REGISTERED.has(scene)) return;
    const sourceCanvas = heroSource?.texture.getSourceImage() as
        | CanvasImageSource
        | undefined;
    if (!sourceCanvas) {
        throw new Error(
            "DungeonSpriteAnimations requires the shared Player.sprite source to draw the hero.",
        );
    }
    const kinds: DungeonActorKind[] = [
        "hero",
        "slime",
        "knight",
        "archer",
        "guardian",
    ];
    for (const kind of kinds) {
        const states = kind === "hero" ? HERO_STATES : MOB_STATES;
        const textureName = textureKey(kind);
        const plan: {
            frame: string;
            state: AnimState;
            dir: Direction;
            index: number;
        }[] = [];
        for (const dir of DIRS)
            for (const state of states)
                for (let i = 0; i < FRAMES[state]; i++)
                    plan.push({
                        frame: `${state}-${dir}-${i}`,
                        state,
                        dir,
                        index: i,
                    });
        if (!scene.textures.exists(textureName)) {
            const texture = scene.textures.createCanvas(
                textureName,
                COLS * FRAME_W,
                Math.ceil(plan.length / COLS) * FRAME_H,
            );
            if (!texture)
                throw new Error(
                    `Failed to create dungeon animation texture: ${textureName}`,
                );
            const ctx = texture.context;
            ctx.imageSmoothingEnabled = false;
            for (let index = 0; index < plan.length; index++) {
                const { frame, state, dir, index: f } = plan[index];
                const x = (index % COLS) * FRAME_W,
                    y = Math.floor(index / COLS) * FRAME_H;
                ctx.save();
                ctx.translate(x + FRAME_W / 2, y + FRAME_H / 2);
                // The shared Player.ts source includes its own left-facing frames.
                // Only NPC procedural art is mirrored by this atlas.
                if (
                    kind !== "hero" &&
                    (dir === "left" || dir === "up-left" || dir === "down-left")
                )
                    ctx.scale(-1, 1);
                if (kind === "hero") drawHero(ctx, state, dir, f, sourceCanvas);
                else drawMob(ctx, kind, state, dir, f);
                ctx.restore();
                texture.add(frame, 0, x, y, FRAME_W, FRAME_H);
            }
            texture.refresh();
        }
        for (const dir of DIRS)
            for (const state of states) {
                const key = animationKey(kind, state, dir);
                if (scene.anims.exists(key)) continue;
                scene.anims.create({
                    key,
                    frames: Array.from({ length: FRAMES[state] }, (_, i) => ({
                        key: textureName,
                        frame: `${state}-${dir}-${i}`,
                    })),
                    frameRate: FPS[state],
                    repeat: REPEAT.has(state) ? -1 : 0,
                });
            }
    }
    REGISTERED.add(scene);
}

function directionOf(dx: number, dy: number): Direction {
    if (Math.hypot(dx, dy) < 0.01) return "down";
    const clockwise = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
    return (
        [
            "right",
            "down-right",
            "down",
            "down-left",
            "left",
            "up-left",
            "up",
            "up-right",
        ] as Direction[]
    )[((clockwise % 8) + 8) % 8];
}

/** Visual-only animated actor. No physics body, no gameplay authority. */
export class DungeonActorAnimator {
    readonly sprite: Phaser.GameObjects.Sprite;
    private readonly kind: DungeonActorKind;
    private direction: Direction = "down";
    private lockedUntil = 0;
    private current = "";
    private dead = false;
    private lastMovingAt = -10000;
    private readonly scene: Phaser.Scene;

    constructor(
        scene: Phaser.Scene,
        kind: DungeonActorKind,
        x = 0,
        y = 0,
        heroSource?: Phaser.GameObjects.Sprite,
    ) {
        registerDungeonSpriteAnimations(scene, heroSource);
        this.scene = scene;
        this.kind = kind;
        this.sprite = scene.add.sprite(x, y, textureKey(kind), "idle-down-0");
        const scale =
            kind === "guardian"
                ? 2.4
                : kind === "hero"
                  ? 1.0 // exact shared Player.ts art at 3x
                  : kind === "slime"
                    ? 1.45
                    : 1.65; // Hollow Sentinel / Void Caster
        this.sprite.setScale(scale).setOrigin(0.5);
        this.play("idle", true);
    }

    private play(state: AnimState, force = false): void {
        if (this.dead && state !== "death") return;
        const key = animationKey(this.kind, state, this.direction);
        if (!force && this.current === key) return;
        this.current = key;
        this.sprite.anims.play(key, !force);
    }

    sync(
        x: number,
        y: number,
        vx: number,
        vy: number,
        time: number,
        running = false,
    ): void {
        if (this.dead) return;
        this.sprite.setPosition(x, y);
        if (time < this.lockedUntil) return;
        if (Math.hypot(vx, vy) > 4) {
            this.lastMovingAt = time;
            this.direction = directionOf(vx, vy);
            this.play(this.kind === "hero" && running ? "run" : "walk");
        } else if (time - this.lastMovingAt > 110) this.play("idle");
    }

    attack(
        time: number,
        angle: number,
        weapon: DungeonWeapon | "attack" = "attack",
        combo: 1 | 2 | 3 = 1,
    ): void {
        if (this.dead) return;
        this.direction = directionOf(Math.cos(angle), Math.sin(angle));
        const state: AnimState =
            this.kind === "hero"
                ? weapon === "blade" || weapon === "attack"
                    ? combo === 2
                        ? "blade2"
                        : combo === 3
                          ? "blade3"
                          : "blade"
                    : weapon
                : "attack";
        this.lockedUntil =
            time + Math.round((FRAMES[state] * 1000) / FPS[state]);
        this.play(state, true);
    }

    telegraph(time: number, angle: number, durationMs?: number): void {
        if (this.dead || this.kind === "hero") return;
        this.direction = directionOf(Math.cos(angle), Math.sin(angle));
        this.lockedUntil = time + (durationMs ?? (8 * 1000) / FPS.windup);
        this.play("windup", true);
    }

    dodge(time: number, vx: number, vy: number): void {
        if (this.dead || this.kind !== "hero") return;
        if (Math.hypot(vx, vy) > 2) this.direction = directionOf(vx, vy);
        this.lockedUntil = time + 260;
        this.play("dodge", true);
    }

    knockback(time: number, awayX: number, awayY: number): void {
        if (this.dead || this.kind !== "hero") return;
        if (Math.hypot(awayX, awayY) > 1)
            this.direction = directionOf(awayX, awayY);
        this.lockedUntil = time + 350;
        this.play("knockback", true);
    }

    hit(time: number): void {
        if (this.dead) return;
        this.lockedUntil = time + 210;
        this.play("hit", true);
    }

    die(): void {
        if (this.dead) return;
        this.dead = true;
        this.play("death", true);
        this.scene.time.delayedCall(680, () => this.sprite.destroy());
    }

    /** Boss phase visual feedback; does not tint or replace the shared hero artwork. */
    setBossPhase(phase: 1 | 2 | 3): void {
        if (this.kind !== "guardian") return;
        this.sprite.setTint(
            phase === 1 ? 0xffffff : phase === 2 ? 0xf9d9f5 : 0xffa7b9,
        );
    }

    destroy(): void {
        this.sprite.destroy();
    }
}

