import * as Phaser from "phaser";
export type Layer = Phaser.GameObjects.Container;
export const A = {
    dark: 0x08111f, shadow: 0x04080e, panel: 0x13243a, raised: 0x1b3550,
    hover: 0x26405c, border: 0x4e6881, gold: 0xfbbf24,
    teal: 0x55e8d5, cyan: 0x7dd3fc, muted: 0xa5b8c9, bad: 0xfb7185,
} as const;
const PIXEL = '"Press Start 2P", monospace';
const BODY = '"Trebuchet MS", Arial, sans-serif';
export function text(scene: Phaser.Scene, layer: Layer, x: number, y: number,
    value: string, fontSize = 13, color = "#E2E8F0", wrap = 0, pixel = false): Phaser.GameObjects.Text {
    const node = scene.add.text(x, y, value, {
        fontFamily: pixel ? PIXEL : BODY, fontSize: `${fontSize}px`, color,
        lineSpacing: pixel ? 5 : 4,
        ...(wrap ? { wordWrap: { width: wrap, useAdvancedWrap: true } } : {}),
    });
    layer.add(node);
    return node;
}
export function panel(scene: Phaser.Scene, layer: Layer, x: number, y: number,
    w: number, h: number, fill: number = A.panel, border: number = A.border): Phaser.GameObjects.Rectangle {
    const node = scene.add.rectangle(x, y, w, h, fill).setOrigin(0).setStrokeStyle(2, border);
    layer.add(node); return node;
}
export function button(scene: Phaser.Scene, layer: Layer, x: number, y: number, w: number, h: number,
    name: string, click: () => void, opts: { fill?: number; border?: number; size?: number;
        disabled?: boolean; align?: "center" | "left"; pixel?: boolean; } = {}): void {
    const fill = opts.fill ?? A.raised, border = opts.border ?? A.gold;
    const box = panel(scene, layer, x, y, w, h, fill, border);
    if (!opts.disabled) {
        box.setInteractive({ useHandCursor: true });
        box.on("pointerover", () => box.setFillStyle(A.hover));
        box.on("pointerout", () => box.setFillStyle(fill));
        box.on("pointerdown", click);
    }
    const label = text(scene, layer, opts.align === "left" ? x + 12 : x + w / 2,
        y + h / 2, name, opts.size ?? 10, opts.disabled ? "#71859B" : "#F7DFB2",
        w - 24, opts.pixel !== false);
    label.setOrigin(opts.align === "left" ? 0 : 0.5, 0.5);
}
export function hex(color: number): string { return `#${color.toString(16).padStart(6, "0")}`; }
