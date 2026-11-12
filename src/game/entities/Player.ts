import * as Phaser from "phaser";

/**
 * CampusBounty G2.1 — rounded, reference-inspired student character.
 * Keeps CampusBounty's blue uniform, gold chest badge, navy hair and dark pants.
 * Eight directional idle + walk animations, no nose or backpack.
 * Drop-in interface: new Player(scene, x, y), .sprite, .update(), .destroy().
 */
const PREFIX = "cb-player-student-v4-side-profile";
const PLAYER_TEXTURE = PREFIX;
const FRAME_W = 20;
const FRAME_H = 28;
const SCALE = 3;
const SPEED = 195;
const FACING_GRACE_MS = 90;

const DIRECTIONS = [
    "down",
    "down-left",
    "left",
    "up-left",
    "up",
    "up-right",
    "right",
    "down-right",
] as const;
type Direction = (typeof DIRECTIONS)[number];
type View = "front" | "frontDiag" | "side" | "backDiag" | "back";
type Motion = "idle" | "walk";

const VIEW_OF: Record<Direction, { view: View; mirror: boolean }> = {
    down: { view: "front", mirror: false },
    "down-left": { view: "frontDiag", mirror: false },
    left: { view: "side", mirror: false },
    "up-left": { view: "backDiag", mirror: false },
    up: { view: "back", mirror: false },
    "up-right": { view: "backDiag", mirror: true },
    right: { view: "side", mirror: true },
    "down-right": { view: "frontDiag", mirror: true },
};

const C = {
    hair: 0x202b3f, // same navy as the CampusBounty title screen
    hairDark: 0x172033,
    hairLight: 0x34445f,
    skin: 0xf1c9a3,
    skinShade: 0xd8a77d,
    eye: 0x111827,
    shirt: 0x60a5fa,
    shirtShade: 0x3b82f6,
    shirtHighlight: 0x8ac0ff,
    badge: 0xfbbf24,
    pants: 0x334155,
    pantsShade: 0x263449,
    shoes: 0x0f172a,
} as const;

interface Pose {
    bob: number;
    leftArm: number;
    rightArm: number;
    leftLift: number;
    rightLift: number;
}

// Idle / step left / step right / breathing idle.
const POSES: readonly Pose[] = [
    { bob: 0, leftArm: 0, rightArm: 0, leftLift: 0, rightLift: 0 },
    { bob: 1, leftArm: -1, rightArm: 1, leftLift: 1, rightLift: 0 },
    { bob: 1, leftArm: 1, rightArm: -1, leftLift: 0, rightLift: 1 },
    { bob: 1, leftArm: 0, rightArm: 0, leftLift: 0, rightLift: 0 },
];
const IDLE_SEQUENCE = [0, 3];
const WALK_SEQUENCE = [0, 1, 0, 2];
const frameNumber = (dir: number, pose: number) => dir * POSES.length + pose;

type Pixel = (
    x: number,
    y: number,
    w: number,
    h: number,
    color: number,
) => void;

/** Wide, rounded hair mass like the reference, but in CampusBounty navy. */
function hairBack(px: Pixel, b: number): void {
    px(7, 0 + b, 6, 1, C.hair);
    px(5, 1 + b, 10, 2, C.hair);
    px(4, 3 + b, 12, 3, C.hair);
    px(3, 6 + b, 14, 4, C.hair);
    px(4, 10 + b, 12, 2, C.hairDark);
    px(6, 12 + b, 8, 1, C.hairDark);
    px(7, 1 + b, 5, 1, C.hairLight);
    px(5, 4 + b, 2, 2, C.hairLight);
    px(13, 4 + b, 2, 2, C.hairDark);
}

/** Feet are narrow; legs alternate without shifting the character's origin. */
function legs(px: Pixel, p: Pose): void {
    px(7, 21, 3, 5 - p.leftLift, C.pants);
    px(11, 21, 3, 5 - p.rightLift, C.pantsShade);
    px(6, 26 - p.leftLift, 4, 2, C.shoes);
    px(11, 26 - p.rightLift, 4, 2, C.shoes);
}

function arms(px: Pixel, p: Pose, shadeFar = false): void {
    const b = p.bob;
    // Hands are visible as separate skin pixels, not backpack straps.
    px(5, 14 + b + p.leftArm, 2, 6, C.shirt);
    px(5, 20 + b + p.leftArm, 2, 2, C.skin);
    px(14, 14 + b + p.rightArm, 2, 6, shadeFar ? C.shirtShade : C.shirt);
    px(14, 20 + b + p.rightArm, 2, 2, C.skinShade);
}

