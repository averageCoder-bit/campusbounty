import { Web3AchievementPanel } from './components/Web3AchievementPanel';
import { PhaserGame } from "./PhaserGame";
import { QuestHallPanels } from "./components/QuestHallPanels";

function App() {
    return (
        <main id="app">
            <div className="game-shell">
                <PhaserGame />
                <Web3AchievementPanel />
                <QuestHallPanels />
            </div>
        </main>
    );
}

export default App;
