import * as Phaser from "phaser";

/** Presentation scenes never award XP, grade Academy attempts or issue credentials. */
export interface PresentationSceneData {
    returnSceneKey?: string;
}

export type DemoGameId = "quest-finding" | "dungeon-conquer";
export interface DemoEventData {
    mode: DemoGameId;
    presentationOnly: true;
    awardsXp: false;
    earnedCredential: false;
}

export const DEMO_W = 1024;
export const DEMO_H = 768;
const PIXEL = '"Press Start 2P", monospace';
const BODY = '"VT323", monospace';

export function label(
    scene: Phaser.Scene, x: number, y: number, value: string,
    size = 12, color = "#fef3c7", pixel = true,
): Phaser.GameObjects.Text {
    return scene.add.text(x, y, value, {
        fontFamily: pixel ? PIXEL : BODY,
        fontSize: `${size}px`, color, resolution: 2,
        lineSpacing: 6,
    });
}

export function button(
    scene: Phaser.Scene, x: number, y: number, width: number, height: number,
    text: string, handler: () => void, accent = 0xfbbf24, size = 10,
): Phaser.GameObjects.Container {
    const group = scene.add.container(x, y);
    const shadow = scene.add.rectangle(4, 5, width, height, 0x020611).setOrigin(0);
    const bg = scene.add.rectangle(0, 0, width, height, 0x183047)
        .setOrigin(0).setStrokeStyle(3, accent)
        .setInteractive({ useHandCursor: true });
    const shine = scene.add.rectangle(4, 4, width - 8, 3, accent, 0.65).setOrigin(0);
    const caption = label(scene, width / 2, height / 2, text, size)
        .setOrigin(0.5).setColor("#ffffff");
    bg.on("pointerover", () => bg.setFillStyle(0x28516a));
    bg.on("pointerout", () => bg.setFillStyle(0x183047));
    bg.on("pointerdown", handler);
    group.add([shadow, bg, shine, caption]);
    return group;
}

export function frame(scene: Phaser.Scene, headline: string, strap: string, accent: number): void {
    const g = scene.add.graphics();
    g.fillStyle(0x040914).fillRect(0, 0, DEMO_W, DEMO_H);
    // Quantized stonework; deterministic and no network assets.
    for (let y = 0; y < DEMO_H; y += 40) {
        for (let x = -24 + ((y / 40) % 2) * 20; x < DEMO_W; x += 80) {
            g.fillStyle((x + y) % 3 === 0 ? 0x13213a : 0x101c30)
                .fillRect(x, y, 78, 38);
            g.fillStyle(0x060e1b).fillRect(x, y + 36, 78, 2);
        }
    }
    g.fillStyle(0x020611, 0.75).fillRect(34, 25, 956, 720);
    g.lineStyle(6, 0x8b5b2c).strokeRect(34, 25, 956, 720);
    g.lineStyle(2, accent).strokeRect(43, 34, 938, 702);
    g.fillStyle(0x091524).fillRect(50, 45, 924, 76);
    g.lineStyle(2, accent).strokeRect(50, 45, 924, 76);
    label(scene, 76, 65, headline, 17, "#fbbf24");
    label(scene, 76, 101, strap, 10, "#7dd3fc");
    label(scene, 70, 707, "PRESENTATION MODE  /  NO XP OR CREDENTIALS AWARDED", 8, "#94a3b8");
}

/** Multiple choice is a *local showcase check*, not a server-graded attempt. */
export function question(
    scene: Phaser.Scene,
    prompt: string,
    answers: readonly [string, string, string],
    correct: 0 | 1 | 2,
    onCorrect: () => void,
): Phaser.GameObjects.Container {
    const overlay = scene.add.container(0, 0).setDepth(100);
    overlay.add(scene.add.rectangle(0, 0, DEMO_W, DEMO_H, 0x020611, 0.88)
        .setOrigin(0).setInteractive());
    overlay.add(scene.add.rectangle(142, 168, 740, 445, 0x0d2136)
        .setOrigin(0).setStrokeStyle(5, 0xfbbf24));
    overlay.add(label(scene, 184, 202, "SECURITY CHECK", 18, "#55e8d5"));
    overlay.add(label(scene, 184, 252, prompt, 24, "#ffffff", false)
        .setWordWrapWidth(648, true));
    const info = label(scene, 184, 565, "Choose the safest answer.", 19, "#9dd9ee", false);
    overlay.add(info);
    answers.forEach((answer, index) => {
        overlay.add(button(scene, 186, 326 + index * 72, 652, 52,
            `${index + 1}. ${answer}`, () => {
                if (index === correct) {
                    overlay.destroy(true);
                    onCorrect();
                } else {
                    info.setText("Not quite. Try a safer choice.").setColor("#fda4af");
                }
            }, index === correct ? 0x55e8d5 : 0x8b6b37, 9));
    });
    return overlay;
}

export function completed(
    scene: Phaser.Scene, mode: DemoGameId,
    onReturn: () => void,
    onProof: () => void,
): void {
    const overlay = scene.add.container(0, 0).setDepth(110);
    overlay.add(scene.add.rectangle(0, 0, DEMO_W, DEMO_H, 0x020611, 0.9)
        .setOrigin(0).setInteractive());
    overlay.add(scene.add.rectangle(155, 200, 714, 365, 0x0d2136)
        .setOrigin(0).setStrokeStyle(5, 0x55e8d5));
    overlay.add(label(scene, 224, 255, "DEMO CLEARED!", 22, "#fbbf24"));
    overlay.add(label(scene, 224, 310, "The short challenge and local question are complete.",
        23, "#ffffff", false));
    overlay.add(label(scene, 224, 348, "This is not a verified Academy achievement.",
        22, "#fda4af", false));
    overlay.add(label(scene, 224, 384, "Open the separate BSC Testnet proof showcase.",
        21, "#9dd9ee", false));
    overlay.add(button(scene, 219, 455, 290, 58, "BACK TO HALL", onReturn, 0xfbbf24, 10));
    overlay.add(button(scene, 528, 455, 288, 58, "VIEW WEB3 PROOF", () => {
        const event: DemoEventData = {
            mode, presentationOnly: true, awardsXp: false, earnedCredential: false,
        };
        // Host React UI must listen for this event and open the EXISTING Web3 panel.
        scene.game.events.emit("campusbounty:demo:proof-requested", event);
        if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("campusbounty:demo:proof-requested", { detail: event }));
        }
        onProof();
    }, 0x55e8d5, 9));
}

export function backToHall(scene: Phaser.Scene, data: PresentationSceneData): void {
    scene.scene.start(data.returnSceneKey || "Game");
}
