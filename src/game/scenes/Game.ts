import * as Phaser from "phaser";
import { EventBus } from "../EventBus";
import { Player } from "../entities/Player";
import { ByteProximity } from "../entities/ByteProximity";
import { QuestBoardProximity } from "../entities/QuestBoardProximity";
import { AdventurePortal } from "../entities/AdventurePortal";
import { TopDownDepthSystem } from "../systems/TopDownDepthSystem";
import { MouseLeadCamera } from "../systems/MouseLeadCamera";
import { buildQuestHall, HALL } from "../world/QuestHallMap";
import { MenuOverlay } from "../ui/MenuOverlay";
import { ByteDialogue } from "../ui/ByteDialogue";
import { QuestBoardUI } from "../ui/QuestBoardUI";
import { AdventurePortalUI } from "../ui/AdventurePortalUI";
import { getGameSession } from "../data/GameSession";

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
 * - Quest Board learning roadmap previews
 * - Shared E-key dispatch for NPC, Quest Board, and Portal interactions
 * - Animated Adventure Portal and game-mode selection
 */
export class Game extends Phaser.Scene {
    private player?: Player;
    private menuOverlay?: MenuOverlay;
    private mouseLead?: MouseLeadCamera;

    private byteProximity?: ByteProximity;
    private byteDialogue?: ByteDialogue;
    private boardProximity?: QuestBoardProximity;
    private questBoardUI?: QuestBoardUI;
    private adventurePortal?: AdventurePortal;
    private adventurePortalUI?: AdventurePortalUI;
    private interactKey?: Phaser.Input.Keyboard.Key;

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
        this.boardProximity = new QuestBoardProximity(this);

        // Magical arch in the back-center of the hall, between Byte and the
        // learning noticeboard. Includes its own feet-based interaction area.
        this.adventurePortal = new AdventurePortal(this, 512, 360);
        this.physics.add.collider(
            this.player.sprite,
            this.adventurePortal.collider,
        );

        // Read E once per frame: Phaser JustDown consumes the event.
        // ByteProximity.update must accept the optional pressedE argument
        // from the G3.1 patch so both interactions can share the same key.
        this.interactKey = this.input.keyboard?.addKey(
            Phaser.Input.Keyboard.KeyCodes.E,
        );

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
                "WASD MOVE   E INTERACT   MOUSE LOOK   ESC SETTINGS",
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

        const session = getGameSession(this);

