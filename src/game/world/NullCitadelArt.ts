import * as Phaser from "phaser";
import { dungeonRng, type DungeonBiome } from "./DungeonLayout";

/**
 * G4.4 Null Citadel — baked, reusable pixel art, not an external asset pack.
 * The Quest Hall's bake-once / reuse approach, with a new techno-gothic palette.
 * Detail is painted at native resolution; never upscale the entire world to a texture.
 */
export const NULL_KEY = "cb-g44-null";
export const artKey = (name: string): string => `${NULL_KEY}-${name}`;
type G = Phaser.GameObjects.Graphics;

type Palette = {
    floor: number; alternate: number; seam: number; glint: number;
    wall: number; brick: number; edge: number; accent: number; light: number;
};
export const NULL_PALETTE: Record<DungeonBiome, Palette> = {
    crypt:    { floor: 0x1c1c28, alternate: 0x252431, seam: 0x12141e, glint: 0x444452, wall: 0x262633, brick: 0x41404b, edge: 0x696570, accent: 0x9877ad, light: 0xa88bdd },
    barracks: { floor: 0x1c2028, alternate: 0x252c35, seam: 0x121721, glint: 0x525865, wall: 0x252b34, brick: 0x424b58, edge: 0x77808d, accent: 0xa8a4a1, light: 0xe9a264 },
    library:  { floor: 0x1a2227, alternate: 0x222c31, seam: 0x101b22, glint: 0x47565b, wall: 0x1e3031, brick: 0x345257, edge: 0x6d7c82, accent: 0x967ac3, light: 0x9d81da },
    foundry:  { floor: 0x272127, alternate: 0x322b2b, seam: 0x151217, glint: 0x605050, wall: 0x30292b, brick: 0x544044, edge: 0x92746a, accent: 0xb65a48, light: 0xf27448 },
    sanctum:  { floor: 0x201a27, alternate: 0x2a2230, seam: 0x110f1a, glint: 0x52415e, wall: 0x261c2e, brick: 0x45324c, edge: 0x7b6683, accent: 0xc73e5f, light: 0xe64a6d },
};

export function R(g: G, x: number, y: number, w: number, h: number, c: number, a = 1): void {
    if (w <= 0 || h <= 0) return;
    g.fillStyle(c, a).fillRect(Math.round(x), Math.round(y), Math.ceil(w), Math.ceil(h));
}
export function pixDisc(g: G, cx: number, cy: number, rx: number, ry: number, color: number, alpha = 1): void {
    for (let y = -ry; y <= ry; y += 2) {
        const width = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y / Math.max(1, ry)) ** 2)));
        R(g, cx - width, cy + y, width * 2, 2, color, alpha);
    }
}
function bake(scene: Phaser.Scene, name: string, w: number, h: number, draw: (g: G) => void): void {
    const key = artKey(name);
    if (scene.textures.exists(key)) return;
    const g = scene.make.graphics({}, false);
    draw(g);
    g.generateTexture(key, w, h);
    g.destroy();
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
}

