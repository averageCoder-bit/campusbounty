import * as Phaser from "phaser";

export type AdventureModeId = "quest-finding" | "dungeon-conquer" | "afk-farm";

/** Keep the existing Game.ts constructor and callbacks unchanged. */
export interface AdventurePortalUIOptions {
    onOpenChanged?: (open: boolean) => void;
    onLaunch?: (mode: AdventureModeId) => void;
    availableModes?: readonly AdventureModeId[];
}

const FONT = '"Press Start 2P", monospace';
const BODY_FONT = '"VT323", "Trebuchet MS", monospace';

const C = {
    black: 0x020611,
    navy: 0x0b1423,
    slate: 0x1b2a3d,
    border: 0x3b6384,
    rugBrown: 0x8b5b2c,
    rugTeal: 0x0b706b,
    rugDeep: 0x114c57,
    cork: 0xb07a45,
    woodDark: 0x452312,
    wood: 0x783c1c,
    woodLight: 0xa35b28,
    gold: 0xfbbf24,
    goldDark: 0xb45309,
    cyan: 0x55e8d5,
    ink: 0x5b3a1a,
} as const;

const SCREEN_W = 1024;
const SCREEN_H = 768;
const CARD_W = 254;
const CARD_H = 338;
const CARD_X = 112;
const CARD_Y = 196;
const CARD_GAP = 20;
const PREVIEW_W = CARD_W - 20;
const PREVIEW_H = 206;

interface Mode {
    id: AdventureModeId;
    title: string;
    category: string;
    tagline: string;
    details: string;
    learning: string;
    accent: number;
    paper: number;
    ink: number;
}

const MODES: readonly Mode[] = [
    {
        id: "quest-finding",
        title: "QUEST FINDING",
        category: "EXPLORE",
        tagline: "Find clues. Reveal secrets.",
        details:
            "Explore the lost archive, track hidden clues, avoid roaming threats, and unlock a secure vault.",
        learning: "INVESTIGATION + WALLET SECURITY",
        accent: 0x7dd3fc,
        paper: 0xf4dda2,
        ink: 0x1d5f8a,
    },
    {
        id: "dungeon-conquer",
        title: "DUNGEON CONQUER",
        category: "BATTLE",
        tagline: "Fight. Dodge. Conquer.",
        details:
            "Battle dungeon creatures, avoid traps, and overcome a final guardian with clever decisions.",
        learning: "STRATEGY + SMART CONTRACT SAFETY",
        accent: 0xfbbf24,
        paper: 0xead4a5,
        ink: 0x9a5b00,
    },
    {
        id: "afk-farm",
        title: "AFK FARM",
        category: "MANAGE",
        tagline: "Grow. Automate. Upgrade.",
        details:
            "Cultivate resources, build production tools, and optimize a capped offline coin economy.",
        learning: "RESOURCE PLANNING + TOKENOMICS",
        accent: 0x55e8d5,
        paper: 0xdbeafe,
        ink: 0x0f6b63,
    },
];

const colorString = (color: number): string =>
    `#${color.toString(16).padStart(6, "0")}`;

type Layer = Phaser.GameObjects.Container;
type Graphic = Phaser.GameObjects.Graphics;

interface Card {
    mode: Mode;
    outline: Phaser.GameObjects.Rectangle;
    highlight: Phaser.GameObjects.Rectangle;
}

/**
 * The mode artwork is drawn ONCE, entirely through Phaser Graphics.
 * No generated images, external spritesheets, network requests, or per-frame drawing.
 */
export class AdventurePortalUI {
    private readonly scene: Phaser.Scene;
    private readonly options: AdventurePortalUIOptions;
    private readonly root: Layer;
    private readonly content: Layer;
    private readonly cards: Card[] = [];
    private readonly infoTitle: Phaser.GameObjects.Text;
    private readonly infoDescription: Phaser.GameObjects.Text;
    private readonly infoLearning: Phaser.GameObjects.Text;
    private readonly comingSoon: Phaser.GameObjects.Text;
    private readonly playElements: Phaser.GameObjects.GameObject[];

    private selected: AdventureModeId = "quest-finding";
    private opened = false;
    private destroyed = false;
    private escArmed = false;

