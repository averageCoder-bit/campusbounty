import * as Phaser from "phaser";

/** First-stage scripted lines. Swap this source for API replies later. */
export const BYTE_INTRO_DIALOGUE = [
    "Hey there, adventurer! I'm Byte, the little ghost keeping this Quest Hall company. Nice to meet you!",
    "See that noticeboard? It'll be our quest hub. Soon you'll be able to pick challenges and earn XP there!",
    "For now, take a look around. Whenever you need a friendly ghost, I'll be right here!",
] as const;

export interface ByteDialogueOptions {
    onOpenChanged?: (isOpen: boolean) => void;
    /** Launch the React Byte mentor chat without losing scripted dialogue. */
    onAskByte?: () => void;
    /** Milliseconds per character; smaller = faster typing. */
    typingSpeedMs?: number;
}

const W = 1024;
const H = 768;
// Match the reference's edge-to-edge avatar-box layout, with small safe margins.
const PANEL_X = 16;
const PANEL_H = 216;
const PANEL_Y = H - PANEL_H - 24;
const PANEL_W = W - PANEL_X * 2;
const PANEL_RIGHT = PANEL_X + PANEL_W;
const TEXT_X = PANEL_X + 184;
const FONT = '"Press Start 2P", monospace';
const BYTE_TEXTURE = "cb-g2-hall-byte-v2"; // Already baked in QuestHallMap.ts

/**
 * Screen-fixed, avatar-box style dialogue inspired by classic pixel RPGs.
 * Does not own game input state or require an AI backend.
 */
export class ByteDialogue {
    private readonly scene: Phaser.Scene;
    private readonly root: Phaser.GameObjects.Container;
    private readonly body: Phaser.GameObjects.Text;
    private readonly pageCounter: Phaser.GameObjects.Text;
    private readonly advanceHint: Phaser.GameObjects.Text;
    private readonly onOpenChanged?: (isOpen: boolean) => void;
    private readonly onAskByte?: () => void;
    private readonly typingSpeed: number;

    private lines: string[] = [];
    private lineIndex = 0;
    private characters: string[] = [];
    private visibleCharacters = 0;
    private elapsed = 0;
    private opened = false;
    private destroyed = false;

    private readonly onAdvanceKey = (event: KeyboardEvent): void => {
        if (!this.opened) return;
        event.preventDefault();
        this.advance();
    };

    private readonly onAskKey = (event: KeyboardEvent): void => {
        if (!this.opened || !this.onAskByte) return;
        event.preventDefault();
        this.requestMentor();
    };

    private readonly onEscapeKey = (event: KeyboardEvent): void => {
        if (!this.opened) return;
        event.preventDefault();
        this.close();
    };

    get isOpen(): boolean {
        return this.opened;
    }

    /** Only the unzoomed HUD camera should render this container. */
    getCameraObjects(): Phaser.GameObjects.GameObject[] {
        return [this.root];
    }

    constructor(scene: Phaser.Scene, options: ByteDialogueOptions = {}) {
        this.scene = scene;
        this.onOpenChanged = options.onOpenChanged;
        this.onAskByte = options.onAskByte;
        this.typingSpeed = Math.max(5, options.typingSpeedMs ?? 27);
        this.root = scene.add.container(0, 0)
            .setDepth(12000)
            .setScrollFactor(0)
            .setVisible(false);

        const graphics = scene.add.graphics();
        // Full-width pixel panel: shadow, double mauve frame, peach surface.
        graphics.fillStyle(0x050a14, 0.66);
        graphics.fillRect(PANEL_X + 8, PANEL_Y + 9, PANEL_W, PANEL_H);
        graphics.fillStyle(0x3b293b);
        graphics.fillRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H);
        graphics.fillStyle(0xc8899a);
        graphics.fillRect(PANEL_X + 5, PANEL_Y + 5, PANEL_W - 10, PANEL_H - 10);
        graphics.fillStyle(0x6f485b);
        graphics.fillRect(PANEL_X + 10, PANEL_Y + 10, PANEL_W - 20, PANEL_H - 20);
        graphics.fillStyle(0xffcfb5);
        graphics.fillRect(PANEL_X + 15, PANEL_Y + 15, PANEL_W - 30, PANEL_H - 30);

