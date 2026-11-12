import * as Phaser from "phaser";

const WALL_TEXTURE = "cb-g2-solid";

const KEY = {
    bg: "cb-g2-hall-bg-v2",
    plate: "cb-g2-hall-plate-v2",
    board: "cb-g2-hall-board-v2",
    bench0: "cb-g2-hall-bench0-v2",
    bench1: "cb-g2-hall-bench1-v2",
    plant: "cb-g2-hall-plant-v2",
    dais: "cb-g2-hall-dais-v2",
    byte: "cb-g2-hall-byte-v2",
    byteBlink: "cb-g2-hall-byte-blink-v2",
    flame: "cb-g2-hall-flame-v2",
    glow: "cb-g2-hall-glow-v2",
    vignette: "cb-g2-hall-vignette-v2",
} as const;

export const HALL = {
    width: 1024,
    height: 768,
    walkable: { x: 92, y: 190, width: 840, height: 496 },
    spawn: { x: 512, y: 590 },
} as const;

const W = HALL.width;
const H = HALL.height;

const P = {
    void: 0x050a14,
    shell: 0x101f35,
    gold: 0xfbbf24,
    goldDark: 0xb45309,
    mortar: 0x0c1729,
    bricks: [0x1c2f4d, 0x213756, 0x182a45] as number[],
    stones: [0x2a3e5c, 0x30425b, 0x253750] as number[],
    trim: 0x2b3f5c,
    floorA: 0x172942,
    floorB: 0x1b3048,
    floorHi: 0x3a5a80,
    grout: 0x0e1a2c,
    speck: 0x223b54,
    speckDark: 0x10223a,
    wood: 0x783c1c,
    woodLight: 0xa35b28,
    woodDark: 0x452312,
    boardFrame: 0x40291c,
    cork: 0xb07a45,
    parchment: 0xf4dda2,
    parchment2: 0xead4a5,
    paper3: 0xdbeafe,
    ink: 0x5b3a1a,
    pin: 0xef4444,
    teal: 0x55e8d5,
    tealRug: 0x0b706b,
    rugEdge: 0x8b5b2c,
    rugDeep: 0x114c57,
    daisSide: 0x0f2e3a,
    daisTop: 0x1e4553,
    glass: [
        0x0b1a33, 0x0e2142, 0x122a52, 0x16345f, 0x1a3d6c, 0x1f477a,
    ] as number[],
    leaf: [0x166534, 0x22c55e, 0x4ade80] as number[],
    pot: 0xb45309,
};

type G = Phaser.GameObjects.Graphics;
type Rng = Phaser.Math.RandomDataGenerator;

// ---------------------------------------------------------------------------
// Top-down Y sorting: ALL furniture uses its world-space contact/base Y.
// Actors must likewise use their world-space visual feet Y via
// TopDownDepthSystem. This keeps a player behind the board visually obscured,
// while allowing the player in front to appear in front of its upright art.
// Physics collision footprints are separate from visual sprite dimensions.
// ---------------------------------------------------------------------------
const depthFor = (solidBottom: number) => solidBottom;

const prefersReducedMotion = () =>
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// ---------------------------------------------------------------------------
// Tiny drawing helpers (all crisp, no anti-aliased shapes)
// ---------------------------------------------------------------------------
const rect = (
    g: G,
    x: number,
    y: number,
    w: number,
    h: number,
    color: number,
    alpha = 1,
) => {
    g.fillStyle(color, alpha);
    g.fillRect(x, y, w, h);
};

/** Pixel-stepped ellipse. */
function disc(
    g: G,
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    color: number,
    alpha = 1,
) {
    g.fillStyle(color, alpha);
    for (let dy = -ry; dy < ry; dy++) {
        const t = (dy + 0.5) / ry;
        const half = Math.round(rx * Math.sqrt(1 - t * t));
        if (half > 0) g.fillRect(cx - half, cy + dy, half * 2, 1);
    }
}

