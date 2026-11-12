/** G4.3 — deterministic 42-chamber, variable-size, offset-room dungeon. No Phaser dependency. */
export const DUNGEON = {
    columns: 7, rows: 6, roomW: 710, roomH: 550,
    strideX: 1030, strideY: 820, marginX: 560, marginY: 470,
    width: 7550, height: 5450,
} as const;
export type DungeonStage = 1 | 2 | 3;
export type DungeonRole = "entry" | "ordinary" | "rest" | "seal" | "boss" | "cache";
export type DungeonBiome = "crypt" | "barracks" | "library" | "foundry" | "sanctum";
export type DungeonRect = { x: number; y: number; width: number; height: number };
export interface DungeonRoom extends DungeonRect {
    id: number; row: number; col: number; title: string;
    cx: number; cy: number; connections: number[];
    role: DungeonRole; stage?: DungeonStage;
    biome: DungeonBiome; color: number; danger: number;
}
export interface DungeonLayout {
    seed: number; rooms: DungeonRoom[]; halls: DungeonRect[];
    entry: number; boss: number; seals: Record<DungeonStage, number>;
    spawn: { x: number; y: number }; bossPoint: { x: number; y: number };
}

export function dungeonRng(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let v = state;
        v = Math.imul(v ^ (v >>> 15), v | 1);
        v ^= v + Math.imul(v ^ (v >>> 7), v | 61);
        return ((v ^ (v >>> 14)) >>> 0) / 4294967296;
    };
}
const ROOMS: Record<DungeonBiome, string[]> = {
    crypt: ["FORGOTTEN CRYPT", "WEEPING TOMB", "FALLEN GALLERY", "ECHOING CATACOMB"],
    barracks: ["RUINED BARRACKS", "SILENT WATCH", "WARDEN'S QUARTERS", "SHATTERED ARMORY"],
    library: ["ARCANE LIBRARY", "DUSTBOUND ARCHIVE", "HOLLOW CHAPEL", "LOST SCRIPTORIUM"],
    foundry: ["CORRUPTED FOUNDRY", "EMBER CELLAR", "ASHEN MACHINERY", "SMELTER'S DESCENT"],
    sanctum: ["OBSIDIAN HALL", "BURIED ATRIUM", "FORSAKEN VAULT", "CURSED ANTECHAMBER"],
};
const BIOMES: DungeonBiome[] = ["crypt", "barracks", "library", "foundry", "sanctum"];
const COLORS: Record<DungeonBiome, number> = {
    crypt: 0x242138, barracks: 0x202a37, library: 0x202d31, foundry: 0x34251f, sanctum: 0x2c2139,
};
const rect = (x: number, y: number, w: number, h: number): DungeonRect => ({ x, y, width: w, height: h });
export function buildDungeonLayout(seed: number): DungeonLayout {
    const rng = dungeonRng((seed >>> 0) ^ 0x42adbeef);
    const { columns: cols, rows } = DUNGEON;
    const rooms: DungeonRoom[] = Array.from({ length: cols * rows }, (_, id) => {
        const row = Math.floor(id / cols), col = id % cols;
        const biome = BIOMES[Math.min(4, Math.floor(col * 5 / cols))];
        const width = 570 + Math.floor(rng() * 160), height = 440 + Math.floor(rng() * 138);
        const cx = DUNGEON.marginX + col * DUNGEON.strideX + Math.floor((rng() - .5) * 130);
        const cy = DUNGEON.marginY + row * DUNGEON.strideY + Math.floor((rng() - .5) * 115);
        return {
            id, row, col, x: Math.round(cx - width / 2), y: Math.round(cy - height / 2),
            width, height, cx, cy, connections: [], role: "ordinary", stage: undefined,
            biome, color: COLORS[biome], title: ROOMS[biome][Math.floor(rng() * ROOMS[biome].length)],
            danger: 1 + Math.floor(rng() * 3),
        };
    });
    const entry = 21; // An enemy-free refuge near the western edge.
    const link = (a: number, b: number): void => {
        if (!rooms[a].connections.includes(b)) {
            rooms[a].connections.push(b); rooms[b].connections.push(a);
        }
    };
    const neighbors = (id: number): number[] => {
        const r = Math.floor(id / cols), c = id % cols;
        return [r > 0 ? id - cols : -1, c < cols - 1 ? id + 1 : -1,
            r < rows - 1 ? id + cols : -1, c > 0 ? id - 1 : -1].filter(n => n >= 0);
    };
    const visited = new Set<number>([entry]);
    const stack = [entry];
    while (stack.length) {
        const at = stack[stack.length - 1];
        const available = neighbors(at).filter(n => !visited.has(n));
        if (!available.length) { stack.pop(); continue; }
        const to = available[Math.floor(rng() * available.length)];
        link(at, to); visited.add(to); stack.push(to);
    }
    // Shortcuts and loops; route remains navigable regardless of chosen branches.
    for (const room of rooms) for (const to of neighbors(room.id)) {
        if (to > room.id && rng() < .08) link(room.id, to);
    }
    const distance = new Int16Array(rooms.length).fill(-1);
    const parent = new Int16Array(rooms.length).fill(-1);
    const q = [entry]; distance[entry] = 0;
    for (let h = 0; h < q.length; h++) {
        const at = q[h];
        for (const n of rooms[at].connections) if (distance[n] < 0) {
            distance[n] = distance[at] + 1; parent[n] = at; q.push(n);
        }
    }
    const boss = rooms.reduce((best, r) => distance[r.id] > distance[best] ? r.id : best, entry);
    const route: number[] = [];
    for (let at = boss; at !== -1; at = parent[at]) route.unshift(at);
    const length = route.length - 1;
    // If an exceptionally short route is generated, choose three distinct reachable rooms.
    const indices = [Math.max(1, Math.floor(length * .24)), Math.max(2, Math.floor(length * .50)),
        Math.max(3, Math.floor(length * .76))];
    for (let i = 1; i < 3; i++) indices[i] = Math.max(indices[i], indices[i - 1] + 1);
    for (let i = 2; i >= 0; i--) indices[i] = Math.min(indices[i], length - (3 - i));
    const seals: Record<DungeonStage, number> = { 1: route[indices[0]], 2: route[indices[1]], 3: route[indices[2]] };
    rooms[entry].role = "entry"; rooms[entry].title = "REFUGE OF THE FIRST FLAME";
    for (const stage of [1, 2, 3] as const) {
        const r = rooms[seals[stage]];
        r.role = "seal"; r.stage = stage;
        r.title = ["", "CRYPT OF FALSE PROMISES", "HALL OF PERMISSIONS", "VAULT OF SMART CONTRACTS"][stage];
        r.danger = 4 + stage;
    }
    rooms[boss].role = "boss"; rooms[boss].biome = "sanctum";
    rooms[boss].color = COLORS.sanctum; rooms[boss].title = "SANCTUM OF THE CORE GUARDIAN";
    const available = rooms.filter(r => r.role === "ordinary" && distance[r.id] > 2);
    for (const role of ["rest", "rest", "rest", "cache", "cache"] as const) {
        if (!available.length) break;
        const [r] = available.splice(Math.floor(rng() * available.length), 1);
        r.role = role; r.title = role === "rest" ? "QUIET HEALING SHRINE" : "FORGOTTEN SUPPLY CACHE";
    }
    const halls: DungeonRect[] = [];
    const thickness = 190;
    for (const room of rooms) for (const to of room.connections) {
        if (to < room.id) continue;
        const other = rooms[to];
        if (room.row === other.row) {
            const left = room.col < other.col ? room : other;
            const right = room.col < other.col ? other : room;
            const midX = (left.x + left.width + right.x) / 2;
            halls.push(rect(left.cx, left.cy - thickness / 2, midX - left.cx + 16, thickness));
            halls.push(rect(midX - thickness / 2, Math.min(left.cy, right.cy) - thickness / 2,
                thickness, Math.abs(right.cy - left.cy) + thickness));
            halls.push(rect(midX - 16, right.cy - thickness / 2, right.cx - midX + 16, thickness));
        } else {
            const top = room.row < other.row ? room : other;
            const bottom = room.row < other.row ? other : room;
            const midY = (top.y + top.height + bottom.y) / 2;
            halls.push(rect(top.cx - thickness / 2, top.cy, thickness, midY - top.cy + 16));
            halls.push(rect(Math.min(top.cx, bottom.cx) - thickness / 2, midY - thickness / 2,
                Math.abs(bottom.cx - top.cx) + thickness, thickness));
            halls.push(rect(bottom.cx - thickness / 2, midY - 16, thickness, bottom.cy - midY + 16));
        }
    }
    return { seed: seed >>> 0, rooms, halls, entry, boss, seals,
        spawn: { x: rooms[entry].cx, y: rooms[entry].cy },
        bossPoint: { x: rooms[boss].cx, y: rooms[boss].cy - 55 } };
}
export function floorAt(layout: DungeonLayout, x: number, y: number, inset = 0): boolean {
    const contains = (r: DungeonRect) => x >= r.x + inset && x <= r.x + r.width - inset &&
        y >= r.y + inset && y <= r.y + r.height - inset;
    return layout.rooms.some(r => contains(r)) || layout.halls.some(r => contains(r));
}
export function roomAt(layout: DungeonLayout, x: number, y: number): DungeonRoom | undefined {
    return layout.rooms.find(r => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height);
}
