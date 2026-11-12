import * as Phaser from "phaser";

/**
 * A procedural portal in the Quest Hall, between Byte and the board.
 * No external texture files required. E is dispatched from Game.ts so it
 * cannot conflict with Byte/QuestBoard interactions.
 *
 * Styled after the hall itself: a brick arch with gold trim and a keystone coin
 * (like the walls and rug), a teal vortex (like the rug), torch sconces (like the
 * back wall), and a rune dais (like Byte's). Art is based around (512, 360); the
 * dais is collidable.
 */

const KEY = {
    base: "cb-g2-portal-base-v2",
    ring: "cb-g2-portal-ring-v2",
    flame: "cb-g2-portal-flame-v2",
    glow: "cb-g2-portal-glow-v2",
} as const;

const P = {
    outline: 0x070d1a,
    mortar: 0x0c1729,
    bricks: [0x1c2f4d, 0x213756, 0x182a45] as number[],
    gold: 0xfbbf24,
    goldDark: 0xb45309,
    goldMid: 0xd97706,
    rugTeal: 0x0b706b,
    rugDeep: 0x114c57,
    teal: 0x55e8d5,
    tealLight: 0x9dfff1,
    interior: 0x0a2a35,
    daisSide: 0x0f2e3a,
    daisTop: 0x1e4553,
    iron: 0x1f2937,
    cup: 0x374151,
    woodDark: 0x452312,
    dark: 0x0b1423,
} as const;

// Same sorting rule as the hall's props: depth comes from the collision box's
// bottom edge, so the player walks in front of or behind the arch correctly.
const depthFor = (solidBottom: number) => solidBottom - 25;

const COLLIDER_W = 120;
const COLLIDER_H = 22;

// Baked base texture covers local x -80..80 and y -160..40.
const TEX_W = 160;
const TEX_H = 200;
const OX = 80;
const OY = 160;

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
const FLAME_PALETTE: Record<string, number> = { O: 0xf97316, Y: 0xfde047 };

type G = Phaser.GameObjects.Graphics;
type Px = (
    x: number,
    y: number,
    w: number,
    h: number,
    color: number,
    alpha?: number,
) => void;