function paintFloor(g: G, biome: DungeonBiome, variation: number): void {
    const pal = NULL_PALETTE[biome], rng = dungeonRng(0x44aacc ^ (variation * 41) ^ biome.length * 1337);
    R(g, 0, 0, 192, 192, pal.floor);
    const tile = biome === "foundry" ? 48 : biome === "sanctum" ? 64 : 32;
    for (let y = 0; y < 192; y += tile) for (let x = 0; x < 192; x += tile) {
        const wobble = rng();
        R(g, x + 1, y + 1, tile - 2, tile - 2, wobble > .72 ? pal.alternate : pal.floor);
        // Recessed mortar, broken and partially obscured: never a heavy editor grid.
        if (rng() > .32) R(g, x + 1, y + tile - 2, tile - 3, 1, pal.seam, .20);
        if (rng() > .48) R(g, x + tile - 2, y + 2, 1, tile - 5, pal.seam, .18);
        R(g, x + 2, y + 2, tile - 6, 1, pal.glint, .07 + rng() * .11);
        for (let j = 0; j < 3; j++) {
            const px = x + 5 + Math.floor(rng() * (tile - 10));
            const py = y + 5 + Math.floor(rng() * (tile - 10));
            R(g, px, py, rng() > .7 ? 3 : 2, 1, rng() > .4 ? pal.glint : pal.seam, .22);
        }
        if (rng() > .82) {
            const ax = x + 9 + Math.floor(rng() * (tile - 18));
            const ay = y + 7 + Math.floor(rng() * (tile - 16));
            R(g, ax, ay, 1, 8, pal.seam, .38);
            R(g, ax + 1, ay + 8, 7, 1, pal.seam, .38);
            R(g, ax + 7, ay + 9, 1, 5, pal.seam, .28);
        }
    }
    if (biome === "foundry") {
        // Riveted iron band inset in the floor, without thick outlined squares.
        for (let y = 31; y < 192; y += 96) {
            R(g, 0, y, 192, 8, 0x171720, .65);
            R(g, 0, y, 192, 1, 0x7d6765, .28);
            for (let x = 15; x < 192; x += 32) R(g, x, y + 3, 3, 2, 0x987a6c, .55);
        }
    } else if (biome === "library") {
        for (let i = 0; i < 7; i++) {
            const x = Math.floor(rng() * 175), y = Math.floor(rng() * 175);
            R(g, x, y, 7, 2, pal.accent, .13);
        }
    } else if (biome === "sanctum") {
        for (let i = 0; i < 3; i++) {
            const x = 32 + i * 48;
            R(g, x, 2, 2, 186, pal.accent, .13);
            R(g, x - 7, 89, 16, 2, pal.accent, .21);
        }
    }
}

