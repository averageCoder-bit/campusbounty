/** Seeded, fiction-only learning scenarios; never solicit real secrets. */
export type DistrictId = "source" | "approval" | "recovery";
export type EvidenceRecord = { title: string; body: string };
export type Challenge = {
    question: string;
    options: [string, string, string];
    answer: number;
    explanation: string;
    wrong: [string, string, string];
};
export type CaseSet = {
    evidence: Record<DistrictId, [EvidenceRecord, EvidenceRecord, EvidenceRecord]>;
    puzzles: Record<DistrictId, [Challenge, Challenge]>;
};

/** Mulberry32: same numeric seed -> same run layout, options, and case selection. */
export class SeededRandom {
    private state: number;
    constructor(seed: number) { this.state = seed >>> 0; }
    next(): number {
        let t = this.state += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    int(min: number, max: number): number { return min + Math.floor(this.next() * (max - min + 1)); }
    pick<T>(xs: readonly T[]): T { return xs[this.int(0, xs.length - 1)]; }
    shuffle<T>(xs: readonly T[]): T[] {
        const out = [...xs];
        for (let i = out.length - 1; i > 0; i--) {
            const j = this.int(0, i);
            [out[i], out[j]] = [out[j], out[i]];
        }
        return out;
    }
}

function randomAnswers(rng: SeededRandom, p: Challenge): Challenge {
    const order = rng.shuffle([0, 1, 2]);
    return {
        ...p,
        options: order.map(i => p.options[i]) as Challenge["options"],
        wrong: order.map(i => p.wrong[i]) as Challenge["wrong"],
        answer: order.indexOf(p.answer),
    };
}

export function buildQuestCases(seed: number): CaseSet {
    const rng = new SeededRandom(seed ^ 0x5EED1234);
    const portal = rng.pick([
        { real: "learn.campusbounty.edu", fake: "campusb0unty-bonus.example", medium: "email" },
        { real: "portal.campusbounty.edu", fake: "campusbounty.edu.login-verify.example", medium: "QR-code poster" },
        { real: "courses.campusbounty.edu", fake: "cb-student-prizes.example", medium: "campus chat" },
    ]);
    const amount = rng.int(2, 5);
    const suspect = rng.pick(["0xA1...9F4", "0xBC...041", "0xE2...88A"]);
    const recovery = rng.pick(["fake helpdesk call", "urgent ticket", "impersonated moderator chat"]);

    const evidence: CaseSet["evidence"] = {
        source: [
            { title: "SIGNED IT DIRECTORY", body: `The official campus directory lists ${portal.real}. Read the FULL hostname: the domain ending matters more than the logo.` },
            { title: "REWARD INVITATION", body: `A ${portal.medium} promises instant coins if you open ${portal.fake} and connect a wallet before a countdown expires.` },
            { title: "ACCESS AUDIT", body: "Security found the campaign wasn't issued by the campus. Its brand graphics were copied, and the destination host is not in the approved directory." },
        ],
        approval: [
            { title: "PURCHASE REQUEST", body: `The authorized lab exercise needs only ${amount} practice tokens. No recurring or unlimited allowance is necessary.` },
            { title: "SPENDER MANIFEST", body: "Only independently reviewed spender contracts belong in the trusted registry. A matching app title alone is not verification." },
            { title: "UNUSUAL APPROVAL", body: `An unsolicited window asks for UNLIMITED token allowance for unknown spender ${suspect}. The address is absent from the approved manifest.` },
        ],
        recovery: [
            { title: "SECURITY POLICY", body: "A wallet recovery phrase is equivalent to control of the wallet. It must stay private, with backup stored offline and securely." },
            { title: "COMPROMISE REPORT", body: `A ${recovery} requested a recovery phrase to 'restore access'. Employees confirm the request was not authorized.` },
            { title: "INCIDENT RESPONSE", body: "If a phrase is exposed, simply changing an app password does NOT revoke it. Safely move assets to a new wallet and seek trusted guidance." },
        ],
    };

    const puzzles: CaseSet["puzzles"] = {
        source: [
            {
                question: "A prize message includes three links. Which address should be verified through the independent campus directory?",
                options: [portal.fake, portal.real, "Any site displaying the campus crest"], answer: 1,
                explanation: "Verify the full domain through a trusted, independent source. Branding and urgency do not authenticate a site.",
                wrong: ["A lookalike or unrelated host is suspicious.", "", "Logos can be copied and do not prove domain ownership."],
            },
            {
                question: "The sender urges you to act before the timer runs out. What is the strongest warning sign?",
                options: ["A copied logo", "A time-limited banner", "An unverified host requesting wallet access"], answer: 2,
                explanation: "The unverified wallet-connection destination is the central risk; urgency amplifies the deception.",
                wrong: ["Not enough alone: logos can appear on legitimate pages too.", "Not enough alone: urgency may be legitimate but raises caution.", ""],
            },
        ],
        approval: [
            {
                question: `You need ${amount} practice tokens. An unknown spender requests unlimited allowance. Your safest action?`,
                options: ["Accept unlimited approval", `Reject, verify the spender, and limit any necessary allowance to ${amount}`, "Give support your seed phrase"], answer: 1,
                explanation: "Only grant verified contracts the minimum necessary access. Unknown unlimited allowances can place token balances at risk.",
                wrong: ["An unknown unlimited approval expands the attack surface.", "", "Recovery phrases are never needed for a token approval."],
            },
            {
                question: "After noticing an unexpected token approval, what should you investigate first?",
                options: ["Spender address, allowance amount, and permissions", "The icon colour", "The gas estimate only"], answer: 0,
                explanation: "The spender address and scope determine what the contract may transfer. Read permission details before signing.",
                wrong: ["", "Visual appearance provides no assurance about permissions.", "Fees alone do not show what permissions you are granting."],
            },
        ],
        recovery: [
            {
                question: "A supposed helpdesk agent asks for your wallet recovery phrase. What do you do?",
                options: ["Share half the words", "Enter it in the support form", "Refuse and use an independent official support channel"], answer: 2,
                explanation: "No legitimate support agent needs your recovery phrase. Do not share all or part of it.",
                wrong: ["Even partial disclosure is unsafe and unnecessary.", "Forms and messages must never receive a wallet recovery phrase.", ""],
            },
            {
                question: "Someone already obtained a wallet's recovery phrase. Is changing the app password sufficient?",
                options: ["No: the wallet secret may be compromised; move assets safely to a new wallet", "Yes: it rotates the recovery phrase", "Only if the app is reinstalled"], answer: 0,
                explanation: "A recovery phrase isn't reset by a normal app password change. Follow trusted incident-response guidance.",
                wrong: ["", "Changing a password does not change the exposed wallet seed.", "Reinstalling an app does not revoke the exposed secret."],
            },
        ],
    };
    for (const key of ["source", "approval", "recovery"] as const) {
        puzzles[key] = puzzles[key].map(p => randomAnswers(rng, p)) as [Challenge, Challenge];
    }
    return { evidence, puzzles };
}