/** Downward-pointing banner shape. */
function pennant(
    g: G,
    x: number,
    y: number,
    w: number,
    h: number,
    color: number,
) {
    g.fillStyle(color, 1);
    for (let i = 0; i < h; i++) {
        const inset = Math.floor((i * (w / 2)) / h);
        g.fillRect(x + inset, y + i, w - inset * 2, 1);
    }
}

function bakeProp(
    scene: Phaser.Scene,
    key: string,
    w: number,
    h: number,
    draw: (g: G) => void,
    smooth = false,
) {
    if (scene.textures.exists(key)) return;
    const g = scene.make.graphics({}, false);
    draw(g);
    g.generateTexture(key, w, h);
    g.destroy();
    if (!smooth)
        scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
}

function bakeRows(
    scene: Phaser.Scene,
    key: string,
    rows: string[],
    palette: Record<string, number>,
) {
    bakeProp(scene, key, rows[0].length, rows.length, (g) => {
        rows.forEach((row, y) =>
            [...row].forEach((ch, x) => {
                if (palette[ch] !== undefined) rect(g, x, y, 1, 1, palette[ch]);
            }),
        );
    });
}

// ---------------------------------------------------------------------------
// Sprite maps
// ---------------------------------------------------------------------------
const BYTE_ROWS = [
    "....OBBBBBBO....",
    "...OBHHHHHHBO...",
    "..OBHHHHHHHHBO..",
    ".OBHHBBBBBBBBBO.",
    ".OBBFFFFFFFFBBO.",
    ".OBBFFFFFFFFBBO.",
    ".OBBFEEFFEEFBBO.",
    ".OBBFEEFFEEFBBO.",
    ".ODBFFFFFFFFBDO.",
    ".ODBFFFFFFFFBDO.",
    ".ODBBBBFFBBBBDO.",
    ".ODBBBBFFBBBBDO.",
    ".OBBBBBOOBBBBBO.",
    "ODBBBBO..OBBBBDO",
    "ODBBBO....OBBBDO",
];
const BYTE_BLINK_ROWS = BYTE_ROWS.map((row, i) =>
    i === 6 ? ".OBBFFFFFFFFBBO." : row,
);
const BYTE_PALETTE = {
    O: 0x10313b,
    B: 0x55e8d5,
    H: 0x8affed,
    D: 0x28bfae,
    F: 0x102630,
    E: 0xffca28,
};

const FLAME_ROWS = [
    "..O..",
    ".OOO.",
    ".OYO.",
    "OOYOO",
    "OYYYO",
    "OYYYO",
    ".OYO.",
    "..O..",
];
const FLAME_PALETTE = { O: 0xf97316, Y: 0xfde047 };

// ---------------------------------------------------------------------------
// Static background (baked once into a single texture)
// ---------------------------------------------------------------------------
function drawWindow(g: G, cx: number, withMoon: boolean) {
    rect(g, cx - 28, 130, 56, 46, P.goldDark);
    rect(g, cx - 26, 132, 52, 42, P.wood);
    P.glass.forEach((c, i) => rect(g, cx - 24, 134 + i * 6, 48, 6, c));
    // A few stars in the glass
    rect(g, cx - 16, 138, 2, 2, 0xe2e8f0);
    rect(g, cx + 14, 154, 2, 2, 0xe2e8f0);
    rect(g, cx - 10, 162, 2, 2, 0xcbd5e1);
    if (withMoon) {
        disc(g, cx + 11, 144, 6, 6, 0xfde68a);
        disc(g, cx + 14, 142, 5, 5, P.glass[1]);
    }
    // Mullions and sill
    rect(g, cx - 1, 134, 2, 36, P.woodDark);
    rect(g, cx - 24, 151, 48, 2, P.woodDark);
    rect(g, cx - 32, 174, 64, 5, P.trim);
    rect(g, cx - 32, 174, 64, 1, P.floorHi, 0.6);
}