    private readonly keyDown = (event: KeyboardEvent): void => {
        if (!this.opened) return;
        switch (event.code) {
            case "Escape":
                // Close on key UP, so MenuOverlay's Escape keydown guard
                // sees that the portal is still open on the same keystroke.
                this.escArmed = true;
                break;
            case "ArrowLeft":
            case "KeyA":
                this.moveSelection(-1);
                break;
            case "ArrowRight":
            case "KeyD":
                this.moveSelection(1);
                break;
            case "Digit1":
            case "Digit2":
            case "Digit3":
                this.select(MODES[Number(event.code.slice(-1)) - 1].id);
                break;
            case "Enter":
            case "NumpadEnter":
            case "Space":
                if (!event.repeat) this.launch();
                break;
            default:
                return;
        }
        event.preventDefault();
    };

    private readonly keyUp = (event: KeyboardEvent): void => {
        if (event.code !== "Escape" || !this.escArmed) return;
        this.escArmed = false;
        if (this.opened) this.close();
    };

    get isOpen(): boolean {
        return this.opened;
    }

    /** The unzoomed HUD camera renders the UI; Game.ts ignores it on the world camera. */
    getCameraObjects(): Phaser.GameObjects.GameObject[] {
        return [this.root];
    }

    constructor(scene: Phaser.Scene, options: AdventurePortalUIOptions = {}) {
        this.scene = scene;
        this.options = options;
        this.root = scene.add
            .container(0, 0)
            .setScrollFactor(0)
            .setDepth(16000)
            .setVisible(false);

        // Capture clicks behind this full-screen modal.
        this.root.add(
            scene.add
                .rectangle(0, 0, SCREEN_W, SCREEN_H, C.black, 0.86)
                .setOrigin(0)
                .setInteractive(),
        );

        this.content = scene.add.container(0, 0);
        this.root.add(this.content);

        this.drawFrame();
        this.drawHeader();
        this.drawCardBackboard();
        MODES.forEach((mode, i) => this.cards.push(this.createCard(mode, i)));

        // Bottom area is now a dedicated full-width information panel.
        const infoBg = scene.add.graphics();
        this.drawPlaque(infoBg, 100, 548, 824, 126);
        this.content.add(infoBg);

        this.infoTitle = this.addText(
            this.content,
            125,
            566,
            "",
            12,
            "#7DD3FC",
        );
        this.infoDescription = this.addText(
            this.content,
            125,
            592,
            "",
            20,
            "#E2E8F0",
            545,
            false,
        );
        this.infoLearning = this.addText(
            this.content,
            125,
            647,
            "",
            8,
            "#FDE68A",
        );
        this.comingSoon = this.addText(
            this.content,
            812,
            624,
            "",
            9,
            "#94A3B8",
        ).setOrigin(0.5);

        this.playElements = this.makeButton(
            702,
            606,
            196,
            46,
            "PLAY QUEST",
            () => this.launch(),
        );
        this.refreshSelection();

        scene.input.keyboard?.on("keydown", this.keyDown);
        scene.input.keyboard?.on("keyup", this.keyUp);
    }

    open(): void {
        if (this.destroyed || this.opened) return;
        this.opened = true;
        this.escArmed = false;
        this.selected = "quest-finding";
        this.refreshSelection();
        // No opening/closing tweens: instant, reliable with paused gameplay.
        this.root.setAlpha(1).setVisible(true);
        this.options.onOpenChanged?.(true);
    }

    close(): void {
        if (this.destroyed || !this.opened) return;
        this.opened = false;
        this.escArmed = false;
        this.root.setVisible(false);
        this.options.onOpenChanged?.(false);
    }

    destroy(): void {
        if (this.destroyed) return;
        this.destroyed = true;
        this.opened = false;
        this.scene.input.keyboard?.off("keydown", this.keyDown);
        this.scene.input.keyboard?.off("keyup", this.keyUp);
        this.root.destroy(true);
    }

    private isAvailable(mode: AdventureModeId): boolean {
        return Boolean(
            this.options.onLaunch &&
            this.options.availableModes?.includes(mode),
        );
    }

    private select(mode: AdventureModeId): void {
        if (this.selected === mode) return;
        this.selected = mode;
        this.refreshSelection();
    }

    private moveSelection(direction: -1 | 1): void {
        const idx = MODES.findIndex((m) => m.id === this.selected);
        this.select(
            MODES[Phaser.Math.Clamp(idx + direction, 0, MODES.length - 1)].id,
        );
    }

