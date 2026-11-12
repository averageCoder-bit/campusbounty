import * as Phaser from "phaser";
import { type ChallengeAnswer, type PreparedChallenge, checkChallenge } from "../systems/LearningEngine";
import { A, button, panel, text, type Layer } from "./AcademyWidgets";

/** Shared interactive challenge painter for lesson assessments and spaced mistake reviews. */
export class LearningChallengeUI {
    private readonly scene: Phaser.Scene;
    private readonly layer: Layer;
    readonly item: PreparedChallenge;
    private readonly onChange: () => void;
    answer: ChallengeAnswer = null;
    showHint = false;
    constructor(scene: Phaser.Scene, layer: Layer, item: PreparedChallenge, onChange: () => void) {
        this.scene = scene; this.layer = layer; this.item = item; this.onChange = onChange;
    }
    choose(index: number): void {
        if (index < 0 || index >= this.item.options.length) return;
        if (this.item.source.kind === "sequence") {
            const sequence = Array.isArray(this.answer) ? [...this.answer] : [];
            if (sequence.includes(index)) this.answer = sequence.filter((n) => n !== index);
            else if (sequence.length < 3) this.answer = [...sequence, index];
        } else if (this.item.source.kind !== "fill") this.answer = index;
        this.onChange();
    }
    get hasAnswer(): boolean {
        if (typeof this.answer === "number") return true;
        if (typeof this.answer === "string") return this.answer.trim().length > 0;
        return Array.isArray(this.answer) && this.answer.length === 3;
    }
    get isCorrect(): boolean { return checkChallenge(this.item, this.answer); }
    handleKey(event: KeyboardEvent): boolean {
        if (this.item.source.kind !== "fill" || event.ctrlKey || event.altKey || event.metaKey) return false;
        const current = typeof this.answer === "string" ? this.answer : "";
        if (event.key === "Backspace") this.answer = current.slice(0, -1);
        else if (event.key.length === 1 && current.length < 54) this.answer = current + event.key;
        else return false;
        event.preventDefault(); this.onChange(); return true;
    }
    render(readOnly = false): void {
        const q = this.item.source;
        panel(this.scene, this.layer, 108, 215, 350, 391, A.panel, A.border);
        panel(this.scene, this.layer, 476, 215, 447, 391, A.dark, A.border);
        text(this.scene, this.layer, 125, 234, q.title.toUpperCase(), 10, "#FBBF24", 310, true);
        text(this.scene, this.layer, 125, 270, q.prompt, 17, "#E2E8F0", 307);
        if (q.context) {
            panel(this.scene, this.layer, 125, 371, 315, 174, 0x090e1a, A.border);
            text(this.scene, this.layer, 138, 383, "CONTEXT / CODE", 8, "#7DD3FC", 294, true);
            text(this.scene, this.layer, 137, 409, q.context, 14, "#C7D5E4", 282);
        } else {
            text(this.scene, this.layer, 125, 408, "APPLY WHAT YOU LEARNED", 9, "#7DD3FC", 300, true);
            text(this.scene, this.layer, 125, 444, q.hint, 14, "#A5B8C9", 298);
        }
        text(this.scene, this.layer, 494, 233, q.kind === "trace" ? "TRACE THE CODE" :
            q.kind === "sequence" ? "ARRANGE IN CORRECT ORDER" : q.kind === "fill" ? "TYPE THE MISSING ANSWER" :
            "CHOOSE THE BEST ANSWER", 9, "#55E8D5", 405, true);
        if (q.kind === "fill") {
            const val = typeof this.answer === "string" ? this.answer : "";
            panel(this.scene, this.layer, 495, 298, 409, 86, A.raised, A.gold);
            text(this.scene, this.layer, 510, 317, `${val || "Type using your keyboard..."}${!readOnly ? "_" : ""}`,
                17, val ? "#F7DFB2" : "#94A3B8", 375);
            text(this.scene, this.layer, 495, 404, "Enter a short value or code fragment. No code is executed.",
                13, "#A5B8C9", 397);
        } else {
            this.item.options.forEach((choice, i) => {
                const selected = typeof this.answer === "number" ? this.answer === i :
                    Array.isArray(this.answer) && this.answer.includes(i);
                const step = Array.isArray(this.answer) ? this.answer.indexOf(i) : -1;
                const label = (q.kind === "sequence" ? `${step >= 0 ? step + 1 : "•"}` : `${i + 1}`) + `  ${choice}`;
                button(this.scene, this.layer, 493, 285 + i * 80, 414, 72, label, () => {
                    if (readOnly) return;
                    this.choose(i);
                }, { fill: selected ? A.hover : A.raised, border: selected ? A.teal : A.border,
                    size: 14, pixel: false, align: "left", disabled: readOnly });
            });
        }
        if (this.showHint) text(this.scene, this.layer, 497, 553, q.hint, 12, "#FBBF24", 407);
    }
}
