import * as Phaser from "phaser";
import { type AcademyTrack, type AcademyUnit } from "../data/questAcademyCurriculum";
import { A, button, hex, panel, text, type Layer } from "./AcademyWidgets";

export interface PathMapOptions {
    start: number;
    selected: number;
    completed: (unit: AcademyUnit) => boolean;
    onSelect: (index: number) => void;
    onScroll: (next: number) => void;
}
/** 10-unit serpentine journey; wheel and paging keep nodes within the 1024x768 canvas. */
export function drawLearningPath(scene: Phaser.Scene, layer: Layer, track: AcademyTrack,
    opts: PathMapOptions): void {
    panel(scene, layer, 108, 216, 471, 389, A.dark, A.border);
    const line = scene.add.graphics(); layer.add(line);
    const visible = track.units.slice(opts.start, opts.start + 4);
    visible.forEach((unit, i) => {
        const absolute = i + opts.start;
        const y = 250 + i * 89;
        const x = (absolute % 2 === 0) ? 145 : 184;
        const done = opts.completed(unit);
        const chosen = opts.selected === absolute;
        const color = done ? A.teal : unit.status === "published" ? track.accent :
            unit.status === "bridge" ? A.cyan : 0x64748b;
        if (i < visible.length - 1) {
            const nextX = (absolute % 2 === 0) ? 184 : 145;
            line.lineStyle(4, done ? 0x316d64 : A.border, 0.85);
            line.beginPath(); line.moveTo(x + 17, y + 33); line.lineTo(nextX + 17, y + 89);
            line.strokePath();
        }
        const circle = scene.add.circle(x + 17, y, chosen ? 22 : 19, A.raised, 1)
            .setStrokeStyle(chosen ? 4 : 2, color).setInteractive({ useHandCursor: true });
        circle.on("pointerdown", () => opts.onSelect(absolute)); layer.add(circle);
        text(scene, layer, x + 17, y, done ? "✓" : String(absolute + 1),
            done ? 17 : 11, done ? "#55E8D5" : "#E2E8F0", 38, true).setOrigin(0.5);
        const bg = panel(scene, layer, 244, y - 30, 319, 64,
            chosen ? A.hover : A.panel, chosen ? track.accent : A.border);
        bg.setInteractive({ useHandCursor: true }); bg.on("pointerdown", () => opts.onSelect(absolute));
        text(scene, layer, 258, y - 21, unit.title.toUpperCase(), 9,
            done ? "#55E8D5" : chosen ? hex(track.accent) : "#E2E8F0", 286, true);
        const status = done ? "CHAPTER COMPLETE" : unit.status === "published" ? "CHAPTER READY" :
            unit.status === "bridge" ? "BRIDGE LESSON AVAILABLE" : "CURRICULUM PLANNED";
        text(scene, layer, 258, y + 5, status, 10, done ? "#55E8D5" : "#9EB0C4", 284);
    });
    text(scene, layer, 108, 615, `UNITS ${opts.start + 1}-${Math.min(10, opts.start + 4)} / 10`,
        9, "#A5B8C9", 200, true);
    button(scene, layer, 385, 611, 88, 34, "UP", () => opts.onScroll(Math.max(0, opts.start - 2)),
        { disabled: opts.start === 0, size: 8 });
    button(scene, layer, 482, 611, 97, 34, "DOWN", () => opts.onScroll(Math.min(6, opts.start + 2)),
        { disabled: opts.start >= 6, size: 8 });
}
