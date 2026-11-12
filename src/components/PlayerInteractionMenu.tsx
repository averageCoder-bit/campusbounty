import { useState } from "react";
import type { QuestHallSnapshot } from "../game/ui/QuestHallInteractionBridge";

type Tab = "profile" | "academy" | "badges" | "upgrades" | "guide";
interface Props {
    snapshot: QuestHallSnapshot;
    onTalkToByte(): void;
    onClose(): void;
}
const badgeNames: Record<string, string> = {
    "computing-apprentice": "COMPUTING APPRENTICE",
    "ledger-explorer": "LEDGER EXPLORER",
};
const badgeDescriptions: Record<string, string> = {
    "computing-apprentice": "Master the Computer Science foundations capstone",
    "ledger-explorer": "Master the Blockchain foundations capstone",
};
const tabs: { key: Tab; title: string; sub: string }[] = [
    { key: "profile", title: "PROFILE", sub: "Your record" },
    { key: "academy", title: "ACADEMY", sub: "Learning progress" },
    { key: "badges", title: "BADGES", sub: "Mastery awards" },
    { key: "upgrades", title: "UPGRADES", sub: "Permanent traits" },
    { key: "guide", title: "GUIDE", sub: "Controls & systems" },
];
export function PlayerInteractionMenu({
    snapshot: s,
    onTalkToByte,
    onClose,
}: Props) {
    const [tab, setTab] = useState<Tab>("profile");
    const pct = Math.max(
        0,
        Math.min(100, Math.round((100 * s.xp) / Math.max(1, s.xpToNext))),
    );
    return (
        <div className="cbq-content cbq-player-content">
            <div className="cbq-hero">
                <div className="cbq-avatar" aria-hidden="true">
                    {s.avatarDataUrl ? (
                        <img src={s.avatarDataUrl} alt="" />
                    ) : (
                        <span>◈</span>
                    )}
                    <small>LV.{s.level}</small>
                </div>
                <div className="cbq-hero-copy">
                    <div className="cbq-eyebrow">
                        ADVENTURER DOSSIER / QUEST HALL
                    </div>
                    <h2>PLAYER PROFILE</h2>
                    <p>
                        {s.accountStatus === "verified"
                            ? "SIGNED-IN RECORD · SERVER ACCOUNT"
                            : "GUEST RECORD · LOCAL PROTOTYPE"}
                    </p>
                </div>
                <div className="cbq-coin-card">
                    <span>GOLD COINS</span>
                    <strong>✦ {s.coins.toLocaleString()}</strong>
                </div>
            </div>
            <div className="cbq-profile-xp">
                <div>
                    <span>LEVEL {s.level} · EXPERIENCE</span>
                    <strong>
                        {s.xp} / {s.xpToNext} XP
                    </strong>
                </div>
                <div className="cbq-xp-track">
                    <div style={{ width: `${pct}%` }} />
                </div>
            </div>
            <div
                className="cbq-tabs"
                role="tablist"
                aria-label="Player menu categories"
            >
                {tabs.map((t) => (
                    <button
                        key={t.key}
                        type="button"
                        role="tab"
                        aria-selected={tab === t.key}
                        className={tab === t.key ? "active" : ""}
                        onClick={() => setTab(t.key)}
                    >
                        <b>{t.title}</b>
                        <small>{t.sub}</small>
                    </button>
                ))}
            </div>
            <div className="cbq-tab-panel" role="tabpanel">
                {tab === "profile" && (
                    <div className="cbq-twocol">
                        <section className="cbq-info-card">
                            <h3>ADVENTURE RECORD</h3>
                            <div className="cbq-stat-row">
                                <span>Quest Finding</span>
                                <b>
                                    {s.questFindingCleared
                                        ? "CLEARED"
                                        : "NOT YET CLEARED"}
                                </b>
                            </div>
                            <div className="cbq-stat-row">
                                <span>Academy lessons mastered</span>
                                <b>{s.masteredLessons}</b>
                            </div>
                            <div className="cbq-stat-row">
                                <span>Review items</span>
                                <b>{s.reviewCount}</b>
                            </div>
                            <div className="cbq-stat-row">
                                <span>Badges earned</span>
                                <b>{s.achievements.length}</b>
                            </div>
                        </section>
                        <section className="cbq-info-card">
                            <h3>CHARACTER PROGRESSION</h3>
                            <p>
                                Your level and XP come from the current game
                                session and synced Academy progress when signed
                                in.
                            </p>
                            <p>
                                Permanent stat upgrades are planned. Temporary
                                dungeon health, equipment, and power-ups are
                                separate run-specific systems.
                            </p>
                            <button
                                type="button"
                                className="cbq-action"
                                onClick={onTalkToByte}
                            >
                                ✦ TALK TO BYTE
                            </button>
                        </section>
                    </div>
                )}
                {tab === "academy" && (
                    <div className="cbq-twocol">
                        <section className="cbq-info-card">
                            <h3>QUEST ACADEMY</h3>
                            <div className="cbq-large-number">
                                {s.masteredLessons}
                                <small>MASTERED LESSONS</small>
                            </div>
                            <p>
                                Curriculum tracks: Computer Science, Blockchain
                                & Web3, Data Science & AI, and Cybersecurity.
                            </p>
                        </section>
                        <section className="cbq-info-card">
                            <h3>STUDY REVIEW</h3>
                            <div className="cbq-large-number">
                                {s.reviewCount}
                                <small>QUESTIONS TO REVIEW</small>
                            </div>
                            <p>
                                Visit the physical Quest Board in the Hall to
                                continue chapters, practice, or revisit
                                mistakes.
                            </p>
                        </section>
                    </div>
                )}
                {tab === "badges" && (
                    <section className="cbq-info-card cbq-badges">
                        <h3>ACHIEVEMENT ARCHIVE</h3>
                        {s.achievements.length ? (
                            s.achievements.map((id) => (
                                <div key={id} className="cbq-badge-row">
                                    <span className="cbq-badge-glyph">✦</span>
                                    <div>
                                        <strong>
                                            {badgeNames[id] ??
                                                id
                                                    .replace(/-/g, " ")
                                                    .toUpperCase()}
                                        </strong>
                                        <small>
                                            {badgeDescriptions[id] ??
                                                "Unlocked in CampusBounty"}
                                        </small>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p>
                                No Academy badges yet. Complete a capstone to
                                earn your first badge!
                            </p>
                        )}
                        <p className="cbq-disclaimer">
                            Badge records reflect current guest/cloud session
                            data; they are not blockchain credentials.
                        </p>
                    </section>
                )}
                {tab === "upgrades" && (
                    <section className="cbq-info-card cbq-upgrades">
                        <h3>PERMANENT CHARACTER UPGRADES / DESIGN PREVIEW</h3>
                        <p>
                            Upgrade mechanics are reserved for a later
                            server-verified system. No upgrades are active, and
                            no coins can be spent from this screen yet.
                        </p>
                        <div className="cbq-upgrade-grid">
                            {[
                                [
                                    "VITALITY",
                                    "Maximum health in adventure runs",
                                ],
                                ["POWER", "Base attack effectiveness"],
                                ["AGILITY", "Movement and stamina efficiency"],
                                ["FOCUS", "Study-support and utility perks"],
                            ].map(([name, description]) => (
                                <div className="cbq-upgrade" key={name}>
                                    <strong>{name}</strong>
                                    <small>{description}</small>
                                    <button
                                        type="button"
                                        disabled
                                        aria-label={`${name} upgrade not yet available`}
                                    >
                                        NOT AVAILABLE
                                    </button>
                                </div>
                            ))}
                        </div>
                        <p className="cbq-disclaimer">
                            Dungeon-specific combat stats and temporary perks
                            remain separate from permanent player progression.
                        </p>
                    </section>
                )}
                {tab === "guide" && (
                    <div className="cbq-twocol">
                        <section className="cbq-info-card">
                            <h3>QUEST HALL CONTROLS</h3>
                            <div className="cbq-stat-row">
                                <span>Move around</span>
                                <b>W A S D</b>
                            </div>
                            <div className="cbq-stat-row">
                                <span>Interact</span>
                                <b>E</b>
                            </div>
                            <div className="cbq-stat-row">
                                <span>Player profile</span>
                                <b>P</b>
                            </div>
                            <div className="cbq-stat-row">
                                <span>Settings / pause</span>
                                <b>ESC</b>
                            </div>
                        </section>
                        <section className="cbq-info-card">
                            <h3>YOUR NEXT STEP</h3>
                            <p>
                                Use the Quest Board for learning paths. Speak to
                                Byte for study hints. Enter the Adventure Portal
                                when you're ready to put lessons into practice.
                            </p>
                            <p>
                                Rewards are earned by the game and grading
                                systems—not by Byte's chat responses.
                            </p>
                        </section>
                    </div>
                )}
            </div>
            <div className="cbq-actions">
                <button
                    type="button"
                    className="cbq-action cbq-primary"
                    onClick={onClose}
                >
                    RETURN TO QUEST HALL
                </button>
                <button
                    type="button"
                    className="cbq-action"
                    onClick={onTalkToByte}
                >
                    ASK BYTE A QUESTION
                </button>
            </div>
        </div>
    );
}

