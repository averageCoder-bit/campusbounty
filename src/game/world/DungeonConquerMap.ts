import * as Phaser from "phaser";
import {
    DUNGEON, buildDungeonLayout, dungeonRng,
    type DungeonLayout, type DungeonRect, type DungeonRoom, type DungeonBiome,
} from "./DungeonLayout";
import {
    R, pixDisc, artKey, ensureNullCitadelArt,
    NULL_PALETTE, selectNullProp,
} from "./NullCitadelArt";

/** G4.4 Null Citadel environment. Public world contract is retained for DungeonConquer.ts. */
export interface DungeonTorch {
    glow: Phaser.GameObjects.Image;
    flame: Phaser.GameObjects.Image;
    phase: number;
}
export interface DungeonWorld {
    layout: DungeonLayout;
    blockers: Phaser.Physics.Arcade.StaticGroup;
    obstacles: Phaser.Geom.Rectangle[];
    torches: DungeonTorch[];
}
type G = Phaser.GameObjects.Graphics;
const BG = 0x090a10;
const rnd = (r: () => number, min: number, max: number): number => min + Math.floor(r() * (max - min + 1));

function stroke(g: G, x: number, y: number, width: number, height: number, color: number, alpha = 1): void {
    R(g, x, y, width, 2, color, alpha);
    R(g, x, y + height - 2, width, 2, color, alpha);
    R(g, x, y, 2, height, color, alpha);
    R(g, x + width - 2, y, 2, height, color, alpha);
}
function noiseCracks(g: G, x: number, y: number, w: number, h: number, rng: () => number, count: number, color: number): void {
    for (let i = 0; i < count; i++) {
        const cx = rnd(rng, Math.ceil(x + 18), Math.floor(x + w - 20));
        const cy = rnd(rng, Math.ceil(y + 18), Math.floor(y + h - 20));
        R(g, cx, cy, 2, 7, color, .25);
        R(g, cx + 2, cy + 6, 9, 2, color, .22);
        if (rng() > .45) R(g, cx + 10, cy + 8, 2, 7, color, .21);
        if (rng() > .75) R(g, cx - 2, cy + 12, 2, 2, 0x776b74, .20);
    }
}
function sigil(g: G, cx: number, cy: number, radius: number, accent: number): void {
    // Stepped concentric circles and angular circuitry: seeded geometry, not giant UI circles.
    for (let i = 0; i < 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        const r = radius + (i % 8 === 0 ? 6 : 0);
        R(g, cx + Math.cos(a) * r, cy + Math.sin(a) * r, i % 8 === 0 ? 6 : 3, 3, accent, i % 8 === 0 ? .6 : .30);
        const r2 = radius - 20;
        if (i % 2 === 0) R(g, cx + Math.cos(a) * r2, cy + Math.sin(a) * r2, 3, 2, accent, .30);
    }
    for (let i = 0; i < 4; i++) {
        const a = Math.PI * i / 2;
        const x = cx + Math.cos(a) * (radius - 30);
        const y = cy + Math.sin(a) * (radius - 30);
        R(g, x - 5, y - 5, 11, 11, 0x07070f);
        R(g, x - 3, y - 3, 7, 7, accent, .65);
    }
    R(g, cx - 23, cy - 2, 46, 4, accent, .22);
    R(g, cx - 2, cy - 23, 4, 46, accent, .30);
    R(g, cx - 6, cy - 6, 12, 12, accent, .55);
}

