import * as Phaser from "phaser";
import {
    ART,
    ROOM_ART,
    ROOM_ART_OFFSET,
    Pen,
    paintRoom,
    paintCorridor,
    corridorGeometry,
    paintVoidTile,
    themeFor,
    type Paint,
    type RoomArtSpec,
} from "./QuestFindingArt";
import { paintFurniture, paintStation, furnitureForTheme, STATION_SIZES, type FurnitureKind } from "./QuestFindingObjects";
import {
    buildQuestCases,
    SeededRandom,
    type CaseSet,
    type DistrictId,
} from "../data/QuestFindingCases";
export type { DistrictId } from "../data/QuestFindingCases";

export type InteractableKind =
    | "evidence"
    | "terminal"
    | "vault"
    | "beacon"
    | "sign"
    | "decoy";
export interface ArchiveInteractable {
    id: string;
    kind: InteractableKind;
    district?: DistrictId;
    x: number;
    y: number;
    title: string;
    body?: string;
}
export interface WalkableArea {
    id: string;
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    floor: number;
    sector?: string;
}
export interface WispSpawn {
    x: number;
    y: number;
    toX: number;
    toY: number;
}
export interface FlickerLight {
    glow: Phaser.GameObjects.Ellipse;
    bulb: Phaser.GameObjects.Rectangle;
    phase: number;
    unstable: boolean;
}
export interface QuestFindingWorld {
    blockers: Phaser.Physics.Arcade.StaticGroup;
    obstacles: Phaser.Geom.Rectangle[];
    wisps: WispSpawn[];
    lights: FlickerLight[];
    cases: CaseSet;
}

/** 2.5x the old width and height; area is 6.25x the original. */
export const ARCHIVE: {
    width: number;
    height: number;
    spawn: { x: number; y: number };
    vault: { x: number; y: number };
    seed: number;
    districts: Record<
        DistrictId,
        { name: string; digit: string; terminal: string; sector: string }
    >;
} = {
    width: 6400,
    height: 4480,
    seed: 0,
    spawn: { x: 2580, y: 3610 },
    vault: { x: 0, y: 0 },
    districts: {
        source: {
            name: "PHISHING ARCHIVE",
            digit: "0",
            terminal: "source-terminal",
            sector: "",
        },
        approval: {
            name: "APPROVAL DEPARTMENT",
            digit: "0",
            terminal: "approval-terminal",
            sector: "",
        },
        recovery: {
            name: "RECOVERY RECORDS",
            digit: "0",
            terminal: "recovery-terminal",
            sector: "",
        },
    },
};
export const WALKABLE: WalkableArea[] = [];
export const INTERACTABLES: ArchiveInteractable[] = [];
const COLS = 6,
    ROWS = 4;
const ROOM_W = 800,
    ROOM_H = 720,
    GAP_X = 1000,
    GAP_Y = 1000;
const ROOM_X0 = 180,
    ROOM_Y0 = 250;
const START = 20; // bottom row, third column
interface Module {
    index: number;
    c: number;
    r: number;
    sector: string;
    cx: number;
    cy: number;
    x: number;
    y: number;
    title: string;
    floor: number;
}
let modules: Module[] = [];
let links: Array<[number, number]> = [];
const otherNames = [
    "FINANCE RECORDS",
    "HUMAN RESOURCES",
    "EXECUTIVE FLOOR",
    "COMPLIANCE OFFICE",
    "RECEPTION",
    "BROKEN CAFETERIA",
    "MAILROOM",
    "SERVER ROOM",
    "SECURITY DESK",
    "DATA CENTER",
    "ADMINISTRATIVE BAY",
    "AUDIT STORAGE",
    "FLOODED WORKSPACE",
    "LEGAL SERVICES",
    "SUPPLY ANNEX",
    "BACKUP ARCHIVES",
    "BOARDROOM",
    "NETWORK OPERATIONS",
    "MAINTENANCE",
    "POWER CONTROL",
    "PAYROLL OFFICE",
    "EVACUATION HALL",
    "TRAINING ROOM",
    "OLD IT WORKSHOP",
];
const floors = [0x142338, 0x192a3b, 0x182a35, 0x202737, 0x132c39, 0x242b38];
const sector = (i: number) =>
    `${String.fromCharCode(65 + (i % COLS))}${Math.floor(i / COLS) + 1}`;
