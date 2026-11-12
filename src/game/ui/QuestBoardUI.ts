import * as Phaser from "phaser";
import {
    LEARNING_PATHS,
    type LearningNode,
    type LearningPath,
} from "../data/learningPaths";
import { getInteractiveLesson } from "../data/lessonContent";
import { getLessonMastery } from "../data/LearningProgress";
import { LessonPanel } from "./LessonPanel";

export interface QuestBoardUIOptions {
    onOpenChanged?: (open: boolean) => void;
    /** Optional: refresh the Quest Hall's live XP HUD after a new mastery. */
    onProgressChanged?: () => void;
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
 * G3.7 learning hub. Preserves the G3.1 public API and HUD camera contract.
 * The selected lesson is rendered INSIDE this board, so Game.ts continues to
 * block player input and mouse camera while any learning view is open.
 */
export class QuestBoardUI {
    private readonly scene: Phaser.Scene;
    private readonly onOpenChanged?: (open: boolean) => void;
    private readonly onProgressChanged?: () => void;
    private readonly root: Layer;
    private page: Layer;
    private lessonPanel?: LessonPanel;
    private opened = false;
    private destroyed = false;
    private selectedPath: LearningPath | null = null;
    private selectedNodeIndex = 0;

    private readonly onEscapeKey = (event: KeyboardEvent): void => {
        if (!this.opened) return;
        event.preventDefault();
        if (this.lessonPanel) this.backToRoadmap();
        else this.close();
    };

    private readonly onKeyboard = (event: KeyboardEvent): void => {
        if (!this.opened) return;
        this.lessonPanel?.handleKey(event);
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
        this.onProgressChanged = options.onProgressChanged;
        this.root = scene.add
            .container(0, 0)
            .setScrollFactor(0)
            .setDepth(15000)
            .setVisible(false);

        const dimmer = scene.add
            .rectangle(0, 0, 1024, 768, C.shadow, 0.84)
            .setOrigin(0)
            .setInteractive();
        this.root.add(dimmer);

        const shell = scene.add.graphics();
        shell.fillStyle(C.shadow, 0.8).fillRect(75, 68, 896, 654);
        shell.fillStyle(C.frame).fillRect(64, 56, 896, 654);
        shell.fillStyle(C.frameLight).fillRect(70, 62, 884, 642);
        shell.fillStyle(C.ink).fillRect(78, 70, 868, 626);
        shell.fillStyle(C.panel).fillRect(84, 76, 856, 614);
        shell.fillStyle(C.gold);
        shell.fillRect(100, 129, 824, 2);
        shell.fillRect(100, 623, 824, 2);
        shell.fillStyle(C.parchment);
        for (const [x, y] of [
            [82, 74],
            [928, 74],
            [82, 680],
            [928, 680],
        ]) {
            shell.fillRect(x, y, 11, 11);
            shell.fillStyle(C.frame).fillRect(x + 3, y + 3, 5, 5);
            shell.fillStyle(C.parchment);
        }
        this.root.add(shell);
        this.addText(
            this.root,
            105,
            91,
            "CAMPUSBOUNTY  /  QUEST BOARD",
            15,
            "#FBBF24",
        );
        this.addText(
            this.root,
            106,
            116,
            "LEARN  >  PRACTICE  >  MASTER",
            9,
            "#A5B8C9",
        );
        this.makeButton(
            this.root,
            803,
            88,
            125,
            30,
            "X  CLOSE",
            () => this.close(),
            C.panelLight,
            C.gold,
            9,
        );

        this.page = scene.add.container(0, 0);
        this.root.add(this.page);
        this.renderCategories();
        scene.input.keyboard?.on("keydown-ESC", this.onEscapeKey);
        scene.input.keyboard?.on("keydown", this.onKeyboard);
    }

    open(): void {
        if (this.destroyed || this.opened) return;
        this.opened = true;
        this.selectedPath = null;
        this.selectedNodeIndex = 0;
        this.lessonPanel = undefined;
        this.renderCategories();
        this.root.setVisible(true);
        this.onOpenChanged?.(true);
    }

    close(): void {
        if (this.destroyed || !this.opened) return;
        this.opened = false;
        this.lessonPanel = undefined;
        this.root.setVisible(false);
        this.onOpenChanged?.(false);
    }

    destroy(): void {
        if (this.destroyed) return;
        this.destroyed = true;
        this.opened = false;
        this.lessonPanel = undefined;
        this.scene.input.keyboard?.off("keydown-ESC", this.onEscapeKey);
        this.scene.input.keyboard?.off("keydown", this.onKeyboard);
        this.root.destroy(true);
    }

    private clearPage(): void {
        this.lessonPanel = undefined;
        this.page.destroy(true);
        this.page = this.scene.add.container(0, 0);
        this.root.add(this.page);
    }

