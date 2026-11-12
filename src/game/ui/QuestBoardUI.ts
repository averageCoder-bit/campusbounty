import * as Phaser from "phaser";
import { LEARNING_PATHS, type LearningNode, type LearningPath } from "../data/learningPaths";

export interface QuestBoardUIOptions {
    onOpenChanged?: (open: boolean) => void;
}

const FONT = '"Press Start 2P", monospace';
const C = {
    ink: 0x08111f,
    shadow: 0x020611,
    frame: 0x8a542b,
    frameLight: 0xc28a4a,
    panel: 0x111f35,
    panelLight: 0x192c47,
    panelHover: 0x26405c,
    gold: 0xfbbf24,
    parchment: 0xf7dfb2,
    muted: 0xa5b8c9,
    cyan: 0x7dd3fc,
    teal: 0x55e8d5,
} as const;

type Layer = Phaser.GameObjects.Container;

/**
 * G3.1 visual / navigation-only Quest Board.
 * - Uses the existing unzoomed HUD camera (not the mouse-leading world camera).
 * - Game.ts locks movement while open and owns all E-key dispatch.
 * - No lessons completed / XP awarded here; G3.2 adds real assessments.
 */
export class QuestBoardUI {
    private readonly scene: Phaser.Scene;
    private readonly onOpenChanged?: (open: boolean) => void;
    private readonly root: Layer;
    private page: Layer;
    private opened = false;
    private destroyed = false;
    private selectedPath: LearningPath | null = null;
    private selectedNodeIndex = 0;

