import * as Phaser from "phaser";
import { refreshVerifiedProgression } from "../services/ProgressionClient";
import { isVerifiedAccount } from "../data/LearningProgress";
import { ACADEMY_TRACKS, type AcademyTrack, type AcademyUnit } from "../data/questAcademyCurriculum";
import { getAcademyLesson } from "../data/curriculum/academyLessons";
import { getInteractiveLesson } from "../data/lessonContent";
import { dailyMasteries, getLessonMastery, getLearningProgress, getReviewQueue,
    isLearningStorageAvailable, syncAcademyXP } from "../data/LearningProgress";
import { AcademyLessonPanel } from "./AcademyLessonPanel";
import { AcademyReviewPanel } from "./AcademyReviewPanel";
import { LessonPanel } from "./LessonPanel"; // G3.7 authored bridge lessons retained.
import { drawLearningPath } from "./LearningPathMap";
import { A, button, hex, panel, text, type Layer } from "./AcademyWidgets";

export interface QuestBoardUIOptions {
    onOpenChanged?: (open: boolean) => void;
    onProgressChanged?: () => void;
}
type View = "home" | "roadmap" | "unit" | "lesson" | "review" | "awards";

/** G3.8: scrollable 40-unit academy with 12 fully authored lessons and two G3.7 bridges. */
export class QuestBoardUI {
    private readonly scene: Phaser.Scene;
    private readonly onOpenChanged?: (open: boolean) => void;
    private readonly onProgressChanged?: () => void;
    private readonly root: Layer;
    private page: Layer;
    private opened = false;
    private destroyed = false;
    private view: View = "home";
    private selectedTrack?: AcademyTrack;
    private selectedUnitIndex = 0;
    private unitScroll = 0;
    private activePanel?: AcademyLessonPanel | AcademyReviewPanel | LessonPanel;
    private cloudError = "";
    private readonly authChanged = (): void => { void this.refreshCloud(); };
    private async refreshCloud(): Promise<void> {
        try {
            await refreshVerifiedProgression(this.scene);
            this.cloudError = "";
        } catch (error) {
            this.cloudError = error instanceof Error ? error.message : "Cloud connection failed";
        }
        if (this.destroyed) return;
        if (this.opened && this.view === "home") this.renderHome();
        if (this.opened && this.view === "unit") this.renderUnit();
        this.onProgressChanged?.();
    }

    private readonly onEscapeKey = (event: KeyboardEvent): void => {
        if (!this.opened) return;
        event.preventDefault();
        this.back();
    };
    private readonly onKeyboard = (event: KeyboardEvent): void => {
        if (!this.opened || event.code === "Escape") return;
        this.activePanel?.handleKey(event);
    };
    private readonly onWheel = (_pointer: Phaser.Input.Pointer,
        _objects: Phaser.GameObjects.GameObject[], _dx: number, dy: number): void => {
        if (!this.opened || this.view !== "roadmap" || !this.selectedTrack) return;
        this.unitScroll = Phaser.Math.Clamp(this.unitScroll + (dy > 0 ? 1 : -1), 0, 6);
        this.renderRoadmap();
    };

