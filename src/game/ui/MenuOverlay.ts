import * as Phaser from "phaser";

/** Display-only progression. The backend / quest system should own real XP. */
export interface PlayerProgress {
    displayName: string;
    level: number;
    xp: number;
    xpToNext: number;
}

export interface MenuOverlayOptions {
    progress?: Partial<PlayerProgress>;
    /** Pass player.sprite.texture.key to show the actual player sprite as the avatar. */
    avatarTextureKey?: string;
    onPauseChanged?: (paused: boolean) => void;
    onReturnToMenu?: () => void;
}

const C = {
    navy: 0x0b1423,
    deep: 0x050a14,
    surface: 0x11243c,
    surfaceAlt: 0x172f4d,
    border: 0x3b6384,
    cyan: 0x7dd3fc,
    cyanBright: 0x38bdf8,
    gold: 0xfbbf24,
    white: 0xe2e8f0,
    muted: 0x94a3b8,
    black: 0x000000,
} as const;

const SCREEN_W = 1024;
const SCREEN_H = 768;
const XP_BAR_W = 198;
const XP_BAR_H = 12;

/** Render text in the existing title-screen pixel font. */
const FONT = '"Press Start 2P", monospace';

type UiContainer = Phaser.GameObjects.Container;

/**
 * HUD + pause/settings interface for the Quest Hall.
 * - Screen-fixed, independent of the world camera and depth sorting.
 * - Esc opens/closes settings (it does NOT return to MainMenu automatically).
 * - Calls onPauseChanged so Game.ts can pause physics and player movement.
 * - Designed for the existing 1024x768 logical resolution.
 *
 * This class intentionally owns display state only. No fake server XP or rewards.
 */
export class MenuOverlay {
    private readonly scene: Phaser.Scene;
    private readonly options: MenuOverlayOptions;
    private readonly hud: UiContainer;
    private readonly modal: UiContainer;

    private readonly xpFill: Phaser.GameObjects.Rectangle;
    private readonly hudLevel: Phaser.GameObjects.Text;
    private readonly hudName: Phaser.GameObjects.Text;
    private readonly hudXp: Phaser.GameObjects.Text;
    private readonly modalProfile: Phaser.GameObjects.Text;
    private readonly modalXp: Phaser.GameObjects.Text;
    private readonly volumeFill: Phaser.GameObjects.Rectangle;
    private readonly volumeLabel: Phaser.GameObjects.Text;
    private readonly muteLabel: Phaser.GameObjects.Text;
    private readonly fullscreenLabel: Phaser.GameObjects.Text;

    private readonly escHandler = () => this.toggleSettings();
    private readonly fullscreenHandler = () => this.refreshFullscreen();

    private progress: PlayerProgress;
    private opened = false;
    private destroyed = false;

    get isOpen(): boolean {
        return this.opened;
    }
    getCameraObjects(): Phaser.GameObjects.GameObject[] {
        return [this.hud, this.modal];
    }