        // Pixel-art corner joints.
        graphics.fillStyle(0xffe9cf);
        for (const [x, y] of [
            [PANEL_X + 10, PANEL_Y + 10],
            [PANEL_RIGHT - 10, PANEL_Y + 10],
            [PANEL_X + 10, PANEL_Y + PANEL_H - 10],
            [PANEL_RIGHT - 10, PANEL_Y + PANEL_H - 10],
        ]) {
            graphics.fillRect(x - 4, y - 4, 8, 8);
        }

        // Byte portrait is inset just inside the left frame.
        const portraitX = PANEL_X + 25;
        const portraitY = PANEL_Y + 28;
        const portraitW = 134;
        const portraitH = 145;
        graphics.fillStyle(0x6f485b);
        graphics.fillRect(portraitX, portraitY, portraitW, portraitH);
        graphics.fillStyle(0xe7a5a8);
        graphics.fillRect(portraitX + 5, portraitY + 5, portraitW - 10, portraitH - 10);
        graphics.fillStyle(0x22354b);
        graphics.fillRect(portraitX + 11, portraitY + 11, portraitW - 22, portraitH - 22);
        graphics.fillStyle(0x496479, 0.55);
        graphics.fillRect(portraitX + 16, portraitY + 16, portraitW - 32, portraitH - 32);
        this.root.add(graphics);

        // Reuse the existing Byte texture; no new sprite/image assets.
        const portraitCenterX = portraitX + portraitW / 2;
        const portraitCenterY = portraitY + portraitH / 2;
        if (scene.textures.exists(BYTE_TEXTURE)) {
            const portrait = scene.add.image(portraitCenterX, portraitCenterY, BYTE_TEXTURE)
                .setScale(6)
                .setOrigin(0.5);
            this.root.add(portrait);
        } else {
            this.root.add(scene.add.text(portraitCenterX, portraitCenterY, "B", {
                fontFamily: FONT,
                fontSize: "48px",
                color: "#55E8D5",
            }).setOrigin(0.5));
        }

        const name = scene.add.text(TEXT_X, PANEL_Y + 29, "BYTE", {
            fontFamily: FONT,
            fontSize: "15px",
            color: "#5E344B",
        });
        const role = scene.add.text(TEXT_X + 128, PANEL_Y + 34, "YOUR QUEST HALL GUIDE", {
            fontFamily: FONT,
            fontSize: "8px",
            color: "#996F71",
        });
        this.root.add([name, role]);

        this.body = scene.add.text(TEXT_X, PANEL_Y + 69, "", {
            fontFamily: '"Trebuchet MS", Arial, sans-serif',
            fontSize: "20px",
            color: "#382A37",
            lineSpacing: 7,
            wordWrap: {
                width: PANEL_RIGHT - TEXT_X - 34,
                useAdvancedWrap: true,
            },
        });
        this.root.add(this.body);

        this.pageCounter = scene.add.text(TEXT_X, PANEL_Y + PANEL_H - 43, "", {
            fontFamily: FONT,
            fontSize: "9px",
            color: "#96616A",
        });
        this.advanceHint = scene.add.text(PANEL_RIGHT - 32, PANEL_Y + PANEL_H - 42, "", {
            fontFamily: FONT,
            fontSize: "9px",
            color: "#6F485B",
        }).setOrigin(1, 0);
        this.root.add([this.pageCounter, this.advanceHint]);

        // Clicking the panel completes/advances dialogue without blocking WASD.
        const clickable = scene.add.zone(
            PANEL_X + PANEL_W / 2,
            PANEL_Y + PANEL_H / 2,
            PANEL_W,
            PANEL_H,
        ).setInteractive({ useHandCursor: true });
        clickable.on("pointerdown", () => this.advance());
        this.root.add(clickable);

