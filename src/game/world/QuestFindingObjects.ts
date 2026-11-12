/**
 * CampusBounty Quest Finding — collision-aligned, 3-world-pixel props.
 * All measurements inside these painters are ART pixels; Phaser owns positions
 * and bodies in world pixels. Nothing here draws in a frame update.
 */
import { Pen, PALETTES, mix, shade, type RoomTheme } from "./QuestFindingArt";

export type FurnitureKind = 0 | 1 | 2 | 3;
export type StationKind = "evidence" | "terminal" | "vault" | "beacon" | "sign" | "decoy";

/** Use furniture that belongs in each room, rather than random server racks in reception. */
const FURNITURE_BY_THEME: Record<RoomTheme, readonly FurnitureKind[]> = {
    reception: [0, 2, 3, 0],
    archive: [3, 3, 2, 0],
    office: [0, 2, 3, 0],
    approval: [0, 3, 2, 0],
    recovery: [0, 3, 1, 2],
    vault: [3, 1, 3, 1],
    boardroom: [0, 0, 2, 0],
    power: [1, 1, 3, 2],
    industrial: [1, 0, 3, 2],
    server: [1, 1, 1, 3],
    canteen: [0, 0, 2, 3],
    flooded: [3, 2, 3, 0],
    mail: [3, 3, 0, 2],
    evac: [2, 3, 0, 2],
};
export const furnitureForTheme = (theme: RoomTheme, roll: number): FurnitureKind =>
    FURNITURE_BY_THEME[theme][Math.abs(Math.trunc(roll)) % 4];

export const STATION_SIZES: Record<StationKind, { w: number; h: number }> = {
    evidence: { w: 54, h: 48 },
    decoy: { w: 48, h: 45 },
    sign: { w: 66, h: 72 },
    terminal: { w: 75, h: 78 },
    beacon: { w: 69, h: 75 },
    vault: { w: 90, h: 90 },
};

const shadow = (p: Pen): void => {
    p.rect(2, 3, p.w - 2, p.h - 3, 0x020408, 0.3);
    p.rect(1, 1, p.w - 2, p.h - 2, 0x020408, 0.4);
};

const hardware = (p: Pen, x: number, y: number, w: number, h: number, c: number): void => {
    p.rect(x, y, w, h, shade(c, 0.5));
    p.rect(x + 1, y + 1, w - 2, h - 2, c);
    p.hline(x + 1, y + 1, w - 2, 0xffffff, 0.12);
    p.hline(x + 1, y + h - 2, w - 2, 0x000000, 0.45);
    for (const xx of [x + 2, x + w - 3]) for (const yy of [y + 2, y + h - 3]) p.dot(xx, yy, 0xb1a790, 0.7);
};

/** Props now visually use the exact dimensions that the Phaser blocker uses. */
export function paintFurniture(p: Pen, theme: RoomTheme, kind: FurnitureKind): void {
    const pal = PALETTES[theme];
    const dark = shade(mix(pal.wall, pal.wallDark, 0.4), 0.78);
    const metal = mix(pal.trim, 0x41505c, 0.55);
    const light = mix(pal.trim, 0xc2d2d7, 0.32);
    const x = 1, y = 1, w = p.w - 3, h = p.h - 3;
    shadow(p);
    if (kind === 0) { // Desk / damaged workstation: 3D edge, monitor, papers.
        const wood = theme === "boardroom" || theme === "canteen" || theme === "mail"
            ? 0x75604b : 0x49515c;
        hardware(p, x, y, w, h, wood);
        p.rect(x + 2, y + 2, w - 4, Math.max(2, h - 7), mix(wood, light, 0.18));
        p.hline(x + 2, y + h - 5, w - 4, dark, 0.7);
        const mw = Math.max(7, Math.min(13, w - 10));
        const mh = Math.max(5, Math.min(9, h - 8));
        const mx = x + Math.floor((w - mw) / 2), my = y + 3;
        p.rect(mx + 1, my + 1, mw, mh, 0x060e16);
        p.rect(mx, my, mw, mh, 0x172a3b);
        p.rect(mx + 2, my + 2, mw - 4, mh - 4, pal.accent, 0.8);
        p.hline(mx + 3, my + 3, Math.max(1, mw - 6), 0xffffff, 0.4);
        p.rect(mx + Math.floor(mw / 2) - 1, my + mh, 2, 2, metal);
        p.rect(x + 3, y + 4, 4, 6, 0xd5cba9);
        p.hline(x + 4, y + 6, 2, 0x766a5d);
        p.rect(x + w - 6, y + h - 7, 3, 3, 0x162c36);
        p.dot(x + w - 5, y + h - 6, 0x6ce4df);
        p.hline(x + 3, y + h - 3, Math.max(1, w - 6), 0x111720, 0.65);
    } else if (kind === 1) { // Server rack, 3D outline, layered bays.
        hardware(p, x, y, w, h, dark);
        p.rect(x + 3, y + 2, w - 6, h - 5, 0x0c1422);
        const rows = Math.max(3, Math.floor((h - 6) / 5));
        for (let i = 0; i < rows; i++) {
            const yy = y + 3 + i * Math.floor((h - 6) / rows);
            const bh = Math.max(2, Math.floor((h - 7) / rows) - 1);
            p.rect(x + 4, yy, w - 8, bh, 0x293a4e);
            p.hline(x + 5, yy, Math.max(1, w - 10), 0xffffff, 0.12);
            p.rect(x + 6, yy + 1, Math.max(1, w - 16), 1, 0x0e1d2c);
            p.dot(x + w - 6, yy + 1, i % 3 === 0 ? 0xe0a866 : 0x66c5b6);
        }
        p.vline(x + 2, y + 2, h - 5, pal.trim, 0.7);
        p.vline(x + w - 3, y + 2, h - 5, 0x000000, 0.65);
    } else if (kind === 2) { // Solid waist-height partition, *not* a floor decal.
        hardware(p, x, y, w, h, dark);
        p.rect(x + 3, y + 2, w - 6, h - 5, mix(metal, 0x273644, 0.38));
        p.rect(x + 4, y + 4, Math.max(1, w - 8), Math.max(2, h - 11), 0x587586, 0.24);
        p.hline(x + 2, y + 2, w - 4, pal.trim);
        for (let i = 6; i < w - 4; i += 10) p.vline(x + i, y + 5, h - 10, 0x0a141c, 0.35);
        p.hline(x + 2, y + h - 4, w - 4, 0xc19558, 0.7);
    } else { // Filing cabinet with correctly sized drawers.
        hardware(p, x, y, w, h, metal);
        p.rect(x + 3, y + 3, w - 6, h - 6, dark, 0.35);
        const rows = 3;
        for (let i = 0; i < rows; i++) {
            const yy = y + 4 + i * Math.floor((h - 8) / rows);
            const bh = Math.max(3, Math.floor((h - 8) / rows) - 1);
            p.rect(x + 4, yy, w - 8, bh, mix(metal, 0x687581, 0.2));
            p.hline(x + 5, yy, w - 10, light, 0.3);
            p.rect(x + Math.floor(w / 2) - 2, yy + Math.floor(bh / 2), 4, 1, 0xd6b57d);
        }
    }
    // The last 1px on the right/bottom is a shadow, deliberately excluded from collision.
}

