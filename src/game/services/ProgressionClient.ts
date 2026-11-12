/** G4.6: authenticated server-grade Academy progression.
 * No frontend API accepts arbitrary XP/coins, completion flags, or pass/fail.
 */
import type * as Phaser from "phaser";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { applyVerifiedSnapshot, clearVerifiedSnapshot, type VerifiedSnapshot } from "../data/LearningProgress";
import type { ChallengeAnswer } from "../systems/LearningEngine";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const API_URL = (import.meta.env.VITE_PROGRESSION_API_URL as string | undefined)?.replace(/\/$/, "");

export const supabase: SupabaseClient | null = SUPABASE_URL && SUPABASE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
    : null;

export interface RemoteQuestion {
    id: string;
    kind: "choice" | "trace" | "sequence" | "fill";
    title: string;
    prompt: string;
    context: string;
    hint: string;
    options: string[];
}
export interface RemoteAttempt {
    attemptId: string;
    lessonId: string;
    expiresAt: string;
    questions: RemoteQuestion[];
}
export interface RemoteResult {
    result: { score: number; total: number; passed: boolean; firstMastery: boolean;
              awardedXp: number; attempts: number; wrongIds: string[] };
    snapshot: VerifiedSnapshot;
}

export async function isSignedIn(): Promise<boolean> {
    if (!supabase) return false;
    const { data, error } = await supabase.auth.getSession();
    if (error) throw new Error(error.message);
    return !!data.session;
}

async function requestJSON<T>(route: string, method: "GET" | "POST" = "GET", body?: object): Promise<T> {
    if (!supabase || !API_URL) throw new Error("Supabase/Progression backend is not configured");
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) throw new Error("Sign in to save verified progress");
    let response: Response;
    try {
        response = await fetch(API_URL + route, {
            method,
            headers: { Authorization: `Bearer ${data.session.access_token}`,
                "Content-Type": "application/json" },
            ...(body ? { body: JSON.stringify(body) } : {}),
        });
    } catch {
        throw new Error("Cannot reach progression server. Your assessment was not awarded.");
    }
    if (!response.ok) {
        const errorBody: { detail?: unknown } = await response.json().catch(() => ({}));
        throw new Error(typeof errorBody.detail === "string"
            ? errorBody.detail : `Progression server rejected request (${response.status})`);
    }
    return response.json() as Promise<T>;
}

export async function getVerifiedProfile(): Promise<VerifiedSnapshot> {
    return requestJSON<VerifiedSnapshot>("/api/v1/progression/me");
}
export async function startVerifiedAttempt(lessonId: string): Promise<RemoteAttempt> {
    return requestJSON<RemoteAttempt>("/api/v1/academy/attempts", "POST", { lessonId });
}
export async function submitVerifiedAttempt(attemptId: string, answers: ChallengeAnswer[]): Promise<RemoteResult> {
    return requestJSON<RemoteResult>(`/api/v1/academy/attempts/${attemptId}/submit`, "POST", { answers });
}

/** Can be called from QuestBoardUI on opening and after sign-in/out. */
export async function refreshVerifiedProgression(scene: Phaser.Scene): Promise<boolean> {
    if (!supabase || !API_URL || !await isSignedIn()) {
        clearVerifiedSnapshot(scene);
        return false;
    }
    const snapshot = await getVerifiedProfile();
    // Guard against stale requests when a user signs out while awaiting the backend.
    const { data } = await supabase.auth.getSession();
    if (!data.session || data.session.user.id !== snapshot.userId) return false;
    applyVerifiedSnapshot(scene, snapshot);
    return true;
}

export function announceAuthChanged(): void {
    if (typeof window !== "undefined") window.dispatchEvent(new Event("campusbounty:auth-changed"));
}

/** Optional run-history reporting: client reports are NOT verified clears and award 0 XP. */
export async function reportAdventureRun(data: {
    runId: string; mode: "quest-finding" | "dungeon-conquer";
    seed: number; outcome: "cleared" | "failed" | "abandoned"; durationSeconds: number;
}): Promise<{ saved: boolean; verificationStatus: "client_reported"; xpAwarded: number; coinsAwarded: number }> {
    return requestJSON("/api/v1/adventure-runs", "POST", data);
}