    private renderCategories(): void {
        this.clearPage();
        this.addText(
            this.page,
            108,
            159,
            "SELECT A LEARNING PATH",
            14,
            "#F7DFB2",
        );
        this.addText(
            this.page,
            108,
            188,
            "Master a topic by solving simulated challenges, not by clicking through.",
            17,
            "#A5B8C9",
            790,
            false,
        );
        LEARNING_PATHS.forEach((path, index) =>
            this.makeCard(108 + index * 416, 228, path),
        );
        this.makeFutureCard(
            108,
            434,
            "DATA SCIENCE & AI",
            "DATA / MODELS / PREDICTIONS",
        );
        this.makeFutureCard(
            524,
            434,
            "CYBERSECURITY",
            "PRIVACY / DEFENSE / THREATS",
        );
        this.addText(
            this.page,
            108,
            657,
            "G3.7  /  TWO PLAYABLE LESSONS  /  XP SAVED THIS SESSION ONLY",
            9,
            "#A5B8C9",
        );
    }

    private makeCard(x: number, y: number, path: LearningPath): void {
        const available = path.nodes.filter(
            (n) => !!getInteractiveLesson(n.id),
        );
        const mastered = available.filter(
            (n) => getLessonMastery(this.scene, n.id).mastered,
        ).length;
        const rect = this.scene.add
            .rectangle(x, y, 392, 178, C.panelLight)
            .setOrigin(0)
            .setStrokeStyle(3, path.accent)
            .setInteractive({ useHandCursor: true });
        rect.on("pointerover", () => rect.setFillStyle(C.panelHover));
        rect.on("pointerout", () => rect.setFillStyle(C.panelLight));
        rect.on("pointerdown", () => this.showPath(path));
        this.page.add(rect);
        this.addText(
            this.page,
            x + 18,
            y + 18,
            path.title,
            12,
            this.toHex(path.accent),
        );
        this.addText(this.page, x + 18, y + 44, path.subtitle, 8, "#F7DFB2");
        this.addText(
            this.page,
            x + 18,
            y + 72,
            path.overview,
            17,
            "#E2E8F0",
            352,
            false,
        );
        this.addText(
            this.page,
            x + 18,
            y + 143,
            `${mastered}/${available.length} MASTERED   /   OPEN ROADMAP  >`,
            9,
            "#FBBF24",
        );
    }

    private makeFutureCard(
        x: number,
        y: number,
        title: string,
        subtitle: string,
    ): void {
        const rect = this.scene.add
            .rectangle(x, y, 392, 147, C.panel)
            .setOrigin(0)
            .setStrokeStyle(2, 0x40516b);
        this.page.add(rect);
        this.addText(this.page, x + 18, y + 22, title, 12, "#71879d");
        this.addText(this.page, x + 18, y + 52, subtitle, 9, "#71879d");
        this.addText(
            this.page,
            x + 18,
            y + 110,
            "FUTURE EXPANSION  /  LOCKED",
            9,
            "#71879d",
        );
    }

    private showPath(path: LearningPath): void {
        this.selectedPath = path;
        this.selectedNodeIndex = 0;
        this.renderPath();
    }

    private backToRoadmap(): void {
        if (this.selectedPath) this.renderPath();
        else this.renderCategories();
    }

    private showLesson(nodeId: string): void {
        const lesson = getInteractiveLesson(nodeId);
        if (!lesson) return;
        this.clearPage();
        this.lessonPanel = new LessonPanel(this.scene, this.page, lesson, {
            onBack: () => this.backToRoadmap(),
            onProgressChanged: () => this.onProgressChanged?.(),
        });
    }