function drawBanner(g: G, cx: number, body: number) {
    rect(g, cx - 19, 126, 38, 3, P.woodDark);
    pennant(g, cx - 16, 129, 32, 44, P.gold);
    pennant(g, cx - 13, 129, 26, 40, body);
    disc(g, cx, 144, 6, 6, P.gold);
    disc(g, cx, 144, 4, 4, P.goldDark);
    rect(g, cx - 1, 140, 2, 8, P.gold);
    rect(g, cx - 4, 143, 8, 2, P.gold);
}

function drawSconce(g: G, cx: number) {
    rect(g, cx - 1, 153, 2, 8, 0x1f2937);
    rect(g, cx - 5, 149, 10, 5, 0x374151);
    rect(g, cx - 5, 149, 10, 1, 0x6b7280);
}

function drawRug(g: G) {
    const x = 398;
    const y = 336;
    const s = 228;
    const cx = x + s / 2;
    const cy = y + s / 2;

    for (let fx = x + 4; fx < x + s - 2; fx += 6) {
        rect(g, fx, y - 6, 2, 6, P.gold);
        rect(g, fx, y + s, 2, 6, P.gold);
    }
    rect(g, x + 5, y + 5, s, s, 0x000000, 0.3);
    rect(g, x, y, s, s, P.rugEdge);
    rect(g, x + 8, y + 8, s - 16, s - 16, P.tealRug);

    // Gold beads along the border band
    for (let i = 4; i < s - 8; i += 12) {
        rect(g, x + i, y + 2, 4, 4, P.gold, 0.85);
        rect(g, x + i, y + s - 6, 4, 4, P.gold, 0.85);
        rect(g, x + 2, y + i, 4, 4, P.gold, 0.85);
        rect(g, x + s - 6, y + i, 4, 4, P.gold, 0.85);
    }

    rect(g, x + 20, y + 20, s - 40, s - 40, P.rugDeep);
    rect(g, x + 31, y + 31, 166, 3, P.gold);
    rect(g, x + 31, y + 194, 166, 3, P.gold);
    rect(g, x + 31, y + 31, 3, 166, P.gold);
    rect(g, x + 194, y + 31, 3, 166, P.gold);

    // Corner sparkles
    for (const [sx, sy] of [
        [x + 46, y + 46],
        [x + s - 46, y + 46],
        [x + 46, y + s - 46],
        [x + s - 46, y + s - 46],
    ]) {
        rect(g, sx - 1, sy - 5, 2, 10, P.gold, 0.7);
        rect(g, sx - 5, sy - 1, 10, 2, P.gold, 0.7);
    }

    // Central coin medallion
    disc(g, cx, cy, 38, 38, P.goldDark);
    disc(g, cx, cy, 35, 35, P.gold);
    disc(g, cx, cy, 28, 28, 0xd97706);
    disc(g, cx, cy, 25, 25, P.gold);
    rect(g, cx - 3, cy - 17, 6, 34, P.goldDark);
    rect(g, cx - 17, cy - 3, 34, 6, P.goldDark);
    rect(g, cx - 12, cy - 18, 5, 3, 0xfde68a, 0.9);
}

