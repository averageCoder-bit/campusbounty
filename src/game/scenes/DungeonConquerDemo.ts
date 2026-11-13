import * as Phaser from "phaser";
import { Player } from "../entities/Player";
import {
    DungeonCombatSystem,
    type ActiveStrike,
} from "../systems/DungeonCombatSystem";
import { DungeonAttackDirector } from "../systems/DungeonEnemyAI";
import { DungeonActorAnimator } from "../animations/DungeonSpriteAnimations";
import {
    NullCitadelEnemy,
    type CitadelEnemyKind,
    type EnemyAttackRequest,
} from "../entities/NullCitadelEnemy";
import { NullWisp } from "../entities/NullWisp";
import { HollowSentinel } from "../entities/HollowSentinel";
import { VoidCaster } from "../entities/VoidCaster";
import { CoreGuardian } from "../entities/CoreGuardian";
import { MouseLeadCamera } from "../systems/MouseLeadCamera";
import {
    makeDungeonTrials,
    type DungeonTrial,
    type TrialStage,
} from "../data/DungeonConquerCases";
import {
    buildDungeonConquerMap,
    type DungeonTorch,
} from "../world/DungeonConquerMap";
import {
    DUNGEON,
    floorAt,
    roomAt,
    type DungeonLayout,
    type DungeonRoom,
} from "../world/DungeonLayout";

const PIXEL = '"Press Start 2P", monospace';
const BODY = '"Trebuchet MS", Arial, sans-serif';
const W = 1024,
    H = 768,
    ZOOM = 1.42;
const MAX_HP = 12,
    MAX_STAMINA = 100;
type Phase = "explore" | "modal" | "result";
type EnemyKind = CitadelEnemyKind;
type Enemy = NullCitadelEnemy;
type Weapon = "blade" | "spear" | "crossbow";

interface Missile {
    node: Phaser.GameObjects.Arc;
    x: number;
    y: number;
    vx: number;
    vy: number;
    ttl: number;
    friendly: boolean;
    damage: number;
}
interface Nav {
    tile: number;
    cols: number;
    rows: number;
    open: Uint8Array;
    distance: Int32Array;
    queue: Int32Array;
    nextRebuild: number;
}

/**
 * SHORT PRESENTATION CUT OF THE ACTUAL NULL CITADEL.
 * Preserves the original combat, procedural world, shaders/sprites/animation,
 * mouse aiming, dodge and security-seal question. No XP or badge issuing.
 * Original DungeonConquer.ts is NOT modified.
 */
export class DungeonConquerDemo extends Phaser.Scene {
    private readonly combat = new DungeonCombatSystem();
    private readonly attackDirector = new DungeonAttackDirector(2);
    private player?: Player;
    private hero?: DungeonActorAnimator;
    private lead?: MouseLeadCamera;
    private layout!: DungeonLayout;
    private obstacles: Phaser.Geom.Rectangle[] = [];
    private torches: DungeonTorch[] = [];
    private nav!: Nav;
    private foes: Enemy[] = [];
    private missiles: Missile[] = [];
    private roomSpawned = new Set<number>();
    private usedShrines = new Set<number>();
    private visitedRooms = new Set<number>();
    private solvedSeals = 0;
    private kills = 0;
    private seed = 1;
    private trials!: Record<TrialStage, DungeonTrial>;
    private phase: Phase = "explore";
    private overlay?: Phaser.GameObjects.Container;
    private uiCamera?: Phaser.Cameras.Scene2D.Camera;
    private uiRoot?: Phaser.GameObjects.Container;
    private activeStage?: TrialStage;
    private feedback?: Phaser.GameObjects.Text;
    private interactKey?: Phaser.Input.Keyboard.Key;
    private dodgeKey?: Phaser.Input.Keyboard.Key;
    private sprintKey?: Phaser.Input.Keyboard.Key;
    private statusText?: Phaser.GameObjects.Text;
    private roomText?: Phaser.GameObjects.Text;
    private timerText?: Phaser.GameObjects.Text;
    private messageText?: Phaser.GameObjects.Text;
    private healthFill?: Phaser.GameObjects.Rectangle;
    private healthValue?: Phaser.GameObjects.Text;
    private staminaFill?: Phaser.GameObjects.Rectangle;
    private staminaValue?: Phaser.GameObjects.Text;
    private bossFill?: Phaser.GameObjects.Rectangle;
    private bossLabel?: Phaser.GameObjects.Text;
    private bossBack?: Phaser.GameObjects.Rectangle;
    private slotBoxes: Phaser.GameObjects.Rectangle[] = [];
    private itemCounter?: Phaser.GameObjects.Text;
    private worldPrompt?: Phaser.GameObjects.Container;
    private promptLabel?: Phaser.GameObjects.Text;
    private hp = MAX_HP;
    private stamina = MAX_STAMINA;
    private potions = 2;
    private secondsLeft = 90;
    private invulnerableUntil = 0;
    private dashUntil = 0;
    private dashReadyAt = 0;
    private selected: Weapon = "blade";
    private lastAim = 0;
    private lastHud = -1;
    private lastTorch = -1;
    private safeX = 0;
    private safeY = 0;
    private activeRoom = -1;
    private afterModalGrace = 0;
    private bossArrived = false;
    private bossTarget?: Enemy;
    private firstHints = new Set<string>();
    private wrong = new Set<string>();
    /** Presentation-only: exactly two successful hits defeat the Core Guardian. */
    private demoBossHits = 0;

    private readonly pointerDown = (pointer: Phaser.Input.Pointer): void => {
        if (this.phase !== "explore" || !this.player || pointer.button !== 0)
            return;
        if (pointer.y < 90 || pointer.y >= 676) return;
        const p = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        this.attack(p.x, p.y, this.time.now);
    };
    private readonly keyboardDown = (event: KeyboardEvent): void => {
        if (event.repeat) return;
        if (event.code === "Escape") {
            event.preventDefault();
            if (this.phase === "result") this.scene.start("Game");
            else if (this.phase === "explore") this.showPause();
            else this.closeModal();
            return;
        }
        if (this.phase === "explore") {
            if (event.code === "KeyM") {
                event.preventDefault();
                this.showDungeonMap();
                return;
            }
            if (event.code === "Digit1" || event.code === "Numpad1")
                this.selectWeapon("blade");
            else if (event.code === "Digit2" || event.code === "Numpad2")
                this.selectWeapon("spear");
            else if (event.code === "Digit3" || event.code === "Numpad3")
                this.selectWeapon("crossbow");
            else if (event.code === "Digit4" || event.code === "Numpad4")
                this.usePotion();
            return;
        }
        if (this.phase !== "modal" || this.activeStage === undefined) return;
        const i = (
            {
                Digit1: 0,
                Digit2: 1,
                Digit3: 2,
                Numpad1: 0,
                Numpad2: 1,
                Numpad3: 2,
            } as Record<string, number>
        )[event.code];
        if (i !== undefined) {
            event.preventDefault();
            this.answerSeal(i);
        }
    };

    constructor() {
        super("DungeonConquerDemo");
    }

    init(data?: { seed?: number }): void {
        const n = data?.seed;
        this.seed =
            typeof n === "number" && Number.isInteger(n) && n > 0
                ? n >>> 0
                : Phaser.Math.Between(1, 0x7fffffff);
    }

