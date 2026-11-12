import * as Phaser from "phaser";

/** The quest system/backend should be the source of truth for earned XP. */
export interface PlayerProgress {
    displayName: string;
    level: number;
    xp: number;
    xpToNext: number;
}

export interface MenuOverlayOptions {
    progress?: Partial<PlayerProgress>;
    /** Reuse the player's existing sprite texture for the profile portrait. */
    avatarTextureKey?: string;
    onPauseChanged?: (paused: boolean) => void;
    onReturnToMenu?: () => void;
    /** Prevent Settings from opening over dialogue, the Quest Board, or a portal. */
    canToggleSettings?: () => boolean;
}

const COLORS = {
    bg: 0x080f20,
    panel: 0x0b172b,
    panelRaised: 0x122742,
    panelHover: 0x1a3858,
    shadow: 0x030713,
    border: 0x45647e,
    gold: 0xf5ba47,
    goldLight: 0xffdc8b,
    sky: 0x77d9f7,
    track: 0x07121e,
    white: 0xe6f2ff,
    muted: 0x96b3cd,
} as const;

const FONT = '"Press Start 2P", monospace';
const WIDTH = 1024;
const HEIGHT = 768;
const XP_FILL_WIDTH = 192;

type Layer = Phaser.GameObjects.Container;

type ButtonRef = {
    shape: Phaser.GameObjects.Rectangle;
    normal: number;
    hover: number;
    border: number;
    action: () => void;
};

/**
 * CampusBounty HUD + pause menu.
 *
 * Lightweight by design:
 * - One static Graphics object for each panel's decorations.
 * - No per-frame drawing, particles, idle tweens, or delayed UI timers.
 * - Pause menu visibility is immediate, even if Game.ts pauses scene tweens.
 * - Compatible with the separate HUD camera used in Game.ts.
 */
export class MenuOverlay {
    private readonly scene: Phaser.Scene;
    private readonly options: MenuOverlayOptions;
    private readonly hud: Layer;
    private readonly modal: Layer;

    private readonly hudName: Phaser.GameObjects.Text;
    private readonly hudLevel: Phaser.GameObjects.Text;
    private readonly hudXp: Phaser.GameObjects.Text;
    private readonly hudFill: Phaser.GameObjects.Rectangle;

    private readonly profileName: Phaser.GameObjects.Text;
    private readonly profileLevel: Phaser.GameObjects.Text;
    private readonly profileXp: Phaser.GameObjects.Text;
    private readonly profileFill: Phaser.GameObjects.Rectangle;

    private readonly volumeFill: Phaser.GameObjects.Rectangle;
    private readonly volumeLabel: Phaser.GameObjects.Text;
    private readonly soundLabel: Phaser.GameObjects.Text;
    private readonly fullscreenLabel: Phaser.GameObjects.Text;

    private readonly buttons: ButtonRef[] = [];
    private focusIndex = -1;
    private progress: PlayerProgress;
    private opened = false;
    private destroyed = false;

    private readonly keyHandler = (event: KeyboardEvent): void => {
        if (this.destroyed) return;

        if (event.code === "Escape") {
            if (event.repeat) return;
            event.preventDefault();
            this.toggleSettings();
            return;
        }

        if (!this.opened) return;

        if (event.code === "ArrowUp" || event.code === "KeyW") {
            this.focusBy(-1);
        } else if (event.code === "ArrowDown" || event.code === "KeyS") {
            this.focusBy(1);
        } else if (event.code === "ArrowLeft" || event.code === "KeyA") {
            this.changeVolume(-0.1);
        } else if (event.code === "ArrowRight" || event.code === "KeyD") {
            this.changeVolume(0.1);
        } else if (
            (event.code === "Enter" ||
                event.code === "NumpadEnter" ||
                event.code === "Space") &&
            !event.repeat
        ) {
            this.buttons[this.focusIndex]?.action();
        } else {
            return;
        }
        event.preventDefault();
    };

    private readonly fullscreenHandler = (): void => this.refreshFullscreen();

    get isOpen(): boolean {
        return this.opened;
    }

    /** Game.ts uses this to keep the entire UI on the unzoomed HUD camera. */
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

        // Two containers only: fixed player HUD and above-everything pause panel.
        this.hud = scene.add.container(0, 0).setDepth(9000).setScrollFactor(0);
        this.modal = scene.add
            .container(0, 0)
            .setDepth(20000)
            .setScrollFactor(0);
        this.modal.setVisible(false);

        // ---------------- HUD (16,12 .. 242,122) ----------------
        const hudArt = scene.add.graphics();
        this.drawPanel(hudArt, 16, 12, 226, 110, COLORS.bg, COLORS.gold);
        this.drawPanel(
            hudArt,
            26,
            23,
            53,
            49,
            COLORS.panelRaised,
            COLORS.border,
        );
        this.hud.add(hudArt);
        this.addAvatar(this.hud, 52, 47, 30, 42);