    private refreshSelection(): void {
        for (const card of this.cards) {
            const selected = card.mode.id === this.selected;
            card.outline.setVisible(selected);
            card.highlight.setVisible(selected);
        }
        const mode = MODES.find((m) => m.id === this.selected)!;
        this.infoTitle.setText(mode.title).setColor(colorString(mode.accent));
        this.infoDescription.setText(mode.details);
        this.infoLearning.setText(`LEARN: ${mode.learning}`);
        const available = this.isAvailable(this.selected);
        this.comingSoon.setText(available ? "" : "COMING SOON");
        for (const object of this.playElements) {
            (
                object as Phaser.GameObjects.GameObject & {
                    setVisible: (v: boolean) => unknown;
                }
            ).setVisible(available);
        }
    }

    private launch(): void {
        if (!this.opened || !this.isAvailable(this.selected)) return;
        const chosen = this.selected;
        this.close();
        this.options.onLaunch?.(chosen);
    }

    // ------------------------------------------------------------------
    // FRAME / CARDS — STATIC PIXEL-ART GRAPHICS
    // ------------------------------------------------------------------

    private drawFrame(): void {
        const g = this.scene.add.graphics();
        const X = 60,
            Y = 55,
            W = 904,
            H = 652;
        this.rect(g, X + 6, Y + 6, W, H, 0x000000, 0.35);
        this.rect(g, X, Y, W, H, C.rugBrown);
        for (let x = X + 4; x < X + W - 2; x += 6) {
            this.rect(g, x, Y - 6, 2, 6, C.gold);
            this.rect(g, x, Y + H, 2, 6, C.gold);
        }
        for (let x = X + 12; x < X + W - 12; x += 12) {
            this.rect(g, x, Y + 2, 4, 4, C.gold);
            this.rect(g, x, Y + H - 6, 4, 4, C.gold);
        }
        for (let y = Y + 12; y < Y + H - 12; y += 12) {
            this.rect(g, X + 2, y, 4, 4, C.gold);
            this.rect(g, X + W - 6, y, 4, 4, C.gold);
        }
        this.rect(g, X + 8, Y + 8, W - 16, H - 16, C.rugTeal);
        this.rect(g, X + 20, Y + 20, W - 40, H - 40, C.rugDeep);
        this.rect(g, 91, 86, 842, 3, C.gold);
        this.rect(g, 91, 674, 842, 3, C.gold);
        this.rect(g, 91, 86, 3, 591, C.gold);
        this.rect(g, 930, 86, 3, 591, C.gold);
        this.content.add(g);
    }

    private drawHeader(): void {
        const g = this.scene.add.graphics();
        this.drawPlaque(g, 252, 100, 520, 48);
        this.goldCoin(g, 224, 124);
        this.goldCoin(g, 800, 124);
        this.content.add(g);
        this.addText(
            this.content,
            512,
            124,
            "ADVENTURE PORTAL",
            17,
            "#55E8D5",
        ).setOrigin(0.5);
        this.addText(
            this.content,
            512,
            162,
            "PLAY  /  EXPLORE  /  PROVE",
            9,
            "#FDE68A",
        ).setOrigin(0.5);
        this.makeButton(816, 106, 100, 36, "X  CLOSE", () => this.close(), 8);
    }

    private drawCardBackboard(): void {
        const g = this.scene.add.graphics();
        this.rect(g, 105, 187, 824, 363, 0x000000, 0.28);
        this.rect(g, 100, 181, 824, 361, 0x40291c);
        this.rect(g, 103, 184, 818, 355, C.gold);
        this.rect(g, 107, 188, 810, 347, C.cork);
        // Tiny cork texture — seeded for deterministic art, drawn only once.
        const rng = new Phaser.Math.RandomDataGenerator([
            "campusbounty-portal-cork",
        ]);
        for (let i = 0; i < 170; i++) {
            this.rect(
                g,
                rng.integerInRange(109, 911),
                rng.integerInRange(190, 529),
                2,
                2,
                rng.pick([0x946032, 0xc08a52]),
            );
        }
        this.content.add(g);
    }

