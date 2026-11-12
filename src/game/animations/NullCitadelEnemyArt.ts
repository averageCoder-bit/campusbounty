/**
 * G4.5 — The Null Citadel: independent pixel-art enemy atelier.
 * All designs are painted at integer coordinates into 100 x 104 canvas frames,
 * then baked into Phaser animation textures. No PNG assets or frame-by-frame
 * Graphics objects required. The enemy classes own behavior; this file owns art.
 */
export type CitadelActorArt = "slime" | "knight" | "archer" | "guardian";
export type CitadelArtState = "idle" | "walk" | "windup" | "attack" | "hit" | "death";
export type CitadelDirection =
    | "down" | "down-left" | "left" | "up-left"
    | "up" | "up-right" | "right" | "down-right";

type Paint = {
    r: (x: number, y: number, w: number, h: number, color: string) => void;
    disc: (x: number, y: number, rx: number, ry: number, color: string) => void;
    ring: (x: number, y: number, rx: number, ry: number, color: string, dots?: number) => void;
    line: (x1: number, y1: number, x2: number, y2: number, c: string, thickness?: number) => void;
};

const C = {
    ink: "#080911", void: "#11131f", dark: "#191a2a", charcoal: "#262a39",
    slate: "#3d4657", steel: "#58677b", pale: "#9ba7b5", bone: "#c7bec2",
    edge: "#0c101a", violet: "#715585", lightViolet: "#b69bc6",
    cyan: "#80e1e4", ice: "#d8faf5", rose: "#be5779", hot: "#f5a0b3",
    copper: "#987669", gold: "#d1b692", soot: "#221b28", haze: "#554262",
};

function painter(ctx: CanvasRenderingContext2D): Paint {
    const r = (x: number, y: number, w: number, h: number, color: string): void => {
        if (w <= 0 || h <= 0) return;
        ctx.fillStyle = color;
        ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    };
    const disc = (x: number, y: number, rx: number, ry: number, color: string): void => {
        for (let iy = -ry; iy <= ry; iy++) {
            const t = iy / Math.max(1, ry);
            const half = Math.floor(rx * Math.sqrt(Math.max(0, 1 - t * t)));
            if (half > 0) r(x - half, y + iy, 2 * half + 1, 1, color);
        }
    };
    const ring = (x: number, y: number, rx: number, ry: number, color: string, dots = 32): void => {
        for (let i = 0; i < dots; i++) {
            const angle = (i / dots) * Math.PI * 2;
            const px = Math.round(x + Math.cos(angle) * rx);
            const py = Math.round(y + Math.sin(angle) * ry);
            r(px, py, i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 2 : 1, color);
        }
    };
    // Integer-stepped lines: keep the same crunchy pixels as QuestHallMap.
    const line = (x1: number, y1: number, x2: number, y2: number, c: string, thickness = 2): void => {
        const steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1)));
        for (let i = 0; i <= steps; i++) {
            const a = i / steps;
            r(x1 + (x2 - x1) * a, y1 + (y2 - y1) * a, thickness, thickness, c);
        }
    };
    return {r, disc, ring, line};
}

