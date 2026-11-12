import * as Phaser from "phaser";
import { type AcademyLesson, type PreparedChallenge, type ChallengeAnswer,
    prepareChallenge, selectAssessment, scoreAssessment } from "../systems/LearningEngine";
import { getLessonMastery, recordPracticeMistake, submitAcademyAssessment,
    type LessonResult } from "../data/LearningProgress";
import { A, button, panel, text, type Layer } from "./AcademyWidgets";
import { LearningChallengeUI } from "./LearningChallengeUI";

type Stage = "read" | "practice" | "assess" | "result";
export class AcademyLessonPanel {
    private readonly scene: Phaser.Scene;
    private readonly layer: Layer;
    private readonly lesson: AcademyLesson;
    private readonly onBack: () => void;
    private readonly onProgressChanged?: () => void;
    private stage: Stage = "read";
    private slide = 0;
    private caseIndex = 0;
    private practiceCheck: boolean | null = null;
    private reportedMistake = false;
    private control?: LearningChallengeUI;
    private assessment: PreparedChallenge[] = [];
    private answers: ChallengeAnswer[] = [];
    private result?: LessonResult;
    private wrongIds: string[] = [];
    private readonly savedAnswers = new Map<string, ChallengeAnswer>();
    constructor(scene: Phaser.Scene, layer: Layer, lesson: AcademyLesson, onBack: () => void,
        onProgressChanged?: () => void) {
        this.scene = scene; this.layer = layer; this.lesson = lesson;
        this.onBack = onBack; this.onProgressChanged = onProgressChanged;
        this.draw();
    }
    handleKey(event: KeyboardEvent): void {
        if (event.repeat) return;
        if (event.code === "Enter" || event.code === "NumpadEnter") {
            event.preventDefault(); this.next(); return;
        }
        if (!this.control) return;
        if (this.control.handleKey(event)) return;
        if (/^(Digit|Numpad)[1-3]$/.test(event.code) &&
            this.control.item.source.kind !== "fill") {
            event.preventDefault(); this.control.choose(Number(event.code.slice(-1)) - 1);
        }
    }
    private beginPractice(): void {
        this.stage = "practice";
        this.practiceCheck = null;
        this.setupChallenge(prepareChallenge(this.lesson.practice, 0));
    }
    private beginAssessment(): void {
        const attempt = getLessonMastery(this.scene, this.lesson.id).attempts + 1;
        this.stage = "assess";
        this.assessment = selectAssessment(this.lesson, attempt);
        this.answers = [];
        this.savedAnswers.clear();
        this.caseIndex = 0;
        this.result = undefined;
        this.setupChallenge(this.assessment[0]);
    }
    private setupChallenge(item: PreparedChallenge): void {
        this.control = new LearningChallengeUI(this.scene, this.layer, item, () => {
            if (this.stage === "practice") this.practiceCheck = null;
            this.draw();
        });
        const previous = this.savedAnswers.get(item.source.id);
        if (previous !== undefined) this.control.answer = previous;
        this.draw();
    }
    private draw(): void {
        this.layer.removeAll(true);
        text(this.scene, this.layer, 107, 155, this.lesson.title.toUpperCase(), 13, "#FBBF24", 600, true);
        text(this.scene, this.layer, 108, 182, this.lesson.subtitle, 9, "#A5B8C9", 620, true);
        const stageName = this.stage === "read" ? `LEARN  ${this.slide + 1}/${this.lesson.pages.length}` :
            this.stage === "practice" ? "GUIDED PRACTICE" : this.stage === "assess" ?
            `MASTERY  ${this.caseIndex + 1}/${this.assessment.length}` : "LEARNING REPORT";
        text(this.scene, this.layer, 917, 161, stageName, 9, "#7DD3FC", 330, true).setOrigin(1, 0);
        if (this.stage === "read") this.drawReading();
        else if (this.stage === "practice" || this.stage === "assess") this.drawChallenge();
        else this.drawResult();
        button(this.scene, this.layer, 108, 636, 170, 39, "< UNIT", () => this.onBack(), { size: 9 });
    }
    private drawReading(): void {
        const page = this.lesson.pages[this.slide];
        panel(this.scene, this.layer, 108, 215, 815, 391, A.panel, A.border);
        text(this.scene, this.layer, 129, 232, page.heading.toUpperCase(), 12, "#55E8D5", 757, true);
        text(this.scene, this.layer, 128, 276, page.body, 19, "#E2E8F0", 755);
        panel(this.scene, this.layer, 128, 385, 774, 130, A.dark, A.border);
        text(this.scene, this.layer, 146, 400, page.exampleTitle.toUpperCase(), 9, "#FBBF24", 730, true);
        text(this.scene, this.layer, 145, 428, page.example, 15, "#C7D5E4", 731);
        text(this.scene, this.layer, 129, 542, `REMEMBER: ${page.takeaway}`, 14, "#7DD3FC", 765);
        button(this.scene, this.layer, 668, 636, 255, 39,
            this.slide < this.lesson.pages.length - 1 ? "NEXT PAGE >" : "START PRACTICE >",
            () => this.next(), { border: A.teal, size: 9 });
    }
    private drawChallenge(): void {
        this.control?.render();
        const control = this.control;
        if (!control) return;
        if (this.stage === "practice") {
            if (this.practiceCheck !== null) {
                text(this.scene, this.layer, 128, 561, this.practiceCheck ?
                    "CORRECT! You're ready for a new assessment." :
                    `REVIEW: ${control.item.source.explanation.slice(0, 170)}`, 11,
                    this.practiceCheck ? "#55E8D5" : "#FB7185", 315);
            }
            button(this.scene, this.layer, 467, 636, 188, 39,
                control.showHint ? "HINT SHOWN" : "SHOW HINT",
                () => { control.showHint = true; this.draw(); }, { size: 9, border: A.cyan });
            button(this.scene, this.layer, 667, 636, 256, 39,
                this.practiceCheck ? "BEGIN MASTERY >" : "CHECK PRACTICE >",
                () => this.next(), { size: 9, disabled: !control.hasAnswer && !this.practiceCheck,
                    border: this.practiceCheck ? A.teal : A.gold });
        } else {
            text(this.scene, this.layer, 495, 553,
                "Your answers are graded together after submission.", 12, "#A5B8C9", 404);
            button(this.scene, this.layer, 668, 636, 255, 39,
                this.caseIndex === this.assessment.length - 1 ? "SUBMIT TRIAL >" : "NEXT CHALLENGE >",
                () => this.next(), { size: 8, disabled: !control.hasAnswer, border: A.teal });
        }
    }
    private next(): void {
        if (this.stage === "read") {
            if (++this.slide < this.lesson.pages.length) this.draw();
            else this.beginPractice();
            return;
        }
        if (this.stage === "practice") {
            if (!this.control?.hasAnswer) return;
            if (this.practiceCheck) { this.beginAssessment(); return; }
            const correct = this.control.isCorrect;
            this.practiceCheck = correct;
            if (!correct && !this.reportedMistake) {
                recordPracticeMistake(this.scene, this.control.item.source.id);
                this.reportedMistake = true;
            }
            this.draw(); return;
        }
        if (this.stage === "assess") {
            if (!this.control?.hasAnswer) return;
            const item = this.assessment[this.caseIndex];
            this.savedAnswers.set(item.source.id, this.control.answer);
            this.answers[this.caseIndex] = this.control.answer;
            if (this.caseIndex + 1 < this.assessment.length) {
                this.caseIndex++;
                this.setupChallenge(this.assessment[this.caseIndex]);
            } else {
                const report = scoreAssessment(this.assessment, this.answers);
                this.wrongIds = report.wrongIds;
                this.result = submitAcademyAssessment(this.scene, this.lesson.id,
                    report.score, report.total, this.lesson.minScore, this.lesson.xpReward,
                    report.wrongIds);
                if (this.result.firstMastery) this.onProgressChanged?.();
                this.stage = "result";
                this.control = undefined;
                this.draw();
            }
            return;
        }
        this.onBack();
    }
    private drawResult(): void {
        if (!this.result) return;
        const result = this.result;
        panel(this.scene, this.layer, 108, 215, 815, 391, A.panel, result.passed ? A.teal : A.gold);
        text(this.scene, this.layer, 129, 240,
            result.passed ? "CHAPTER KNOWLEDGE DEMONSTRATED" : "REVIEW AND TRY AGAIN",
            12, result.passed ? "#55E8D5" : "#FBBF24", 760, true);
        text(this.scene, this.layer, 129, 281,
            `SCORE ${result.score}/${result.total}  /  REQUIRED ${this.lesson.minScore}/${result.total}  /  ATTEMPT ${result.attempts}`,
            11, "#E2E8F0", 760, true);
        text(this.scene, this.layer, 129, 324,
            result.firstMastery ? `+${result.awardedXp} XP  /  FIRST MASTERY` :
            result.passed ? "MASTERED ALREADY  /  NO DUPLICATE XP" :
            "NO XP AWARDED. COMPLETE THE MASTERY CHECK.",
            10, result.firstMastery ? "#55E8D5" : "#FBBF24", 760, true);
        text(this.scene, this.layer, 129, 369, "CASE FEEDBACK", 9, "#7DD3FC", 730, true);
        if (!this.wrongIds.length) {
            text(this.scene, this.layer, 129, 405,
                "Excellent work. No incorrect answers to review.", 17, "#C7D5E4", 720);
        } else {
            this.wrongIds.slice(0, 3).forEach((id, index) => {
                const c = this.assessment.find((q) => q.source.id === id)?.source;
                if (!c) return;
                text(this.scene, this.layer, 130, 400 + index * 64,
                    `${index + 1}. ${c.title}: ${c.explanation}`, 13, "#FBACB6", 728);
            });
            if (this.wrongIds.length > 3)
                text(this.scene, this.layer, 130, 586, "All mistakes were added to your review queue.", 11, "#A5B8C9", 735);
        }
        button(this.scene, this.layer, 668, 636, 255, 39,
            result.passed ? "BACK TO UNIT >" : "RETRY MASTERY >",
            () => result.passed ? this.onBack() : this.beginAssessment(),
            { size: 8, border: result.passed ? A.teal : A.gold });
    }
}
