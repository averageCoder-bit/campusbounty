import * as Phaser from "phaser";
import { EventBus } from "../EventBus";
import { PixelButtonMenu } from "../ui/PixelButtonMenu";
import { TEX, bakeMenuTextures } from "../ui/Sprites";
import { THEME, prefersReducedMotion, textStyle } from "../ui/Theme";

import "@fontsource/press-start-2p/400.css";
import "@fontsource/vt323/400.css";

const VERSION = "v0.1.0";
const TITLE_LINES = ["CAMPUS", "BOUNTY"] as const;
const FADE_RGB = [11, 20, 35] as const;
const SINE = "Sine.easeInOut";

export class MainMenu extends Phaser.Scene {
    private starting = false;
    private uiBuilt = false;
    private runId = 0;
    private reduceMotion = false;

    private playButton?: PixelButtonMenu;
    private dots?: Phaser.GameObjects.TileSprite;
    private resizeTimer?: Phaser.Time.TimerEvent;

    constructor() {
        super("MainMenu");
    }

    // ==================================================
    // LIFECYCLE
    // ==================================================
    create() {
        this.starting = false;
        this.uiBuilt = false;
        this.reduceMotion = prefersReducedMotion();

        this.cameras.main.setBackgroundColor(THEME.bg);
        this.cameras.main.fadeIn(300, ...FADE_RGB);

        bakeMenuTextures(this);

        // Input
        this.input.keyboard?.on("keydown-ENTER", this.onConfirm);
        this.input.keyboard?.on("keydown-SPACE", this.onConfirm);
        this.input.gamepad?.on(
            Phaser.Input.Gamepad.Events.BUTTON_DOWN,
            this.onPadDown,
        );

        // Layout + cleanup
        this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.teardown);

        // Wait for fonts so canvas text never renders in the fallback face.
        const run = ++this.runId;
        void this.loadFonts().then(() => {
            if (run !== this.runId || !this.sys.isActive()) return;
            this.buildUI();
            this.uiBuilt = true;
        });

