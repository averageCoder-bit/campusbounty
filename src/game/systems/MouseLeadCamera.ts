import * as Phaser from "phaser";

/**
 * Mouse-lead camera for CampusBounty's top-down Quest Hall.
 *
 * WASD moves the player. The cursor gently biases the world camera toward
 * the direction the player is looking. This does NOT move the player or its
 * physics body. Keep screen-space UI on a separate, unzoomed UI camera.
 */
export interface MouseLeadOptions {
    zoom?: number;
    maxLeadX?: number;
    maxLeadY?: number;
    deadzone?: number;
    smoothingMs?: number;
    followLerp?: number;
}

export class MouseLeadCamera {
    private readonly scene: Phaser.Scene;
    private readonly camera: Phaser.Cameras.Scene2D.Camera;
    private readonly settings: Required<MouseLeadOptions>;
    private readonly pointerPosition = new Phaser.Math.Vector2();
    private readonly currentLead = new Phaser.Math.Vector2();
    private pointerIsActive = false;
    private enabled = true;

    // Arrow properties keep the exact same callback reference for cleanup.
    private readonly handlePointerMove = (pointer: Phaser.Input.Pointer): void => {
        if (!this.enabled || pointer.wasTouch) return;
        this.pointerPosition.set(pointer.x, pointer.y); // Canvas coordinates, not world coordinates.
        this.pointerIsActive = true;
    };

    private readonly handleCanvasExit = (): void => {
        this.pointerIsActive = false; // Ease back toward the player.
    };

    constructor(
        scene: Phaser.Scene,
        player: Phaser.GameObjects.Sprite,
        worldWidth: number,
        worldHeight: number,
        options: MouseLeadOptions = {},
    ) {
        this.scene = scene;
        this.camera = scene.cameras.main;
        this.settings = {
            zoom: options.zoom ?? 1.25,
            maxLeadX: options.maxLeadX ?? 90,
            maxLeadY: options.maxLeadY ?? 60,
            deadzone: options.deadzone ?? 0.12,
            smoothingMs: options.smoothingMs ?? 170,
            followLerp: options.followLerp ?? 0.12,
        };

        // The hall currently has the same dimensions as the viewport. At 1x
        // zoom there is no scrolling space; modest zoom creates room to pan.
        this.camera.setBounds(0, 0, worldWidth, worldHeight);
        this.camera.setZoom(this.settings.zoom);
        this.camera.setRoundPixels(true);
        this.camera.startFollow(
            player,
            true,
            this.settings.followLerp,
            this.settings.followLerp,
        );
        this.camera.centerOn(player.x, player.y);

        scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove);
        scene.input.on(Phaser.Input.Events.GAME_OUT, this.handleCanvasExit);
    }

    /** Call from Scene.update(time, delta) only while gameplay is active. */
    update(delta: number): void {
        if (!this.enabled) return;

        const nx = this.pointerIsActive
            ? (this.pointerPosition.x - this.camera.width / 2) / (this.camera.width / 2)
            : 0;
        const ny = this.pointerIsActive
            ? (this.pointerPosition.y - this.camera.height / 2) / (this.camera.height / 2)
            : 0;

        const targetX = this.applyDeadzone(nx) * this.settings.maxLeadX;
        const targetY = this.applyDeadzone(ny) * this.settings.maxLeadY;

        // Framerate-independent smoothing, including a cap after tab switches.
        const dt = Math.max(0, Math.min(delta, 100));
        const alpha = 1 - Math.exp(-dt / Math.max(1, this.settings.smoothingMs));
        this.currentLead.x += (targetX - this.currentLead.x) * alpha;
        this.currentLead.y += (targetY - this.currentLead.y) * alpha;

        // Phaser SUBTRACTS followOffset from the target; negative offset
        // therefore makes the camera look AHEAD in the cursor's direction.
        this.camera.setFollowOffset(
            -Math.round(this.currentLead.x),
            -Math.round(this.currentLead.y),
        );
    }

    /** Settings menu can freeze the camera; resume eases back to center. */
    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        if (enabled) this.pointerIsActive = false;
    }

    destroy(): void {
        this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove);
        this.scene.input.off(Phaser.Input.Events.GAME_OUT, this.handleCanvasExit);
        this.camera.stopFollow();
    }

    private applyDeadzone(value: number): number {
        const clamped = Phaser.Math.Clamp(value, -1, 1);
        const abs = Math.abs(clamped);
        const dz = Phaser.Math.Clamp(this.settings.deadzone, 0, 0.9);
        if (abs <= dz) return 0;
        return Math.sign(clamped) * (abs - dz) / (1 - dz);
    }
}