    private renderPath(): void {
        const path = this.selectedPath;
        if (!path) return;
        const selected: LearningNode | undefined =
            path.nodes[this.selectedNodeIndex];
        if (!selected) return;
        this.clearPage();
        this.addText(
            this.page,
            109,
            158,
            path.title,
            13,
            this.toHex(path.accent),
        );
        this.addText(
            this.page,
            109,
            182,
            "SELECT A TOPIC  /  COMPLETE A MASTERY CHECK TO EARN XP",
            9,
            "#A5B8C9",
        );

        for (const [index, node] of path.nodes.entries()) {
            const y = 218 + index * 75;
            const active = index === this.selectedNodeIndex;
            const implemented = !!getInteractiveLesson(node.id);
            const mastery = getLessonMastery(this.scene, node.id);
            const rectangle = this.scene.add
                .rectangle(
                    108,
                    y,
                    467,
                    65,
                    active ? C.panelHover : C.panelLight,
                )
                .setOrigin(0)
                .setStrokeStyle(active ? 3 : 1, active ? path.accent : 0x435873)
                .setInteractive({ useHandCursor: true });
            rectangle.on("pointerdown", () => {
                this.selectedNodeIndex = index;
                this.renderPath();
            });
            this.page.add(rectangle);
            this.addText(
                this.page,
                121,
                y + 16,
                String(index + 1).padStart(2, "0"),
                13,
                active ? this.toHex(path.accent) : "#FBBF24",
            );
            this.addText(
                this.page,
                165,
                y + 10,
                node.title.toUpperCase(),
                10,
                "#E2E8F0",
                383,
            );
            this.addText(
                this.page,
                165,
                y + 34,
                mastery.mastered
                    ? "MASTERED  /  REPLAY AVAILABLE"
                    : implemented
                      ? "INTERACTIVE LESSON READY"
                      : "CONTENT COMING SOON",
                8,
                mastery.mastered
                    ? "#55E8D5"
                    : implemented
                      ? "#7DD3FC"
                      : "#788CA3",
            );
        }

        const x = 598;
        const implemented = getInteractiveLesson(selected.id);
        const mastery = getLessonMastery(this.scene, selected.id);
        const info = this.scene.add
            .rectangle(x, 218, 325, 385, C.ink)
            .setOrigin(0)
            .setStrokeStyle(2, C.frameLight);
        this.page.add(info);
        this.addText(
            this.page,
            x + 18,
            235,
            mastery.mastered
                ? "LEARNING NODE  /  MASTERED"
                : implemented
                  ? "LEARNING NODE  /  READY"
                  : "LEARNING NODE  /  PLANNED",
            8,
            mastery.mastered ? "#55E8D5" : "#FBBF24",
        );
        this.addText(
            this.page,
            x + 18,
            263,
            selected.title.toUpperCase(),
            11,
            this.toHex(path.accent),
            290,
        );
        this.addText(
            this.page,
            x + 18,
            312,
            selected.summary,
            16,
            "#E2E8F0",
            287,
            false,
        );
        this.addText(
            this.page,
            x + 18,
            383,
            "LEARNING OBJECTIVE",
            9,
            "#FBBF24",
        );
        this.addText(
            this.page,
            x + 18,
            408,
            selected.goal,
            15,
            "#E2E8F0",
            286,
            false,
        );
        this.addText(this.page, x + 18, 493, "TOPICS", 9, "#FBBF24");
        this.addText(
            this.page,
            x + 18,
            515,
            selected.topics.join(" / "),
            12,
            "#A5B8C9",
            280,
            false,
        );
        if (implemented) {
            this.makeButton(
                this.page,
                x + 18,
                556,
                289,
                35,
                mastery.mastered
                    ? "REPLAY LESSON"
                    : `START LESSON  /  +${implemented.xpReward} XP`,
                () => this.showLesson(selected.id),
                C.panelLight,
                C.teal,
                8,
            );
        } else {
            this.addText(
                this.page,
                x + 18,
                565,
                "MODULE COMING SOON",
                9,
                "#71879D",
            );
        }

        this.makeButton(
            this.page,
            108,
            642,
            170,
            37,
            "<  ALL PATHS",
            () => {
                this.selectedPath = null;
                this.renderCategories();
            },
            C.panelLight,
            C.gold,
            9,
        );
        this.addText(
            this.page,
            314,
            660,
            "MASTERED NODES AWARD XP ONCE PER SESSION",
            9,
            "#A5B8C9",
        );
    }

    private makeButton(
        layer: Layer,
        x: number,
        y: number,
        width: number,
        height: number,
        label: string,
        action: () => void,
        fill: number = C.panelLight,
        outline: number = C.gold,
        fontSize = 10,
    ): void {
        const rect = this.scene.add
            .rectangle(x, y, width, height, fill)
            .setOrigin(0)
            .setStrokeStyle(2, outline)
            .setInteractive({ useHandCursor: true });
        rect.on("pointerover", () => rect.setFillStyle(C.panelHover));
        rect.on("pointerout", () => rect.setFillStyle(fill));
        rect.on("pointerdown", action);
        layer.add(rect);
        const text = this.addText(
            layer,
            x + width / 2,
            y + height / 2,
            label,
            fontSize,
            "#F7DFB2",
        );
        text.setOrigin(0.5);
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
            fontFamily: pixel ? FONT : '"Trebuchet MS", Arial, sans-serif',
            fontSize: `${fontSize}px`,
            color,
            lineSpacing: pixel ? 5 : 3,
            ...(wrapWidth
                ? { wordWrap: { width: wrapWidth, useAdvancedWrap: true } }
                : {}),
        });
        layer.add(text);
        return text;
    }

    private toHex(value: number): string {
        return `#${value.toString(16).padStart(6, "0")}`;
    }
}

