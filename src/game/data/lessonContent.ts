/**
 * G3.7 reusable learning content. All scenarios are simulated and cannot
 * interact with real wallets, websites, contracts, or financial accounts.
 */
export interface LessonPage {
    title: string;
    explanation: string;
    exampleTitle: string;
    example: string;
    takeaway: string;
}

export interface LearningScenario {
    id: string;
    title: string;
    situation: string;
    evidence: readonly string[];
    question: string;
    choices: readonly [string, string, string];
    correct: number;
    explanation: string;
}

export interface InteractiveLesson {
    nodeId: string;
    title: string;
    subtitle: string;
    xpReward: number;
    pages: readonly LessonPage[];
    practice: LearningScenario;
    assessment: readonly LearningScenario[];
}

export const INTERACTIVE_LESSONS: Readonly<Record<string, InteractiveLesson>> = {
    "web3-wallets": {
        nodeId: "web3-wallets",
        title: "WALLET SAFETY",
        subtitle: "WEB3 / DIGITAL SELF-DEFENSE",
        xpReward: 50,
        pages: [
            {
                title: "PUBLIC VS. PRIVATE",
                explanation: "A public wallet address can be shared to receive assets. A private key or recovery phrase grants access to a wallet and must be kept secret.",
                exampleTitle: "SIMULATED INBOX",
                example: "A classmate asks for your public address to return a token. A stranger asks for your recovery phrase to 'verify your account'. These requests are NOT equivalent.",
                takeaway: "A recovery phrase is not a login code. Never enter it into an unsolicited site.",
            },
            {
                title: "VERIFY THE DESTINATION",
                explanation: "A familiar logo or a sense of urgency does not prove that a website is legitimate. Check the complete address against an independently trusted source.",
                exampleTitle: "TWO SIMULATED LINKS",
                example: "portal.campusbounty.example  vs.  campusb0unty-prizes.example. The second substitutes a zero for the letter 'o' and adds an unrelated reward domain.",
                takeaway: "Verify a destination independently; do not trust the link supplied by the suspicious message.",
            },
            {
                title: "REVIEW PERMISSIONS",
                explanation: "A wallet may ask you to sign a message or approve spending by a smart contract. A token spending approval can expose assets if the spender is untrusted.",
                exampleTitle: "SIMULATED APPROVAL",
                example: "A game requests unlimited allowance for an unknown spender, even though the task needs no token transfer. Reject and inspect the requested action.",
                takeaway: "Check the spender, action, and amount; never sign a request you do not understand.",
            },
        ],
        practice: {
            id: "wallet-practice",
            title: "TRAINING: CLAIM ALERT",
            situation: "A pop-up claims: 'Free campus tokens! Your account expires in 10 minutes.' It asks you to reconnect through a new website.",
            evidence: ["Unsolicited and time-limited message", "Unfamiliar web address", "Request to connect a wallet before seeing the offer"],
            question: "What is the safest first move?",
            choices: ["Connect quickly before the timer ends", "Verify the campaign through an independent official source", "Enter the recovery phrase to prove ownership"],
            correct: 1,
            explanation: "Urgency is a common social-engineering tactic. Check a trusted source first, and never disclose recovery phrases.",
        },
        assessment: [
            {
                id: "wallet-1",
                title: "CASE 01: ACCOUNT RECOVERY",
                situation: "An account-support chat says it can restore access if you send the twelve-word recovery phrase.",
                evidence: ["Unsolicited support chat", "Requests secret recovery words", "Claims it is a required security check"],
                question: "Choose the appropriate response.",
                choices: ["Share the first six words", "Refuse and use independently verified support channels", "Send the whole phrase using an encrypted chat"],
                correct: 1,
                explanation: "The recovery phrase controls wallet access. No legitimate support representative needs it.",
            },
            {
                id: "wallet-2",
                title: "CASE 02: LOOK-ALIKE SITE",
                situation: "You are invited to visit campusb0unty-prizes.example; your saved directory lists portal.campusbounty.example.",
                evidence: ["The campaign domain uses the numeral zero", "A different domain is listed in a verified directory", "Both sites show identical logos"],
                question: "Which evidence should guide your decision?",
                choices: ["The look-alike is safe because the logo matches", "Any site with HTTPS is automatically official", "Use the independently verified directory and avoid the look-alike"],
                correct: 2,
                explanation: "Logos and HTTPS do not establish who operates a website. Verify the full domain independently.",
            },
            {
                id: "wallet-3",
                title: "CASE 03: TOKEN APPROVAL",
                situation: "An unknown contract requests permission to spend an unlimited amount of your tokens to view a free tutorial.",
                evidence: ["Unrecognized contract", "Unlimited allowance request", "The tutorial does not require a payment"],
                question: "How should you respond?",
                choices: ["Reject the request and inspect contract identity and permissions", "Approve: unlimited allowances cannot be misused", "Share your private key so the contract can validate you"],
                correct: 0,
                explanation: "Never approve an unfamiliar spender or an unnecessary allowance. Reject first and investigate.",
            },
            {
                id: "wallet-4",
                title: "CASE 04: PUBLIC ADDRESS",
                situation: "A trusted teammate needs to send you a small simulated token refund and asks for your wallet's public address.",
                evidence: ["Request is only for a public receiving address", "No signing or recovery phrase is requested", "Network compatibility still needs checking"],
                question: "Which response best matches safe practice?",
                choices: ["Share the public address after verifying the network and recipient context", "Share the private key instead", "Assume every public address request is malicious"],
                correct: 0,
                explanation: "A public receiving address can be shared. Confirm the network, but keep private keys and phrases secret.",
            },
            {
                id: "wallet-5",
                title: "CASE 05: SIGN-IN REQUEST",
                situation: "A website you did not intend to visit suddenly opens a wallet signature request claiming it is needed for security.",
                evidence: ["Unexpected signature prompt", "The requested message is unfamiliar", "The page claims refusal will freeze your account"],
                question: "What should happen next?",
                choices: ["Sign anything that is not labeled a transfer", "Reject, leave the page, and verify through a trusted channel", "Approve just once to make the warning disappear"],
                correct: 1,
                explanation: "Unfamiliar signatures can authorize actions. Read what you sign; reject unexpected requests.",
            },
        ],
    },
    "cs-programming": {
        nodeId: "cs-programming",
        title: "PROGRAMMING LOGIC",
        subtitle: "COMPUTER SCIENCE / CODE TRACING",
        xpReward: 50,
        pages: [
            {
                title: "FOLLOW THE STATE",
                explanation: "A variable stores a value. Program statements execute in order, and assignments replace the old value with a new one.",
                exampleTitle: "TRACE THIS CODE",
                example: "score = 2\nscore = score + 3\nprint(score)   # 5",
                takeaway: "Trace changes one statement at a time instead of guessing from the final line.",
            },
            {
                title: "BRANCH ON CONDITIONS",
                explanation: "An if statement runs its body only when the condition is true. An else branch runs when that condition is false.",
                exampleTitle: "ACCESS CHECK",
                example: "level = 4\nif level >= 5:\n    print('OPEN')\nelse:\n    print('LOCKED')",
                takeaway: "Check the boolean expression first. Here, 4 >= 5 is false, so LOCKED prints.",
            },
            {
                title: "COUNT LOOP ITERATIONS",
                explanation: "A loop executes once per item in its iterable or while its condition remains true. Python's range(start, stop) excludes stop.",
                exampleTitle: "LOOP TRACE",
                example: "total = 0\nfor n in range(1, 4):\n    total += n\nprint(total)   # 6",
                takeaway: "range(1, 4) yields 1, 2, 3 — not 4.",
            },
        ],
        practice: {
            id: "code-practice",
            title: "TRAINING: CAMPUS GATE",
            situation: "A digital campus gate uses: level = 3; if level >= 5: open_gate() else: show_locked().",
            evidence: ["Current level = 3", "Unlock requirement = 5", "Only one branch runs"],
            question: "Which action executes?",
            choices: ["open_gate()", "show_locked()", "Both actions execute"],
            correct: 1,
            explanation: "3 >= 5 is false, so the else branch executes.",
        },
        assessment: [
            {
                id: "code-1", title: "TRACE 01: ASSIGNMENT", situation: "coins = 4; coins = coins * 2; coins = coins - 3",
                evidence: ["Process statements in order", "Multiplication happens in the second assignment"],
                question: "What is the final value of coins?",
                choices: ["5", "8", "11"], correct: 0,
                explanation: "4 * 2 = 8, then 8 - 3 = 5.",
            },
            {
                id: "code-2", title: "TRACE 02: CONDITIONS", situation: "hp = 0; if hp > 0: print('ALIVE') else: print('RESPAWN')",
                evidence: ["hp is zero", "The condition is hp > 0"],
                question: "What prints?",
                choices: ["ALIVE", "RESPAWN", "Nothing"], correct: 1,
                explanation: "0 > 0 is false; the else branch prints RESPAWN.",
            },
            {
                id: "code-3", title: "TRACE 03: RANGE", situation: "total = 0; for x in range(1, 4): total += x",
                evidence: ["range(1, 4) excludes 4", "The values are 1, 2, and 3"],
                question: "What is total?",
                choices: ["10", "4", "6"], correct: 2,
                explanation: "1 + 2 + 3 = 6.",
            },
            {
                id: "code-4", title: "TRACE 04: NESTED LOGIC", situation: "x = 7; if x % 2 == 0: print('EVEN') else: print('ODD')",
                evidence: ["% gives the remainder", "7 divided by 2 leaves remainder 1"],
                question: "Which output is correct?",
                choices: ["ODD", "EVEN", "7"], correct: 0,
                explanation: "7 % 2 is 1, so the else branch prints ODD.",
            },
            {
                id: "code-5", title: "TRACE 05: LOOP COUNT", situation: "count = 0; for n in range(3): count += 2",
                evidence: ["range(3) contains 0, 1, 2", "Each iteration adds 2"],
                question: "What is count after the loop?",
                choices: ["4", "6", "8"], correct: 1,
                explanation: "Three iterations each add 2: count becomes 6.",
            },
        ],
    },
};

export function getInteractiveLesson(nodeId: string): InteractiveLesson | undefined {
    return INTERACTIVE_LESSONS[nodeId];
}
