import { forwardRef, useLayoutEffect, useRef } from "react";

import StartGame from "./game/main";
import { EventBus } from "./game/EventBus";

export interface IRefPhaserGame {
    game: Phaser.Game | null;
    scene: Phaser.Scene | null;
}

interface IProps {
    currentActiveScene?: (scene: Phaser.Scene) => void;
}

export const PhaserGame = forwardRef<IRefPhaserGame, IProps>(
    function PhaserGame({ currentActiveScene }, ref) {
        const gameRef = useRef<Phaser.Game | null>(null);
        const activeSceneCallback = useRef(currentActiveScene);

        activeSceneCallback.current = currentActiveScene;

        useLayoutEffect(() => {
            const updateRef = (scene: Phaser.Scene | null) => {
                const value: IRefPhaserGame = {
                    game: gameRef.current,
                    scene,
                };

                if (typeof ref === "function") {
                    ref(value);
                } else if (ref) {
                    ref.current = value;
                }
            };

            const handleSceneReady = (scene: Phaser.Scene) => {
                activeSceneCallback.current?.(scene);
                updateRef(scene);
            };

            // Register before Phaser starts.
            EventBus.on("current-scene-ready", handleSceneReady);

            // Initialize the game.
            gameRef.current = StartGame("game-container");
            updateRef(null);

            return () => {
                // Remove only this component's listener.
                EventBus.removeListener(
                    "current-scene-ready",
                    handleSceneReady,
                );

                if (gameRef.current) {
                    gameRef.current.destroy(true);
                    gameRef.current = null;
                }

                if (typeof ref === "function") {
                    ref(null);
                } else if (ref) {
                    ref.current = null;
                }
            };
        }, [ref]);

        return <div id="game-container" />;
    },
);