function torso(px: Pixel, p: Pose, showBadge = true): void {
    const b = p.bob;
    px(7, 13 + b, 7, 8, C.shirt);
    px(7, 14 + b, 1, 6, C.shirtHighlight);
    px(13, 14 + b, 1, 6, C.shirtShade);
    px(7, 20 + b, 7, 1, C.pants);
    if (showBadge) px(9, 16 + b, 2, 2, C.badge);
}

/** Facing the viewer: exposed face, clean fringe, eyes only, no nose. */
function drawFront(px: Pixel, p: Pose): void {
    const b = p.bob;
    legs(px, p);
    arms(px, p);
    torso(px, p);

    // Large but softened cheek silhouette (not the old 8x8 square).
    px(6, 5 + b, 9, 7, C.skin);
    px(5, 7 + b, 11, 4, C.skin);
    px(7, 11 + b, 7, 2, C.skinShade);

    // Rounded hair framing the face; fringe sits above the eyes.
    px(7, 0 + b, 6, 1, C.hair);
    px(5, 1 + b, 10, 2, C.hair);
    px(4, 3 + b, 12, 3, C.hair);
    px(4, 5 + b, 3, 2, C.hair);
    px(14, 5 + b, 3, 2, C.hair);
    px(5, 6 + b, 1, 3, C.hairDark);
    px(15, 6 + b, 1, 2, C.hairDark);
    px(7, 3 + b, 5, 1, C.hairLight);
    px(12, 4 + b, 2, 1, C.hairDark);
    px(8, 8 + b, 1, 2, C.eye);
    px(12, 8 + b, 1, 2, C.eye);
}

/** Three-quarter view, facing left. The right-facing frame is mirrored. */
function drawFrontDiag(px: Pixel, p: Pose): void {
    const b = p.bob;
    legs(px, p);
    arms(px, p, true);
    torso(px, p);
    px(12, 14 + b, 2, 6, C.shirtShade);
    px(8, 16 + b, 2, 2, C.badge);

    // A visible left cheek and rounded, deeper right-side hair silhouette.
    px(6, 5 + b, 8, 7, C.skin);
    px(5, 7 + b, 9, 4, C.skin);
    px(7, 11 + b, 7, 2, C.skinShade);
    px(7, 0 + b, 6, 1, C.hair);
    px(5, 1 + b, 10, 2, C.hair);
    px(4, 3 + b, 12, 3, C.hair);
    px(4, 5 + b, 3, 2, C.hair);
    px(12, 5 + b, 5, 5, C.hair);
    px(14, 10 + b, 2, 2, C.hairDark);
    px(5, 6 + b, 1, 2, C.hairDark);
    px(7, 3 + b, 5, 1, C.hairLight);
    px(7, 8 + b, 1, 2, C.eye);
    px(10, 8 + b, 1, 2, C.eye);
}

/** Profile facing left. The right-facing frame is mirrored in drawFrame(). */
function drawSide(px: Pixel, p: Pose): void {
    const b = p.bob;
    const stride = p.leftLift - p.rightLift;

    // Keep the feet on opposite steps, preserving the existing walking cadence.
    px(10 + stride, 21, 3, 5 - p.rightLift, C.pantsShade);
    px(7 - stride, 21, 3, 5 - p.leftLift, C.pants);
    px(9 + stride, 26 - p.rightLift, 4, 2, C.shoes);
    px(6 - stride, 26 - p.leftLift, 4, 2, C.shoes);

    // The far shoulder sits BEHIND the torso; don't draw a detached far hand.
    px(12, 15 + b, 1, 5, C.shirtShade);

    // Side-view torso: the chest / badge faces LEFT (the direction of travel).
    // Right-facing frames mirror these exact pixels, including the layering.
    px(7, 13 + b, 6, 8, C.shirt);
    px(7, 14 + b, 1, 6, C.shirtHighlight);
    px(12, 14 + b, 1, 6, C.shirtShade);
    px(7, 20 + b, 6, 1, C.pants);
    px(7, 16 + b, 2, 2, C.badge);

    // The near arm belongs on the MIDDLE of the torso, not the leading edge.
    // Use the opposite leg's arm phase to create a natural reciprocal walk.
    // Walking toward screen-left: front leg forward => arm back, and vice versa.
    const armStep = p.rightArm;
    const armX = 9 + armStep;
    const armY = 14 + b + (armStep < 0 ? -1 : 0);
    px(armX, armY, 3, 6, C.shirtShade);
    px(armX, armY, 1, 4, C.shirt);
    px(armX, armY + 6, 3, 2, C.skin);

    // Original recognizable hair silhouette, cheek and single profile eye.
    px(6, 5 + b, 7, 7, C.skin);
    px(5, 7 + b, 8, 4, C.skin);
    px(7, 11 + b, 6, 2, C.skinShade);
    px(8, 0 + b, 5, 1, C.hair);
    px(6, 1 + b, 9, 2, C.hair);
    px(5, 3 + b, 11, 3, C.hair);
    px(5, 5 + b, 3, 2, C.hair);
    px(12, 5 + b, 5, 6, C.hair);
    px(13, 11 + b, 3, 1, C.hairDark);
    px(8, 3 + b, 4, 1, C.hairLight);
    px(7, 8 + b, 1, 2, C.eye);
    px(11, 9 + b, 1, 2, C.skinShade); // ear, not a nose
}

