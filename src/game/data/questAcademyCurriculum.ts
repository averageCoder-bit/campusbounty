/**
 * G3.8 Quest Academy — course catalogue, NOT a claim that 40 units are authored.
 * All units are visible; only published units have a complete playable chapter.
 * Legacy G3.7 lessons remain reachable as optional bridge lessons.
 */
export type AcademyTrackId = "computer-science" | "blockchain-web3" | "data-science-ai" | "cybersecurity";
export type AcademyUnitStatus = "published" | "bridge" | "planned";

export interface AcademyUnit {
    id: string;
    title: string;
    summary: string;
    goal: string;
    /** IDs of real, authored, playable lessons. Empty means no available content. */
    lessonIds: readonly string[];
    status: AcademyUnitStatus;
}
export interface AcademyTrack {
    id: AcademyTrackId;
    title: string;
    subtitle: string;
    overview: string;
    accent: number;
    units: readonly AcademyUnit[];
}

function unit(id: string, title: string, summary: string, goal: string,
    lessonIds: readonly string[] = [], status: AcademyUnitStatus = "planned"): AcademyUnit {
    return { id, title, summary, goal, lessonIds, status };
}

export const ACADEMY_TRACKS: readonly AcademyTrack[] = [
    { id: "computer-science", title: "COMPUTER SCIENCE", subtitle: "CODE  /  LOGIC  /  SYSTEMS", overview: "Reason through computing fundamentals and learn to build programs.", accent: 0x7dd3fc, units: [
        unit("cs-computing", "Computing Fundamentals", "Bits, input/output, algorithms and debugging.", "Explain programs and trace elementary logic.", ["cs-01-bits", "cs-02-io", "cs-03-algorithms", "cs-04-variables", "cs-05-debugging", "cs-06-capstone"], "published"),
        unit("cs-programming", "Programming with Python", "Variables, expressions and core Python syntax.", "Trace a Python program and predict its result.", ["cs-programming"], "bridge"),
        unit("cs-control", "Conditions, Loops & Functions", "Build reusable logic with branches and repetition.", "Solve small programs with functions and control flow."),
        unit("cs-linear", "Arrays, Lists, Stacks & Queues", "Choose linear structures for everyday tasks.", "Implement a small collection-based program."),
        unit("cs-nonlinear", "Trees, Graphs & Hash Tables", "Understand hierarchical and linked data.", "Select and traverse suitable structures."),
        unit("cs-algorithms", "Algorithms & Complexity", "Search, sort and reason about time and space.", "Compare algorithm performance and correctness."),
        unit("cs-oop", "Object-Oriented Programming", "Objects, encapsulation, inheritance and composition.", "Design a simple object model."),
        unit("cs-databases", "Databases, SQL & APIs", "Persistent data and communicating systems.", "Query, store and expose simple application data."),
        unit("cs-engineering", "Software Engineering & Git", "Testing, design, collaboration and version control.", "Build and review a maintainable project."),
        unit("cs-project", "Applied Programming Capstone", "Combine programming, data and algorithms.", "Complete a multi-concept software project."),
    ]},
    { id: "blockchain-web3", title: "BLOCKCHAIN & WEB3", subtitle: "BLOCKS  /  WALLETS  /  SAFETY", overview: "Explore distributed systems and practice safer Web3 decisions.", accent: 0x55e8d5, units: [
        unit("web3-foundations", "Blockchain Foundations", "Ledgers, blocks, transactions and consensus.", "Explain a chain and spot unsafe claims.", ["web3-01-ledger", "web3-02-blocks", "web3-03-consensus", "web3-04-keys", "web3-05-verification", "web3-06-capstone"], "published"),
        unit("web3-wallets", "Wallets & Digital Identity", "Addresses, keys, phishing and permissions.", "Reject suspicious wallet prompts.", ["web3-wallets"], "bridge"),
        unit("web3-transactions", "Transactions & Gas", "Transaction life cycles, gas and confirmations.", "Read a transaction and explain the fee."),
        unit("web3-consensus", "Consensus & Network Security", "Validators, consensus and attacks.", "Compare consensus assumptions and trust."),
        unit("web3-contracts", "Smart Contract Fundamentals", "Smart-contract state and execution.", "Explain contract calls and basic permissions."),
        unit("web3-tokens", "Tokens & Digital Assets", "Token standards, ownership and utility.", "Differentiate token types and risks."),
        unit("web3-auditing", "Smart Contract Security", "Common vulnerabilities and secure patterns.", "Recognize unsafe contract behavior."),
        unit("web3-dapps", "Decentralized Applications", "Web interfaces, wallets and chain data.", "Trace a dApp interaction safely."),
        unit("web3-bnb", "BNB Smart Chain & Testnets", "Testnets, chain IDs and deployed contracts.", "Use a test environment responsibly."),
        unit("web3-capstone", "Web3 Security Capstone", "Investigate a simulated dApp incident.", "Demonstrate safe, evidence-based decisions."),
    ]},
    { id: "data-science-ai", title: "DATA SCIENCE & AI", subtitle: "DATA  /  MODELS  /  EVIDENCE", overview: "Develop a principled approach to data and predictive models.", accent: 0xc4b5fd, units: [
        unit("ai-python", "Python for Data Analysis", "Core data-friendly Python patterns.", "Inspect and transform small data collections."),
        unit("ai-arrays", "NumPy & Pandas", "Arrays, tables, selection and aggregation.", "Manipulate a small dataset."),
        unit("ai-cleaning", "Cleaning & Preparing Data", "Missing values and data quality.", "Prepare a trustworthy training dataset."),
        unit("ai-viz", "Data Visualization", "Charts, scales and graphical integrity.", "Choose a clear, honest chart."),
        unit("ai-stats", "Statistics & Probability", "Distributions, sampling and uncertainty.", "Interpret statistics and confidence."),
        unit("ai-ml", "Machine Learning Fundamentals", "Learning problems and core model families.", "Identify useful model assumptions."),
        unit("ai-eval", "Model Evaluation & Validation", "Holdout sets and relevant metrics.", "Evaluate a model without leakage."),
        unit("ai-deep", "Neural Networks & Deep Learning", "Layers, gradients and sequences.", "Trace a basic neural model."),
        unit("ai-ethics", "Responsible AI & Limitations", "Bias, transparency and model failure.", "Identify deployment risks."),
        unit("ai-project", "Applied AI Capstone", "From data question to evaluation.", "Defend an end-to-end analysis."),
    ]},
    { id: "cybersecurity", title: "CYBERSECURITY", subtitle: "DEFENSE  /  IDENTITY  /  THREATS", overview: "Learn defensive security and threat-aware engineering.", accent: 0xfb9c9c, units: [
        unit("sec-basics", "Security Fundamentals", "Confidentiality, integrity and availability.", "Explain foundational security goals."),
        unit("sec-network", "Networks & Protocols", "TCP/IP and common network services.", "Trace a network request."),
        unit("sec-identity", "Authentication & Identity", "Passwords, MFA and sessions.", "Choose reliable authentication controls."),
        unit("sec-phishing", "Phishing & Social Engineering", "Deceptive messages and verification.", "Identify and report a phishing attempt."),
        unit("sec-web", "Web Application Security", "Common web threats and mitigation.", "Describe defensive web controls."),
        unit("sec-crypto", "Cryptography Basics", "Encryption, hashing and signatures.", "Match mechanisms to security goals."),
        unit("sec-code", "Secure Coding", "Validation, secrets and dependency risks.", "Review small insecure code examples."),
        unit("sec-threat", "Threat Modeling & Risk", "Assets, attackers and controls.", "Analyze a realistic threat."),
        unit("sec-incident", "Incident Response", "Detection, containment and recovery.", "Prioritize response steps."),
        unit("sec-project", "Defensive Security Capstone", "Apply defensive concepts to a scenario.", "Document a threat and mitigation plan."),
    ]},
];

export function getAcademyTrack(id: string): AcademyTrack | undefined {
    return ACADEMY_TRACKS.find((track) => track.id === id);
}
export function getAcademyUnit(id: string): AcademyUnit | undefined {
    for (const track of ACADEMY_TRACKS) {
        const found = track.units.find((unit) => unit.id === id);
        if (found) return found;
    }
    return undefined;
}
