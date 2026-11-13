import * as Phaser from "phaser";

export type AdventureModeId = "quest-finding" | "dungeon-conquer" | "afk-farm";

/** Keep the existing Game.ts constructor and callbacks unchanged. */
export interface AdventurePortalUIOptions {
    onOpenChanged?: (open: boolean) => void;
    onLaunch?: (mode: AdventureModeId) => void;
    /** Optional presentation-only launch. Existing normal onLaunch is unchanged. */
    onLaunchDemo?: (mode: Exclude<AdventureModeId, "afk-farm">) => void;
    availableModes?: readonly AdventureModeId[];
}

const FONT = '"Press Start 2P", monospace';
const BODY_FONT = '"VT323", "Trebuchet MS", monospace';
const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";
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
type Rng = Phaser.Math.RandomDataGenerator;

interface Card {
    mode: Mode;
    outline: Phaser.GameObjects.Rectangle;
    highlight: Phaser.GameObjects.Rectangle;
}

/**
 * The mode artwork is drawn ONCE, entirely through Phaser Graphics.
 * No generated images, external spritesheets, network requests, or per-frame drawing.
 * Every preview primitive goes through `pr()`, which clips to the preview window so
 * lighting and silhouettes can never spill onto the card or surrounding UI.
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
    private readonly demoElements: Phaser.GameObjects.GameObject[];

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

        // When disabled (or unwired), reproduce the original portal EXACTLY.
        const hasDemoLaunch = DEMO_MODE && Boolean(this.options.onLaunchDemo);
        this.playElements = this.makeButton(
            702,
            606,
            hasDemoLaunch ? 96 : 196,
            46,
            hasDemoLaunch ? "PLAY" : "PLAY QUEST",
            () => this.launch(),
        );
        this.demoElements = hasDemoLaunch
            ? this.makeButton(802, 606, 96, 46, "DEMO", () => this.launchDemo(), 8)
            : [];
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

    private isDemoAvailable(
        mode: AdventureModeId,
    ): mode is Exclude<AdventureModeId, "afk-farm"> {
        return Boolean(
            DEMO_MODE &&
            this.options.onLaunchDemo &&
            mode !== "afk-farm" &&
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
        for (const object of this.demoElements) {
            (
                object as Phaser.GameObjects.GameObject & {
                    setVisible: (v: boolean) => unknown;
                }
            ).setVisible(this.isDemoAvailable(this.selected));
        }
    }

    private launchDemo(): void {
        if (!this.opened || !this.isDemoAvailable(this.selected)) return;
        const chosen = this.selected;
        this.close();
        this.options.onLaunchDemo?.(chosen);
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

        // Real Phaser Graphics scene — not an imported thumbnail. Drawn once.
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

    // ------------------------------------------------------------------
    // CINEMATIC PREVIEW TOOLKIT — static, drawn once, always clipped
    // ------------------------------------------------------------------

    /** Clipped pixel rectangle: nothing can escape the preview window. */
    private pr(
        g: Graphic,
        x: number,
        y: number,
        w: number,
        h: number,
        c: number,
        a = 1,
    ): void {
        const x0 = Math.max(0, Math.round(x)),
            y0 = Math.max(0, Math.round(y));
        const x1 = Math.min(PREVIEW_W, Math.round(x + w)),
            y1 = Math.min(PREVIEW_H, Math.round(y + h));
        if (x1 > x0 && y1 > y0) this.rect(g, x0, y0, x1 - x0, y1 - y0, c, a);
    }

    /** 2px checkerboard: the classic pixel-art stand-in for a gradient. */
    private dither(
        g: Graphic,
        x: number,
        y: number,
        w: number,
        h: number,
        c: number,
        a = 1,
        phase = 0,
    ): void {
        for (let yy = 0; yy < h; yy += 2) {
            const off = ((yy / 2 + phase) % 2) * 2;
            for (let xx = off; xx < w; xx += 4)
                this.pr(g, x + xx, y + yy, 2, 2, c, a);
        }
    }

    /** Stacked colour bands with dithered seams (sky, walls, fog). */
    private bands(
        g: Graphic,
        x: number,
        y: number,
        w: number,
        h: number,
        colors: readonly number[],
    ): void {
        const bh = Math.ceil(h / colors.length);
        colors.forEach((c, i) => {
            const by = y + i * bh;
            this.pr(g, x, by, w, Math.min(bh, y + h - by), c);
            if (i > 0) this.dither(g, x, by - 4, w, 4, c);
        });
    }

    /** Quantised elliptical light pool; layered alpha brightens the centre. */
    private pool(
        g: Graphic,
        cx: number,
        cy: number,
        rx: number,
        ry: number,
        c: number,
        a = 0.1,
        levels = 4,
    ): void {
        for (let l = 0; l < levels; l++) {
            const k = 1 - l / levels,
                w = rx * k,
                h = ry * k;
            for (let dy = -h; dy < h; dy += 2) {
                const half = Math.floor(
                    w * Math.sqrt(Math.max(0, 1 - (dy / h) ** 2)),
                );
                if (half > 0) this.pr(g, cx - half, cy + dy, half * 2, 2, c, a);
            }
        }
    }

    private halfDisc(
        g: Graphic,
        cx: number,
        cy: number,
        r: number,
        c: number,
        a = 1,
    ): void {
        for (let dy = -r; dy < 0; dy += 2) {
            const half = Math.floor(Math.sqrt(r * r - dy * dy));
            this.pr(g, cx - half, cy + dy, half * 2, 2, c, a);
        }
    }

    private ray(
        g: Graphic,
        x0: number,
        y0: number,
        x1: number,
        y1: number,
        w0: number,
        w1: number,
        c: number,
        a: number,
    ): void {
        for (let y = y0; y < y1; y += 2) {
            const t = (y - y0) / (y1 - y0);
            const w = w0 + (w1 - w0) * t;
            this.pr(
                g,
                x0 + (x1 - x0) * t - w / 2,
                y,
                w,
                2,
                c,
                a * (1 - t * 0.6),
            );
        }
    }

    private arc(
        g: Graphic,
        cx: number,
        cy: number,
        r: number,
        a0: number,
        a1: number,
        c: number,
        a: number,
        t = 3,
    ): void {
        for (let ang = a0; ang <= a1; ang += 0.05)
            this.pr(
                g,
                cx + Math.cos(ang) * r,
                cy + Math.sin(ang) * r,
                t,
                t,
                c,
                a,
            );
    }

    private bricks(
        g: Graphic,
        x: number,
        y: number,
        w: number,
        h: number,
        mortar: number,
        hi: number,
        rng: Rng,
        bw = 18,
        bh = 9,
    ): void {
        for (let r = 0, yy = y; yy < y + h; r++, yy += bh) {
            this.pr(g, x, yy, w, 1, mortar, 0.85);
            const off = (r % 2) * (bw / 2);
            for (let xx = x - off; xx < x + w; xx += bw) {
                if (xx >= x)
                    this.pr(
                        g,
                        xx,
                        yy,
                        1,
                        Math.min(bh, y + h - yy),
                        mortar,
                        0.85,
                    );
                const bx = Math.max(x, xx);
                const bwid = Math.min(xx + bw, x + w) - bx - 2;
                if (bwid <= 0) continue;
                this.pr(g, bx + 1, yy + 1, bwid, 1, hi, 0.28);
                const roll = rng.frac();
                if (roll > 0.72)
                    this.pr(g, bx + 1, yy + 2, bwid, bh - 3, hi, 0.1);
                else if (roll < 0.18)
                    this.pr(g, bx + 1, yy + 2, bwid, bh - 3, 0x000000, 0.18);
            }
        }
    }

    private perspectiveFloor(
        g: Graphic,
        vx: number,
        vy: number,
        rows: readonly number[],
        c: number,
        a: number,
    ): void {
        for (const ry of rows) this.pr(g, 0, ry, PREVIEW_W, 1, c, a);
        for (let xb = -160; xb <= 400; xb += 48)
            for (let y = rows[0]; y < PREVIEW_H; y += 2)
                this.pr(
                    g,
                    vx + ((xb - vx) * (y - vy)) / (PREVIEW_H - vy),
                    y,
                    1,
                    2,
                    c,
                    a,
                );
    }

    private flame(g: Graphic, x: number, y: number, glow = 0.07): void {
        this.pool(g, x, y - 6, 40, 32, 0xff9a3c, glow, 4);
        this.pr(g, x - 3, y, 6, 3, 0x3b2a1e);
        this.pr(g, x - 2, y + 3, 4, 8, 0x2a1d15);
        this.pr(g, x - 3, y - 6, 6, 6, 0xf97316);
        this.pr(g, x - 2, y - 10, 4, 6, 0xfbbf24);
        this.pr(g, x - 1, y - 13, 2, 5, 0xfff3b0);
        this.pr(g, x - 1, y - 4, 2, 3, 0xfff3b0);
    }

    private embers(
        g: Graphic,
        rng: Rng,
        n: number,
        x: number,
        y: number,
        w: number,
        h: number,
        colors: readonly number[],
    ): void {
        for (let i = 0; i < n; i++) {
            const ex = x + rng.frac() * w,
                ey = y + rng.frac() * h;
            const c = colors[Math.floor(rng.frac() * colors.length)];
            const big = rng.frac() > 0.7;
            this.pr(
                g,
                ex,
                ey,
                big ? 3 : 2,
                big ? 3 : 2,
                c,
                0.55 + rng.frac() * 0.45,
            );
            if (big) this.pr(g, ex + 1, ey + 4, 1, 2, c, 0.4);
        }
    }

    private vine(
        g: Graphic,
        x: number,
        y: number,
        len: number,
        dark = 0x1b5e34,
        light = 0x38a85a,
    ): void {
        for (let i = 0; i < len; i += 2) {
            const vx = x + Math.round(Math.sin(i * 0.45) * 2);
            this.pr(g, vx, y + i, 2, 2, dark);
            if (i % 6 === 0) {
                this.pr(g, vx + 2, y + i, 4, 2, light);
                this.pr(g, vx - 3, y + i + 2, 3, 2, dark);
            }
        }
    }

    private fern(
        g: Graphic,
        x: number,
        y: number,
        dir: 1 | -1,
        n: number,
        c: number,
    ): void {
        for (let i = 0; i < n; i++) {
            const px = x + dir * i * 3,
                py = y - i * 3 + Math.floor(i * i * 0.18);
            this.pr(g, px, py, 5, 2, c);
            this.pr(g, px, py + 2, 2, 4, c);
            this.pr(g, px + dir * 3, py - 2, 3, 2, c);
        }
    }

    private vignette(g: Graphic, tint: number, k = 1): void {
        for (let i = 0; i < 6; i++) {
            const o = i * 5,
                a = 0.2 * (1 - i / 6) * k;
            this.pr(g, o, o, PREVIEW_W - 2 * o, 5, tint, a);
            this.pr(g, o, PREVIEW_H - o - 5, PREVIEW_W - 2 * o, 5, tint, a);
            this.pr(g, o, o + 5, 5, PREVIEW_H - 2 * o - 10, tint, a);
            this.pr(
                g,
                PREVIEW_W - o - 5,
                o + 5,
                5,
                PREVIEW_H - 2 * o - 10,
                tint,
                a,
            );
        }
    }

    private spark(g: Graphic, x: number, y: number): void {
        this.pool(g, x, y, 16, 14, 0xfff1b8, 0.18, 3);
        this.pr(g, x - 1, y - 8, 3, 17, 0xffffff);
        this.pr(g, x - 8, y - 1, 17, 3, 0xffffff);
        this.pr(g, x - 5, y - 5, 2, 2, 0xfde68a);
        this.pr(g, x + 4, y - 5, 2, 2, 0xfde68a);
        this.pr(g, x - 5, y + 4, 2, 2, 0xfde68a);
        this.pr(g, x + 4, y + 4, 2, 2, 0xfde68a);
    }

    // -- Quest Finding: THE LOST EXPEDITION ----------------------------------
    // Cool blue ruin, a golden doorway full of light, one lone explorer.
    private drawQuestPreview(g: Graphic): void {
        const rng = new Phaser.Math.RandomDataGenerator(["qf-lost-expedition"]);
        const W = PREVIEW_W,
            H = PREVIEW_H,
            cx = 117;
        // Back wall in cool blue shadow.
        this.bands(
            g,
            0,
            0,
            W,
            116,
            [0x08111f, 0x0b1628, 0x0f1d33, 0x14263f, 0x193049],
        );
        this.bricks(g, 0, 0, W, 116, 0x050b16, 0x5b7fb0, rng);
        // Doorway: stone arch, voussoir joints, light-filled opening.
        this.halfDisc(g, cx, 56, 36, 0x3b4d6b);
        this.halfDisc(g, cx, 56, 34, 0x53698c);
        this.halfDisc(g, cx, 56, 24, 0x2b7a86);
        this.pr(g, cx - 36, 56, 12, 60, 0x3b4d6b);
        this.pr(g, cx + 24, 56, 12, 60, 0x3b4d6b);
        this.pr(g, cx - 34, 56, 8, 60, 0x53698c);
        this.pr(g, cx + 26, 56, 8, 60, 0x53698c);
        for (let a = -2.62; a <= -0.5; a += 0.35)
            for (let r = 24; r <= 36; r += 2)
                this.pr(
                    g,
                    cx + Math.cos(a) * r,
                    56 + Math.sin(a) * r,
                    1,
                    2,
                    0x0b1424,
                    0.9,
                );
        for (let yy = 62; yy < 116; yy += 10) {
            this.pr(g, cx - 36, yy, 12, 1, 0x0b1424, 0.9);
            this.pr(g, cx + 24, yy, 12, 1, 0x0b1424, 0.9);
        }
        this.bands(
            g,
            cx - 24,
            56,
            48,
            60,
            [0x2b7a86, 0x4fb0a0, 0x9ad4a0, 0xe8d98a, 0xfff0b8],
        );
        this.pr(g, cx - 24, 56, 2, 60, 0xfde68a, 0.5);
        this.pr(g, cx + 22, 56, 2, 60, 0xfde68a, 0.5);
        this.pr(g, cx - 14, 72, 4, 44, 0x1f5f6b, 0.8); // distant colonnade
        this.pr(g, cx + 10, 72, 4, 44, 0x1f5f6b, 0.8);
        this.pr(g, cx - 5, 18, 10, 10, 0x7a8fae); // keystone with glyph
        this.pr(g, cx - 1, 20, 2, 5, 0x67e8f9);
        // Glowing artefact on a pedestal: the focal point.
        this.pool(g, cx, 96, 30, 24, 0x9ff7ff, 0.12, 5);
        this.pr(g, cx - 6, 104, 12, 9, 0x4a5d7c);
        this.pr(g, cx - 4, 104, 8, 2, 0x8aa0c4);
        this.pr(g, cx - 3, 94, 6, 7, 0xffffff);
        this.pr(g, cx - 2, 92, 4, 2, 0xcffafe);
        // Pillars: left intact with capital, right broken.
        for (const [px, top] of [
            [10, 22],
            [202, 50],
        ] as const) {
            this.pr(g, px, top, 24, 116 - top, 0x2a3a57);
            this.pr(g, px, top, 5, 116 - top, 0x1a2640);
            this.pr(g, px + 18, top, 6, 116 - top, 0x4a6286);
            for (let yy = top + 8; yy < 114; yy += 14)
                this.pr(g, px, yy, 24, 1, 0x0b1424, 0.9);
        }
        this.pr(g, 6, 16, 32, 8, 0x3b4d6b);
        this.pr(g, 6, 16, 32, 2, 0x6b88b3);
        this.pr(g, 198, 46, 12, 4, 0x1a2640); // chipped edge
        this.pr(g, 214, 46, 12, 5, 0x1a2640);
        this.pr(g, 204, 108, 8, 6, 0x34476a); // fallen chunks
        this.pr(g, 216, 110, 10, 5, 0x2a3a57);
        // Warm torchlight from the wall brackets, cool shadow elsewhere.
        this.flame(g, 62, 70, 0.08);
        this.flame(g, 172, 70, 0.08);
        this.pool(g, 62, 74, 34, 30, 0xff9a3c, 0.06, 4);
        this.pool(g, 172, 74, 34, 30, 0xff9a3c, 0.06, 4);
        // Overgrowth.
        for (const [vx, vy, len] of [
            [90, 30, 26],
            [100, 22, 14],
            [142, 24, 30],
            [134, 30, 12],
            [20, 24, 44],
            [30, 24, 20],
            [212, 50, 24],
            [222, 52, 14],
        ] as const)
            this.vine(g, vx, vy, len);
        this.pr(g, 6, 14, 32, 3, 0x2f8f4a);
        this.pr(g, 10, 17, 10, 2, 0x38a85a);
        this.pr(g, 198, 44, 30, 3, 0x2f8f4a);
        // Floor with perspective flagstones.
        this.bands(
            g,
            0,
            116,
            W,
            H - 116,
            [0x0f1a2c, 0x101c30, 0x0e1829, 0x0a1220],
        );
        this.perspectiveFloor(
            g,
            cx,
            98,
            [116, 128, 142, 160, 182],
            0x050a14,
            0.8,
        );
        for (let i = 0; i < 42; i++)
            this.pr(
                g,
                rng.frac() * W,
                120 + rng.frac() * 84,
                4,
                1,
                0x6b8bb8,
                0.28,
            );
        // Golden path spilling from the doorway.
        for (let y = 116; y < H; y += 2) {
            const half = 20 + (y - 116) * 0.5;
            this.pr(
                g,
                cx - half,
                y,
                half * 2,
                2,
                0xfbd38d,
                Math.max(0.03, 0.14 - (y - 116) * 0.0009),
            );
        }
        this.pool(g, cx, 148, 74, 40, 0xfde68a, 0.07, 5);
        this.dither(g, 0, 124, 54, 82, 0x050a1c, 0.3);
        this.dither(g, 184, 124, 50, 82, 0x050a1c, 0.3, 1);
        this.ray(g, cx - 12, 58, cx - 44, 170, 8, 22, 0xfde68a, 0.07);
        this.ray(g, cx + 12, 58, cx + 46, 170, 8, 22, 0xfde68a, 0.07);
        // Scattered manuscripts, one with a glowing clue.
        for (const [sx, sy] of [
            [58, 176],
            [156, 168],
            [92, 194],
            [188, 190],
        ] as const) {
            this.pr(g, sx + 1, sy + 9, 15, 2, 0x000000, 0.4);
            this.pr(g, sx, sy, 14, 9, 0xe7cf93);
            this.pr(g, sx, sy, 14, 1, 0xfff0c0);
            this.pr(g, sx - 1, sy, 2, 9, 0xc9a461);
            this.pr(g, sx + 3, sy + 3, 8, 1, 0x8a5a2a);
            this.pr(g, sx + 3, sy + 5, 6, 1, 0x8a5a2a);
        }
        this.pool(g, 64, 166, 18, 16, 0x7df3e6, 0.14, 4);
        this.star(g, 64, 164, 0x7df3e6);
        // Lone explorer, seen from behind, lantern in hand.
        const x = 108,
            y = 176;
        this.pool(g, x, y - 2, 12, 3, 0x02060d, 0.5, 3);
        this.pool(g, x - 14, y - 14, 26, 20, 0xffc866, 0.12, 4);
        this.pr(g, x - 6, y - 5, 5, 5, 0x2b1b12);
        this.pr(g, x + 1, y - 5, 5, 5, 0x2b1b12);
        this.pr(g, x - 5, y - 13, 4, 8, 0x2a3547);
        this.pr(g, x + 1, y - 13, 4, 8, 0x1f2937);
        this.pr(g, x - 8, y - 26, 16, 13, 0x3b82c4);
        this.pr(g, x + 3, y - 26, 5, 13, 0x2b5f98);
        this.pr(g, x - 9, y - 14, 18, 2, 0x1f4d7a);
        this.pr(g, x - 8, y - 26, 16, 1, 0xfde68a, 0.8);
        this.pr(g, x - 7, y - 25, 2, 11, 0x7c4a1e);
        this.pr(g, x + 5, y - 19, 6, 7, 0x8b5a2b);
        this.pr(g, x + 5, y - 19, 6, 2, 0xb07a45);
        this.pr(g, x - 11, y - 25, 3, 10, 0x3b82c4);
        this.pr(g, x + 8, y - 25, 3, 9, 0x2b5f98);
        this.pr(g, x - 11, y - 15, 3, 3, 0xf1c9a3);
        this.pr(g, x - 16, y - 13, 6, 7, 0x7c4a1e);
        this.pr(g, x - 15, y - 12, 4, 5, 0xffe08a);
        this.pr(g, x - 14, y - 15, 2, 3, 0x7c4a1e);
        this.pr(g, x - 5, y - 32, 10, 6, 0x1b2740);
        this.pr(g, x - 2, y - 27, 4, 2, 0xd8a77d);
        this.pr(g, x - 8, y - 33, 16, 2, 0x6b4423);
        this.pr(g, x - 5, y - 39, 10, 6, 0x8b5a2b);
        this.pr(g, x - 5, y - 34, 10, 1, C.gold);
        this.pr(g, x - 5, y - 39, 10, 1, 0xc08a52);
        // Drifting dust and foreground silhouettes with cold rim light.
        this.embers(
            g,
            rng,
            20,
            40,
            90,
            150,
            100,
            [0xfde68a, 0xffffff, 0xfbd38d],
        );
        this.pr(g, 0, 172, 30, 34, 0x03060c);
        this.pr(g, 4, 164, 20, 10, 0x03060c);
        this.pr(g, 4, 164, 20, 1, 0x2a4a6a, 0.8);
        this.pr(g, 0, 172, 1, 34, 0x2a4a6a, 0.5);
        this.fern(g, W - 2, H, -1, 10, 0x040810);
        this.fern(g, W - 16, H, -1, 7, 0x040810);
        this.fern(g, 34, H, 1, 6, 0x040810);
        this.vine(g, 4, 0, 34, 0x06110f, 0x0a2418);
        this.vine(g, 226, 0, 26, 0x06110f, 0x0a2418);
        this.vignette(g, 0x02050e, 1.1);
    }

    // -- Dungeon Conquer: THE FINAL ENCOUNTER --------------------------------
    // Torchlit ruined arena, a glowing blade clashing with a horned brute.
    private drawDungeonPreview(g: Graphic): void {
        const rng = new Phaser.Math.RandomDataGenerator(["dc-final-encounter"]);
        const W = PREVIEW_W,
            H = PREVIEW_H,
            cx = 117;
        this.bands(g, 0, 0, W, 110, [0x05060d, 0x0a0b17, 0x120f20, 0x1a1428]);
        this.bricks(g, 0, 0, W, 110, 0x04040a, 0x4a3d6b, rng);
        // Great portcullis gate, red glow behind it.
        this.halfDisc(g, cx, 50, 42, 0x2a2240);
        this.pr(g, cx - 42, 50, 84, 60, 0x2a2240);
        this.halfDisc(g, cx, 50, 38, 0x020207);
        this.pr(g, cx - 38, 50, 76, 60, 0x020207);
        this.pool(g, cx, 100, 52, 22, 0xb91c1c, 0.13, 4);
        for (let bx = cx - 32; bx <= cx + 32; bx += 9) {
            this.pr(g, bx, 22, 3, 88, 0x1f1a2e);
            this.pr(g, bx, 22, 1, 88, 0x4a3d6b, 0.6);
        }
        for (const by of [48, 66, 84, 100])
            this.pr(g, cx - 38, by, 76, 3, 0x1f1a2e);
        // Pillars: left intact, right shattered.
        this.pr(g, 6, 18, 24, 92, 0x241d38);
        this.pr(g, 24, 18, 6, 92, 0x4a3d6b);
        this.pr(g, 2, 12, 32, 8, 0x30264a);
        this.pr(g, 206, 46, 24, 64, 0x241d38);
        this.pr(g, 206, 46, 4, 64, 0x120e20);
        this.pr(g, 212, 40, 8, 8, 0x241d38);
        // Directional torchlight: strong from the left, weaker from the right.
        this.flame(g, 42, 64, 0.1);
        this.flame(g, 192, 64, 0.05);
        this.pool(g, 40, 70, 56, 46, 0xff8a2a, 0.06, 4);
        // Cracked flagstone arena.
        this.bands(
            g,
            0,
            110,
            W,
            H - 110,
            [0x15111f, 0x181322, 0x120e1a, 0x0d0a14],
        );
        this.perspectiveFloor(
            g,
            cx,
            92,
            [110, 122, 136, 154, 178],
            0x05030b,
            0.85,
        );
        for (let i = 0; i < 36; i++)
            this.pr(
                g,
                rng.frac() * W,
                114 + rng.frac() * 90,
                4,
                1,
                0x6b5a96,
                0.22,
            );
        this.pool(g, 52, 156, 76, 38, 0xff8a2a, 0.07, 5);
        for (let a = 0; a < Math.PI * 2; a += 0.05) {
            this.pr(
                g,
                cx + Math.cos(a) * 94,
                172 + Math.sin(a) * 22,
                2,
                2,
                0x7c5cc4,
                0.3,
            );
            this.pr(
                g,
                cx + Math.cos(a) * 70,
                172 + Math.sin(a) * 16,
                2,
                2,
                0x7c5cc4,
                0.22,
            );
        }
        // Fissure with molten glow beneath the monster.
        const fissure: Array<[number, number]> = [
            [112, 190],
            [128, 184],
            [142, 188],
            [158, 180],
            [176, 184],
            [198, 178],
            [222, 184],
        ];
        for (let i = 0; i < fissure.length - 1; i++) {
            const [ax, ay] = fissure[i],
                [bx, by] = fissure[i + 1];
            for (let t = 0; t < 1; t += 0.12) {
                const fx = ax + (bx - ax) * t,
                    fy = ay + (by - ay) * t;
                this.pr(g, fx - 1, fy - 1, 5, 4, 0x07040c);
                this.pr(g, fx + 1, fy, 2, 1, 0xff7a1a);
                if (rng.frac() > 0.7)
                    this.pr(g, fx + 1, fy - 1, 1, 1, 0xffd27a);
            }
        }
        this.pool(g, 170, 182, 62, 14, 0xff5a1f, 0.09, 4);
        for (const [sx, sy, len, dx] of [
            [40, 140, 14, 1],
            [30, 176, 12, 1],
            [214, 150, 12, -1],
            [96, 196, 10, 1],
        ] as const) {
            let fx = sx,
                fy = sy;
            for (let i = 0; i < len; i++) {
                this.pr(g, fx, fy, 2, 2, 0x04030a);
                fx += dx * (1 + Math.floor(rng.frac() * 2));
                fy += rng.frac() > 0.5 ? 2 : -1;
            }
        }
        // The brute: horned, hulking, rim-lit orange from the left.
        const mx = 170;
        this.pool(g, mx, 168, 38, 5, 0x020106, 0.6, 3);
        this.pr(g, mx - 21, 146, 14, 22, 0x1b1626);
        this.pr(g, mx + 7, 146, 14, 22, 0x1b1626);
        this.pr(g, mx - 25, 164, 22, 6, 0x120e1a);
        this.pr(g, mx + 3, 164, 22, 6, 0x120e1a);
        this.pr(g, mx - 26, 100, 52, 50, 0x241a33);
        this.pr(g, mx - 26, 100, 3, 50, 0xc2672a, 0.75);
        this.pr(g, mx - 20, 122, 40, 3, 0x120e1a);
        this.pr(g, mx - 20, 134, 40, 3, 0x120e1a);
        for (const [cxp, cyp] of [
            [mx - 2, 108],
            [mx, 114],
            [mx - 2, 120],
            [mx + 1, 126],
            [mx - 1, 132],
        ] as const)
            this.pr(g, cxp, cyp, 3, 6, 0xff5a1f);
        this.pool(g, mx, 120, 20, 22, 0xff5a1f, 0.1, 3);
        this.pr(g, mx - 34, 96, 18, 14, 0x30243f);
        this.pr(g, mx + 16, 96, 18, 14, 0x30243f);
        this.pr(g, mx - 34, 96, 18, 2, 0xc2672a, 0.6);
        this.pr(g, mx - 32, 90, 4, 8, 0x4a3a5c);
        this.pr(g, mx + 28, 90, 4, 8, 0x4a3a5c);
        this.pr(g, mx - 36, 110, 12, 26, 0x2a1f3a); // reaching arm
        this.pr(g, mx - 42, 134, 16, 14, 0x30243f);
        for (let k = 0; k < 3; k++)
            this.pr(g, mx - 42 + k * 5, 146, 3, 6, 0xd9d3e8);
        this.pr(g, mx + 24, 110, 12, 32, 0x2a1f3a);
        this.pr(g, mx + 24, 140, 14, 12, 0x30243f);
        for (let k = 0; k < 3; k++)
            this.pr(g, mx + 24 + k * 5, 150, 3, 6, 0xd9d3e8);
        this.pr(g, mx - 14, 78, 28, 24, 0x2d2140);
        this.pr(g, mx - 14, 78, 28, 2, 0xc2672a, 0.5);
        this.pr(g, mx - 18, 68, 5, 16, 0xcfc3a6);
        this.pr(g, mx - 20, 62, 4, 8, 0xe8e0c8);
        this.pr(g, mx + 13, 68, 5, 16, 0xcfc3a6);
        this.pr(g, mx + 16, 62, 4, 8, 0xe8e0c8);
        this.pr(g, mx - 12, 96, 24, 8, 0x1a1325);
        for (let k = 0; k < 4; k++)
            this.pr(g, mx - 10 + k * 6, 96, 3, 4, 0xf1efe0);
        this.pool(g, mx - 6, 88, 16, 11, 0xff2a1a, 0.16, 3);
        this.pool(g, mx + 8, 88, 16, 11, 0xff2a1a, 0.16, 3);
        this.pr(g, mx - 9, 86, 6, 4, 0xff3b1d);
        this.pr(g, mx + 3, 86, 6, 4, 0xff3b1d);
        this.pr(g, mx - 7, 87, 2, 2, 0xfff1c4);
        this.pr(g, mx + 5, 87, 2, 2, 0xfff1c4);
        // The hero: lunging, cape streaming, blade ablaze.
        const hx = 80,
            hy = 170;
        this.pool(g, hx + 2, hy, 20, 4, 0x020106, 0.6, 3);
        this.pr(g, hx - 9, hy - 14, 5, 12, 0x2a3547);
        this.pr(g, hx - 12, hy - 4, 8, 4, 0x2b1b12);
        this.pr(g, hx + 2, hy - 15, 6, 10, 0x334155);
        this.pr(g, hx + 2, hy - 5, 10, 5, 0x2b1b12);
        this.pr(g, hx - 16, hy - 29, 10, 18, 0x1e3a8a);
        this.pr(g, hx - 22, hy - 25, 7, 14, 0x1e3a8a);
        this.pr(g, hx - 27, hy - 19, 6, 9, 0x172e6e);
        this.pr(g, hx - 16, hy - 29, 10, 1, 0x60a5fa, 0.7);
        this.pr(g, hx - 6, hy - 30, 13, 16, 0x3b82c4);
        this.pr(g, hx + 6, hy - 30, 2, 16, 0x7dd3fc, 0.75);
        this.pr(g, hx - 6, hy - 16, 13, 2, 0x7c4a1e);
        this.pr(g, hx - 1, hy - 16, 3, 2, C.gold);
        this.pr(g, hx - 5, hy - 40, 11, 11, 0xf1c9a3);
        this.pr(g, hx - 6, hy - 42, 13, 5, 0x202b3f);
        this.pr(g, hx - 7, hy - 38, 4, 8, 0x202b3f);
        this.pr(g, hx - 6, hy - 38, 12, 1, C.gold);
        this.pr(g, hx + 2, hy - 36, 2, 2, 0x111827);
        this.pr(g, hx + 5, hy - 30, 12, 4, 0x3b82c4);
        this.pr(g, hx + 16, hy - 31, 4, 5, 0xf1c9a3);
        this.pool(g, hx + 36, hy - 31, 46, 24, 0x67e8f9, 0.1, 4);
        this.pr(g, hx + 17, hy - 35, 3, 9, 0xfbbf24);
        this.pr(g, hx + 20, hy - 32, 32, 4, 0xe8f6ff);
        this.pr(g, hx + 20, hy - 31, 32, 2, 0xffffff);
        this.pr(g, hx + 20, hy - 35, 32, 1, 0x67e8f9, 0.8);
        this.pr(g, hx + 20, hy - 28, 32, 1, 0x67e8f9, 0.8);
        this.pr(g, hx + 52, hy - 31, 3, 2, 0xffffff);
        this.arc(g, hx + 22, hy - 30, 34, -1.15, 0.5, 0xffffff, 0.75, 3);
        this.arc(g, hx + 22, hy - 30, 30, -1.05, 0.4, 0x67e8f9, 0.5, 3);
        this.arc(g, hx + 22, hy - 30, 38, -0.95, 0.3, 0x67e8f9, 0.3, 2);
        this.spark(g, mx - 38, hy - 32); // blade meets claw
        // Embers, ground fog, debris and heavy foreground shadow.
        this.embers(
            g,
            rng,
            30,
            20,
            40,
            196,
            150,
            [0xff9a3c, 0xfbbf24, 0xff6a2a, 0xffd27a],
        );
        for (let y = 176; y < H; y += 6)
            this.dither(g, 0, y, W, 4, 0x8b7cc0, 0.05, (y / 6) % 2);
        for (const [dx, dy, dw, dh] of [
            [124, 196, 8, 4],
            [140, 200, 6, 3],
            [60, 192, 7, 4],
            [194, 196, 9, 4],
        ] as const) {
            this.pr(g, dx, dy, dw, dh, 0x2a2240);
            this.pr(g, dx, dy, dw, 1, 0x5a4a86, 0.7);
        }
        this.pr(g, 0, 178, 26, 28, 0x030208);
        this.pr(g, 4, 170, 14, 10, 0x030208);
        this.pr(g, 4, 170, 14, 1, 0xc2672a, 0.5);
        this.pr(g, 208, 182, 26, 24, 0x030208);
        this.pr(g, 214, 174, 14, 10, 0x030208);
        this.vignette(g, 0x020106, 1.35);
    }

    // -- AFK Farm: THE GROWING KINGDOM ---------------------------------------
    // Sunset over a cosy workshop village and layered crop fields.
    private drawFarmPreview(g: Graphic): void {
        const rng = new Phaser.Math.RandomDataGenerator([
            "afk-growing-kingdom",
        ]);
        const W = PREVIEW_W,
            H = PREVIEW_H;
        this.bands(
            g,
            0,
            0,
            W,
            80,
            [
                0x2a2060, 0x4a2a78, 0x8a3b82, 0xc9507a, 0xf27a5a, 0xffa95a,
                0xffd27a,
            ],
        );
        for (let i = 0; i < 14; i++)
            this.pr(g, rng.frac() * W, rng.frac() * 26, 1, 1, 0xffffff, 0.7);
        this.pool(g, 176, 66, 90, 46, 0xffd27a, 0.1, 5);
        this.halfDisc(g, 176, 70, 22, 0xfff3b0);
        this.halfDisc(g, 176, 70, 14, 0xffffff, 0.55);
        for (const [cxp, cyp, cw] of [
            [16, 30, 44],
            [92, 18, 38],
            [150, 38, 50],
            [196, 14, 30],
        ] as const) {
            this.pr(g, cxp + 2, cyp + 3, cw - 6, 2, 0xb2476f, 0.8);
            this.pr(g, cxp, cyp, cw, 3, 0xffc29a);
            this.pr(g, cxp + 4, cyp - 3, cw - 12, 3, 0xffe2b8);
        }
        for (const [bx, by] of [
            [118, 44],
            [128, 52],
            [108, 56],
        ] as const) {
            this.pr(g, bx, by, 3, 1, 0x2a1a40);
            this.pr(g, bx + 3, by - 1, 3, 1, 0x2a1a40);
            this.pr(g, bx + 6, by, 3, 1, 0x2a1a40);
        }
        const hills = (
            base: number,
            amp: number,
            f1: number,
            f2: number,
            c: number,
            top: number,
        ): void => {
            for (let x = 0; x < W; x += 2) {
                const h =
                    amp +
                    Math.sin(x * f1) * amp * 0.5 +
                    Math.sin(x * f2 + 1) * amp * 0.25;
                this.pr(g, x, base - h, 2, h + 12, c);
                this.pr(g, x, base - h, 2, 1, top, 0.5);
            }
        };
        hills(80, 14, 0.04, 0.11, 0x4a2f6e, 0xc9507a);
        hills(90, 10, 0.06, 0.15, 0x33375f, 0xf27a5a);
        this.bands(g, 0, 94, W, 26, [0x5b8a3c, 0x477a37, 0x356a34]);
        for (let i = 0; i < 12; i++) {
            const tx = 8 + i * 20 + rng.frac() * 10;
            this.pr(g, tx, 84, 8, 8, 0x1f4a34);
            this.pr(g, tx + 1, 82, 6, 4, 0x2b6b43);
            this.pr(g, tx + 6, 82, 2, 8, 0x3a8a50, 0.7);
        }
        // Workshop: red roof, plank walls, glowing windows, chimney smoke.
        for (let y = 48; y < 72; y += 2) {
            const half = 6 + (y - 48) * 1.5;
            this.pr(g, 48 - half, y, half, 2, 0x8e3033);
            this.pr(g, 48, y, half, 2, 0xc9503f);
            if ((y - 48) % 6 === 0)
                this.pr(g, 48 - half, y, half * 2, 1, 0x5e1e24, 0.7);
        }
        this.pr(g, 46, 46, 4, 3, 0xe0705a);
        this.pr(g, 66, 40, 8, 16, 0x6a4a38);
        this.pr(g, 65, 38, 10, 3, 0x3a2a22);
        for (const [sx, sy, sz, sa] of [
            [68, 30, 5, 0.55],
            [73, 23, 7, 0.45],
            [80, 16, 9, 0.35],
            [90, 10, 11, 0.25],
        ] as const)
            this.pr(g, sx, sy, sz, sz - 1, 0xc9b6d8, sa);
        this.pr(g, 10, 72, 76, 40, 0x7a4524);
        this.dither(g, 56, 72, 30, 40, 0xe08a3a, 0.35);
        for (let x = 16; x < 86; x += 6)
            this.pr(g, x, 72, 1, 40, 0x4d2a14, 0.8);
        this.pr(g, 10, 72, 4, 40, 0x4d2a14);
        this.pr(g, 82, 72, 4, 40, 0x4d2a14);
        this.pr(g, 10, 96, 76, 3, 0x4d2a14);
        for (const wx of [16, 62] as const) {
            this.pool(g, wx + 7, 88, 22, 16, 0xffc23a, 0.1, 3);
            this.pr(g, wx - 2, 80, 18, 16, 0x3a2010);
            this.pr(g, wx, 82, 14, 12, 0xffd36a);
            this.pr(g, wx + 6, 82, 2, 12, 0x3a2010);
            this.pr(g, wx, 82, 14, 2, 0xfff1b8, 0.7);
        }
        this.pr(g, 38, 86, 16, 26, 0x2c170c);
        this.pr(g, 50, 99, 2, 3, C.gold);
        this.pr(g, 40, 74, 12, 8, 0x3a2010);
        this.pr(g, 43, 75, 6, 6, C.gold);
        this.pr(g, 45, 77, 2, 2, 0x3a2010);
        // Storage shed with hay.
        for (let y = 70; y < 82; y += 2)
            this.pr(
                g,
                126 + (y - 70) * 0.5,
                y,
                54 - (y - 70),
                2,
                y % 4 === 0 ? 0x7a3a2e : 0x8e4638,
            );
        this.pr(g, 130, 82, 46, 30, 0x6a3c20);
        this.dither(g, 156, 82, 20, 30, 0xe08a3a, 0.3);
        this.pr(g, 144, 92, 16, 20, 0x1d0f08);
        this.pr(g, 146, 102, 12, 6, 0xe9b949);
        // Fence.
        this.pr(g, 88, 112, 146, 2, 0x5a3418);
        this.pr(g, 88, 117, 146, 2, 0x5a3418);
        for (let x = 92; x < W; x += 14) {
            this.pr(g, x, 106, 3, 18, 0x6a3f20);
            this.pr(g, x, 106, 3, 1, 0xd98a45);
        }
        // Farmland in perspective, crops in growth stages, long evening shadows.
        this.bands(
            g,
            0,
            120,
            W,
            H - 120,
            [0x4a2c1b, 0x43271a, 0x3b2116, 0x331c12],
        );
        this.dither(g, 150, 120, 84, 86, 0xff9a3c, 0.07);
        const rowsY = [128, 138, 149, 161, 174, 188, 202];
        const kinds = [
            "wheat",
            "wheat",
            "carrot",
            "carrot",
            "pumpkin",
            "cabbage",
            "pumpkin",
        ] as const;
        rowsY.forEach((ry, i) => {
            const s = 1 + i * 0.2;
            this.pr(g, 0, ry + 1, W, Math.round(2 + s), 0x2a160d, 0.7);
            this.pr(g, 0, ry - 1, W, 1, 0x8a5230, 0.5);
            const spacing = 18 + s * 7;
            for (let x = 8 + (i % 2) * 9; x < W; x += spacing) {
                this.pr(
                    g,
                    x - 6 * s,
                    ry,
                    10 * s,
                    Math.max(1, s),
                    0x120a08,
                    0.4,
                );
                if (kinds[i] === "wheat") {
                    this.pr(g, x - 2 * s, ry - 6 * s, s, 6 * s, 0xd9a53a);
                    this.pr(g, x, ry - 8 * s, s, 8 * s, 0xe9b949);
                    this.pr(g, x + 2 * s, ry - 6 * s, s, 6 * s, 0xd9a53a);
                    this.pr(g, x - s, ry - 9 * s, 3 * s, 2 * s, 0xffe08a);
                } else if (kinds[i] === "carrot") {
                    this.pr(g, x - 2 * s, ry - 5 * s, 4 * s, 5 * s, 0x3fa34d);
                    this.pr(g, x - s, ry - 7 * s, 2 * s, 3 * s, 0x66d17a);
                    this.pr(g, x - s, ry - s, 2 * s, 2 * s, 0xf97316);
                } else if (kinds[i] === "pumpkin") {
                    this.pr(g, x - 4 * s, ry - 5 * s, 8 * s, 5 * s, 0xf08a24);
                    this.pr(g, x - s, ry - 5 * s, s, 5 * s, 0xb45309);
                    this.pr(g, x - 3 * s, ry - 5 * s, 2 * s, s, 0xffc46a);
                    this.pr(g, x, ry - 7 * s, s, 2 * s, 0x3f7a35);
                } else {
                    this.pr(g, x - 4 * s, ry - 5 * s, 8 * s, 5 * s, 0x6fbf73);
                    this.pr(g, x - 3 * s, ry - 6 * s, 6 * s, 2 * s, 0xa6e3a1);
                    this.pr(g, x - 4 * s, ry - s, 8 * s, s, 0x3b8a4a);
                }
            }
        });
        // Lantern posts with warm pools.
        for (const [lx, ly] of [
            [98, 136],
            [172, 142],
        ] as const) {
            this.pool(g, lx + 2, ly - 4, 34, 24, 0xffc23a, 0.1, 4);
            this.pr(g, lx, ly, 3, 28, 0x4d2a14);
            this.pr(g, lx - 3, ly - 3, 9, 9, 0x3a2010);
            this.pr(g, lx - 2, ly - 2, 7, 7, 0xffc23a);
            this.pr(g, lx - 1, ly - 1, 3, 3, 0xfff1b8);
        }
        // Farmer.
        const fx = 70,
            fy = 172;
        this.pr(g, fx - 12, fy, 22, 2, 0x120a08, 0.45);
        this.pr(g, fx + 5, fy - 22, 2, 20, 0x7a4a24);
        this.pr(g, fx + 3, fy - 23, 6, 3, 0xcbd5e1);
        this.pr(g, fx - 7, fy - 18, 14, 2, 0xe9c46a);
        this.pr(g, fx - 4, fy - 21, 8, 4, 0xf0d27a);
        this.pr(g, fx - 3, fy - 17, 6, 5, 0xf1c9a3);
        this.pr(g, fx - 4, fy - 12, 8, 8, 0x60a5fa);
        this.pr(g, fx + 2, fy - 12, 2, 8, 0x3b82c4);
        this.pr(g, fx - 3, fy - 4, 3, 4, 0x334155);
        this.pr(g, fx + 1, fy - 4, 3, 4, 0x334155);
        // Resource collection: crates, barrels, sacks and a glowing coin chest.
        const crate = (x: number, y: number, w: number, h: number): void => {
            this.pr(g, x, y, w, h, 0xa35b28);
            this.pr(g, x, y, w, 2, 0xd98a45);
            this.pr(g, x, y + h - 1, w, 1, 0x5a2d12);
            this.pr(g, x, y, 1, h, 0x5a2d12);
            this.pr(g, x + w - 1, y, 1, h, 0x5a2d12);
            this.pr(g, x + 2, y + 2, w - 4, 1, 0x5a2d12, 0.7);
            this.pr(g, x + w / 2, y, 1, h, 0x5a2d12, 0.7);
        };
        this.pool(g, 206, 176, 40, 26, 0xffa95a, 0.07, 4);
        this.pr(g, 180, 196, 50, 3, 0x120a08, 0.5);
        crate(184, 172, 26, 24);
        crate(210, 176, 22, 20);
        crate(192, 152, 24, 20);
        this.pr(g, 170, 162, 16, 24, 0x6b3b1a);
        this.pr(g, 170, 166, 16, 2, 0xb08a3a);
        this.pr(g, 170, 178, 16, 2, 0xb08a3a);
        this.pr(g, 181, 162, 3, 24, 0xa35b28, 0.5);
        this.pr(g, 216, 160, 14, 16, 0xd8c08a);
        this.pr(g, 218, 158, 10, 3, 0xb8a06a);
        this.pool(g, 138, 186, 34, 20, 0xfbbf24, 0.12, 4);
        this.pr(g, 126, 188, 28, 14, 0x5a2d12);
        this.pr(g, 126, 182, 28, 7, 0x8b4a1c);
        this.pr(g, 128, 178, 24, 6, C.gold);
        this.pr(g, 132, 176, 8, 3, 0xfff1b8);
        this.goldCoin(g, 150, 176);
        this.star(g, 160, 168);
        // Fireflies, foreground grass, warm vignette.
        this.embers(g, rng, 10, 20, 100, 190, 90, [0xfff3b0, 0xffd27a]);
        for (let x = 0; x < 44; x += 5)
            this.pr(g, x, H - 10 - rng.frac() * 12, 3, 24, 0x0f2a1b);
        this.pr(g, 0, H - 6, 46, 6, 0x0a1d12);
        this.vignette(g, 0x1a0a22, 0.8);
    }
}