function drawBrickWall(g: G, x: number, y: number, w: number, h: number, room: DungeonRoom, rng: () => number, vertical = false): void {
    const pal = NULL_PALETTE[room.biome];
    R(g, x + 4, y + 11, w + 8, h + 8, 0x04050b, .43);
    R(g, x, y, w, h, pal.wall);
    const brickW = vertical ? 19 : 32;
    const brickH = vertical ? 18 : 10;
    for (let iy = 0; iy < h; iy += brickH) {
        const off = (iy / brickH) % 2 ? Math.floor(brickW / 2) : 0;
        for (let ix = -off; ix < w; ix += brickW) {
            const bx = Math.max(1, ix), bw = Math.min(w - 2, ix + brickW - 2) - bx;
            if (bw < 3) continue;
            R(g, x + bx, y + iy + 1, bw, Math.min(brickH - 2, h - iy - 1), rng() > .65 ? pal.brick : pal.wall);
            R(g, x + bx + 1, y + iy + 2, Math.max(2, bw - 3), 1, pal.edge, .09);
        }
    }
    if (!vertical) {
        R(g, x, y, w, 3, pal.edge, .50);
        R(g, x, y + h - 4, w, 4, 0x090b14, .9);
        R(g, x + 1, y + h - 8, w - 2, 2, pal.accent, .24);
        for (let i = 25; i < w - 15; i += 43) R(g, x + i, y + h - 10, 3, 3, pal.edge, .44);
    } else {
        R(g, x + w - 4, y, 4, h, 0x080a12, .75);
        R(g, x + 2, y, 3, h, pal.edge, .36);
    }
}

/** Room geometry stays exactly where G4.3 placed it; decorate around openings. */
function roomWalls(g: G, room: DungeonRoom, rng: () => number): void {
    const pal = NULL_PALETTE[room.biome], t = 24, opening = 106;
    const n = room.connections.includes(room.id - DUNGEON.columns);
    const s = room.connections.includes(room.id + DUNGEON.columns);
    const w = room.col > 0 && room.connections.includes(room.id - 1);
    const e = room.col < DUNGEON.columns - 1 && room.connections.includes(room.id + 1);
    const hx = (y: number, open: boolean): void => {
        if (open) {
            drawBrickWall(g, room.x - 13, y, room.cx - opening - room.x + 13, t, room, rng);
            drawBrickWall(g, room.cx + opening, y, room.x + room.width - room.cx - opening + 13, t, room, rng);
            R(g, room.cx - opening - 10, y - 8, 10, t + 16, pal.edge);
            R(g, room.cx + opening, y - 8, 10, t + 16, pal.edge);
            R(g, room.cx - opening + 4, y + t - 2, opening * 2 - 8, 2, pal.accent, .38);
        } else drawBrickWall(g, room.x - 13, y, room.width + 26, t, room, rng);
    };
    const vx = (x: number, open: boolean): void => {
        if (open) {
            drawBrickWall(g, x, room.y, t, room.cy - opening - room.y, room, rng, true);
            drawBrickWall(g, x, room.cy + opening, t, room.y + room.height - room.cy - opening, room, rng, true);
            R(g, x - 3, room.cy - opening - 8, t + 6, 8, pal.edge);
            R(g, x - 3, room.cy + opening, t + 6, 8, pal.edge);
        } else drawBrickWall(g, x, room.y, t, room.height, room, rng, true);
    };
    hx(room.y - 13, n);
    hx(room.y + room.height - 11, s);
    vx(room.x - 13, w);
    vx(room.x + room.width - 11, e);
    // Contact shadow: depth along wall base, not a uniform flat overlay.
    R(g, room.x + 16, room.y + 14, room.width - 32, 6, 0x02040b, .31);
    R(g, room.x + 16, room.y + 20, room.width - 32, 4, 0x02040b, .16);
    R(g, room.x + 18, room.y + room.height - 22, room.width - 36, 5, 0x02040b, .24);
    for (const x of [room.x + 36, room.x + room.width - 56]) {
        R(g, x, room.y + 32, 17, 5, pal.edge, .28);
        R(g, x + 6, room.y + 38, 5, 12, pal.brick, .55);
    }
}