// ---------------------------------------------------------------------------
// Texture baking
// ---------------------------------------------------------------------------
function bakeTextures(scene: Phaser.Scene): void {
    bakeBase(scene);
    bakeRing(scene);

    if (!scene.textures.exists(KEY.flame)) {
        const g = scene.make.graphics({}, false);
        FLAME_ROWS.forEach((row, y) =>
            [...row].forEach((ch, x) => {
                const color = FLAME_PALETTE[ch];
                if (color !== undefined)
                    g.fillStyle(color).fillRect(x, y, 1, 1);
            }),
        );
        g.generateTexture(KEY.flame, FLAME_ROWS[0].length, FLAME_ROWS.length);
        g.destroy();
        scene.textures
            .get(KEY.flame)
            .setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

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
}

function drawBricks(
    px: Px,
    rng: Phaser.Math.RandomDataGenerator,
    x: number,
    y: number,
    w: number,
    h: number,
) {
    px(x, y, w, h, P.mortar);
    for (let row = 0, yy = y; yy < y + h; row++, yy += 9) {
        const bh = Math.min(8, y + h - yy);
        const offset = row % 2 ? 8 : 0;
        for (let bx = x - offset; bx < x + w; bx += 16) {
            const x0 = Math.max(bx, x);
            const bw = Math.min(bx + 16, x + w) - x0 - 1;
            if (bw > 0) px(x0, yy, bw, bh, rng.pick(P.bricks));
        }
    }
}

function bakeBase(scene: Phaser.Scene): void {
    if (scene.textures.exists(KEY.base)) return;

    const g: G = scene.make.graphics({}, false);
    const rng = new Phaser.Math.RandomDataGenerator([
        "campus-bounty-portal-v2",
    ]);

    const px: Px = (x, y, w, h, color, alpha = 1) => {
        g.fillStyle(color, alpha);
        g.fillRect(OX + x, OY + y, w, h);
    };
    const disc = (
        cx: number,
        cy: number,
        rx: number,
        ry: number,
        color: number,
        alpha = 1,
    ) => {
        g.fillStyle(color, alpha);
        for (let dy = -ry; dy < ry; dy++) {
            const t = (dy + 0.5) / ry;
            const half = Math.round(rx * Math.sqrt(1 - t * t));
            if (half > 0) g.fillRect(OX + cx - half, OY + cy + dy, half * 2, 1);
        }
    };

    // --- Rune dais (same build as Byte's) ------------------------------------
    disc(0, 20, 76, 15, 0x000000, 0.35);
    px(-68, 10, 136, 8, P.daisSide);
    disc(0, 18, 68, 11, P.daisSide);
    disc(0, 10, 68, 14, P.gold);
    disc(0, 10, 65, 12, P.daisTop);
    disc(0, 10, 52, 9, P.rugTeal);
    disc(0, 10, 46, 7, 0x0f3b45);
    for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        px(
            Math.round(Math.cos(a) * 49) - 1,
            Math.round(10 + Math.sin(a) * 8),
            3,
            2,
            P.teal,
            0.9,
        );
    }

    // --- Arch silhouette ------------------------------------------------------
    px(-61, -137, 122, 137, P.outline);
    px(-49, -145, 98, 8, P.outline);
    px(-37, -153, 74, 8, P.outline);

    // --- Brick stonework, same pattern as the back wall -----------------------
    drawBricks(px, rng, -58, -134, 116, 134);
    drawBricks(px, rng, -46, -142, 92, 8);
    drawBricks(px, rng, -34, -150, 68, 8);

    // Gold bands and studs on the pillars
    for (const side of [-1, 1]) {
        const x = side < 0 ? -58 : 41;
        for (const y of [-100, -20]) px(x, y, 17, 3, P.gold);
        for (const y of [-118, -56, -36]) {
            px(x + 6, y, 5, 5, P.gold);
            px(x + 6, y + 4, 5, 1, P.goldDark);
        }
    }

    // --- Gold rim around the opening -----------------------------------------
    px(-28, -134, 56, 12, P.goldDark);
    px(-36, -126, 72, 12, P.goldDark);
    px(-42, -118, 84, 117, P.goldDark);
    px(-27, -133, 54, 11, P.gold);
    px(-35, -125, 70, 11, P.gold);
    px(-41, -117, 82, 115, P.gold);

    // --- Vortex interior: concentric teal rings, like the rug ----------------
    px(-24, -130, 48, 8, P.interior);
    px(-32, -122, 64, 8, P.interior);
    px(-38, -114, 76, 108, P.interior);
    disc(0, -60, 38, 54, 0x0f3b45);
    disc(0, -60, 32, 46, P.rugDeep);
    disc(0, -60, 25, 37, P.rugTeal);
    disc(0, -60, 17, 26, 0x17a39a);
    disc(0, -60, 9, 14, P.teal);
    disc(0, -60, 4, 7, P.tealLight);

    // --- Keystone with the rug's coin emblem ----------------------------------
    px(-12, -160, 24, 22, P.goldDark);
    px(-10, -158, 20, 18, P.gold);
    disc(0, -149, 6, 6, P.goldMid);
    disc(0, -149, 4, 4, P.gold);
    px(-1, -154, 2, 10, P.goldDark);
    px(-5, -150, 10, 2, P.goldDark);

    // --- Sconce brackets (flames are animated separately) ---------------------
    for (const cx of [-49, 49]) {
        px(cx - 1, -71, 2, 8, P.iron);
        px(cx - 5, -76, 10, 5, P.cup);
        px(cx - 5, -76, 10, 1, 0x6b7280);
    }

    g.generateTexture(KEY.base, TEX_W, TEX_H);
    g.destroy();
    scene.textures.get(KEY.base).setFilter(Phaser.Textures.FilterMode.NEAREST);
}

/** Thin elliptical ring used for the portal's ripple effect. */
function bakeRing(scene: Phaser.Scene): void {
    if (scene.textures.exists(KEY.ring)) return;

    const g = scene.make.graphics({}, false);
    g.fillStyle(0xffffff);
    for (let y = 0; y < 108; y++) {
        const dy = y + 0.5 - 54;
        const outer = Math.round(
            38 * Math.sqrt(Math.max(0, 1 - (dy / 54) ** 2)),
        );
        const ti = dy / 51;
        const inner =
            Math.abs(ti) < 1 ? Math.round(35 * Math.sqrt(1 - ti * ti)) : 0;
        if (outer <= 0) continue;
        if (inner > 0 && outer > inner) {
            g.fillRect(38 - outer, y, outer - inner, 1);
            g.fillRect(38 + inner, y, outer - inner, 1);
        } else {
            g.fillRect(38 - outer, y, outer * 2, 1);
        }
    }
    g.generateTexture(KEY.ring, 76, 108);
    g.destroy();
    scene.textures.get(KEY.ring).setFilter(Phaser.Textures.FilterMode.NEAREST);
}