    constructor(scene: Phaser.Scene, options: MenuOverlayOptions = {}) {
        this.scene = scene;
        this.options = options;
        this.progress = {
            displayName: options.progress?.displayName ?? "STUDENT",
            level: Math.max(1, Math.floor(options.progress?.level ?? 1)),
            xp: Math.max(0, Math.floor(options.progress?.xp ?? 0)),
            xpToNext: Math.max(
                1,
                Math.floor(options.progress?.xpToNext ?? 100),
            ),
        };

        this.hud = scene.add.container(0, 0).setScrollFactor(0).setDepth(9000);
        this.modal = scene.add
            .container(0, 0)
            .setScrollFactor(0)
            .setDepth(9100);
        this.modal.setVisible(false);

        // ------------------------------------------------------------------
        // TOP-LEFT PROFILE / XP HUD (width 226, avoids Quest Hall's title).
        // ------------------------------------------------------------------
        this.pixelPanel(this.hud, 16, 12, 226, 110);
        this.pixelPanel(this.hud, 26, 23, 53, 48, C.surfaceAlt, C.border);

        const avatarKey = options.avatarTextureKey;
        if (avatarKey && scene.textures.exists(avatarKey)) {
            const avatar = scene.add.image(52, 46, avatarKey, 0);
            avatar.setDisplaySize(30, 42);
            avatar.setOrigin(0.5);
            this.hud.add(avatar);
        } else {
            // Minimal fallback portrait, so the menu works before Player loads.
            const avatar = scene.add.graphics();
            avatar.fillStyle(0x202b3f);
            avatar.fillRect(41, 29, 24, 10);
            avatar.fillStyle(0xf1c9a3);
            avatar.fillRect(42, 38, 22, 14);
            avatar.fillStyle(0x111827);
            avatar.fillRect(46, 43, 3, 3);
            avatar.fillRect(58, 43, 3, 3);
            avatar.fillStyle(0x60a5fa);
            avatar.fillRect(39, 53, 28, 13);
            avatar.fillStyle(C.gold);
            avatar.fillRect(50, 56, 5, 5);
            this.hud.add(avatar);
        }

        this.hudName = this.text(this.hud, 89, 26, "", 10, "#E2E8F0");
        this.hudLevel = this.text(this.hud, 89, 48, "", 9, "#7DD3FC");

        const settingsButton = this.button(
            this.hud,
            178,
            40,
            54,
            29,
            "SET",
            8,
            () => this.toggleSettings(),
            C.surfaceAlt,
        );
        settingsButton.setStrokeStyle(2, C.gold);

        this.hudXp = this.text(this.hud, 28, 81, "", 8, "#BFDFF5");
        const bg = scene.add.rectangle(28, 98, XP_BAR_W, XP_BAR_H, C.deep);
        bg.setOrigin(0, 0).setStrokeStyle(2, C.border);
        this.hud.add(bg);
        this.xpFill = scene.add.rectangle(
            30,
            100,
            XP_BAR_W - 4,
            XP_BAR_H - 4,
            C.cyan,
        );
        this.xpFill.setOrigin(0, 0);
        this.hud.add(this.xpFill);

        // ------------------------------------------------------------------
        // SETTINGS / PAUSE PANEL
        // ------------------------------------------------------------------
        const dimmer = scene.add.rectangle(
            0,
            0,
            SCREEN_W,
            SCREEN_H,
            C.black,
            0.76,
        );
        dimmer.setOrigin(0).setInteractive(); // Block clicks to the world.
        this.modal.add(dimmer);

        this.pixelPanel(this.modal, 230, 123, 564, 518, C.navy, C.gold);
        this.text(this.modal, 512, 155, "GAME PAUSED", 22, "#FBBF24", 0.5);
        this.text(
            this.modal,
            512,
            190,
            "SETTINGS  /  PLAYER PROFILE",
            10,
            "#94A3B8",
            0.5,
        );
        this.hLine(this.modal, 262, 211, 500, C.border);

        this.pixelPanel(this.modal, 260, 225, 504, 78, C.surface, C.border);
        this.text(this.modal, 278, 241, "ADVENTURER", 10, "#7DD3FC");
        this.modalProfile = this.text(this.modal, 278, 263, "", 11, "#E2E8F0");
        this.modalXp = this.text(this.modal, 278, 283, "", 8, "#94A3B8");

        this.text(this.modal, 264, 326, "MASTER VOLUME", 11, "#FBBF24");
        this.button(this.modal, 264, 348, 43, 36, "-", 16, () =>
            this.changeVolume(-0.1),
        );
        const volTrack = scene.add.rectangle(319, 355, 253, 20, C.deep);
        volTrack.setOrigin(0).setStrokeStyle(2, C.border);
        this.modal.add(volTrack);
        this.volumeFill = scene.add.rectangle(322, 358, 247, 14, C.cyan);
        this.volumeFill.setOrigin(0);
        this.modal.add(this.volumeFill);
        this.button(this.modal, 588, 348, 43, 36, "+", 16, () =>
            this.changeVolume(0.1),
        );
        this.volumeLabel = this.text(
            this.modal,
            678,
            365,
            "",
            10,
            "#E2E8F0",
            0.5,
        );

        const muteButton = this.button(
            this.modal,
            264,
            406,
            238,
            45,
            "",
            10,
            () => {
                this.scene.sound.mute = !this.scene.sound.mute;
                this.refreshAudio();
            },
        );
        this.muteLabel = muteButton.getData("label") as Phaser.GameObjects.Text;

        const fullscreenButton = this.button(
            this.modal,
            522,
            406,
            238,
            45,
            "",
            9,
            () => {
                if (this.scene.scale.isFullscreen) {
                    this.scene.scale.stopFullscreen();
                } else {
                    this.scene.scale.startFullscreen();
                }
                this.refreshFullscreen();
            },
        );
        this.fullscreenLabel = fullscreenButton.getData(
            "label",
        ) as Phaser.GameObjects.Text;

        this.hLine(this.modal, 262, 472, 500, C.border);
        this.text(
            this.modal,
            512,
            491,
            "WASD / ARROWS  -  MOVE",
            10,
            "#94A3B8",
            0.5,
        );
        this.text(
            this.modal,
            512,
            513,
            "ESC  -  RESUME GAME",
            10,
            "#94A3B8",
            0.5,
        );

        this.button(
            this.modal,
            264,
            550,
            240,
            60,
            "RESUME",
            12,
            () => this.closeSettings(),
            C.surfaceAlt,
        );
        this.button(
            this.modal,
            518,
            550,
            242,
            60,
            "MAIN MENU",
            11,
            () => this.returnToMenu(),
            C.surfaceAlt,
        );

        this.scene.input.keyboard?.on("keydown-ESC", this.escHandler);
        this.scene.scale.on("enterfullscreen", this.fullscreenHandler);
        this.scene.scale.on("leavefullscreen", this.fullscreenHandler);
        this.refreshProgress(false);
        this.refreshAudio();
        this.refreshFullscreen();
    }