const mid = (i: number) => ({
    x: ROOM_X0 + (i % COLS) * GAP_X + ROOM_W / 2,
    y: ROOM_Y0 + Math.floor(i / COLS) * GAP_Y + ROOM_H / 2,
});

export function prepareArchive(seed: number): CaseSet {
    const fixed = seed >>> 0 || 1;
    const rng = new SeededRandom(fixed);
    const cases = buildQuestCases(fixed);
    ARCHIVE.seed = fixed;
    WALKABLE.length = 0;
    INTERACTABLES.length = 0;
    const names = rng.shuffle(otherNames);
    modules = Array.from({ length: COLS * ROWS }, (_, index) => {
        const c = index % COLS,
            r = Math.floor(index / COLS);
        const x = ROOM_X0 + c * GAP_X,
            y = ROOM_Y0 + r * GAP_Y;
        return {
            index,
            c,
            r,
            x,
            y,
            cx: x + ROOM_W / 2,
            cy: y + ROOM_H / 2,
            sector: sector(index),
            title: names[index % names.length],
            floor: rng.pick(floors),
        };
    });
    const sourceIdx = rng.pick([6, 12, 13]);
    const approvalIdx = rng.pick([10, 11, 17]);
    const recoveryIdx = rng.pick([0, 1, 2]);
    const vaultIdx = rng.pick([3, 4, 5]);
    const beaconIdx = rng.pick([8, 9, 14, 15]);
    const special: Record<DistrictId, number> = {
        source: sourceIdx,
        approval: approvalIdx,
        recovery: recoveryIdx,
    };
    for (const key of ["source", "approval", "recovery"] as const) {
        const room = modules[special[key]];
        room.title = ARCHIVE.districts[key].name;
        room.floor =
            key === "recovery"
                ? 0x183337
                : key === "source"
                  ? 0x282334
                  : 0x1d2837;
        ARCHIVE.districts[key].digit = String(rng.int(1, 9));
        ARCHIVE.districts[key].sector = room.sector;
    }
    modules[vaultIdx].title = "EXECUTIVE CIPHER VAULT";
    modules[vaultIdx].floor = 0x11283b;
    modules[beaconIdx].title = "EMERGENCY POWER STATION";
    modules[beaconIdx].floor = 0x1a353c;
    modules[START].title = "ABANDONED RECEPTION";
    const origin = mid(START);
    ARCHIVE.spawn.x = origin.x;
    ARCHIVE.spawn.y = origin.y + 135;
    const vault = mid(vaultIdx);
    ARCHIVE.vault.x = vault.x;
    ARCHIVE.vault.y = vault.y - 105;

    // Seeded depth-first spanning tree: every room has a guaranteed route.
    const neighbors = (i: number) => {
        const c = i % COLS,
            r = Math.floor(i / COLS);
        return [
            c > 0 ? i - 1 : -1,
            c < COLS - 1 ? i + 1 : -1,
            r > 0 ? i - COLS : -1,
            r < ROWS - 1 ? i + COLS : -1,
        ].filter((n) => n >= 0);
    };
    const seen = new Set([START]);
    const stack = [START];
    const keys = new Set<string>();
    const addLink = (a: number, b: number) => {
        const k = [a, b].sort((m, n) => m - n).join(":");
        if (keys.has(k)) return;
        keys.add(k);
        links.push([a, b]);
    };
    links = [];
    while (stack.length) {
        const at = stack[stack.length - 1];
        const choices = rng.shuffle(neighbors(at).filter((n) => !seen.has(n)));
        if (!choices.length) {
            stack.pop();
            continue;
        }
        const next = choices[0];
        seen.add(next);
        addLink(at, next);
        stack.push(next);
    }
    const extra = rng.shuffle(
        modules.flatMap((m) =>
            neighbors(m.index)
                .filter((n) => n > m.index)
                .map((n) => [m.index, n] as [number, number]),
        ),
    );
    for (const [a, b] of extra.slice(0, 10)) addLink(a, b);

    for (const m of modules)
        WALKABLE.push({
            id: `room-${m.index}`,
            name: m.title,
            sector: m.sector,
            x: m.x,
            y: m.y,
            width: ROOM_W,
            height: ROOM_H,
            floor: m.floor,
        });
    links.forEach(([a, b], idx) => {
        const A = modules[a],
            B = modules[b];
        if (A.r === B.r) {
            const left = A.x < B.x ? A : B;
            WALKABLE.push({
                id: `corridor-${idx}`,
                name: "CROSS-FLOOR CONNECTOR",
                x: left.x + ROOM_W - 20,
                y: left.cy - 112,
                width: GAP_X - ROOM_W + 40,
                height: 224,
                floor: 0x142635,
            });
        } else {
            const upper = A.y < B.y ? A : B;
            WALKABLE.push({
                id: `corridor-${idx}`,
                name: "STAIRWELL CONNECTOR",
                x: upper.cx - 112,
                y: upper.y + ROOM_H - 20,
                width: 224,
                height: GAP_Y - ROOM_H + 40,
                floor: 0x142635,
            });
        }
    });
    for (const key of ["source", "approval", "recovery"] as const) {
        const m = modules[special[key]];
        const positions: Array<[number, number]> = [
            [m.cx - 205, m.cy - 165],
            [m.cx + 205, m.cy - 165],
            [m.cx - 205, m.cy + 165],
        ];
        const records = cases.evidence[key];
        records.forEach((record, i) =>
            INTERACTABLES.push({
                id: `${key}-record-${i}`,
                kind: "evidence",
                district: key,
                x: positions[i][0],
                y: positions[i][1],
                title: record.title,
                body: record.body,
            }),
        );
        INTERACTABLES.push({
            id: `${key}-terminal`,
            kind: "terminal",
            district: key,
            x: m.cx + 195,
            y: m.cy + 164,
            title: `${key.toUpperCase()} TERMINAL`,
        });
    }
    INTERACTABLES.push({
        id: "vault",
        kind: "vault",
        x: vault.x,
        y: vault.y,
        title: "EXECUTIVE CIPHER VAULT",
    });
    const power = mid(beaconIdx);
    INTERACTABLES.push({
        id: "beacon",
        kind: "beacon",
        x: power.x + 170,
        y: power.y - 100,
        title: "EMERGENCY AID",
    });
    INTERACTABLES.push({
        id: "sign",
        kind: "sign",
        x: origin.x,
        y: origin.y - 135,
        title: "EVACUATION DIRECTORY",
        body: `ABANDONED CAMPUSBounty HQ. Randomized floor plan: SEED ${fixed}. Locate three case files in each department and complete TWO reasoning checks. DEPARTMENTS: PHISHING ARCHIVE ${modules[sourceIdx].sector}, APPROVAL ${modules[approvalIdx].sector}, RECOVERY ${modules[recoveryIdx].sector}. EXECUTIVE VAULT ${modules[vaultIdx].sector}. Use the field journal (J) to track findings. Never enter any real wallet secrets.`,
    });
    // More discoverable floor notes and misleading but inspectable incident records.
    for (const i of rng.shuffle(modules.map((m) => m.index)).slice(0, 9)) {
        if (
            [
                sourceIdx,
                approvalIdx,
                recoveryIdx,
                vaultIdx,
                beaconIdx,
                START,
            ].includes(i)
        )
            continue;
        const m = modules[i];
        INTERACTABLES.push({
            id: `memo-${i}`,
            kind: "decoy",
            x: m.cx + 180,
            y: m.cy - 144,
            title: "ABANDONED MEMO",
            body: rng.pick([
                "This workstation was abandoned during the credentials incident. Follow the sector signage to the investigation departments.",
                "NOTICE: Never approve an unknown smart contract solely because it offers rewards. Check addresses and permissions.",
                "Employees left their records in three departments. These optional memos contain context, not cipher fragments.",
            ]),
        });
    }
    return cases;
}

