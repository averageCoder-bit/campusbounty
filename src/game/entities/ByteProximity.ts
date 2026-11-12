import * as Phaser from "phaser";

/**
 * Interaction with the existing Byte sprite/dais in QuestHallMap.ts.
 *
 * Measure distance from the player's feet to the dais COLLISION RECTANGLE,
 * not to a point below Byte. This lets the player talk from the front,
 * sides, or behind the platform without reaching through half the room.
 *
 * Keep these bounds in sync with QuestHallMap.ts if the dais changes.
 */
export class ByteProximity {
    private readonly keyboard: Phaser.Input.Keyboard.KeyboardPlugin;
    private readonly interactionKey: Phaser.Input.Keyboard.Key;
    private readonly prompt: Phaser.GameObjects.Container;

    // Current Byte dais collider: x = 161..319, y = 329..409.
    private readonly dais = new Phaser.Geom.Rectangle(161, 329, 158, 80);

    // Distance in WORLD pixels from any edge of the dais.
    // 48px allows talking from each side without a large activation bubble.
    private readonly talkDistance = 48;

    constructor(scene: Phaser.Scene) {
        if (!scene.input.keyboard) {
            throw new Error("Byte interaction requires keyboard input.");
        }

        this.keyboard = scene.input.keyboard;
        this.interactionKey = this.keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.E,
        );

        const box = scene.add
            .rectangle(0, 0, 178, 39, 0x0b1423, 0.96)
            .setStrokeStyle(3, 0x55e8d5);

        const label = scene.add
            .text(0, 0, "[E]  TALK TO BYTE", {
                fontFamily: '"Press Start 2P", monospace',
                fontSize: "9px",
                color: "#D8FFF8",
                align: "center",
            })
            .setOrigin(0.5);

        // World-space prompt: moves/zooms with the Quest Hall camera.
        this.prompt = scene.add
            .container(240, 271, [box, label])
            .setDepth(950)
            .setVisible(false);
    }

    /**
     * Extra margin is useful only while dialogue is already open.
     * For example, 12px creates an exit threshold of 60px while the
     * normal E-talk threshold stays 48px, avoiding flicker at the edge.
     */
    isInRange(player: Phaser.GameObjects.Sprite, extraMargin = 0): boolean {
        const arcadeBody = player.body as Phaser.Physics.Arcade.Body | null;

        // Use the actual collision feet; sprite artwork may extend above them.
        const feetX = arcadeBody ? arcadeBody.center.x : player.x;
        const feetY = arcadeBody
            ? arcadeBody.bottom
            : player.getBounds().bottom;

        // Shortest horizontal and vertical distances to the rectangle.
        // Both values are 0 if the feet are within that axis' bounds.
        const dx = Math.max(this.dais.left - feetX, 0, feetX - this.dais.right);
        const dy = Math.max(this.dais.top - feetY, 0, feetY - this.dais.bottom);

        const maxDistance = this.talkDistance + Math.max(0, extraMargin);
        return dx * dx + dy * dy <= maxDistance * maxDistance;
    }

    update(
        player: Phaser.GameObjects.Sprite,
        enabled: boolean,
        onInteract: () => void,
        pressedE?: boolean,
    ): void {
        // Game.ts reads E once and passes its value to both interactions.
        // The fallback preserves compatibility with older integrations.
        const pressed =
            pressedE ?? Phaser.Input.Keyboard.JustDown(this.interactionKey);
        const canTalk = enabled && this.isInRange(player);

        this.prompt.setVisible(canTalk);

        if (canTalk && pressed) {
            this.prompt.setVisible(false);
            onInteract();
        }
    }

    hide(): void {
        this.prompt.setVisible(false);
    }

    destroy(): void {
        this.keyboard.removeKey(this.interactionKey);
        this.prompt.destroy(true);
    }
}

