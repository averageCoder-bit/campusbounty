import type { AcademyChallenge, AcademyLesson, AcademyPage } from "../../systems/LearningEngine";

const pg = (heading: string, body: string, exampleTitle: string, example: string, takeaway: string): AcademyPage =>
    ({ heading, body, exampleTitle, example, takeaway });
const pick = (id: string, title: string, prompt: string, options: [string,string,string], answerIndex: number,
    explanation: string, context = "", hint = "Look for the evidence that directly answers the question."): AcademyChallenge =>
    ({ id, kind: "choice", title, prompt, options, answerIndex, explanation, context, hint });
const trace = (id: string, title: string, prompt: string, context: string, options: [string,string,string], answerIndex: number,
    explanation: string): AcademyChallenge =>
    ({ id, kind: "trace", title, prompt, context, options, answerIndex, explanation, hint: "Execute each statement in order; do not skip reassignment." });
const order = (id: string, title: string, prompt: string, steps: [string,string,string], explanation: string): AcademyChallenge =>
    ({ id, kind: "sequence", title, prompt, steps, explanation, hint: "Start at the earliest required action and place the dependent action last." });
const fill = (id: string, title: string, prompt: string, accepted: string[], explanation: string, context = ""): AcademyChallenge =>
    ({ id, kind: "fill", title, prompt, accepted, explanation, context, hint: "Enter a short value or code fragment. Capitalization and extra spaces do not matter." });
const lesson = (id: string, unitId: string, title: string, subtitle: string, pages: AcademyPage[],
    practice: AcademyChallenge, assessment: AcademyChallenge[], isCapstone = false): AcademyLesson => ({
        id, unitId, title, subtitle, pages, practice, assessment, isCapstone,
        minScore: isCapstone ? 4 : 3, xpReward: isCapstone ? 75 : 30,
    });