    private createCard(mode: Mode, index: number): Card {
        const x = CARD_X + index * (CARD_W + CARD_GAP);
        const card = this.scene.add.container(x, CARD_Y);
        this.content.add(card);
        const bg = this.scene.add.graphics();
        this.rect(bg, 4, 4, CARD_W, CARD_H, 0x000000, 0.28);
        this.rect(bg, 0, 0, CARD_W, CARD_H, mode.paper);
        this.rect(bg, 0, 0, CARD_W, 4, 0xffffff, 0.4);
        this.rect(bg, 0, CARD_H - 4, CARD_W, 4, 0x000000, 0.12);
        this.rect(bg, 10, 44, PREVIEW_W, PREVIEW_H, 0x18283b);
        card.add(bg);

        // Real Phaser Graphics scene — not an imported thumbnail.
        const art = this.scene.add.graphics().setPosition(10, 44);
        if (mode.id === "quest-finding") this.drawQuestPreview(art);
        if (mode.id === "dungeon-conquer") this.drawDungeonPreview(art);
        if (mode.id === "afk-farm") this.drawFarmPreview(art);
        card.add(art);

        const border = this.scene.add.graphics();
        this.rect(border, 8, 42, PREVIEW_W + 4, 3, mode.ink);
        this.rect(border, 8, 42, 3, PREVIEW_H + 4, mode.ink);
        this.rect(border, 8, 42 + PREVIEW_H + 1, PREVIEW_W + 4, 3, mode.ink);
        this.rect(border, 8 + PREVIEW_W + 1, 42, 3, PREVIEW_H + 4, mode.ink);
        card.add(border);

        this.addText(
            card,
            14,
            15,
            `0${index + 1} / ${mode.category}`,
            8,
            colorString(mode.ink),
        );
        const pin = this.scene.add
            .rectangle(CARD_W / 2, 7, 9, 9, 0xef4444)
            .setStrokeStyle(1, 0x7f1d1d);
        card.add(pin);
        this.addText(card, 14, 266, mode.title, 10, "#342516");
        this.addText(
            card,
            14,
            292,
            mode.tagline,
            19,
            "#5B3A1A",
            CARD_W - 28,
            false,
        );
        this.addText(
            card,
            CARD_W - 14,
            316,
            this.isAvailable(mode.id) ? "PLAYABLE" : "PREVIEW",
            7,
            colorString(mode.ink),
        ).setOrigin(1, 0);

        const highlight = this.scene.add
            .rectangle(0, 0, CARD_W, 7, mode.accent)
            .setOrigin(0)
            .setVisible(false);
        const outline = this.scene.add
            .rectangle(0, 0, CARD_W, CARD_H)
            .setOrigin(0)
            .setStrokeStyle(4, C.gold)
            .setVisible(false);
        card.add([highlight, outline]);

        // Fixed hit rectangle: hovering doesn't trigger scene rebuilds or tweens.
        const hit = this.scene.add
            .rectangle(x, CARD_Y, CARD_W, CARD_H, 0xffffff, 0.001)
            .setOrigin(0)
            .setInteractive({ useHandCursor: true });
        hit.on("pointerover", () => this.select(mode.id));
        hit.on("pointerdown", () => this.select(mode.id));
        this.content.add(hit);

        return { mode, outline, highlight };
    }

    private drawPlaque(
        g: Graphic,
        x: number,
        y: number,
        w: number,
        h: number,
    ): void {
        this.rect(g, x + 4, y + 5, w, h, 0x000000, 0.32);
        this.rect(g, x, y, w, h, C.woodDark);
        this.rect(g, x + 3, y + 3, w - 6, h - 6, C.gold);
        this.rect(g, x + 6, y + 6, w - 12, h - 12, C.navy);
        for (const [sx, sy] of [
            [x + 12, y + 11],
            [x + w - 16, y + 11],
            [x + 12, y + h - 15],
            [x + w - 16, y + h - 15],
        ])
            this.rect(g, sx, sy, 4, 4, C.gold);
    }

    private makeButton(
        x: number,
        y: number,
        w: number,
        h: number,
        label: string,
        onClick: () => void,
        fontSize = 9,
    ): Phaser.GameObjects.GameObject[] {
        const bg = this.scene.add
            .rectangle(x, y, w, h, C.woodLight)
            .setOrigin(0)
            .setStrokeStyle(2, C.gold)
            .setInteractive({ useHandCursor: true });
        const shine = this.scene.add
            .rectangle(x + 2, y + 2, w - 4, 3, 0xe0a355)
            .setOrigin(0);
        this.content.add([bg, shine]);
        // Add the text after the button background so it renders on top.
        const text = this.addText(
            this.content,
            x + w / 2,
            y + h / 2,
            label,
            fontSize,
            "#FFF7E0",
        ).setOrigin(0.5);
        bg.on("pointerover", () => bg.setFillStyle(0xc7803a));
        bg.on("pointerout", () => bg.setFillStyle(C.woodLight));
        bg.on("pointerup", onClick);
        return [bg, shine, text];
    }

