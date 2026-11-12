import * as Phaser from "phaser";

/**
 * Top-down scene painter sorting for actors (Player, future NPCs).
 *
 * A character is sorted by the bottom of its visible feet, NOT its sprite's
 * center. Props in QuestHallMap use the Y of their physical base.
 *
 * Collision uses Arcade static bodies and never needs to be resized here.
 */
export class TopDownDepthSystem {
    private readonly actors = new Set<Phaser.GameObjects.Sprite>();

    register(actor: Phaser.GameObjects.Sprite): void {
        this.actors.add(actor);
        this.updateActor(actor);
    }

    unregister(actor: Phaser.GameObjects.Sprite): void {
        this.actors.delete(actor);
    }

    update(): void {
        for (const actor of this.actors) {
            if (actor.active) this.updateActor(actor);
        }
    }

    destroy(): void {
        this.actors.clear();
    }

    private updateActor(actor: Phaser.GameObjects.Sprite): void {
        // Works for center-origin sprites or a custom originY.
        // -3px keeps the visual foot contact point just above the last pixel.
        const feetY = Math.round(
            actor.y + actor.displayHeight * (1 - actor.originY) - 3,
        );
        if (actor.depth !== feetY) actor.setDepth(feetY);
    }
}