function wisp(p: Paint, state: CitadelArtState, frame: number, facingBack: boolean): void {
    const {r, disc, ring, line} = p;
    const bob = [0, -2, -3, -2, 0, 1, 0][frame % 7];
    const pulse = state === "windup" ? C.hot : state === "attack" ? C.ice : C.cyan;
    const attack = state === "attack";
    const sweep = attack ? frame * 3 : 0;
    // Soul-smoke trails: irregular shards and deliberate negative space.
    for (let i = 0; i < 5; i++) {
        const zig = (i % 2 ? 4 : -3) + (frame % 3);
        r(-15 + i * 6 + zig, 16 + Math.floor(i / 2) * 4, 4, 7, i % 2 ? C.violet : C.slate);
        r(-16 + i * 6, 26 + (frame + i) % 4, 3, 5, C.haze);
    }
    // Fractured halo: individual floating segments, not a smooth cartoon ellipse.
    ring(0, -5 + bob, 27, 23, state === "windup" ? C.hot : C.haze, 40);
    for (const [x, y, a] of [[-31,-13,0],[28,5,1],[-20,18,2],[19,-29,3]] as const) {
        r(x + ((frame + a) % 3), y, 7, 3, a % 2 ? C.steel : C.lightViolet);
        r(x + 2, y - 3, 3, 3, C.ink);
    }
    // Masked obsidian skull silhouette with chipped forehead and jaw.
    disc(0 + sweep, -7 + bob, 20, 21, C.edge);
    disc(0 + sweep, -10 + bob, 17, 17, C.slate);
    r(-17 + sweep, -20 + bob, 34, 11, C.charcoal);
    r(-15 + sweep, -22 + bob, 13, 5, C.steel);
    r(4 + sweep, -22 + bob, 8, 3, C.steel);
    r(-19 + sweep, -7 + bob, 8, 10, C.dark);
    r(11 + sweep, -7 + bob, 8, 10, C.dark);
    r(-11 + sweep, 4 + bob, 22, 8, C.void);
    r(-6 + sweep, 10 + bob, 12, 3, C.ink);
    // Embedded twin-lens eyes flare during windup, look away when facing back.
    if (!facingBack) {
        r(-12 + sweep, -12 + bob, 9, 6, C.ink);
        r(3 + sweep, -12 + bob, 9, 6, C.ink);
        r(-9 + sweep, -11 + bob, 6, 3, pulse);
        r(4 + sweep, -11 + bob, 6, 3, pulse);
        if (frame % 2) {r(-8 + sweep,-10 + bob,2,2,C.ice); r(5 + sweep,-10 + bob,2,2,C.ice);}
    } else {
        r(-7 + sweep,-12 + bob,14,5,C.haze);
        r(-3 + sweep,-10 + bob,6,2,pulse);
    }
    // An orbiting broken sigil makes it read as a null wraith, not a slime.
    const a = (frame / 6) * Math.PI * 2;
    const ox = Math.round(Math.cos(a) * 25), oy = Math.round(Math.sin(a) * 15);
    r(ox - 3, oy - 12 + bob, 6, 4, pulse);
    r(ox - 1, oy - 16 + bob, 2, 12, C.ice);
    if (state === "windup") {
        ring(0, -6 + bob, 32 + frame, 30 + frame, C.rose, 36);
        line(-24, 14, 24, 14, C.rose);
    }
    if (attack) { line(-20, 16, -25 - frame * 2, 24, C.hot, 3); line(20, 13, 25 + frame * 2, 21, C.lightViolet, 3); }
}

function sentinel(p: Paint, state: CitadelArtState, frame: number, facingBack: boolean): void {
    const {r, disc, line, ring} = p;
    const step = state === "walk" ? ((frame % 4 < 2) ? 2 : -2) : 0;
    const wind = state === "windup", strike = state === "attack";
    // Iron boots and hanging coat plates.
    disc(0, 29, 21, 6, C.ink);
    r(-16, 13 + step, 12, 14, C.edge); r(5, 13 - step, 12, 14, C.edge);
    r(-13, 16 + step, 7, 8, C.slate); r(7, 16 - step, 7, 8, C.slate);
    r(-20, -3, 40, 25, C.edge); r(-17, -2, 34, 22, C.charcoal);
    r(-14, 0, 28, 10, C.steel); r(-13, 12, 26, 3, C.copper);
    r(-3, -4, 6, 22, C.ink);
    for (let i = 0; i < 3; i++) { r(-14 + i * 11, 7, 7, 3, C.slate); r(-13 + i * 11, 9, 3, 3, C.pale); }
    // Layered broad pauldrons and riveted shoulder caps.
    r(-26, -21, 17, 20, C.edge); r(10, -21, 17, 20, C.edge);
    r(-24, -19, 14, 12, C.slate); r(11, -19, 14, 12, C.slate);
    r(-22, -18, 9, 3, C.pale); r(13, -18, 9, 3, C.pale);
    r(-23, -5, 13, 10, C.charcoal); r(10, -5, 13, 10, C.charcoal);
    // Cracked crowned helmet, slit visor; iron-blue vs crimson attack light.
    r(-15, -30, 30, 23, C.edge); r(-12, -28, 24, 19, C.slate);
    r(-10, -30, 20, 5, C.pale); r(-7, -35, 14, 6, C.charcoal);
    r(-3, -38, 6, 5, C.copper);
    r(-12, -16, 24, 7, C.ink);
    if (!facingBack) {r(-9,-15,18,3,wind ? C.hot : C.rose); r(5,-15,3,2,C.ice);}
    else {r(-8,-18,16,2,C.steel);r(-2,-23,4,9,C.ink);}
    line(3, -25, 1, -19, C.void, 1); line(1, -19, 6, -12, C.void, 1);
    // Huge defensive shield with concentric plates and a central sigil.
    const shx = wind ? -25 : -29;
    r(shx - 8, -5, 21, 33, C.edge); r(shx - 5, -3, 15, 27, C.slate);
    r(shx - 3, -1, 11, 3, C.pale); r(shx - 3, 19, 11, 3, C.copper);
    r(shx + 1, 5, 3, 12, wind ? C.hot : C.rose);
    r(shx - 3, 9, 11, 3, wind ? C.hot : C.violet);
    r(shx - 8, 0, 3, 19, C.steel);
    // Battle hammer/halberd wind-up in the opposite arm.
    const wy = wind ? -15 - frame : strike ? -28 + frame * 5 : -12;
    r(26, wy - 12, 4, 45, C.copper);
    r(20, wy - 16, 15, 10, C.edge);
    r(21, wy - 15, 13, 7, strike ? C.hot : C.pale);
    r(24, wy - 14, 7, 3, C.ice);
    if (wind) ring(0, 0, 36, 28, C.rose, 28);
    if (strike) line(27, wy-12, 30+frame*2, wy+6, C.hot, 2);
}