// ---------------------------------------------------------------------------
// Portal
// ---------------------------------------------------------------------------
export class AdventurePortal {
    private readonly scene: Phaser.Scene;
    private readonly root: Phaser.GameObjects.Container;
    private readonly prompt: Phaser.GameObjects.Container;
    private readonly highlight: Phaser.GameObjects.Image;
    private readonly footprint: Phaser.Geom.Rectangle;
    private readonly tweens: Phaser.Tweens.Tween[] = [];
    private readonly reducedMotion: boolean;
    private readonly reach = 55;
    private energized = false;
    private destroyed = false;

    readonly collider: Phaser.Types.Physics.Arcade.ImageWithStaticBody;

    constructor(scene: Phaser.Scene, x = 512, y = 360) {
        this.scene = scene;
        this.reducedMotion =
            typeof window !== "undefined" &&
            !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

        bakeTextures(scene);

        // buildQuestHall() already creates this white 2x2 collider texture.
        this.collider = scene.physics.add.staticImage(x, y + 12, "cb-g2-solid");
        this.collider.setDisplaySize(COLLIDER_W, COLLIDER_H);
        this.collider.refreshBody();
        this.collider.setVisible(false);
        this.footprint = new Phaser.Geom.Rectangle(
            x - COLLIDER_W / 2,
            y + 1,
            COLLIDER_W,
            COLLIDER_H,
        );

        this.root = scene.add
            .container(x, y)
            .setDepth(depthFor(this.footprint.bottom));

        const glowImage = (
            gx: number,
            gy: number,
            tint: number,
            sx: number,
            sy: number,
            alpha: number,
        ) =>
            scene.add
                .image(gx, gy, KEY.glow)
                .setTint(tint)
                .setBlendMode(Phaser.BlendModes.ADD)
                .setScale(sx, sy)
                .setAlpha(alpha);

        // Halo behind the arch
        const aura = glowImage(0, -70, 0x22d3ee, 2.6, 2.6, 0.3);
        this.root.add(aura);

        // Everything static is one baked texture.
        this.root.add(scene.add.image(-OX, -OY, KEY.base).setOrigin(0));

        // Teal light spilling onto the dais and floor
        const floorGlow = glowImage(0, 22, P.teal, 2.4, 0.7, 0.35);
        this.root.add(floorGlow);

        this.buildVortex();

        // Brightens while the player is close enough to interact.
        this.highlight = glowImage(0, -60, P.tealLight, 1.2, 1.6, 0);
        this.root.add(this.highlight);

        this.buildSconces();

        const label = scene.add
            .text(0, 47, "ADVENTURE PORTAL", {
                fontFamily: '"Press Start 2P", monospace',
                fontSize: "9px",
                color: "#55E8D5",
                stroke: "#08111F",
                strokeThickness: 4,
            })
            .setOrigin(0.5);
        this.root.add(label);

        this.prompt = this.buildPrompt(x, y + 82);

        if (!this.reducedMotion) {
            this.tweens.push(
                scene.tweens.add({
                    targets: aura,
                    alpha: { from: 0.22, to: 0.42 },
                    scaleX: { from: 2.4, to: 2.8 },
                    scaleY: { from: 2.4, to: 2.8 },
                    duration: 1550,
                    yoyo: true,
                    repeat: -1,
                    ease: "Sine.easeInOut",
                }),
                scene.tweens.add({
                    targets: floorGlow,
                    alpha: { from: 0.22, to: 0.45 },
                    duration: 1600,
                    yoyo: true,
                    repeat: -1,
                    ease: "Sine.easeInOut",
                }),
            );
        }
    }

