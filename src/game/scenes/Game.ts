import * as Phaser from "phaser";
import { EventBus } from "../EventBus";
import { Player } from "../entities/Player";
import { TopDownDepthSystem } from "../systems/TopDownDepthSystem";
import { MouseLeadCamera } from "../systems/MouseLeadCamera";
import { buildQuestHall, HALL } from "../world/QuestHallMap";
import { MenuOverlay } from "../ui/MenuOverlay";

/**
 * CampusBounty — Quest Hall
 *
 * Features:
 * - Eight-direction player movement
 * - Arcade Physics collisions
 * - Dynamic depth sorting
 * - Cursor-driven camera look-ahead
 * - Independent screen-fixed HUD
 * - XP progression interface
 * - ESC pause and settings menu
 */
export class Game extends Phaser.Scene {
    private player?: Player;
    private menuOverlay?: MenuOverlay;
    private mouseLead?: MouseLeadCamera;

    private readonly depthSystem = new TopDownDepthSystem();

    constructor() {
        super("Game");
    }

    create(): void {
        // ==========================================
        // 1. WORLD CAMERA
        // ==========================================

        const worldCamera = this.cameras.main;

        worldCamera.setBackgroundColor("#08111F");
        worldCamera.fadeIn(250, 8, 17, 31);

        // ==========================================
        // 2. PHYSICS WORLD
        // ==========================================

        this.physics.world.setBounds(
            HALL.walkable.x,
            HALL.walkable.y,
            HALL.walkable.width,
            HALL.walkable.height,
        );

        // ==========================================
        // 3. QUEST HALL ENVIRONMENT
        // ==========================================

        const obstacles = buildQuestHall(this);

        // ==========================================
        // 4. PLAYER
        // ==========================================

        this.player = new Player(this, HALL.spawn.x, HALL.spawn.y);

        this.physics.add.collider(this.player.sprite, obstacles);

        this.depthSystem.register(this.player.sprite);

        // ==========================================
        // 5. MOUSE-LEADING CAMERA
        // ==========================================

        this.mouseLead = new MouseLeadCamera(
            this,
            this.player.sprite,
            HALL.width,
            HALL.height,
            {
                zoom: 1.25,
                maxLeadX: 90,
                maxLeadY: 60,
                deadzone: 0.12,
                smoothingMs: 170,
            },
        );

        // ==========================================
        // 6. INDEPENDENT HUD CAMERA
        // ==========================================

        // Capture all existing world objects.
        const worldObjects = [...this.children.list];

        // Separate camera for UI elements.
        const uiCamera = this.cameras.add(
            0,
            0,
            HALL.width,
            HALL.height,
            false,
            "HUD",
        );

        uiCamera.setZoom(1);
        uiCamera.setScroll(0, 0);

        // Don't draw the world twice.
        uiCamera.ignore(worldObjects);

        // ==========================================
        // 7. CONTROL HINTS
        // ==========================================

        const controlsHint = this.add
            .text(
                HALL.width / 2,
                734,
                "WASD / ARROWS MOVE   MOUSE LOOK   ESC SETTINGS",
                {
                    fontFamily: '"Press Start 2P", monospace',
                    fontSize: "11px",
                    color: "#94A3B8",
                },
            )
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(100);

        // Only the UI camera should display this.
        worldCamera.ignore(controlsHint);

        // ==========================================
        // 8. PLAYER HUD / SETTINGS
        // ==========================================

        this.menuOverlay = new MenuOverlay(this, {
            avatarTextureKey: this.player.sprite.texture.key,

            progress: {
                displayName: "STUDENT",
                level: 1,
                xp: 0,
                xpToNext: 100,
            },

            onPauseChanged: (paused: boolean) => {
                // Stop cursor-driven camera updates.
                this.mouseLead?.setEnabled(!paused);

                if (paused) {
                    this.player?.sprite.setVelocity(0, 0);

                    this.physics.world?.pause();
                    this.anims.pauseAll();
                    this.tweens.pauseAll();
                    this.time.paused = true;
                } else {
                    this.physics.world?.resume();
                    this.anims.resumeAll();
                    this.tweens.resumeAll();
                    this.time.paused = false;
                }
            },

            onReturnToMenu: () => {
                // MenuOverlay closes settings first,
                // restoring the paused game systems.
                this.scene.start("MainMenu");
            },
        });

        // Prevent the world camera from rendering
        // the XP HUD and settings overlay.
        worldCamera.ignore(this.menuOverlay.getCameraObjects());

        // ==========================================
        // 9. SCENE CLEANUP
        // ==========================================

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.menuOverlay?.destroy();
            this.menuOverlay = undefined;

            this.mouseLead?.destroy();
            this.mouseLead = undefined;

            this.anims.resumeAll();
            this.tweens.resumeAll();
            this.time.paused = false;

            this.depthSystem.destroy();

            this.player?.destroy();
            this.player = undefined;

            // Remove the independent HUD camera.
            if (this.cameras.cameras.includes(uiCamera)) {
                this.cameras.remove(uiCamera);
            }

            // No physics.world.resume() during shutdown.
        });

        // ==========================================
        // 10. REACT EVENT
        // ==========================================

        EventBus.emit("current-scene-ready", this);
    }

    update(_time: number, delta: number): void {
        // Disable movement and mouse-look during settings.
        if (this.menuOverlay?.isOpen) {
            return;
        }

        this.player?.update();

        this.depthSystem.update();

        // Smooth camera look-ahead.
        this.mouseLead?.update(delta);
    }
}
