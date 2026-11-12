import { AUTO, Game, Scale } from "phaser";

import { Boot } from "./scenes/Boot";
import { Preloader } from "./scenes/Preloader";
import { MainMenu } from "./scenes/MainMenu";
import { Game as MainGame } from "./scenes/Game";
import { GameOver } from "./scenes/GameOver";
import { QuestFinding } from "./scenes/QuestFinding";

const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    parent: "game-container",

    backgroundColor: "#0B1423",

    pixelArt: true,
    roundPixels: true,

    render: {
        antialias: false,
    },

    physics: {
        default: "arcade",
        arcade: {
            gravity: {
                x: 0,
                y: 0,
            },
            debug: false,
        },
    },

    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH,
        width: 1024,
        height: 768,
    },

    scene: [
        Boot,
        Preloader,
        MainMenu,
        MainGame, // ✅ Your Quest Hall scene
        GameOver,
        QuestFinding,
    ],
};

const StartGame = (parent: string) => {
    return new Game({ ...config, parent });
};

export default StartGame;