    private addText(
        layer: Layer,
        x: number,
        y: number,
        value: string,
        fontSize: number,
        color: string,
        wrapWidth = 0,
        pixel = true,
    ): Phaser.GameObjects.Text {
        const text = this.scene.add.text(x, y, value, {
            fontFamily: pixel ? FONT : BODY_FONT,
            fontSize: `${fontSize}px`,
            color,
            lineSpacing: pixel ? 6 : 2,
            resolution: 2,
            ...(wrapWidth
                ? { wordWrap: { width: wrapWidth, useAdvancedWrap: true } }
                : {}),
        });
        layer.add(text);
        return text;
    }

    // ------------------------------------------------------------------
    // SHARED PIXEL SHAPES — NO SMOOTH / BLURRED DRAWING
    // ------------------------------------------------------------------

    private rect(
        g: Graphic,
        x: number,
        y: number,
        w: number,
        h: number,
        c: number,
        alpha = 1,
    ): void {
        g.fillStyle(c, alpha).fillRect(x, y, w, h);
    }

    private tiledFloor(
        g: Graphic,
        base: number,
        line: number,
        seed: string,
    ): void {
        this.rect(g, 0, 0, PREVIEW_W, PREVIEW_H, base);
        const rng = new Phaser.Math.RandomDataGenerator([seed]);
        for (let y = 0; y < PREVIEW_H; y += 20) {
            for (let x = 0; x < PREVIEW_W; x += 20) {
                this.rect(g, x, y, 19, 1, line, 0.55);
                this.rect(g, x, y, 1, 19, line, 0.55);
                if (rng.frac() > 0.78) {
                    this.rect(g, x + 7, y + 8, 3, 2, 0xffffff, 0.08);
                }
            }
        }
    }

    private star(
        g: Graphic,
        x: number,
        y: number,
        color: number = C.gold,
    ): void {
        this.rect(g, x - 1, y - 6, 3, 13, color);
        this.rect(g, x - 6, y - 1, 13, 3, color);
        this.rect(g, x - 2, y - 2, 5, 5, 0xfff4bc);
    }

    private goldCoin(g: Graphic, x: number, y: number): void {
        this.rect(g, x - 9, y - 7, 18, 14, C.goldDark);
        this.rect(g, x - 7, y - 9, 14, 18, C.goldDark);
        this.rect(g, x - 7, y - 7, 14, 14, C.gold);
        this.rect(g, x - 3, y - 5, 6, 10, 0xf59e0b);
        this.rect(g, x - 5, y - 2, 10, 4, 0xf59e0b);
    }

    private bush(g: Graphic, x: number, y: number): void {
        this.rect(g, x, y + 7, 27, 12, 0x14532d);
        this.rect(g, x + 4, y + 2, 19, 16, 0x166534);
        this.rect(g, x + 8, y, 10, 13, 0x22c55e);
        this.rect(g, x + 4, y + 6, 6, 5, 0x4ade80);
        this.rect(g, x + 17, y + 5, 5, 5, 0x4ade80);
    }

    private hero(g: Graphic, x: number, y: number): void {
        // Simple chibi student, consistent across all three preview scenes.
        this.rect(g, x - 10, y - 26, 20, 6, 0x152238); // hair
        this.rect(g, x - 9, y - 20, 18, 14, 0xffd1a5); // face
        this.rect(g, x + 2, y - 15, 3, 3, 0x142238); // eye
        this.rect(g, x - 11, y - 6, 23, 17, 0x60a5fa); // blue coat
        this.rect(g, x + 1, y - 1, 5, 5, C.gold); // emblem
        this.rect(g, x - 14, y - 2, 4, 11, 0xffd1a5); // arm
        this.rect(g, x + 12, y - 2, 5, 10, 0xffd1a5);
        this.rect(g, x - 9, y + 11, 8, 10, 0x202b3f); // trousers
        this.rect(g, x + 3, y + 11, 8, 10, 0x202b3f);
        this.rect(g, x - 10, y + 20, 10, 4, 0x77411c); // boots
        this.rect(g, x + 3, y + 20, 10, 4, 0x77411c);
    }