        // The original avatar-box remains nonmodal; the opt-in mentor is a
        // separate React panel, used only when Q or this button is selected.
        if (this.onAskByte) {
            const ask = scene.add.rectangle(TEXT_X + 340, PANEL_Y + PANEL_H - 39,
                146, 32, 0x5e344b).setStrokeStyle(2, 0xfbbf24)
                .setInteractive({ useHandCursor: true });
            const askLabel = scene.add.text(TEXT_X + 340, PANEL_Y + PANEL_H - 39,
                "Q  ASK BYTE", { fontFamily: FONT, fontSize: "8px", color: "#ffead2" })
                .setOrigin(0.5);
            ask.on("pointerdown", (_pointer: Phaser.Input.Pointer, _lx: number, _ly: number,
                event: Phaser.Types.Input.EventData) => {
                event.stopPropagation(); this.requestMentor();
            });
            this.root.add([ask, askLabel]);
        }

        // Register AFTER MenuOverlay's ESC handler; its guard prevents
        // opening Settings on the same ESC key press used to close dialogue.
        scene.input.keyboard?.on("keydown-ENTER", this.onAdvanceKey);
        scene.input.keyboard?.on("keydown-SPACE", this.onAdvanceKey);
        scene.input.keyboard?.on("keydown-ESC", this.onEscapeKey);
        scene.input.keyboard?.on("keydown-Q", this.onAskKey);
    }

    open(lines: readonly string[] = BYTE_INTRO_DIALOGUE): void {
        if (this.destroyed || this.opened) return;
        this.lines = lines.length > 0 ? [...lines] : ["...Boop? My ghostly thoughts went missing!"];
        this.lineIndex = 0;
        this.opened = true;
        this.root.setVisible(true);
        this.startLine();
        this.onOpenChanged?.(true);
    }

    /** Call once per Game.update while dialogue is open. No scene timer needed. */
    update(delta: number): void {
        if (!this.opened || this.visibleCharacters >= this.characters.length) return;
        this.elapsed += Math.max(0, Math.min(delta, 100));
        const count = Math.floor(this.elapsed / this.typingSpeed);
        if (count <= 0) return;
        this.elapsed -= count * this.typingSpeed;
        this.visibleCharacters = Math.min(this.characters.length, this.visibleCharacters + count);
        this.body.setText(this.characters.slice(0, this.visibleCharacters).join(""));
        if (this.visibleCharacters === this.characters.length) this.updateHint();
    }

    advance(): void {
        if (!this.opened) return;
        if (this.visibleCharacters < this.characters.length) {
            // First press reveals the rest of the current sentence.
            this.visibleCharacters = this.characters.length;
            this.body.setText(this.characters.join(""));
            this.updateHint();
            return;
        }
        if (this.lineIndex < this.lines.length - 1) {
            this.lineIndex += 1;
            this.startLine();
        } else {
            this.close();
        }
    }

    private requestMentor(): void {
        if (!this.opened || !this.onAskByte) return;
        this.close();
        this.onAskByte();
    }

    close(): void {
        if (!this.opened) return;
        this.opened = false;
        this.root.setVisible(false);
        this.onOpenChanged?.(false);
    }

    destroy(): void {
        if (this.destroyed) return;
        this.destroyed = true;
        this.opened = false;
        this.scene.input.keyboard?.off("keydown-ENTER", this.onAdvanceKey);
        this.scene.input.keyboard?.off("keydown-SPACE", this.onAdvanceKey);
        this.scene.input.keyboard?.off("keydown-ESC", this.onEscapeKey);
        this.scene.input.keyboard?.off("keydown-Q", this.onAskKey);
        this.root.destroy(true);
    }

    private startLine(): void {
        this.characters = Array.from(this.lines[this.lineIndex]);
        this.visibleCharacters = 0;
        this.elapsed = 0;
        this.body.setText("");
        this.pageCounter.setText(`${this.lineIndex + 1} / ${this.lines.length}`);
        this.advanceHint.setText("WASD: LEAVE   /   TYPING...");
    }

    private updateHint(): void {
        this.advanceHint.setText(
            this.lineIndex === this.lines.length - 1
                ? (this.onAskByte ? "Q ASK BYTE   /   ENTER CLOSE" : "WASD: LEAVE   /   ENTER: CLOSE")
                : (this.onAskByte ? "Q ASK BYTE   /   ENTER NEXT" : "WASD: LEAVE   /   ENTER: NEXT"),
        );
    }
}
