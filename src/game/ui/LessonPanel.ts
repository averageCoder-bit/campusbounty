import * as Phaser from "phaser";
import {
    type InteractiveLesson,
    type LearningScenario,
} from "../data/lessonContent";
import {
    getLessonMastery,
    submitLearningAssessment,
    type LessonResult,
} from "../data/LearningProgress";

const FONT = '"Press Start 2P", monospace';
const BODY = '"Trebuchet MS", Arial, sans-serif';
const K = {
    navy: 0x08111f, surface: 0x13243a, raised: 0x1b3550,
    gold: 0xfbbf24, teal: 0x55e8d5, blue: 0x7dd3fc,
    border: 0x54718b, red: 0xfb7185,
} as const;

type Layer = Phaser.GameObjects.Container;
type Stage = "read" | "practice" | "assess" | "result";

type ShuffledCase = {
    scenario: LearningScenario;
    choices: string[];
    correct: number;
};

export interface LessonPanelOptions {
    onBack: () => void;
    onProgressChanged?: () => void;
}

/**
 * An interactive learning view mounted inside QuestBoardUI's page container.
 * No timers or tweens: works while player movement and mouse camera are locked.
 * Grade and XP are local/in-memory for the MVP; not a verified credential.
 */
export class LessonPanel {
    private readonly scene: Phaser.Scene;
    private readonly page: Layer;
    private readonly lesson: InteractiveLesson;
    private readonly opts: LessonPanelOptions;
    private stage: Stage = "read";
    private slide = 0;
    private practiceChoice: number | null = null;
    private cases: ShuffledCase[] = [];
    private caseIndex = 0;
    private answers: number[] = [];
    private result?: LessonResult;

    constructor(scene: Phaser.Scene, page: Layer, lesson: InteractiveLesson, opts: LessonPanelOptions) {
        this.scene = scene;
        this.page = page;
        this.lesson = lesson;
        this.opts = opts;
        this.render();
    }

    /** Keyboard shortcuts while the Quest Board owns input. */
    handleKey(event: KeyboardEvent): void {
        if (event.repeat) return;
        if (event.code === "Enter" || event.code === "NumpadEnter") {
            this.primaryAction();
            event.preventDefault();
            return;
        }
        if ((this.stage === "practice" || this.stage === "assess") &&
            /^(Digit|Numpad)[1-3]$/.test(event.code)) {
            this.choose(Number(event.code.slice(-1)) - 1);
            event.preventDefault();
        }
    }

    private render(): void {
        this.page.removeAll(true);
        this.text(108, 157, this.lesson.title, 14, "#FBBF24", 645);
        this.text(108, 185, this.lesson.subtitle, 9, "#94A3B8");
        const step = this.stage === "read"
            ? `LEARN ${this.slide + 1}/${this.lesson.pages.length}`
            : this.stage === "practice" ? "GUIDED PRACTICE"
            : this.stage === "assess" ? `MASTERY ${this.caseIndex + 1}/3`
            : "LEARNING REPORT";
        this.text(917, 169, step, 8, "#7DD3FC").setOrigin(1, 0);
        if (this.stage === "read") this.renderReading();
        else if (this.stage === "practice") this.renderScenario(this.makeCase(this.lesson.practice), true);
        else if (this.stage === "assess") this.renderScenario(this.cases[this.caseIndex], false);
        else this.renderResult();
        this.button(108, 640, 175, 39, "< ROADMAP", () => this.opts.onBack(), K.raised, K.gold, 9);
    }

    private renderReading(): void {
        const slide = this.lesson.pages[this.slide];
        this.panel(108, 213, 816, 397, K.surface, K.border);
        this.text(129, 232, slide.title, 12, "#55E8D5", 760);
        this.text(129, 276, slide.explanation, 20, "#E2E8F0", 755, false);
        this.panel(128, 372, 774, 138, K.navy, K.border);
        this.text(146, 387, slide.exampleTitle, 9, "#FBBF24");
        this.text(146, 411, slide.example, 17, "#E2E8F0", 725, false);
        this.text(130, 536, `REMEMBER: ${slide.takeaway}`, 15, "#7DD3FC", 757, false);
        this.button(671, 640, 253, 39,
            this.slide < this.lesson.pages.length - 1 ? "NEXT LESSON >" : "TRY PRACTICE >",
            () => this.primaryAction(), K.raised, K.teal, 9);
    }