/** Two completely authored opening chapters (12 lessons; 42 assessed challenges). */
export const ACADEMY_LESSONS: Readonly<Record<string, AcademyLesson>> = Object.fromEntries(([
    lesson("cs-01-bits", "cs-computing", "Bits and Binary", "CS  /  FOUNDATIONS  /  01", [
        pg("Everything is data", "Computers represent information as patterns of bits. A bit has two states, 0 or 1. The meaning of a bit pattern depends on its encoding.", "A four-bit pattern", "1010 represents ten when interpreted as an unsigned binary number. It might mean something else under another agreed encoding.", "Bits have no meaning until interpreted."),
        pg("Place value matters", "In binary, place values grow as powers of two from right to left: 1, 2, 4, 8, 16, ...", "Convert 1101", "1×8 + 1×4 + 0×2 + 1×1 = 13.", "Read a binary number from rightmost place value."),
    ],
        pick("cs01-pr", "Warm-up", "Which is a bit?", ["An image file", "A value that is 0 or 1", "A folder"], 1, "A bit stores a binary state."), [
        trace("cs01-a", "Binary to decimal", "Convert 1011 (base 2) to decimal.", "8 + 0 + 2 + 1", ["11", "9", "13"], 0, "1011 = 8 + 2 + 1 = 11."),
        pick("cs01-b", "Encoding", "Why can the same bytes represent different things?", ["Because interpretation depends on the agreed encoding", "Because memory changes randomly", "Because all bytes are letters"], 0, "An encoding or data type determines interpretation."),
        fill("cs01-c", "Quick conversion", "Enter the decimal value of binary 1001.", ["9"], "8 + 1 = 9."),
    ]),
    lesson("cs-02-io", "cs-computing", "Input, Process, Output", "CS  /  FOUNDATIONS  /  02", [
        pg("The program pipeline", "Many programs take input, apply a set of operations, and produce output. Identify each part to understand and debug the system.", "Campus check-in", "Input: student ID. Process: validate enrollment. Output: allowed or rejected.", "Separate received data from computed results."),
        pg("State and side effects", "Output can be printed text, a saved record, or a changed screen. Side effects are observable changes beyond simply returning a value.", "A calculator", "Input 2 and 3 -> addition -> output 5. Saving 5 to a file is an additional side effect.", "Return values and external side effects are different."),
    ],
        order("cs02-pr", "Order the steps", "Arrange a basic calculator pipeline.", ["Read two numbers", "Add the numbers", "Display the sum"], "A calculation cannot add numbers before receiving them."), [
        pick("cs02-a", "Identify input", "In a login form, which item is input?", ["User's entered email", "The 'Welcome' screen", "An access decision"], 0, "User-provided data enters the system as input."),
        order("cs02-b", "Trace processing", "Order a simple temperature converter.", ["Read Celsius value", "Compute C × 9/5 + 32", "Display Fahrenheit value"], "Receive, transform, present."),
        pick("cs02-c", "Side effects", "Which action changes something outside a function?", ["Returning 7", "Saving a result to a database", "Computing 2 + 5 locally"], 1, "Writing to persistent storage is a side effect."),
    ]),
    lesson("cs-03-algorithms", "cs-computing", "Algorithms and Pseudocode", "CS  /  FOUNDATIONS  /  03", [
        pg("A finite method", "An algorithm is a clear sequence of finite steps for solving a problem. Pseudocode describes those steps without requiring exact programming-language syntax.", "Search a list", "Compare each item with the target. If equal, return its position. If no match remains, report not found.", "Algorithms should specify inputs, outputs, and termination."),
        pg("Order and correctness", "A correct algorithm must handle valid inputs reliably, including edge cases. Steps may depend on earlier steps.", "Average score", "Read scores -> compute total -> divide by number of scores (after checking count > 0).", "Check special cases before using assumptions."),
    ],
        order("cs03-pr", "Algorithm ordering", "Arrange steps to find a maximum value.", ["Initialize best with first item", "Compare subsequent items and update best", "Return best after all comparisons"], "You must have an initial candidate before comparisons."), [
        pick("cs03-a", "Termination", "Why must an algorithm terminate for finite valid input?", ["So it eventually returns a result", "So it avoids all loops", "So it never handles errors"], 0, "A terminating process reaches a finite outcome."),
        order("cs03-b", "Find a target", "Order a basic linear search.", ["Start at the first item", "Compare each item to the target", "Return match or not found"], "Compare before returning a match."),
        pick("cs03-c", "Edge case", "What should a program check before averaging a list?", ["Whether the list is empty", "Whether the list is sorted", "Whether the list uses strings"], 0, "Dividing by the length of an empty list would divide by zero."),
    ]),
    lesson("cs-04-variables", "cs-computing", "Variables and Expressions", "CS  /  FOUNDATIONS  /  04", [
        pg("Follow assignment", "A variable name refers to a value. In Python, an assignment replaces the value associated with that name.", "Reassignment", "coins = 3\ncoins = coins + 2\nprint(coins)  # 5", "Read assignments from top to bottom."),
        pg("Operators and types", "Arithmetic combines numeric values; operators have precedence. Strings represent text. In Python, '+' behaves differently for numbers and strings.", "Two uses of +", "3 + 4 -> 7\n'3' + '4' -> '34'", "Identify types before predicting an expression."),
    ],
        trace("cs04-pr", "Trace the register", "What is printed?", "x = 4\nx = x + 3\nprint(x)", ["7", "4", "3"], 0, "The second assignment updates x to 7."), [
        trace("cs04-a", "Variable trace", "What is printed?", "count = 2\ncount *= 3\ncount -= 1\nprint(count)", ["6", "5", "4"], 1, "2 × 3 = 6 then 6 - 1 = 5."),
        fill("cs04-b", "Write a statement", "Complete the output line to display the variable name.", ["print(name)"], "print(name) displays the variable's value.", "name = 'Ada'\n# Type the missing Python statement"),
        pick("cs04-c", "Type recognition", "What is the result of '2' + '4' in Python?", ["6", "24", "An integer 24"], 1, "Both operands are strings; + concatenates them."),
    ]),
    lesson("cs-05-debugging", "cs-computing", "Tracing and Debugging", "CS  /  FOUNDATIONS  /  05", [
        pg("Find the first difference", "Debugging starts by comparing expected and actual results. A trace table records the value of variables after each statement.", "Trace a loop", "total = 0\nfor x in [1, 2, 3]:\n    total += x\n# total is 6", "Trace state changes, not just the final line."),
        pg("Fix the cause", "An off-by-one bug occurs when an algorithm starts or ends one step early or late. A test should expose the incorrect boundary.", "Python range", "range(1, 4) yields 1, 2, 3; the upper bound is excluded.", "Test empty, smallest, and boundary inputs."),
    ],
        trace("cs05-pr", "Trace an accumulation", "What is total?", "total = 0\nfor n in range(1,4):\n    total += n", ["4", "6", "10"], 1, "The loop adds 1, 2, and 3."), [
        pick("cs05-a", "Boundary case", "What helps catch an off-by-one error?", ["Only testing large values", "Testing boundary inputs", "Removing all assertions"], 1, "Boundary tests reveal inclusive/exclusive mistakes."),
        trace("cs05-b", "Loop count", "How many times is print called?", "for i in range(3):\n    print(i)", ["2", "3", "4"], 1, "range(3) yields 0, 1, 2."),
        fill("cs05-c", "Fix the bound", "Fill the stop value so the loop prints 1, 2, 3.", ["4"], "range(1, 4) excludes 4.", "for x in range(1, __):\n    print(x)"),
    ]),
    lesson("cs-06-capstone", "cs-computing", "Capstone: Campus Gate", "CS  /  FOUNDATIONS  /  TRIAL", [
        pg("Your first systems mission", "You are reviewing a simulated campus entry gate. Follow its input, branching and output. Each piece must be consistent.", "Gate rule", "A student may enter only when the ID is valid AND access level is at least 2.", "A system decision follows declared rules, not intuition."),
        pg("Test the edge cases", "Try values just below, equal to, and above the threshold. Treat invalid IDs separately from insufficient permission.", "Sample cases", "valid=True, level=2 -> enter. valid=True, level=1 -> reject. valid=False, level=5 -> reject.", "Verify both the identity condition and access threshold."),
    ],
        pick("cs06-pr", "Warm-up", "Which input should be rejected?", ["Valid ID, level 3", "Invalid ID, level 9", "Valid ID, level 2"], 1, "A high level does not override an invalid ID."), [
        trace("cs06-a", "Trace the gate", "What prints?", "valid = True\nlevel = 2\nif valid and level >= 2:\n    print('ENTER')\nelse:\n    print('DENY')", ["DENY", "ENTER", "Nothing"], 1, "Both parts of the condition are true."),
        order("cs06-b", "Build the decision", "Arrange the gate algorithm.", ["Read ID and level", "Validate ID and compare level >= 2", "Output ENTER or DENY"], "Validate both inputs before deciding."),
        fill("cs06-c", "Fill the threshold", "Complete the condition to allow level 2 and above.", [">= 2", ">=2"], "The >= operator includes 2.", "if valid and level __ :"),
        pick("cs06-d", "Counterexample", "Which test detects a missing ID validation check?", ["Valid ID and level 2", "Invalid ID and level 5", "Valid ID and level 3"], 1, "A missing validation would wrongly admit an invalid ID."),
        trace("cs06-e", "Final trace", "What prints?", "valid = False\nlevel = 4\nprint('ENTER' if valid and level >= 2 else 'DENY')", ["ENTER", "DENY", "False"], 1, "False AND True is False, so it prints DENY."),
    ], true),

    lesson("web3-01-ledger", "web3-foundations", "Shared Ledgers", "WEB3  /  FOUNDATIONS  /  01", [
        pg("A shared record", "A blockchain is a ledger replicated across network participants. Its records can be verified against agreed rules rather than being held only by one operator.", "Campus points log", "Several participants keep matching copies of a simulated transaction log. They compare new updates under shared rules.", "Multiple copies do not automatically guarantee correctness."),
        pg("Trust assumptions", "Different blockchains use different participants, permissions, governance and consensus rules. Decentralization is not an absolute yes/no property.", "Who can validate?", "A permissionless network and a private consortium chain make different participation tradeoffs.", "Ask who controls updates and how disputes are resolved."),
    ],
        pick("w301-pr", "Replication", "What best describes a replicated ledger?", ["A shared record held by multiple participants", "A private password", "A single spreadsheet with no copies"], 0, "Replication means multiple participants hold copies."), [
        pick("w301-a", "Shared state", "What helps participants agree on a ledger update?", ["Common validation and consensus rules", "Matching website colors", "Identical computer brands"], 0, "Validation and consensus rules govern accepted updates."),
        pick("w301-b", "Trust", "Does having many copies automatically eliminate fraud?", ["Yes, without exceptions", "No, network rules and participation matter", "Only if the ledger has a logo"], 1, "Security depends on rules, participation and assumptions."),
        order("w301-c", "A proposed update", "Arrange a simplified update flow.", ["Someone proposes a transaction", "Participants validate it under network rules", "Accepted update enters the shared ledger"], "Validation occurs before acceptance."),
    ]),
    lesson("web3-02-blocks", "web3-foundations", "Transactions and Blocks", "WEB3  /  FOUNDATIONS  /  02", [
        pg("What is a transaction?", "A transaction expresses a requested network state change. A signed transaction can be checked against account and network rules.", "Send an asset", "A signed transfer includes a sender, destination, amount, and network-specific information.", "Signing authorizes a request; it does not guarantee acceptance."),
        pg("Linking blocks", "Blocks may contain ordered transactions and a reference to a previous block. Cryptographic hashes help reveal tampering with committed data.", "A linked chain", "Block B includes a reference to Block A's hash. Changing committed Block A data changes the expected reference.", "Hash links help make changes detectable under the chain's rules."),
    ],
        order("w302-pr", "Transaction path", "Arrange a simplified transaction flow.", ["Create and sign a request", "Network checks transaction rules", "Transaction can be included in a block"], "Signing precedes network validation."), [
        pick("w302-a", "Signature meaning", "What does a valid transaction signature generally demonstrate?", ["Authorization by a corresponding private key", "Immediate finality", "Zero risk"], 0, "Signatures verify authorization, not confirmation."),
        pick("w302-b", "Block linkage", "Why reference the prior block hash?", ["To detect changes to a linked block", "To hide every transaction", "To make all fees zero"], 0, "A hash reference supports tamper-evident history."),
        pick("w302-c", "Confirmation", "What is accurate about broadcasting a transaction?", ["It guarantees success", "It requests processing, not guaranteed inclusion", "It transfers ownership instantly on all networks"], 1, "Broadcast alone does not guarantee inclusion or success."),
    ]),
    lesson("web3-03-consensus", "web3-foundations", "Consensus and Validators", "WEB3  /  FOUNDATIONS  /  03", [
        pg("Agreement without one database", "Consensus mechanisms help distributed participants agree on accepted network history. Different designs rely on different trust and economic assumptions.", "Validators", "Validators participate according to a protocol. Their proposals and attestations may be rewarded or penalized depending on the network.", "Consensus is about agreeing on valid ordering and state."),
        pg("Finality and failure", "A confirmed transaction may have different finality properties on different networks. Congestion, chain reorganizations and validator behavior can affect timing.", "A pending transfer", "A user observes a pending transaction and waits for the network's confirmation rules.", "Do not confuse submission, inclusion and finality."),
    ],
        pick("w303-pr", "Network agreement", "What is consensus used for?", ["Coordinating accepted ledger history", "Generating wallet passwords", "Ensuring every app is scam-free"], 0, "Consensus coordinates accepted changes."), [
        pick("w303-a", "Validator role", "What does a validator do?", ["Participate in verifying/proposing network updates", "Own every user's wallet", "Set all website prices"], 0, "Validators operate under network rules."),
        order("w303-b", "Transaction milestones", "Order these conceptual stages.", ["Broadcast a signed transaction", "Transaction is included and confirmed", "Observe any additional finality threshold"], "Different networks define finality differently."),
        pick("w303-c", "Safety nuance", "What can congestion affect?", ["Confirmation timing", "Private keys stored offline", "The definition of a bit"], 0, "Network congestion can delay inclusion."),
    ]),
    lesson("web3-04-keys", "web3-foundations", "Keys and Wallet Identity", "WEB3  /  FOUNDATIONS  /  04", [
        pg("Public information vs secrets", "A public address is used to receive assets; private keys and recovery phrases grant control and must remain secret.", "Send a refund", "A teammate can receive a public address. They must never need a private key or recovery phrase.", "Never disclose private keys or seed phrases."),
        pg("Signatures and permissions", "A wallet may sign a message or transaction. A signature can authorize important actions, including token allowances. Read and verify the context.", "Approval caution", "A token approval can allow another contract to spend tokens. Verify spender and allowance before approval.", "Signing is an action, not an ordinary login click."),
    ],
        pick("w304-pr", "Public address", "Which item is generally shareable?", ["Recovery phrase", "Public receiving address", "Private key"], 1, "A public receiving address can be shared appropriately."), [
        pick("w304-a", "Secret material", "What must remain private?", ["Wallet recovery phrase", "Public receiving address", "Public transaction hash"], 0, "Recovery words can be used to control a wallet."),
        pick("w304-b", "Signature", "Why inspect a wallet signing request?", ["Signatures can authorize important actions", "All signatures are harmless", "A wallet always reverses signatures"], 0, "Signing may authorize transfers, permissions or other actions."),
        fill("w304-c", "Quick classification", "Type PUBLIC or PRIVATE for a wallet recovery phrase.", ["PRIVATE"], "The recovery phrase is sensitive and should remain secret."),
    ]),
    lesson("web3-05-verification", "web3-foundations", "Verify Before You Sign", "WEB3  /  FOUNDATIONS  /  05", [
        pg("Suspicious prompts", "Unsolicited rewards, deadlines, look-alike websites and secret recovery requests are common phishing clues.", "A fake prize", "A message demands that you connect a wallet to claim a surprise token reward before an artificial countdown ends.", "Urgency and familiar branding are not verification."),
        pg("Independent verification", "Confirm links through a trusted channel you navigate to independently. Review the full address, spender, chain and requested permissions.", "A safer workflow", "Open the official resource yourself, check the address, and reject permissions you do not understand.", "Do not rely on the questionable message as the source of verification."),
    ],
        pick("w305-pr", "Urgent claim", "A new site asks for your wallet phrase. Best action?", ["Enter it quickly", "Refuse and verify independently", "Send half of it"], 1, "No legitimate prize requires your recovery phrase."), [
        pick("w305-a", "Domain check", "What is the strongest evidence of an official destination?", ["Independently verified exact domain", "Matching logo", "HTTPS alone"], 0, "A logo and HTTPS can exist on malicious sites."),
        order("w305-b", "Security routine", "Put this verification process in order.", ["Stop at unexpected wallet prompt", "Navigate independently to official resources", "Only sign after reviewing full action and permissions"], "Do not sign first and investigate later."),
        pick("w305-c", "Token permissions", "A free guide demands unlimited approval. What should you do?", ["Reject and inspect", "Approve without reading", "Share the recovery words"], 0, "Unnecessary unlimited allowances should be rejected."),
    ]),
    lesson("web3-06-capstone", "web3-foundations", "Capstone: The False Airdrop", "WEB3  /  FOUNDATIONS  /  TRIAL", [
        pg("Incident simulation", "A simulated campus announcement claims a surprise airdrop. You must reason about authenticity, wallet permissions and network confirmation.", "Case file", "The announcement uses a look-alike domain and requests an unlimited token allowance to a newly deployed contract.", "Verify context; never allow urgency to override safety."),
        pg("Complete the chain of evidence", "A transaction signature authorizes a request; broadcasting does not guarantee a result. Assess source, requested action and network status separately.", "Security decision", "Reject unverified requests, inspect verified sources, and distinguish pending transactions from confirmed updates.", "A correct decision needs both identity and permission checks."),
    ],
        pick("w306-pr", "First response", "Unfamiliar airdrop site demands unlimited approval. Your first action?", ["Reject and verify", "Approve because it is free", "Share secret key"], 0, "Reject unexpected high-risk permissions."), [
        pick("w306-a", "Look-alike", "What is a robust way to check the domain?", ["Navigate from independently trusted resources", "Trust a screenshot of the logo", "Trust a social media reply"], 0, "Use an independently verified channel."),
        pick("w306-b", "Spender", "What must be checked in a token approval?", ["Spender and allowance", "Only page background", "Browser tab color"], 0, "Approval scope and spender identity determine the requested authorization."),
        order("w306-c", "Investigate safely", "Arrange the incident response.", ["Do not approve the unexpected request", "Verify source and contract context independently", "Only consider an understood, necessary action"], "Safety must precede signing."),
        fill("w306-d", "Key classification", "Is a recovery phrase PUBLIC or PRIVATE?", ["PRIVATE"], "Seed phrases must remain secret."),
        pick("w306-e", "Pending status", "A transaction is broadcast but pending. What can be said?", ["It is not yet confirmed", "It is definitely final", "It cannot fail"], 0, "Broadcasting does not guarantee confirmation."),
    ], true),
] as AcademyLesson[]).map((entry) => [entry.id, entry]));

export function getAcademyLesson(id: string): AcademyLesson | undefined { return ACADEMY_LESSONS[id]; }
export function findAcademyChallenge(id: string): AcademyChallenge | undefined {
    for (const lesson of Object.values(ACADEMY_LESSONS)) {
        if (lesson.practice.id === id) return lesson.practice;
        const found = lesson.assessment.find((q) => q.id === id);
        if (found) return found;
    }
    return undefined;
}
