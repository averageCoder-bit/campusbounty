/**
 * G3.1: static curriculum outlines for the Quest Board.
 * These are previews, NOT completed lessons, XP grants, or verified mastery.
 * G3.2 will attach real lesson content, practice, and assessment state.
 */
export interface LearningNode {
    id: string;
    title: string;
    summary: string;
    goal: string;
    topics: readonly string[];
}

export interface LearningPath {
    id: string;
    title: string;
    subtitle: string;
    overview: string;
    accent: number;
    nodes: readonly LearningNode[];
}

export const LEARNING_PATHS: readonly LearningPath[] = [
    {
        id: "computer-science",
        title: "COMPUTER SCIENCE",
        subtitle: "CODE / LOGIC / SYSTEMS",
        overview: "Build your foundation, then turn ideas into working programs.",
        accent: 0x7dd3fc,
        nodes: [
            {
                id: "cs-computing",
                title: "Computing Basics",
                summary: "How computers represent and process information.",
                goal: "Explain what a program does and trace its inputs and outputs.",
                topics: ["Bits and data", "Input / process / output", "Algorithms"],
            },
            {
                id: "cs-programming",
                title: "Programming Logic",
                summary: "Practice decisions, loops, variables, and functions.",
                goal: "Trace a short program and predict its output.",
                topics: ["Variables and types", "If / else", "Loops and functions"],
            },
            {
                id: "cs-data-structures",
                title: "Data Structures",
                summary: "Choose structures that store and organize information.",
                goal: "Match a problem to an appropriate data structure.",
                topics: ["Arrays and lists", "Stacks and queues", "Trees and maps"],
            },
            {
                id: "cs-algorithms",
                title: "Algorithms",
                summary: "Solve problems with reliable and efficient steps.",
                goal: "Compare basic algorithms and reason about complexity.",
                topics: ["Searching", "Sorting", "Big-O intuition"],
            },
            {
                id: "cs-project",
                title: "Applied Challenge",
                summary: "Combine logic and data structures in a small task.",
                goal: "Apply earlier concepts to a new problem independently.",
                topics: ["Decomposition", "Implementation", "Debugging"],
            },
        ],
    },
    {
        id: "blockchain-web3",
        title: "BLOCKCHAIN & WEB3",
        subtitle: "WALLETS / BLOCKS / SECURITY",
        overview: "Understand how decentralized applications operate and stay safe.",
        accent: 0x55e8d5,
        nodes: [
            {
                id: "web3-foundations",
                title: "Web3 Foundations",
                summary: "Explore ledgers, networks, and decentralization.",
                goal: "Describe why multiple computers verify a shared ledger.",
                topics: ["Distributed ledgers", "Blocks", "Consensus basics"],
            },
            {
                id: "web3-wallets",
                title: "Wallet Safety",
                summary: "Learn addresses, signing, and secret recovery phrases.",
                goal: "Spot a fake wallet request without exposing private secrets.",
                topics: ["Public addresses", "Private keys", "Recovery phrases"],
            },
            {
                id: "web3-transactions",
                title: "Transactions",
                summary: "Follow a transfer from signature to confirmation.",
                goal: "Read a simulated transaction and explain its fee.",
                topics: ["Signing", "Gas fees", "Confirmations"],
            },
            {
                id: "web3-contracts",
                title: "Smart Contracts",
                summary: "Understand code that enforces on-chain rules.",
                goal: "Evaluate a simulated token permission safely.",
                topics: ["Contract execution", "Permissions", "Token approvals"],
            },
            {
                id: "web3-security",
                title: "Security Mission",
                summary: "Investigate suspicious links and transaction requests.",
                goal: "Make safe decisions in a new security scenario.",
                topics: ["Phishing", "Verification", "Risk assessment"],
            },
        ],
    },
];