    private makeCase(s: LearningScenario): ShuffledCase {
        // Practice intentionally keeps the answer order stable for instruction.
        return { scenario: s, choices: [...s.choices], correct: s.correct };
    }

    private startAssessment(): void {
        // Selecting three different cases and shuffling answer positions makes
        // repeated attempts more varied without suggesting external AI grading.
        const rng = new Phaser.Math.RandomDataGenerator([
            this.lesson.nodeId, String(Date.now()), String(getLessonMastery(this.scene, this.lesson.nodeId).attempts),
        ]);
        const selected = [...this.lesson.assessment];
        for (let i = selected.length - 1; i > 0; i--) {
            const j = rng.integerInRange(0, i);
            [selected[i], selected[j]] = [selected[j], selected[i]];
        }
        this.cases = selected.slice(0, 3).map((scenario) => {
            const positions = [0, 1, 2];
            for (let i = 2; i > 0; i--) {
                const j = rng.integerInRange(0, i);
                [positions[i], positions[j]] = [positions[j], positions[i]];
            }
            return {
                scenario,
                choices: positions.map((i) => scenario.choices[i]),
                correct: positions.indexOf(scenario.correct),
            };
        });
        this.answers = [];
        this.caseIndex = 0;
        this.result = undefined;
        this.stage = "assess";
        this.render();
    }

    private renderScenario(item: ShuffledCase, practice: boolean): void {
        const chosen = practice ? this.practiceChoice : (this.answers[this.caseIndex] ?? null);
        this.panel(108, 213, 352, 397, K.surface, K.border);
        this.panel(478, 213, 446, 397, K.navy, K.border);
        this.text(128, 233, item.scenario.title, 10, "#FBBF24", 318);
        this.text(128, 275, item.scenario.situation, 17, "#E2E8F0", 310, false);
        this.text(128, 383, "EVIDENCE TO INSPECT", 8, "#55E8D5");
        item.scenario.evidence.forEach((line, index) => {
            this.text(129, 408 + index * 53, `${index + 1}. ${line}`, 14, "#BFD2EA", 302, false);
        });
        this.text(497, 234, practice ? "TEST YOUR INSTINCT" : "CHOOSE THE SAFEST / CORRECT ACTION", 9, "#7DD3FC", 398);
        this.text(497, 277, item.scenario.question, 17, "#E2E8F0", 407, false);
        item.choices.forEach((option, index) => {
            const top = 361 + index * 65;
            const picked = chosen === index;
            const fill = picked ? K.raised : K.surface;
            const border = picked ? (practice && index === item.correct ? K.teal : K.gold) : K.border;
            this.button(493, top, 414, 59, `${index + 1}. ${option}`,
                () => this.choose(index), fill, border, 15, false, true);
        });
        if (practice && chosen !== null) {
            const correct = chosen === item.correct;
            this.text(112, 612,
                correct ? "GOOD CALL. The next step is a fresh mastery challenge."
                    : `NOT QUITE. ${item.scenario.explanation}`,
                14, correct ? "#55E8D5" : "#FB7185", 792, false);
        }
        const assessmentSelected = this.stage === "assess" && this.answers[this.caseIndex] !== undefined;
        if (assessmentSelected) {
            this.text(114, 612, "DECISION RECORDED. Feedback appears after all 3 cases.", 13, "#7DD3FC", 787, false);
        }
        const enabled = practice ? this.practiceChoice === item.correct : assessmentSelected;
        const label = practice ? "BEGIN MASTERY >" : this.caseIndex === 2 ? "SUBMIT MASTERY >" : "NEXT CASE >";
        this.button(671, 640, 253, 39, enabled ? label : "SELECT A RESPONSE",
            () => { if (enabled) this.primaryAction(); }, enabled ? K.raised : K.surface, enabled ? K.teal : K.border, 8);
    }

    private choose(index: number): void {
        if (index < 0 || index > 2) return;
        if (this.stage === "practice") {
            this.practiceChoice = index;
            this.render();
        } else if (this.stage === "assess") {
            this.answers[this.caseIndex] = index;
            this.render();
        }
    }

