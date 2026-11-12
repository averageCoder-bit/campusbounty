import { PhaserGame } from "./PhaserGame";
import { QuestHallPanels } from "./components/QuestHallPanels";

function App() {
    return (
        <main id="app">
            <div className="game-shell">
                <PhaserGame />
                <QuestHallPanels />
            </div>
        </main>
    );
}

export default App;