    private parchment(g: Graphic, x: number, y: number): void {
        this.rect(g, x + 2, y + 3, 27, 31, 0x5b3a1a);
        this.rect(g, x, y, 27, 31, 0xfde68a);
        this.rect(g, x + 4, y + 7, 19, 3, 0xa16207);
        this.rect(g, x + 4, y + 15, 14, 2, 0xb45309);
        this.rect(g, x + 4, y + 22, 17, 2, 0xb45309);
        this.rect(g, x + 11, y - 3, 6, 6, 0xef4444);
    }

    // -- Quest Finding: garden investigation --------------------------------
    private drawQuestPreview(g: Graphic): void {
        this.tiledFloor(g, 0x20374d, 0x0c2436, "qf-floor");
        this.rect(g, 0, 0, 82, 62, 0x23673e);
        this.rect(g, 0, 143, 66, 63, 0x26713e);
        this.rect(g, 172, 0, 62, 61, 0x27673f);
        this.rect(g, 181, 152, 53, 54, 0x23673e);
        // Low ruined walls and stone fragments.
        for (const [x, y] of [
            [0, 57],
            [20, 57],
            [40, 57],
            [164, 58],
            [184, 58],
            [202, 58],
        ]) {
            this.rect(g, x, y, 20, 10, 0x71869b);
            this.rect(g, x, y, 20, 3, 0xc0d1e0);
        }
        for (const [x, y] of [
            [10, 14],
            [41, 30],
            [192, 17],
            [173, 177],
            [15, 174],
        ])
            this.bush(g, x, y);
        this.parchment(g, 32, 12);
        this.parchment(g, 184, 19);
        this.parchment(g, 177, 159);
        this.star(g, 62, 12);
        this.star(g, 211, 47);
        this.star(g, 210, 165);
        // Treasure-map table at lower left.
        this.rect(g, 4, 115, 77, 45, 0x5b3719);
        this.rect(g, 8, 118, 69, 38, 0xf6d895);
        this.rect(g, 18, 130, 14, 8, 0x78915b);
        this.rect(g, 47, 126, 12, 8, 0x78915b);
        this.rect(g, 55, 142, 8, 4, 0xef4444);
        this.rect(g, 58, 139, 3, 11, 0xef4444);
        // Player investigates with a blue lens.
        this.hero(g, 120, 126);
        this.rect(g, 137, 113, 13, 13, 0x0c3852);
        this.rect(g, 140, 116, 9, 9, 0x7dd3fc);
        this.rect(g, 148, 127, 11, 4, C.goldDark);
        this.star(g, 150, 96);
        this.goldCoin(g, 94, 69);
        // Back arch / learning landmark.
        this.rect(g, 89, 8, 64, 48, 0x637b8c);
        this.rect(g, 98, 17, 47, 39, 0x0b1423);
        this.rect(g, 108, 26, 28, 24, 0x0e7490);
        this.rect(g, 116, 30, 14, 14, 0x67e8f9);
        this.rect(g, 90, 53, 62, 5, C.gold);
    }

