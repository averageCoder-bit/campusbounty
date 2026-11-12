import { useEffect, useRef, useState } from "react";
import { ByteMentorPanel } from "./ByteMentorPanel";
import { PlayerInteractionMenu } from "./PlayerInteractionMenu";
import type { QuestHallSnapshot, QuestPanelKind } from "../game/ui/QuestHallInteractionBridge";
import "./quest-hall-panels.css";

interface PanelEventDetail { kind: QuestPanelKind; snapshot: QuestHallSnapshot }

/** Mount once in App.tsx, inside the existing React tree next to PhaserGame.
 * No new React root, no duplicate Phaser instance, no login requirement.
 */
export function QuestHallPanels() {
    const [panel, setPanel] = useState<PanelEventDetail | null>(null);
    const focusBefore = useRef<HTMLElement | null>(null);
    const root = useRef<HTMLDivElement | null>(null);
    const close = () => {
        setPanel(null);
        window.dispatchEvent(new Event("campusbounty:quest-panel-closed"));
        // Return keyboard focus when possible.
        requestAnimationFrame(() => focusBefore.current?.focus());
    };

    useEffect(() => {
        const open = (e: Event) => {
            const detail = (e as CustomEvent<PanelEventDetail>).detail;
            if (!detail || !["player", "byte"].includes(detail.kind)) return;
            focusBefore.current = document.activeElement as HTMLElement | null;
            setPanel(detail);
        };
        const forceClose = () => setPanel(null);
        window.addEventListener("campusbounty:quest-panel-open", open);
        window.addEventListener("campusbounty:quest-panel-force-close", forceClose);
        return () => {
            window.removeEventListener("campusbounty:quest-panel-open", open);
            window.removeEventListener("campusbounty:quest-panel-force-close", forceClose);
        };
    }, []);
    useEffect(() => {
        if (!panel) return;
        const before = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const closeAndTrap = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault(); e.stopImmediatePropagation(); close(); return;
            }
            if (e.key === "Tab" && root.current) {
                const focusable = Array.from(root.current.querySelectorAll<HTMLElement>(
                    'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
                )).filter(el => el.getClientRects().length > 0);
                if (!focusable.length) return;
                const first = focusable[0], last = focusable[focusable.length - 1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        };
        window.addEventListener("keydown", closeAndTrap, true);
        // Focus the actual chat input when opening Byte, instead of the CLOSE button.
        // Only one autofocus request, and never override a quick user click.
        const focusFrame = requestAnimationFrame(() => {
            const host = root.current;
            if (!host) return;
            if (document.activeElement instanceof HTMLElement && host.contains(document.activeElement)) return;
            const target = panel.kind === "byte"
                ? host.querySelector<HTMLTextAreaElement>("#cbq-byte-question")
                : host.querySelector<HTMLButtonElement>("button");
            target?.focus({ preventScroll: true });
        });
        return () => {
            window.removeEventListener("keydown", closeAndTrap, true);
            cancelAnimationFrame(focusFrame);
            document.body.style.overflow = before;
        };
    }, [panel]);
    if (!panel) return null;
    return (
        <div className="cbq-backdrop" onMouseDown={e => { e.stopPropagation(); if (e.target === e.currentTarget) close(); }}>
            <div ref={root} className="cbq-shell" role="dialog" aria-modal="true"
                aria-label={panel.kind === "byte" ? "Talk to Byte" : "Player profile"}>
                <div className="cbq-corners" aria-hidden="true"><i/><i/><i/><i/></div>
                <div className="cbq-topline">
                    <span>✦ CAMPUSBOUNTY <b>/</b> {panel.kind === "byte" ? "BYTE LINK" : "STUDENT RECORD"}</span>
                    <button className="cbq-close" type="button" onClick={close}>✕ CLOSE <kbd>ESC</kbd></button>
                </div>
                {panel.kind === "player" ? (
                    <PlayerInteractionMenu snapshot={panel.snapshot}
                        onTalkToByte={() => setPanel(p => p ? { ...p, kind: "byte" } : null)}
                        onClose={close}/>
                ) : <ByteMentorPanel snapshot={panel.snapshot} onClose={close}/>}
                <div className="cbq-bottomline"><span>THE QUEST HALL ARCHIVE</span><span>LEARN · PRACTICE · MASTER</span></div>
            </div>
        </div>
    );
}