    /** Distance from the player's collision FEET to the dais footprint. */
    isInRange(player: Phaser.GameObjects.Sprite): boolean {
        const body = player.body as Phaser.Physics.Arcade.Body | null;
        const px = body ? body.center.x : player.x;
        const py = body ? body.bottom : player.getBounds().bottom;
        const dx = Math.max(
            this.footprint.left - px,
            0,
            px - this.footprint.right,
        );
        const dy = Math.max(
            this.footprint.top - py,
            0,
            py - this.footprint.bottom,
        );
        return dx * dx + dy * dy <= this.reach * this.reach;
    }

    /** 'E' was consumed once in Game.ts and is passed through here. */
    update(
        player: Phaser.GameObjects.Sprite,
        enabled: boolean,
        pressedE: boolean,
        onInteract: () => void,
    ): void {
        if (this.destroyed) return;
        const active = enabled && this.isInRange(player);
        this.prompt.setVisible(active);
        if (active !== this.energized) this.setEnergized(active);
        if (active && pressedE) {
            this.hide();
            onInteract();
        }
    }

    hide(): void {
        this.prompt.setVisible(false);
        if (this.energized) this.setEnergized(false);
    }

    destroy(): void {
        if (this.destroyed) return;
        this.destroyed = true;
        this.tweens.forEach((tween) => tween.remove());
        this.scene.tweens.killTweensOf(this.highlight);
        this.prompt.destroy(true);
        this.root.destroy(true);
        this.collider.destroy();
    }

    // ======================================================================
    // INTERNALS
    // ======================================================================
    private setEnergized(on: boolean): void {
        this.energized = on;
        this.scene.tweens.killTweensOf(this.highlight);
        if (this.reducedMotion) {
            this.highlight.setAlpha(on ? 0.3 : 0);
            return;
        }
        this.scene.tweens.add({
            targets: this.highlight,
            alpha: on ? 0.35 : 0,
            duration: 180,
        });
    }

    /** Ripples, drifting mist and motes, all kept inside the opening. */
    private buildVortex(): void {
        const { scene, root } = this;

        // Pulsing core
        const core = scene.add
            .ellipse(0, -60, 52, 92, 0x17a39a, 0.32)
            .setBlendMode(Phaser.BlendModes.ADD);
        root.add(core);

        // Ripples expand from the center and fade before reaching the rim.
        for (let i = 0; i < 3; i++) {
            const ring = scene.add
                .image(0, -60, KEY.ring)
                .setTint(P.tealLight)
                .setBlendMode(Phaser.BlendModes.ADD);
            root.add(ring);

            if (this.reducedMotion) {
                ring.setScale(0.35 + i * 0.3).setAlpha(0.25);
            } else {
                this.tweens.push(
                    scene.tweens.add({
                        targets: ring,
                        scale: { from: 0.2, to: 1 },
                        alpha: { from: 0.7, to: 0 },
                        duration: 2400,
                        delay: i * 800,
                        repeat: -1,
                        ease: "Sine.easeOut",
                    }),
                );
            }
        }

        // Mist strips (positions chosen to stay inside the oval opening)
        const strips: [number, number, number][] = [
            [-22, -96, 27],
            [0, -88, 23],
            [-29, -73, 33],
            [8, -62, 23],
            [-18, -47, 31],
            [-4, -31, 25],
        ];
        strips.forEach(([sx, sy, w], i) => {
            const strip = scene.add
                .rectangle(sx, sy, w, 4, P.tealLight, 0.4)
                .setOrigin(0)
                .setBlendMode(Phaser.BlendModes.ADD);
            root.add(strip);
            if (!this.reducedMotion) {
                this.tweens.push(
                    scene.tweens.add({
                        targets: strip,
                        y: sy - 6,
                        alpha: { from: 0.15, to: 0.5 },
                        duration: 1100 + i * 130,
                        delay: i * 160,
                        yoyo: true,
                        repeat: -1,
                        ease: "Sine.easeInOut",
                    }),
                );
            }
        });

        // Floating motes
        const motes: [number, number][] = [
            [-26, -25],
            [-14, -50],
            [3, -72],
            [24, -38],
            [-20, -62],
            [12, -48],
            [26, -84],
        ];
        motes.forEach(([mx, my], i) => {
            const mote = scene.add.rectangle(
                mx,
                my,
                4 + (i % 2) * 2,
                4,
                0xc4f1ff,
                0.85,
            );
            root.add(mote);
            if (!this.reducedMotion) {
                this.tweens.push(
                    scene.tweens.add({
                        targets: mote,
                        y: my - 14,
                        alpha: { from: 0.15, to: 0.9 },
                        duration: 900 + i * 140,
                        delay: i * 180,
                        yoyo: true,
                        repeat: -1,
                    }),
                );
            }
        });

        if (!this.reducedMotion) {
            this.tweens.push(
                scene.tweens.add({
                    targets: core,
                    alpha: { from: 0.18, to: 0.5 },
                    duration: 700,
                    yoyo: true,
                    repeat: -1,
                }),
            );
        }
    }