/** Logical walkability (independent of visual render, so seeds are reproducible). */
export function isArchiveWalkable(x: number, y: number): boolean {
    return WALKABLE.some(
        (a) =>
            x >= a.x + 8 &&
            x <= a.x + a.width - 8 &&
            y >= a.y + 8 &&
            y <= a.y + a.height - 8,
    );
}

/**
 * Bake detailed, seeded art into a small canvas texture once per room/corridor.
 * The canvas grid is the same 3-world-pixel grid used by the player sprite.
 * Art does NOT advance the gameplay RNG or add physical colliders.
 */
function bakeArt(
    scene: Phaser.Scene,
    key: string,
    width: number,
    height: number,
    seed: number,
    draw: (pen: Pen) => void,
): string {
    // Fixed keys keep repeated/replayed expeditions from accumulating GPU textures.
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const texture = scene.textures.createCanvas(key, width, height);
    if (!texture) throw new Error(`Cannot create Quest Finding texture: ${key}`);
    const ctx = texture.context;
    ctx.imageSmoothingEnabled = false;
    const styleCache = new Map<string, string>();
    const paint: Paint = {
        rect(x, y, w, h, color, alpha = 1) {
            const a = Math.max(0, Math.min(1, alpha));
            if (a <= 0 || w <= 0 || h <= 0) return;
            const colorKey = `${color}:${a}`;
            let css = styleCache.get(colorKey);
            if (!css) {
                css = `rgba(${(color >> 16) & 255},${(color >> 8) & 255},${color & 255},${a})`;
                styleCache.set(colorKey, css);
            }
            ctx.fillStyle = css;
            ctx.fillRect(x, y, w, h);
        },
    };
    draw(new Pen(paint, width, height, seed));
    texture.refresh();
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    return key;
}

