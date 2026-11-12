import * as Phaser from "phaser";

export type AdventureModeId = "quest-finding" | "dungeon-conquer" | "afk-farm";

export interface AdventurePortalUIOptions {
    onOpenChanged?: (open: boolean) => void;
    /** Optional future hook; modes remain unavailable without a real scene. */
    onLaunch?: (mode: AdventureModeId) => void;
    availableModes?: readonly AdventureModeId[];
}

const FONT = '"Press Start 2P", monospace';
const COLORS = {
    dark: 0x071120,
    navy: 0x101e32,
    card: 0x172b44,
    cardHover: 0x24445f,
    border: 0x3b6384,
    gold: 0xfbbf24,
    cyan: 0x55e8d5,
    white: 0xe2e8f0,
    muted: 0x94a3b8,
} as const;

type Mode = {
    id: AdventureModeId;
    title: string;
    category: string;
    summary: string;
    details: string;
    accent: number;
};

const MODES: readonly Mode[] = [
    {
        id: "quest-finding",
        title: "QUEST FINDING",
        category: "EXPLORE",
        summary: "Search a map for hidden clues.",
        details: "Explore a new area, locate clues, and solve environmental puzzles. Your learning-path knowledge will help uncover secrets.",
        accent: 0x7dd3fc,
    },
    {
        id: "dungeon-conquer",
        title: "DUNGEON CONQUER",
        category: "BATTLE",
        summary: "Dodge, fight, and clear rooms.",
        details: "Enter a compact combat dungeon, survive enemies, and solve knowledge-driven traps to defeat the final guardian.",
        accent: 0xfbbf24,
    },
    {
        id: "afk-farm",
        title: "AFK FARM",
        category: "MANAGE",
        summary: "Build an offline resource farm.",
        details: "Choose production upgrades, manage scarce resources, and collect capped in-game coins when you return. No real-money payouts.",
        accent: 0x55e8d5,
    },
];

/** Screen-space adventure mode selector. Game scenes are deliberately NOT faked. */
export class AdventurePortalUI {
    private readonly scene: Phaser.Scene;
    private readonly options: AdventurePortalUIOptions;
    private readonly root: Phaser.GameObjects.Container;
    private page: Phaser.GameObjects.Container;
    private selected: AdventureModeId = "quest-finding";
    private opened = false;
    private destroyed = false;

    private readonly escapeHandler = (event: KeyboardEvent): void => {
        if (!this.opened) return;
        event.preventDefault();
        this.close();
    };

    get isOpen(): boolean {
        return this.opened;
    }

    getCameraObjects(): Phaser.GameObjects.GameObject[] {
        return [this.root];
    }

    constructor(scene: Phaser.Scene, options: AdventurePortalUIOptions = {}) {
        this.scene = scene;
        this.options = options;
        this.root = scene.add.container(0, 0).setScrollFactor(0)
            .setDepth(16000).setVisible(false);

        // Block pointer events from reaching gameplay while the selector is up.
        this.root.add(scene.add.rectangle(0, 0, 1024, 768, 0x020611, 0.87)
            .setOrigin(0).setInteractive());

        const frame = scene.add.graphics();
        frame.fillStyle(0x020611);
        frame.fillRect(65, 67, 901, 654);
        frame.fillStyle(COLORS.cyan);
        frame.fillRect(60, 55, 904, 652);
        frame.fillStyle(COLORS.dark);
        frame.fillRect(65, 60, 894, 642);
        frame.fillStyle(COLORS.navy);
        frame.fillRect(76, 71, 872, 620);
        frame.fillStyle(COLORS.gold);
        frame.fillRect(94, 139, 836, 3);
        for (const [x, y] of [[74, 70], [937, 70], [74, 674], [937, 674]]) {
            frame.fillStyle(COLORS.gold);
            frame.fillRect(x, y, 10, 10);
        }
        this.root.add(frame);

        this.addText(this.root, 98, 89, "ADVENTURE PORTAL", 17, "#55E8D5");
        this.addText(this.root, 99, 118, "PLAY  /  EXPLORE  /  PROVE", 9, "#94A3B8");
        this.button(this.root, 793, 88, 135, 34, "X CLOSE", () => this.close(), COLORS.card, COLORS.gold, 9);
        this.page = scene.add.container(0, 0);
        this.root.add(this.page);
        this.render();

        scene.input.keyboard?.on("keydown-ESC", this.escapeHandler);
    }

    open(): void {
        if (this.destroyed || this.opened) return;
        this.opened = true;
        this.selected = "quest-finding";
        this.render();
        this.root.setVisible(true);
        this.options.onOpenChanged?.(true);
    }