function drawBackground(g: G, rng: Rng) {
    rect(g, 0, 0, W, H, P.void);
    for (let i = 0; i < 40; i++) {
        rect(
            g,
            rng.integerInRange(8, W - 10),
            rng.integerInRange(6, 108),
            2,
            2,
            0x94a3b8,
            0.2 + rng.frac() * 0.5,
        );
    }

    // Outer shell and gold trim
    rect(g, 64, 120, 896, 590, P.shell);
    rect(g, 64, 120, 896, 6, P.gold);
    rect(g, 64, 704, 896, 6, P.gold);
    rect(g, 64, 126, 4, 578, P.goldDark);
    rect(g, 956, 126, 4, 578, P.goldDark);

    // Floor slabs with bevels, speckles and the occasional crack
    for (let ty = 176; ty < 696; ty += 32) {
        for (let tx = 80; tx < 944; tx += 32) {
            const h = Math.min(32, 696 - ty);
            const alt = ((tx - 80) / 32 + (ty - 176) / 32) % 2 === 0;
            rect(g, tx, ty, 32, h, alt ? P.floorA : P.floorB);
            rect(g, tx, ty, 32, 1, P.floorHi, 0.3);
            rect(g, tx, ty, 1, h, P.floorHi, 0.2);
            rect(g, tx + 31, ty, 1, h, P.grout);
            rect(g, tx, ty + h - 1, 32, 1, P.grout);
            for (let s = 0; s < 3; s++) {
                rect(
                    g,
                    tx + rng.integerInRange(3, 27),
                    ty + rng.integerInRange(3, Math.max(3, h - 5)),
                    2,
                    2,
                    rng.pick([P.speck, P.speckDark]),
                    0.8,
                );
            }
            if (rng.frac() < 0.06) {
                const cx = tx + rng.integerInRange(6, 20);
                const cy = ty + rng.integerInRange(4, Math.max(4, h - 12));
                rect(g, cx, cy, 1, 3, P.grout, 0.9);
                rect(g, cx + 1, cy + 3, 1, 3, P.grout, 0.9);
                rect(g, cx, cy + 6, 1, 3, P.grout, 0.9);
            }
        }
    }

    // Ambient occlusion where floor meets walls
    for (let i = 0; i < 6; i++)
        rect(g, 92, 182 + i * 4, 840, 4, 0x000000, 0.3 - i * 0.05);
    for (let i = 0; i < 5; i++) {
        rect(g, 92 + i * 4, 182, 4, 514, 0x000000, 0.25 - i * 0.05);
        rect(g, 932 - (i + 1) * 4, 182, 4, 514, 0x000000, 0.25 - i * 0.05);
    }
    for (let i = 0; i < 4; i++)
        rect(g, 92, 696 - (i + 1) * 4, 840, 4, 0x000000, 0.22 - i * 0.05);

    drawRug(g);

    // Moonlight shafts from the three windows, drawn over the rug and floor
    for (const wx of [250, 512, 774]) {
        const shaft = (spread: number, alpha: number) => {
            g.fillStyle(0xfbdbfe, alpha);

            const points: Phaser.Math.Vector2[] = [
                new Phaser.Math.Vector2(wx - 26 - spread, 186),
                new Phaser.Math.Vector2(wx + 26 + spread, 186),
                new Phaser.Math.Vector2(wx + 26 + spread + 96, 500),
                new Phaser.Math.Vector2(wx - 26 - spread + 96, 500),
            ];

            g.fillPoints(points, true);
        };

        shaft(0, 0.05);
        shaft(10, 0.03);
    }

    // Back wall: bricks, windows, banners, sconces
    rect(g, 72, 126, 880, 54, P.mortar);
    for (let row = 0; row < 6; row++) {
        const y = 126 + row * 9;
        const off = row % 2 ? 12 : 0;
        for (let x = 72 - off; x < 952; x += 24) {
            const bx = Math.max(x, 72);
            const bw = Math.min(x + 24, 952) - bx - 1;
            if (bw > 0) rect(g, bx, y, bw, 8, rng.pick(P.bricks));
        }
    }
    rect(g, 72, 180, 880, 6, P.trim);
    rect(g, 72, 180, 880, 1, P.floorHi, 0.5);

    drawWindow(g, 250, false);
    drawWindow(g, 512, true);
    drawWindow(g, 774, false);
    drawBanner(g, 150, P.tealRug);
    drawBanner(g, 381, 0x7c2d12);
    drawBanner(g, 643, 0x7c2d12);
    drawBanner(g, 874, P.tealRug);
    drawSconce(g, 316);
    drawSconce(g, 708);

    // Side walls
    for (const sx of [72, 932]) {
        rect(g, sx, 126, 20, 578, P.mortar);
        for (let y = 126, row = 0; y < 704; y += 16, row++) {
            const h = Math.min(15, 704 - y);
            if (row % 2) {
                rect(g, sx, y, 9, h, rng.pick(P.stones));
                rect(g, sx + 10, y, 9, h, rng.pick(P.stones));
            } else {
                rect(g, sx, y, 19, h, rng.pick(P.stones));
            }
        }
    }
    rect(g, 90, 182, 2, 514, P.floorHi, 0.25);
    rect(g, 932, 182, 2, 514, 0x000000, 0.3);

    // Bottom wall strip
    rect(g, 72, 690, 880, 14, P.mortar);
    for (let row = 0; row < 2; row++) {
        const off = row % 2 ? 12 : 0;
        for (let x = 72 - off; x < 952; x += 24) {
            const bx = Math.max(x, 72);
            const bw = Math.min(x + 24, 952) - bx - 1;
            if (bw > 0) rect(g, bx, 690 + row * 7, bw, 6, rng.pick(P.bricks));
        }
    }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
function drawBench(g: G, variant: number) {
    rect(g, 12, 58, 146, 8, 0x000000, 0.3);
    rect(g, 22, 44, 12, 20, P.woodDark);
    rect(g, 136, 44, 12, 20, P.woodDark);
    rect(g, 10, 2, 150, 12, P.wood); // backrest
    rect(g, 10, 2, 150, 3, P.woodLight);
    rect(g, 10, 14, 150, 16, P.woodLight); // seat
    rect(g, 10, 22, 150, 1, P.wood, 0.7);
    rect(g, 10, 14, 150, 2, 0xc7803a);
    rect(g, 10, 30, 150, 14, P.wood); // front face
    rect(g, 10, 44, 150, 2, P.woodDark);

    if (variant === 0) {
        // A guild book left on the seat
        rect(g, 36, 16, 20, 10, P.tealRug);
        rect(g, 36, 24, 20, 2, P.parchment);
        rect(g, 36, 18, 20, 2, P.gold);
    } else {
        // A satchel
        rect(g, 108, 14, 24, 14, 0x7c4a21);
        rect(g, 108, 14, 24, 6, P.ink);
        rect(g, 118, 19, 4, 4, P.gold);
    }
}

function drawBoard(g: G, rng: Rng) {
    rect(g, 12, 128, 152, 10, 0x000000, 0.3);
    rect(g, 14, 100, 10, 37, P.woodDark);
    rect(g, 152, 100, 10, 37, P.woodDark);
    rect(g, 14, 100, 3, 37, P.wood);
    rect(g, 152, 100, 3, 37, P.wood);

    rect(g, 8, 0, 160, 132, P.boardFrame);
    rect(g, 8, 0, 160, 2, P.gold);
    rect(g, 16, 8, 144, 116, P.cork);
    for (let i = 0; i < 70; i++) {
        rect(
            g,
            rng.integerInRange(17, 157),
            rng.integerInRange(9, 121),
            2,
            2,
            rng.pick([0x946032, 0xc08a52]),
        );
    }
    rect(g, 16, 8, 144, 3, 0x000000, 0.25);
    rect(g, 16, 8, 3, 116, 0x000000, 0.2);

    const notes: [number, number, number, number, number][] = [
        [24, 18, 40, 48, P.parchment],
        [72, 14, 34, 52, P.parchment2],
        [112, 22, 40, 44, P.paper3],
        [30, 74, 46, 36, P.parchment2],
        [84, 76, 36, 40, P.parchment],
        [124, 74, 30, 38, P.parchment2],
    ];
    notes.forEach(([x, y, w, h, color], n) => {
        rect(g, x + 2, y + 2, w, h, 0x000000, 0.25);
        rect(g, x, y, w, h, color);
        rect(g, x + w / 2 - 1, y + 2, 3, 3, P.pin);
        for (let i = 0; i < Math.floor((h - 14) / 7); i++) {
            rect(
                g,
                x + 5,
                y + 10 + i * 7,
                w - 10 - (i % 2) * 8,
                2,
                P.ink,
                0.55,
            );
        }
        if (n === 0) {
            disc(g, x + w - 9, y + h - 9, 5, 5, P.gold);
            disc(g, x + w - 9, y + h - 9, 3, 3, P.goldDark);
        }
    });
}

function drawDais(g: G) {
    rect(g, 8, 30, 160, 12, P.daisSide);
    disc(g, 88, 42, 80, 14, P.daisSide);
    disc(g, 88, 30, 80, 16, P.gold);
    disc(g, 88, 30, 77, 14, P.daisTop);
    disc(g, 88, 30, 62, 11, P.tealRug);
    disc(g, 88, 30, 56, 9, 0x0f3b45);
    for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const x = Math.round(88 + Math.cos(a) * 68);
        const y = Math.round(30 + Math.sin(a) * 11.5);
        rect(g, x - 1, y - 1, 3, 2, P.teal, 0.9);
    }
}

