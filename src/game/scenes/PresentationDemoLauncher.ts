import * as Phaser from "phaser";
import { DungeonConquerDemo } from "./DungeonConquerDemo";
import { QuestFindingDemo } from "./QuestFindingDemo";

/**
 * Call only from AdventurePortalUI.onLaunchDemo.
 * It deliberately never launches or modifies the full-length game scenes.
 */
export function launchPresentationDemo(
    from: Phaser.Scene,
    mode: "quest-finding" | "dungeon-conquer",
): void {
    if (import.meta.env.VITE_DEMO_MODE !== "true") return;
    const key = mode === "quest-finding" ? "QuestFindingDemo" : "DungeonConquerDemo";
    const SceneCtor = mode === "quest-finding" ? QuestFindingDemo : DungeonConquerDemo;
    if (!from.game.scene.keys[key]) from.game.scene.add(key, SceneCtor, false);
    from.scene.start(key, { returnSceneKey: from.scene.key });
}