export function paintStation(p: Pen, theme: RoomTheme, kind: StationKind): void {
    const pal = PALETTES[theme];
    const cyan = 0x6de5d5, amber = 0xffca6b;
    const accent = kind === "vault" ? amber : kind === "evidence" ? cyan : pal.accent;
    const x = 1, y = 1, w = p.w - 3, h = p.h - 3;
    shadow(p);

    if (kind === "evidence" || kind === "decoy") {
        hardware(p, x, y, w, h, mix(pal.trim, 0x806a4a, 0.45));
        p.rect(x + 2, y + 2, w - 4, h - 4, 0x625947, 0.65);
        p.rect(x + 4, y + 3, w - 8, h - 6, 0xe3d6ba);
        p.rect(x + 5, y + 3, w - 10, 2, kind === "decoy" ? amber : cyan);
        p.hline(x + 6, y + 8, Math.max(1, w - 13), 0x6c6660);
        p.hline(x + 6, y + 10, Math.max(1, w - 16), 0x716b62);
        p.hline(x + 6, y + 12, Math.max(1, w - 17), 0x716b62);
        p.rect(x + w - 7, y + h - 5, 3, 2, kind === "decoy" ? 0xb55246 : 0x278c82);
    } else if (kind === "sign") {
        hardware(p, x, y, w, h, mix(pal.wallDark, pal.trim, 0.25));
        p.rect(x + 3, y + 3, w - 6, h - 7, 0x122835);
        p.hline(x + 4, y + 4, w - 8, accent);
        p.text(x + 5, y + 7, "EXIT", 0xc5f1dd);
        p.hline(x + 5, y + 15, Math.max(1, w - 10), pal.trim, 0.7);
        p.hline(x + 5, y + 17, Math.max(1, w - 13), pal.trim, 0.7);
        p.rect(x + 5, y + h - 5, w - 10, 2, 0xcba457);
    } else { // Console / power station / vault
        hardware(p, x, y, w, h, mix(pal.wallDark, pal.trim, 0.22));
        p.rect(x + 3, y + 4, w - 6, h - 7, 0x0b1825);
        p.rect(x + 5, y + 6, w - 10, Math.max(5, Math.floor(h * 0.5)), 0x172f42);
        p.rect(x + 7, y + 8, w - 14, Math.max(3, Math.floor(h * 0.5) - 4), shade(accent, 0.48));
        p.hline(x + 8, y + 9, Math.max(1, w - 16), accent, 0.78);
        for (let row = 0; row < 3; row++)
            p.hline(x + 8, y + 13 + row * 3, Math.max(1, w - 21 - row * 2), accent, 0.65);
        const ctrlY = y + Math.floor(h * 0.7);
        p.rect(x + 5, ctrlY, w - 10, Math.max(4, h - (ctrlY - y) - 3), 0x263849);
        for (let k = 0; k < 3; k++) p.rect(x + 7 + k * 5, ctrlY + 2, 3, 2, k === 1 ? 0xc8a561 : 0x68c8c5);
        if (kind === "vault") {
            p.rect(x + Math.floor(w / 2) - 4, ctrlY, 8, 6, 0xe9b84c);
            p.rect(x + Math.floor(w / 2) - 2, ctrlY + 2, 4, 3, 0x5f4323);
        }
        if (kind === "beacon") p.dot(x + w - 7, ctrlY + 3, 0xb6ffd5);
    }
}