    private primaryAction(): void {
        if (this.stage === "read") {
            if (this.slide + 1 < this.lesson.pages.length) this.slide++;
            else { this.stage = "practice"; this.practiceChoice = null; }
            this.render();
        } else if (this.stage === "practice") {
            if (this.practiceChoice === this.lesson.practice.correct) this.startAssessment();
        } else if (this.stage === "assess") {
            if (this.answers[this.caseIndex] === undefined) return;
            if (this.caseIndex < this.cases.length - 1) {
                this.caseIndex++;
                this.render();
            } else {
                const score = this.cases.reduce((sum, question, i) =>
                    sum + Number(question.correct === this.answers[i]), 0);
                this.result = submitLearningAssessment(
                    this.scene, this.lesson.nodeId, score, this.cases.length, this.lesson.xpReward,
                );
                this.stage = "result";
                if (this.result.firstMastery) this.opts.onProgressChanged?.();
                this.render();
            }
        } else this.opts.onBack();
    }

    private renderResult(): void {
        const result = this.result;
        if (!result) return;
        this.panel(108, 213, 816, 397, K.surface, result.passed ? K.teal : K.gold);
        this.text(132, 235, result.passed ? "MASTERY DEMONSTRATED" : "KEEP PRACTICING", 12,
            result.passed ? "#55E8D5" : "#FBBF24");
        this.text(132, 269, `SCORE  ${result.score}/${result.total}     ATTEMPT ${result.attempts}`,
            12, "#E2E8F0");
        this.text(132, 306,
            result.firstMastery ? `+${result.awardedXp} XP AWARDED  /  FIRST MASTERY`
                : result.passed ? "MASTERED ALREADY  /  NO DUPLICATE XP"
                    : "REQUIRES 3/3 TO MASTER  /  NO XP YET",
            9, result.firstMastery ? "#55E8D5" : "#FBBF24", 730);
        this.text(132, 343, "CASE REVIEW", 9, "#7DD3FC");
        this.cases.forEach((c, index) => {
            const correct = c.correct === this.answers[index];
            this.text(132, 369 + index * 70,
                `${correct ? "PASS" : "REVIEW"}  /  ${c.scenario.title}`,
                9, correct ? "#55E8D5" : "#FB7185", 720);
            this.text(132, 388 + index * 70,
                c.scenario.explanation, 13, "#C8D7E5", 741, false);
        });
        this.button(671, 640, 253, 39,
            result.passed ? "BACK TO ROADMAP >" : "RETRY MASTERY >",
            () => result.passed ? this.opts.onBack() : this.startAssessment(),
            K.raised, result.passed ? K.teal : K.gold, 8);
    }

    private panel(x: number, y: number, width: number, height: number,
        fill: number, outline: number): void {
        const panel = this.scene.add.rectangle(x, y, width, height, fill)
            .setOrigin(0).setStrokeStyle(2, outline);
        this.page.add(panel);
    }

    private button(
        x: number, y: number, width: number, height: number,
        label: string, onClick: () => void,
        fill: number = K.raised, stroke: number = K.gold,
        size = 9, pixel = true, wrap = false,
    ): void {
        const bg = this.scene.add.rectangle(x, y, width, height, fill)
            .setOrigin(0).setStrokeStyle(2, stroke)
            .setInteractive({ useHandCursor: true });
        bg.on("pointerover", () => bg.setFillStyle(K.raised));
        bg.on("pointerout", () => bg.setFillStyle(fill));
        bg.on("pointerdown", onClick);
        this.page.add(bg);
        this.text(x + (wrap ? 12 : width / 2), y + height / 2, label, size,
            "#F7DFB2", wrap ? width - 24 : 0, pixel)
            .setOrigin(wrap ? 0 : 0.5, 0.5);
    }

    private text(x: number, y: number, content: string, fontSize: number,
        color: string, wrapWidth = 0, pixel = true): Phaser.GameObjects.Text {
        const t = this.scene.add.text(x, y, content, {
            fontFamily: pixel ? FONT : BODY,
            fontSize: `${fontSize}px`,
            color,
            lineSpacing: pixel ? 5 : 4,
            ...(wrapWidth ? { wordWrap: { width: wrapWidth, useAdvancedWrap: true } } : {}),
        });
        this.page.add(t);
        return t;
    }
}