    /** Refresh the bar from your actual quest/backend progression. */
    setProgress(data: Partial<PlayerProgress>, animate = true): void {
        if (this.destroyed) return;
        this.progress = {
            displayName: data.displayName ?? this.progress.displayName,
            level: Math.max(1, Math.floor(data.level ?? this.progress.level)),
            xp: Math.max(0, Math.floor(data.xp ?? this.progress.xp)),
            xpToNext: Math.max(
                1,
                Math.floor(data.xpToNext ?? this.progress.xpToNext),
            ),
        };
        this.refreshProgress(animate);
    }

    /** Local demo helper only; a trusted quest system must authorize actual XP. */
    addXp(amount: number): void {
        if (this.destroyed || !Number.isFinite(amount) || amount <= 0) return;
        this.progress.xp += Math.floor(amount);
        while (this.progress.xp >= this.progress.xpToNext) {
            this.progress.xp -= this.progress.xpToNext;
            this.progress.level += 1;
            this.progress.xpToNext = 100 + (this.progress.level - 1) * 50;
        }
        this.refreshProgress(true);
    }

    openSettings(): void {
        if (this.destroyed || this.opened) return;
        this.opened = true;
        this.modal.setVisible(true);
        this.refreshAudio();
        this.refreshFullscreen();
        this.options.onPauseChanged?.(true);
    }

    closeSettings(): void {
        if (this.destroyed || !this.opened) return;
        this.opened = false;
        this.modal.setVisible(false);
        this.options.onPauseChanged?.(false);
    }

    toggleSettings(): void {
        if (this.opened) this.closeSettings();
        else this.openSettings();
    }

    destroy(): void {
        if (this.destroyed) return;
        if (this.opened) this.closeSettings();
        this.destroyed = true;
        this.scene.input.keyboard?.off("keydown-ESC", this.escHandler);
        this.scene.scale.off("enterfullscreen", this.fullscreenHandler);
        this.scene.scale.off("leavefullscreen", this.fullscreenHandler);
        this.hud.destroy(true);
        this.modal.destroy(true);
    }

    private returnToMenu(): void {
        // Resume before changing scenes: Arcade Physics must not remain paused.
        this.closeSettings();
        this.options.onReturnToMenu?.();
    }