function caster(p: Paint, state: CitadelArtState, frame: number, facingBack: boolean): void {
    const {r, disc, line, ring} = p;
    const pulse = state === "windup" || state === "attack";
    const bob = [0,-1,-3,-1,0,1,0][frame % 7];
    // Detached hem fragments and woven robe, no smooth semicircle body.
    disc(0, 29, 21, 5, C.ink);
    for (let i = 0; i < 7; i++) {
        const x = -23 + i * 7;
        r(x, 14 + bob + (i % 3) * 3, 6, 14 - (i % 3) * 2, i % 2 ? C.dark : C.haze);
        r(x + 1, 23 + bob + (i % 2) * 4, 3, 6, C.violet);
    }
    r(-21, -11 + bob, 42, 27, C.edge);
    r(-18, -9 + bob, 36, 22, C.charcoal);
    r(-17, -7 + bob, 6, 25, C.slate); r(11, -7 + bob, 6, 25, C.slate);
    r(-16, 4 + bob, 32, 4, C.haze);
    // A rune-stitched robe seam and ancient iron brooch.
    r(-3, -5 + bob, 6, 23, C.void);
    for (let i = 0; i < 4; i++) {r(-1, i*5-4 + bob, 3, 2, pulse ? C.ice : C.lightViolet);}
    r(-7, -13 + bob, 14, 10, C.slate); r(-4, -11 + bob, 8, 7, C.violet);
    // Mask is separate from hood; pale expressionless relic plate.
    r(-18, -30 + bob, 36, 21, C.edge); r(-15,-28+bob,30,18,C.charcoal);
    r(-10,-33+bob,20,7,C.steel);r(-7,-36+bob,14,4,C.pale);
    r(-12,-24+bob,24,13,C.bone);
    r(-8,-22+bob,16,4,C.slate);
    if (!facingBack) {r(-9,-20+bob,7,3,pulse?C.ice:C.cyan);r(3,-20+bob,7,3,pulse?C.ice:C.cyan);}
    r(-4,-14+bob,8,2,C.void); r(-1,-11+bob,2,3,C.ink);
    // Broken bone-and-metal staff and its floating polygonal null sigil.
    r(24,-27+bob,4,58,C.copper);r(25,-29+bob,2,12,C.pale);
    r(21,-36+bob,10,5,C.edge);r(23,-39+bob,6,12,pulse?C.hot:C.cyan);
    r(24,-40+bob,4,3,C.ice);
    ring(26,-37+bob,11+(pulse?frame%3:0),13+(pulse?frame%3:0),pulse?C.rose:C.lightViolet,24);
    for (let i=0;i<4;i++) {
        const a=(i/4)*Math.PI*2+frame*.2;
        r(26+Math.round(Math.cos(a)*17),-37+bob+Math.round(Math.sin(a)*14),3,3,i%2?C.cyan:C.violet);
    }
    if (pulse) {
        line(-25, 6+bob, -32 - frame, -3+bob, C.rose, 2);
        line(24,-37+bob,30+frame*2,-45+bob,C.hot,2);
    }
}

