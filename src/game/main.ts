import { Boot } from "./scenes/Boot";
import { GameOver } from "./scenes/GameOver";
import { Game as MainGame } from "./scenes/Game";
import { MainMenu } from "./scenes/MainMenu";
import { AUTO, Game, Scale } from "phaser";
import { Preloader } from "./scenes/Preloader";

const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    parent: "game-container",

    backgroundColor: "#0B1423",

    // Pixel-art rendering
    pixelArt: true,
    roundPixels: true,

    render: {
        antialias: false,
    },

    // Responsive scaling
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH,
        width: 1024,
        height: 768,
    },

    // Game scenes
    scene: [Boot, Preloader, MainMenu, MainGame, GameOver],
};

const StartGame = (parent: string) => {
    return new Game({ ...config, parent });
};

export default StartGame;