        // The React wrapper only needs to know the scene exists.
        EventBus.emit("current-scene-ready", this);
    }

    update(_time: number, delta: number) {
        if (this.dots && !this.reduceMotion) {
            this.dots.tilePositionX += delta * 0.01;
            this.dots.tilePositionY += delta * 0.005;
        }
    }

    private teardown = () => {
        this.runId++;
        this.uiBuilt = false;
        this.input.keyboard?.off("keydown-ENTER", this.onConfirm);
        this.input.keyboard?.off("keydown-SPACE", this.onConfirm);
        this.input.gamepad?.off(
            Phaser.Input.Gamepad.Events.BUTTON_DOWN,
            this.onPadDown,
        );
        this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize);
        this.playButton = undefined;
        this.dots = undefined;
    };

    private async loadFonts() {
        if (typeof document === "undefined" || !document.fonts) return;
        await Promise.allSettled([
            document.fonts.load('16px "Press Start 2P"'),
            document.fonts.load('16px "VT323"'),
        ]);
    }

    // ==================================================
    // INPUT
    // ==================================================
    private onConfirm = () => {
        if (!this.uiBuilt) return;
        this.playButton?.activate();
    };

    private onPadDown = (
        _pad: Phaser.Input.Gamepad.Gamepad,
        button: Phaser.Input.Gamepad.Button,
    ) => {
        if (button.index === 0) this.onConfirm();
    };

    private startGame = () => {
        if (this.starting) return;
        this.starting = true;

        this.cameras.main.fadeOut(300, ...FADE_RGB);
        this.cameras.main.once(
            Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
            () => this.scene.start("Game"),
        );
    };

    // ==================================================
    // RESIZE
    // ==================================================
    private onResize = () => {
        if (!this.uiBuilt) return;
        this.resizeTimer?.remove(false);
        this.resizeTimer = this.time.delayedCall(120, () => {
            if (this.sys.isActive()) this.rebuild();
        });
    };

    private rebuild() {
        this.tweens.killAll();
        this.time.removeAllEvents();
        this.children.removeAll(true);
        this.playButton = undefined;
        this.dots = undefined;
        this.buildUI();
    }

    // ==================================================
    // UI
    // ==================================================
    private buildUI() {
        const { width, height } = this.scale;
        const cx = width / 2;
        const groundY = height - 70;

        this.drawBackground(width, height);
        this.drawHeader(cx, height);
        this.drawTitle(cx, height * 0.32, width);
        this.drawTagline(cx, height);
        this.drawButton(cx, height, width);

        this.drawGround(groundY, width);
        this.drawPoster(cx, groundY);

        // Position characters farther apart
        const characterOffset = width * 0.35;

        this.createPlayer(cx - characterOffset, groundY);
        this.createByte(cx + characterOffset, groundY);

        this.drawFooter(cx, height);
        this.drawOverlay(width, height);
    }

    private drawBackground(width: number, height: number) {
        const cx = width / 2;
        const cy = height / 2;

        this.dots = this.add
            .tileSprite(0, 0, width, height, TEX.dots)
            .setOrigin(0);

        this.add
            .rectangle(cx, cy, width - 24, height - 24)
            .setStrokeStyle(4, THEME.gold, 1);
        this.add
            .rectangle(cx, cy, width - 40, height - 40)
            .setStrokeStyle(2, THEME.gold, 0.75);

        // Kept clear of the characters so nothing overlaps.
        const stars = [
            [0.14, 0.22],
            [0.86, 0.22],
            [0.12, 0.58],
            [0.88, 0.58],
        ] as const;

        stars.forEach(([sx, sy], i) => {
            const star = this.add
                .image(width * sx, height * sy, TEX.star)
                .setScale(4)
                .setAlpha(0.9);

            this.loop({
                targets: star,
                alpha: { from: 0.35, to: 1 },
                duration: 900,
                delay: i * 220,
            });
        });
    }

    private drawHeader(cx: number, height: number) {
        this.add
            .text(
                cx,
                Math.max(64, height * 0.12),
                "BLOCKFORGE PRESENTS",
                textStyle(12, THEME.goldCss),
            )
            .setOrigin(0.5);
    }

    private drawTitle(cx: number, cy: number, width: number) {
        // Press Start 2P advances exactly 1em per glyph, so letters can be
        // placed individually for the wave without measuring text.
        const size = Phaser.Math.Clamp(Math.floor((width - 120) / 6), 24, 64);
        const lineGap = size * 1.3;
        const shadowOffset = Math.round(size / 10);

        TITLE_LINES.forEach((word, row) => {
            const y = cy + (row - 0.5) * lineGap;
            const startX = cx - (word.length * size) / 2 + size / 2;

            [...word].forEach((ch, i) => {
                const x = startX + i * size;

                const shadow = this.add
                    .text(
                        x + shadowOffset,
                        y + shadowOffset,
                        ch,
                        textStyle(size, "#000000"),
                    )
                    .setOrigin(0.5);

                const letter = this.add
                    .text(x, y, ch, {
                        ...textStyle(size, THEME.goldCss),
                        stroke: "#2b1a00",
                        strokeThickness: Math.max(2, Math.round(size / 16)),
                    })
                    .setOrigin(0.5);

                this.loop({
                    targets: [shadow, letter],
                    y: "-=4",
                    duration: 1000,
                    delay: (row * 6 + i) * 80,
                    ease: SINE,
                });
            });
        });
    }

    private drawTagline(cx: number, height: number) {
        this.add
            .text(
                cx,
                height * 0.5,
                "LEVEL UP YOUR SKILLS",
                textStyle(18, THEME.textLight),
            )
            .setOrigin(0.5);

        this.add
            .text(
                cx,
                height * 0.55,
                "UNLOCK REAL OPPORTUNITIES",
                textStyle(28, THEME.muted, THEME.fontBody),
            )
            .setOrigin(0.5);
    }

    private drawButton(cx: number, height: number, width: number) {
        const y = height * 0.64;
        const buttonWidth = Math.min(360, width - 80);

        this.playButton = new PixelButtonMenu(
            this,
            cx,
            y,
            buttonWidth,
            74,
            "START ADVENTURE",
            this.startGame,
        );

        // The hint blinks; the button itself stays solid.
        const hint = this.add
            .text(
                cx,
                y + 62,
                "PRESS ENTER  OR  CLICK",
                textStyle(10, THEME.goldCss),
            )
            .setOrigin(0.5);

        this.loop({ targets: hint, alpha: 0.35, duration: 650 });
    }

    private drawGround(y: number, sceneWidth: number) {
        const g = this.add.graphics();

        // Keep the platform inside the gold frame
        const inset = 24;
        const left = inset;
        const right = sceneWidth - inset;
        const groundWidth = right - left;

        // Leave room for the bottom gold border
        const bottom = this.scale.height - 28;

        const grassHeight = 10;
        const dirtTop = y + grassHeight;
        const dirtHeight = Math.max(0, bottom - dirtTop);

        // =====================================
        // GRASS TOP
        // =====================================

        g.fillStyle(0x4ade80, 1);
        g.fillRect(left, y, groundWidth, grassHeight);

        // Pixel grass tufts
        g.fillStyle(0x22c55e, 1);

        for (let x = left + 4; x < right - 6; x += 12) {
            g.fillRect(x, y - 4, 6, 4);
        }

        // =====================================
        // DIRT PLATFORM
        // =====================================

        g.fillStyle(0x92400e, 1);
        g.fillRect(left, dirtTop, groundWidth, dirtHeight);

        // Darker base
        g.fillStyle(0x78350f, 1);
        g.fillRect(left, bottom - 4, groundWidth, 4);

        // Pixel dirt texture
        g.fillStyle(0xb45309, 1);

        for (let x = left + 8; x < right - 8; x += 18) {
            for (let dy = 6; dy < dirtHeight - 6; dy += 10) {
                const offset = ((dy / 10) % 2) * 4;

                if (x + offset + 6 <= right) {
                    g.fillRect(x + offset, dirtTop + dy, 6, 4);
                }
            }
        }
    }

    private drawPoster(cx: number, groundY: number) {
        // Says "bounty" at a glance.
        this.add
            .image(cx, groundY + 2, TEX.poster)
            .setOrigin(0.5, 1)
            .setScale(4);
    }

    private createPlayer(x: number, groundY: number) {
        const body = this.add.container(x, groundY + 4);

        const sprite = this.add
            .image(0, 0, TEX.player)
            .setOrigin(0.5, 1)
            .setScale(10);

        // Floating coin that flips as it bobs.
        const coin = this.add
            .image(0, -sprite.displayHeight - 28, TEX.coin)
            .setScale(4);

        body.add([sprite, coin]);
        this.addLabel(x, groundY + 24, "PLAYER");

        this.loop({ targets: body, y: "-=5", duration: 900, ease: SINE });
        this.loop({
            targets: coin,
            y: "-=8",
            scaleX: { from: 4, to: 0.8 },
            duration: 600,
            delay: 150,
            ease: SINE,
        });
    }

    private createByte(x: number, groundY: number) {
        const body = this.add.container(x, groundY - 20);

        const sprite = this.add
            .image(0, 0, TEX.byte)
            .setOrigin(0.5, 1)
            .setScale(5);

        // Classic RPG "I have a quest" marker.
        const marker = this.add
            .image(0, -sprite.displayHeight - 14, TEX.quest)
            .setOrigin(0.5, 1)
            .setScale(5);

        body.add([sprite, marker]);
        this.addLabel(x, groundY + 24, "BYTE");

        // Different duration and delay than the player so the bobbing never syncs.
        this.loop({
            targets: body,
            y: "-=5",
            duration: 1100,
            delay: 300,
            ease: SINE,
        });
        this.loop({
            targets: marker,
            y: "-=6",
            duration: 450,
            ease: "Quad.easeOut",
        });

        this.scheduleBlink(sprite);
    }

    private scheduleBlink(sprite: Phaser.GameObjects.Image) {
        if (this.reduceMotion) return;

        this.time.delayedCall(Phaser.Math.Between(2000, 4000), () => {
            if (!sprite.active) return;
            sprite.setTexture(TEX.byteBlink);

            this.time.delayedCall(110, () => {
                if (!sprite.active) return;
                sprite.setTexture(TEX.byte);
                this.scheduleBlink(sprite);
            });
        });
    }

    private addLabel(x: number, y: number, text: string) {
        return this.add
            .text(x, y, text, textStyle(10, THEME.goldCss))
            .setOrigin(0.5);
    }

    private drawFooter(cx: number, height: number) {
        this.add
            .text(
                cx,
                height * 0.94,
                `${VERSION}   /   \u00A9 BLOCKFORGE`,
                textStyle(10, THEME.textLight),
            )
            .setOrigin(0.5);
    }

    /** Vignette + faint scanlines, drawn once into a canvas texture. */
    private drawOverlay(width: number, height: number) {
        const key = "cb-overlay";
        if (this.textures.exists(key)) this.textures.remove(key);

        const tex = this.textures.createCanvas(key, width, height);
        if (!tex) return;

        const ctx = tex.getContext();
        const minSide = Math.min(width, height);
        const maxSide = Math.max(width, height);

        const gradient = ctx.createRadialGradient(
            width / 2,
            height / 2,
            minSide * 0.35,
            width / 2,
            height / 2,
            maxSide * 0.75,
        );
        gradient.addColorStop(0, "rgba(0,0,0,0)");
        gradient.addColorStop(1, "rgba(0,0,0,0.55)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = "rgba(0,0,0,0.10)";
        for (let y = 0; y < height; y += 4) {
            ctx.fillRect(0, y, width, 1);
        }
        tex.refresh();

        this.add.image(0, 0, key).setOrigin(0).setDepth(1000);
    }

    // ==================================================
    // HELPERS
    // ==================================================
    /** Yoyo-forever tween that is skipped when the user prefers reduced motion. */
    private loop(config: Phaser.Types.Tweens.TweenBuilderConfig) {
        if (this.reduceMotion) return undefined;
        return this.tweens.add({ ...config, yoyo: true, repeat: -1 });
    }
}