    get isOpen(): boolean { return this.opened; }
    getCameraObjects(): Phaser.GameObjects.GameObject[] { return [this.root]; }
    constructor(scene: Phaser.Scene, opts: QuestBoardUIOptions = {}) {
        this.scene = scene; this.onOpenChanged = opts.onOpenChanged;
        this.onProgressChanged = opts.onProgressChanged;
        this.root = scene.add.container(0, 0).setScrollFactor(0).setDepth(15000).setVisible(false);
        this.root.add(scene.add.rectangle(0, 0, 1024, 768, A.shadow, .86).setOrigin(0).setInteractive());
        const frame = scene.add.graphics();
        frame.fillStyle(0x03050a, .8).fillRect(76, 69, 896, 655);
        frame.fillStyle(0x8a542b).fillRect(64, 56, 896, 654);
        frame.fillStyle(0xc28a4a).fillRect(70, 62, 884, 642);
        frame.fillStyle(A.dark).fillRect(78, 70, 868, 626);
        frame.fillStyle(A.panel).fillRect(84, 76, 856, 614);
        frame.fillStyle(A.gold); frame.fillRect(100, 129, 824, 2); frame.fillRect(100, 623, 824, 2);
        for (const [x, y] of [[82,74],[928,74],[82,680],[928,680]]) {
            frame.fillStyle(0xf7dfb2).fillRect(x, y, 11, 11);
            frame.fillStyle(0x8a542b).fillRect(x+3, y+3, 5, 5);
        }
        this.root.add(frame);
        text(scene, this.root, 104, 91, "CAMPUSBOUNTY  /  QUEST ACADEMY", 13, "#FBBF24", 660, true);
        text(scene, this.root, 105, 116, "LEARN  >  PRACTICE  >  MASTER  >  PLAY", 8, "#A5B8C9", 650, true);
        button(scene, this.root, 805, 88, 122, 30, "X CLOSE", () => this.close(), { size: 8 });
        this.page = scene.add.container(0, 0); this.root.add(this.page);
        this.renderHome();
        scene.input.keyboard?.on("keydown-ESC", this.onEscapeKey);
        scene.input.keyboard?.on("keydown", this.onKeyboard);
        scene.input.on("wheel", this.onWheel);
        if (typeof window !== "undefined")
            window.addEventListener("campusbounty:auth-changed", this.authChanged);
    }
    open(): void {
        if (this.destroyed || this.opened) return;
        const xpRestored = syncAcademyXP(this.scene);
        this.opened = true; this.selectedTrack = undefined; this.view = "home";
        this.renderHome(); this.root.setVisible(true); this.onOpenChanged?.(true);
        if (xpRestored) this.onProgressChanged?.();
        void this.refreshCloud();
    }
    close(): void {
        if (!this.opened || this.destroyed) return;
        this.opened = false; this.activePanel = undefined;
        this.root.setVisible(false); this.onOpenChanged?.(false);
    }
    destroy(): void {
        if (this.destroyed) return;
        this.close(); this.destroyed = true;
        this.scene.input.keyboard?.off("keydown-ESC", this.onEscapeKey);
        this.scene.input.keyboard?.off("keydown", this.onKeyboard);
        this.scene.input.off("wheel", this.onWheel);
        if (typeof window !== "undefined")
            window.removeEventListener("campusbounty:auth-changed", this.authChanged);
        this.root.destroy(true);
    }
    private resetPage(): void {
        this.activePanel = undefined;
        this.page.destroy(true);
        this.page = this.scene.add.container(0, 0); this.root.add(this.page);
    }
    private back(): void {
        if (this.view === "lesson") this.renderUnit();
        else if (this.view === "unit") this.renderRoadmap();
        else if (this.view === "roadmap" || this.view === "review" || this.view === "awards") this.renderHome();
        else this.close();
    }
    private sectionTitle(title: string, subtitle: string): void {
        text(this.scene, this.page, 108, 157, title, 13, "#F7DFB2", 795, true);
        text(this.scene, this.page, 108, 186, subtitle, 13, "#A5B8C9", 795);
    }
    private publishedCount(track: AcademyTrack): { done: number; available: number } {
        const ids = track.units.flatMap((u) => u.lessonIds);
        return { available: ids.length, done: ids.filter((id) => getLessonMastery(this.scene, id).mastered).length };
    }
    private renderHome(): void {
        this.view = "home"; this.resetPage();
        this.sectionTitle("SELECT YOUR LEARNING PATH", "Four curricula, 40 units, guided practice and genuine assessments.");
        ACADEMY_TRACKS.forEach((track, index) => {
            const x = 108 + (index % 2) * 417, y = 232 + Math.floor(index / 2) * 181;
            const { done, available } = this.publishedCount(track);
            const availableAny = available > 0;
            const rect = panel(this.scene, this.page, x, y, 395, 162,
                availableAny ? A.raised : A.panel, track.accent);
            rect.setInteractive({ useHandCursor: true });
            rect.on("pointerover", () => rect.setFillStyle(A.hover));
            rect.on("pointerout", () => rect.setFillStyle(availableAny ? A.raised : A.panel));
            rect.on("pointerdown", () => this.showTrack(track));
            text(this.scene, this.page, x + 16, y + 16, track.title, 11, hex(track.accent), 363, true);
            text(this.scene, this.page, x + 16, y + 43, track.subtitle, 8, "#F7DFB2", 362, true);
            text(this.scene, this.page, x + 16, y + 68, track.overview, 15, "#D7E3F1", 361);
            text(this.scene, this.page, x + 16, y + 135,
                availableAny ? `${done}/${available} LESSONS MASTERED   /   VIEW JOURNEY >` :
                    "10 UNIT OUTLINE  /  CONTENT IN DEVELOPMENT >", 8,
                availableAny ? "#55E8D5" : "#94A3B8", 367, true);
        });
        const reviewCount = getReviewQueue(this.scene).length;
        const today = dailyMasteries(this.scene);
        text(this.scene, this.page, 108, 609,
            `DAILY GOAL ${Math.min(today, 2)}/2   /   ${reviewCount} TO REVIEW   /   ` +
            (this.cloudError ? "CLOUD CONNECTION ERROR" : isVerifiedAccount(this.scene)
                ? "CLOUD ACCOUNT ACTIVE" : isLearningStorageAvailable()
                ? "GUEST LOCAL SAVE" : "SAVE UNAVAILABLE"),
            8, "#7DD3FC", 802, true);
        button(this.scene, this.page, 108, 645, 235, 37, `REVIEW MISTAKES (${reviewCount})`,
            () => this.renderReview(), { border: A.teal, size: 8 });
        button(this.scene, this.page, 357, 645, 207, 37, "ACHIEVEMENTS", () => this.renderAwards(), { size: 8 });
        text(this.scene, this.page, 582, 655, isVerifiedAccount(this.scene) ? "CLOUD ACADEMY SAVED  /  ADVENTURES ARE LOCAL" :
                "GUEST PROGRESS  /  NOT AN OFFICIAL CREDENTIAL",
            8, "#A5B8C9", 343, true);
    }
    private showTrack(track: AcademyTrack): void {
        this.selectedTrack = track; this.selectedUnitIndex = 0; this.unitScroll = 0;
        this.renderRoadmap();
    }
    private unitComplete(unit: AcademyUnit): boolean {
        return unit.status === "published" && unit.lessonIds.length > 0 &&
            unit.lessonIds.every((id) => getLessonMastery(this.scene, id).mastered);
    }
    private renderRoadmap(): void {
        const track = this.selectedTrack; if (!track) { this.renderHome(); return; }
        this.view = "roadmap"; this.resetPage();
        this.sectionTitle(track.title, "Scroll to explore all ten units. Only authored chapters are playable.");
        drawLearningPath(this.scene, this.page, track, {
            start: this.unitScroll, selected: this.selectedUnitIndex,
            completed: (unit) => this.unitComplete(unit),
            onSelect: (i) => { this.selectedUnitIndex = i; this.renderRoadmap(); },
            onScroll: (i) => { this.unitScroll = i; this.renderRoadmap(); },
        });
        const unit = track.units[this.selectedUnitIndex];
        panel(this.scene, this.page, 603, 216, 321, 389, A.dark, A.border);
        text(this.scene, this.page, 621, 238, `UNIT ${String(this.selectedUnitIndex + 1).padStart(2, "0")}`, 10,
            hex(track.accent), 280, true);
        text(this.scene, this.page, 621, 274, unit.title.toUpperCase(), 11, "#F7DFB2", 288, true);
        text(this.scene, this.page, 621, 322, unit.summary, 16, "#E2E8F0", 282);
        text(this.scene, this.page, 621, 407, "OBJECTIVE", 9, "#55E8D5", 279, true);
        text(this.scene, this.page, 621, 434, unit.goal, 15, "#E2E8F0", 283);
        text(this.scene, this.page, 621, 507,
            unit.status === "published" ? `${unit.lessonIds.length} LESSONS + CAPSTONE` :
            unit.status === "bridge" ? "G3.7 LEGACY LESSON" : "OUTLINE ONLY; NOT YET PUBLISHED",
            8, "#A5B8C9", 287, true);
        button(this.scene, this.page, 621, 550, 286, 41,
            unit.status === "planned" ? "VIEW OUTLINE" : "OPEN UNIT  >",
            () => this.renderUnit(), { border: unit.status === "planned" ? A.border : A.teal, size: 9 });
        button(this.scene, this.page, 108, 644, 185, 38, "< ALL PATHS", () => this.renderHome(), { size: 8 });
        const p = this.publishedCount(track);
        text(this.scene, this.page, 323, 656, `${p.done}/${p.available} AUTHORED LESSONS MASTERED`,
            9, "#A5B8C9", 594, true);
    }
    private renderUnit(): void {
        const track = this.selectedTrack; if (!track) { this.renderHome(); return; }
        this.view = "unit"; this.resetPage();
        const unit = track.units[this.selectedUnitIndex];
        this.sectionTitle(unit.title.toUpperCase(), unit.goal);
        if (unit.status === "planned") {
            panel(this.scene, this.page, 108, 220, 816, 380, A.dark, A.border);
            text(this.scene, this.page, 143, 284, "CURRICULUM OUTLINE — LESSONS NOT PUBLISHED", 11,
                "#FBBF24", 738, true);
            text(this.scene, this.page, 143, 339,
                unit.summary + "\n\nThis unit is shown so you can see the full learning journey. " +
                "It has no fake mastery state or XP reward.", 19, "#E2E8F0", 731);
        } else {
            const total = unit.lessonIds.length;
            for (let i = 0; i < total; i++) {
                const id = unit.lessonIds[i];
                const academy = getAcademyLesson(id);
                const legacy = getInteractiveLesson(id);
                const known = academy ?? legacy;
                const mastered = getLessonMastery(this.scene, id).mastered;
                const eligible = unit.status === "bridge" || i === 0 ||
                    unit.lessonIds.slice(0, i).every((prev) => getLessonMastery(this.scene, prev).mastered);
                const x = 109, y = 216 + i * (total > 1 ? 67 : 91);
                panel(this.scene, this.page, x, y, 814, total > 1 ? 61 : 82,
                    mastered ? 0x173e3e : A.raised, mastered ? A.teal : eligible ? A.border : 0x33465a);
                text(this.scene, this.page, x + 17, y + 12, `${String(i + 1).padStart(2, "0")}  ${known?.title ?? id}`,
                    10, mastered ? "#55E8D5" : "#E2E8F0", 548, true);
                text(this.scene, this.page, x + 17, y + 37,
                    mastered ? "MASTERED  /  REPLAY ALLOWED" : eligible ?
                        `READY  /  +${known?.xpReward ?? 0} XP ON FIRST MASTERY` :
                        "LOCKED  /  MASTER PREVIOUS LESSONS FIRST", 8, "#A5B8C9", 545, true);
                button(this.scene, this.page, x + 630, y + 12, 168, 35,
                    mastered ? "REPLAY" : eligible ? "START  >" : "LOCKED",
                    () => { if (eligible) this.showLesson(id); },
                    { disabled: !eligible || !known, border: mastered ? A.teal : A.gold, size: 8 });
            }
        }
        button(this.scene, this.page, 108, 645, 190, 38, "< ROADMAP", () => this.renderRoadmap(), { size: 8 });
        text(this.scene, this.page, 325, 657,
            unit.status === "published" ? "CHAPTER CAPSTONE OPENS AFTER ITS PREREQUISITES" :
                unit.status === "bridge" ? "G3.7 CONTENT PRESERVED  /  OPTIONAL BRIDGE" :
                    "40 UNITS PLANNED  /  NO PRETEND PROGRESS", 8, "#A5B8C9", 584, true);
    }
    private showLesson(id: string): void {
        this.view = "lesson"; this.resetPage();
        const academy = getAcademyLesson(id);
        if (academy) this.activePanel = new AcademyLessonPanel(this.scene, this.page, academy,
            () => this.renderUnit(), () => this.onProgressChanged?.());
        else {
            const old = getInteractiveLesson(id);
            if (!old) { this.renderUnit(); return; }
            this.activePanel = new LessonPanel(this.scene, this.page, old, {
                onBack: () => this.renderUnit(), onProgressChanged: () => this.onProgressChanged?.(),
            });
        }
    }
    private renderReview(): void {
        this.view = "review"; this.resetPage();
        this.activePanel = new AcademyReviewPanel(this.scene, this.page, () => this.renderHome());
    }
    private renderAwards(): void {
        this.view = "awards"; this.resetPage();
        this.sectionTitle("ACHIEVEMENTS & STUDY PROGRESS", "Earn achievements by passing chapter trials—not by visiting the screen.");
        const p = getLearningProgress(this.scene);
        panel(this.scene, this.page, 108, 221, 816, 385, A.dark, A.border);
        const rows: Array<[string, string, string]> = [
            ["computing-apprentice", "COMPUTING APPRENTICE", "Master the six Computing Fundamentals lessons"],
            ["ledger-explorer", "LEDGER EXPLORER", "Master the six Blockchain Foundations lessons"],
        ];
        rows.forEach(([key, title, desc], i) => {
            const y = 249 + i * 137; const unlocked = p.achievements.includes(key);
            panel(this.scene, this.page, 132, y, 769, 113,
                unlocked ? 0x183b39 : A.panel, unlocked ? A.teal : A.border);
            text(this.scene, this.page, 156, y + 18,
                `${unlocked ? "[ EARNED ]" : "[ LOCKED ]"}  ${title}`, 10,
                unlocked ? "#55E8D5" : "#A5B8C9", 716, true);
            text(this.scene, this.page, 156, y + 52, desc, 17, "#D7E3F1", 704);
        });
        text(this.scene, this.page, 133, 555,
            `LOCAL ACADEMY XP EARNED: ${p.academyXpEarned}    /    TODAY: ${dailyMasteries(this.scene)} LESSONS`,
            9, "#7DD3FC", 746, true);
        button(this.scene, this.page, 108, 645, 190, 38, "< ACADEMY", () => this.renderHome(), { size: 8 });
        text(this.scene, this.page, 319, 653,
            "DEMO ACHIEVEMENTS ARE NOT VERIFIED CERTIFICATES", 8, "#A5B8C9", 600, true);
    }
}