function drawPlant(g: G) {
    disc(g, 20, 48, 16, 4, 0x000000, 0.3);
    disc(g, 20, 22, 14, 16, P.leaf[0]);
    disc(g, 13, 26, 8, 10, P.leaf[1]);
    disc(g, 27, 24, 8, 12, P.leaf[2]);
    rect(g, 19, 4, 2, 12, P.leaf[1]);
    rect(g, 8, 32, 24, 4, P.goldDark);
    rect(g, 10, 36, 20, 12, P.pot);
    rect(g, 10, 36, 3, 12, 0xd97706);
    rect(g, 27, 36, 3, 12, 0x92400e);
}

function drawPlate(g: G) {
    rect(g, 0, 0, 540, 48, P.woodDark);
    rect(g, 3, 3, 534, 42, P.gold);
    rect(g, 6, 6, 528, 36, 0x0b1423);
    for (const x of [12, 522]) {
        for (const y of [10, 34]) rect(g, x, y, 4, 4, P.gold);
    }
}

// ---------------------------------------------------------------------------
// Canvas-based textures (soft light)
// ---------------------------------------------------------------------------
function bakeCanvasTextures(scene: Phaser.Scene) {
    if (!scene.textures.exists(KEY.glow)) {
        const tex = scene.textures.createCanvas(KEY.glow, 128, 128);
        if (tex) {
            const ctx = tex.getContext();
            const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
            grad.addColorStop(0, "rgba(255,255,255,1)");
            grad.addColorStop(0.4, "rgba(255,255,255,0.35)");
            grad.addColorStop(1, "rgba(255,255,255,0)");
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 128, 128);
            tex.refresh();
        }
    }

    if (!scene.textures.exists(KEY.vignette)) {
        const tex = scene.textures.createCanvas(KEY.vignette, W, H);
        if (tex) {
            const ctx = tex.getContext();
            const grad = ctx.createRadialGradient(
                W / 2,
                H / 2 + 30,
                300,
                W / 2,
                H / 2 + 30,
                720,
            );
            grad.addColorStop(0, "rgba(2,6,15,0)");
            grad.addColorStop(1, "rgba(2,6,15,0.6)");
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, W, H);
            tex.refresh();
        }
    }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Builds an asset-free top-down Quest Hall and returns its solid furniture. */