        this.hudName = this.addText(this.hud, 89, 31, "", 10, "#E6F2FF");
        this.hudLevel = this.addText(this.hud, 89, 54, "", 9, "#77D9F7");
        this.addButton(
            this.hud,
            179,
            40,
            52,
            29,
            "SET",
            8,
            () => this.toggleSettings(),
            {
                normal: COLORS.panelRaised,
                hover: COLORS.panelHover,
                border: COLORS.gold,
            },
            false,
        );

        this.hudXp = this.addText(this.hud, 28, 82, "", 8, "#B9DFF0");
        this.drawTrack(this.hud, 28, 99, 198, 12);
        this.hudFill = this.addFill(this.hud, 31, 102, XP_FILL_WIDTH, 6);

        // ---------------- Pause menu background ----------------
        const dimmer = scene.add
            .rectangle(0, 0, WIDTH, HEIGHT, 0x000000, 0.73)
            .setOrigin(0)
            .setInteractive();
        this.modal.add(dimmer);

        // All framing, accent lines and boxes are batched into ONE static Graphics.
        const art = scene.add.graphics();
        this.drawPanel(
            art,
            216,
            102,
            592,
            563,
            COLORS.panel,
            COLORS.gold,
            true,
        );
        this.drawPanel(
            art,
            244,
            216,
            536,
            100,
            COLORS.panelRaised,
            COLORS.border,
        );
        this.drawPanel(art, 256, 228, 60, 60, COLORS.panel, COLORS.border);
        this.drawLine(art, 244, 199, 536, COLORS.border);
        this.drawLine(art, 244, 358, 536, COLORS.border);
        this.drawLine(art, 244, 510, 536, COLORS.border);
        this.drawLine(art, 244, 578, 536, COLORS.border);
        this.modal.add(art);

        // Header
        this.addText(this.modal, 512, 147, "GAME PAUSED", 22, "#F5BA47", 0.5);
        this.addText(
            this.modal,
            512,
            182,
            "CAMPUSBOUNTY  /  SETTINGS",
            9,
            "#96B3CD",
            0.5,
        );
        this.addText(this.modal, 252, 210, "PLAYER PROFILE", 8, "#77D9F7");

        // Profile: uses the same real player sprite as the HUD.
        this.addAvatar(this.modal, 286, 259, 36, 48);
        this.profileName = this.addText(
            this.modal,
            331,
            244,
            "",
            12,
            "#E6F2FF",
        );
        this.profileLevel = this.addText(
            this.modal,
            761,
            244,
            "",
            10,
            "#77D9F7",
            1,
        );
        this.profileXp = this.addText(this.modal, 331, 275, "", 8, "#96B3CD");
        this.drawTrack(this.modal, 331, 290, 426, 12);
        this.profileFill = this.addFill(this.modal, 334, 293, 420, 6);

        // Settings: direct controls (no nested panels or animations).
        this.addText(this.modal, 248, 342, "AUDIO & DISPLAY", 10, "#F5BA47");
        this.addText(this.modal, 251, 392, "VOLUME", 10, "#E6F2FF");
        this.addButton(this.modal, 387, 376, 42, 36, "-", 14, () =>
            this.changeVolume(-0.1),
        );
        this.drawTrack(this.modal, 445, 388, 191, 13);
        this.volumeFill = this.addFill(this.modal, 448, 391, 185, 7);
        this.addButton(this.modal, 648, 376, 42, 36, "+", 14, () =>
            this.changeVolume(0.1),
        );
        this.volumeLabel = this.addText(
            this.modal,
            758,
            394,
            "",
            9,
            "#E6F2FF",
            1,
        );

        this.soundLabel = this.addText(
            this.modal,
            375,
            466,
            "",
            9,
            "#E6F2FF",
            0.5,
        );
        this.addButton(
            this.modal,
            244,
            438,
            262,
            53,
            "",
            9,
            () => {
                scene.sound.mute = !scene.sound.mute;
                this.refreshAudio();
            },
            undefined,
            true,
            this.soundLabel,
        );

        this.fullscreenLabel = this.addText(
            this.modal,
            645,
            466,
            "",
            9,
            "#E6F2FF",
            0.5,
        );
        this.addButton(
            this.modal,
            518,
            438,
            262,
            53,
            "",
            9,
            () => {
                if (scene.scale.isFullscreen) scene.scale.stopFullscreen();
                else scene.scale.startFullscreen();
                this.refreshFullscreen();
            },
            undefined,
            true,
            this.fullscreenLabel,
        );