function doorsFor(moduleIndex: number): RoomArtSpec["doors"] {
    const here = modules[moduleIndex];
    const result = { n: false, s: false, e: false, w: false };
    for (const [a, b] of links) {
        const otherIndex = a === moduleIndex ? b : b === moduleIndex ? a : -1;
        if (otherIndex < 0) continue;
        const other = modules[otherIndex];
        if (other.r < here.r) result.n = true;
        if (other.r > here.r) result.s = true;
        if (other.c > here.c) result.e = true;
        if (other.c < here.c) result.w = true;
    }
    return result;
}

/**
 * The previous flat-floor renderer advanced this RNG before placing props.
 * Keeping those draws preserves the established seeded prop/drone locations
 * across the purely visual upgrade, without letting the new art consume them.
 */
function consumeLegacyFloorRolls(rng: SeededRandom, area: WalkableArea): void {
    const { x, y, width: w, height: h } = area;
    for (let yy = y + 15; yy < y + h - 25; yy += 82) {
        for (let xx = x + 15; xx < x + w - 25; xx += 82) {
            rng.pick([area.floor, 0x1a2e3d, 0x1c2a36, 0x1b2533]);
            rng.next();
            if (rng.next() < 0.1) {
                rng.int(12, 60);
                rng.int(11, 60);
            }
        }
    }
}

