import * as Phaser from "phaser";
import { EventBus } from "../EventBus";
import { Player } from "../entities/Player";
import { TopDownDepthSystem } from "../systems/TopDownDepthSystem";
import { buildQuestHall, HALL } from "../world/QuestHallMap";

/** G2.1: playable top-down Quest Hall, preserving the existing "Game" scene key. */
export class Game extends Phaser.Scene {
    private player?: Player;
    private readonly depthSystem = new TopDownDepthSystem();

    constructor() {
        super("Game"); // MainMenu currently calls this.scene.start("Game").
    }

    create(): void {
        this.cameras.main.setBackgroundColor("#08111F");
        this.cameras.main.fadeIn(250, 8, 17, 31);
        this.physics.world.setBounds(
            HALL.walkable.x,
            HALL.walkable.y,
            HALL.walkable.width,
            HALL.walkable.height,
        );

        const obstacles = buildQuestHall(this);
        this.player = new Player(this, HALL.spawn.x, HALL.spawn.y);
        this.depthSystem.register(this.player.sprite);
        this.physics.add.collider(this.player.sprite, obstacles);

        this.add
            .text(HALL.width / 2, 734, "WASD / ARROWS  MOVE     ESC  MENU", {
                fontFamily: '"Press Start 2P", monospace',
                fontSize: "12px",
                color: "#94A3B8",
            })
            .setOrigin(0.5)
            .setDepth(100);

        const backToMenu = () => this.scene.start("MainMenu");
        this.input.keyboard?.on("keydown-ESC", backToMenu);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.input.keyboard?.off("keydown-ESC", backToMenu);
            this.depthSystem.destroy();
            this.player = undefined;
        });

        EventBus.emit("current-scene-ready", this);
    }

    update(): void {
        this.player?.update();
        this.depthSystem.update();
    }
}