    private readonly onEscapeKey = (event: KeyboardEvent): void => {
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

    constructor(scene: Phaser.Scene, options: QuestBoardUIOptions = {}) {
        this.scene = scene;
        this.onOpenChanged = options.onOpenChanged;
        this.root = scene.add.container(0, 0)
            .setScrollFactor(0)
            .setDepth(15000)
            .setVisible(false);

        // Interactive dimmer captures pointer clicks outside the menu.
        const dimmer = scene.add.rectangle(0, 0, 1024, 768, 0x020611, 0.83)
            .setOrigin(0)
            .setInteractive();
        this.root.add(dimmer);

        // Layered wooden frame with a navy interior, like the Hall's noticeboard.
        const shell = scene.add.graphics();
        shell.fillStyle(C.shadow, 0.8);
        shell.fillRect(75, 68, 896, 654);
        shell.fillStyle(C.frame);
        shell.fillRect(64, 56, 896, 654);
        shell.fillStyle(C.frameLight);
        shell.fillRect(70, 62, 884, 642);
        shell.fillStyle(C.ink);
        shell.fillRect(78, 70, 868, 626);
        shell.fillStyle(C.panel);
        shell.fillRect(84, 76, 856, 614);
        shell.fillStyle(C.gold);
        shell.fillRect(100, 129, 824, 2);
        shell.fillRect(100, 623, 824, 2);
        // Four visible corner studs.
        shell.fillStyle(C.parchment);
        for (const [x, y] of [[82, 74], [928, 74], [82, 680], [928, 680]]) {
            shell.fillRect(x, y, 11, 11);
            shell.fillStyle(C.frame);
            shell.fillRect(x + 3, y + 3, 5, 5);
            shell.fillStyle(C.parchment);
        }
        this.root.add(shell);

        this.addText(this.root, 105, 91, "CAMPUSBOUNTY  /  QUEST BOARD", 15, "#FBBF24");
        this.addText(this.root, 106, 116, "LEARN  >  PRACTICE  >  MASTER", 9, "#A5B8C9");
        this.makeButton(this.root, 803, 88, 125, 30, "X  CLOSE", () => this.close(), C.panelLight, C.gold, 9);

        this.page = scene.add.container(0, 0);
        this.root.add(this.page);
        this.renderCategories();
        scene.input.keyboard?.on("keydown-ESC", this.onEscapeKey);
    }

    open(): void {
        if (this.destroyed || this.opened) return;
        this.opened = true;
        this.selectedPath = null;
        this.selectedNodeIndex = 0;
        this.renderCategories();
        this.root.setVisible(true);
        this.onOpenChanged?.(true);
    }

    close(): void {
        if (this.destroyed || !this.opened) return;
        this.opened = false;
        this.root.setVisible(false);
        this.onOpenChanged?.(false);
    }

    destroy(): void {
        if (this.destroyed) return;
        this.destroyed = true;
        this.opened = false;
        this.scene.input.keyboard?.off("keydown-ESC", this.onEscapeKey);
        this.root.destroy(true);
    }

    private clearPage(): void {
        // Destroying this container also destroys its controls + event listeners.
        this.page.destroy(true);
        this.page = this.scene.add.container(0, 0);
        this.root.add(this.page);
    }

    private renderCategories(): void {
        this.clearPage();
        this.addText(this.page, 108, 159, "SELECT A LEARNING PATH", 14, "#F7DFB2");
        this.addText(this.page, 108, 188, "Pick a field to preview its beginner roadmap.", 17, "#A5B8C9", 800, false);

        const cards = LEARNING_PATHS.map((path, index) => ({
            x: 108 + index * 416,
            y: 228,
            path,
        }));
        for (const { x, y, path } of cards) {
            this.makeCard(x, y, path);
        }

        this.makeFutureCard(108, 434, "DATA SCIENCE & AI", "DATA / MODELS / PREDICTIONS");
        this.makeFutureCard(524, 434, "CYBERSECURITY", "PRIVACY / DEFENSE / THREATS");
        this.addText(this.page, 108, 658, "G3.1: ROADMAP PREVIEW  /  LESSONS AND XP COME IN G3.2", 9, "#A5B8C9");
    }

    private makeCard(x: number, y: number, path: LearningPath): void {
        const rect = this.scene.add.rectangle(x, y, 392, 178, C.panelLight)
            .setOrigin(0)
            .setStrokeStyle(3, path.accent)
            .setInteractive({ useHandCursor: true });
        rect.on("pointerover", () => rect.setFillStyle(C.panelHover));
        rect.on("pointerout", () => rect.setFillStyle(C.panelLight));
        rect.on("pointerdown", () => this.showPath(path));
        this.page.add(rect);

        this.addText(this.page, x + 18, y + 18, path.title, 12, this.toHex(path.accent));
        this.addText(this.page, x + 18, y + 44, path.subtitle, 8, "#F7DFB2");
        this.addText(this.page, x + 18, y + 72, path.overview, 17, "#E2E8F0", 350, false);
        this.addText(this.page, x + 18, y + 143, `${path.nodes.length} NODES  /  VIEW ROADMAP  >`, 9, "#FBBF24");
    }

    private makeFutureCard(x: number, y: number, title: string, subtitle: string): void {
        const rect = this.scene.add.rectangle(x, y, 392, 147, C.panel)
            .setOrigin(0)
            .setStrokeStyle(2, 0x40516b);
        this.page.add(rect);
        this.addText(this.page, x + 18, y + 22, title, 12, "#71879d");
        this.addText(this.page, x + 18, y + 52, subtitle, 9, "#71879d");
        this.addText(this.page, x + 18, y + 110, "FUTURE EXPANSION  /  LOCKED", 9, "#71879d");
    }

    private showPath(path: LearningPath): void {
        this.selectedPath = path;
        this.selectedNodeIndex = 0;
        this.renderPath();
    }

    private renderPath(): void {
        const path = this.selectedPath;
        if (!path) return;
        const selected: LearningNode | undefined = path.nodes[this.selectedNodeIndex];
        if (!selected) return;
        this.clearPage();

        this.addText(this.page, 109, 158, path.title, 13, this.toHex(path.accent));
        this.addText(this.page, 109, 182, `${path.nodes.length} TOPICS  /  PREVIEW ONLY`, 9, "#A5B8C9");

        for (const [index, node] of path.nodes.entries()) {
            const y = 218 + index * 75;
            const active = index === this.selectedNodeIndex;
            const rectangle = this.scene.add.rectangle(108, y, 467, 65, active ? C.panelHover : C.panelLight)
                .setOrigin(0)
                .setStrokeStyle(active ? 3 : 1, active ? path.accent : 0x435873)
                .setInteractive({ useHandCursor: true });
            rectangle.on("pointerdown", () => {
                this.selectedNodeIndex = index;
                this.renderPath();
            });
            this.page.add(rectangle);
            this.addText(this.page, 123, y + 17, String(index + 1).padStart(2, "0"), 13, active ? this.toHex(path.accent) : "#FBBF24");
            this.addText(this.page, 172, y + 12, node.title.toUpperCase(), 11, "#E2E8F0");
            this.addText(this.page, 173, y + 35, node.summary, 13, "#A5B8C9", 383, false);
        }

        const x = 598;
        const info = this.scene.add.rectangle(x, 218, 325, 365, C.ink)
            .setOrigin(0)
            .setStrokeStyle(2, C.frameLight);
        this.page.add(info);
        this.addText(this.page, x + 18, 235, "LEARNING NODE  /  PREVIEW", 8, "#FBBF24");
        this.addText(this.page, x + 18, 263, selected.title.toUpperCase(), 11, this.toHex(path.accent), 285);
        this.addText(this.page, x + 18, 320, selected.summary, 16, "#E2E8F0", 286, false);
        this.addText(this.page, x + 18, 385, "LEARNING OBJECTIVE", 9, "#FBBF24");
        this.addText(this.page, x + 18, 412, selected.goal, 15, "#E2E8F0", 286, false);
        this.addText(this.page, x + 18, 490, "TOPICS", 9, "#FBBF24");
        this.addText(this.page, x + 18, 511, selected.topics.join("  /  "), 13, "#A5B8C9", 286, false);

        this.makeButton(this.page, 108, 642, 170, 37, "<  ALL PATHS", () => {
            this.selectedPath = null;
            this.renderCategories();
        }, C.panelLight, C.gold, 9);
        this.addText(this.page, 314, 660, "INTERACTIVE LESSONS ARRIVE IN G3.2", 9, "#A5B8C9");
    }

    private makeButton(
        layer: Layer, x: number, y: number, width: number, height: number,
        label: string, action: () => void,
        fill: number = C.panelLight, outline: number = C.gold, fontSize = 10,
    ): void {
        const rect = this.scene.add.rectangle(x, y, width, height, fill)
            .setOrigin(0)
            .setStrokeStyle(2, outline)
            .setInteractive({ useHandCursor: true });
        rect.on("pointerover", () => rect.setFillStyle(C.panelHover));
        rect.on("pointerout", () => rect.setFillStyle(fill));
        rect.on("pointerdown", action);
        layer.add(rect);
        const text = this.addText(layer, x + width / 2, y + height / 2, label, fontSize, "#F7DFB2");
        text.setOrigin(0.5);
    }

    private addText(
        layer: Layer, x: number, y: number, value: string,
        fontSize: number, color: string, wrapWidth = 0, pixel = true,
    ): Phaser.GameObjects.Text {
        const text = this.scene.add.text(x, y, value, {
            fontFamily: pixel ? FONT : '"Trebuchet MS", Arial, sans-serif',
            fontSize: `${fontSize}px`,
            color,
            lineSpacing: pixel ? 5 : 3,
            ...(wrapWidth > 0 ? { wordWrap: { width: wrapWidth, useAdvancedWrap: true } } : {}),
        });
        layer.add(text);
        return text;
    }

    private toHex(value: number): string {
        return `#${value.toString(16).padStart(6, "0")}`;
    }
}