function drawPillar(g: G): void {
    R(g, 32, 131, 100, 11, 0x03060c, .42); // separate contact shadow
    R(g, 35, 110, 73, 22, 0x171924);
    R(g, 29, 103, 83, 14, 0x53535e);
    R(g, 36, 96, 69, 9, 0x817c82);
    R(g, 46, 18, 50, 80, 0x343641);
    R(g, 51, 19, 5, 73, 0x777681);
    R(g, 85, 20, 6, 74, 0x151a24);
    R(g, 43, 14, 58, 12, 0x55545e);
    R(g, 39, 8, 65, 8, 0x86818a);
    R(g, 50, 12, 42, 3, 0xb9a7a3, .46);
    R(g, 56, 29, 2, 60, 0x6c6674, .5);
    // Carved channels and cracked corner.
    for (const y of [36, 52, 68, 84]) { R(g, 66, y, 2, 8, 0x1b1b2a); R(g, 73, y + 3, 2, 4, 0x7d7782, .5); }
    R(g, 87, 65, 3, 13, 0x12131d); R(g, 84, 76, 4, 2, 0x12131d);
    R(g, 94, 5, 14, 5, 0x2a2732); R(g, 98, 10, 3, 4, 0x777079);
}
function drawCoffin(g: G): void {
    R(g, 12, 80, 120, 12, 0x05070e, .38);
    R(g, 18, 30, 102, 53, 0x11151d);
    R(g, 25, 22, 90, 54, 0x4d4954);
    R(g, 30, 17, 78, 6, 0x857b85);
    R(g, 28, 28, 84, 43, 0x292633);
    R(g, 33, 32, 74, 3, 0x61576a);
    for (const [x, y] of [[35, 36], [101, 36], [35, 64], [101, 64]]) R(g, x, y, 4, 4, 0xb09b80);
    // Techno-gothic sarcophagus sigil, not a simple box.
    R(g, 67, 37, 3, 28, 0x92687e); R(g, 57, 46, 22, 3, 0x92687e);
    R(g, 63, 40, 9, 3, 0xd4b6b5); R(g, 65, 57, 5, 3, 0xd4b6b5);
    R(g, 36, 71, 70, 3, 0x15131c);
}
function drawCrate(g: G): void {
    R(g, 15, 78, 114, 15, 0x04060b, .38);
    R(g, 20, 31, 100, 52, 0x241d23);
    R(g, 23, 25, 94, 54, 0x58464a);
    R(g, 29, 32, 82, 38, 0x332c35);
    R(g, 24, 25, 93, 6, 0x9a7770);
    R(g, 28, 73, 84, 5, 0x161b25);
    R(g, 37, 35, 5, 35, 0x907774); R(g, 96, 35, 5, 35, 0x907774);
    R(g, 43, 46, 53, 4, 0x5b4e57); R(g, 64, 38, 4, 30, 0xa34a59);
    for (const x of [29, 109]) for (const y of [31, 70]) R(g, x, y, 4, 3, 0xd1ac87);
}
function drawRack(g: G): void {
    R(g, 11, 111, 122, 10, 0x02040a, .42);
    R(g, 18, 24, 110, 10, 0x2c2b36); R(g, 23, 31, 100, 80, 0x302b33);
    R(g, 28, 15, 88, 13, 0x6f5960);
    R(g, 30, 19, 84, 3, 0xa28b84);
    for (const x of [40, 62, 84, 106]) {
        R(g, x, 34, 4, 65, 0xc1afb1);
        R(g, x - 6, 44, 16, 4, 0xa94b59);
        R(g, x + 1, 31, 2, 8, 0xf6d7cc);
        R(g, x - 2, 97, 9, 7, 0x6e5b60);
    }
    R(g, 20, 105, 105, 7, 0x0d111a);
}
function drawDesk(g: G): void {
    R(g, 15, 88, 114, 11, 0x05070c, .35);
    R(g, 18, 57, 103, 35, 0x191a25);
    R(g, 23, 34, 94, 45, 0x493942);
    R(g, 17, 28, 107, 11, 0x8a6a67);
    R(g, 24, 26, 93, 3, 0xc4a29a);
    R(g, 33, 38, 40, 24, 0x171f2b); R(g, 37, 41, 33, 15, 0x40495e);
    R(g, 45, 45, 14, 5, 0xa04458); R(g, 34, 65, 75, 4, 0x1e1e28);
    for (const x of [28, 108]) R(g, x, 77, 7, 18, 0x25232c);
    R(g, 81, 42, 22, 3, 0xa18d81); R(g, 81, 48, 17, 2, 0x8e8178);
}
function drawBookcase(g: G): void {
    R(g, 9, 118, 124, 11, 0x030508, .43);
    R(g, 17, 8, 112, 112, 0x1a1926);
    R(g, 23, 12, 100, 100, 0x604852);
    R(g, 28, 17, 90, 92, 0x161a26);
    const shades = [0x8b5579, 0x504b71, 0x7d696e, 0x524c5b, 0x9d7771];
    for (let row = 0; row < 3; row++) {
        R(g, 28, 38 + row * 28, 90, 4, 0x977c7a);
        for (let i = 0; i < 11; i++) {
            const x = 31 + i * 8, h = 15 + ((row * 7 + i * 3) % 9);
            R(g, x, 37 + row * 28 - h, 5 + (i % 3), h, shades[(row * 2 + i) % shades.length]);
            if (i % 3 === 1) R(g, x + 1, 37 + row * 28 - h + 3, 2, 2, 0xd4b4ad, .52);
        }
    }
    R(g, 19, 8, 109, 5, 0xb28f89); R(g, 21, 112, 109, 7, 0x241e28);
}
function drawMachine(g: G): void {
    R(g, 12, 117, 124, 16, 0x05050a, .52);
    R(g, 20, 46, 112, 73, 0x2b2930);
    R(g, 23, 37, 104, 70, 0x59505a);
    R(g, 32, 29, 86, 10, 0x89757b);
    R(g, 35, 45, 81, 48, 0x1b1c28);
    for (const x of [46, 74, 102]) {
        R(g, x, 51, 18, 31, 0x6d383b);
        R(g, x + 4, 55, 11, 24, 0xe06e45);
        R(g, x + 6, 60, 7, 12, 0xffbb66);
    }
    R(g, 23, 96, 104, 7, 0x272733);
    for (const x of [31, 60, 89, 116]) { R(g, x, 101, 4, 9, 0x9e8986); R(g, x + 1, 110, 3, 5, 0x161820); }
    R(g, 40, 20, 8, 25, 0x50434b); R(g, 99, 17, 8, 28, 0x50434b);
}
function drawConduit(g: G): void {
    R(g, 10, 125, 131, 12, 0x03040a, .5);
    R(g, 19, 40, 115, 90, 0x17131d);
    R(g, 27, 34, 101, 88, 0x5a3f55);
    R(g, 32, 28, 91, 10, 0xb35c70);
    R(g, 35, 43, 85, 70, 0x241b2c);
    for (const x of [47, 109]) { R(g, x, 47, 7, 62, 0x6f536b); R(g, x + 2, 50, 2, 52, 0xe46b7c, .6); }
    pixDisc(g, 78, 73, 28, 29, 0x502941);
    pixDisc(g, 78, 73, 22, 24, 0xa53c61);
    pixDisc(g, 78, 73, 17, 20, 0x371b36);
    R(g, 74, 48, 8, 51, 0xff7996, .58); R(g, 57, 69, 43, 8, 0xff7996, .46);
    R(g, 33, 118, 91, 7, 0x16151f);
}
function drawStatue(g: G): void {
    R(g, 19, 127, 125, 11, 0x02050a, .55);
    R(g, 32, 105, 92, 22, 0x302a33);
    R(g, 28, 100, 98, 10, 0x78707a);
    R(g, 47, 51, 60, 51, 0x59505e);
    R(g, 38, 56, 18, 37, 0x726776); R(g, 98, 60, 16, 34, 0x3c3447);
    R(g, 56, 23, 42, 36, 0x7d717d);
    R(g, 50, 17, 51, 13, 0x4f485b);
    R(g, 69, 36, 18, 7, 0x262435);
    R(g, 73, 36, 4, 3, 0xc95e74); R(g, 84, 36, 4, 3, 0xc95e74);
    R(g, 39, 94, 78, 8, 0x211d29);
    R(g, 49, 14, 11, 7, 0x9b8c98); R(g, 99, 50, 11, 4, 0x252330);
}
function drawWallDecal(g: G, kind: "chain" | "banner" | "vent" | "sigil"): void {
    if (kind === "chain") {
        R(g, 28, 0, 5, 10, 0x938b89);
        for (let i = 0; i < 7; i++) {
            const x = 28 + (i % 2) * 3, y = 9 + i * 10;
            R(g, x, y, 4, 9, 0x6c7079); R(g, x + 1, y + 2, 2, 5, 0x242832);
        }
    } else if (kind === "banner") {
        R(g, 2, 4, 58, 5, 0x77717b); R(g, 6, 10, 50, 48, 0x5c2437);
        R(g, 9, 13, 44, 42, 0x8d344c); R(g, 14, 19, 34, 1, 0xc67175);
        R(g, 29, 23, 5, 26, 0xd9a9a3); R(g, 19, 31, 25, 5, 0xd9a9a3);
        for (let i = 0; i < 15; i += 3) R(g, 9 + i, 55 + i / 3, 5, 4, 0x432035);
    } else if (kind === "vent") {
        R(g, 4, 6, 60, 34, 0x141821); R(g, 8, 8, 52, 26, 0x575761);
        for (let y = 14; y < 32; y += 5) R(g, 12, y, 44, 2, 0x171b25);
        for (const x of [10, 56]) R(g, x, 11, 2, 3, 0xba908b);
    } else {
        pixDisc(g, 32, 32, 25, 25, 0x3d203b, .8);
        pixDisc(g, 32, 32, 19, 19, 0x8d3356, .75);
        pixDisc(g, 32, 32, 13, 13, 0x201b2f);
        R(g, 29, 12, 6, 40, 0xd45d78); R(g, 12, 29, 40, 6, 0xd45d78);
        R(g, 31, 18, 2, 28, 0xff9ea6);
    }
}
function drawTorch(g: G, variant: "ember" | "violet" | "crimson"): void {
    const hot = variant === "ember" ? 0xffac68 : variant === "violet" ? 0xca9bff : 0xff758d;
    const core = variant === "ember" ? 0xffe6a1 : variant === "violet" ? 0xe8d6ff : 0xffd5bd;
    R(g, 19, 48, 12, 7, 0x1c2029); R(g, 16, 46, 18, 5, 0x72707a);
    R(g, 20, 38, 10, 9, 0x372935);
    pixDisc(g, 25, 25, 8, 17, hot, .95);
    pixDisc(g, 25, 27, 4, 11, core);
    R(g, 23, 9, 4, 10, hot);
    R(g, 12, 20, 3, 4, hot, .55); R(g, 35, 15, 3, 4, hot, .42);
}

