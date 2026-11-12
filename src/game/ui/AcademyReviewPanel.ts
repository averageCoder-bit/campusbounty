import * as Phaser from "phaser";
import { findAcademyChallenge } from "../data/curriculum/academyLessons";
import { getReviewQueue, resolveReview } from "../data/LearningProgress";
import { prepareChallenge, type AcademyChallenge } from "../systems/LearningEngine";
import { A, button, panel, text, type Layer } from "./AcademyWidgets";
import { LearningChallengeUI } from "./LearningChallengeUI";

/** Re-practices mistakes, no XP payout, no fabricated spaced-repetition claims. */
export class AcademyReviewPanel {
    private readonly scene: Phaser.Scene;
    private readonly layer: Layer;
    private readonly onBack: () => void;
    private questions: AcademyChallenge[] = [];
    private index = 0;
    private current?: LearningChallengeUI;
    private revealed: boolean | null = null;
    constructor(scene: Phaser.Scene, layer: Layer, onBack: () => void) {
        this.scene = scene; this.layer = layer; this.onBack = onBack;
        this.questions = getReviewQueue(scene).map(findAcademyChallenge)
            .filter((q): q is AcademyChallenge => !!q).slice(0, 12);
        this.reset();
    }
    private reset(): void {
        const q = this.questions[this.index];
        this.revealed = null;
        this.current = q ? new LearningChallengeUI(this.scene, this.layer,
            prepareChallenge(q, this.index + 1), () => { this.revealed = null; this.render(); }) : undefined;
        this.render();
    }
    handleKey(event: KeyboardEvent): void {
        if (event.repeat) return;
        if (event.code === "Enter") { event.preventDefault(); this.advance(); return; }
        if (this.revealed !== null) return;
        if (this.current?.handleKey(event)) return;
        if (/^(Digit|Numpad)[1-3]$/.test(event.code) && this.current?.item.source.kind !== "fill") {
            event.preventDefault(); this.current?.choose(Number(event.code.slice(-1)) - 1);
        }
    }
    private advance(): void {
        if (!this.current) return;
        if (this.revealed === null) {
            if (!this.current.hasAnswer) return;
            this.revealed = this.current.isCorrect;
            resolveReview(this.scene, this.current.item.source.id, this.revealed);
            this.render();
        } else if (++this.index < this.questions.length) this.reset();
        else this.onBack();
    }
    private render(): void {
        this.layer.removeAll(true);
        text(this.scene, this.layer, 108, 157, "MISTAKE REVIEW", 14, "#FBBF24", 600, true);
        text(this.scene, this.layer, 108, 184, "Practice previous errors. Review grants no extra XP.",
            13, "#A5B8C9", 740);
        if (!this.current) {
            panel(this.scene, this.layer, 108, 217, 816, 390, A.panel, A.border);
            text(this.scene, this.layer, 153, 320, "NO REVIEW QUESTIONS YET", 14, "#55E8D5", 720, true);
            text(this.scene, this.layer, 153, 374,
                "Missed questions from the first two chapters appear here. You can revisit lessons anytime.",
                18, "#E2E8F0", 720);
        } else {
            text(this.scene, this.layer, 917, 166, `${this.index + 1}/${this.questions.length}`, 9,
                "#7DD3FC", 125, true).setOrigin(1, 0);
            this.current.render(this.revealed !== null);
            if (this.revealed !== null)
                text(this.scene, this.layer, 128, 559, this.revealed ?
                    "CORRECT. Removed from your mistake queue." :
                    `REVIEW: ${this.current.item.source.explanation.slice(0, 156)}`, 11,
                    this.revealed ? "#55E8D5" : "#FB7185", 313);
            button(this.scene, this.layer, 669, 636, 254, 39,
                this.revealed === null ? "CHECK RESPONSE >" : "NEXT REVIEW >",
                () => this.advance(), { size: 8, border: A.teal,
                    disabled: this.revealed === null && !this.current.hasAnswer });
        }
        button(this.scene, this.layer, 108, 636, 168, 39, "< ACADEMY", () => this.onBack(), { size: 8 });
    }
}