function floorLandmarks(g: G, room: DungeonRoom, rng: () => number): void {
    const p = NULL_PALETTE[room.biome];
    if (room.role === "boss") {
        sigil(g, room.cx, room.cy, 150, p.light);
        for (let i = 0; i < 8; i++) {
            const a = i / 8 * Math.PI * 2;
            const x = room.cx + Math.cos(a) * 180, y = room.cy + Math.sin(a) * 145;
            R(g, x - 8, y - 8, 16, 16, p.wall);
            R(g, x - 4, y - 4, 8, 8, p.accent, .68);
        }
    } else if (room.role === "seal") {
        sigil(g, room.cx, room.cy, 80, p.light);
    } else if (room.role === "entry") {
        sigil(g, room.cx, room.cy, 85, 0xbcb8a4);
        // First flame: sanctuary looks safer, but does not reuse the hall's teal and gold.
        R(g, room.cx - 35, room.cy + 94, 70, 4, 0xb7a19a, .3);
    } else if (room.role === "rest") {
        sigil(g, room.cx, room.cy, 60, 0xb7b0a8);
    } else if (room.role === "cache") {
        for (let i = 0; i < 4; i++) {
            R(g, room.cx - 44 + i * 24, room.cy - 25, 18, 52, 0x72515e, .32);
            R(g, room.cx - 41 + i * 24, room.cy - 22, 12, 46, 0x221e2c, .72);
        }
    } else {
        // Decorative fragments of long-dead rituals, not a prominent circular grid.
        if (rng() < .6) {
            const x = room.cx + rnd(rng, -90, 90), y = room.cy + rnd(rng, -70, 70);
            R(g, x, y, 42, 2, p.accent, .13);
            R(g, x + 19, y - 17, 2, 35, p.accent, .12);
        }
    }
    noiseCracks(g, room.x + 45, room.y + 45, room.width - 90, room.height - 90, rng, 9, p.seam);
    // Uneven rubble / exposed metal plates along the back and sides; keep corridors clear.
    for (let i = 0; i < 9; i++) {
        const x = room.x + 40 + rng() * (room.width - 80);
        const y = room.y + 43 + (i % 2 ? room.height - 86 : 0);
        R(g, x, y, 6 + rng() * 15, 3 + rng() * 5, rng() > .5 ? p.brick : p.edge, .32);
        R(g, x + 4, y - 2, 3, 1, p.glint, .4);
    }
}

function decorativeTexture(scene: Phaser.Scene, key: string, x: number, y: number, contactY: number, scale = 1): void {
    const sprite = scene.add.image(x, y, artKey(key)).setOrigin(.5, 1).setScale(scale);
    sprite.setDepth(contactY);
}

function placeOrnaments(scene: Phaser.Scene, room: DungeonRoom, rng: () => number): void {
    // Wall art is visual only. Its bottom aligns with the wall surface and does not create a collider.
    const ornament = room.biome === "barracks" ? "banner" :
        room.biome === "foundry" ? "vent" : room.biome === "sanctum" ? "sigil" :
        room.biome === "library" ? "chain" : "sigil";
    const positions = [room.x + 105, room.x + room.width - 105];
    for (const x of positions) {
        const y = room.y + 43;
        decorativeTexture(scene, `ornament-${ornament}`, x, y + 34, room.y + 55, .8);
    }
    if (rng() > .49) {
        const x = room.x + room.width * (.34 + rng() * .32);
        decorativeTexture(scene, "ornament-chain", x, room.y + 115, room.y + 95, 1);
    }
}

/**
 * The map generator's furniture colliders and placement rules are left intact;
 * only the art and lighting change, avoiding breaking the existing navigation grid.
 */