    /** Torch flames on the pillars, matching the back wall's sconces. */
    private buildSconces(): void {
        const { scene, root } = this;

        for (const sx of [-49, 49]) {
            const glow = scene.add
                .image(sx, -84, KEY.glow)
                .setTint(0xfb923c)
                .setBlendMode(Phaser.BlendModes.ADD)
                .setScale(1.1)
                .setAlpha(0.32);
            const flame = scene.add
                .image(sx, -76, KEY.flame)
                .setOrigin(0.5, 1)
                .setScale(2);
            root.add([glow, flame]);

            if (!this.reducedMotion) {
                this.tweens.push(
                    scene.tweens.add({
                        targets: glow,
                        alpha: { from: 0.24, to: 0.4 },
                        scale: { from: 1, to: 1.25 },
                        duration: Phaser.Math.Between(140, 240),
                        yoyo: true,
                        repeat: -1,
                        delay: Phaser.Math.Between(0, 200),
                    }),
                    scene.tweens.add({
                        targets: flame,
                        scaleY: { from: 1.9, to: 2.4 },
                        duration: Phaser.Math.Between(120, 200),
                        yoyo: true,
                        repeat: -1,
                        delay: Phaser.Math.Between(0, 200),
                    }),
                );
            }
        }
    }

    /** "[E] ENTER PORTAL" on the same dark-wood, gold-trimmed plank as the hall's sign. */
    private buildPrompt(x: number, y: number): Phaser.GameObjects.Container {
        const { scene } = this;
        const w = 232;
        const h = 40;

        const plate = scene.add.graphics();
        plate.fillStyle(0x000000, 0.35).fillRect(-w / 2 + 4, -h / 2 + 4, w, h);
        plate.fillStyle(P.woodDark).fillRect(-w / 2, -h / 2, w, h);
        plate.fillStyle(P.gold).fillRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6);
        plate
            .fillStyle(P.dark)
            .fillRect(-w / 2 + 6, -h / 2 + 6, w - 12, h - 12);
        plate.fillStyle(P.gold);
        for (const [sx, sy] of [
            [-w / 2 + 12, -h / 2 + 10],
            [w / 2 - 16, -h / 2 + 10],
            [-w / 2 + 12, h / 2 - 14],
            [w / 2 - 16, h / 2 - 14],
        ]) {
            plate.fillRect(sx, sy, 4, 4);
        }

        // Key cap
        const cap = scene.add.graphics();
        cap.fillStyle(P.goldDark).fillRect(-12, -12, 24, 24);
        cap.fillStyle(P.gold).fillRect(-12, -12, 24, 21);
        cap.fillStyle(0xfde68a, 0.8).fillRect(-12, -12, 24, 3);
        const capLabel = scene.add
            .text(0, -1, "E", {
                fontFamily: '"Press Start 2P", monospace',
                fontSize: "12px",
                color: "#452312",
            })
            .setOrigin(0.5);
        const key = scene.add.container(-86, 0, [cap, capLabel]);

        const label = scene.add
            .text(20, 0, "ENTER PORTAL", {
                fontFamily: '"Press Start 2P", monospace',
                fontSize: "9px",
                color: "#D8FFF8",
            })
            .setOrigin(0.5);

        if (!this.reducedMotion) {
            this.tweens.push(
                scene.tweens.add({
                    targets: key,
                    scale: { from: 1, to: 1.12 },
                    duration: 600,
                    yoyo: true,
                    repeat: -1,
                    ease: "Sine.easeInOut",
                }),
            );
        }

        return scene.add
            .container(x, y, [plate, key, label])
            .setDepth(990)
            .setVisible(false);
    }
}
