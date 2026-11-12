/** G4 — self-contained offline security scenarios; no real wallet connections. */
export interface DungeonTrial {
    id: string;
    chapter: string;
    title: string;
    scenario: string;
    options: [string, string, string];
    answer: number;
    explanation: string;
}

export type TrialStage = 1 | 2 | 3;

type TrialTemplate = Omit<DungeonTrial, "answer" | "options"> & {
    choices: [string, string, string];
    correct: number;
};

const TRIALS: Record<TrialStage, readonly TrialTemplate[]> = {
    1: [
        {
            id: "phishing-directory", chapter: "GATE 01 / TRUST", title: "THE FALSE REWARD",
            scenario: "A guild notice advertises an urgent token airdrop. The link has a similar-looking hostname. What is the safest verification method?",
            choices: ["Follow the link because the banner looks official", "Open the official project site independently and compare its announcement", "Approve the transaction now and check later"],
            correct: 1,
            explanation: "Branding and urgency are easy to forge. Verify the exact hostname and announcement via an independently trusted source.",
        },
        {
            id: "fake-support", chapter: "GATE 01 / TRUST", title: "THE HELPFUL STRANGER",
            scenario: "An alleged support agent messages you after a failed transaction and asks for your wallet's recovery phrase. What do you do?",
            choices: ["Refuse and report the impersonation", "Share only half of the phrase", "Send the phrase if their account is verified"],
            correct: 0,
            explanation: "Recovery phrases grant wallet control. Real support staff do not need them, even if a profile appears verified.",
        },
        {
            id: "sign-in-prompt", chapter: "GATE 01 / TRUST", title: "THE POP-UP",
            scenario: "A new tab opens an unsolicited wallet connection pop-up, pretending it must verify your age to read an article. What next?",
            choices: ["Sign a message to close it", "Connect a new wallet instead", "Reject the prompt and close the untrusted tab"],
            correct: 2,
            explanation: "Unsolicited signatures and connection requests are a warning sign. Decline first and verify intent before interacting.",
        },
    ],
    2: [
        {
            id: "approval-scope", chapter: "GATE 02 / PERMISSIONS", title: "THE OPEN-ENDED APPROVAL",
            scenario: "A contract you do not recognize requests unlimited spending allowance. Which action limits risk?",
            choices: ["Reject, verify the spender and choose the minimum necessary allowance", "Accept because all dApps require unlimited access", "Reveal your private key to the security team"],
            correct: 0,
            explanation: "Token approval gives a spender permission. Verify contract identity and scope; do not grant unneeded unlimited allowances.",
        },
        {
            id: "chain-mismatch", chapter: "GATE 02 / PERMISSIONS", title: "THE WRONG NETWORK",
            scenario: "A dApp unexpectedly requests a network switch and a transaction you did not initiate. What's the safest response?",
            choices: ["Approve because the interface says 'secure'", "Stop, inspect the request and confirm the intended chain and transaction", "Send a small transfer first as a test"],
            correct: 1,
            explanation: "Confirm the intended network, site, destination and transaction data. Unexpected wallet requests should not be approved blindly.",
        },
        {
            id: "sign-vs-transfer", chapter: "GATE 02 / PERMISSIONS", title: "THE TRANSACTION PREVIEW",
            scenario: "An app claims it only needs login, but your wallet shows a token spending approval. What should you do?",
            choices: ["Approve: signing in and spending approval are identical", "Share the wallet password with the app", "Reject the mismatch and investigate the permission being requested"],
            correct: 2,
            explanation: "A login signature and on-chain token spending approval are different operations. The wallet's request details matter.",
        },
    ],
    3: [
        {
            id: "audit-signal", chapter: "CORE / SMART CONTRACTS", title: "THE VERIFIED SHIELD",
            scenario: "A new smart contract displays an 'audited' badge, but its address differs from the one in the project's official documentation. What matters most?",
            choices: ["The shiny badge", "The exact deployed address and independently verifiable audit scope", "The number of social-media followers"],
            correct: 1,
            explanation: "An audit badge alone is not assurance. Verify the deployed address, source, audit scope and remaining risks independently.",
        },
        {
            id: "hidden-upgrade", chapter: "CORE / SMART CONTRACTS", title: "THE ADMIN KEY",
            scenario: "A contract is upgradeable by a single anonymous administrator. What is a meaningful risk?",
            choices: ["Admin access can change contract behavior; inspect controls before trusting funds", "Upgradeable contracts can never be exploited", "It guarantees that funds are insured"],
            correct: 0,
            explanation: "Privileged upgrade controls introduce governance and trust risk. Review owner permissions, timelocks and verification status.",
        },
        {
            id: "simulation-failure", chapter: "CORE / SMART CONTRACTS", title: "THE UNEXPLAINED REVERT",
            scenario: "A transaction simulation reports an unexpected failure, but a site insists you retry by increasing gas aggressively. What is the safer move?",
            choices: ["Increase gas until it works", "Share your seed phrase for a repair script", "Stop and investigate the revert before signing another request"],
            correct: 2,
            explanation: "More gas does not automatically resolve a reverted transaction. Understand the call, destination and failure before retrying.",
        },
    ],
};

/** Small deterministic RNG, independent of Phaser. */
export function dungeonRandom(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s += 0x6d2b79f5;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function makeDungeonTrials(seed: number): Record<TrialStage, DungeonTrial> {
    const random = dungeonRandom(seed ^ 0x53cc87);
    const stages: TrialStage[] = [1, 2, 3];
    const result = {} as Record<TrialStage, DungeonTrial>;
    for (const stage of stages) {
        const bank = TRIALS[stage];
        const source = bank[Math.floor(random() * bank.length)];
        const indexed = source.choices.map((value, index) => ({ value, index }));
        for (let i = indexed.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [indexed[i], indexed[j]] = [indexed[j], indexed[i]];
        }
        result[stage] = {
            id: source.id, chapter: source.chapter, title: source.title,
            scenario: source.scenario,
            options: indexed.map((entry) => entry.value) as [string, string, string],
            answer: indexed.findIndex((entry) => entry.index === source.correct),
            explanation: source.explanation,
        };
    }
    return result;
}
