/** G5: Byte's *advisory* study chat. Never awards XP, evaluates assessments,
 * opens wallets or changes server state. Gemini credentials live on FastAPI.
 */
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
            "Byte API is not configured. Set VITE_BYTE_API_URL in .env.local.",
        );
    const text = message.trim();
    if (!text || text.length > 450)
        throw new Error("Ask Byte a question under 450 characters.");
    let response: Response;
    try {
        response = await fetch(`${API_URL}/api/v1/byte/chat`, {
            method: "POST",
            signal,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: text,
                history: history.slice(-6),
                context,
            }),
        });
    } catch (error) {
        if (signal?.aborted) throw error;
        throw new Error(
            "Byte can't reach the local mentor server. Check port 8001.",
        );
    }
    if (!response.ok) {
        const errorBody: { detail?: unknown } = await response
            .json()
            .catch(() => ({}));
        throw new Error(
            typeof errorBody.detail === "string"
                ? errorBody.detail
                : `Byte's mentor server returned ${response.status}`,
        );
    }
    const data = (await response.json()) as MentorReply;
    if (
        !data ||
        typeof data.reply !== "string" ||
        (data.source !== "gemini" && data.source !== "scripted")
    ) {
        throw new Error("Byte returned an invalid response.");
    }
    return {
        reply: data.reply.slice(0, 1200),
        source: data.source,
        awards_rewards: false,
        notice:
            typeof data.notice === "string"
                ? data.notice.slice(0, 200)
                : undefined,
    };
}
