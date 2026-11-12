import * as Phaser from "phaser";

/**
 * A procedural portal in the EXISTING Quest Hall, between Byte and the board.
 * No external texture files required. E is dispatched from Game.ts so it
 * cannot conflict with Byte/QuestBoard interactions.
 *
 * Art is based around (512, 360); the stone pedestal is collidable.
 */
export class AdventurePortal {
    private readonly root: Phaser.GameObjects.Container;
    private readonly prompt: Phaser.GameObjects.Container;
    private readonly footprint: Phaser.Geom.Rectangle;
    private readonly tweens: Phaser.Tweens.Tween[] = [];
    private readonly reach = 55;
    private destroyed = false;

    readonly collider: Phaser.Types.Physics.Arcade.ImageWithStaticBody;

    constructor(scene: Phaser.Scene, x = 512, y = 360) {
        const reducedMotion = typeof window !== "undefined" &&
            !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

        // buildQuestHall() already creates this white 2x2 collider texture.
        this.collider = scene.physics.add.staticImage(x, y + 12, "cb-g2-solid");
        this.collider.setDisplaySize(112, 22);
        this.collider.refreshBody();
        this.collider.setVisible(false);
        this.footprint = new Phaser.Geom.Rectangle(x - 56, y + 1, 112, 22);

        this.root = scene.add.container(x, y).setDepth(y + 3);

        // Soft magical halo behind the 16-bit portal frame.
        const aura = scene.add.ellipse(0, -69, 162, 160, 0x22d3ee, 0.12)
            .setBlendMode(Phaser.BlendModes.ADD);
        this.root.add(aura);

        const frame = scene.add.graphics();
        const fill = (px: number, py: number, w: number, h: number, color: number, alpha = 1) => {
            frame.fillStyle(color, alpha);
            frame.fillRect(px, py, w, h);
        };

        // Ground shadow + stair-stepped pedestal.
        fill(-73, 20, 146, 12, 0x050a14, 0.55);
        fill(-66, 6, 132, 19, 0x102e41);
        fill(-60, 2, 120, 15, 0x22506a);
        fill(-54, -1, 108, 10, 0x50748a);
        fill(-48, -5, 96, 6, 0xfbbf24);
        fill(-62, 16, 124, 5, 0x0b1423);
        for (const px of [-51, -28, 22, 45]) fill(px, 9, 7, 5, 0x7dd3fc);

        // Pixel-stepped portal arch, drawn from OUTSIDE toward the core.
        fill(-38, -147, 76, 9, 0x0a1628);
        fill(-49, -138, 98, 10, 0x0a1628);
        fill(-58, -128, 116, 125, 0x0a1628);
        fill(-31, -143, 62, 8, 0xfbbf24);
        fill(-43, -135, 86, 9, 0xd68b26);
        fill(-52, -125, 104, 124, 0x9b6123);
        fill(-48, -121, 96, 117, 0x67e8f9);
        fill(-40, -116, 80, 110, 0x1b8ea8);
        fill(-36, -110, 72, 103, 0x071c38);
        this.root.add(frame);

        // Shimmering interior stays *inside* the frame; strips create a pixel
        // texture without relying on external image files or a shader.
        const core = scene.add.rectangle(0, -57, 62, 92, 0x0891b2, 0.46)
            .setBlendMode(Phaser.BlendModes.ADD);
        this.root.add(core);

        const mist = scene.add.graphics();
        mist.fillStyle(0x67e8f9, 0.48);
        for (const [px, py, w] of [
            [-22, -96, 27], [0, -88, 23], [-29, -73, 33],
            [8, -62, 23], [-18, -47, 31], [-4, -31, 25],
        ]) {
            mist.fillRect(px, py, w, 5);
        }
        mist.fillStyle(0xc4f1ff, 0.8);
        mist.fillRect(-4, -108, 8, 8);
        mist.fillRect(16, -43, 7, 7);
        this.root.add(mist);

        const trim = scene.add.graphics();
        trim.fillStyle(0xfbbf24);
        for (const [px, py] of [[-56, -110], [50, -110], [-56, -24], [50, -24]]) {
            trim.fillRect(px, py, 6, 12);
        }
        trim.fillStyle(0xc4f1ff);
        trim.fillRect(-4, -141, 8, 5);
        this.root.add(trim);

        // A few floating motes make the portal visibly active.
        for (let i = 0; i < 7; i++) {
            const sx = [-31, -15, 3, 25, -23, 13, 29][i];
            const sy = [-25, -63, -101, -38, -85, -53, -108][i];
            const mote = scene.add.rectangle(sx, sy, 4 + (i % 2) * 2, 4, 0xc4f1ff, 0.85);
            this.root.add(mote);
            if (!reducedMotion) {
                this.tweens.push(scene.tweens.add({
                    targets: mote,
                    y: sy - 18,
                    alpha: { from: 0.15, to: 0.9 },
                    duration: 900 + i * 140,
                    delay: i * 180,
                    yoyo: true,
                    repeat: -1,
                }));
            }
        }
        if (!reducedMotion) {
            this.tweens.push(scene.tweens.add({
                targets: aura,
                alpha: { from: 0.35, to: 0.8 },
                scaleX: { from: 0.95, to: 1.1 },
                scaleY: { from: 0.95, to: 1.08 },
                duration: 1550,
                yoyo: true,
                repeat: -1,
            }));
            this.tweens.push(scene.tweens.add({
                targets: core,
                alpha: { from: 0.25, to: 0.7 },
                duration: 700,
                yoyo: true,
                repeat: -1,
            }));
        }

        const portalLabel = scene.add.text(0, 47, "ADVENTURE PORTAL", {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: "9px",
            color: "#55E8D5",
            stroke: "#08111F",
            strokeThickness: 4,
        }).setOrigin(0.5);
        this.root.add(portalLabel);

        const promptBackground = scene.add.rectangle(0, 0, 222, 39, 0x0b1423, 0.96)
            .setStrokeStyle(3, 0x55e8d5);
        const promptLabel = scene.add.text(0, 0, "[E]  ENTER PORTAL", {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: "9px",
            color: "#D8FFF8",
        }).setOrigin(0.5);
        this.prompt = scene.add.container(x, y + 82, [promptBackground, promptLabel])
            .setDepth(990)
            .setVisible(false);
    }

    /** Distance from the player's collision FEET to the pedestal footprint. */
    isInRange(player: Phaser.GameObjects.Sprite): boolean {
        const body = player.body as Phaser.Physics.Arcade.Body | null;
        const px = body ? body.center.x : player.x;
        const py = body ? body.bottom : player.getBounds().bottom;
        const dx = Math.max(this.footprint.left - px, 0, px - this.footprint.right);
        const dy = Math.max(this.footprint.top - py, 0, py - this.footprint.bottom);
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
        if (active && pressedE) {
            this.hide();
            onInteract();
        }
    }

    hide(): void {
        this.prompt.setVisible(false);
    }

    destroy(): void {
        if (this.destroyed) return;
        this.destroyed = true;
        this.tweens.forEach(tween => tween.remove());
        this.prompt.destroy(true);
        this.root.destroy(true);
        this.collider.destroy();
    }
}