/** All immutable texture keys are cached globally; no per-seed GPU texture leaks. */
export function ensureNullCitadelArt(scene: Phaser.Scene): void {
    for (const biome of Object.keys(NULL_PALETTE) as DungeonBiome[])
        for (let variant = 0; variant < 3; variant++)
            bake(scene, `floor-${biome}-${variant}`, 192, 192, (g) => paintFloor(g, biome, variant));
    const props: Array<[string, number, number, (g: G) => void]> = [
        ["pillar", 150, 145, drawPillar], ["coffin", 144, 96, drawCoffin],
        ["crate", 144, 102, drawCrate], ["rack", 148, 125, drawRack],
        ["desk", 144, 105, drawDesk], ["bookcase", 145, 130, drawBookcase],
        ["machine", 150, 140, drawMachine], ["conduit", 158, 143, drawConduit],
        ["statue", 154, 143, drawStatue],
    ];
    for (const [name, w, h, draw] of props) bake(scene, `prop-${name}`, w, h, draw);
    for (const k of ["banner", "chain", "vent", "sigil"] as const)
        bake(scene, `ornament-${k}`, 68, k === "chain" ? 83 : 70, (g) => drawWallDecal(g, k));
    for (const v of ["ember", "violet", "crimson"] as const)
        bake(scene, `torch-${v}`, 50, 60, (g) => drawTorch(g, v));
    if (!scene.textures.exists(artKey("glow"))) {
        const canvas = scene.textures.createCanvas(artKey("glow"), 160, 160);
        if (!canvas) throw new Error("Null Citadel gradient texture could not be created");
        const ctx = canvas.getContext();
        const gradient = ctx.createRadialGradient(80, 80, 0, 80, 80, 80);
        gradient.addColorStop(0, "rgba(255,255,255,0.9)");
        gradient.addColorStop(.25, "rgba(255,255,255,0.42)");
        gradient.addColorStop(.65, "rgba(255,255,255,0.10)");
        gradient.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 160, 160);
        canvas.refresh();
    }
    if (!scene.textures.exists(artKey("shadow"))) {
        const canvas = scene.textures.createCanvas(artKey("shadow"), 160, 160);
        if (!canvas) throw new Error("Null Citadel corner shadow could not be created");
        const ctx = canvas.getContext();
        const gradient = ctx.createRadialGradient(80, 80, 0, 80, 80, 80);
        gradient.addColorStop(0, "rgba(4,3,9,0.35)");
        gradient.addColorStop(.75, "rgba(4,3,9,0.14)");
        gradient.addColorStop(1, "rgba(4,3,9,0)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 160, 160);
        canvas.refresh();
    }
}

export function selectNullProp(biome: DungeonBiome, style: number, variant: number): string {
    if (style === 2) return biome === "crypt" ? (variant ? "statue" : "pillar") :
        biome === "sanctum" ? (variant ? "conduit" : "pillar") : "pillar";
    if (style === 1) return biome === "library" ? "bookcase" :
        biome === "foundry" ? "machine" : biome === "barracks" ? "rack" :
        biome === "sanctum" ? "conduit" : "coffin";
    return biome === "crypt" ? "coffin" : biome === "barracks" ? "rack" :
        biome === "library" ? "desk" : biome === "foundry" ? "machine" : "conduit";
}