/** Back view: the student is NOT carrying a backpack. */
function drawBack(px: Pixel, p: Pose): void {
    legs(px, p);
    arms(px, p);
    torso(px, p, false);
    // A seam across the back of the blue shirt, not a bag.
    px(8, 15 + p.bob, 5, 1, C.shirtHighlight);
    hairBack(px, p.bob);
}

/** Three-quarter view while walking away; no straps or backpack. */
function drawBackDiag(px: Pixel, p: Pose): void {
    legs(px, p);
    arms(px, p, true);
    torso(px, p, false);
    px(12, 15 + p.bob, 2, 5, C.shirtShade);
    px(8, 15 + p.bob, 4, 1, C.shirtHighlight);
    hairBack(px, p.bob);
    px(4, 8 + p.bob, 2, 3, C.skin); // sliver of cheek on near side
    px(5, 8 + p.bob, 1, 2, C.hairDark);
}

/** Draw a single frame of a 32-frame sprite texture (8 dirs × 4 poses). */
function drawFrame(
    g: Phaser.GameObjects.Graphics,
    slot: number,
    direction: Direction,
    pose: Pose,
): void {
    const { view, mirror } = VIEW_OF[direction];
    const offsetX = slot * FRAME_W;
    const px: Pixel = (x, y, w, h, color) => {
        g.fillStyle(color, 1);
        g.fillRect(offsetX + (mirror ? FRAME_W - x - w : x), y, w, h);
    };
    switch (view) {
        case "front":
            drawFront(px, pose);
            break;
        case "frontDiag":
            drawFrontDiag(px, pose);
            break;
        case "side":
            drawSide(px, pose);
            break;
        case "backDiag":
            drawBackDiag(px, pose);
            break;
        case "back":
            drawBack(px, pose);
            break;
    }
}

export class Player {
    readonly sprite: Phaser.Physics.Arcade.Sprite;
    private readonly shadow: Phaser.GameObjects.Ellipse;
    private readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys;
    private readonly keys: {
        up: Phaser.Input.Keyboard.Key;
        down: Phaser.Input.Keyboard.Key;
        left: Phaser.Input.Keyboard.Key;
        right: Phaser.Input.Keyboard.Key;
    };
    private readonly movement = new Phaser.Math.Vector2();
    private facing: Direction = "down";
    private lastDiagonalAt = -Infinity;
    private state: Motion = "idle";

    constructor(scene: Phaser.Scene, x: number, y: number) {
        if (!scene.input.keyboard) {
            throw new Error("Keyboard input is required for CampusBounty G2.");
        }
        Player.createAssets(scene);
        this.sprite = scene.physics.add.sprite(
            x,
            y,
            PLAYER_TEXTURE,
            frameNumber(0, 0),
        );
        this.sprite.setScale(SCALE);
        this.sprite.setCollideWorldBounds(true);
        // Preserve feet-only physics; frame dimensions increased to 20x28.
        this.sprite.setSize(8, 5);
        this.sprite.setOffset(6, 23);

        this.shadow = scene.add.ellipse(
            x,
            y + this.shadowOffset(),
            34,
            9,
            0x020617,
            0.55,
        );

        this.cursors = scene.input.keyboard.createCursorKeys();
        this.keys = {
            up: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            down: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            left: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            right: scene.input.keyboard.addKey(
                Phaser.Input.Keyboard.KeyCodes.D,
            ),
        };
        scene.input.keyboard.addCapture([
            Phaser.Input.Keyboard.KeyCodes.UP,
            Phaser.Input.Keyboard.KeyCodes.DOWN,
            Phaser.Input.Keyboard.KeyCodes.LEFT,
            Phaser.Input.Keyboard.KeyCodes.RIGHT,
            Phaser.Input.Keyboard.KeyCodes.SPACE,
        ]);
        this.sprite.anims.play(this.animationKey("idle"));
    }

