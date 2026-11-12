import * as Phaser from "phaser";
import { THEME } from "./Theme";

type Palette = Record<string, number>;

export const TEX = {
    player: "cb-player",
    byte: "cb-byte",
    byteBlink: "cb-byte-blink",
    coin: "cb-coin",
    quest: "cb-quest",
    poster: "cb-poster",
    star: "cb-star",
    dots: "cb-dots",
} as const;

// ------------------------------------------------------------------
// Sprite maps ("." = transparent). Edit these like ASCII art.
// ------------------------------------------------------------------

const PLAYER_ROWS = [
    "HHHHHH",
    "HSSSSH",
    "SESSES",
    "SSSSSS",
    "SSSSSS",
    "BBBBBB",
    "BBAABB",
    ".BBBB.",
    ".BBBB.",
    ".BBBB.",
    ".L..L.",
    ".L..L.",
    ".O..O.",
];

const PLAYER_PALETTE: Palette = {
    H: 0x1f2937, // hair
    S: 0xf5d0a9, // skin
    E: 0x111111, // eyes
    B: 0x60a5fa, // shirt
    A: 0xfbbf24, // shirt accent
    L: 0x374151, // legs
    O: 0x111111, // shoes
};

const BYTE_ROWS = [
    "....OBBBBBBO....",
    "...OBHHHHHHBO...",
    "..OBHHHHHHHHBO..",
    ".OBHHBBBBBBBBBO.",
    ".OBBFFFFFFFFBBO.",
    ".OBBFFFFFFFFBBO.",
    ".OBBFEEFFEEFBBO.",
    ".OBBFEEFFEEFBBO.",
    ".ODBFFFFFFFFBDO.",
    ".ODBFFFFFFFFBDO.",
    ".ODBBBBFFBBBBDO.",
    ".ODBBBBFFBBBBDO.",
    ".OBBBBBOOBBBBBO.",
    "ODBBBBO..OBBBBDO",
    "ODBBBO....OBBBDO",
];

// Same sprite with the eyes squashed into a line.
const BYTE_BLINK_ROWS = BYTE_ROWS.map((row, i) => {
    if (i === 6) return ".OBBFFFFFFFFBBO.";
    return row;
});

const BYTE_PALETTE: Palette = {
    O: 0x10313b, // outline
    B: 0x55e8d5, // body
    H: 0x8affed, // highlight
    D: 0x28bfae, // shadow
    F: 0x102630, // faceplate
    E: 0xffca28, // eyes
};

const COIN_ROWS = [
    "..OOOO..",
    ".OYYYYO.",
    "OYYWYYYO",
    "OYYWYYYO",
    "OYYYYYYO",
    "OYYYYYDO",
    ".ODDDDO.",
    "..OOOO..",
];

const COIN_PALETTE: Palette = {
    O: 0x92400e,
    Y: 0xfbbf24,
    W: 0xfde68a,
    D: 0xd97706,
};

const QUEST_ROWS = ["XXX", "XXX", "XXX", "XXX", "...", "XXX"];
const QUEST_PALETTE: Palette = { X: 0xfbbf24 };

const POSTER_ROWS = [
    "OOOOOOOOOOOO",
    "OPPPPPPPPPPO",
    "OPKKKKKKKKPO",
    "OPPPPPPPPPPO",
    "OPPOOOOOOPPO",
    "OPPOGGGGOPPO",
    "OPPOGGGGOPPO",
    "OPPOOOOOOPPO",
    "OPPPPPPPPPPO",
    "OPKKKKKKKKPO",
    "OPPPPPPPPPPO",
    "OPKKKKKPPPPO",
    "OPPPPPPPPPPO",
    "OPPGGGGGPPPO",
    "OOOOOOOOOOOO",
];

const POSTER_PALETTE: Palette = {
    O: 0x5b3a1a,
    P: 0xf5e6c4,
    K: 0x5b3a1a,
    G: 0xfbbf24,
};

const STAR_ROWS = [
    "...X...",
    "...X...",
    "...X...",
    "XXXXXXX",
    "...X...",
    "...X...",
    "...X...",
];
const STAR_PALETTE: Palette = { X: 0xfbbf24 };

// ------------------------------------------------------------------
// Baking
// ------------------------------------------------------------------

/** Bakes a string-map sprite into a 1x texture with crisp (nearest) sampling. */
export function bakeSprite(
    scene: Phaser.Scene,
    key: string,
    rows: string[],
    palette: Palette,
): void {
    if (scene.textures.exists(key)) return;

    const g = scene.make.graphics({}, false);
    rows.forEach((row, y) => {
        [...row].forEach((ch, x) => {
            const color = palette[ch];
            if (color !== undefined) {
                g.fillStyle(color, 1).fillRect(x, y, 1, 1);
            }
        });
    });

    g.generateTexture(key, rows[0].length, rows.length);
    g.destroy();

    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
}

/** Bakes every texture the main menu needs. Safe to call repeatedly. */
export function bakeMenuTextures(scene: Phaser.Scene): void {
    bakeSprite(scene, TEX.player, PLAYER_ROWS, PLAYER_PALETTE);
    bakeSprite(scene, TEX.byte, BYTE_ROWS, BYTE_PALETTE);
    bakeSprite(scene, TEX.byteBlink, BYTE_BLINK_ROWS, BYTE_PALETTE);
    bakeSprite(scene, TEX.coin, COIN_ROWS, COIN_PALETTE);
    bakeSprite(scene, TEX.quest, QUEST_ROWS, QUEST_PALETTE);
    bakeSprite(scene, TEX.poster, POSTER_ROWS, POSTER_PALETTE);
    bakeSprite(scene, TEX.star, STAR_ROWS, STAR_PALETTE);

    if (!scene.textures.exists(TEX.dots)) {
        const g = scene.make.graphics({}, false);
        g.fillStyle(THEME.dot, 0.45).fillRect(15, 15, 2, 2);
        g.generateTexture(TEX.dots, 32, 32);
        g.destroy();
    }
}
