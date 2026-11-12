import * as Phaser from "phaser";
import { EventBus } from "../EventBus";
import { Player } from "../entities/Player";
import { ByteProximity } from "../entities/ByteProximity";
import { TopDownDepthSystem } from "../systems/TopDownDepthSystem";
import { MouseLeadCamera } from "../systems/MouseLeadCamera";
import { buildQuestHall, HALL } from "../world/QuestHallMap";
import { MenuOverlay } from "../ui/MenuOverlay";
import { ByteDialogue } from "../ui/ByteDialogue";

/**
 * CampusBounty — Quest Hall
 *
 * Features:
 * - Eight-direction movement
 * - World collisions
 * - Dynamic depth sorting
 * - Mouse-leading camera
 * - Independent player HUD
 * - XP and settings overlay
 * - Byte NPC proximity interaction
 * - Full-width animated dialogue
 * - Walk-away dialogue dismissal
 */
export class Game extends Phaser.Scene {
    private player?: Player;
    private menuOverlay?: MenuOverlay;
    private mouseLead?: MouseLeadCamera;

    private byteProximity?: ByteProximity;
    private byteDialogue?: ByteDialogue;

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
        // 6. BYTE PROXIMITY INTERACTION
        // ==========================================

        // Byte is already rendered in QuestHallMap.
        // This system handles proximity and the E prompt.

        this.byteProximity = new ByteProximity(this);

        // ==========================================
        // 7. INDEPENDENT HUD CAMERA
        // ==========================================

        const worldObjects = [...this.children.list];

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

        // Avoid rendering world objects twice.
        uiCamera.ignore(worldObjects);

        // ==========================================
        // 8. CONTROL HINTS
        // ==========================================

        const controlsHint = this.add
            .text(
                HALL.width / 2,
                734,
                "WASD MOVE   E TALK   MOUSE LOOK   ESC SETTINGS",
                {
                    fontFamily: '"Press Start 2P", monospace',
                    fontSize: "11px",
                    color: "#94A3B8",
                },
            )
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(100);

        worldCamera.ignore(controlsHint);

        // ==========================================
        // 9. PLAYER HUD / SETTINGS
        // ==========================================

        this.menuOverlay = new MenuOverlay(this, {
            avatarTextureKey: this.player.sprite.texture.key,

            // Settings cannot open during Byte's dialogue.
            canToggleSettings: () => !this.byteDialogue?.isOpen,

            progress: {
                displayName: "STUDENT",
                level: 1,
                xp: 0,
                xpToNext: 100,
            },

            onPauseChanged: (paused: boolean) => {
                // Only Settings should pause the camera.
                this.mouseLead?.setEnabled(!paused);

                if (paused) {
                    this.byteProximity?.hide();

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
                this.scene.start("MainMenu");
            },
        });

        worldCamera.ignore(this.menuOverlay.getCameraObjects());

        // ==========================================
        // 10. BYTE DIALOGUE SYSTEM
        // ==========================================

        this.byteDialogue = new ByteDialogue(this, {
            typingSpeedMs: 27,

            onOpenChanged: (open: boolean) => {
                // Hide bottom control hints during dialogue.
                controlsHint.setVisible(!open);

                // Hide the E prompt while Byte is talking.
                if (open) {
                    this.byteProximity?.hide();
                }

                // IMPORTANT:
                // Do NOT disable player movement or mouse-look.
                // Dialogue is non-modal.
            },
        });

        worldCamera.ignore(this.byteDialogue.getCameraObjects());

        // ==========================================
        // 11. SCENE CLEANUP
        // ==========================================

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            // NPC interaction and dialogue.
            this.byteDialogue?.destroy();
            this.byteDialogue = undefined;

            this.byteProximity?.destroy();
            this.byteProximity = undefined;

            // Player HUD.
            this.menuOverlay?.destroy();
            this.menuOverlay = undefined;

            // Mouse-leading camera.
            this.mouseLead?.destroy();
            this.mouseLead = undefined;

            // Restore shared animation state.
            this.anims.resumeAll();
            this.tweens.resumeAll();
            this.time.paused = false;

            // Gameplay entities.
            this.depthSystem.destroy();

            this.player?.destroy();
            this.player = undefined;

            // Remove the additional UI camera.
            if (this.cameras.cameras.includes(uiCamera)) {
                this.cameras.remove(uiCamera);
            }
        });

        // ==========================================
        // 12. REACT EVENT
        // ==========================================

        EventBus.emit("current-scene-ready", this);
    }

    update(_time: number, delta: number): void {
        // ==========================================
        // 1. SETTINGS PAUSE
        // ==========================================

        // Settings remain a hard pause.
        if (this.menuOverlay?.isOpen) {
            return;
        }

        // ==========================================
        // 2. NORMAL GAMEPLAY
        // ==========================================

        // Always allow movement, even during dialogue.
        this.player?.update();

        // Keep player depth sorting active.
        this.depthSystem.update();

        // Keep mouse-leading camera active.
        this.mouseLead?.update(delta);

        // Require all NPC components.
        if (!this.player || !this.byteProximity || !this.byteDialogue) {
            return;
        }

        // ==========================================
        // 3. BYTE DIALOGUE
        // ==========================================

        if (this.byteDialogue.isOpen) {
            // Hide and disable the E prompt while talking.
            this.byteProximity.update(this.player.sprite, false, () => {});

            // Automatically close when the player
            // walks outside Byte's interaction area.
            //
            // The extra 12px is exit tolerance to
            // avoid flickering near the boundary.
            const stillNearby = this.byteProximity.isInRange(
                this.player.sprite,
                12,
            );

            if (!stillNearby) {
                this.byteDialogue.close();
            } else {
                // Continue typewriter animation.
                this.byteDialogue.update(delta);
            }

            return;
        }

        // ==========================================
        // 4. BYTE PROXIMITY CHECK
        // ==========================================

        this.byteProximity.update(this.player.sprite, true, () => {
            this.byteDialogue?.open();
        });
    }
}
