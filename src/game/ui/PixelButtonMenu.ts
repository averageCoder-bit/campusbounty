import * as Phaser from "phaser";
import { THEME, textStyle } from "./Theme";

const SHADOW = 6;
const HOVER_LIFT = -2;
const PRESS_DROP = SHADOW - 2;

/**
 * Retro button. The shadow stays put while the face lifts on hover and
 * sinks on press, like a physical key.
 */
export class PixelButtonMenu extends Phaser.GameObjects.Container {
    private readonly face: Phaser.GameObjects.Container;
    private readonly inner: Phaser.GameObjects.Rectangle;
    private readonly label: Phaser.GameObjects.Text;
    private readonly onClick: () => void;
    private pressed = false;

    constructor(
        scene: Phaser.Scene,
        x: number,
        y: number,
        width: number,
        height: number,
        text: string,
        onClick: () => void,
    ) {
        super(scene, x, y);
        this.onClick = onClick;

        const R = Phaser.GameObjects.Rectangle;
        const shadow = new R(
            scene,
            SHADOW,
            SHADOW,
            width,
            height,
            0x000000,
            0.45,
        );
        const outer = new R(scene, 0, 0, width, height, 0xffffff);
        this.inner = new R(scene, 0, 0, width - 8, height - 8, THEME.gold);
        const highlight = new R(
            scene,
            0,
            -height / 2 + 8,
            width - 8,
            8,
            THEME.goldLight,
        );

        this.label = new Phaser.GameObjects.Text(
            scene,
            0,
            0,
            text,
            textStyle(18, THEME.ink),
        ).setOrigin(0.5);

        this.face = new Phaser.GameObjects.Container(scene, 0, 0, [
            outer,
            this.inner,
            highlight,
            this.label,
        ]);

        this.add([shadow, this.face]);

        // The hit area stays fixed, so the button doesn't flicker as the face moves.
        this.setSize(width, height);
        this.setInteractive({ useHandCursor: true });

        this.on("pointerover", this.handleOver, this);
        this.on("pointerout", this.handleOut, this);
        this.on("pointerdown", this.handleDown, this);
        this.on("pointerup", this.handleUp, this);

        scene.add.existing(this);
    }

    /** Plays the press animation, then fires the callback (keyboard / gamepad). */
    activate(): void {
        this.face.y = PRESS_DROP;
        this.scene.time.delayedCall(90, () => {
            this.face.y = 0;
            this.onClick();
        });
    }

    private handleOver(): void {
        this.inner.setFillStyle(THEME.goldHover);
        this.label.setScale(1.03);
        if (!this.pressed) this.face.y = HOVER_LIFT;
    }

    private handleOut(): void {
        this.pressed = false;
        this.inner.setFillStyle(THEME.gold);
        this.label.setScale(1);
        this.face.y = 0;
    }

    private handleDown(): void {
        this.pressed = true;
        this.face.y = PRESS_DROP;
    }

    private handleUp(): void {
        if (!this.pressed) return;
        this.pressed = false;
        this.face.y = HOVER_LIFT;
        this.onClick();
    }
}