    update(): void {
        const left = this.cursors.left.isDown || this.keys.left.isDown;
        const right = this.cursors.right.isDown || this.keys.right.isDown;
        const up = this.cursors.up.isDown || this.keys.up.isDown;
        const down = this.cursors.down.isDown || this.keys.down.isDown;
        const dx = Number(right) - Number(left);
        const dy = Number(down) - Number(up);
        const moving = dx !== 0 || dy !== 0;

        this.movement.set(dx, dy);
        if (moving) {
            this.updateFacing(dx, dy);
            this.movement.normalize().scale(SPEED);
        }
        this.sprite.setVelocity(this.movement.x, this.movement.y);
        this.playState(moving ? "walk" : "idle");
        this.shadow.setPosition(
            this.sprite.x,
            this.sprite.y + this.shadowOffset(),
        );
        this.shadow.setDepth(this.sprite.y);
        this.sprite.setDepth(this.sprite.y + 1);
        this.shadow.setAlpha(moving ? 0.38 : 0.55);
    }

    destroy(): void {
        this.shadow.destroy();
        this.sprite.destroy();
    }

    private updateFacing(dx: number, dy: number): void {
        const next = Player.directionFromInput(dx, dy);
        const now = this.sprite.scene.time.now;
        if (dx !== 0 && dy !== 0) {
            this.lastDiagonalAt = now;
            this.facing = next;
            return;
        }
        const stillInDiagonal =
            this.facing.includes("-") &&
            this.facing.includes(next) &&
            now - this.lastDiagonalAt < FACING_GRACE_MS;
        if (!stillInDiagonal) this.facing = next;
    }

    private playState(state: Motion): void {
        const anims = this.sprite.anims;
        const key = this.animationKey(state);
        if (anims.isPlaying && anims.currentAnim?.key === key) return;
        let startFrame = 0;
        if (state === this.state && anims.currentFrame) {
            const pose = Number(anims.currentFrame.textureFrame) % POSES.length;
            const sequence = state === "walk" ? WALK_SEQUENCE : IDLE_SEQUENCE;
            startFrame = Math.max(0, sequence.indexOf(pose));
        }
        anims.play({ key, startFrame });
        this.state = state;
    }

    private animationKey(state: Motion): string {
        return `${PREFIX}-${state}-${this.facing}`;
    }

    private shadowOffset(): number {
        return this.sprite.displayHeight / 2 - 5;
    }

    private static directionFromInput(dx: number, dy: number): Direction {
        if (dy > 0)
            return dx < 0 ? "down-left" : dx > 0 ? "down-right" : "down";
        if (dy < 0) return dx < 0 ? "up-left" : dx > 0 ? "up-right" : "up";
        return dx < 0 ? "left" : "right";
    }

    private static createAssets(scene: Phaser.Scene): void {
        const frameCount = DIRECTIONS.length * POSES.length;
        if (!scene.textures.exists(PLAYER_TEXTURE)) {
            const g = scene.make.graphics({}, false);
            DIRECTIONS.forEach((direction, d) => {
                POSES.forEach((pose, p) =>
                    drawFrame(g, frameNumber(d, p), direction, pose),
                );
            });
            g.generateTexture(PLAYER_TEXTURE, FRAME_W * frameCount, FRAME_H);
            g.destroy();

            const texture = scene.textures.get(PLAYER_TEXTURE);
            texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
            for (let i = 0; i < frameCount; i++) {
                texture.add(i, 0, i * FRAME_W, 0, FRAME_W, FRAME_H);
            }
        }
        DIRECTIONS.forEach((direction, directionIndex) => {
            const frames = (sequence: number[]) =>
                sequence.map((poseIndex) => ({
                    key: PLAYER_TEXTURE,
                    frame: frameNumber(directionIndex, poseIndex),
                }));
            const idleKey = `${PREFIX}-idle-${direction}`;
            if (!scene.anims.exists(idleKey)) {
                scene.anims.create({
                    key: idleKey,
                    frames: frames(IDLE_SEQUENCE),
                    frameRate: 2,
                    repeat: -1,
                });
            }
            const walkKey = `${PREFIX}-walk-${direction}`;
            if (!scene.anims.exists(walkKey)) {
                scene.anims.create({
                    key: walkKey,
                    frames: frames(WALK_SEQUENCE),
                    frameRate: 9,
                    repeat: -1,
                });
            }
        });
    }
}