function guardian(p: Paint, state: CitadelArtState, frame: number, facingBack: boolean): void {
    const {r, disc, ring, line} = p;
    const charging = state === "windup" || state === "attack";
    const bob = [0,-1,-2,-2,-1,1,0][frame%7];
    const aura = charging ? C.hot : C.rose;
    // Gear halo with dozens of individual chipped glyph plates.
    ring(0, -4+bob, 42, 34, C.haze, 48);
    ring(0, -4+bob, 36, 31, C.violet, 36);
    for (let i=0; i<8; i++) {
        const a=(i/8)*Math.PI*2+(frame%4)*.08;
        const px=Math.round(Math.cos(a)*41), py=Math.round(Math.sin(a)*34)-4+bob;
        r(px-2,py-3,5,7,i%2?aura:C.steel);
        r(px,py-1,2,3,C.ink);
    }
    // Floating broken horns and a crown made of corrupted steel.
    r(-31,-34+bob,11,11,C.edge); r(-28,-38+bob,7,11,C.steel);
    r(-24,-44+bob,5,10,C.pale); r(-20,-48+bob,4,8,C.rose);
    r(20,-34+bob,11,11,C.edge); r(22,-38+bob,7,11,C.steel);
    r(20,-44+bob,5,10,C.pale); r(17,-48+bob,4,8,C.rose);
    // Mechanical ribs and armored bulk, tapered at the lower edge.
    disc(0, 24+bob, 31, 8, C.ink);
    r(-29,-16+bob,58,38,C.edge);
    r(-24,-13+bob,48,34,C.charcoal);
    r(-23,-10+bob,46,4,C.slate);
    for(let i=0;i<4;i++) {
        const y=-3+i*6+bob;
        r(-22+i, y, 15-i, 3, i%2?C.copper:C.steel);
        r(7, y, 15-i, 3, i%2?C.copper:C.steel);
    }
    r(-27,17+bob,16,10,C.dark);r(11,17+bob,16,10,C.dark);
    r(-24,20+bob,12,4,C.rose);r(12,20+bob,12,4,C.rose);
    // Massive asymmetric pauldrons, cracked plates, jagged edges.
    r(-38,-24+bob,21,29,C.edge);r(18,-24+bob,21,29,C.edge);
    r(-36,-23+bob,17,22,C.slate);r(20,-23+bob,17,22,C.slate);
    r(-34,-22+bob,12,4,C.pale);r(22,-22+bob,12,4,C.pale);
    r(-33,-4+bob,9,11,C.dark);r(24,-4+bob,9,11,C.dark);
    r(-35,5+bob,13,12,C.edge);r(22,5+bob,13,12,C.edge);
    r(-32,7+bob,7,6,charging?C.hot:C.rose);r(25,7+bob,7,6,charging?C.hot:C.rose);
    // Death mask beneath an iron crown: slit eyes, fang plate, runic etching.
    r(-20,-32+bob,40,25,C.edge);r(-17,-30+bob,34,21,C.slate);
    r(-13,-30+bob,26,4,C.pale);r(-16,-34+bob,32,5,C.dark);
    r(-7,-37+bob,14,6,C.rose);r(-3,-40+bob,6,4,C.hot);
    r(-14,-19+bob,28,9,C.void);
    if (!facingBack) {r(-12,-17+bob,10,3,aura);r(3,-17+bob,10,3,aura);}
    r(-8,-9+bob,16,5,C.bone);r(-3,-9+bob,6,7,C.ink);
    // Pulsing, layered core with broken cross-shaped containment cage.
    disc(0, 0+bob, 13, 15, C.edge);
    disc(0, 0+bob, 10, 12, C.rose);
    disc(0, 0+bob, 6 + (frame%2), 8, charging?C.ice:C.hot);
    r(-2,-7+bob,4,15,C.ice);
    r(-10,-2+bob,20,3,charging?C.ice:C.rose);
    r(-16,-2+bob,4,7,C.steel);r(12,-2+bob,4,7,C.steel);
    // Clawed arms with phase-transition-like extensions during attack.
    const reach = state==="attack"?frame*2:state==="windup"?-frame:0;
    r(-42-reach,-5+bob,10,25,C.edge);r(-40-reach,-3+bob,6,18,C.steel);
    r(32+reach,-5+bob,10,25,C.edge);r(34+reach,-3+bob,6,18,C.steel);
    for(let i=0;i<3;i++) {
        r(-44-reach+i*3,16+bob,3,8,C.pale);
        r(34+reach+i*3,16+bob,3,8,C.pale);
    }
    if (charging) {
        ring(0,1+bob,43,38,C.rose,40);
        for(let i=0;i<4;i++) {const x=-30+i*20; line(x,25+bob,x+4,30+bob,C.hot,2);}
    }
}

/** Draw a complete enemy frame at local atlas origin (0,0). Never modifies physics. */
export function paintNullCitadelEnemy(
    ctx: CanvasRenderingContext2D,
    kind: CitadelActorArt,
    state: CitadelArtState,
    direction: CitadelDirection,
    frame: number,
): void {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    const p = painter(ctx);
    const facingBack = direction.startsWith("up");
    if (state === "death") {
        // A deliberate fragmenting fall rather than a uniform fading ellipse.
        const split = frame * 2;
        ctx.globalAlpha = Math.max(.13, 1 - frame / 8);
        ctx.translate(0, split);
        ctx.scale(1 + frame * .012, Math.max(.1, 1 - frame * .13));
    }
    if (state === "hit" && frame % 2 === 0) ctx.globalAlpha = .78;
    if (kind === "slime") wisp(p, state, frame, facingBack);
    else if (kind === "knight") sentinel(p, state, frame, facingBack);
    else if (kind === "archer") caster(p, state, frame, facingBack);
    else guardian(p, state, frame, facingBack);
    if (state === "hit" && frame % 2 === 0) {
        ctx.globalAlpha = .25;
        p.r(-30, -27, 60, 50, C.ice);
    }
    ctx.restore();
}