    close(): void {
        if (this.destroyed || !this.opened) return;
        this.opened = false;
        this.root.setVisible(false);
        this.options.onOpenChanged?.(false);
    }

    destroy(): void {
        if (this.destroyed) return;
        this.destroyed = true;
        this.opened = false;
        this.scene.input.keyboard?.off("keydown-ESC", this.escapeHandler);
        this.root.destroy(true);
    }

    private render(): void {
        this.page.destroy(true);
        this.page = this.scene.add.container(0, 0);
        this.root.add(this.page);
        this.addText(this.page, 99, 170, "CHOOSE YOUR ADVENTURE", 13, "#FBBF24");
        this.addText(this.page, 99, 197, "Three game modes are planned for the MVP.", 17, "#C6D4DF", 810, false);

        MODES.forEach((mode, index) => {
            const x = 99 + index * 282;
            const y = 249;
            const isSelected = mode.id === this.selected;
            const bg = this.scene.add.rectangle(x, y, 266, 198,
                isSelected ? COLORS.cardHover : COLORS.card)
                .setOrigin(0).setStrokeStyle(isSelected ? 3 : 2,
                    isSelected ? mode.accent : COLORS.border)
                .setInteractive({ useHandCursor: true });
            bg.on("pointerdown", () => {
                this.selected = mode.id;
                this.render();
            });
            this.page.add(bg);
            this.addText(this.page, x + 17, y + 21, `0${index + 1} / ${mode.category}`, 9,
                `#${mode.accent.toString(16).padStart(6, "0")}`);
            this.addText(this.page, x + 17, y + 54, mode.title, 10, "#E2E8F0");
            this.addText(this.page, x + 17, y + 85, mode.summary, 17,
                "#C6D4DF", 234, false);
            this.addText(this.page, x + 17, y + 165,
                isSelected ? "> SELECTED" : "VIEW DETAILS", 9,
                isSelected ? "#55E8D5" : "#94A3B8");
        });

        const chosen = MODES.find(mode => mode.id === this.selected)!;
        const info = this.scene.add.rectangle(99, 475, 830, 157, COLORS.dark)
            .setOrigin(0).setStrokeStyle(2, COLORS.border);
        this.page.add(info);
        this.addText(this.page, 116, 492, chosen.title, 12,
            `#${chosen.accent.toString(16).padStart(6, "0")}`);
        this.addText(this.page, 116, 523, chosen.details, 18,
            "#E2E8F0", 786, false);

        const launchable = !!this.options.onLaunch &&
            !!this.options.availableModes?.includes(this.selected);
        if (launchable) {
            this.button(this.page, 646, 644, 283, 37, "ENTER ADVENTURE", () => {
                this.close();
                this.options.onLaunch?.(this.selected);
            }, COLORS.cardHover, COLORS.cyan, 10);
        } else {
            const disabled = this.scene.add.rectangle(646, 644, 283, 37, COLORS.card)
                .setOrigin(0).setStrokeStyle(1, COLORS.border);
            this.page.add(disabled);
            this.addText(this.page, 663, 657, "MODE IN DEVELOPMENT", 9, "#94A3B8");
        }
        this.addText(this.page, 99, 666, "SELECT A MODE TO PREVIEW", 9, "#94A3B8");
    }

    private addText(
        layer: Phaser.GameObjects.Container,
        x: number, y: number, value: string,
        fontSize: number, color: string,
        wrapWidth = 0, pixel = true,
    ): Phaser.GameObjects.Text {
        const text = this.scene.add.text(x, y, value, {
            fontFamily: pixel ? FONT : '"Trebuchet MS", Arial, sans-serif',
            fontSize: `${fontSize}px`,
            color,
            lineSpacing: 6,
            ...(wrapWidth > 0 ? { wordWrap: { width: wrapWidth, useAdvancedWrap: true } } : {}),
        });
        layer.add(text);
        return text;
    }

    private button(
        layer: Phaser.GameObjects.Container,
        x: number, y: number, w: number, h: number,
        label: string, onClick: () => void,
        bg: number, outline: number, fontSize: number,
    ): void {
        const rect = this.scene.add.rectangle(x, y, w, h, bg)
            .setOrigin(0)
            .setStrokeStyle(2, outline)
            .setInteractive({ useHandCursor: true });
        rect.on("pointerover", () => rect.setFillStyle(COLORS.cardHover));
        rect.on("pointerout", () => rect.setFillStyle(bg));
        rect.on("pointerdown", onClick);
        layer.add(rect);
        const text = this.addText(layer, x + w / 2, y + h / 2, label,
            fontSize, "#E2E8F0");
        text.setOrigin(0.5);
    }
}
