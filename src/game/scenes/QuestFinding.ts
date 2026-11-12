import * as Phaser from "phaser";
import { Player } from "../entities/Player";
import { MouseLeadCamera } from "../systems/MouseLeadCamera";
import type { CaseSet } from "../data/QuestFindingCases";
import {
    ARCHIVE,
    INTERACTABLES,
    WALKABLE,
    buildQuestFindingMap,
    type FlickerLight,
    isArchiveWalkable,
    type ArchiveInteractable,
    type DistrictId,
} from "../world/QuestFindingMap";
import {
    awardQuestFinding,
    getGameSession,
    type QuestFindingReward,
} from "../data/GameSession";

const FONT = '"Press Start 2P", monospace';
const BODY = '"Trebuchet MS", Arial, sans-serif';
const GAME_SECONDS = 20 * 60;
const MAX_HP = 5;
const EVIDENCE_PER_DISTRICT = 3;
const DISTRICTS: DistrictId[] = ["source", "approval", "recovery"];
const WORLD_ZOOM = 1.5;

type Phase = "explore" | "modal" | "result";
type ModalKind =
    | "evidence"
    | "terminal"
    | "vault"
    | "journal"
    | "pause"
    | "note"
    | "result";
type Wisp = {
    node: Phaser.GameObjects.Container;
    home: Phaser.Math.Vector2;
    patrolTo: Phaser.Math.Vector2;
    routeBack: boolean;
    patrolSpeed: number;
    chaseSpeed: number;
    sightRange: number;
    alerted: boolean;
    nextScan: number;
    hasSight: boolean;
    chaseUntil: number;
    hp: number;
    alive: boolean;
};

/**
 * G3.6 — Seeded corporate ruin: 24 sectors, investigation, click-to-defeat drones.
 * Three randomized departments, nine evidence records, six deduction checks,
 * a seeded vault cipher, less aggressive security drones and a
 * 1.5x mouse-leading camera. Rewards remain in-memory demo rewards.
 */
export class QuestFinding extends Phaser.Scene {
    private player?: Player;
    private interactKey?: Phaser.Input.Keyboard.Key;
    private dashKey?: Phaser.Input.Keyboard.Key;
    private worldObstacles: Phaser.Geom.Rectangle[] = [];
    private wisps: Wisp[] = [];
    private worldPrompt?: Phaser.GameObjects.Container;
    private promptText?: Phaser.GameObjects.Text;
    private uiRoot?: Phaser.GameObjects.Container;
    private uiCamera?: Phaser.Cameras.Scene2D.Camera;
    private mouseLead?: MouseLeadCamera;
    private flickerLights: FlickerLight[] = [];
    private hpFill?: Phaser.GameObjects.Rectangle;
    private hpLabel?: Phaser.GameObjects.Text;
    private seed = 0;
    private cases!: CaseSet;
    private stage: Record<DistrictId, number> = {
        source: 0,
        approval: 0,
        recovery: 0,
    };
    private attackReadyAt = 0;
    private defeated = 0;
    private status?: Phaser.GameObjects.Text;
    private areaText?: Phaser.GameObjects.Text;
    private toast?: Phaser.GameObjects.Text;
    private overlay?: Phaser.GameObjects.Container;
    private overlayMode?: ModalKind;
    private feedback?: Phaser.GameObjects.Text;
    private vaultSlots?: Phaser.GameObjects.Text;
    private currentDistrict?: DistrictId;
    private currentEvidence?: ArchiveInteractable;
    private wrongAnswers = new Set<string>();
    private vaultInput = "";
    private readEvidence = new Set<string>();
    private solved = new Set<DistrictId>();
    private phase: Phase = "explore";
    private secondsLeft = GAME_SECONDS;
    private hp = MAX_HP;
    private invulnerableUntil = 0;
    private beaconUsed = false;
    private checkpoint = new Phaser.Math.Vector2(
        ARCHIVE.spawn.x,
        ARCHIVE.spawn.y,
    );
    private safeX: number = ARCHIVE.spawn.x;
    private safeY: number = ARCHIVE.spawn.y;
    private dashUntil = 0;
    private dashReadyAt = 0;
    private lastMinuteTick = -1;
    private flickerTickAt = 0;

    private readonly keyDown = (event: KeyboardEvent): void => {
        if (event.repeat) return;
        if (event.code === "Escape") {
            event.preventDefault();
            if (this.phase === "result") this.returnToHall();
            else if (this.phase === "explore") this.showPause();
            else this.closeModal();
            return;
        }
        if (event.code === "KeyJ") {
            event.preventDefault();
            if (this.phase === "explore") this.showJournal();
            else if (this.overlayMode === "journal") this.closeModal();
            return;
        }
        if (this.phase !== "modal") return;
        if (this.overlayMode === "vault") {
            if (/^(Digit|Numpad)[0-9]$/.test(event.code)) {
                this.inputDigit(event.code.slice(-1));
                event.preventDefault();
            } else if (event.code === "Backspace") {
                this.vaultInput = this.vaultInput.slice(0, -1);
                this.syncVaultSlots();
                event.preventDefault();
            } else if (event.code === "Enter" || event.code === "NumpadEnter") {
                this.verifyVault();
                event.preventDefault();
            }
        } else if (this.overlayMode === "terminal") {
            const index = (
                {
                    Digit1: 0,
                    Digit2: 1,
                    Digit3: 2,
                    Numpad1: 0,
                    Numpad2: 1,
                    Numpad3: 2,
                } as Record<string, number>
            )[event.code];
            if (index !== undefined) {
                this.chooseAnswer(index);
                event.preventDefault();
            }
        } else if (
            (event.code === "Enter" || event.code === "Space") &&
            this.overlayMode === "evidence"
        ) {
            this.logCurrentEvidence();
            event.preventDefault();
        }
    };