    // -- Dungeon Conquer: danger, combat and loot ---------------------------
    private drawDungeonPreview(g: Graphic): void {
        this.tiledFloor(g, 0x263044, 0x111827, "dc-floor");
        // Dungeon masonry.
        this.rect(g, 0, 0, 234, 23, 0x475569);
        for (let x = 0; x < 234; x += 24) {
            this.rect(g, x, 0, 2, 23, 0x1e293b);
            this.rect(g, x + 2, 15, 20, 3, 0x718096);
        }
        // Exit portal.
        this.rect(g, 163, 14, 53, 76, 0x64748b);
        this.rect(g, 170, 22, 38, 62, 0x102b49);
        this.rect(g, 177, 28, 24, 53, 0x0e7490);
        this.rect(g, 184, 31, 10, 42, 0x67e8f9);
        this.rect(g, 160, 86, 60, 5, C.goldDark);
        // Flames & torches on each side.
        for (const tx of [20, 105]) {
            this.rect(g, tx, 26, 14, 6, 0x7c4325);
            this.rect(g, tx + 3, 13, 8, 14, 0xf59e0b);
            this.rect(g, tx + 5, 7, 4, 11, 0xffe08a);
        }
        // Stone traps at lower-left.
        this.rect(g, 16, 146, 64, 34, 0x111827);
        this.rect(g, 20, 150, 56, 26, 0x475569);
        for (let i = 0; i < 4; i++) {
            this.rect(g, 26 + i * 13, 151, 5, 19, 0xcbd5e1);
            this.rect(g, 28 + i * 13, 146, 1, 9, 0xf8fafc);
        }
        this.rect(g, 23, 54, 31, 31, 0x633d21); // barrel
        this.rect(g, 23, 58, 31, 5, 0xa36931);
        this.rect(g, 23, 76, 31, 4, C.goldDark);
        // The player and sword slash.
        this.hero(g, 101, 123);
        this.rect(g, 119, 112, 25, 5, 0xb7f7ff);
        this.rect(g, 140, 108, 5, 14, 0xe2e8f0);
        this.rect(g, 115, 115, 5, 11, C.goldDark);
        // Green slime monster.
        this.rect(g, 150, 132, 48, 21, 0x166534);
        this.rect(g, 156, 122, 35, 22, 0x4ade80);
        this.rect(g, 165, 130, 6, 6, 0x122338);
        this.rect(g, 181, 130, 6, 6, 0x122338);
        this.rect(g, 159, 119, 12, 4, 0x86efac);
        this.star(g, 151, 113, 0xffe08a);
        // Loot chest near bottom-right.
        this.rect(g, 175, 171, 48, 25, C.woodDark);
        this.rect(g, 178, 163, 44, 14, C.woodLight);
        this.rect(g, 183, 164, 35, 8, C.gold);
        this.rect(g, 192, 177, 15, 13, C.goldDark);
        this.goldCoin(g, 211, 159);
        this.star(g, 226, 158);
    }

    // -- AFK Farm: crop rows, workshop and automation ------------------------
    private drawFarmPreview(g: Graphic): void {
        this.tiledFloor(g, 0x276345, 0x23533e, "farm-floor");
        this.rect(g, 72, 0, 52, 206, 0x3c5360);
        this.rect(g, 0, 105, 234, 36, 0x3c5360);
        for (let y = 0; y < 206; y += 20) this.rect(g, 72, y, 52, 2, 0x64748b);
        // Small automated mill and gearbox, top left.
        this.rect(g, 8, 15, 55, 68, 0x475569);
        this.rect(g, 6, 10, 59, 13, 0x0f766e);
        this.rect(g, 11, 27, 48, 49, C.woodDark);
        this.rect(g, 20, 33, 29, 29, C.goldDark);
        this.rect(g, 25, 39, 18, 18, C.gold);
        this.rect(g, 30, 42, 8, 11, C.woodDark);
        // Irrigation pipes and water tank top right.
        this.rect(g, 136, 13, 86, 30, 0x64748b);
        this.rect(g, 144, 18, 70, 19, 0x0e7490);
        this.rect(g, 155, 21, 48, 8, 0x67e8f9);
        this.rect(g, 167, 40, 6, 19, 0xd1a33d);
        this.rect(g, 136, 54, 86, 6, C.goldDark);
        // Farm crop beds: carrot, tomatoes, wheat.
        const beds = [66, 105, 145];
        const crops = [0xf97316, 0xef4444, 0xeab308];
        beds.forEach((y, row) => {
            this.rect(g, 133, y, 93, 32, 0x75401b);
            this.rect(g, 137, y + 4, 85, 24, 0x442b1e);
            for (let j = 0; j < 4; j++) {
                const cx = 143 + j * 21;
                this.rect(g, cx + 6, y + 5, 7, 10, 0x22c55e);
                this.rect(g, cx + 3, y + 13, 12, 11, crops[row]);
                this.rect(g, cx + 6, y + 15, 4, 3, 0xffe08a, 0.55);
            }
        });
        // Lower-left seed nursery and wooden railing.
        this.rect(g, 5, 146, 60, 42, 0x865328);
        this.rect(g, 11, 151, 50, 30, 0x154e30);
        for (let i = 0; i < 3; i++) {
            this.rect(g, 15 + i * 15, 162, 10, 9, 0xa35b28);
            this.rect(g, 18 + i * 15, 154, 5, 10, 0x4ade80);
        }
        // Moving student and a stack of collected gold.
        this.hero(g, 93, 100);
        this.goldCoin(g, 33, 117);
        this.goldCoin(g, 55, 99);
        this.star(g, 55, 88);
        this.rect(g, 88, 169, 31, 22, C.wood);
        this.rect(g, 92, 172, 23, 14, C.woodLight);
        this.rect(g, 96, 177, 14, 4, C.gold);
    }
}