    private refreshProgress(animate: boolean): void {
        const p = this.progress;
        this.hudName.setText(p.displayName.toUpperCase().slice(0, 10));
        this.hudLevel.setText(`LVL ${String(p.level).padStart(2, "0")}`);
        this.hudXp.setText(`XP  ${p.xp} / ${p.xpToNext}`);
        this.modalProfile.setText(
            `${p.displayName.toUpperCase()}  -  LVL ${p.level}`,
        );
        this.modalXp.setText(`XP ${p.xp} / ${p.xpToNext} TO NEXT LEVEL`);

        const fill = Math.min(1, p.xp / p.xpToNext);
        this.scene.tweens.killTweensOf(this.xpFill);
        if (animate) {
            this.scene.tweens.add({
                targets: this.xpFill,
                scaleX: fill,
                duration: 350,
                ease: "Sine.easeOut",
            });
        } else {
            this.xpFill.setScale(fill, 1);
        }
    }

    private changeVolume(delta: number): void {
        const current = this.scene.sound.volume;
        this.scene.sound.volume = Math.min(
            1,
            Math.max(0, Math.round((current + delta) * 10) / 10),
        );
        this.refreshAudio();
    }

    private refreshAudio(): void {
        const volume = this.scene.sound.volume;
        this.volumeFill.setScale(Math.min(1, Math.max(0, volume)), 1);
        this.volumeLabel.setText(`${Math.round(volume * 100)}%`);
        this.muteLabel.setText(
            this.scene.sound.mute ? "SOUND: OFF" : "SOUND: ON",
        );
    }

    private refreshFullscreen(): void {
        this.fullscreenLabel.setText(
            this.scene.scale.isFullscreen
                ? "FULLSCREEN: ON"
                : "FULLSCREEN: OFF",
        );
    }

    private pixelPanel(
        layer: UiContainer,
        x: number,
        y: number,
        w: number,
        h: number,
        bg: number = C.navy,
        border: number = C.gold,
    ): void {
        const g = this.scene.add.graphics();
        g.fillStyle(C.black, 0.55);
        g.fillRect(x + 5, y + 5, w, h);
        g.fillStyle(border);
        g.fillRect(x, y, w, h);
        g.fillStyle(C.deep);
        g.fillRect(x + 3, y + 3, w - 6, h - 6);
        g.fillStyle(bg);
        g.fillRect(x + 6, y + 6, w - 12, h - 12);
        layer.add(g);
    }

    private hLine(
        layer: UiContainer,
        x: number,
        y: number,
        w: number,
        color: number,
    ): void {
        const g = this.scene.add.graphics();
        g.fillStyle(color);
        g.fillRect(x, y, w, 2);
        layer.add(g);
    }

    private text(
        layer: UiContainer,
        x: number,
        y: number,
        value: string,
        size: number,
        color: string,
        originX = 0,
    ): Phaser.GameObjects.Text {
        const t = this.scene.add.text(x, y, value, {
            fontFamily: FONT,
            fontSize: `${size}px`,
            color,
            resolution: 2,
        });
        t.setOrigin(originX, 0.5);
        layer.add(t);
        return t;
    }

    private button(
        layer: UiContainer,
        x: number,
        y: number,
        w: number,
        h: number,
        label: string,
        size: number,
        action: () => void,
        fill: number = C.surface,
    ): Phaser.GameObjects.Rectangle {
        const bg = this.scene.add.rectangle(x + w / 2, y + h / 2, w, h, fill);
        bg.setStrokeStyle(2, C.border).setInteractive({ useHandCursor: true });
        layer.add(bg);
        const t = this.text(
            layer,
            x + w / 2,
            y + h / 2,
            label,
            size,
            "#E2E8F0",
            0.5,
        );
        bg.setData("label", t);
        bg.on("pointerover", () => bg.setFillStyle(C.surfaceAlt));
        bg.on("pointerout", () => bg.setFillStyle(fill));
        bg.on("pointerdown", action);
        return bg;
    }
}