    constructor() {
        super("QuestFinding");
    }

    init(data?: { seed?: number }): void {
        // A new run chooses a new seed. "REPLAY SEED" passes it explicitly.
        const requested = data?.seed;
        this.seed =
            typeof requested === "number" &&
            Number.isInteger(requested) &&
            requested > 0
                ? requested >>> 0
                : Phaser.Math.Between(1, 99999999);
    }

    create(): void {
        // Reinitialize all state on retry: Phaser reuses scene instances.
        this.phase = "explore";
        this.overlayMode = undefined;
        this.secondsLeft = GAME_SECONDS;
        this.hp = MAX_HP;
        this.readEvidence.clear();
        this.solved.clear();
        this.wrongAnswers.clear();
        this.wisps = [];
        this.worldObstacles = [];
        this.vaultInput = "";
        this.beaconUsed = false;
        this.invulnerableUntil = 0;
        this.dashUntil = 0;
        this.dashReadyAt = 0;
        this.checkpoint.set(ARCHIVE.spawn.x, ARCHIVE.spawn.y);
        this.safeX = ARCHIVE.spawn.x;
        this.safeY = ARCHIVE.spawn.y;
        this.lastMinuteTick = -1;
        this.flickerTickAt = 0;
        this.stage = { source: 0, approval: 0, recovery: 0 };
        this.attackReadyAt = 0;
        this.defeated = 0;
        this.flickerLights = [];
        this.hpFill = undefined;
        this.hpLabel = undefined;
        this.overlay = undefined;
        this.currentDistrict = undefined;
        this.currentEvidence = undefined;

        const camera = this.cameras.main;
        camera.setZoom(WORLD_ZOOM);
        camera.setBounds(0, 0, ARCHIVE.width, ARCHIVE.height);
        camera.fadeIn(220, 5, 11, 23);

        const world = buildQuestFindingMap(this, this.seed);
        this.worldObstacles = world.obstacles;
        this.cases = world.cases;
        this.flickerLights = world.lights;
        this.checkpoint.set(ARCHIVE.spawn.x, ARCHIVE.spawn.y);
        this.safeX = ARCHIVE.spawn.x;
        this.safeY = ARCHIVE.spawn.y;
        this.player = new Player(this, ARCHIVE.spawn.x, ARCHIVE.spawn.y);
        this.physics.add.collider(this.player.sprite, world.blockers);
        this.mouseLead = new MouseLeadCamera(
            this,
            this.player.sprite,
            ARCHIVE.width,
            ARCHIVE.height,
            {
                zoom: WORLD_ZOOM,
                maxLeadX: 165,
                maxLeadY: 115,
                deadzone: 0.1,
                smoothingMs: 185,
                followLerp: 0.12,
            },
        );

        // Fewer, slower drones: two clicks to defeat, narrow vision, short pursuit.
        world.wisps.forEach((w) => this.spawnWisp(w.x, w.y, w.toX, w.toY));

        this.makeWorldPrompt();

        // Fixed HUD camera: unlike the world, it never pans or zooms.
        const worldObjects = [...this.children.list];
        const uiCamera = this.cameras.add(0, 0, 1024, 768, false, "QF-HUD");
        uiCamera.setZoom(1).setScroll(0, 0);
        uiCamera.ignore(worldObjects);
        this.uiCamera = uiCamera;
        this.uiRoot = this.add
            .container(0, 0)
            .setDepth(30000)
            .setScrollFactor(0);
        camera.ignore(this.uiRoot);
        this.buildHUD();
        this.refreshHUD();
        this.message(
            "Inspect the evacuation directory. Find 9 records, then solve 6 deductions.",
        );

        this.interactKey = this.input.keyboard?.addKey(
            Phaser.Input.Keyboard.KeyCodes.E,
        );
        this.dashKey = this.input.keyboard?.addKey(
            Phaser.Input.Keyboard.KeyCodes.SHIFT,
        );
        this.input.keyboard?.on("keydown", this.keyDown);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.input.keyboard?.off("keydown", this.keyDown);
            this.interactKey = undefined;
            this.dashKey = undefined;
            this.wisps.length = 0;
            this.mouseLead?.destroy();
            this.mouseLead = undefined;
            this.flickerLights = [];
            this.overlay = undefined;
            this.player?.destroy();
            this.player = undefined;
            if (this.uiCamera && this.cameras.cameras.includes(this.uiCamera)) {
                this.cameras.remove(this.uiCamera);
            }
            this.uiCamera = undefined;
            this.uiRoot = undefined;
        });
    }

    update(time: number, delta: number): void {
        if (this.phase !== "explore" || !this.player) return;
        const dt = Math.min(Math.max(0, delta), 70) / 1000;
        this.player.update();
        this.mouseLead?.update(delta);
        const sprite = this.player.sprite;
        const body = sprite.body as Phaser.Physics.Arcade.Body | null;
        const feetX = body ? body.center.x : sprite.x;
        const feetY = body ? body.bottom : sprite.y + 28;

        // Honor the irregular floor plan while preserving diagonal wall sliding.
        if (!isArchiveWalkable(feetX, feetY) && body) {
            const oldFeetY = this.safeY + (feetY - sprite.y);
            const canSlideX = isArchiveWalkable(feetX, oldFeetY);
            const canSlideY = isArchiveWalkable(this.safeX, feetY);
            if (canSlideX) {
                sprite.y = this.safeY;
                sprite.setVelocityY(0);
            } else if (canSlideY) {
                sprite.x = this.safeX;
                sprite.setVelocityX(0);
            } else {
                sprite.setPosition(this.safeX, this.safeY);
                sprite.setVelocity(0, 0);
            }
        }
        const actualBody = sprite.body as Phaser.Physics.Arcade.Body | null;
        const px = actualBody ? actualBody.center.x : sprite.x;
        const py = actualBody ? actualBody.bottom : sprite.y + 28;
        if (isArchiveWalkable(px, py)) {
            this.safeX = sprite.x;
            this.safeY = sprite.y;
        }

        // Shift dash: brief speed burst with cooldown, no permanent stamina bar.
        if (
            this.dashKey &&
            Phaser.Input.Keyboard.JustDown(this.dashKey) &&
            time >= this.dashReadyAt &&
            sprite.body
        ) {
            this.dashUntil = time + 210;
            this.dashReadyAt = time + 1700;
        }
        if (time < this.dashUntil && sprite.body) {
            sprite.setVelocity(
                sprite.body.velocity.x * 1.82,
                sprite.body.velocity.y * 1.82,
            );
        }

        this.secondsLeft = Math.max(0, this.secondsLeft - dt);
        if (this.secondsLeft <= 0) {
            this.endExpedition(false, "THE ARCHIVE SEALED ITSELF");
            return;
        }
        this.updateWisps(time, dt, px, py);
        if (this.phase !== "explore") return;

        const nearest = INTERACTABLES.map((spec) => ({
            spec,
            distance: Phaser.Math.Distance.Between(px, py, spec.x, spec.y),
        }))
            .filter(
                ({ distance, spec }) =>
                    distance <= (spec.kind === "vault" ? 94 : 76),
            )
            .sort((a, b) => a.distance - b.distance)[0]?.spec;
        this.worldPrompt?.setVisible(!!nearest);
        if (nearest && this.worldPrompt && this.promptText) {
            this.promptText.setText(
                nearest.kind === "evidence"
                    ? "[E] INSPECT"
                    : nearest.kind === "vault"
                      ? "[E] UNLOCK VAULT"
                      : "[E] INTERACT",
            );
            this.worldPrompt.setPosition(nearest.x, nearest.y - 70);
        }
        const pressed =
            this.interactKey &&
            Phaser.Input.Keyboard.JustDown(this.interactKey);
        if (pressed && nearest) this.interact(nearest);
        if (Math.floor(this.secondsLeft) !== this.lastMinuteTick) {
            this.lastMinuteTick = Math.floor(this.secondsLeft);
            this.refreshHUD();
        }
        // Cheap lighting pass: update a handful of lamp alphas ~8x/sec.
        if (time - this.flickerTickAt >= 125) {
            this.flickerTickAt = time;
            this.flickerLights.forEach((l) => {
                const pulse = Math.sin(time * 0.006 + l.phase);
                const dropout = l.unstable && pulse > 0.78;
                l.glow.setAlpha(dropout ? 0.012 : 0.6 + pulse * 0.12);
                l.bulb.setAlpha(dropout ? 0.09 : 0.62 + pulse * 0.2);
            });
        }
        const area = WALKABLE.find(
            (a) =>
                px >= a.x &&
                px < a.x + a.width &&
                py >= a.y &&
                py < a.y + a.height,
        );
        this.areaText?.setText(
            area
                ? `${area.sector ?? "PASS"} / ${area.name}`
                : "DARK SERVICE VOID",
        );
    }

    private makeWorldPrompt(): void {
        const bg = this.add
            .rectangle(0, 0, 190, 34, 0x071120, 0.97)
            .setStrokeStyle(2, 0x55e8d5);
        this.promptText = this.add
            .text(0, 0, "", {
                fontFamily: FONT,
                fontSize: "9px",
                color: "#D8FFF8",
            })
            .setOrigin(0.5);
        this.worldPrompt = this.add
            .container(0, 0, [bg, this.promptText])
            .setDepth(19000)
            .setVisible(false);
    }

    private spawnWisp(x: number, y: number, toX: number, toY: number): void {
        const ring = this.add.ellipse(0, 0, 56, 52, 0x8c5bf1, 0.15);
        const art = this.add.graphics();
        // A corrupted corporate patrol drone, not an unavoidable fast ghost.
        art.fillStyle(0x11152a).fillRect(-17, -17, 34, 34);
        art.fillStyle(0x6d48af).fillRect(-13, -18, 26, 31);
        art.fillStyle(0x251d44).fillRect(-11, -7, 22, 14);
        art.fillStyle(0xffb25b).fillRect(-8, -3, 6, 6);
        art.fillRect(3, -3, 6, 6);
        art.fillStyle(0xc7b4ff).fillRect(-3, -23, 6, 5);
        const hit = this.add
            .rectangle(0, 0, 60, 62, 0xffffff, 0.001)
            .setInteractive({ useHandCursor: true });
        const node = this.add.container(x, y, [ring, art, hit]).setDepth(y + 7);
        const w: Wisp = {
            node,
            home: new Phaser.Math.Vector2(x, y),
            patrolTo: new Phaser.Math.Vector2(toX, toY),
            routeBack: false,
            patrolSpeed: 46,
            chaseSpeed: 112,
            sightRange: 190,
            alerted: false,
            nextScan: 0,
            hasSight: false,
            chaseUntil: 0,
            hp: 2,
            alive: true,
        };
        hit.on("pointerover", () => ring.setFillStyle(0x55e8d5, 0.24));
        hit.on("pointerout", () => ring.setFillStyle(0x8c5bf1, 0.15));
        hit.on("pointerdown", () => this.attackWisp(w));
        this.wisps.push(w);
    }

    private attackWisp(w: Wisp): void {
        if (this.phase !== "explore" || !w.alive || !this.player) return;
        const now = this.time.now;
        if (now < this.attackReadyAt) return;
        const sprite = this.player.sprite;
        const distance = Phaser.Math.Distance.Between(
            sprite.x,
            sprite.y,
            w.node.x,
            w.node.y,
        );
        if (
            distance > 285 ||
            !this.clearSight(sprite.x, sprite.y, w.node.x, w.node.y)
        ) {
            this.message(
                "Drone out of range or behind cover. Move closer to target it.",
                "#FBBF24",
            );
            return;
        }
        this.attackReadyAt = now + 280;
        w.hp--;
        const blast = this.add.graphics().setDepth(29000);
        blast
            .lineStyle(3, 0x7dd3fc)
            .lineBetween(sprite.x, sprite.y - 10, w.node.x, w.node.y);
        blast.fillStyle(0xffffff).fillCircle(w.node.x, w.node.y, 9);
        this.time.delayedCall(105, () => blast.destroy());
        if (w.hp <= 0) {
            w.alive = false;
            w.node.destroy(true);
            this.defeated++;
            this.message(
                `Patrol drone disabled! ${this.defeated} neutralized this expedition.`,
                "#55E8D5",
            );
        } else {
            w.chaseUntil = now + 1200;
            w.node.setAlpha(0.45);
            this.message(
                "Drone damaged (1/2). Click it once more to disable.",
                "#7DD3FC",
            );
        }
    }

    /** Segment sight is sampled only every ~140ms, to avoid expensive per-frame rays. */
    private clearSight(
        x1: number,
        y1: number,
        x2: number,
        y2: number,
    ): boolean {
        const d = Phaser.Math.Distance.Between(x1, y1, x2, y2);
        const steps = Math.ceil(d / 24);
        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            const x = x1 + (x2 - x1) * t;
            const y = y1 + (y2 - y1) * t;
            if (!isArchiveWalkable(x, y)) return false;
            if (this.worldObstacles.some((r) => r.contains(x, y))) return false;
        }
        return true;
    }

    private canWispEnter(x: number, y: number): boolean {
        if (!isArchiveWalkable(x, y)) return false;
        return !this.worldObstacles.some(
            (r) =>
                x > r.x - 14 &&
                x < r.right + 14 &&
                y > r.y - 14 &&
                y < r.bottom + 14,
        );
    }

    private updateWisps(
        time: number,
        dt: number,
        playerX: number,
        playerY: number,
    ): void {
        for (const w of this.wisps) {
            if (!w.alive) continue;
            const distance = Phaser.Math.Distance.Between(
                w.node.x,
                w.node.y,
                playerX,
                playerY,
            );
            if (time >= w.nextScan) {
                w.nextScan = time + 230;
                w.hasSight =
                    distance < w.sightRange &&
                    this.clearSight(w.node.x, w.node.y, playerX, playerY);
                if (w.hasSight) w.chaseUntil = time + 950;
                w.alerted = w.hasSight || time < w.chaseUntil;
            }
            const goal = w.alerted
                ? { x: playerX, y: playerY }
                : w.routeBack
                  ? w.home
                  : w.patrolTo;
            const dx = goal.x - w.node.x,
                dy = goal.y - w.node.y;
            const len = Math.hypot(dx, dy);
            if (!w.alerted && len < 20) w.routeBack = !w.routeBack;
            if (len > 3) {
                const speed = (w.alerted ? w.chaseSpeed : w.patrolSpeed) * dt;
                const sx = (dx / len) * speed,
                    sy = (dy / len) * speed;
                const attempts: Array<[number, number]> = [
                    [sx, sy],
                    [sx, 0],
                    [0, sy],
                ];
                for (const [vx, vy] of attempts) {
                    if (this.canWispEnter(w.node.x + vx, w.node.y + vy)) {
                        w.node.x += vx;
                        w.node.y += vy;
                        break;
                    }
                }
            }
            w.node.setDepth(w.node.y + 10);
            w.node.setAlpha(w.alerted ? 0.95 : 0.72);
            if (time > this.invulnerableUntil && distance < 38) {
                this.receiveHit(time);
                if (this.phase !== "explore") return;
            }
        }
    }

    private receiveHit(time: number): void {
        if (!this.player) return;
        this.invulnerableUntil = time + 2200;
        this.hp = Math.max(0, this.hp - 1);
        this.secondsLeft = Math.max(0, this.secondsLeft - 3);
        this.message(
            "PATROL DRONE HIT! -1 integrity. Click drones twice to disable them.",
            "#FB7185",
        );
        // Don't teleport across the huge building on every hit.
        this.cameras.main.shake(80, 0.0014);
        this.refreshHUD();
        if (this.hp <= 0 || this.secondsLeft <= 0)
            this.endExpedition(false, "INTEGRITY DEPLETED");
    }

    private interact(spec: ArchiveInteractable): void {
        this.worldPrompt?.setVisible(false);
        if (spec.kind === "evidence") this.showEvidence(spec);
        else if (spec.kind === "terminal" && spec.district)
            this.showTerminal(spec.district);
        else if (spec.kind === "vault") this.showVault();
        else if (spec.kind === "beacon") this.showBeacon();
        else if (spec.kind === "sign" || spec.kind === "decoy")
            this.showNote(spec);
    }

    private buildHUD(): void {
        if (!this.uiRoot) return;
        const root = this.uiRoot;
        const g = this.add.graphics();
        g.fillStyle(0x050913, 0.95).fillRect(0, 0, 1024, 88);
        g.fillStyle(0xb68a30).fillRect(28, 80, 968, 3);
        g.fillStyle(0x050913, 0.94).fillRect(0, 677, 1024, 91);
        g.fillStyle(0x36516a).fillRect(28, 677, 968, 2);
        root.add(g);
        this.text(root, 34, 13, "QUEST FINDING", 16, "#FBBF24", true);
        this.areaText = this.text(
            root,
            34,
            47,
            "ABANDONED RECEPTION",
            9,
            "#A6C4D3",
            true,
        );
        this.status = this.text(
            root,
            984,
            18,
            "",
            9,
            "#7DD3FC",
            true,
        ).setOrigin(1, 0);
        this.text(root, 40, 696, "INTEGRITY", 9, "#FFB4BA", true);
        root.add(
            this.add
                .rectangle(40, 719, 255, 20, 0x07111b)
                .setOrigin(0)
                .setStrokeStyle(2, 0x853943),
        );
        this.hpFill = this.add
            .rectangle(43, 722, 249, 14, 0xeb394e)
            .setOrigin(0);
        root.add(this.hpFill);
        this.hpLabel = this.text(
            root,
            167,
            724,
            "",
            9,
            "#ffffff",
            true,
        ).setOrigin(0.5, 0);
        this.toast = this.text(
            root,
            655,
            700,
            "",
            16,
            "#55E8D5",
            false,
            665,
        ).setOrigin(0.5, 0);
        this.text(
            root,
            657,
            747,
            "WASD MOVE   CLICK DRONES   E INSPECT   SHIFT DASH   J JOURNAL   ESC PAUSE",
            7,
            "#BFD2EA",
            true,
        ).setOrigin(0.5, 0);
        this.text(
            root,
            984,
            53,
            `SEED ${this.seed}`,
            9,
            "#AAB5C5",
            true,
        ).setOrigin(1, 0);
    }

    private refreshHUD(): void {
        const m = Math.floor(Math.ceil(this.secondsLeft) / 60)
            .toString()
            .padStart(2, "0");
        const s = (Math.ceil(this.secondsLeft) % 60)
            .toString()
            .padStart(2, "0");
        this.status?.setText(
            `SIGILS ${this.solved.size}/3  FILES ${this.readEvidence.size}/9  ${m}:${s}`,
        );
        this.hpFill?.setScale(Phaser.Math.Clamp(this.hp / MAX_HP, 0, 1), 1);
        this.hpLabel?.setText(`${Math.max(0, this.hp)} / ${MAX_HP}`);
    }

    private message(value: string, color = "#55E8D5"): void {
        this.toast?.setColor(color).setText(value);
    }

    private text(
        root: Phaser.GameObjects.Container,
        x: number,
        y: number,
        value: string,
        size: number,
        color: string,
        pixel = true,
        wrapWidth = 0,
    ): Phaser.GameObjects.Text {
        const obj = this.add.text(x, y, value, {
            fontFamily: pixel ? FONT : BODY,
            fontSize: `${size}px`,
            color,
            lineSpacing: pixel ? 6 : 7,
            ...(wrapWidth
                ? { wordWrap: { width: wrapWidth, useAdvancedWrap: true } }
                : {}),
        });
        root.add(obj);
        return obj;
    }

    private newModal(
        kind: ModalKind,
        title: string,
        kicker: string,
    ): Phaser.GameObjects.Container {
        this.overlay?.destroy(true);
        this.phase = "modal";
        this.overlayMode = kind;
        this.player?.sprite.setVelocity(0, 0);
        this.worldPrompt?.setVisible(false);
        if (!this.uiRoot) throw new Error("Quest Finding HUD is not ready");
        const root = this.add.container(0, 0);
        this.uiRoot.add(root);
        this.overlay = root;
        const frame = this.add.graphics();
        frame.fillStyle(0x020611, 0.85).fillRect(0, 0, 1024, 768);
        frame.fillStyle(0x020611, 0.45).fillRect(160, 126, 713, 535);
        frame.fillStyle(0xfbbf24).fillRect(164, 122, 696, 524);
        frame.fillStyle(0x081629).fillRect(169, 127, 686, 514);
        frame.fillStyle(0x16334e).fillRect(180, 138, 664, 492);
        frame.fillStyle(0x55e8d5).fillRect(200, 204, 624, 2);
        root.add(frame);
        this.text(root, 200, 160, kicker, 9, "#7DD3FC", true);
        this.text(root, 200, 185, title, 14, "#FBBF24", true);
        return root;
    }

    private button(
        root: Phaser.GameObjects.Container,
        x: number,
        y: number,
        w: number,
        h: number,
        label: string,
        action: () => void,
        accent = 0x55e8d5,
        small = false,
    ): void {
        const bg = this.add
            .rectangle(x, y, w, h, 0x10263c)
            .setOrigin(0)
            .setStrokeStyle(2, accent)
            .setInteractive({ useHandCursor: true });
        bg.on("pointerover", () => bg.setFillStyle(0x23526e));
        bg.on("pointerout", () => bg.setFillStyle(0x10263c));
        bg.on("pointerdown", action);
        root.add(bg);
        this.text(
            root,
            x + w / 2,
            y + h / 2,
            label,
            small ? 8 : 10,
            "#E2E8F0",
        ).setOrigin(0.5);
    }

    private closeModal(): void {
        if (this.phase !== "modal") return;
        this.overlay?.destroy(true);
        this.overlay = undefined;
        this.overlayMode = undefined;
        this.feedback = undefined;
        this.vaultSlots = undefined;
        this.phase = "explore";
    }

    private showNote(spec: ArchiveInteractable): void {
        const root = this.newModal(
            "note",
            spec.title,
            "CAMPUSBOUNTY FIELD GUIDE",
        );
        this.text(root, 205, 245, spec.body ?? "", 22, "#E2E8F0", false, 610);
        this.text(
            root,
            205,
            510,
            "TIP: J OPENS YOUR EVIDENCE JOURNAL AT ANY TIME.",
            9,
            "#7DD3FC",
        );
        this.button(root, 360, 560, 300, 48, "BACK TO EXPLORING", () =>
            this.closeModal(),
        );
    }

    private showEvidence(spec: ArchiveInteractable): void {
        this.currentEvidence = spec;
        const root = this.newModal(
            "evidence",
            spec.title,
            "EVIDENCE DISCOVERED",
        );
        this.text(root, 205, 238, spec.body ?? "", 23, "#E2E8F0", false, 612);
        const already = this.readEvidence.has(spec.id);
        this.text(
            root,
            205,
            464,
            already
                ? "ALREADY LOGGED"
                : "READ THE EVIDENCE. LOG IT TO YOUR JOURNAL.",
            9,
            already ? "#55E8D5" : "#FBBF24",
        );
        this.button(
            root,
            355,
            539,
            310,
            58,
            already ? "CONTINUE" : "LOG EVIDENCE  [ENTER]",
            () => this.logCurrentEvidence(),
        );
    }

    private logCurrentEvidence(): void {
        const spec = this.currentEvidence;
        if (!spec || this.phase !== "modal" || this.overlayMode !== "evidence")
            return;
        this.readEvidence.add(spec.id);
        this.closeModal();
        const progress = spec.district ? this.evidenceCount(spec.district) : 0;
        this.message(
            `${spec.title} logged! ${progress}/${EVIDENCE_PER_DISTRICT} pieces found in this district.`,
        );
        this.refreshHUD();
    }

    private evidenceCount(district: DistrictId): number {
        return INTERACTABLES.filter(
            (s) =>
                s.kind === "evidence" &&
                s.district === district &&
                this.readEvidence.has(s.id),
        ).length;
    }

    private showTerminal(district: DistrictId): void {
        this.currentDistrict = district;
        const name = ARCHIVE.districts[district].name;
        const found = this.evidenceCount(district);
        const stage = this.stage[district];
        const root = this.newModal("terminal", name, "DEDUCTION CONSOLE");
        if (this.solved.has(district)) {
            this.text(
                root,
                205,
                260,
                `Both decisions passed. Your recovered cipher sigil is ${ARCHIVE.districts[district].digit}.`,
                23,
                "#55E8D5",
                false,
                600,
            );
            this.button(root, 354, 520, 310, 56, "CONTINUE", () =>
                this.closeModal(),
            );
            return;
        }
        if (found < EVIDENCE_PER_DISTRICT) {
            this.text(
                root,
                205,
                245,
                `ACCESS LOCKED. You have inspected ${found}/${EVIDENCE_PER_DISTRICT} files in this department. Find ALL THREE records to unlock the two reasoning checks.`,
                23,
                "#E2E8F0",
                false,
                600,
            );
            this.button(root, 355, 535, 310, 52, "SEARCH FOR EVIDENCE", () =>
                this.closeModal(),
            );
            return;
        }
        const puzzle = this.cases.puzzles[district][stage];
        this.text(
            root,
            204,
            217,
            `REASONING CHECK ${stage + 1} OF 2`,
            9,
            "#FBBF24",
            true,
        );
        this.text(root, 204, 241, puzzle.question, 18, "#E2E8F0", false, 615);
        puzzle.options.forEach((choice, index) => {
            const option = `${index + 1}. ${choice}`;
            this.optionButton(
                root,
                198,
                332 + index * 61,
                628,
                51,
                option,
                () => this.chooseAnswer(index),
            );
        });
        this.feedback = this.text(
            root,
            204,
            531,
            "USE ALL THREE RECORDS TO REASON SAFELY.",
            16,
            "#7DD3FC",
            false,
            616,
        );
        this.text(
            root,
            204,
            611,
            "PRESS 1 / 2 / 3  OR CLICK AN ANSWER",
            8,
            "#94A3B8",
        );
    }

    private optionButton(
        root: Phaser.GameObjects.Container,
        x: number,
        y: number,
        w: number,
        h: number,
        label: string,
        action: () => void,
    ): void {
        const bg = this.add
            .rectangle(x, y, w, h, 0x10263c)
            .setOrigin(0)
            .setStrokeStyle(1, 0x65869e)
            .setInteractive({ useHandCursor: true });
        bg.on("pointerover", () => bg.setFillStyle(0x21516b));
        bg.on("pointerout", () => bg.setFillStyle(0x10263c));
        bg.on("pointerdown", action);
        root.add(bg);
        this.text(root, x + 12, y + 11, label, 17, "#E2E8F0", false, w - 24);
    }

    private chooseAnswer(index: number): void {
        const district = this.currentDistrict;
        if (
            !district ||
            this.phase !== "modal" ||
            this.overlayMode !== "terminal" ||
            this.solved.has(district) ||
            this.evidenceCount(district) < EVIDENCE_PER_DISTRICT
        )
            return;
        const stage = this.stage[district];
        const puzzle = this.cases.puzzles[district][stage];
        if (index === puzzle.answer) {
            if (stage === 0) {
                this.stage[district] = 1;
                const root = this.newModal(
                    "note",
                    "FIRST CHECK PASSED",
                    "ANALYSIS / 1 OF 2",
                );
                this.text(
                    root,
                    207,
                    249,
                    puzzle.explanation,
                    21,
                    "#E2E8F0",
                    false,
                    610,
                );
                this.text(
                    root,
                    207,
                    404,
                    "One more decision is required before the department releases its cipher sigil.",
                    17,
                    "#7DD3FC",
                    false,
                    605,
                );
                this.button(
                    root,
                    357,
                    550,
                    310,
                    52,
                    "NEXT REASONING CHECK",
                    () => this.showTerminal(district),
                );
                return;
            }
            this.solved.add(district);
            const spec = INTERACTABLES.find(
                (s) => s.id === ARCHIVE.districts[district].terminal,
            );
            if (spec) this.checkpoint.set(spec.x, spec.y + 92);
            this.overlay?.destroy(true);
            this.overlay = undefined;
            const root = this.newModal(
                "note",
                "CIPHER SIGIL RECOVERED",
                "DEDUCTION COMPLETE",
            );
            this.text(
                root,
                208,
                238,
                puzzle.explanation,
                21,
                "#E2E8F0",
                false,
                610,
            );
            this.text(
                root,
                208,
                358,
                `YOUR ${district.toUpperCase()} SIGIL: ${ARCHIVE.districts[district].digit}`,
                12,
                "#FBBF24",
            );
            this.text(
                root,
                208,
                413,
                "Department verified. This sigil will appear in your field journal.",
                17,
                "#7DD3FC",
                false,
                600,
            );
            this.button(root, 354, 543, 310, 55, "KEEP EXPLORING", () =>
                this.closeModal(),
            );
            this.refreshHUD();
            return;
        }
        const key = `${district}:${stage}:${index}`;
        if (this.wrongAnswers.has(key)) return;
        this.wrongAnswers.add(key);
        this.hp -= 1;
        this.secondsLeft = Math.max(0, this.secondsLeft - 12);
        this.feedback
            ?.setText(`${puzzle.wrong[index]}  (-1 HP, -12s)`)
            .setColor("#FB7185");
        this.refreshHUD();
        if (this.hp <= 0 || this.secondsLeft <= 0)
            this.endExpedition(false, "THE CONSOLE OVERLOADED");
    }

    private showJournal(): void {
        const root = this.newModal(
            "journal",
            "FIELD JOURNAL",
            "EVIDENCE / SKILLS / CIPHER",
        );
        this.text(
            root,
            204,
            226,
            `SEED ${this.seed}. Find THREE files per department and solve TWO questions per terminal. Clicking a drone twice disables it. The vault code changes every run.`,
            20,
            "#E2E8F0",
            false,
            613,
        );
        for (let i = 0; i < DISTRICTS.length; i++) {
            const district = DISTRICTS[i];
            const done = this.solved.has(district);
            const sigil = done ? ARCHIVE.districts[district].digit : "?";
            this.text(
                root,
                205,
                339 + i * 57,
                `${ARCHIVE.districts[district].sector} / ${ARCHIVE.districts[district].name}: ${this.evidenceCount(district)}/3 FILES | ${this.solved.has(district) ? "CLEAR" : `STEP ${this.stage[district] + 1}/2`} | SIGIL ${sigil}`,
                9,
                done ? "#55E8D5" : "#FDE68A",
            );
        }
        this.text(
            root,
            205,
            516,
            "CIPHER ORDER: SOURCE  ->  AUTHORIZATION  ->  RECOVERY",
            9,
            "#7DD3FC",
        );
        this.button(root, 365, 566, 290, 46, "CLOSE JOURNAL", () =>
            this.closeModal(),
        );
    }

    private showBeacon(): void {
        const root = this.newModal(
            "note",
            "SIGNAL BEACON",
            "OPTIONAL SECRET / OBSERVATORY",
        );
        if (this.beaconUsed) {
            this.text(
                root,
                208,
                257,
                "The station has already dispensed its one-time emergency aid. Its reservoir is empty.",
                22,
                "#E2E8F0",
                false,
                607,
            );
            this.button(root, 354, 538, 310, 52, "CONTINUE", () =>
                this.closeModal(),
            );
            return;
        }
        this.text(
            root,
            208,
            240,
            "You found the Observatory's hidden support station. It can restore 1 HP and 20 seconds, once per expedition. The detour itself costs time.",
            22,
            "#E2E8F0",
            false,
            607,
        );
        this.button(root, 352, 531, 310, 52, "TAKE EMERGENCY AID", () => {
            if (this.beaconUsed) return;
            this.beaconUsed = true;
            this.hp = Math.min(MAX_HP, this.hp + 1);
            this.secondsLeft = Math.min(GAME_SECONDS, this.secondsLeft + 20);
            this.closeModal();
            this.message(
                "Emergency cache used: +1 HP (maximum 5) and +20 seconds.",
            );
            this.refreshHUD();
        });
    }

    private showVault(): void {
        const root = this.newModal(
            "vault",
            "THE CIPHER VAULT",
            "FINAL EXPEDITION PUZZLE",
        );
        if (this.solved.size < 3) {
            this.text(
                root,
                206,
                251,
                `The vault requires THREE cipher sigils. You have recovered ${this.solved.size}/3. Find all 9 files and solve 6 reasoning checks across the building, then return here.`,
                21,
                "#E2E8F0",
                false,
                606,
            );
            this.button(root, 350, 540, 315, 53, "KEEP SEARCHING", () =>
                this.closeModal(),
            );
            return;
        }
        this.text(
            root,
            204,
            225,
            "Enter the THREE discovered sigils in the order printed on the expedition chart:",
            19,
            "#E2E8F0",
            false,
            612,
        );
        this.text(
            root,
            204,
            292,
            "SOURCE   >   AUTHORIZATION   >   RECOVERY",
            9,
            "#FBBF24",
        );
        this.text(
            root,
            204,
            326,
            `YOUR JOURNAL: ${ARCHIVE.districts.source.digit} / ${ARCHIVE.districts.approval.digit} / ${ARCHIVE.districts.recovery.digit}`,
            10,
            "#55E8D5",
        );
        this.vaultInput = "";
        this.vaultSlots = this.text(
            root,
            512,
            367,
            "_   _   _",
            21,
            "#FDE68A",
        ).setOrigin(0.5, 0);
        const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
        digits.forEach((value, i) => {
            const x = 241 + (i % 5) * 111;
            const y = 412 + Math.floor(i / 5) * 45;
            this.button(
                root,
                x,
                y,
                88,
                37,
                value,
                () => this.inputDigit(value),
                0x3b6384,
            );
        });
        this.feedback = this.text(
            root,
            204,
            509,
            "DIGITS + ENTER TO CONFIRM; BACKSPACE TO CORRECT.",
            16,
            "#7DD3FC",
            false,
            605,
        );
        this.button(root, 245, 572, 240, 44, "CLEAR", () => {
            this.vaultInput = "";
            this.syncVaultSlots();
        });
        this.button(
            root,
            535,
            572,
            240,
            44,
            "UNLOCK",
            () => this.verifyVault(),
            0xfbbf24,
        );
    }

    private inputDigit(digit: string): void {
        if (
            this.phase !== "modal" ||
            this.overlayMode !== "vault" ||
            this.solved.size !== 3
        )
            return;
        if (this.vaultInput.length < 3) this.vaultInput += digit;
        this.syncVaultSlots();
    }

    private syncVaultSlots(): void {
        this.vaultSlots?.setText(
            [0, 1, 2].map((i) => this.vaultInput[i] ?? "_").join("   "),
        );
    }

    private verifyVault(): void {
        if (
            this.phase !== "modal" ||
            this.overlayMode !== "vault" ||
            this.solved.size !== 3
        )
            return;
        if (this.vaultInput.length !== 3) {
            this.feedback?.setText("ENTER ALL THREE SIGILS FIRST.");
            return;
        }
        const requiredCode = `${ARCHIVE.districts.source.digit}${ARCHIVE.districts.approval.digit}${ARCHIVE.districts.recovery.digit}`;
        if (this.vaultInput === requiredCode) {
            this.endExpedition(true, "THE LOST KEYS RECOVERED");
            return;
        }
        this.hp -= 1;
        this.secondsLeft = Math.max(0, this.secondsLeft - 20);
        this.vaultInput = "";
        this.syncVaultSlots();
        this.feedback
            ?.setText("WRONG CIPHER ORDER! -1 HP AND -20s.")
            .setColor("#FB7185");
        this.refreshHUD();
        if (this.hp <= 0 || this.secondsLeft <= 0)
            this.endExpedition(false, "THE VAULT REJECTED THE CIPHER");
    }

    private showPause(): void {
        const root = this.newModal(
            "pause",
            "EXPEDITION PAUSED",
            "ARCHIVE OF LOST KEYS",
        );
        this.text(
            root,
            206,
            248,
            "Your progress is retained while this menu is open. Leaving the expedition will abandon this attempt.",
            23,
            "#E2E8F0",
            false,
            600,
        );
        this.text(
            root,
            206,
            396,
            `SIGILS ${this.solved.size}/3   FILES ${this.readEvidence.size}/9   HP ${this.hp}/${MAX_HP}   SEED ${this.seed}`,
            10,
            "#7DD3FC",
        );
        this.button(root, 220, 522, 260, 62, "RESUME", () => this.closeModal());
        this.button(
            root,
            526,
            522,
            278,
            62,
            "RETURN TO HALL",
            () => this.returnToHall(),
            0xfbbf24,
        );
    }

    private endExpedition(success: boolean, headline: string): void {
        if (this.phase === "result") return;
        const reward: QuestFindingReward = success
            ? awardQuestFinding(this)
            : { xp: 0, coins: 0, firstClear: false };
        const session = getGameSession(this);
        this.overlay?.destroy(true);
        const root = this.newModal(
            "result",
            success ? "EXPEDITION COMPLETE" : "EXPEDITION FAILED",
            "ARCHIVE RESULTS",
        );
        this.phase = "result";
        this.worldPrompt?.setVisible(false);
        this.player?.sprite.setVelocity(0, 0);
        this.text(
            root,
            205,
            230,
            headline,
            21,
            success ? "#55E8D5" : "#FB7185",
            false,
            610,
        );
        this.text(
            root,
            205,
            291,
            success
                ? "You investigated nine records, passed six security decisions, survived patrol drones, and decoded the randomized cipher."
                : "Explore carefully, read every record, and use the field journal to solve the vault. You can retry this expedition.",
            20,
            "#E2E8F0",
            false,
            611,
        );
        this.text(
            root,
            205,
            404,
            `FILES ${this.readEvidence.size}/9  |  SIGILS ${this.solved.size}/3  |  DRONES ${this.defeated}  |  HP ${this.hp}  |  TIME ${Math.ceil(this.secondsLeft)}s`,
            9,
            "#7DD3FC",
        );
        this.text(
            root,
            205,
            440,
            success
                ? reward.firstClear
                    ? "+75 XP   +20 GAME COINS (FIRST CLEAR)"
                    : "REPLAY CLEAR: REWARD ALREADY CLAIMED"
                : "NO REWARD — EXPEDITION NOT COMPLETED",
            10,
            success ? "#FBBF24" : "#FB7185",
        );
        this.text(
            root,
            205,
            476,
            `SESSION LVL ${session.level} / ${session.xp} XP / ${session.coins} COINS`,
            9,
            "#94A3B8",
        );
        this.text(
            root,
            205,
            506,
            "Prototype rewards are not real money or blockchain tokens.",
            16,
            "#94A3B8",
            false,
            605,
        );
        this.button(root, 202, 565, 196, 48, "NEW SEED", () =>
            this.scene.restart(),
        );
        this.button(root, 409, 565, 196, 48, "REPLAY SEED", () =>
            this.scene.restart({ seed: this.seed }),
        );
        this.button(
            root,
            616,
            565,
            196,
            48,
            "QUEST HALL",
            () => this.returnToHall(),
            0xfbbf24,
        );
    }

    private returnToHall(): void {
        this.scene.start("Game");
    }
}

