/** G5: Byte's *advisory* study chat. Never awards XP, evaluates assessments,
 * opens wallets or changes server state. Gemini credentials live on FastAPI.
 */
import { supabase } from "./ProgressionClient";

export type MentorRole = "user" | "model";
export interface MentorTurn {
    role: MentorRole;
    text: string;
}
export interface MentorContext {
    location: "quest-hall";
    mastered_lessons: number;
    review_count: number;
    current_topic: string;
}
export interface MentorReply {
    reply: string;
    source: "gemini" | "scripted";
    awards_rewards: false;
    notice?: string;
}
const API_URL =
    (import.meta.env.VITE_BYTE_API_URL as string | undefined)?.replace(
        /\/$/,
        "",
    ) || "";

export async function askByte(
    message: string,
    history: MentorTurn[],
    context: MentorContext,
    signal?: AbortSignal,
): Promise<MentorReply> {
    if (!API_URL)
        throw new Error(
            "Byte API is not configured. Set VITE_BYTE_API_URL in .env.local or Vercel.",
        );
    const text = message.trim();
    if (!text || text.length > 450)
        throw new Error("Ask Byte a question under 450 characters.");

    if (!supabase) {
        throw new Error("CampusBounty sign-in is not configured.");
    }
    const { data, error: authError } = await supabase.auth.getSession();
    if (authError || !data.session?.access_token) {
        throw new Error("Sign in to CampusBounty to use Byte AI.");
    }

    let response: Response;
    try {
        response = await fetch(`${API_URL}/api/v1/byte/chat`, {
            method: "POST",
            signal,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${data.session.access_token}`,
            },
            body: JSON.stringify({
                message: text,
                history: history.slice(-6),
                context,
            }),
        });
    } catch (error) {
        if (signal?.aborted) throw error;
        throw new Error("Byte can't reach the mentor server. Try again later.");
    }
    if (!response.ok) {
        const errorBody: { detail?: unknown } = await response
            .json()
            .catch(() => ({}));
        throw new Error(
            typeof errorBody.detail === "string"
                ? errorBody.detail
                : response.status === 401 || response.status === 403
                    ? "Your sign-in has expired or isn't authorized. Sign in again."
                    : `Byte's mentor server returned ${response.status}`,
        );
    }
    const result = (await response.json()) as MentorReply;
    if (
        !result ||
        typeof result.reply !== "string" ||
        (result.source !== "gemini" && result.source !== "scripted")
    ) {
        throw new Error("Byte returned an invalid response.");
    }
    return {
        reply: result.reply.slice(0, 1200),
        source: result.source,
        awards_rewards: false,
        notice:
            typeof result.notice === "string"
                ? result.notice.slice(0, 200)
                : undefined,
    };
}