        this.addText(
            this.modal,
            512,
            530,
            "WASD MOVE    E INTERACT    ESC RESUME",
            9,
            "#96B3CD",
            0.5,
        );
        this.addText(
            this.modal,
            512,
            557,
            "UP / DOWN SELECT  -  ENTER CONFIRM",
            8,
            "#96B3CD",
            0.5,
        );

        this.addButton(
            this.modal,
            244,
            596,
            262,
            53,
            "RESUME",
            12,
            () => this.closeSettings(),
            {
                normal: COLORS.gold,
                hover: COLORS.goldLight,
                border: COLORS.goldLight,
                text: "#101b2b",
            },
        );
        this.addButton(
            this.modal,
            518,
            596,
            262,
            53,
            "MAIN MENU",
            11,
            () => this.returnToMenu(),
            {
                normal: COLORS.panelRaised,
                hover: COLORS.panelHover,
                border: COLORS.sky,
            },
        );

        // Input: one listener, installed once, removed at shutdown.
        scene.input.keyboard?.on("keydown", this.keyHandler);
        scene.scale.on("enterfullscreen", this.fullscreenHandler);
        scene.scale.on("leavefullscreen", this.fullscreenHandler);

        this.refreshProgress(false);
        this.refreshAudio();
        this.refreshFullscreen();
    }

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

    /** Demo helper; quest validation must authorize real XP. */
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
        if (this.options.canToggleSettings?.() === false) return;

        this.opened = true;
        // Show immediately: Game.ts freezes scene tweens in onPauseChanged.
        this.modal.setAlpha(1).setVisible(true).setDepth(20000);
        this.scene.children.bringToTop(this.modal);
        this.focus(4); // Default to Resume, not an audio control.
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
        this.scene.input.keyboard?.off("keydown", this.keyHandler);
        this.scene.scale.off("enterfullscreen", this.fullscreenHandler);
        this.scene.scale.off("leavefullscreen", this.fullscreenHandler);
        this.scene.tweens.killTweensOf([this.hudFill, this.profileFill]);
        this.hud.destroy(true);
        this.modal.destroy(true);
    }

    private returnToMenu(): void {
        this.closeSettings();
        this.options.onReturnToMenu?.();
    }

    private focus(index: number): void {
        if (this.buttons.length === 0) return;
        this.focusIndex = (index + this.buttons.length) % this.buttons.length;
        this.buttons.forEach((b, i) => {
            const selected = i === this.focusIndex;
            b.shape.setFillStyle(selected ? b.hover : b.normal);
            b.shape.setStrokeStyle(
                selected ? 3 : 2,
                selected ? COLORS.goldLight : b.border,
            );
        });
    }

    private focusBy(direction: number): void {
        this.focus(this.focusIndex + direction);
    }

    private refreshProgress(animate: boolean): void {
        const p = this.progress;
        const name = p.displayName.toUpperCase().slice(0, 12);
        this.hudName.setText(name.slice(0, 8));
        this.hudLevel.setText(`LVL ${String(p.level).padStart(2, "0")}`);
        this.hudXp.setText(`XP ${p.xp} / ${p.xpToNext}`);
        this.profileName.setText(name);
        this.profileLevel.setText(`LEVEL ${p.level}`);
        this.profileXp.setText(`XP ${p.xp} / ${p.xpToNext}  TO NEXT LEVEL`);

        const fill = Phaser.Math.Clamp(p.xp / p.xpToNext, 0, 1);
        this.scene.tweens.killTweensOf([this.hudFill, this.profileFill]);
        if (animate && !this.opened) {
            this.scene.tweens.add({
                targets: [this.hudFill, this.profileFill],
                scaleX: fill,
                duration: 240,
                ease: "Sine.easeOut",
            });
        } else {
            this.hudFill.setScale(fill, 1);
            this.profileFill.setScale(fill, 1);
        }
    }

    private changeVolume(delta: number): void {
        this.scene.sound.volume = Phaser.Math.Clamp(
            Math.round((this.scene.sound.volume + delta) * 10) / 10,
            0,
            1,
        );
        this.refreshAudio();
    }

    private refreshAudio(): void {
        const volume = Phaser.Math.Clamp(this.scene.sound.volume, 0, 1);
        this.volumeFill.setScale(volume, 1);
        this.volumeLabel.setText(`${Math.round(volume * 100)}%`);
        this.soundLabel.setText(
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

    private addAvatar(
        layer: Layer,
        x: number,
        y: number,
        w: number,
        h: number,
    ): void {
        const key = this.options.avatarTextureKey;
        if (key && this.scene.textures.exists(key)) {
            const avatar = this.scene.add.image(x, y, key, 0);
            avatar.setDisplaySize(w, h);
            layer.add(avatar);
            return;
        }

        // Minimal fallback avatar; drawn once.
        const g = this.scene.add.graphics();
        g.fillStyle(0x17293f).fillRect(-12, -18, 24, 8);
        g.fillStyle(0xf1c9a3).fillRect(-11, -10, 22, 15);
        g.fillStyle(0x17293f).fillRect(-7, -5, 4, 4).fillRect(4, -5, 4, 4);
        g.fillStyle(0x60a5fa).fillRect(-14, 5, 28, 14);
        g.fillStyle(COLORS.gold).fillRect(-2, 8, 5, 5);
        g.setPosition(x, y);
        layer.add(g);
    }

    private addText(
        layer: Layer,
        x: number,
        y: number,
        content: string,
        size: number,
        color: string,
        originX = 0,
    ): Phaser.GameObjects.Text {
        const t = this.scene.add.text(x, y, content, {
            fontFamily: FONT,
            fontSize: `${size}px`,
            color,
            resolution: 2,
        });
        t.setOrigin(originX, 0.5);
        layer.add(t);
        return t;
    }

    private addButton(
        layer: Layer,
        x: number,
        y: number,
        w: number,
        h: number,
        label: string,
        size: number,
        action: () => void,
        style: {
            normal: number;
            hover: number;
            border: number;
            text?: string;
        } = {
            normal: COLORS.panelRaised,
            hover: COLORS.panelHover,
            border: COLORS.border,
        },
        keyboardFocus = true,
        externalLabel?: Phaser.GameObjects.Text,
    ): Phaser.GameObjects.Rectangle {
        const rect = this.scene.add.rectangle(
            x + w / 2,
            y + h / 2,
            w,
            h,
            style.normal,
        );
        rect.setStrokeStyle(2, style.border).setInteractive({
            useHandCursor: true,
        });
        layer.add(rect);
        if (!externalLabel) {
            this.addText(
                layer,
                x + w / 2,
                y + h / 2,
                label,
                size,
                style.text ?? "#E6F2FF",
                0.5,
            );
        } else {
            // The dynamic label was created first; keep it above the button surface.
            layer.bringToTop(externalLabel);
        }
        if (keyboardFocus) {
            const index = this.buttons.length;
            this.buttons.push({
                shape: rect,
                normal: style.normal,
                hover: style.hover,
                border: style.border,
                action,
            });
            rect.on("pointerover", () => {
                if (this.opened) this.focus(index);
            });
            rect.on("pointerout", () => {
                if (this.opened) this.focus(this.focusIndex);
            });
        } else {
            rect.on("pointerover", () => rect.setFillStyle(style.hover));
            rect.on("pointerout", () => rect.setFillStyle(style.normal));
        }
        rect.on("pointerdown", action);
        return rect;
    }

    private drawTrack(
        layer: Layer,
        x: number,
        y: number,
        w: number,
        h: number,
    ): void {
        const track = this.scene.add
            .rectangle(x, y, w, h, COLORS.track)
            .setOrigin(0)
            .setStrokeStyle(2, COLORS.border);
        layer.add(track);
    }

    private addFill(
        layer: Layer,
        x: number,
        y: number,
        w: number,
        h: number,
    ): Phaser.GameObjects.Rectangle {
        const fill = this.scene.add
            .rectangle(x, y, w, h, COLORS.sky)
            .setOrigin(0);
        layer.add(fill);
        return fill;
    }

    private drawLine(
        g: Phaser.GameObjects.Graphics,
        x: number,
        y: number,
        w: number,
        color: number,
    ): void {
        g.fillStyle(color, 0.9).fillRect(x, y, w, 2);
    }

    private drawPanel(
        g: Phaser.GameObjects.Graphics,
        x: number,
        y: number,
        w: number,
        h: number,
        fill: number,
        border: number,
        studs = false,
    ): void {
        g.fillStyle(COLORS.shadow, 0.6).fillRect(x + 5, y + 6, w, h);
        g.fillStyle(border).fillRect(x, y, w, h);
        g.fillStyle(COLORS.bg).fillRect(x + 3, y + 3, w - 6, h - 6);
        g.fillStyle(fill).fillRect(x + 6, y + 6, w - 12, h - 12);
        g.fillStyle(0xffffff, 0.05).fillRect(x + 6, y + 6, w - 12, 3);
        if (studs) {
            g.fillStyle(COLORS.goldLight);
            for (const [sx, sy] of [
                [x + 14, y + 14],
                [x + w - 17, y + 14],
                [x + 14, y + h - 17],
                [x + w - 17, y + h - 17],
            ])
                g.fillRect(sx, sy, 4, 4);
        }
    }
}