    create(): void {
        this.phase = "explore";
        this.solvedSeals = 0;
        this.kills = 0;
        this.demoBossHits = 0;
        this.hp = MAX_HP;
        this.stamina = MAX_STAMINA;
        this.potions = 2;
        this.secondsLeft = 90; // Demo clock; original remains 32 minutes.
        this.invulnerableUntil = 0;
        this.dashUntil = 0;
        this.dashReadyAt = 0;
        this.lastHud = -1;
        this.lastTorch = -1;
        this.combat.reset();
        this.attackDirector.clear();
        this.selected = "blade";
        this.activeRoom = -1;
        this.afterModalGrace = 0;
        this.bossArrived = false;
        this.bossTarget = undefined;
        this.foes = [];
        this.missiles = [];
        this.slotBoxes = [];
        this.roomSpawned.clear();
        this.usedShrines.clear();
        this.visitedRooms.clear();
        this.firstHints.clear();
        this.wrong.clear();
        this.overlay = undefined;
        this.uiRoot = undefined;
        this.uiCamera = undefined;
        this.trials = makeDungeonTrials(this.seed);
        const world = buildDungeonConquerMap(this, this.seed);
        this.layout = world.layout;
        this.obstacles = world.obstacles;
        this.torches = world.torches;
        this.buildNavigation();
        // Spawn in the ACTUAL procedurally generated boss chamber.
        // No long walk through 42 rooms is needed for the live pitch.
        const quickStart = this.findDemoSpawn();
        this.safeX = quickStart.x;
        this.safeY = quickStart.y;
        this.player = new Player(this, this.safeX, this.safeY);
        // The Player retains its existing input, collision body, 8-way direction and shadow.
        // Hide only the physics sprite; render the EXACT Player.ts artwork inside
        // dungeon combat frames (not a second, wider procedural student).
        this.player.sprite.setVisible(false);
        this.hero = new DungeonActorAnimator(
            this,
            "hero",
            this.safeX,
            this.safeY,
            this.player.sprite,
        );
        this.physics.add.collider(this.player.sprite, world.blockers);
        this.cameras.main
            .setZoom(ZOOM)
            .setBounds(0, 0, DUNGEON.width, DUNGEON.height);
        this.cameras.main.fadeIn(350, 2, 4, 13);
        this.lead = new MouseLeadCamera(
            this,
            this.player.sprite,
            DUNGEON.width,
            DUNGEON.height,
            {
                zoom: ZOOM,
                maxLeadX: 160,
                maxLeadY: 110,
                smoothingMs: 170,
                followLerp: 0.135,
            },
        );
        this.makePrompt();
        const objects = [...this.children.list];
        this.uiCamera = this.cameras.add(
            0,
            0,
            W,
            H,
            false,
            "Dungeon-Reforged-HUD",
        );
        this.uiCamera.setZoom(1).setScroll(0, 0).ignore(objects);
        // Hero visual was created before the HUD camera; ignore it explicitly as well.
        this.uiCamera.ignore(this.hero.sprite);
        this.uiRoot = this.add
            .container(0, 0)
            .setScrollFactor(0)
            .setDepth(50000);
        this.cameras.main.ignore(this.uiRoot);
        this.buildHUD();
        // Real entity classes and combat animations, with demo-only tuning.
        this.bossArrived = true;
        this.spawnBoss(this.time.now);
        this.spawnDemoGuard(this.time.now);
        this.roomText?.setText("FINAL SANCTUM  /  PRESENTATION DEMO");
        this.refreshHUD();
        this.message(
            "DEMO: DEFEAT THE WISP, THEN THE CORE GUARDIAN. CLICK TO ATTACK.",
        );
        this.interactKey = this.input.keyboard?.addKey(
            Phaser.Input.Keyboard.KeyCodes.E,
        );
        this.dodgeKey = this.input.keyboard?.addKey(
            Phaser.Input.Keyboard.KeyCodes.SPACE,
        );
        this.sprintKey = this.input.keyboard?.addKey(
            Phaser.Input.Keyboard.KeyCodes.SHIFT,
        );
        this.input.on("pointerdown", this.pointerDown);
        this.input.keyboard?.on("keydown", this.keyboardDown);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.input.off("pointerdown", this.pointerDown);
            this.input.keyboard?.off("keydown", this.keyboardDown);
            this.lead?.destroy();
            this.lead = undefined;
            this.hero?.destroy();
            this.hero = undefined;
            this.player?.destroy();
            this.player = undefined;
            this.interactKey = undefined;
            this.dodgeKey = undefined;
            this.sprintKey = undefined;
            if (this.uiCamera && this.cameras.cameras.includes(this.uiCamera))
                this.cameras.remove(this.uiCamera);
            this.uiCamera = undefined;
            this.uiRoot = undefined;
            this.missiles.length = 0;
            this.foes.length = 0;
            this.combat.reset();
            this.attackDirector.clear();
        });
    }

    update(time: number, delta: number): void {
        if (this.phase !== "explore" || !this.player) return;
        const dt = Phaser.Math.Clamp(delta, 0, 65) / 1000;
        const sprite = this.player.sprite;
        this.player.update();
        this.lead?.update(delta);
        this.updateMovement(time, dt);
        const x = sprite.x,
            y = sprite.y;
        this.secondsLeft = Math.max(0, this.secondsLeft - dt);
        if (this.secondsLeft <= 0) {
            this.endRun(false, "THE DUNGEON CLOCK RAN OUT");
            return;
        }
        const room = roomAt(this.layout, x, y);
        if (room && room.id !== this.activeRoom) {
            this.visitedRooms.add(room.id);
            this.activeRoom = room.id;
            this.roomText?.setText(
                `${String(room.id + 1).padStart(2, "0")}  ${room.title}`,
            );
            this.enterRoom(room, time);
        }
        if (time >= this.nav.nextRebuild) this.rebuildFlow(x, y, time);
        const strike = this.combat.tick(time);
        // Damage occurs on the attack's active frame, not on mouse down.
        if (strike.activated) this.resolveStrike(strike.activated, time);
        if (strike.started) this.beginStrikeAnimation(strike.started, time);
        this.updateEnemies(time, dt, x, y);
        if (this.phase !== "explore") return;
        this.updateMissiles(time, dt, x, y);
        if (this.phase !== "explore") return;
        this.updatePrompts(x, y);
        if (time - this.lastTorch >= 135) this.animateTorches(time);
        if (Math.ceil(this.secondsLeft) !== this.lastHud) {
            this.lastHud = Math.ceil(this.secondsLeft);
            this.refreshHUD();
        }
    }

    // ---- Traversal and shared flow-field pathfinding ----
    private canStand(x: number, y: number, pad = 16): boolean {
        return (
            floorAt(this.layout, x, y, 7) &&
            !this.obstacles.some(
                (r) =>
                    x > r.x - pad &&
                    x < r.right + pad &&
                    y > r.y - pad &&
                    y < r.bottom + pad,
            )
        );
    }
    private buildNavigation(): void {
        const tile = 50,
            cols = Math.ceil(DUNGEON.width / tile),
            rows = Math.ceil(DUNGEON.height / tile);
        const open = new Uint8Array(cols * rows);
        for (let y = 0; y < rows; y++)
            for (let x = 0; x < cols; x++)
                open[y * cols + x] = Number(
                    this.canStand((x + 0.5) * tile, (y + 0.5) * tile, 22),
                );
        this.nav = {
            tile,
            cols,
            rows,
            open,
            distance: new Int32Array(open.length).fill(-1),
            queue: new Int32Array(open.length),
            nextRebuild: 0,
        };
    }
    private cellFor(x: number, y: number): number {
        const { tile, cols, rows } = this.nav;
        const col = Phaser.Math.Clamp(Math.floor(x / tile), 0, cols - 1);
        const row = Phaser.Math.Clamp(Math.floor(y / tile), 0, rows - 1);
        return row * cols + col;
    }
    private rebuildFlow(px: number, py: number, time: number): void {
        const nav = this.nav;
        nav.nextRebuild = time + 410;
        nav.distance.fill(-1);
        let source = this.cellFor(px, py);
        if (!nav.open[source]) {
            // Find a nearby walkable cell when the player's feet are between cells.
            const c = source % nav.cols,
                r = Math.floor(source / nav.cols);
            outer: for (let radius = 1; radius <= 4; radius++) {
                for (let dy = -radius; dy <= radius; dy++)
                    for (let dx = -radius; dx <= radius; dx++) {
                        const x = c + dx,
                            y = r + dy;
                        if (
                            x >= 0 &&
                            x < nav.cols &&
                            y >= 0 &&
                            y < nav.rows &&
                            nav.open[y * nav.cols + x]
                        ) {
                            source = y * nav.cols + x;
                            break outer;
                        }
                    }
            }
        }
        if (!nav.open[source]) return;
        let head = 0,
            tail = 1;
        nav.queue[0] = source;
        nav.distance[source] = 0;
        while (head < tail) {
            const at = nav.queue[head++];
            const x = at % nav.cols,
                y = Math.floor(at / nav.cols);
            const candidates = [
                x > 0 ? at - 1 : -1,
                x < nav.cols - 1 ? at + 1 : -1,
                y > 0 ? at - nav.cols : -1,
                y < nav.rows - 1 ? at + nav.cols : -1,
            ];
            for (const next of candidates)
                if (next >= 0 && nav.open[next] && nav.distance[next] < 0) {
                    nav.distance[next] = nav.distance[at] + 1;
                    nav.queue[tail++] = next;
                }
        }
    }
    private flowDirection(
        x: number,
        y: number,
        px: number,
        py: number,
    ): Phaser.Math.Vector2 {
        if (Math.hypot(px - x, py - y) < 165 && this.clearSight(x, y, px, py))
            return new Phaser.Math.Vector2(px - x, py - y).normalize();
        const nav = this.nav;
        const at = this.cellFor(x, y);
        const c = at % nav.cols,
            r = Math.floor(at / nav.cols);
        let best = -1,
            bestDist = Number.POSITIVE_INFINITY;
        const options = [
            c > 0 ? at - 1 : -1,
            c < nav.cols - 1 ? at + 1 : -1,
            r > 0 ? at - nav.cols : -1,
            r < nav.rows - 1 ? at + nav.cols : -1,
        ];
        for (const i of options)
            if (
                i >= 0 &&
                nav.open[i] &&
                nav.distance[i] >= 0 &&
                nav.distance[i] < bestDist
            ) {
                best = i;
                bestDist = nav.distance[i];
            }
        if (best < 0) return new Phaser.Math.Vector2(0, 0);
        const targetX = ((best % nav.cols) + 0.5) * nav.tile;
        const targetY = (Math.floor(best / nav.cols) + 0.5) * nav.tile;
        return new Phaser.Math.Vector2(targetX - x, targetY - y).normalize();
    }
    private moveEnemy(e: Enemy, vx: number, vy: number, dt: number): void {
        const x = e.node.x,
            y = e.node.y;
        const nx = x + vx * dt,
            ny = y + vy * dt;
        const pad = Math.min(24, e.radius * 0.5);
        if (this.canStand(nx, ny, pad)) e.node.setPosition(nx, ny);
        else if (this.canStand(nx, y, pad)) e.node.x = nx;
        else if (this.canStand(x, ny, pad)) e.node.y = ny;
        else {
            // Stuck recovery: choose a side-step around the nearest obstruction.
            const brain = e.tactics;
            brain.blockedFor += dt;
            const sign = Math.floor(brain.blockedFor * 2) % 2 ? 1 : -1;
            for (const [dx, dy] of [
                [-vy * sign, vx * sign],
                [vy * sign, -vx * sign],
            ]) {
                if (this.canStand(x + dx * dt, y + dy * dt, pad)) {
                    e.node.setPosition(x + dx * dt, y + dy * dt);
                    break;
                }
            }
        }
        const actualVx = (e.node.x - x) / Math.max(dt, 0.001);
        const actualVy = (e.node.y - y) / Math.max(dt, 0.001);
        if (Math.hypot(actualVx, actualVy) > 4) e.tactics.blockedFor = 0;
        e.tactics.previousX = e.node.x;
        e.tactics.previousY = e.node.y;
        e.visual.sync(0, -6, actualVx, actualVy, this.time.now);
    }
    private updateMovement(time: number, dt: number): void {
        if (!this.player) return;
        const sprite = this.player.sprite;
        const body = sprite.body as Phaser.Physics.Arcade.Body | null;
        const moving = Boolean(body && body.velocity.length() > 0);
        const sprinting = Boolean(
            this.sprintKey?.isDown &&
            moving &&
            this.stamina > 3 &&
            time >= this.dashUntil &&
            !this.combat.busy,
        );
        if (sprinting && body) {
            sprite.setVelocity(body.velocity.x * 1.48, body.velocity.y * 1.48);
            this.stamina = Math.max(0, this.stamina - 27 * dt);
        } else this.stamina = Math.min(MAX_STAMINA, this.stamina + 20 * dt);
        if (
            this.dodgeKey &&
            Phaser.Input.Keyboard.JustDown(this.dodgeKey) &&
            time >= this.dashReadyAt
        ) {
            if (this.stamina >= 28) {
                this.stamina -= 28;
                this.combat.interrupt();
                this.dashUntil = time + 235;
                this.dashReadyAt = time + 1350;
                this.invulnerableUntil = Math.max(
                    this.invulnerableUntil,
                    time + 285,
                );
                const movement =
                    sprite.body as Phaser.Physics.Arcade.Body | null;
                this.hero?.dodge(
                    time,
                    movement?.velocity.x ?? Math.cos(this.lastAim),
                    movement?.velocity.y ?? Math.sin(this.lastAim),
                );
                this.addAfterimage(sprite.x, sprite.y);
            } else this.message("NOT ENOUGH STAMINA TO DODGE", "#FCA5A5");
        }
        if (time < this.dashUntil && body) {
            if (moving)
                sprite.setVelocity(
                    body.velocity.x * 2.5,
                    body.velocity.y * 2.5,
                );
            else
                sprite.setVelocity(
                    Math.cos(this.lastAim) * 365,
                    Math.sin(this.lastAim) * 365,
                );
            if (Math.floor(time / 65) !== Math.floor((time - dt * 1000) / 65))
                this.addAfterimage(sprite.x, sprite.y);
        }
        // Keep player on the procedural floor; prevent edge-tunneling across blank space.
        if (!this.canStand(sprite.x, sprite.y, 9)) {
            if (this.canStand(sprite.x, this.safeY, 9)) {
                sprite.y = this.safeY;
                sprite.setVelocityY(0);
            } else if (this.canStand(this.safeX, sprite.y, 9)) {
                sprite.x = this.safeX;
                sprite.setVelocityX(0);
            } else {
                sprite.setPosition(this.safeX, this.safeY);
                sprite.setVelocity(0, 0);
            }
        }
        if (this.canStand(sprite.x, sprite.y, 9)) {
            this.safeX = sprite.x;
            this.safeY = sprite.y;
        }
        const visualVelocity = sprite.body as Phaser.Physics.Arcade.Body | null;
        this.hero?.sync(
            sprite.x,
            sprite.y,
            visualVelocity?.velocity.x ?? 0,
            visualVelocity?.velocity.y ?? 0,
            time,
            sprinting || time < this.dashUntil,
        );
        this.hero?.sprite.setDepth(sprite.y + 18);
        this.staminaFill?.setScale(this.stamina / MAX_STAMINA, 1);
        this.staminaValue?.setText(`${Math.floor(this.stamina)}`);
        this.hero?.sprite.setAlpha(
            time < this.invulnerableUntil && Math.floor(time / 105) % 2
                ? 0.48
                : 1,
        );
    }
    private addAfterimage(x: number, y: number): void {
        const ghost = this.add
            .ellipse(x, y, 40, 57, 0x7dd3fc, 0.15)
            .setDepth(y - 1);
        this.uiCamera?.ignore(ghost);
        this.tweens.add({
            targets: ghost,
            alpha: 0,
            scaleX: 0.35,
            scaleY: 0.35,
            duration: 240,
            onComplete: () => ghost.destroy(),
        });
    }

    // ---- Authentic world + abbreviated boss chamber encounter ----
    private enterRoom(room: DungeonRoom, time: number): void {
        // A boss-room-only run; never populate the full dungeon or open extra seals.
        if (room.role === "boss" && !this.bossArrived) {
            this.bossArrived = true;
            this.spawnBoss(time);
        }
    }

    /** Find a walkable point within blade reach of the real Core Guardian. */
    private findDemoSpawn(): { x: number; y: number } {
        const boss = this.layout.bossPoint;
        const offsets: readonly [number, number][] = [
            [-115, 0],
            [115, 0],
            [0, 115],
            [0, -115],
            [-96, 55],
            [96, -55],
            [-70, -90],
            [70, 90],
            [-155, 0],
            [155, 0],
            [0, -155],
            [0, 155],
        ];
        for (const [dx, dy] of offsets) {
            const x = boss.x + dx,
                y = boss.y + dy;
            if (this.canStand(x, y, 20)) return { x, y };
        }
        const room = this.layout.rooms[this.layout.boss];
        if (this.canStand(room.cx, room.cy, 12))
            return { x: room.cx, y: room.cy };
        return { x: this.layout.spawn.x, y: this.layout.spawn.y };
    }

    private spawnDemoGuard(time: number): void {
        const x = this.safeX,
            y = this.safeY;
        const bx = this.layout.bossPoint.x,
            by = this.layout.bossPoint.y;
        // Bias toward the player, but keep boss and wisp in the same real room.
        const towardBoss = new Phaser.Math.Vector2(bx - x, by - y);
        if (towardBoss.lengthSq() < 1) towardBoss.set(1, 0);
        towardBoss.normalize();
        const candidates: readonly [number, number][] = [
            [x + towardBoss.x * 58, y + towardBoss.y * 58],
            [x - towardBoss.y * 55, y + towardBoss.x * 55],
            [x + towardBoss.y * 55, y - towardBoss.x * 55],
            [x, y],
        ];
        const position = candidates.find(([px, py]) =>
            this.canStand(px, py, 8),
        );
        if (!position) return;
        this.spawnEnemy(
            "slime",
            this.layout.boss,
            position[0],
            position[1],
            time,
        );
    }

    private spawnEnemy(
        kind: EnemyKind,
        room: number,
        x: number,
        y: number,
        time: number,
    ): Enemy {
        // Each enemy owns its sprite, health, brain, and attack repertoire.
        // Scene owns world collision, shared flow-field, and player damage.
        const stagger = (room * 71 + this.kills * 29) % 300;
        const foe: Enemy =
            kind === "slime"
                ? new NullWisp(this, room, x, y, time, stagger)
                : kind === "knight"
                  ? new HollowSentinel(this, room, x, y, time, stagger)
                  : kind === "archer"
                    ? new VoidCaster(this, room, x, y, time, stagger)
                    : new CoreGuardian(this, room, x, y, time);
        this.uiCamera?.ignore(foe.node);
        this.foes.push(foe);
        return foe;
    }
    private spawnBoss(time: number): void {
        const p = this.layout.bossPoint;
        this.bossTarget = this.spawnEnemy(
            "guardian",
            this.layout.boss,
            p.x,
            p.y,
            time,
        );
        this.message(
            "THE NULL CORE GUARDIAN AWAKENS! Dodge the red telegraphs.",
            "#FCA5A5",
        );
        this.refreshHUD();
    }
    private clearSight(
        x1: number,
        y1: number,
        x2: number,
        y2: number,
    ): boolean {
        const length = Math.hypot(x2 - x1, y2 - y1);
        const steps = Math.ceil(length / 31);
        for (let i = 1; i < steps; i++) {
            const x = x1 + ((x2 - x1) * i) / steps,
                y = y1 + ((y2 - y1) * i) / steps;
            if (!this.canStand(x, y, 5)) return false;
        }
        return true;
    }
    /**
     * G4.5: the scene resolves combat hits and provides navigation, while
     * each dedicated enemy entity computes its own tactical intention.
     */
    private updateEnemies(
        time: number,
        dt: number,
        px: number,
        py: number,
    ): void {
        this.attackDirector.refresh(time);
        for (let index = 0; index < this.foes.length; index++) {
            const e = this.foes[index];
            if (!e.alive) continue;
            e.frame(time);
            let x = e.node.x,
                y = e.node.y;
            let distance = Math.hypot(px - x, py - y);
            if (distance > 1100) continue;

            // Telegraphs are sampled at wind-up, not re-aimed every frame.
            if (e.cue && time >= e.cue.firesAt) {
                const cue = e.cue;
                e.cue = undefined;
                cue.graphic.destroy();
                this.attackDirector.release(index);
                e.tactics.behavior = "recover";
                e.tactics.recoverUntil =
                    time + (e.kind === "guardian" ? 850 : 580);
                if (cue.kind === "contact") {
                    const telegraphDir = Math.atan2(cue.ty - y, cue.tx - x);
                    const liveDir = Math.atan2(py - y, px - x);
                    const difference = Math.atan2(
                        Math.sin(liveDir - telegraphDir),
                        Math.cos(liveDir - telegraphDir),
                    );
                    if (
                        distance < (e.kind === "knight" ? 106 : 88) &&
                        Math.abs(difference) < 1.05
                    )
                        this.takeDamage(
                            time,
                            e.kind === "knight" ? 2 : 1,
                            e.kind === "knight"
                                ? "SENTINEL CRUSH"
                                : "NULL WISP LUNGE",
                        );
                } else if (cue.kind === "shot") {
                    const angle = Math.atan2(cue.ty - y, cue.tx - x);
                    if (this.clearSight(x, y, cue.tx, cue.ty))
                        this.fire(
                            x + Math.cos(angle) * 34,
                            y + Math.sin(angle) * 34,
                            angle,
                            248,
                            false,
                            1,
                            2200,
                        );
                } else if (cue.kind === "slam") {
                    if (distance < 210)
                        this.takeDamage(time, 2, "NULL CORE SHOCKWAVE");
                    this.cameras.main.shake(120, 0.0025);
                } else if (cue.kind === "volley") {
                    const angle = Math.atan2(cue.ty - y, cue.tx - x);
                    const phase = e instanceof CoreGuardian ? e.phase : 1;
                    for (let i = -2; i <= 2; i++)
                        this.fire(
                            x,
                            y,
                            angle + i * (phase === 3 ? 0.23 : 0.17),
                            phase === 3 ? 294 : 255,
                            false,
                            1,
                            2450,
                        );
                } else if (cue.kind === "charge") {
                    const dx = cue.tx - x,
                        dy = cue.ty - y;
                    const length = Math.max(1, Math.hypot(dx, dy));
                    for (let step = 1; step <= 14; step++) {
                        const nx =
                            x +
                            ((dx / length) * Math.min(length, 385) * step) / 14;
                        const ny =
                            y +
                            ((dy / length) * Math.min(length, 385) * step) / 14;
                        if (!this.canStand(nx, ny, 36)) break;
                        e.node.setPosition(nx, ny);
                    }
                    const segX = e.node.x - x,
                        segY = e.node.y - y;
                    const u = Phaser.Math.Clamp(
                        ((px - x) * segX + (py - y) * segY) /
                            Math.max(1, segX * segX + segY * segY),
                        0,
                        1,
                    );
                    if (
                        Math.hypot(px - (x + u * segX), py - (y + u * segY)) <
                        72
                    )
                        this.takeDamage(time, 2, "NULL CORE CHARGE");
                }
                e.visual.attack(time, Math.atan2(cue.ty - y, cue.tx - x));
                if (this.phase !== "explore") return;
                x = e.node.x;
                y = e.node.y;
                distance = Math.hypot(px - x, py - y);
            }

            const clearSight = distance < 830 && this.clearSight(x, y, px, py);
            const plan = e.plan({
                now: time,
                dt,
                index,
                playerX: px,
                playerY: py,
                distance,
                clearSight,
                path: (tx, ty) =>
                    this.flowDirection(e.node.x, e.node.y, tx, ty),
                canStand: (tx, ty, pad) => this.canStand(tx, ty, pad),
                separation: () => this.enemySeparation(e),
                tryAttack: (durationMs) =>
                    this.attackDirector.tryAcquire(
                        index,
                        time + durationMs,
                        time,
                    ),
            });
            if (plan.attack) {
                this.showEnemyTelegraph(e, plan.attack, time);
            } else if (Math.hypot(plan.vx, plan.vy) > 0.1) {
                this.moveEnemy(e, plan.vx, plan.vy, dt);
            } else {
                e.visual.sync(0, -6, 0, 0, time);
            }
        }
    }

    /** Create readable attack previews for the entity-selected move. */
    private showEnemyTelegraph(
        e: Enemy,
        attack: EnemyAttackRequest,
        time: number,
    ): void {
        const x = e.node.x,
            y = e.node.y;
        let graphic: Phaser.GameObjects.GameObject;
        if (attack.kind === "shot") {
            const art = this.add.graphics().setDepth(y - 2);
            art.lineStyle(4, 0xdba2ef, 0.71).lineBetween(
                x,
                y,
                attack.tx,
                attack.ty,
            );
            art.lineStyle(1, 0xffd3f3, 0.72).lineBetween(
                x,
                y,
                attack.tx,
                attack.ty,
            );
            graphic = art;
        } else if (attack.kind === "charge") {
            const art = this.add.graphics().setDepth(y - 2);
            art.lineStyle(38, 0xd04e82, 0.23).lineBetween(
                x,
                y,
                attack.tx,
                attack.ty,
            );
            art.lineStyle(4, 0xff9cbf, 0.87).lineBetween(
                x,
                y,
                attack.tx,
                attack.ty,
            );
            graphic = art;
        } else {
            const radius =
                attack.kind === "slam"
                    ? 210
                    : attack.kind === "volley"
                      ? 110
                      : e.kind === "knight"
                        ? 103
                        : 84;
            const color = attack.kind === "contact" ? 0xdc829c : 0xdd5a88;
            graphic = this.add
                .circle(
                    x,
                    y,
                    radius,
                    color,
                    attack.kind === "slam" ? 0.1 : 0.05,
                )
                .setStrokeStyle(3, color, 0.78)
                .setDepth(y - 2);
        }
        this.uiCamera?.ignore(graphic);
        e.cue = {
            kind: attack.kind,
            firesAt: time + attack.windupMs,
            graphic,
            tx: attack.tx,
            ty: attack.ty,
        };
        e.visual.telegraph(
            time,
            Math.atan2(attack.ty - y, attack.tx - x),
            attack.windupMs,
        );
        if (e instanceof CoreGuardian)
            this.bossLabel?.setText(`NULL CORE GUARDIAN / PHASE ${e.phase}`);
    }
    private enemySeparation(actor: Enemy): Phaser.Math.Vector2 {
        const push = new Phaser.Math.Vector2(0, 0);
        for (const other of this.foes) {
            if (!other.alive || other === actor || other.room !== actor.room)
                continue;
            const dx = actor.node.x - other.node.x,
                dy = actor.node.y - other.node.y;
            const distance = Math.hypot(dx, dy);
            if (distance > 1 && distance < 80)
                push.add(new Phaser.Math.Vector2(dx, dy).scale(1 / distance));
        }
        return push.lengthSq() > 0 ? push.normalize() : push;
    }
    private bossPhase(e: Enemy): 1 | 2 | 3 {
        return e instanceof CoreGuardian ? e.phase : 1;
    }

    // ---- Weapons and combat animation ----
    private selectWeapon(weapon: Weapon): void {
        this.selected = weapon;
        this.slotBoxes.forEach((r, i) =>
            r.setStrokeStyle(
                i === ["blade", "spear", "crossbow"].indexOf(weapon) ? 3 : 1,
                i === ["blade", "spear", "crossbow"].indexOf(weapon)
                    ? 0xfbbf24
                    : 0x536a84,
            ),
        );
        this.message(`${weapon.toUpperCase()} EQUIPPED`);
    }
    private attack(targetX: number, targetY: number, time: number): void {
        if (!this.player || time < this.dashUntil) return;
        const x = this.player.sprite.x,
            y = this.player.sprite.y;
        const angle = Math.atan2(targetY - y, targetX - x);
        this.lastAim = angle;
        const started = this.combat.request(this.selected, angle, time);
        if (started) this.beginStrikeAnimation(started, time);
    }
    private beginStrikeAnimation(strike: ActiveStrike, time: number): void {
        this.hero?.attack(
            time,
            strike.angle,
            strike.spec.weapon,
            strike.spec.combo,
        );
    }
    private resolveStrike(strike: ActiveStrike, time: number): void {
        if (!this.player || this.phase !== "explore") return;
        const { spec, angle } = strike;
        const x = this.player.sprite.x,
            y = this.player.sprite.y;
        this.playAttackEffect(x, y, angle, spec.weapon, spec.combo);
        if (spec.weapon === "crossbow") {
            // Spawn from the hand/muzzle only at the active fire frame.
            this.fire(
                x + Math.cos(angle) * 37,
                y + Math.sin(angle) * 37,
                angle,
                520,
                true,
                spec.damage,
                1480,
            );
            return;
        }
        let count = 0;
        for (const e of this.foes) {
            if (!e.alive || count >= spec.maxTargets) continue;
            const dx = e.node.x - x,
                dy = e.node.y - y;
            const d = Math.hypot(dx, dy);
            if (d > spec.range + e.radius * 0.43) continue;
            const bearing = Math.atan2(dy, dx);
            const difference = Math.atan2(
                Math.sin(bearing - angle),
                Math.cos(bearing - angle),
            );
            if (
                Math.abs(difference) > spec.arc ||
                !this.clearSight(x, y, e.node.x, e.node.y)
            )
                continue;
            this.hitEnemy(e, spec.damage, time);
            count++;
        }
    }
    /** An impact flash, not a second oversized weapon. The sprite sheet owns the weapon art. */
    private playAttackEffect(
        x: number,
        y: number,
        angle: number,
        weapon: Weapon,
        combo: 1 | 2 | 3,
    ): void {
        const fx = this.add.graphics().setDepth(y + 19);
        this.uiCamera?.ignore(fx);
        if (weapon === "blade") {
            fx.lineStyle(
                combo === 3 ? 7 : 4,
                combo === 3 ? 0xfbbf24 : 0x9bddff,
                0.7,
            );
            const reach = combo === 3 ? 148 : 116;
            const spread = combo === 3 ? 1.0 : 0.83;
            const begin = angle - spread,
                end = angle + spread;
            fx.beginPath();
            fx.arc(x, y - 8, reach, begin, end, false);
            fx.strokePath();
        } else if (weapon === "spear") {
            fx.lineStyle(5, 0xdbeafe, 0.62).lineBetween(
                x + Math.cos(angle) * 65,
                y + Math.sin(angle) * 65,
                x + Math.cos(angle) * 185,
                y + Math.sin(angle) * 185,
            );
        } else {
            fx.fillStyle(0xffe6ad, 0.8).fillCircle(
                x + Math.cos(angle) * 42,
                y + Math.sin(angle) * 42,
                9,
            );
        }
        this.tweens.add({
            targets: fx,
            alpha: 0,
            duration: 145,
            onComplete: () => fx.destroy(),
        });
    }
    private hitEnemy(e: Enemy, amount: number, time: number): void {
        if (!e.alive) return;
        const hero = this.player?.sprite;
        // The combat engine still requires genuine active-frame contact and aim.
        // The demo only relaxes shield/HP handling AFTER an actual strike lands.
        if (
            e.kind === "guardian" &&
            this.foes.some((foe) => foe.alive && foe.kind !== "guardian")
        ) {
            this.message("FIRST DEFEAT THE WISP TO BREAK THE CORE SHIELD!");
            return;
        }
        e.absorbDamage(amount, time, hero?.x ?? e.node.x, hero?.y ?? e.node.y);
        // First guardian hit leaves half HP, second defeats it; lesser enemy one-hit.
        const damage =
            e.kind === "guardian"
                ? ++this.demoBossHits === 1
                    ? Math.max(1, Math.ceil(e.hp * 0.5))
                    : Math.max(1, e.hp)
                : Math.max(1, e.hp);
        const cueBefore = e.cue;
        e.applyDamage(damage, time);
        if (e.kind !== "guardian" && e.cue && e.kind !== "knight") {
            e.cue.graphic.destroy();
            e.cue = undefined;
        }
        if (cueBefore && !e.cue)
            this.attackDirector.release(this.foes.indexOf(e));
        this.floatingText(
            e.node.x,
            e.node.y - e.radius - 38,
            `-${damage}`,
            0xf3c6dc,
        );
        if (!e.hp) {
            this.killEnemy(e);
        }
        // No phase-two mobs in the shortened presentation encounter.
        this.refreshHUD();
    }
    private killEnemy(e: Enemy): void {
        if (!e.alive) return;
        e.cue?.graphic.destroy();
        e.cue = undefined;
        this.attackDirector.release(this.foes.indexOf(e));
        this.kills++;
        const shock = this.add
            .circle(
                e.node.x,
                e.node.y,
                e.radius * 1.15,
                e.kind === "guardian" ? 0xe86c91 : 0xa18abd,
                0.32,
            )
            .setDepth(e.node.y + 1);
        this.uiCamera?.ignore(shock);
        this.tweens.add({
            targets: shock,
            scale: 2.3,
            alpha: 0,
            duration: 350,
            onComplete: () => shock.destroy(),
        });
        e.die((sprite) => this.uiCamera?.ignore(sprite));
        if (e.kind === "guardian") {
            this.message(
                "CORE GUARDIAN DEFEATED! SECURITY QUESTION NEXT.",
                "#55E8D5",
            );
            this.time.delayedCall(450, () => {
                if (this.phase === "explore") this.showSeal(1);
            });
        } else {
            this.message(
                "WISP DEFEATED! STRIKE THE CORE GUARDIAN TWICE.",
                "#55E8D5",
            );
        }
        this.refreshHUD();
    }
    private roomCleared(roomId: number): boolean {
        return (
            this.roomSpawned.has(roomId) &&
            this.foes.every((e) => e.room !== roomId || !e.alive)
        );
    }
    private fire(
        x: number,
        y: number,
        angle: number,
        speed: number,
        friendly: boolean,
        damage: number,
        ttl: number,
    ): void {
        const node = this.add
            .circle(
                x,
                y,
                friendly ? 9 : 12,
                friendly ? 0xfbbf24 : 0xff718b,
                0.97,
            )
            .setDepth(y + 50);
        node.setStrokeStyle(3, friendly ? 0xffffff : 0xffc7d0, 0.7);
        this.uiCamera?.ignore(node);
        this.missiles.push({
            node,
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            ttl,
            friendly,
            damage,
        });
    }
    private updateMissiles(
        time: number,
        dt: number,
        px: number,
        py: number,
    ): void {
        for (let i = this.missiles.length - 1; i >= 0; i--) {
            const b = this.missiles[i];
            b.ttl -= dt * 1000;
            const nextX = b.x + b.vx * dt,
                nextY = b.y + b.vy * dt;
            const traveled = Math.hypot(nextX - b.x, nextY - b.y);
            const segments = Math.max(1, Math.ceil(traveled / 12));
            let expire = b.ttl <= 0;
            for (let step = 1; step <= segments && !expire; step++) {
                const sx = b.x + ((nextX - b.x) * step) / segments;
                const sy = b.y + ((nextY - b.y) * step) / segments;
                if (!this.canStand(sx, sy, 4)) {
                    expire = true;
                    break;
                }
                if (b.friendly) {
                    const target = this.foes.find(
                        (e) =>
                            e.alive &&
                            Math.hypot(e.node.x - sx, e.node.y - sy) <
                                e.radius + 13,
                    );
                    if (target) {
                        this.hitEnemy(target, b.damage, time);
                        expire = true;
                    }
                } else if (Math.hypot(px - sx, py - sy) < 27) {
                    this.takeDamage(time, b.damage, "CURSED PROJECTILE");
                    expire = true;
                }
            }
            if (!expire) {
                b.x = nextX;
                b.y = nextY;
                b.node.setPosition(nextX, nextY).setDepth(nextY + 50);
            }
            if (expire) {
                b.node.destroy();
                this.missiles.splice(i, 1);
            }
            if (this.phase !== "explore") return;
        }
    }
    private takeDamage(time: number, amount: number, source: string): void {
        if (this.phase === "explore") {
            // Presentation shield prevents an unlucky attack ending the pitch.
            // The enemy animations, telegraphs, dodges and actual combat remain.
            return;
        }
        if (time < this.invulnerableUntil || time < this.afterModalGrace)
            return;
        this.hp = Math.max(0, this.hp - amount);
        this.invulnerableUntil = time + 1200;
        this.combat.interrupt();
        if (amount >= 2 && this.player) {
            const hero = this.player.sprite;
            const threat = this.foes
                .filter((e) => e.alive)
                .sort(
                    (a, b) =>
                        Math.hypot(a.node.x - hero.x, a.node.y - hero.y) -
                        Math.hypot(b.node.x - hero.x, b.node.y - hero.y),
                )[0];
            const awayX = threat
                ? hero.x - threat.node.x
                : Math.cos(this.lastAim);
            const awayY = threat
                ? hero.y - threat.node.y
                : Math.sin(this.lastAim);
            const length = Math.max(1, Math.hypot(awayX, awayY));
            const nx = hero.x + (awayX / length) * 42,
                ny = hero.y + (awayY / length) * 42;
            if (this.canStand(nx, ny, 15)) {
                hero.setPosition(nx, ny);
                this.safeX = nx;
                this.safeY = ny;
            }
            this.hero?.knockback(time, awayX, awayY);
        } else this.hero?.hit(time);
        this.hero?.sprite.setTint(0xffa5af);
        this.time.delayedCall(200, () => this.hero?.sprite.clearTint());
        this.cameras.main.shake(140, 0.003);
        this.message(`${source}: -${amount} HP`, "#FDA4AF");
        this.refreshHUD();
        if (!this.hp) this.endRun(false, "YOUR INTEGRITY HAS BEEN DEPLETED");
    }
    private floatingText(
        x: number,
        y: number,
        value: string,
        color: number,
    ): void {
        const t = this.add
            .text(x, y, value, {
                fontFamily: PIXEL,
                fontSize: "14px",
                color: `#${color.toString(16).padStart(6, "0")}`,
            })
            .setOrigin(0.5)
            .setDepth(20000);
        this.uiCamera?.ignore(t);
        this.tweens.add({
            targets: t,
            y: y - 44,
            alpha: 0,
            duration: 500,
            onComplete: () => t.destroy(),
        });
    }
    private usePotion(): void {
        if (this.potions <= 0) {
            this.message("NO MEDKITS LEFT", "#FDA4AF");
            return;
        }
        if (this.hp >= MAX_HP) {
            this.message("HP IS ALREADY FULL", "#FDE68A");
            return;
        }
        this.potions--;
        this.hp = Math.min(MAX_HP, this.hp + 4);
        this.message("MEDKIT USED: +4 HP", "#55e8d5");
        this.refreshHUD();
    }

    // ---- Exploration interactions, interactive learning gates ----
    private makePrompt(): void {
        const back = this.add
            .rectangle(0, 0, 302, 34, 0x071526, 0.96)
            .setStrokeStyle(2, 0xfbbf24);
        this.promptLabel = this.add
            .text(0, 0, "", {
                fontFamily: PIXEL,
                fontSize: "8px",
                color: "#FDE68A",
            })
            .setOrigin(0.5);
        this.worldPrompt = this.add
            .container(0, 0, [back, this.promptLabel])
            .setDepth(17000)
            .setVisible(false);
    }
    private updatePrompts(x: number, y: number): void {
        const room = roomAt(this.layout, x, y);
        if (
            !room ||
            (room.role !== "seal" &&
                room.role !== "rest" &&
                room.role !== "cache")
        ) {
            this.worldPrompt?.setVisible(false);
            return;
        }
        if (
            Math.hypot(x - room.cx, y - room.cy) > 120 ||
            ((room.role === "rest" || room.role === "cache") &&
                this.usedShrines.has(room.id))
        ) {
            this.worldPrompt?.setVisible(false);
            return;
        }
        const ready =
            room.role === "rest" ||
            room.role === "cache" ||
            Boolean(
                room.stage &&
                room.stage === this.solvedSeals + 1 &&
                this.roomCleared(room.id),
            );
        this.worldPrompt?.setVisible(true).setPosition(room.cx, room.cy - 99);
        this.promptLabel?.setText(
            room.role === "rest"
                ? "[E] HEAL AT SHRINE"
                : room.role === "cache"
                  ? "[E] OPEN SUPPLY CACHE"
                  : room.stage! <= this.solvedSeals
                    ? "SEAL ALREADY DECODED"
                    : room.stage !== this.solvedSeals + 1
                      ? "DECODE PREVIOUS SEAL"
                      : this.roomCleared(room.id)
                        ? "[E] DECODE SECURITY SEAL"
                        : "DEFEAT ROOM GUARDIANS",
        );
        if (
            ready &&
            this.interactKey &&
            Phaser.Input.Keyboard.JustDown(this.interactKey)
        ) {
            if (room.role === "rest") {
                this.usedShrines.add(room.id);
                this.hp = Math.min(MAX_HP, this.hp + 3);
                this.secondsLeft += 45;
                this.message("SHRINE RESTORED 3 HP AND 45 SECONDS", "#55E8D5");
                this.refreshHUD();
            } else if (room.role === "cache") {
                this.usedShrines.add(room.id);
                this.potions = Math.min(5, this.potions + 1);
                this.message("SUPPLY CACHE: +1 MEDKIT", "#FDE68A");
                this.refreshHUD();
            } else if (room.stage) this.showSeal(room.stage);
        }
    }
    private animateTorches(time: number): void {
        this.lastTorch = time;
        for (const torch of this.torches) {
            const a =
                0.65 +
                0.18 * Math.sin(time * 0.009 + torch.phase) +
                0.1 * Math.sin(time * 0.032 + torch.phase);
            torch.flame.setAlpha(Phaser.Math.Clamp(a, 0.3, 1));
            torch.glow.setAlpha(Phaser.Math.Clamp(a * 0.72, 0.19, 0.78));
        }
    }

    // ---- Screen-space HUD and pause/assessment UI ----
    private buildHUD(): void {
        const root = this.uiRoot!;
        const frame = this.add.graphics();
        frame.fillStyle(0x0c0a12, 0.97).fillRect(0, 0, W, 86);
        frame.fillStyle(0x9f4761, 0.91).fillRect(26, 83, 972, 3);
        frame.fillStyle(0x0c0a12, 0.97).fillRect(0, 674, W, 94);
        frame.fillStyle(0x625263, 0.8).fillRect(26, 674, 972, 2);
        frame.fillStyle(0x17111c, 0.91).fillRect(29, 639, 966, 34);
        root.add(frame);
        this.label(root, 31, 13, "THE NULL CITADEL", 15, "#F0A6B8", true);
        this.roomText = this.label(
            root,
            31,
            49,
            "REFUGE OF THE FIRST FLAME",
            8,
            "#B7ACB8",
            true,
        );
        this.statusText = this.label(
            root,
            988,
            18,
            "",
            9,
            "#C7B2D2",
            true,
        ).setOrigin(1, 0);
        this.timerText = this.label(
            root,
            988,
            50,
            "",
            9,
            "#D6BEBC",
            true,
        ).setOrigin(1, 0);
        this.label(root, 28, 690, "INTEGRITY", 9, "#FDA4AF", true);
        root.add(
            this.add
                .rectangle(29, 713, 240, 20, 0x3e1f2a)
                .setOrigin(0)
                .setStrokeStyle(2, 0x914253),
        );
        this.healthFill = this.add
            .rectangle(32, 716, 234, 14, 0xef4444)
            .setOrigin(0);
        root.add(this.healthFill);
        this.healthValue = this.label(
            root,
            269,
            694,
            "",
            8,
            "#FFFFFF",
            true,
        ).setOrigin(1, 0);
        this.label(root, 29, 744, "STAMINA", 8, "#86efac", true);
        root.add(
            this.add
                .rectangle(119, 742, 151, 14, 0x0e2731)
                .setOrigin(0)
                .setStrokeStyle(1, 0x497b86),
        );
        this.staminaFill = this.add
            .rectangle(121, 744, 147, 10, 0x34d399)
            .setOrigin(0);
        root.add(this.staminaFill);
        this.staminaValue = this.label(
            root,
            277,
            744,
            "100",
            8,
            "#86efac",
            true,
        );
        const slots: Array<{
            key: string;
            title: string;
            color: number;
            click: () => void;
        }> = [
            {
                key: "1",
                title: "BLADE",
                color: 0xe2e8f0,
                click: () => this.selectWeapon("blade"),
            },
            {
                key: "2",
                title: "SPEAR",
                color: 0xfbbf24,
                click: () => this.selectWeapon("spear"),
            },
            {
                key: "3",
                title: "BOW",
                color: 0x7dd3fc,
                click: () => this.selectWeapon("crossbow"),
            },
            {
                key: "4",
                title: "MEDKIT",
                color: 0xfb7185,
                click: () => this.usePotion(),
            },
        ];
        slots.forEach((slot, i) => {
            const x = 342 + 91 * i;
            const bg = this.add
                .rectangle(x, 699, 83, 56, 0x201827)
                .setOrigin(0)
                .setStrokeStyle(i === 0 ? 3 : 1, i === 0 ? 0xd66d8b : 0x67596b)
                .setInteractive({ useHandCursor: true });
            bg.on("pointerdown", slot.click);
            bg.on("pointerover", () => bg.setFillStyle(0x3c2b40));
            bg.on("pointerout", () => bg.setFillStyle(0x201827));
            root.add(bg);
            if (i < 3) this.slotBoxes.push(bg);
            this.label(root, x + 8, 705, slot.key, 11, "#E0BECF", true);
            this.label(
                root,
                x + 40,
                734,
                slot.title,
                7,
                `#${slot.color.toString(16).padStart(6, "0")}`,
                true,
            ).setOrigin(0.5);
        });
        this.itemCounter = this.label(
            root,
            704,
            704,
            "",
            8,
            "#FDA4AF",
            true,
        ).setOrigin(1, 0);
        this.messageText = this.label(
            root,
            512,
            647,
            "",
            13,
            "#CAB9D0",
            false,
            925,
        ).setOrigin(0.5, 0);
        this.label(
            root,
            866,
            749,
            "WASD / SPACE / CLICK / E",
            7,
            "#BFD2EA",
            true,
        ).setOrigin(0.5);
        this.button(root, 808, 696, 181, 42, "JUMP TO QUIZ", () => {
            if (this.phase === "explore") this.showSeal(1);
        });
        this.bossLabel = this.label(
            root,
            749,
            110,
            "NULL CORE GUARDIAN",
            10,
            "#FDA4AF",
            true,
        ).setVisible(false);
        this.bossBack = this.add
            .rectangle(751, 133, 237, 20, 0x351926)
            .setOrigin(0)
            .setStrokeStyle(2, 0xa74457)
            .setVisible(false);
        root.add(this.bossBack);
        this.bossFill = this.add
            .rectangle(755, 137, 229, 12, 0xfb7185)
            .setOrigin(0)
            .setVisible(false);
        root.add(this.bossFill);
    }
    private refreshHUD(): void {
        this.statusText?.setText(
            `DEMO / WISP + BOSS  /  KILLS ${this.kills}  /  HP ${this.hp}`,
        );
        const n = Math.ceil(this.secondsLeft);
        this.timerText?.setText(
            `BOSS RUSH   ${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`,
        );
        this.healthFill?.setScale(this.hp / MAX_HP, 1);
        this.healthValue?.setText(`${this.hp}/${MAX_HP}`);
        this.itemCounter?.setText(`x${this.potions}`);
        this.bossLabel?.setVisible(Boolean(this.bossTarget?.alive));
        if (this.bossTarget?.alive)
            this.bossLabel?.setText(
                `NULL CORE GUARDIAN / PHASE ${this.bossPhase(this.bossTarget)}`,
            );
        this.bossBack?.setVisible(Boolean(this.bossTarget?.alive));
        this.bossFill?.setVisible(Boolean(this.bossTarget?.alive));
        if (this.bossTarget)
            this.bossFill?.setScale(
                this.bossTarget.hp / this.bossTarget.maxHp,
                1,
            );
    }
    private message(value: string, color = "#55E8D5"): void {
        this.messageText?.setText(value).setColor(color);
    }
    private label(
        root: Phaser.GameObjects.Container,
        x: number,
        y: number,
        value: string,
        size: number,
        color: string,
        pixel = false,
        wrap = 0,
    ): Phaser.GameObjects.Text {
        const o = this.add.text(x, y, value, {
            fontFamily: pixel ? PIXEL : BODY,
            fontSize: `${size}px`,
            color,
            lineSpacing: pixel ? 5 : 7,
            ...(wrap
                ? { wordWrap: { width: wrap, useAdvancedWrap: true } }
                : {}),
        });
        root.add(o);
        return o;
    }
    private modal(
        title: string,
        subtitle: string,
    ): Phaser.GameObjects.Container {
        this.overlay?.destroy(true);
        this.phase = "modal";
        this.activeStage = undefined;
        this.combat.interrupt();
        this.player?.sprite.setVelocity(0, 0);
        this.lead?.setEnabled(false);
        this.worldPrompt?.setVisible(false);
        const root = this.add.container(0, 0);
        this.uiRoot!.add(root);
        this.overlay = root;
        const g = this.add.graphics();
        g.fillStyle(0x020611, 0.89).fillRect(0, 0, W, H);
        g.fillStyle(0x211827).fillRect(150, 119, 725, 532);
        g.lineStyle(4, 0x9f4761).strokeRect(150, 119, 725, 532);
        g.fillStyle(0x302638).fillRect(173, 144, 678, 477);
        g.fillStyle(0xc35d79).fillRect(194, 207, 636, 3);
        root.add(g);
        this.label(root, 197, 157, subtitle, 9, "#C7B2D2", true);
        this.label(root, 197, 180, title, 14, "#EBA4B6", true);
        return root;
    }
    private button(
        root: Phaser.GameObjects.Container,
        x: number,
        y: number,
        w: number,
        h: number,
        value: string,
        act: () => void,
        small = false,
    ): void {
        const bg = this.add
            .rectangle(x, y, w, h, 0x10243b)
            .setOrigin(0)
            .setStrokeStyle(2, 0x7dd3fc)
            .setInteractive({ useHandCursor: true });
        bg.on("pointerover", () => bg.setFillStyle(0x245273));
        bg.on("pointerout", () => bg.setFillStyle(0x10243b));
        bg.on("pointerdown", act);
        root.add(bg);
        this.label(
            root,
            x + w / 2,
            y + h / 2,
            value,
            small ? 16 : 9,
            "#F0F9FF",
            !small,
            w - 25,
        ).setOrigin(0.5);
    }
    private closeModal(): void {
        if (this.phase !== "modal") return;
        this.overlay?.destroy(true);
        this.overlay = undefined;
        this.activeStage = undefined;
        this.feedback = undefined;
        this.phase = "explore";
        this.lead?.setEnabled(true);
        this.afterModalGrace = this.time.now + 650;
        for (const e of this.foes) {
            e.cue?.graphic.destroy();
            e.cue = undefined;
            e.nextAttack = Math.max(e.nextAttack, this.time.now + 1300);
        }
    }
    private showSeal(stage: TrialStage): void {
        const data = this.trials[stage];
        const root = this.modal(
            data.title,
            `${data.chapter} / SECURITY SEAL ${stage}`,
        );
        this.activeStage = stage;
        this.label(root, 195, 233, data.scenario, 20, "#E2E8F0", false, 625);
        data.options.forEach((choice, i) =>
            this.button(
                root,
                197,
                332 + 69 * i,
                631,
                57,
                `${i + 1}. ${choice}`,
                () => this.answerSeal(i),
                true,
            ),
        );
        this.feedback = this.label(
            root,
            199,
            558,
            "DECODE CAREFULLY: A WRONG ANSWER COSTS 1 HP AND 15 SECONDS.",
            14,
            "#FDE68A",
            false,
            624,
        );
        this.label(
            root,
            198,
            603,
            "1 / 2 / 3 SELECT   |   ESC TO EXIT",
            8,
            "#BFD2EA",
            true,
        );
    }
    private answerSeal(index: number): void {
        const stage = this.activeStage;
        if (this.phase !== "modal" || stage === undefined) return;
        const trial = this.trials[stage];
        if (index !== trial.answer) {
            const key = `${stage}-${index}`;
            if (this.wrong.has(key)) {
                this.feedback?.setText("THAT ANSWER HAS BEEN RULED OUT.");
                return;
            }
            this.wrong.add(key);
            this.hp = Math.max(0, this.hp - 1);
            this.secondsLeft = Math.max(0, this.secondsLeft - 15);
            this.feedback
                ?.setText("INCORRECT: -1 HP, -15s. Inspect the request again.")
                .setColor("#FCA5A5");
            this.refreshHUD();
            if (!this.hp || this.secondsLeft <= 0)
                this.endRun(false, "THE SEAL REJECTED YOUR DECISION");
            return;
        }
        this.solvedSeals = 1;
        this.showDemoClear(trial.explanation);
    }

    private showDemoClear(explanation: string): void {
        const root = this.modal(
            "BOSS RUSH CLEARED",
            "SECURITY DECISION PASSED / PRESENTATION",
        );
        this.phase = "result";
        this.label(root, 194, 240, explanation, 20, "#E2E8F0", false, 632);
        this.label(
            root,
            195,
            398,
            "PRESENTATION DEMO ONLY / NO XP OR EARNED BADGE",
            9,
            "#FDE68A",
            true,
        );
        this.label(
            root,
            195,
            452,
            "Show the separately issued BSC Testnet demo badge for on-chain verification.",
            16,
            "#55E8D5",
            false,
            625,
        );
        this.button(root, 197, 549, 300, 58, "VIEW WEB3 PROOF", () =>
            this.requestDemoProof(),
        );
        this.button(root, 520, 549, 306, 58, "QUEST HALL", () =>
            this.scene.start("Game"),
        );
        const payload = {
            mode: "dungeon-conquer",
            presentationOnly: true,
            awardsXp: false,
            earnedCredential: false,
        };
        this.game.events.emit("campusbounty:demo:completed", payload);
        if (typeof window !== "undefined")
            window.dispatchEvent(
                new CustomEvent("campusbounty:demo:completed", {
                    detail: payload,
                }),
            );
    }

    private requestDemoProof(): void {
        const payload = {
            mode: "dungeon-conquer",
            presentationOnly: true,
            awardsXp: false,
            earnedCredential: false,
        };
        this.game.events.emit("campusbounty:demo:proof-requested", payload);
        if (typeof window !== "undefined")
            window.dispatchEvent(
                new CustomEvent("campusbounty:demo:proof-requested", {
                    detail: payload,
                }),
            );
        this.scene.start("Game");
    }

    private showDungeonMap(): void {
        const root = this.modal(
            "EXPLORER'S CHART",
            "SECTOR DISCOVERY / PRESS ESC TO CLOSE",
        );
        const g = this.add.graphics();
        root.add(g);
        const sx = 222,
            sy = 235,
            ww = 590,
            hh = 297;
        g.fillStyle(0x050c17).fillRect(sx - 9, sy - 9, ww + 18, hh + 18);
        g.lineStyle(2, 0x49647b, 0.9).strokeRect(
            sx - 9,
            sy - 9,
            ww + 18,
            hh + 18,
        );
        const kx = ww / DUNGEON.width,
            ky = hh / DUNGEON.height;
        const seen = this.visitedRooms;
        // Only reveal links between rooms that were both visited.
        for (const room of this.layout.rooms) {
            if (!seen.has(room.id)) continue;
            for (const neighbor of room.connections) {
                if (!seen.has(neighbor) || neighbor < room.id) continue;
                const next = this.layout.rooms[neighbor];
                g.lineStyle(4, 0x456478, 0.65).lineBetween(
                    sx + room.cx * kx,
                    sy + room.cy * ky,
                    sx + next.cx * kx,
                    sy + next.cy * ky,
                );
            }
        }
        const roleColor = (r: DungeonRoom): number =>
            r.role === "boss"
                ? 0xfb7185
                : r.role === "seal"
                  ? 0xfbbf24
                  : r.role === "rest"
                    ? 0x55e8d5
                    : r.role === "cache"
                      ? 0xf6c76d
                      : r.role === "entry"
                        ? 0x7dd3fc
                        : 0x57758c;
        for (const room of this.layout.rooms) {
            if (!seen.has(room.id)) continue;
            g.fillStyle(
                roleColor(room),
                room.id === this.activeRoom ? 1 : 0.7,
            ).fillRect(
                sx + room.x * kx,
                sy + room.y * ky,
                Math.max(8, room.width * kx),
                Math.max(7, room.height * ky),
            );
            if (room.id === this.activeRoom) {
                g.lineStyle(2, 0xffffff).strokeRect(
                    sx + room.x * kx - 2,
                    sy + room.y * ky - 2,
                    Math.max(8, room.width * kx) + 4,
                    Math.max(7, room.height * ky) + 4,
                );
            }
        }
        this.label(
            root,
            225,
            546,
            `DISCOVERED ${seen.size} / ${this.layout.rooms.length} CHAMBERS`,
            9,
            "#BFD2EA",
            true,
        );
        this.label(
            root,
            225,
            566,
            "CYAN: REFUGE   YELLOW: SEALS   GREEN: SHRINES   RED: CORE",
            8,
            "#FDE68A",
            true,
        );
        this.button(root, 354, 593, 320, 43, "RETURN TO EXPLORING", () =>
            this.closeModal(),
        );
    }
    private showPause(): void {
        const root = this.modal(
            "BOSS RUSH PAUSED",
            "THE NULL CITADEL / 60-SECOND DEMO",
        );
        this.label(
            root,
            197,
            248,
            "This presentation run starts in the real final sanctum. Defeat a wisp and the Core Guardian, then solve one original security-seal question.",
            21,
            "#E2E8F0",
            false,
            627,
        );
        this.label(
            root,
            198,
            412,
            `SEED ${this.seed}  /  SEALS ${this.solvedSeals}/3  /  KILLS ${this.kills}  /  HP ${this.hp}`,
            10,
            "#7DD3FC",
            true,
        );
        this.button(root, 183, 546, 155, 57, "RESUME", () => this.closeModal());
        this.button(root, 346, 546, 155, 57, "SAME SEED", () =>
            this.scene.restart({ seed: this.seed }),
        );
        this.button(root, 509, 546, 155, 57, "NEW SEED", () =>
            this.scene.restart(),
        );
        this.button(root, 672, 546, 155, 57, "QUEST HALL", () =>
            this.scene.start("Game"),
        );
    }
    private endRun(success: boolean, headline: string): void {
        if (this.phase === "result") return;
        if (success) {
            this.showSeal(1);
            return;
        }
        this.hero?.die();
        const root = this.modal(
            "DEMO RETRY",
            "THE NULL CITADEL / PRESENTATION",
        );
        this.phase = "result";
        this.label(root, 195, 238, headline, 20, "#FDA4AF", false, 615);
        this.label(
            root,
            195,
            342,
            "No XP, coins or credentials were issued.",
            19,
            "#E2E8F0",
            false,
            610,
        );
        this.button(root, 190, 550, 304, 58, "RETRY BOSS RUSH", () =>
            this.scene.restart({ seed: this.seed }),
        );
        this.button(root, 515, 550, 311, 58, "QUEST HALL", () =>
            this.scene.start("Game"),
        );
    }
}