export function buildQuestHall(
    scene: Phaser.Scene,
): Phaser.Types.Physics.Arcade.ImageWithStaticBody[] {
    const rng = new Phaser.Math.RandomDataGenerator([
        "campus-bounty-quest-hall",
    ]);
    const reduceMotion = prefersReducedMotion();

    // --- Textures -----------------------------------------------------------
    if (!scene.textures.exists(WALL_TEXTURE)) {
        const tg = scene.make.graphics({}, false);
        rect(tg, 0, 0, 2, 2, 0xffffff);
        tg.generateTexture(WALL_TEXTURE, 2, 2);
        tg.destroy();
    }

    bakeProp(scene, KEY.bg, W, H, (g) => drawBackground(g, rng), true);
    bakeProp(scene, KEY.plate, 540, 48, drawPlate);
    bakeProp(scene, KEY.board, 176, 140, (g) => drawBoard(g, rng));
    bakeProp(scene, KEY.bench0, 170, 72, (g) => drawBench(g, 0));
    bakeProp(scene, KEY.bench1, 170, 72, (g) => drawBench(g, 1));
    bakeProp(scene, KEY.plant, 40, 52, drawPlant);
    bakeProp(scene, KEY.dais, 176, 60, drawDais);
    bakeRows(scene, KEY.byte, BYTE_ROWS, BYTE_PALETTE);
    bakeRows(scene, KEY.byteBlink, BYTE_BLINK_ROWS, BYTE_PALETTE);
    bakeRows(scene, KEY.flame, FLAME_ROWS, FLAME_PALETTE);
    bakeCanvasTextures(scene);

    // --- Static backdrop ----------------------------------------------------
    scene.add.image(0, 0, KEY.bg).setOrigin(0).setDepth(0);
    scene.add.image(512, 68, KEY.plate).setDepth(99);

    // --- Solids -------------------------------------------------------------
    const solids: Phaser.Types.Physics.Arcade.ImageWithStaticBody[] = [];
    const solid = (x: number, y: number, w: number, h: number) => {
        const obstacle = scene.physics.add.staticImage(x, y, WALL_TEXTURE);
        obstacle.setDisplaySize(w, h);
        obstacle.refreshBody();
        obstacle.setVisible(false);
        solids.push(obstacle);
        return y + h / 2; // bottom edge, used for depth sorting
    };

    const prop = (
        key: string,
        left: number,
        top: number,
        solidBottom: number,
    ) =>
        scene.add
            .image(left, top, key)
            .setOrigin(0)
            .setDepth(depthFor(solidBottom));

    // Quest board: the artwork is a flat, upright notice board, NOT a
    // 166 x 138 solid cube. Its drawn frame occupies roughly x=728..888,
    // y=222..354, with two small feet extending to y=359. Block only the
    // narrow floor-contact strip; the rest is visual artwork. The player
    // renders behind this artwork whenever their feet are behind its base.
    // Keep this thin collider static; visual depth is updated independently.
    const BOARD_X = 808;
    const BOARD_BASE_Y = 354;
    const BOARD_FOOTPRINT_W = 156;
    const BOARD_FOOTPRINT_H = 12;
    const boardBottom = solid(
        BOARD_X,
        BOARD_BASE_Y,
        BOARD_FOOTPRINT_W,
        BOARD_FOOTPRINT_H,
    );
    prop(KEY.board, 720, 222, boardBottom);

    // Byte's dais, with Byte hovering above it
    const daisBottom = solid(240, 369, 158, 80);
    const daisDepth = depthFor(daisBottom);
    prop(KEY.dais, 152, 352, daisBottom);

    const daisGlow = scene.add
        .image(240, 382, KEY.glow)
        .setTint(P.teal)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(1.6, 0.65)
        .setAlpha(0.35)
        .setDepth(daisDepth + 0.2);

    const byteShadow = scene.add
        .ellipse(240, 382, 64, 14, 0x020617, 0.4)
        .setDepth(daisDepth + 0.5);
    const byte = scene.add
        .image(240, 366, KEY.byte)
        .setOrigin(0.5, 1)
        .setScale(5)
        .setDepth(daisDepth + 1);

    // Benches
    const leftBenchBottom = solid(250, 540, 158, 55);
    prop(KEY.bench0, 165, 504, leftBenchBottom);
    const rightBenchBottom = solid(778, 540, 158, 55);
    prop(KEY.bench1, 693, 504, rightBenchBottom);

    // Potted plants in all four corners
    for (const [px, py] of [
        [128, 196],
        [896, 196],
        [128, 632],
        [896, 632],
    ]) {
        const bottom = solid(px, py + 36, 30, 20);
        prop(KEY.plant, px - 20, py, bottom);
    }

    // --- Lighting -----------------------------------------------------------
    const flames: Phaser.GameObjects.Image[] = [];
    for (const sx of [316, 708]) {
        const glow = scene.add
            .image(sx, 146, KEY.glow)
            .setTint(0xfb923c)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setScale(1.7)
            .setAlpha(0.35)
            .setDepth(6);
        const flame = scene.add
            .image(sx, 149, KEY.flame)
            .setOrigin(0.5, 1)
            .setScale(3)
            .setDepth(7);
        flames.push(flame);

        if (!reduceMotion) {
            scene.tweens.add({
                targets: glow,
                alpha: { from: 0.26, to: 0.42 },
                scale: { from: 1.55, to: 1.8 },
                duration: Phaser.Math.Between(140, 240),
                yoyo: true,
                repeat: -1,
                delay: Phaser.Math.Between(0, 200),
            });
            scene.tweens.add({
                targets: flame,
                scaleY: { from: 2.8, to: 3.4 },
                duration: Phaser.Math.Between(120, 200),
                yoyo: true,
                repeat: -1,
                delay: Phaser.Math.Between(0, 200),
            });
        }
    }

    // Warm glow pooling on the rug
    scene.add
        .image(512, 450, KEY.glow)
        .setTint(0xfbbf24)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(3.2)
        .setAlpha(0.07)
        .setDepth(1);

    // --- Motion -------------------------------------------------------------
    if (!reduceMotion) {
        scene.tweens.add({
            targets: byte,
            y: "-=6",
            duration: 1200,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
        });
        scene.tweens.add({
            targets: byteShadow,
            scale: { from: 1, to: 0.85 },
            alpha: { from: 0.4, to: 0.28 },
            duration: 1200,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
        });
        scene.tweens.add({
            targets: daisGlow,
            alpha: { from: 0.25, to: 0.45 },
            duration: 1600,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
        });

        const blink = () => {
            scene.time.delayedCall(Phaser.Math.Between(2000, 4500), () => {
                if (!byte.active) return;
                byte.setTexture(KEY.byteBlink);
                scene.time.delayedCall(110, () => {
                    if (!byte.active) return;
                    byte.setTexture(KEY.byte);
                    blink();
                });
            });
        };
        blink();

        // Drifting dust motes
        for (let i = 0; i < 16; i++) {
            const mote = scene.add
                .image(
                    Phaser.Math.Between(110, 914),
                    Phaser.Math.Between(240, 660),
                    WALL_TEXTURE,
                )
                .setTint(0xfde68a)
                .setAlpha(0)
                .setDepth(700);
            const startY = mote.y;
            scene.tweens.add({
                targets: mote,
                y: "-=50",
                x: `+=${Phaser.Math.Between(-20, 20)}`,
                duration: Phaser.Math.Between(4000, 7500),
                delay: Phaser.Math.Between(0, 4000),
                repeat: -1,
                onUpdate: () => {
                    const t = Phaser.Math.Clamp((startY - mote.y) / 50, 0, 1);
                    mote.setAlpha(Math.sin(t * Math.PI) * 0.55);
                },
            });
        }
    }

    // --- Labels -------------------------------------------------------------
    const label = (
        x: number,
        y: number,
        message: string,
        size: string,
        color: string,
    ) =>
        scene.add
            .text(x, y, message, {
                fontFamily: '"Press Start 2P", monospace',
                fontSize: size,
                color,
                align: "center",
                stroke: "#08111F",
                strokeThickness: 4,
            })
            .setOrigin(0.5)
            .setDepth(100);

    label(512, 68, "CAMPUSBOUNTY  /  QUEST HALL", "17px", "#FBBF24");
    label(240, 430, "BYTE", "11px", "#55E8D5");
    label(808, 386, "QUEST BOARD", "10px", "#FBBF24");

    // A bobbing "!" over the board says "there are quests here".
    const marker = label(808, 206, "!", "24px", "#FBBF24").setDepth(110);
    if (!reduceMotion) {
        scene.tweens.add({
            targets: marker,
            y: "-=6",
            duration: 500,
            yoyo: true,
            repeat: -1,
            ease: "Quad.easeOut",
        });
    }

    // --- Vignette over everything in the hall -------------------------------
    scene.add.image(0, 0, KEY.vignette).setOrigin(0).setDepth(800);

    return solids;
}