export function buildDungeonConquerMap(scene: Phaser.Scene, seed: number): DungeonWorld {
    const layout = buildDungeonLayout(seed);
    const rng = dungeonRng((seed >>> 0) ^ 0x1afe442);
    const blockers = scene.physics.add.staticGroup();
    const obstacles: Phaser.Geom.Rectangle[] = [];
    const torches: DungeonTorch[] = [];
    scene.physics.world.setBounds(0, 0, DUNGEON.width, DUNGEON.height);
    scene.cameras.main.setBackgroundColor("#080910");
    ensureNullCitadelArt(scene);

    const voidLayer = scene.add.graphics().setDepth(-1300);
    R(voidLayer, 0, 0, DUNGEON.width, DUNGEON.height, BG);
    // Corridor borders are underneath the tiled floors, not blocking traversable floor.
    for (const hall of layout.halls) {
        R(voidLayer, hall.x - 13, hall.y - 13, hall.width + 26, hall.height + 26, 0x03040a);
        R(voidLayer, hall.x - 4, hall.y - 4, hall.width + 8, hall.height + 8, 0x45404a, .43);
    }
    for (const room of layout.rooms) {
        R(voidLayer, room.x - 15, room.y - 15, room.width + 30, room.height + 30, 0x05060e);
        R(voidLayer, room.x - 7, room.y - 7, room.width + 14, room.height + 14, NULL_PALETTE[room.biome].edge, .33);
    }
    // TileSprite repeats a small baked graphic; no huge per-seed canvases or thousands of live 1px sprites.
    for (const hall of layout.halls) {
        scene.add.tileSprite(hall.x, hall.y, hall.width, hall.height, artKey("floor-crypt-1"))
            .setOrigin(0).setDepth(-1200).setAlpha(.85);
    }
    for (const room of layout.rooms) {
        const floorVar = rnd(rng, 0, 2);
        const tile = scene.add.tileSprite(room.x, room.y, room.width, room.height,
            artKey(`floor-${room.biome}-${floorVar}`)).setOrigin(0).setDepth(-1195);
        // Seed-dependent repeat offset changes floor character without making new textures.
        tile.tilePositionX = rnd(rng, 0, 190);
        tile.tilePositionY = rnd(rng, 0, 190);
    }
    const floorDetails = scene.add.graphics().setDepth(-1170);
    const wallLayer = scene.add.graphics().setDepth(-1150);
    // Decorated rooms; biome color, cracks, embedded motifs, real brick-wall courses.
    for (const room of layout.rooms) {
        floorLandmarks(floorDetails, room, rng);
        roomWalls(wallLayer, room, rng);
    }

    // Retain exactly the previous collision-footprint sizes and RNG corner selection.
    const solid = (x: number, y: number, w: number, h: number): void => {
        obstacles.push(new Phaser.Geom.Rectangle(x - w / 2, y - h / 2, w, h));
        const invisible = scene.add.rectangle(x, y, w, h, 0x000000, 0).setVisible(false);
        scene.physics.add.existing(invisible, true);
        blockers.add(invisible);
    };
    const prop = (x: number, y: number, style: number, damaged: boolean, biome: DungeonBiome): void => {
        const w = style === 2 ? 80 : 112, h = style === 2 ? 94 : 63;
        const type = selectNullProp(biome, style, damaged ? 1 : 0);
        // World contact and visual height differ: this is a genuine layered top-down object.
        const texture = scene.textures.get(artKey(`prop-${type}`));
        const image = scene.add.image(x, y + (h / 2) + 16, artKey(`prop-${type}`))
            .setOrigin(.5, 1).setDepth(y + h / 2 + 12);
        if (texture.source[0]?.width > 0) {
            const visualWidth = style === 2 ? 142 : 138;
            image.setScale(visualWidth / texture.source[0].width);
        }
        if (damaged) image.setTint(0xd4bfbc);
        solid(x, y + 5, w, h - 10);
    };

    for (const room of layout.rooms) {
        placeOrnaments(scene, room, rng);
        if (room.role !== "entry" && room.role !== "boss" && room.role !== "seal") {
            const corners: Array<[number, number]> = [
                [room.x + 132, room.y + 134],
                [room.x + room.width - 139, room.y + 131],
                [room.x + 137, room.y + room.height - 135],
                [room.x + room.width - 141, room.y + room.height - 139],
            ];
            const count = 2 + Math.floor(rng() * 2);
            for (let i = 0; i < count; i++) {
                const [px, py] = corners[(i + Math.floor(rng() * 2)) % 4];
                prop(px + (rng() - .5) * 24, py + (rng() - .5) * 22,
                    Math.floor(rng() * 3), rng() > .63, room.biome);
            }
        }
        // Object-specific ambient light: violet for crypt/library, ember for foundry,
        // crimson for the core. Each glow is an additive Canvas radial texture.
        const lightStyle = room.biome === "foundry" || room.biome === "barracks" ? "ember" :
            room.biome === "sanctum" ? "crimson" : "violet";
        const lightColor = NULL_PALETTE[room.biome].light;
        const stations: Array<[number, number]> = [
            [room.x + 75, room.y + 75],
            [room.x + room.width - 75, room.y + 75],
        ];
        if (room.role === "boss" || room.role === "seal" || room.role === "entry") {
            stations.push([room.x + 75, room.y + room.height - 75]);
            stations.push([room.x + room.width - 75, room.y + room.height - 75]);
        }
        for (const [x, y] of stations) {
            const glow = scene.add.image(x, y, artKey("glow"))
                .setTint(lightColor).setBlendMode(Phaser.BlendModes.ADD)
                .setScale(1.55).setAlpha(.28).setDepth(-900);
            const flame = scene.add.image(x, y + 2, artKey(`torch-${lightStyle}`))
                .setOrigin(.5, .87).setScale(.92).setDepth(y + 10);
            torches.push({ glow, flame, phase: rng() * Math.PI * 2 });
        }
        // Room title belongs to the architecture rather than a HUD label.
        const caption = `${String(room.id + 1).padStart(2, "0")} / ${room.title}`;
        scene.add.text(room.cx, room.y + 41, caption, {
            fontFamily: '"Press Start 2P", monospace', fontSize: "9px",
            color: room.biome === "foundry" ? "#A38C88" : "#8E8C98",
            stroke: "#080910", strokeThickness: 3,
        }).setOrigin(.5).setAlpha(.72).setDepth(-890);
        if (room.role === "rest" || room.role === "cache" || room.role === "seal") {
            const key = room.role === "rest" ? "prop-statue" :
                room.role === "cache" ? "prop-crate" : "prop-conduit";
            // Central interactable remains at the same room center (no new collider).
            // Render *behind* a player standing on its world-space base when appropriate.
            const image = scene.add.image(room.cx, room.cy + 35, artKey(key))
                .setOrigin(.5, 1).setScale(.78).setDepth(room.cy + 16);
            if (room.role === "rest") image.setTint(0xc4d4c5);
        }
        if (room.role === "boss") {
            // Make the rear wall unmistakably the core's sanctum without covering boss spawn.
            scene.add.image(room.cx, room.y + 190, artKey("prop-conduit"))
                .setOrigin(.5, 1).setScale(1.3).setDepth(room.y + 175);
            const glow = scene.add.image(room.cx, room.y + 110, artKey("glow"))
                .setTint(0xe64a6d).setBlendMode(Phaser.BlendModes.ADD)
                .setScale(3.3).setAlpha(.20).setDepth(-900);
            torches.push({ glow, flame: scene.add.image(room.cx, room.y + 98, artKey("torch-crimson"))
                .setOrigin(.5, 1).setDepth(room.y + 100), phase: rng() * Math.PI * 2 });
        }
    }
    // Sparse background dust; keeps the world alive without hundreds of animated objects.
    for (let i = 0; i < 36; i++) {
        const room = layout.rooms[i % layout.rooms.length];
        const x = room.x + 60 + rng() * (room.width - 120);
        const y = room.y + 60 + rng() * (room.height - 120);
        const mote = scene.add.rectangle(x, y, 2, 2, 0x9e92a0, .25).setDepth(-800);
        scene.tweens.add({ targets: mote, y: `-=${25 + Math.floor(rng() * 35)}`,
            alpha: { from: .03, to: .3 }, duration: 3200 + Math.floor(rng() * 3600),
            yoyo: true, repeat: -1, delay: Math.floor(rng() * 3300) });
    }
    return { layout, blockers, obstacles, torches };
}