        this.menuOverlay = new MenuOverlay(this, {
            avatarTextureKey: this.player.sprite.texture.key,

            // Settings cannot open during Byte's dialogue.
            canToggleSettings: () =>
                !this.byteDialogue?.isOpen &&
                !this.questBoardUI?.isOpen &&
                !this.adventurePortalUI?.isOpen,

            progress: {
                displayName: "STUDENT",
                level: session.level,
                xp: session.xp,
                xpToNext: session.xpToNext,
            },

            onPauseChanged: (paused: boolean) => {
                // Only Settings should pause the camera.
                this.mouseLead?.setEnabled(
                    !paused &&
                        !this.questBoardUI?.isOpen &&
                        !this.adventurePortalUI?.isOpen,
                );

                if (paused) {
                    this.byteProximity?.hide();
                    this.boardProximity?.hide();
                    this.adventurePortal?.hide();

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

        // Local-demo currency is session-only and never represents real tokens.
        const coinReadout = this.add
            .text(28, 139, `COINS  ${session.coins}`, {
                fontFamily: '"Press Start 2P", monospace',
                fontSize: "9px",
                color: "#FBBF24",
            })
            .setScrollFactor(0)
            .setDepth(9000);
        worldCamera.ignore(coinReadout);

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
        // 11. QUEST BOARD LEARNING HUB
        // ==========================================

        // Screen-fixed: rendered on the 1x HUD camera only.
        this.questBoardUI = new QuestBoardUI(this, {
            onOpenChanged: (open: boolean) => {
                controlsHint.setVisible(
                    !open &&
                        !this.adventurePortalUI?.isOpen &&
                        !this.byteDialogue?.isOpen,
                );
                this.mouseLead?.setEnabled(
                    !open &&
                        !this.adventurePortalUI?.isOpen &&
                        !this.menuOverlay?.isOpen,
                );
                if (open) {
                    this.player?.sprite.setVelocity(0, 0);
                    this.player?.sprite.anims.stop();
                    this.byteProximity?.hide();
                    this.boardProximity?.hide();
                    this.adventurePortal?.hide();
                }
            },
        });
        worldCamera.ignore(this.questBoardUI.getCameraObjects());

        // ==========================================
        // 12. ADVENTURE PORTAL SELECTION MENU
        // ==========================================

        this.adventurePortalUI = new AdventurePortalUI(this, {
            onOpenChanged: (open: boolean) => {
                controlsHint.setVisible(
                    !open &&
                        !this.questBoardUI?.isOpen &&
                        !this.byteDialogue?.isOpen,
                );
                this.mouseLead?.setEnabled(
                    !open &&
                        !this.questBoardUI?.isOpen &&
                        !this.menuOverlay?.isOpen,
                );
                if (open) {
                    this.player?.sprite.setVelocity(0, 0);
                    this.player?.sprite.anims.stop();
                    this.byteProximity?.hide();
                    this.boardProximity?.hide();
                    this.adventurePortal?.hide();
                }
            },
            // Only Quest Finding is implemented and playable at this milestone.
            availableModes: ["quest-finding"],
            onLaunch: (mode) => {
                if (mode === "quest-finding") {
                    this.scene.start("QuestFinding");
                }
            },
        });
        worldCamera.ignore(this.adventurePortalUI.getCameraObjects());

        // ==========================================
        // 13. SCENE CLEANUP
        // ==========================================

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            // Portal UI, animation, and static collider.
            this.adventurePortalUI?.destroy();
            this.adventurePortalUI = undefined;
            this.adventurePortal?.destroy();
            this.adventurePortal = undefined;

            // Quest Board UI and proximity.
            this.questBoardUI?.destroy();
            this.questBoardUI = undefined;

            this.boardProximity?.destroy();
            this.boardProximity = undefined;
            this.interactKey = undefined;

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
        // 14. REACT EVENT
        // ==========================================

        EventBus.emit("current-scene-ready", this);
    }

    update(_time: number, delta: number): void {
        // Shared E input is consumed exactly once each frame.
        const pressedE = this.interactKey
            ? Phaser.Input.Keyboard.JustDown(this.interactKey)
            : false;

        // Settings, learning board, and adventure selector are modal.
        // Byte dialogue remains non-modal (walk-away closes it).
        if (
            this.menuOverlay?.isOpen ||
            this.questBoardUI?.isOpen ||
            this.adventurePortalUI?.isOpen
        ) {
            return;
        }

        // Movement, depth and camera continue while talking to Byte.
        this.player?.update();
        this.depthSystem.update();
        this.mouseLead?.update(delta);

        if (
            !this.player ||
            !this.byteProximity ||
            !this.boardProximity ||
            !this.byteDialogue ||
            !this.questBoardUI ||
            !this.adventurePortal ||
            !this.adventurePortalUI
        ) {
            return;
        }

        const playerSprite = this.player.sprite;

        if (this.byteDialogue.isOpen) {
            // No prompts or new interactions during an NPC conversation.
            this.byteProximity.update(playerSprite, false, () => {}, pressedE);
            this.boardProximity.update(playerSprite, false, () => {}, pressedE);
            this.adventurePortal.update(
                playerSprite,
                false,
                pressedE,
                () => {},
            );

            // Allow walking away to close Byte's dialogue naturally.
            if (!this.byteProximity.isInRange(playerSprite, 12)) {
                this.byteDialogue.close();
            } else {
                this.byteDialogue.update(delta);
            }
            return;
        }

        // One E press, one action. Portal > Board > Byte if ranges overlap.
        const portalNearby = this.adventurePortal.isInRange(playerSprite);
        const boardNearby = this.boardProximity.isInRange(playerSprite);

        this.adventurePortal.update(playerSprite, true, pressedE, () =>
            this.adventurePortalUI?.open(),
        );

        this.boardProximity.update(
            playerSprite,
            !portalNearby,
            () => this.questBoardUI?.open(),
            pressedE,
        );

        this.byteProximity.update(
            playerSprite,
            !portalNearby && !boardNearby,
            () => this.byteDialogue?.open(),
            pressedE,
        );
    }
}