export function buildQuestFindingMap(
    scene: Phaser.Scene,
    seed: number,
): QuestFindingWorld {
    const cases = prepareArchive(seed);
    scene.cameras.main.setBackgroundColor("#020509");
    scene.physics.world.setBounds(0, 0, ARCHIVE.width, ARCHIVE.height);
    const blockers = scene.physics.add.staticGroup();
    const obstacles: Phaser.Geom.Rectangle[] = [];
    const lights: FlickerLight[] = [];
    const rng = new SeededRandom(ARCHIVE.seed ^ 0xa7774);

    // Reuse one tiny void texture across ordinary images. Avoid a 6400x4480
    // TileSprite: Phaser warns that world-sized TileSprites waste GPU memory.
    const voidSize = 128; // power-of-two texture for crisp pixel rendering
    const voidWorld = voidSize * ART;
    const voidKey = bakeArt(scene, "cb-qf-v2-void", voidSize, voidSize,
        ARCHIVE.seed ^ 0x41a3c5, (pen) => paintVoidTile(pen));
    for (let y = 0; y < ARCHIVE.height; y += voidWorld) {
        for (let x = 0; x < ARCHIVE.width; x += voidWorld) {
            scene.add.image(x, y, voidKey)
                .setOrigin(0, 0).setScale(ART).setDepth(-1200);
        }
    }

    // Bake connectors first, then rooms. Each room's doors are derived from
    // the SAME seeded links that produce the logical walkable corridor union.
    const corridors = WALKABLE.filter((a) => a.id.startsWith("corridor"));
    for (let i = 0; i < corridors.length; i++) {
        const area = corridors[i];
        const horizontal = area.width > area.height;
        const geom = corridorGeometry(area.width, area.height, horizontal);
        const artSeed = (ARCHIVE.seed ^ Math.imul(i + 1, 0x9e3779b1)) >>> 0;
        const key = bakeArt(scene, `cb-qf-v2-corridor-${i}`, geom.aw, geom.ah,
            artSeed, (pen) => paintCorridor(pen, geom, {
                horizontal, seed: artSeed, stair: !horizontal,
            }));
        scene.add.image(area.x - geom.fx * ART, area.y - geom.fy * ART, key)
            .setOrigin(0, 0).setScale(ART).setDepth(-1100);
    }
    for (const room of modules) {
        const artSeed = (ARCHIVE.seed ^ Math.imul(room.index + 1, 0x85ebca6b)) >>> 0;
        const spec: RoomArtSpec = {
            theme: themeFor(room.title), sector: room.sector, seed: artSeed,
            floor: room.floor, doors: doorsFor(room.index),
        };
        const key = bakeArt(scene, `cb-qf-v2-room-${room.index}`, ROOM_ART.aw, ROOM_ART.ah,
            artSeed, (pen) => paintRoom(pen, spec));
        scene.add.image(room.x - ROOM_ART_OFFSET.x, room.y - ROOM_ART_OFFSET.y, key)
            .setOrigin(0, 0).setScale(ART).setDepth(-1000);
    }

    // Preserve the old seed's furniture and enemy locations: the new art never
    // touches this RNG, and these legacy visual draws are intentionally skipped.
    corridors.forEach((a) => consumeLegacyFloorRolls(rng, a));
    WALKABLE.filter((a) => a.id.startsWith("room"))
        .forEach((a) => consumeLegacyFloorRolls(rng, a));

    // Physics, drone line-of-sight and visible sprite footprints share one source.
    // Shadows are 1 ART pixel outside the solid object; never make invisible
    // geometry larger than the visible furniture / station.
    const solid = (cx: number, cy: number, w: number, h: number) => {
        const actualW = Math.max(6, w);
        const actualH = Math.max(6, h);
        const b = scene.physics.add.staticImage(cx, cy, "__WHITE");
        b.setDisplaySize(actualW, actualH).refreshBody().setVisible(false);
        blockers.add(b);
        obstacles.push(new Phaser.Geom.Rectangle(
            cx - actualW / 2, cy - actualH / 2, actualW, actualH,
        ));
    };
    let propId = 0;
    const prop = (
        cx: number, cy: number, w: number, h: number,
        kind: FurnitureKind, theme: ReturnType<typeof themeFor>,
    ) => {
        // Snap the entire image to the same 3px grid as the baked environment.
        const pw = Math.ceil(w / ART), ph = Math.ceil(h / ART);
        const worldW = pw * ART, worldH = ph * ART;
        const key = bakeArt(scene, `cb-qf-v3-prop-${propId++}`, pw, ph,
            (ARCHIVE.seed ^ Math.imul(propId, 0x9e3779b1)) >>> 0,
            (pen) => paintFurniture(pen, theme, kind));
        scene.add.image(cx, cy, key).setScale(ART).setDepth(cy + worldH / 2);
        // Exclude only the 1-pixel rendered shadow from the hitbox.
        solid(cx - ART / 2, cy - ART / 2, worldW - ART * 2, worldH - ART * 2);
    };
    // The floor artwork contains only walkable decals. Actual solid props are
    // individual themed pixel sprites with blockers sized to their painted bodies.
    for (const m of modules) {
        const n = rng.int(7, 11);
        const roomTheme = themeFor(m.title);
        for (let i = 0; i < n; i++) {
            const side = rng.pick([-1, 1]);
            const x = m.cx + side * rng.int(215, 310);
            const y = m.cy + rng.int(-260, 260);
            const kind = furnitureForTheme(roomTheme, rng.int(0, 3));
            const w = kind === 2 ? rng.int(52, 100) : rng.int(65, 106);
            const h = kind === 1 ? rng.int(88, 124) : rng.int(42, 88);
            if (INTERACTABLES.some((s) => Math.hypot(s.x - x, s.y - y) < 138))
                continue;
            if (obstacles.some((o) => Phaser.Geom.Rectangle.Overlaps(
                o, new Phaser.Geom.Rectangle(x - w / 2 - 12, y - h / 2 - 12, w + 24, h + 24),
            ))) continue;
            prop(x, y, w, h, kind, roomTheme);
        }

        // Gentle dynamic flicker complements the baked pixel light, without
        // the former large opaque-looking ellipses masking the floor detail.
        const lampX = m.cx + rng.int(-70, 70);
        const lampY = m.cy + rng.int(-65, 65);
        const tint = rng.next() < 0.45 ? 0x47adbc : 0xf2c06c;
        const glow = scene.add.ellipse(lampX, lampY, 340, 250, tint, 0.065)
            .setDepth(-120);
        const bulb = scene.add.rectangle(lampX, lampY - 205, 46, 9, 0xd9c993, 0.72)
            .setDepth(10);
        scene.add.rectangle(lampX, lampY - 217, 62, 6, 0x1e2836).setDepth(9);
        lights.push({
            glow,
            bulb,
            phase: rng.next() * Math.PI * 2,
            unstable: rng.next() < 0.55,
        });

        // A compact area label stays readable against the detailed environment.
        scene.add.text(m.cx, m.y + 70, `${m.sector} / ${m.title}`, {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: "11px",
            color: "#B2CED8",
            backgroundColor: "#07121D",
            padding: { x: 9, y: 6 },
        }).setOrigin(0.5).setDepth(m.y + 70);

        // Keep the old floor-grit RNG calls so downstream seeded drone locations
        // remain identical; the grit itself is now baked into the room texture.
        for (let d = 0; d < 22; d++) {
            rng.int(25, ROOM_W - 25);
            rng.int(24, ROOM_H - 24);
            rng.pick([0x5e7680, 0x645b4a, 0x364a59]);
            rng.next();
            rng.int(3, 12);
            rng.int(2, 7);
        }
    }
    // Formerly, stations were visible Phaser Graphics with ZERO collision.
    // Give every 3D station a real, matching blocker while preserving a generous
    // [E] approach distance (QuestFinding.ts uses 76, or 94 for the vault).
    const roomThemeAt = (x: number, y: number) => {
        const module = modules.find((m) => x >= m.x && x < m.x + ROOM_W && y >= m.y && y < m.y + ROOM_H);
        return themeFor(module?.title ?? "RECEPTION");
    };
    for (const spec of INTERACTABLES) {
        const size = STATION_SIZES[spec.kind];
        const theme = roomThemeAt(spec.x, spec.y);
        const key = bakeArt(scene, `cb-qf-v3-station-${spec.id}`,
            size.w / ART, size.h / ART,
            (ARCHIVE.seed ^ spec.x ^ (spec.y << 5)) >>> 0,
            (pen) => paintStation(pen, theme, spec.kind));
        const icon = scene.add.image(0, 0, key).setScale(ART);
        const label = scene.add.text(0, size.h / 2 + 8, spec.title, {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: "8px", color: "#D0DCE1", backgroundColor: "#07101A",
            padding: { x: 5, y: 3 },
        }).setOrigin(0.5, 0);
        scene.add.container(spec.x, spec.y, [icon, label])
            .setDepth(spec.y + size.h / 2);
        // Solid devices have a small 3px drop shadow; no invisible wide ellipses.
        solid(spec.x - ART / 2, spec.y - ART / 2,
            size.w - ART * 2, size.h - ART * 2);
    }
    // Arrival pad is visible but isn't a teleport or enemy spawn point.
    const pad = scene.add.graphics().setDepth(ARCHIVE.spawn.y + 1);
    pad.lineStyle(3, 0x55e8d5, 0.9).strokeEllipse(
        ARCHIVE.spawn.x,
        ARCHIVE.spawn.y + 25,
        120,
        42,
    );
    pad.fillStyle(0x55e8d5, 0.11).fillEllipse(
        ARCHIVE.spawn.x,
        ARCHIVE.spawn.y + 25,
        108,
        28,
    );
    const wisps: WispSpawn[] = [];
    const sites = rng.shuffle(modules.filter((m) => m.index !== START));
    for (const m of sites.slice(0, 9)) {
        // Keep entrances, objectives and the spawn safe from immediate pursuit.
        for (let trial = 0; trial < 24; trial++) {
            const x = m.cx + rng.int(-210, 210),
                y = m.cy + rng.int(-155, 155);
            if (INTERACTABLES.some((s) => Math.hypot(s.x - x, s.y - y) < 165))
                continue;
            if (obstacles.some((o) => o.contains(x, y))) continue;
            wisps.push({
                x,
                y,
                toX: m.cx - rng.int(-170, 170),
                toY: m.cy - rng.int(-130, 130),
            });
            break;
        }
    }
    return { blockers, obstacles, wisps, lights, cases };
}

