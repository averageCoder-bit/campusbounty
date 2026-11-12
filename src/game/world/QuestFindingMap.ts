import * as Phaser from "phaser";
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
    const base = scene.add.graphics().setDepth(-1000);
    base.fillStyle(0x020409).fillRect(0, 0, ARCHIVE.width, ARCHIVE.height);

    const floor = (a: WalkableArea) => {
        const { x, y, width: w, height: h } = a;
        base.fillStyle(0x03060d).fillRect(x + 14, y + 14, w, h);
        base.fillStyle(0x354456).fillRect(x - 5, y - 5, w + 10, h + 10);
        base.fillStyle(0x0c1520).fillRect(x, y, w, h);
        base.fillStyle(a.floor).fillRect(x + 12, y + 12, w - 24, h - 24);
        for (let yy = y + 15; yy < y + h - 25; yy += 82)
            for (let xx = x + 15; xx < x + w - 25; xx += 82) {
                base.fillStyle(
                    rng.pick([a.floor, 0x1a2e3d, 0x1c2a36, 0x1b2533]),
                    rng.next() * 0.27,
                ).fillRect(xx, yy, 80, 80);
                base.lineStyle(1, 0x0a111b, 0.4).strokeRect(xx, yy, 82, 82);
                if (rng.next() < 0.1) {
                    base.fillStyle(0x516478, 0.37).fillRect(
                        xx + rng.int(12, 60),
                        yy + rng.int(11, 60),
                        5,
                        2,
                    );
                }
            }
        // Stripped corporate edging with hazard tape, deliberately muted.
        base.fillStyle(0x6e5833, 0.6).fillRect(x + 10, y + 10, w - 20, 4);
        base.fillStyle(0x060b13, 0.55).fillRect(x + 12, y + h - 19, w - 24, 7);
    };
    // Hallways first, then enclosed offices. Both share the same logical floor union.
    WALKABLE.filter((a) => a.id.startsWith("corridor")).forEach(floor);
    WALKABLE.filter((a) => a.id.startsWith("room")).forEach(floor);
    const solid = (cx: number, cy: number, w: number, h: number) => {
        const b = scene.physics.add.staticImage(cx, cy, "__WHITE");
        b.setDisplaySize(w, h).refreshBody().setVisible(false);
        blockers.add(b);
        obstacles.push(new Phaser.Geom.Rectangle(cx - w / 2, cy - h / 2, w, h));
    };
    const prop = (
        cx: number,
        cy: number,
        w: number,
        h: number,
        kind: number,
    ) => {
        const g = scene.add.graphics().setDepth(cy + h / 2);
        g.fillStyle(0x000000, 0.52).fillRect(
            cx - w / 2 + 10,
            cy - h / 2 + 10,
            w,
            h,
        );
        const x = cx - w / 2,
            y = cy - h / 2;
        if (kind === 0) {
            // shattered desk & monitor
            g.fillStyle(0x392a26).fillRect(x, y, w, h - 9);
            g.fillStyle(0x866146).fillRect(x + 7, y + 5, w - 14, h - 19);
            g.fillStyle(0x070f19).fillRect(cx - 16, cy - 13, 32, 24);
            g.fillStyle(0x4ac5bc).fillRect(cx - 12, cy - 9, 24, 9);
            g.fillStyle(0xc29348).fillRect(cx - 2, cy + 10, 5, 4);
        } else if (kind === 1) {
            // server rack
            g.fillStyle(0x050c17).fillRect(x, y, w, h);
            g.fillStyle(0x506079).fillRect(x + 5, y + 4, w - 10, h - 9);
            for (let i = 0; i < 5; i++) {
                g.fillStyle(0x0b1b2c).fillRect(
                    x + 12,
                    y + 11 + (i * (h - 21)) / 5,
                    w - 24,
                    12,
                );
                g.fillStyle(i % 2 ? 0xfaa955 : 0x3fb8a6).fillRect(
                    x + 17,
                    y + 14 + (i * (h - 21)) / 5,
                    7,
                    4,
                );
            }
        } else if (kind === 2) {
            // cubicle divider
            g.fillStyle(0x354253).fillRect(x, y, w, h);
            g.fillStyle(0x53647a).fillRect(x + 5, y + 5, w - 10, h - 10);
            g.fillStyle(0xc5934e).fillRect(x + 4, y + h - 8, w - 8, 4);
        } else {
            // filing cabinet
            g.fillStyle(0x34485a).fillRect(x, y, w, h);
            g.fillStyle(0x5d7885).fillRect(x + 6, y + 4, w - 12, h - 8);
            for (let k = 0; k < 3; k++) {
                const yy = y + 8 + (k * (h - 15)) / 3;
                g.fillStyle(0x172b39).fillRect(x + 11, yy, w - 22, 9);
                g.fillStyle(0xc59c52).fillRect(cx - 4, yy + 3, 8, 3);
            }
        }
        solid(cx, cy, w - 4, h - 6);
    };
    // Offices are intentionally furnished with side-wall obstacles: main axes stay open.
    for (const m of modules) {
        const n = rng.int(7, 11);
        for (let i = 0; i < n; i++) {
            const side = rng.pick([-1, 1]);
            const x = m.cx + side * rng.int(215, 310);
            const y = m.cy + rng.int(-260, 260);
            const kind = rng.int(0, 3);
            const w = kind === 2 ? rng.int(52, 100) : rng.int(65, 106);
            const h = kind === 1 ? rng.int(88, 124) : rng.int(42, 88);
            if (INTERACTABLES.some((s) => Math.hypot(s.x - x, s.y - y) < 138))
                continue;
            if (
                obstacles.some((o) =>
                    Phaser.Geom.Rectangle.Overlaps(
                        o,
                        new Phaser.Geom.Rectangle(
                            x - w / 2 - 12,
                            y - h / 2 - 12,
                            w + 24,
                            h + 24,
                        ),
                    ),
                )
            )
                continue;
            prop(x, y, w, h, kind);
        }
        // Cracked glass partitions, dead signs and exposed emergency wiring.
        const atmosphere = scene.add.graphics().setDepth(-85);
        const ax = m.x + 31,
            ay = m.y + 32;
        atmosphere.fillStyle(0x071520).fillRect(ax, ay, 116, 42);
        atmosphere.fillStyle(0x214457).fillRect(ax + 7, ay + 7, 102, 25);
        atmosphere
            .lineStyle(2, 0x83acb6, 0.32)
            .strokeRect(ax + 7, ay + 7, 102, 25);
        atmosphere
            .lineStyle(2, 0x7596a7, 0.55)
            .lineBetween(ax + 40, ay + 9, ax + 63, ay + 28)
            .lineBetween(ax + 63, ay + 28, ax + 79, ay + 17);
        atmosphere
            .fillStyle(0xb74a3d, 0.8)
            .fillRect(m.x + ROOM_W - 90, m.y + 24, 32, 9);
        for (let h = 0; h < 7; h++) {
            atmosphere
                .fillStyle(h % 2 === 0 ? 0x8b6c3b : 0x1c252d, 0.63)
                .fillRect(m.x + 55 + h * 24, m.y + ROOM_H - 42, 18, 8);
        }
        atmosphere
            .lineStyle(2, 0x314a55, 0.75)
            .lineBetween(
                m.x + ROOM_W - 40,
                m.y + 65,
                m.x + ROOM_W - 42,
                m.y + 118,
            )
            .lineBetween(
                m.x + ROOM_W - 42,
                m.y + 118,
                m.x + ROOM_W - 24,
                m.y + 144,
            );
        // Broken fluorescents and shallow pools of warm/teal light. No shadows that hide clues.
        const lampX = m.cx + rng.int(-70, 70),
            lampY = m.cy + rng.int(-65, 65);
        const glow = scene.add
            .ellipse(
                lampX,
                lampY,
                420,
                330,
                rng.next() < 0.45 ? 0x47adbc : 0xf2c06c,
                0.18,
            )
            .setDepth(-120);
        const bulb = scene.add
            .rectangle(lampX, lampY - 205, 46, 9, 0xd9c993, 0.72)
            .setDepth(10);
        scene.add.rectangle(lampX, lampY - 217, 62, 6, 0x1e2836).setDepth(9);
        lights.push({
            glow,
            bulb,
            phase: rng.next() * Math.PI * 2,
            unstable: rng.next() < 0.55,
        });
        const name = scene.add
            .text(m.cx, m.y + 70, `${m.sector} / ${m.title}`, {
                fontFamily: '"Press Start 2P", monospace',
                fontSize: "12px",
                color: "#A6C4D3",
                backgroundColor: "#07121D",
                padding: { x: 10, y: 8 },
            })
            .setOrigin(0.5)
            .setDepth(m.y + 70);
        void name;
        // A few scattered papers and damaged floor markers provide environmental storytelling.
        const grit = scene.add.graphics().setDepth(-70);
        for (let d = 0; d < 22; d++) {
            const xx = m.x + rng.int(25, ROOM_W - 25),
                yy = m.y + rng.int(24, ROOM_H - 24);
            grit.fillStyle(
                rng.pick([0x5e7680, 0x645b4a, 0x364a59]),
                rng.next() * 0.28,
            ).fillRect(xx, yy, rng.int(3, 12), rng.int(2, 7));
        }
    }
    for (const spec of INTERACTABLES) {
        const g = scene.add.graphics();
        g.fillStyle(0x000000, 0.48).fillEllipse(0, 12, 92, 22);
        const color =
            spec.kind === "evidence"
                ? 0x58d7c6
                : spec.kind === "vault"
                  ? 0xfbbf24
                  : 0x7dd3fc;
        g.fillStyle(color, 0.13).fillEllipse(0, 0, 74, 53);
        if (
            spec.kind === "evidence" ||
            spec.kind === "decoy" ||
            spec.kind === "sign"
        ) {
            g.fillStyle(0xe6c997).fillRect(-19, -22, 38, 39);
            g.fillStyle(0xa3542b).fillRect(-8, -27, 14, 7);
            for (let t = 0; t < 3; t++)
                g.fillStyle(0x8a6a4c).fillRect(-13, -10 + t * 9, 22 - t * 3, 2);
        } else {
            g.fillStyle(0x64502c).fillRect(-31, -38, 62, 79);
            g.fillStyle(0xfbbf24).fillRect(-26, -32, 52, 5);
            g.fillStyle(0x0c2b40).fillRect(-24, -22, 48, 49);
            g.fillStyle(color).fillRect(-16, -8, 32, 4);
            g.fillRect(-10, 4, 20, 3);
        }
        const node = scene.add
            .container(spec.x, spec.y, [g])
            .setDepth(spec.y + 11);
        const t = scene.add
            .text(0, 42, spec.title, {
                fontFamily: '"Press Start 2P", monospace',
                fontSize: "8px",
                color: "#D0DCE1",
                backgroundColor: "#07101A",
                padding: { x: 5, y: 3 },
            })
            .setOrigin(0.5);
        node.add(t);
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

