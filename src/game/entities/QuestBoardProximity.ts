import * as Phaser from "phaser";

/**
 * G3.1: proximity to the EXISTING Quest Board in QuestHallMap.ts.
 * Visible artwork: x~728..888, y~222..359.
 * Floor-contact physics collider: center (808,354), size (156,12).
 * No duplicate scenery, no keyboard ownership: Game.ts dispatches E once.
 */
export class QuestBoardProximity {
    private readonly prompt: Phaser.GameObjects.Container;

    private readonly boardFootprint = new Phaser.Geom.Rectangle(730, 348, 156, 12);
    private readonly reach = 49;

    constructor(scene: Phaser.Scene) {
        const back = scene.add.rectangle(0, 0, 208, 39, 0x0b1423, 0.96)
            .setStrokeStyle(3, 0xfbbf24);
        const title = scene.add.text(0, 0, "[E]  LEARNING BOARD", {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: "9px",
            color: "#FFE7AF",
        }).setOrigin(0.5);
        // In world coordinates; the game's WORLD camera pans this with the board.
        this.prompt = scene.add.container(808, 196, [back, title])
            .setDepth(960)
            .setVisible(false);
    }

    /** Feet-to-rectangle distance, independent of camera zoom. */
    isInRange(player: Phaser.GameObjects.Sprite): boolean {
        const body = player.body as Phaser.Physics.Arcade.Body | null;
        const px = body ? body.center.x : player.x;
        const py = body ? body.bottom : player.getBounds().bottom;
        const dx = Math.max(this.boardFootprint.left - px, 0, px - this.boardFootprint.right);
        const dy = Math.max(this.boardFootprint.top - py, 0, py - this.boardFootprint.bottom);
        return dx * dx + dy * dy <= this.reach * this.reach;
    }

    update(
        player: Phaser.GameObjects.Sprite,
        enabled: boolean,
        onInteract: () => void,
        pressedE: boolean,
    ): void {
        const canInteract = enabled && this.isInRange(player);
        this.prompt.setVisible(canInteract);
        if (canInteract && pressedE) {
            this.hide();
            onInteract();
        }
    }

    hide(): void {
        this.prompt.setVisible(false);
    }

    destroy(): void {
        this.prompt.destroy(true);
    }
}
