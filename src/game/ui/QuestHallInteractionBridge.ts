import * as Phaser from "phaser";
import { getGameSession } from "../data/GameSession";
import { getLearningProgress, getReviewQueue, isVerifiedAccount } from "../data/LearningProgress";

export interface QuestHallSnapshot {
    level: number;
    xp: number;
    xpToNext: number;
    coins: number;
    questFindingCleared: boolean;
    masteredLessons: number;
    reviewCount: number;
    achievements: string[];
    accountStatus: "verified" | "guest";
    avatarDataUrl?: string;
    recentLessonId?: string;
}
export interface QuestHallInteractionBridgeOptions {
    /** Keep independent ESC Settings, Quest Board and Portal as modal authorities. */
    canOpen: () => boolean;
    /** Pause/resume Quest Hall physics and mouse-leading camera while React panel is open. */
    onModalChanged: (open: boolean) => void;
    /** Actual Player.ts Phaser sprite: used for portrait only, never modified. */
    playerSprite?: Phaser.GameObjects.Sprite;
}
export type QuestPanelKind = "player" | "byte";

/** Phaser-side bridge to full keyboard-accessible React quest/player panels.
 * Preserves MenuOverlay's existing HUD and ESC Settings behavior.
 */
export class QuestHallInteractionBridge {
    private readonly scene: Phaser.Scene;
    private readonly options: QuestHallInteractionBridgeOptions;
    private readonly button: Phaser.GameObjects.Container;
    private opened = false;
    private destroyed = false;
    private keyboardWasEnabled = true;
    get isOpen(): boolean { return this.opened; }
    getCameraObjects(): Phaser.GameObjects.GameObject[] { return [this.button]; }

    private readonly keyDown = (event: KeyboardEvent): void => {
        if (event.repeat || this.opened) return;
        if (event.code !== "KeyP" || event.altKey || event.ctrlKey || event.metaKey) return;
        const el = event.target;
        if (el instanceof HTMLElement && el.closest("input,textarea,[contenteditable=true]")) return;
        if (!this.options.canOpen()) return;
        event.preventDefault();
        this.openPlayer();
    };
    private readonly closed = (): void => { this.release(); };

    constructor(scene: Phaser.Scene, options: QuestHallInteractionBridgeOptions) {
        this.scene = scene;
        this.options = options;
        this.button = scene.add.container(0, 0).setScrollFactor(0).setDepth(9100);
        const bg = scene.add.rectangle(16, 129, 226, 31, 0x14283c)
            .setOrigin(0).setStrokeStyle(2, 0xfbbf24)
            .setInteractive({ useHandCursor: true });
        const label = scene.add.text(129, 145, "P  /  PLAYER PROFILE", {
            fontFamily: '"Press Start 2P", monospace', fontSize: "9px", color: "#fbbf24",
        }).setOrigin(0.5);
        bg.on("pointerover", () => bg.setFillStyle(0x29445a));
        bg.on("pointerout", () => bg.setFillStyle(0x14283c));
        bg.on("pointerdown", () => this.openPlayer());
        this.button.add([bg, label]);
        window.addEventListener("keydown", this.keyDown);
        window.addEventListener("campusbounty:quest-panel-closed", this.closed);
    }
    private avatar(): string | undefined {
        const sprite = this.options.playerSprite;
        if (!sprite) return;
        try {
            const f = sprite.frame;
            const source = sprite.texture.getSourceImage() as CanvasImageSource;
            const canvas = document.createElement("canvas");
            canvas.width = f.cutWidth; canvas.height = f.cutHeight;
            const c = canvas.getContext("2d");
            if (!c) return;
            c.imageSmoothingEnabled = false;
            c.drawImage(source, f.cutX, f.cutY, f.cutWidth, f.cutHeight,
                0, 0, f.cutWidth, f.cutHeight);
            return canvas.toDataURL("image/png");
        } catch { return; }
    }
    private snapshot(): QuestHallSnapshot {
        const game = getGameSession(this.scene);
        const learning = getLearningProgress(this.scene);
        const avatarDataUrl = this.avatar();
        const recentLessonId = Object.entries(learning.lessons)
            .filter(([, m]) => typeof m.lastPracticedAt === "string")
            .sort((a, b) => (b[1].lastPracticedAt ?? "").localeCompare(a[1].lastPracticedAt ?? ""))[0]?.[0];
        return {
            level: game.level, xp: game.xp, xpToNext: game.xpToNext,
            coins: game.coins, questFindingCleared: game.questFindingCleared,
            masteredLessons: Object.values(learning.lessons).filter(l => l.mastered).length,
            reviewCount: getReviewQueue(this.scene).length,
            achievements: [...learning.achievements],
            accountStatus: isVerifiedAccount(this.scene) ? "verified" : "guest",
            ...(avatarDataUrl ? { avatarDataUrl } : {}),
            ...(recentLessonId ? { recentLessonId } : {}),
        };
    }
    private dispatch(kind: QuestPanelKind): void {
        if (this.destroyed || this.opened || !this.options.canOpen()) return;
        this.opened = true;
        const keyboard = this.scene.input.keyboard;
        this.keyboardWasEnabled = keyboard?.enabled ?? true;
        if (keyboard) keyboard.enabled = false;
        this.options.onModalChanged(true);
        window.dispatchEvent(new CustomEvent("campusbounty:quest-panel-open", {
            detail: { kind, snapshot: this.snapshot() },
        }));
    }
    openPlayer(): void { this.dispatch("player"); }
    openByte(): void { this.dispatch("byte"); }
    private release(): void {
        if (!this.opened || this.destroyed) return;
        this.opened = false;
        if (this.scene.input.keyboard) this.scene.input.keyboard.enabled = this.keyboardWasEnabled;
        this.options.onModalChanged(false);
    }
    destroy(): void {
        if (this.destroyed) return;
        this.release();
        window.dispatchEvent(new Event("campusbounty:quest-panel-force-close"));
        this.destroyed = true;
        window.removeEventListener("keydown", this.keyDown);
        window.removeEventListener("campusbounty:quest-panel-closed", this.closed);
        this.button.destroy(true);
    }
}
