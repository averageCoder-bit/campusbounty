import type Phaser from "phaser";

export const THEME = {
    bg: "#0B1423",
    gold: 0xfbbf24,
    goldLight: 0xfde68a,
    goldHover: 0xfcd34d,
    goldCss: "#FBBF24",
    dot: 0x1e3a5f,
    textLight: "#E5E7EB",
    muted: "#94A3B8",
    ink: "#111827",
    fontTitle: '"Press Start 2P", monospace',
    fontBody: '"VT323", monospace',
} as const;

export const textStyle = (
    size: number,
    color: string,
    fontFamily: string = THEME.fontTitle,
): Phaser.Types.GameObjects.Text.TextStyle => ({
    fontFamily,
    fontSize: `${size}px`,
    color,
    align: "center",
});

export const prefersReducedMotion = (): boolean =>
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
