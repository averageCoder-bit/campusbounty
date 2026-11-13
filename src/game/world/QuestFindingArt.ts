/**
 * CampusBounty — Quest Finding environment art (Phaser-free painters).
 *
 * Everything here draws into a tiny "art pixel" grid through the `Paint` interface;
 * the map bakes each result into a canvas texture ONCE and shows it scaled by ART
 * (= the Player sprite's 3px pixel size), so tiles, props and character share one
 * pixel grid and nothing is replayed per frame. Separating painters from Phaser also
 * lets the art be rendered and inspected under plain Node.
 *
 * Painters use their OWN seeded RNG. They must never touch the gameplay RNG that
 * decides prop, drone and clue placement.
 */
export const ART = 3;

export interface Paint {
    rect(
        x: number,
        y: number,
        w: number,
        h: number,
        color: number,
        alpha?: number,
    ): void;
}

export function mulberry(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const ch = (c: number, shift: number): number => (c >> shift) & 255;
export const rgb = (r: number, g: number, b: number): number =>
    (Math.max(0, Math.min(255, Math.round(r))) << 16) |
    (Math.max(0, Math.min(255, Math.round(g))) << 8) |
    Math.max(0, Math.min(255, Math.round(b)));
export const mix = (a: number, b: number, t: number): number =>
    rgb(
        ch(a, 16) + (ch(b, 16) - ch(a, 16)) * t,
        ch(a, 8) + (ch(b, 8) - ch(a, 8)) * t,
        ch(a, 0) + (ch(b, 0) - ch(a, 0)) * t,
    );
export const shade = (c: number, k: number): number =>
    rgb(ch(c, 16) * k, ch(c, 8) * k, ch(c, 0) * k);

/** 3x5 bitmap glyphs (rows top to bottom, 3 bits each, MSB left). */
const GLYPHS: Record<string, readonly number[]> = {
    "0": [7, 5, 5, 5, 7],
    "1": [2, 6, 2, 2, 7],
    "2": [7, 1, 7, 4, 7],
    "3": [7, 1, 7, 1, 7],
    "4": [5, 5, 7, 1, 1],
    "5": [7, 4, 7, 1, 7],
    "6": [7, 4, 7, 5, 7],
    "7": [7, 1, 2, 2, 2],
    "8": [7, 5, 7, 5, 7],
    "9": [7, 5, 7, 1, 7],
    A: [2, 5, 7, 5, 5],
    B: [6, 5, 6, 5, 6],
    C: [3, 4, 4, 4, 3],
    D: [6, 5, 5, 5, 6],
    E: [7, 4, 6, 4, 7],
    F: [7, 4, 6, 4, 4],
    X: [5, 5, 2, 5, 5],
    I: [7, 2, 2, 2, 7],
    T: [7, 2, 2, 2, 2],
    S: [3, 4, 2, 1, 6],
    R: [6, 5, 6, 5, 5],
    "-": [0, 0, 7, 0, 0],
    " ": [0, 0, 0, 0, 0],
};

export class Pen {
    private readonly rnd: () => number;
    constructor(
        private readonly paint: Paint,
        readonly w: number,
        readonly h: number,
        seed: number,
    ) {
        this.rnd = mulberry(seed);
    }
    next(): number {
        return this.rnd();
    }
    int(a: number, b: number): number {
        return a + Math.floor(this.rnd() * (b - a + 1));
    }
    chance(p: number): boolean {
        return this.rnd() < p;
    }
    pick<T>(items: readonly T[]): T {
        return items[Math.floor(this.rnd() * items.length)];
    }

    rect(x: number, y: number, w: number, h: number, c: number, a = 1): void {
        const x0 = Math.max(0, Math.round(x)),
            y0 = Math.max(0, Math.round(y));
        const x1 = Math.min(this.w, Math.round(x + w)),
            y1 = Math.min(this.h, Math.round(y + h));
        if (x1 > x0 && y1 > y0) this.paint.rect(x0, y0, x1 - x0, y1 - y0, c, a);
    }
    dot(x: number, y: number, c: number, a = 1): void {
        this.rect(x, y, 1, 1, c, a);
    }
    hline(x: number, y: number, len: number, c: number, a = 1): void {
        this.rect(x, y, len, 1, c, a);
    }
    vline(x: number, y: number, len: number, c: number, a = 1): void {
        this.rect(x, y, 1, len, c, a);
    }
    frame(x: number, y: number, w: number, h: number, c: number, a = 1): void {
        this.hline(x, y, w, c, a);
        this.hline(x, y + h - 1, w, c, a);
        this.vline(x, y + 1, h - 2, c, a);
        this.vline(x + w - 1, y + 1, h - 2, c, a);
    }
    /** Pixel checkerboard: the classic stand-in for a gradient. Use on small areas. */
    dither(
        x: number,
        y: number,
        w: number,
        h: number,
        c: number,
        a = 1,
        phase = 0,
    ): void {
        for (let yy = 0; yy < h; yy++)
            for (let xx = (yy + phase) & 1; xx < w; xx += 2)
                this.dot(x + xx, y + yy, c, a);
    }
    noise(
        x: number,
        y: number,
        w: number,
        h: number,
        c: number,
        density: number,
        a = 1,
    ): void {
        const n = Math.floor(w * h * density);
        for (let i = 0; i < n; i++)
            this.dot(x + this.rnd() * w, y + this.rnd() * h, c, a);
    }
    line(
        x0: number,
        y0: number,
        x1: number,
        y1: number,
        c: number,
        a = 1,
    ): void {
        let x = Math.round(x0),
            y = Math.round(y0);
        const ex = Math.round(x1),
            ey = Math.round(y1);
        const dx = Math.abs(ex - x),
            dy = -Math.abs(ey - y);
        const sx = x < ex ? 1 : -1,
            sy = y < ey ? 1 : -1;
        let err = dx + dy;
        for (let i = 0; i < 400; i++) {
            this.dot(x, y, c, a);
            if (x === ex && y === ey) break;
            const e2 = 2 * err;
            if (e2 >= dy) {
                err += dy;
                x += sx;
            }
            if (e2 <= dx) {
                err += dx;
                y += sy;
            }
        }
    }
    blob(
        cx: number,
        cy: number,
        rx: number,
        ry: number,
        c: number,
        a = 1,
    ): void {
        const r = Math.max(0.5, ry);
        for (let dy = -Math.floor(r); dy <= Math.floor(r); dy++) {
            const half = Math.floor(
                rx * Math.sqrt(Math.max(0, 1 - (dy / (r + 0.5)) ** 2)),
            );
            this.rect(cx - half, cy + dy, half * 2 + 1, 1, c, a);
        }
    }
    /** Stepped light pool: layered translucent ellipses. */
    pool(
        cx: number,
        cy: number,
        rx: number,
        ry: number,
        c: number,
        a: number,
        levels = 4,
    ): void {
        for (let l = 0; l < levels; l++)
            this.blob(
                cx,
                cy,
                rx * (1 - l / levels),
                ry * (1 - l / levels),
                c,
                a,
            );
    }
    stripes(
        x: number,
        y: number,
        w: number,
        h: number,
        c1: number,
        c2: number,
        step = 3,
        a = 1,
    ): void {
        for (let yy = 0; yy < h; yy++)
            for (let xx = 0; xx < w; xx++)
                this.dot(
                    x + xx,
                    y + yy,
                    (Math.floor((xx + yy) / step) & 1) === 0 ? c1 : c2,
                    a,
                );
    }
    text(x: number, y: number, s: string, c: number, a = 1): number {
        let cx = x;
        for (const chr of s) {
            const g = GLYPHS[chr] ?? GLYPHS[" "];
            for (let r = 0; r < 5; r++)
                for (let b = 0; b < 3; b++)
                    if (g[r] & (4 >> b)) this.dot(cx + b, y + r, c, a);
            cx += 4;
        }
        return cx - x - 1;
    }
}

export type RoomTheme =
    | "reception"
    | "archive"
    | "office"
    | "approval"
    | "recovery"
    | "vault"
    | "boardroom"
    | "power"
    | "industrial"
    | "server"
    | "canteen"
    | "flooded"
    | "mail"
    | "evac";

export function themeFor(title: string): RoomTheme {
    const t = title.toUpperCase();
    if (t.includes("RECEPTION") || t.includes("SECURITY")) return "reception";
    if (
        t.includes("PHISHING") ||
        t.includes("ARCHIVE") ||
        t.includes("AUDIT") ||
        t.includes("LEGAL")
    )
        return "archive";
    if (t.includes("APPROVAL")) return "approval";
    if (t.includes("RECOVERY")) return "recovery";
    if (t.includes("VAULT")) return "vault";
    if (t.includes("BOARDROOM") || t.includes("EXECUTIVE")) return "boardroom";
    if (t.includes("POWER")) return "power";
    if (
        t.includes("MAINTENANCE") ||
        t.includes("WORKSHOP") ||
        t.includes("SUPPLY")
    )
        return "industrial";
    if (
        t.includes("SERVER") ||
        t.includes("DATA CENTER") ||
        t.includes("NETWORK")
    )
        return "server";
    if (t.includes("CAFETERIA")) return "canteen";
    if (t.includes("FLOODED")) return "flooded";
    if (t.includes("MAILROOM")) return "mail";
    if (t.includes("EVACUATION")) return "evac";
    return "office";
}

export interface Palette {
    wall: number;
    wallDark: number;
    trim: number;
    accent: number;
    floorA: number;
    floorB: number;
}
export const PALETTES: Record<RoomTheme, Palette> = {
    reception: {
        wall: 0x2b3a4c,
        wallDark: 0x141c28,
        trim: 0x74879c,
        accent: 0xffc15a,
        floorA: 0x202d3d,
        floorB: 0x182332,
    },
    archive: {
        wall: 0x2d2a44,
        wallDark: 0x15132a,
        trim: 0x7a72a8,
        accent: 0xb48cff,
        floorA: 0x251f39,
        floorB: 0x1d1930,
    },
    office: {
        wall: 0x27364a,
        wallDark: 0x131c2a,
        trim: 0x6f869e,
        accent: 0x7dd3fc,
        floorA: 0x1c2a3b,
        floorB: 0x172435,
    },
    approval: {
        wall: 0x243650,
        wallDark: 0x111b2c,
        trim: 0x6c8fb8,
        accent: 0x6fb7ff,
        floorA: 0x1b2b42,
        floorB: 0x16243a,
    },
    recovery: {
        wall: 0x1e3c44,
        wallDark: 0x0f2128,
        trim: 0x62a5a8,
        accent: 0x4fe3cf,
        floorA: 0x183439,
        floorB: 0x122b30,
    },
    vault: {
        wall: 0x2a3240,
        wallDark: 0x121820,
        trim: 0x8895a8,
        accent: 0xfbbf24,
        floorA: 0x182230,
        floorB: 0x121a26,
    },
    boardroom: {
        wall: 0x2d2536,
        wallDark: 0x16111d,
        trim: 0x9a7a62,
        accent: 0xd9a46f,
        floorA: 0x2a1f1b,
        floorB: 0x231915,
    },
    power: {
        wall: 0x38342f,
        wallDark: 0x1a1815,
        trim: 0x8d7a5b,
        accent: 0xff9a3c,
        floorA: 0x1e2126,
        floorB: 0x171a1e,
    },
    industrial: {
        wall: 0x33393b,
        wallDark: 0x171b1c,
        trim: 0x7f8c8d,
        accent: 0xffc94a,
        floorA: 0x1f2427,
        floorB: 0x181c1f,
    },
    server: {
        wall: 0x1e2b3d,
        wallDark: 0x0d1522,
        trim: 0x4f7aa0,
        accent: 0x3df0ff,
        floorA: 0x121d2d,
        floorB: 0x0e1827,
    },
    canteen: {
        wall: 0x3a3a40,
        wallDark: 0x1b1b20,
        trim: 0x8c8c94,
        accent: 0xe8c97a,
        floorA: 0x35363b,
        floorB: 0x242529,
    },
    flooded: {
        wall: 0x27384a,
        wallDark: 0x121b28,
        trim: 0x6f8aa0,
        accent: 0x4fb0c8,
        floorA: 0x1b2a3a,
        floorB: 0x162333,
    },
    mail: {
        wall: 0x3a3629,
        wallDark: 0x1a1810,
        trim: 0x98875a,
        accent: 0xd9a85a,
        floorA: 0x27251f,
        floorB: 0x1f1d18,
    },
    evac: {
        wall: 0x2b3a40,
        wallDark: 0x131c20,
        trim: 0x6f8c8a,
        accent: 0x6df2a0,
        floorA: 0x1e2c31,
        floorB: 0x182429,
    },
};

/** Art-pixel geometry of a baked room texture. Floor = exactly the walkable rectangle. */
export const ROOM_ART = {
    fx: 11,
    fy: 22,
    fw: 267,
    fh: 240,
    aw: 289,
    ah: 272,
} as const;
export const ROOM_ART_OFFSET = { x: 33, y: 66 } as const; // world px from room.x/room.y to the texture's top-left

export interface RoomArtSpec {
    theme: RoomTheme;
    sector: string;
    seed: number;
    floor: number;
    doors: { n: boolean; s: boolean; e: boolean; w: boolean };
}

const DOOR_HALF = 37; // art px (a 224px corridor is ~75 art px wide)

type Pattern =
    | "checker"
    | "carpet"
    | "plates"
    | "perforated"
    | "vinyl"
    | "wood";
const PATTERN: Record<RoomTheme, Pattern> = {
    reception: "checker",
    canteen: "checker",
    evac: "checker",
    archive: "carpet",
    office: "carpet",
    approval: "carpet",
    vault: "plates",
    power: "plates",
    industrial: "plates",
    server: "perforated",
    recovery: "vinyl",
    mail: "vinyl",
    flooded: "vinyl",
    boardroom: "wood",
};

function paintFloor(p: Pen, s: RoomArtSpec, pal: Palette): void {
    const { fx: x0, fy: y0, fw: w, fh: h } = ROOM_ART;
    const a = mix(pal.floorA, s.floor, 0.3),
        b = mix(pal.floorB, s.floor, 0.3);
    p.rect(x0, y0, w, h, b);
    switch (PATTERN[s.theme]) {
        case "checker": {
            const t = 12;
            for (let ty = 0; ty * t < h; ty++)
                for (let tx = 0; tx * t < w; tx++) {
                    const px = x0 + tx * t,
                        py = y0 + ty * t;
                    p.rect(px, py, t, t, (tx + ty) & 1 ? a : b);
                    p.rect(px, py, t, 1, 0xffffff, 0.05);
                    p.rect(px, py + t - 1, t, 1, 0x000000, 0.3);
                    p.rect(px + t - 1, py, 1, t, 0x000000, 0.22);
                    if (p.chance(0.25))
                        p.rect(
                            px + 1,
                            py + 1,
                            t - 2,
                            t - 2,
                            p.chance(0.5) ? 0xffffff : 0x000000,
                            0.04,
                        );
                }
            break;
        }
        case "carpet": {
            p.rect(x0, y0, w, h, a);
            p.noise(x0, y0, w, h, 0xffffff, 0.035, 0.06);
            p.noise(x0, y0, w, h, 0x000000, 0.05, 0.12);
            for (let x = x0 + 40; x < x0 + w; x += 40)
                p.vline(x, y0, h, 0x000000, 0.28);
            for (let y = y0 + 40; y < y0 + h; y += 40)
                p.hline(x0, y, w, 0x000000, 0.28);
            break;
        }
        case "plates": {
            const t = 24;
            for (let ty = 0; ty * t < h; ty++)
                for (let tx = 0; tx * t < w; tx++) {
                    const px = x0 + tx * t,
                        py = y0 + ty * t;
                    p.rect(px, py, t, t, p.chance(0.5) ? a : b);
                    p.frame(px, py, t, t, 0x000000, 0.45);
                    p.hline(px + 1, py + 1, t - 2, 0xffffff, 0.06);
                    for (const [rx, ry] of [
                        [2, 2],
                        [t - 3, 2],
                        [2, t - 3],
                        [t - 3, t - 3],
                    ])
                        p.dot(px + rx, py + ry, 0x6a7686, 0.6);
                    if (s.theme === "power")
                        for (let k = 4; k < t - 4; k += 4)
                            p.line(
                                px + k,
                                py + 5,
                                px + k + 3,
                                py + 8,
                                0xffffff,
                                0.07,
                            );
                }
            break;
        }
        case "perforated": {
            const t = 20;
            for (let ty = 0; ty * t < h; ty++)
                for (let tx = 0; tx * t < w; tx++) {
                    const px = x0 + tx * t,
                        py = y0 + ty * t;
                    p.rect(px, py, t, t, (tx + ty) & 1 ? a : b);
                    p.frame(px, py, t, t, 0x000000, 0.5);
                    for (let yy = 3; yy < t - 2; yy += 4)
                        for (let xx = 3; xx < t - 2; xx += 4)
                            p.dot(px + xx, py + yy, 0x04080f, 0.7);
                }
            for (const gx of [x0 + 60, x0 + w - 60]) {
                p.vline(gx, y0, h, pal.accent, 0.3);
                p.vline(gx + 1, y0, h, pal.accent, 0.1);
            }
            break;
        }
        case "vinyl": {
            const t = 20;
            for (let ty = 0; ty * t < h; ty++)
                for (let tx = 0; tx * t < w; tx++) {
                    const px = x0 + tx * t,
                        py = y0 + ty * t;
                    p.rect(px, py, t, t, p.chance(0.55) ? a : b);
                    p.frame(px, py, t, t, 0x000000, 0.3);
                    p.line(
                        px + 4,
                        py + t - 4,
                        px + t - 5,
                        py + 4,
                        0xffffff,
                        0.06,
                    );
                    if (p.chance(0.18))
                        p.rect(px + 1, py + 1, t - 2, t - 2, 0x000000, 0.1);
                }
            break;
        }
        case "wood": {
            for (let y = y0; y < y0 + h; y += 4) {
                let x = x0 - p.int(0, 30);
                while (x < x0 + w) {
                    const len = p.int(34, 70);
                    const c = mix(a, b, p.next());
                    p.rect(x, y, len, 4, c);
                    p.vline(x, y, 4, 0x000000, 0.5);
                    p.hline(x, y + 3, len, 0x000000, 0.3);
                    p.hline(x, y, len, 0xffffff, 0.04);
                    x += len;
                }
            }
            break;
        }
    }
}

function paintDecals(p: Pen, s: RoomArtSpec, pal: Palette): void {
    const { fx: x0, fy: y0, fw: w, fh: h } = ROOM_ART;
    const cx = x0 + w / 2,
        cy = y0 + h / 2;
    // Traffic wear: door-to-door paths are scuffed lighter.
    const wear = (x: number, y: number, ww: number, hh: number): void => {
        p.rect(x, y, ww, hh, 0xffffff, 0.025);
        p.noise(x, y, ww, hh, 0xffffff, 0.05, 0.05);
    };
    if (s.doors.n || s.doors.s) wear(cx - 24, y0, 48, h);
    if (s.doors.e || s.doors.w) wear(x0, cy - 24, w, 48);

    // Theme floor markings first, so debris lands on top of them.
    switch (s.theme) {
        case "reception": {
            p.blob(cx, cy + 10, 34, 17, pal.accent, 0.1);
            p.blob(cx, cy + 10, 30, 15, 0x000000, 0.28);
            p.blob(cx, cy + 10, 24, 12, pal.accent, 0.08);
            p.text(cx - 3, cy + 7, "CB", pal.accent, 0.55);
            for (let i = 0; i < 6; i++)
                p.dot(cx - 31 + i * 12, cy - 6, pal.accent, 0.35);
            break;
        }
        case "archive":
            for (const gx of [x0 + 52, x0 + w - 52])
                for (let y = y0 + 20; y < y0 + h - 20; y += 8)
                    p.hline(gx - 6, y, 12, pal.accent, 0.22);
            for (let i = 0; i < 4; i++)
                p.frame(x0 + 20 + i * 52, y0 + 28, 36, 20, pal.accent, 0.16);
            break;
        case "approval":
        case "office":
        case "flooded":
            for (let i = 0; i < 3; i++) {
                p.frame(x0 + 18, y0 + 30 + i * 62, 44, 34, pal.accent, 0.14);
                p.frame(
                    x0 + w - 62,
                    y0 + 30 + i * 62,
                    44,
                    34,
                    pal.accent,
                    0.14,
                );
            }
            break;
        case "server":
            for (const gy of [y0 + 50, y0 + h - 50]) {
                p.hline(x0, gy, w, pal.accent, 0.3);
                p.hline(x0, gy + 1, w, pal.accent, 0.1);
            }
            break;
        case "power":
        case "industrial":
            p.stripes(
                x0 + 10,
                y0 + h - 18,
                w - 20,
                5,
                0xe9b930,
                0x14110c,
                4,
                0.55,
            );
            p.stripes(x0 + 10, y0 + 12, 5, h - 24, 0xe9b930, 0x14110c, 4, 0.4);
            break;
        case "vault":
            p.blob(cx, cy, 52, 38, pal.accent, 0.06);
            p.blob(cx, cy, 46, 33, 0x000000, 0.3);
            for (let r = 0; r < 3; r++)
                p.frame(
                    cx - 60 + r * 8,
                    cy - 42 + r * 6,
                    120 - r * 16,
                    84 - r * 12,
                    0xc23a3a,
                    0.14,
                );
            break;
        case "recovery":
            p.stripes(x0 + 8, y0 + 8, w - 16, 3, pal.accent, 0x0a1a1d, 4, 0.35);
            p.stripes(
                x0 + 8,
                y0 + h - 12,
                w - 16,
                3,
                pal.accent,
                0x0a1a1d,
                4,
                0.35,
            );
            break;
        case "canteen":
            for (let i = 0; i < 3; i++)
                p.frame(x0 + 40 + i * 70, y0 + 60, 50, 28, 0xffffff, 0.07);
            break;
        case "mail":
            for (let i = 0; i < 5; i++)
                p.frame(
                    x0 + 16 + p.int(0, w - 70),
                    y0 + 40 + p.int(0, h - 100),
                    p.int(20, 34),
                    p.int(14, 24),
                    pal.accent,
                    0.13,
                );
            break;
        case "boardroom":
            // Flat carpet motif, not a fake table without physics.
            p.frame(cx - 70, cy - 34, 140, 68, pal.accent, 0.14);
            p.frame(cx - 66, cy - 30, 132, 60, pal.accent, 0.08);
            break;
        case "evac":
            for (let i = 0; i < 5; i++) {
                const ax = x0 + 30 + i * 52;
                p.line(ax, cy, ax + 14, cy, 0x6df2a0, 0.4);
                p.line(ax + 14, cy, ax + 10, cy - 4, 0x6df2a0, 0.4);
                p.line(ax + 14, cy, ax + 10, cy + 4, 0x6df2a0, 0.4);
            }
            break;
    }
    if (s.theme === "flooded") {
        for (let i = 0; i < 4; i++) {
            const px = x0 + p.int(30, w - 30),
                py = y0 + p.int(40, h - 40),
                rx = p.int(18, 40),
                ry = p.int(8, 16);
            p.blob(px, py, rx + 2, ry + 2, 0x000000, 0.25);
            p.blob(px, py, rx, ry, 0x3d8ea6, 0.42);
            p.blob(px - 4, py - 2, rx * 0.5, ry * 0.4, 0x9fe3f2, 0.18);
            p.frame(px - rx + 4, py - ry, rx * 2 - 8, ry * 2, 0xbdf3ff, 0.07);
        }
    }
    // Stains, scorch, cracks.
    for (let i = p.int(3, 6); i > 0; i--) {
        const sx = p.int(x0 + 16, x0 + w - 16),
            sy = p.int(y0 + 16, y0 + h - 16);
        const tone = p.pick([0x05070a, 0x3a2a1c, 0x1b3a3d, 0x2a1d2e]);
        for (let k = 0; k < 4; k++)
            p.blob(
                sx + p.int(-6, 6),
                sy + p.int(-4, 4),
                p.int(4, 11),
                p.int(3, 7),
                tone,
                0.2,
            );
    }
    for (let i = p.int(2, 5); i > 0; i--) {
        let x = p.int(x0 + 20, x0 + w - 20),
            y = p.int(y0 + 20, y0 + h - 20);
        for (let k = p.int(5, 12); k > 0; k--) {
            const nx = x + p.int(-4, 4),
                ny = y + p.int(-3, 4);
            p.line(x, y, nx, ny, 0x020409, 0.7);
            p.dot(nx + 1, ny + 1, 0xffffff, 0.06);
            x = nx;
            y = ny;
        }
    }
    // Cables snaking across the floor.
    for (let i = p.int(1, 3); i > 0; i--) {
        let x = p.pick([x0 + 4, x0 + w - 4]),
            y = p.int(y0 + 30, y0 + h - 30);
        const dir = x < cx ? 1 : -1;
        const c = p.pick([0x05080d, 0x0d1d33, 0x2a1111]);
        for (let k = 0; k < 40; k++) {
            const ny = y + Math.round(Math.sin(k * 0.4 + i) * 1.6);
            p.dot(x, ny, c, 0.85);
            p.dot(x, ny + 1, c, 0.5);
            x += dir;
            y = ny;
        }
        p.rect(x, y - 1, 3, 3, 0x1a1f28);
    }
    // Scattered papers and files: little drifts that lead the eye through the room.
    for (let i = p.int(3, 5); i > 0; i--) {
        const px = p.int(x0 + 20, x0 + w - 30),
            py = p.int(y0 + 24, y0 + h - 30);
        const dx = p.pick([-1, 1]);
        for (let k = p.int(3, 8); k > 0; k--) {
            const x = px + dx * p.int(0, 26),
                y = py + p.int(-8, 8);
            const paper = p.pick([0xd9d3c0, 0xcbc6b2, 0xe4dfcf, 0xc9d6dc]);
            p.rect(x + 1, y + 1, 6, 5, 0x000000, 0.35);
            p.rect(x, y, 6, 5, paper);
            p.hline(x + 1, y + 1, 4, 0x6b6a60, 0.7);
            if (p.chance(0.6)) p.hline(x + 1, y + 3, 3, 0x6b6a60, 0.6);
            if (p.chance(0.15)) p.dot(x + 4, y, 0xb74a3d);
        }
    }
    // Glass, screws, chips.
    for (let i = p.int(14, 30); i > 0; i--) {
        const x = p.int(x0 + 6, x0 + w - 6),
            y = p.int(y0 + 6, y0 + h - 6);
        p.dot(
            x,
            y,
            p.pick([0xbfe9f2, 0x8aa0b0, 0x5a6a78]),
            p.next() * 0.5 + 0.25,
        );
    }
    p.noise(x0, y0, w, h, 0xcfd8e0, 0.012, 0.1); // dust
    // Painted sector code, ghosted into the floor.
    p.text(cx - 5, y0 + h - 28, s.sector, pal.accent, 0.2);
}

function paintShading(p: Pen, s: RoomArtSpec, pal: Palette): void {
    const { fx: x0, fy: y0, fw: w, fh: h } = ROOM_ART;
    // Ambient occlusion: edges and corners fall into darkness; the centre stays lit.
    for (let i = 0; i < 12; i++) {
        const a = 0.1 * (1 - i / 12) ** 1.4;
        p.rect(x0 + i, y0 + i, w - 2 * i, 1, 0x02040a, a + 0.02);
        p.rect(x0 + i, y0 + h - 1 - i, w - 2 * i, 1, 0x02040a, a + 0.02);
        p.rect(x0 + i, y0 + i, 1, h - 2 * i, 0x02040a, a + 0.02);
        p.rect(x0 + w - 1 - i, y0 + i, 1, h - 2 * i, 0x02040a, a + 0.02);
    }
    for (const [cx2, cy2] of [
        [x0, y0],
        [x0 + w, y0],
        [x0, y0 + h],
        [x0 + w, y0 + h],
    ])
        p.pool(cx2, cy2, 46, 36, 0x000000, 0.07, 5);
    // The north wall casts its shadow onto the floor.
    for (let i = 0; i < 9; i++)
        p.rect(x0, y0 + i, w, 1, 0x02040a, 0.34 * (1 - i / 9));
    // Baked fixed light pools beneath working wall lamps.
    const lampTone =
        s.theme === "server" || s.theme === "recovery" ? 0x6ad6e6 : 0xffd596;
    for (let x = x0 + 40; x < x0 + w - 20; x += 72) {
        if (s.doors.n && Math.abs(x - (x0 + w / 2)) < DOOR_HALF) continue;
        if ((x / 72) % 3 < 0.4) continue; // some lamps are dead
        p.pool(x, y0 + 14, 26, 14, lampTone, 0.035, 4);
    }
    void pal;
}

function poster(p: Pen, x: number, y: number, pal: Palette): number {
    const w = p.int(10, 13),
        h = p.int(10, 12);
    const paper = p.pick([0xd8d2c0, 0xc4d2da, 0xdad0b2]);
    p.rect(x + 1, y + 1, w, h, 0x000000, 0.35);
    p.rect(x, y, w, h, paper);
    p.rect(x, y, w, 2, pal.accent, 0.8);
    for (let r = 4; r < h - 2; r += 2)
        p.hline(x + 1, y + r, p.int(w - 6, w - 2), 0x5a5a52, 0.65);
    p.dot(x, y, 0xf6e7a5);
    p.dot(x + w - 1, y, 0xf6e7a5);
    if (p.chance(0.5)) p.rect(x + w - 3, y + h - 3, 3, 3, 0x1d2735); // torn corner
    return w;
}
function windowPane(p: Pen, x: number, y: number): number {
    const w = 22,
        h = 12;
    p.rect(x - 1, y - 1, w + 2, h + 2, 0x0b121b);
    for (let r = 0; r < h; r++)
        p.hline(x, y + r, w, mix(0x0d2036, 0x1d4a6a, r / h));
    p.line(x + 3, y + h - 2, x + 11, y + 1, 0xaad8f2, 0.22);
    p.line(x + 10, y + h - 2, x + 17, y + 3, 0xaad8f2, 0.14);
    p.vline(x + 11, y, h, 0x0b121b);
    p.hline(x, y + 6, w, 0x0b121b);
    if (p.chance(0.6)) {
        p.line(x + 14, y + 1, x + 17, y + 6, 0xdff6ff, 0.7);
        p.line(x + 17, y + 6, x + 15, y + 11, 0xdff6ff, 0.55);
    }
    p.hline(x - 2, y + h + 1, w + 4, 0x8ea3b6, 0.7);
    return w + 2;
}
function vent(p: Pen, x: number, y: number): number {
    const w = 14,
        h = 9;
    p.rect(x, y, w, h, 0x0a0f16);
    for (let r = 1; r < h - 1; r += 2) p.hline(x + 1, y + r, w - 2, 0x3b4756);
    p.frame(x, y, w, h, 0x5a6878, 0.8);
    for (const [sx, sy] of [
        [0, 0],
        [w - 1, 0],
        [0, h - 1],
        [w - 1, h - 1],
    ])
        p.dot(x + sx, y + sy, 0xaab6c2);
    p.vline(x + 4, y + h, 5, 0x000000, 0.28);
    p.vline(x + 9, y + h, 3, 0x000000, 0.2);
    return w;
}
function whiteboard(p: Pen, x: number, y: number): number {
    const w = 26,
        h = 11;
    p.rect(x + 1, y + 1, w, h, 0x000000, 0.35);
    p.rect(x, y, w, h, 0xb9c4cf);
    p.frame(x, y, w, h, 0x56636f);
    p.line(x + 3, y + 3, x + 10, y + 5, 0x3b6fd6);
    p.line(x + 10, y + 5, x + 17, y + 2, 0x3b6fd6);
    p.line(x + 4, y + 8, x + 20, y + 8, 0xc23a3a);
    p.rect(x + 20, y + 6, 4, 3, 0x2f9e5a, 0.8);
    p.hline(x + 2, y + h - 1, 10, 0x56636f);
    return w;
}
function wallScreen(p: Pen, x: number, y: number, pal: Palette): number {
    const w = 18,
        h = 12,
        mode = p.int(0, 3);
    p.rect(x, y, w, h, 0x05080d);
    p.frame(x, y, w, h, 0x39434f);
    if (mode === 0) {
        p.noise(x + 1, y + 1, w - 2, h - 2, 0xcfe8ff, 0.3, 0.55);
        p.rect(x + 1, y + 1, w - 2, h - 2, 0x1c2a3a, 0.3);
    } else if (mode === 1) {
        for (let r = 2; r < h - 2; r += 2)
            p.hline(x + 2, y + r, p.int(5, w - 4), pal.accent, 0.8);
        p.rect(x + 1, y + 1, w - 2, h - 2, pal.accent, 0.1);
    } else if (mode === 2) {
        p.rect(x + 1, y + 1, w - 2, h - 2, 0x1a1020);
        p.line(x + 3, y + 2, x + w - 5, y + h - 3, 0x7a8896, 0.8);
        p.line(x + w - 5, y + h - 3, x + w - 8, y + 2, 0x7a8896, 0.7);
    } else {
        p.rect(x + 1, y + 1, w - 2, h - 2, 0x2a0d0f);
        p.rect(x + 4, y + 4, w - 8, 2, 0xe0463a);
        p.hline(x + 4, y + 8, w - 10, 0xe0463a, 0.6);
    }
    return w;
}
function lockers(p: Pen, x: number, y: number): number {
    const body = p.pick([0x3b4a5e, 0x44556b, 0x3a4a55]);
    for (let i = 0; i < 3; i++) {
        const lx = x + i * 7;
        p.rect(lx, y, 7, 13, body);
        p.frame(lx, y, 7, 13, 0x0b121a);
        p.hline(lx + 1, y + 2, 5, 0x0b121a);
        p.hline(lx + 1, y + 4, 5, 0x0b121a);
        p.rect(lx + 5, y + 7, 1, 2, 0xc9d3dc);
        if (i === 1 && p.chance(0.7)) {
            p.rect(lx + 1, y + 1, 5, 12, 0x070b11);
            p.line(lx + 1, y + 1, lx + 1, y + 12, 0x56687e);
        }
    }
    return 21;
}
function fusebox(p: Pen, x: number, y: number): number {
    const w = 11,
        h = 13;
    p.rect(x, y, w, h, 0x4a5058);
    p.frame(x, y, w, h, 0x12161b);
    p.rect(x + 2, y + 2, 7, 6, 0x1b2026);
    p.rect(x + 3, y + 3, 2, 2, 0xe9b930);
    p.dot(x + 7, y + 4, 0xc23a3a);
    for (let k = 0; k < 3; k++)
        p.vline(x + 3 + k * 2, y + h, p.int(3, 8), 0x0a0d12);
    p.dot(x + 5, y + h + 8, 0xffe8a0);
    return w;
}
function hazardPlate(p: Pen, x: number, y: number): number {
    const w = 12,
        h = 9;
    p.stripes(x, y, w, h, 0xe9b930, 0x14110c, 3);
    p.rect(x + 2, y + 2, w - 4, h - 4, 0xe9b930);
    p.text(x + 4, y + 2, "I", 0x14110c);
    return w;
}
function clock(p: Pen, x: number, y: number): number {
    p.blob(x + 5, y + 5, 5, 5, 0x0b121a);
    p.blob(x + 5, y + 5, 4, 4, 0xcfd6dc);
    p.line(x + 5, y + 5, x + 5, y + 2, 0x10141a);
    p.line(x + 5, y + 5, x + 8, y + 6, 0x10141a);
    p.line(x + 3, y + 3, x + 6, y + 7, 0x10141a, 0.6);
    return 10;
}
function shelves(p: Pen, x: number, y: number, pal: Palette): number {
    const w = 30,
        h = 14;
    p.rect(x, y, w, h, 0x0a0e14);
    for (let r = 0; r < 3; r++) {
        const sy = y + 4 + r * 4;
        p.hline(x, sy, w, 0x4a5868);
        let bx = x + 1;
        while (bx < x + w - 3) {
            const bw = p.int(2, 4),
                bh = p.int(2, 3);
            p.rect(
                bx,
                sy - bh,
                bw,
                bh,
                p.pick([0x8a6a45, 0xc9b88a, 0x6b7a8f, pal.accent]),
                0.9,
            );
            bx += bw + p.int(0, 1);
        }
    }
    p.rect(x + 4, y + h - 2, 6, 2, 0xc9b88a); // fallen box
    return w;
}
function pipes(p: Pen, x: number, y: number, pal: Palette): number {
    const w = 34;
    for (const [py, c] of [
        [y + 2, 0x6e7a82],
        [y + 7, 0x7a6a52],
    ] as const) {
        p.rect(x, py, w, 3, c);
        p.hline(x, py, w, 0xffffff, 0.15);
        p.hline(x, py + 2, w, 0x000000, 0.4);
        for (let fx = x + 4; fx < x + w; fx += 11)
            p.rect(fx, py - 1, 2, 5, 0x39434b);
    }
    p.blob(x + 20, y + 11, 3, 3, pal.accent, 0.8);
    p.dot(x + 20, y + 11, 0x0a0d12);
    p.vline(x + 8, y + 10, 4, 0x4fa7c0, 0.7);
    return w;
}
function exitSign(p: Pen, x: number, y: number): number {
    const w = 17,
        h = 7;
    p.pool(x + w / 2, y + h / 2, 14, 8, 0x4cff9a, 0.05, 3);
    p.rect(x, y, w, h, 0x0a2a18);
    p.frame(x, y, w, h, 0x1c5a38);
    p.text(x + 2, y + 1, "EXIT", 0x7dffb0);
    return w;
}
function crest(p: Pen, x: number, y: number, pal: Palette): number {
    const w = 13,
        h = 15;
    p.rect(x, y, w, h - 3, 0x141f3a);
    p.frame(x, y, w, h - 3, pal.accent, 0.9);
    p.rect(x + 1, y + h - 3, w - 2, 1, 0x141f3a);
    p.rect(x + 3, y + h - 2, w - 6, 1, 0x141f3a);
    p.dot(x + 6, y + h - 1, 0x141f3a);
    p.text(x + 3, y + 3, "CB", pal.accent);
    return w;
}
function bulletin(p: Pen, x: number, y: number): number {
    const w = 22,
        h = 11;
    p.rect(x, y, w, h, 0x8a6a44);
    p.frame(x, y, w, h, 0x3a2a1a);
    for (let i = 0; i < 5; i++) {
        const nx = x + 2 + i * 4,
            ny = y + p.int(1, 5);
        p.rect(nx, ny, 3, 4, p.pick([0xe4dfcf, 0xf0d77a, 0xe39aa6, 0xa6c8e4]));
        p.dot(nx + 1, ny, 0xc23a3a);
    }
    return w;
}
function extinguisher(p: Pen, x: number, y: number): number {
    p.rect(x, y, 8, 13, 0x1a0e10);
    p.frame(x, y, 8, 13, 0x6e2a2a);
    p.rect(x + 2, y + 3, 4, 8, 0xc23a3a);
    p.rect(x + 2, y + 1, 4, 2, 0x20252b);
    p.dot(x + 3, y + 5, 0xff9a8a, 0.7);
    return 8;
}
function wallDoor(
    p: Pen,
    x: number,
    y: number,
    pal: Palette,
    sector: string,
): number {
    const w = 15,
        h = 14;
    p.rect(x, y, w, h, 0x151d28);
    p.frame(x, y, w, h, 0x5a6878);
    p.rect(x + 3, y + 2, 9, 5, 0x0a1a28);
    p.line(x + 3, y + 6, x + 8, y + 2, 0x4fa7c0, 0.5);
    p.rect(x + 11, y + 8, 2, 2, 0xc9d3dc);
    p.rect(x + 4, y - 1, 7, 2, 0x0a1018);
    p.text(x + 5, y, sector.slice(0, 1), pal.accent, 0.9);
    return w;
}
function serverPanel(p: Pen, x: number, y: number, pal: Palette): number {
    const w = 26,
        h = 12;
    p.rect(x, y, w, h, 0x060b13);
    p.frame(x, y, w, h, 0x2a3a4e);
    for (let r = 0; r < 4; r++)
        for (let c = 0; c < 8; c++)
            if (p.chance(0.65))
                p.dot(
                    x + 2 + c * 3,
                    y + 2 + r * 2,
                    p.pick([
                        pal.accent,
                        pal.accent,
                        0xffb04a,
                        0x4cff9a,
                        0xe0463a,
                    ]),
                    0.9,
                );
    return w;
}

const DECOR_BY_THEME: Record<RoomTheme, readonly string[]> = {
    reception: [
        "crest",
        "clock",
        "poster",
        "screen",
        "bulletin",
        "window",
        "vent",
        "screen",
    ],
    archive: [
        "shelves",
        "shelves",
        "poster",
        "vent",
        "bulletin",
        "shelves",
        "clock",
    ],
    office: [
        "window",
        "whiteboard",
        "poster",
        "vent",
        "clock",
        "bulletin",
        "door",
    ],
    approval: [
        "whiteboard",
        "poster",
        "window",
        "screen",
        "bulletin",
        "vent",
        "door",
    ],
    recovery: [
        "screen",
        "poster",
        "vent",
        "window",
        "extinguisher",
        "hazard",
        "door",
    ],
    vault: ["hazard", "vent", "screen", "fuse", "hazard", "screen"],
    boardroom: ["crest", "window", "window", "poster", "clock", "crest"],
    power: ["pipes", "fuse", "hazard", "pipes", "vent", "fuse", "extinguisher"],
    industrial: ["pipes", "lockers", "hazard", "vent", "fuse", "extinguisher"],
    server: ["server", "server", "screen", "vent", "fuse", "hazard"],
    canteen: ["window", "poster", "vent", "clock", "whiteboard", "bulletin"],
    flooded: ["window", "vent", "whiteboard", "poster", "pipes", "hazard"],
    mail: ["lockers", "shelves", "bulletin", "vent", "poster", "hazard"],
    evac: ["exit", "poster", "exit", "extinguisher", "hazard", "window"],
};

function drawDecor(
    kind: string,
    p: Pen,
    x: number,
    y: number,
    pal: Palette,
    sector: string,
): number {
    switch (kind) {
        case "crest":
            return crest(p, x, y - 1, pal);
        case "clock":
            return clock(p, x, y);
        case "poster":
            return poster(p, x, y, pal);
        case "screen":
            return wallScreen(p, x, y, pal);
        case "bulletin":
            return bulletin(p, x, y);
        case "window":
            return windowPane(p, x, y);
        case "vent":
            return vent(p, x, y + 1);
        case "shelves":
            return shelves(p, x, y, pal);
        case "whiteboard":
            return whiteboard(p, x, y);
        case "extinguisher":
            return extinguisher(p, x, y);
        case "hazard":
            return hazardPlate(p, x, y + 2);
        case "door":
            return wallDoor(p, x, y, pal, sector);
        case "pipes":
            return pipes(p, x, y, pal);
        case "fuse":
            return fusebox(p, x, y);
        case "lockers":
            return lockers(p, x, y);
        case "exit":
            return exitSign(p, x, y + 1);
        case "server":
            return serverPanel(p, x, y, pal);
        default:
            return 8;
    }
}

function paintNorthFace(p: Pen, s: RoomArtSpec, pal: Palette): void {
    const W = ROOM_ART.aw,
        H = ROOM_ART.fy;
    const gapL = ROOM_ART.fx + ROOM_ART.fw / 2 - DOOR_HALF,
        gapR = ROOM_ART.fx + ROOM_ART.fw / 2 + DOOR_HALF;
    const segs: Array<[number, number]> = s.doors.n
        ? [
              [0, gapL],
              [gapR, W],
          ]
        : [[0, W]];
    for (const [a, b] of segs) {
        const w = b - a;
        p.rect(a, 0, w, H, pal.wall);
        p.rect(a, 0, w, 3, pal.wallDark);
        p.hline(a, 3, w, pal.trim, 0.9);
        p.hline(a, 4, w, 0xffffff, 0.08);
        for (let x = a + 20 - (a % 20); x < b; x += 40) {
            p.vline(x, 5, H - 9, 0x000000, 0.3);
            p.vline(x + 1, 5, H - 9, 0xffffff, 0.05);
        }
        p.rect(a, H - 6, w, 6, pal.wallDark);
        p.hline(a, H - 6, w, pal.trim, 0.5);
        p.rect(a, H - 5, w, 1, 0xffffff, 0.05);
        for (let x = a; x < b; x += 3) p.dot(x, H - 2, 0x000000, 0.3);
        p.noise(a, 5, w, H - 11, 0x000000, 0.05, 0.14);
        // Dirt streaks running down from the trim and stains from old leaks.
        for (let i = 0; i < w / 24; i++) {
            const sx = a + p.int(2, Math.max(3, w - 2));
            p.vline(sx, 5, p.int(4, 11), 0x000000, 0.16);
        }
        // Wall lamps (some dead).
        for (let x = a + 14; x < b - 6; x += 72) {
            p.rect(x, 1, 18, 3, 0x0a0e14);
            if (((x / 72) | 0) % 3 !== 0) {
                p.rect(x + 2, 2, 14, 1, 0xf6e7b0);
                p.rect(x + 2, 3, 14, 1, 0xf6e7b0, 0.3);
            } else p.rect(x + 2, 2, 14, 1, 0x2a3440);
        }
        // Decor panels.
        let x = a + 6;
        const kinds = DECOR_BY_THEME[s.theme];
        while (x < b - 28) {
            if (p.chance(0.18)) {
                x += p.int(4, 10);
                continue;
            }
            const used = drawDecor(p.pick(kinds), p, x, 6, pal, s.sector);
            x += used + p.int(5, 12);
        }
    }
    // Sector plate beside the door (or centred without one).
    const px = s.doors.n ? gapL - 24 : ROOM_ART.fx + ROOM_ART.fw / 2 - 10;
    p.rect(px, 6, 20, 9, 0x070b11);
    p.frame(px, 6, 20, 9, pal.accent, 0.9);
    p.text(px + 3, 8, s.sector, pal.accent);
    p.dot(px + 15, 8, 0x4cff9a);
    p.dot(px + 15, 10, p.chance(0.5) ? 0xc23a3a : 0x2a3440);
    if (s.doors.n) {
        // Door header with warning stripes and status lights.
        p.rect(gapL - 2, 0, gapR - gapL + 4, 5, pal.wallDark);
        p.stripes(gapL - 2, 3, gapR - gapL + 4, 2, 0xe9b930, 0x14110c, 3, 0.85);
        p.rect(gapL - 3, 0, 3, H, pal.wallDark);
        p.rect(gapR, 0, 3, H, pal.wallDark);
        p.vline(gapL - 1, 5, H - 5, pal.trim, 0.6);
        p.vline(gapR, 5, H - 5, pal.trim, 0.6);
        p.dot(gapL + 3, 1, 0x4cff9a);
        p.dot(gapR - 4, 1, 0xc23a3a);
    }
}

function paintSideWalls(p: Pen, s: RoomArtSpec, pal: Palette): void {
    const { fx, fy, fw, fh, aw, ah } = ROOM_ART;
    const midY = fy + fh / 2;
    const cap = (
        x: number,
        y: number,
        w: number,
        h: number,
        vertical: boolean,
    ): void => {
        p.rect(x, y, w, h, pal.wallDark);
        if (vertical) {
            p.vline(x + 1, y, h, pal.trim, 0.35);
            p.rect(x + 3, y, w - 6, h, pal.wall, 0.9);
            p.vline(x + 3, y, h, 0xffffff, 0.1);
            p.vline(x + w - 3, y, h, 0x000000, 0.4);
            p.noise(x, y, w, h, 0x000000, 0.08, 0.2);
            for (let yy = y + 20; yy < y + h; yy += 40)
                p.hline(x + 2, yy, w - 4, 0x000000, 0.3);
        } else {
            p.hline(x, y + 1, w, pal.trim, 0.4);
            p.rect(x, y + 3, w, h - 6, pal.wall, 0.9);
            p.hline(x, y + 3, w, 0xffffff, 0.1);
            p.hline(x, y + h - 3, w, 0x000000, 0.4);
            p.noise(x, y, w, h, 0x000000, 0.08, 0.2);
            for (let xx = x + 20; xx < x + w; xx += 40)
                p.vline(xx, y + 2, h - 4, 0x000000, 0.3);
        }
    };
    const vertSegs = (door: boolean): Array<[number, number]> =>
        door
            ? [
                  [fy, midY - DOOR_HALF],
                  [midY + DOOR_HALF, fy + fh + 10],
              ]
            : [[fy, fy + fh + 10]];
    for (const [a, b] of vertSegs(s.doors.w)) cap(0, a, fx, b - a, true);
    for (const [a, b] of vertSegs(s.doors.e))
        cap(fx + fw, a, aw - fx - fw, b - a, true);
    const cx = fx + fw / 2;
    const horSegs: Array<[number, number]> = s.doors.s
        ? [
              [0, cx - DOOR_HALF],
              [cx + DOOR_HALF, aw],
          ]
        : [[0, aw]];
    for (const [a, b] of horSegs) cap(a, fy + fh, b - a, ah - fy - fh, false);
    // Door frames on side/south openings.
    const frame = (x: number, y: number, w: number, h: number): void => {
        p.rect(x, y, w, h, 0x0a0e14);
        p.rect(x + 1, y, w - 2, h, pal.trim, 0.55);
        p.stripes(x, y, w, h, 0xe9b930, 0x14110c, 3, 0.55);
    };
    if (s.doors.w) {
        frame(0, midY - DOOR_HALF - 2, fx, 3);
        frame(0, midY + DOOR_HALF - 1, fx, 3);
    }
    if (s.doors.e) {
        frame(fx + fw, midY - DOOR_HALF - 2, aw - fx - fw, 3);
        frame(fx + fw, midY + DOOR_HALF - 1, aw - fx - fw, 3);
    }
    if (s.doors.s) {
        frame(cx - DOOR_HALF - 2, fy + fh, 3, ah - fy - fh);
        frame(cx + DOOR_HALF - 1, fy + fh, 3, ah - fy - fh);
    }
}

function paintThresholds(p: Pen, s: RoomArtSpec): void {
    const { fx, fy, fw, fh } = ROOM_ART;
    const cx = fx + fw / 2,
        cy = fy + fh / 2;
    const st = (x: number, y: number, w: number, h: number): void =>
        p.stripes(x, y, w, h, 0xe9b930, 0x14110c, 3, 0.55);
    if (s.doors.n) st(cx - DOOR_HALF, fy, DOOR_HALF * 2, 4);
    if (s.doors.s) st(cx - DOOR_HALF, fy + fh - 4, DOOR_HALF * 2, 4);
    if (s.doors.w) st(fx, cy - DOOR_HALF, 4, DOOR_HALF * 2);
    if (s.doors.e) st(fx + fw - 4, cy - DOOR_HALF, 4, DOOR_HALF * 2);
}

export function paintRoom(p: Pen, s: RoomArtSpec): void {
    const pal = PALETTES[s.theme];
    paintFloor(p, s, pal);
    paintDecals(p, s, pal);
    paintThresholds(p, s);
    paintShading(p, s, pal);
    paintSideWalls(p, s, pal);
    paintNorthFace(p, s, pal);
}

export interface CorridorArtSpec {
    horizontal: boolean;
    seed: number;
    stair: boolean;
}
/** Corridor textures: floor art rectangle sits at (fx, fy) inside an aw x ah texture. */
export function corridorGeometry(
    floorW: number,
    floorH: number,
    horizontal: boolean,
): { aw: number; ah: number; fx: number; fy: number; fw: number; fh: number } {
    const fw = Math.ceil(floorW / ART),
        fh = Math.ceil(floorH / ART);
    return horizontal
        ? { aw: fw, ah: ROOM_ART.fy + fh + 8, fx: 0, fy: ROOM_ART.fy, fw, fh }
        : { aw: fw + 8, ah: fh, fx: 4, fy: 0, fw, fh };
}

export function paintCorridor(
    p: Pen,
    g: ReturnType<typeof corridorGeometry>,
    s: CorridorArtSpec,
): void {
    const { fx, fy, fw, fh } = g;
    const pal = s.stair ? PALETTES.industrial : PALETTES.evac;
    p.rect(fx, fy, fw, fh, 0x142635);
    for (let ty = 0; ty * 16 < fh; ty++)
        for (let tx = 0; tx * 16 < fw; tx++) {
            const px = fx + tx * 16,
                py = fy + ty * 16;
            p.rect(px, py, 16, 16, p.chance(0.5) ? 0x172a3a : 0x112131);
            p.frame(px, py, 16, 16, 0x000000, 0.3);
            p.hline(px + 1, py + 1, 14, 0xffffff, 0.04);
        }
    p.noise(fx, fy, fw, fh, 0xffffff, 0.02, 0.07);
    // Centre guide line and green evacuation chevrons.
    const mid = s.horizontal ? fy + fh / 2 : fx + fw / 2;
    for (let i = 0; i < (s.horizontal ? fw : fh); i += 8) {
        if (s.horizontal) p.rect(fx + i, mid, 4, 1, 0xe9b930, 0.4);
        else p.rect(mid, fy + i, 1, 4, 0xe9b930, 0.4);
    }
    for (let i = 24; i < (s.horizontal ? fw : fh) - 20; i += 56) {
        const a = 0.35;
        if (s.horizontal) {
            p.line(fx + i, mid - 6, fx + i + 5, mid - 3, 0x6df2a0, a);
            p.line(fx + i + 5, mid - 3, fx + i, mid, 0x6df2a0, a);
        } else {
            p.line(mid - 6, fy + i, mid - 3, fy + i + 5, 0x6df2a0, a);
            p.line(mid - 3, fy + i + 5, mid, fy + i, 0x6df2a0, a);
        }
    }
    // Hazard edging and wear.
    if (s.horizontal) {
        p.stripes(fx, fy + 1, fw, 3, 0xe9b930, 0x14110c, 4, 0.4);
        p.stripes(fx, fy + fh - 4, fw, 3, 0xe9b930, 0x14110c, 4, 0.4);
    } else {
        p.stripes(fx + 1, fy, 3, fh, 0xe9b930, 0x14110c, 4, 0.4);
        p.stripes(fx + fw - 4, fy, 3, fh, 0xe9b930, 0x14110c, 4, 0.4);
    }
    for (let i = p.int(2, 4); i > 0; i--)
        p.blob(
            p.int(fx + 10, fx + fw - 10),
            p.int(fy + 10, fy + fh - 10),
            p.int(5, 12),
            p.int(3, 7),
            0x05070a,
            0.25,
        );
    for (let i = p.int(1, 3); i > 0; i--) {
        let x = p.int(fx + 10, fx + fw - 10),
            y = p.int(fy + 10, fy + fh - 10);
        for (let k = 0; k < 9; k++) {
            const nx = x + p.int(-4, 4),
                ny = y + p.int(-3, 4);
            p.line(x, y, nx, ny, 0x020409, 0.7);
            x = nx;
            y = ny;
        }
    }
    for (let i = p.int(2, 5); i > 0; i--) {
        const x = p.int(fx + 8, fx + fw - 14),
            y = p.int(fy + 8, fy + fh - 12);
        p.rect(x + 1, y + 1, 6, 5, 0x000000, 0.35);
        p.rect(x, y, 6, 5, 0xd2cdbb);
        p.hline(x + 1, y + 1, 4, 0x6b6a60, 0.7);
    }
    // Edge shading.
    for (let i = 0; i < 8; i++) {
        const a = 0.2 * (1 - i / 8);
        if (s.horizontal) {
            p.hline(fx, fy + i, fw, 0x02040a, a);
            p.hline(fx, fy + fh - 1 - i, fw, 0x02040a, a);
        } else {
            p.vline(fx + i, fy, fh, 0x02040a, a);
            p.vline(fx + fw - 1 - i, fy, fh, 0x02040a, a);
        }
    }
    if (s.horizontal) {
        // North wall face of the connector with vents, a sign and a caged lamp.
        const H = fy;
        p.rect(0, 0, fw, H, pal.wall);
        p.rect(0, 0, fw, 3, pal.wallDark);
        p.hline(0, 3, fw, pal.trim, 0.9);
        p.rect(0, H - 6, fw, 6, pal.wallDark);
        p.hline(0, H - 6, fw, pal.trim, 0.5);
        p.noise(0, 5, fw, H - 11, 0x000000, 0.06, 0.14);
        vent(p, 14, 8);
        exitSign(p, fw - 34, 9);
        poster(p, fw / 2 - 5, 7, pal);
        p.rect(fw / 2 - 30, 1, 14, 3, 0x0a0e14);
        p.rect(fw / 2 - 28, 2, 10, 1, 0xf6e7b0);
        p.rect(0, fy + fh, fw, 8, pal.wallDark);
        p.hline(0, fy + fh + 1, fw, pal.trim, 0.4);
    } else {
        p.rect(0, 0, 4, fh, pal.wallDark);
        p.vline(1, 0, fh, pal.trim, 0.4);
        p.rect(fx + fw, 0, 4, fh, pal.wallDark);
        p.vline(fx + fw + 2, 0, fh, pal.trim, 0.4);
    }
}

export function paintVoidTile(p: Pen): void {
    p.rect(0, 0, p.w, p.h, 0x03060c);
    p.noise(0, 0, p.w, p.h, 0x0b1420, 0.12, 0.8);
    p.noise(0, 0, p.w, p.h, 0x000000, 0.1, 0.8);
    for (let i = 0; i < p.w; i += 16) p.vline(i, 0, p.h, 0x070d16, 0.8);
    for (let i = 0; i < p.h; i += 16) p.hline(0, i, p.w, 0x070d16, 0.8);
    p.line(0, 9, p.w, 19, 0x0a1320, 0.9);
}
