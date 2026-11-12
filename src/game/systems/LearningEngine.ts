/** Pure, deterministic G3.8 challenge engine. NEVER executes learner-entered code. */
export type AcademyChallengeKind = "choice" | "trace" | "sequence" | "fill";
export interface AcademyChallenge {
    id: string;
    kind: AcademyChallengeKind;
    title: string;
    prompt: string;
    /** Code sample, transaction excerpt, or contextual evidence, shown verbatim. */
    context?: string;
    explanation: string;
    hint: string;
    /** Choice/trace: three possible responses; answerIndex refers to this original order. */
    options?: readonly [string, string, string];
    answerIndex?: number;
    /** Sequence: steps in their CORRECT order; display order is shuffled. */
    steps?: readonly [string, string, string];
    /** Fill: accepted normalized text, e.g. literal answer or code fragment. */
    accepted?: readonly string[];
}
export interface AcademyPage {
    heading: string;
    body: string;
    exampleTitle: string;
    example: string;
    takeaway: string;
}
export interface AcademyLesson {
    id: string;
    unitId: string;
    title: string;
    subtitle: string;
    xpReward: number;
    pages: readonly AcademyPage[];
    practice: AcademyChallenge;
    assessment: readonly AcademyChallenge[];
    /** 3/3 for regular lessons; 4/5 for capstone. */
    minScore: number;
    isCapstone?: boolean;
}
export interface PreparedChallenge {
    source: AcademyChallenge;
    options: readonly string[];
    /** Original option index for each display option. */
    originalIndices: readonly number[];
}

export function stableHash(input: string): number {
    let hash = 2166136261;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}
function rng(seed: number): () => number {
    let x = (seed >>> 0) || 0x9e3779b9;
    return () => {
        x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
        return (x >>> 0) / 4294967296;
    };
}
export function shuffled<T>(items: readonly T[], seed: number): T[] {
    const out = [...items];
    const next = rng(seed);
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}
export function prepareChallenge(question: AcademyChallenge, attempt: number): PreparedChallenge {
    const base = question.kind === "sequence" ? question.steps : question.options;
    if (!base) return { source: question, options: [], originalIndices: [] };
    const originalIndices = shuffled(base.map((_, i) => i), stableHash(`${question.id}|${attempt}`));
    return { source: question, options: originalIndices.map((i) => base[i]), originalIndices };
}
export type ChallengeAnswer = number | readonly number[] | string | null;
export function normalizeAnswer(value: string): string {
    return value.trim().replace(/\s+/g, " ").toLowerCase();
}
export function checkChallenge(item: PreparedChallenge, answer: ChallengeAnswer): boolean {
    const q = item.source;
    if ((q.kind === "choice" || q.kind === "trace") && typeof answer === "number") {
        return item.originalIndices[answer] === q.answerIndex;
    }
    if (q.kind === "sequence" && Array.isArray(answer) && answer.length === 3) {
        return answer.every((displayIndex, expectedPosition) =>
            item.originalIndices[displayIndex] === expectedPosition);
    }
    if (q.kind === "fill" && typeof answer === "string") {
        return !!q.accepted?.some((valid) => normalizeAnswer(valid) === normalizeAnswer(answer));
    }
    return false;
}
export function selectAssessment(lesson: AcademyLesson, attempt: number): PreparedChallenge[] {
    // All authored objectives are assessed, with deterministic per-attempt order/shuffle.
    return shuffled(lesson.assessment, stableHash(`${lesson.id}|questions|${attempt}`))
        .map((q) => prepareChallenge(q, attempt));
}
export function scoreAssessment(cases: readonly PreparedChallenge[], answers: readonly ChallengeAnswer[]): {
    score: number; total: number; wrongIds: string[];
} {
    const wrongIds: string[] = [];
    let score = 0;
    cases.forEach((q, index) => {
        if (checkChallenge(q, answers[index] ?? null)) score++;
        else wrongIds.push(q.source.id);
    });
    return { score, total: cases.length, wrongIds };
}
