import { useEffect, useRef, useState, type FormEvent } from "react";
import { askByte, type MentorTurn } from "../game/services/ByteMentorClient";
import type { QuestHallSnapshot } from "../game/ui/QuestHallInteractionBridge";
interface Props { snapshot: QuestHallSnapshot; onClose(): void }
interface Line { id: number; role: "user" | "model"; text: string; source?: "gemini" | "scripted" }
const suggestions = ["How do I keep a wallet safe?", "Help me understand Python loops", "How should I prepare for Null Citadel?"];

export function ByteMentorPanel({ snapshot, onClose }: Props) {
    const [messages, setMessages] = useState<Line[]>([]);
    const [draft, setDraft] = useState("");
    const [waiting, setWaiting] = useState(false);
    const [error, setError] = useState("");
    const [revealed, setRevealed] = useState(0);
    const [activeReply, setActiveReply] = useState<number | null>(null);
    const counter = useRef(0);
    const scroll = useRef<HTMLDivElement>(null);
    const controller = useRef<AbortController | null>(null);
    const input = useRef<HTMLTextAreaElement>(null);

    useEffect(() => () => controller.current?.abort(), []);
    useEffect(() => {
        if (activeReply === null) return;
        const msg = messages.find(m => m.id === activeReply);
        if (!msg) return;
        if (revealed >= msg.text.length) { setActiveReply(null); return; }
        const t = window.setTimeout(() => setRevealed(n => Math.min(msg.text.length, n + 3)), 20);
        return () => clearTimeout(t);
    }, [activeReply, revealed, messages]);
    useEffect(() => { scroll.current?.scrollTo({ top: scroll.current.scrollHeight, behavior: "smooth" }); }, [messages, revealed]);

    const send = async (raw: string) => {
        const question = raw.trim();
        if (!question || waiting || question.length > 450) return;
        if (activeReply !== null) setActiveReply(null);
        const prior: MentorTurn[] = messages.slice(-6).map(m => ({ role: m.role, text: m.text.slice(0,450) }));
        setMessages(old => [...old, { id: ++counter.current, role: "user", text: question }]);
        setDraft(""); setError(""); setWaiting(true);
        const abort = new AbortController(); controller.current = abort;
        try {
            const result = await askByte(question, prior, {
                location: "quest-hall", mastered_lessons: snapshot.masteredLessons,
                review_count: snapshot.reviewCount, current_topic: snapshot.recentLessonId ?? "Quest Academy",
            }, abort.signal);
            if (abort.signal.aborted) return;
            const id = ++counter.current;
            setMessages(old => [...old, { id, role: "model", text: result.reply, source: result.source }]);
            setRevealed(0); setActiveReply(id);
        } catch (e) {
            if (!abort.signal.aborted) setError(e instanceof Error ? e.message : "Byte could not reply.");
        } finally {
            if (!abort.signal.aborted) setWaiting(false);
        }
    };
    const submit = (e: FormEvent) => { e.preventDefault(); void send(draft); };
    return <div className="cbq-content cbq-byte-content">
        <div className="cbq-byte-title">
            <div className="cbq-byte-face" aria-hidden="true"><div className="cbq-byte-eyes">▪ ▪</div><span>BYTE</span></div>
            <div><div className="cbq-eyebrow">QUEST HALL MENTOR / LIVE CONVERSATION</div>
                <h2>TALK TO BYTE</h2><p>Ask for explanations, hints, and study guidance—not free answers.</p></div>
        </div>
        <div className="cbq-chat-log" ref={scroll} role="log" aria-live="polite" aria-label="Conversation with Byte">
            <div className="cbq-chat-line cbq-is-byte"><span className="cbq-speaker">BYTE · QUEST MENTOR</span>
                <p>Boop! Need help understanding a concept? Ask away. I can guide you, but you'll earn your own victories!</p></div>
            {messages.map(m => <div key={m.id} className={`cbq-chat-line ${m.role === "model" ? "cbq-is-byte" : "cbq-is-player"}`}>
                <span className="cbq-speaker">{m.role === "model" ? `BYTE · ${m.source === "gemini" ? "AI TUTOR" : "SCRIPTED GUIDE"}` : "YOU"}</span>
                <p>{activeReply === m.id ? m.text.slice(0, revealed) : m.text}</p>
                {activeReply === m.id && <button className="cbq-skip" type="button" onClick={() => setActiveReply(null)}>SHOW FULL REPLY</button>}
            </div>)}
            {waiting && <div className="cbq-chat-line cbq-is-byte"><span className="cbq-speaker">BYTE</span><p>Thinking... ✦</p></div>}
        </div>
        {messages.length === 0 && <div className="cbq-quick-prompts">
            {suggestions.map(s => <button key={s} type="button" onClick={() => void send(s)}>{s}</button>)}
        </div>}
        {error && <p className="cbq-error" role="alert">{error}</p>}
        <form className="cbq-compose" onSubmit={submit}>
            <label htmlFor="cbq-byte-question">YOUR QUESTION</label>
            <div><textarea ref={input} id="cbq-byte-question" maxLength={450} rows={2} value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(draft); } }}
                placeholder="Ask Byte about a lesson, a concept or a challenge..." disabled={waiting}/>
                <button type="submit" className="cbq-action cbq-primary" disabled={waiting || !draft.trim()}>SEND ✦</button></div>
            <small>ENTER SENDS · SHIFT+ENTER NEW LINE · ESC CLOSES · BYTE CANNOT AWARD XP</small>
        </form>
        <div className="cbq-actions"><button className="cbq-action" type="button" onClick={onClose}>BACK TO HALL</button></div>
    </div>;
}
