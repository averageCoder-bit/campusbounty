import { useEffect, useState } from "react";
import {
    checkPublicDemoBadge,
    connectBscTestnet,
    getChainStatus,
    getMyWeb3,
    issueMyBadge,
    linkMyWallet,
    verifyMyBadge,
    type ChainStatus,
    type WalletSnapshot,
    type VerificationResult,
} from "../game/services/Web3AchievementClient";
import { supabase } from "../game/services/ProgressionClient";
import { ProgressionAccount } from "./ProgressionAccount";
import "./web3-achievements.css";

const BADGES: Record<string, string> = {
    "computing-apprentice": "Computing Apprentice — CS Academy Capstone",
    "ledger-explorer": "Ledger Explorer — Web3 Academy Capstone",
};
const fmtWallet = (v: string) => `${v.slice(0, 6)}…${v.slice(-4)}`;

/** Fixed mini-launcher; mounted once next to PhaserGame in App.tsx. */
export function Web3AchievementPanel() {
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [chain, setChain] = useState<ChainStatus | null>(null);
    const [profile, setProfile] = useState<WalletSnapshot | null>(null);
    const [verified, setVerified] = useState<Record<string, boolean>>({});
    const [bountyPreview, setBountyPreview] = useState(false);
    const [demoWallet, setDemoWallet] = useState<string | null>(
        import.meta.env.VITE_DEMO_STUDENT_WALLET || null,
    );
    const [demoVerified, setDemoVerified] = useState<boolean | null>(null);

    async function refresh() {
        setChain(await getChainStatus());
        if (supabase) {
            const { data } = await supabase.auth.getSession();
            setProfile(data.session ? await getMyWeb3() : null);
        }
    }

    useEffect(() => {
        if (!open) return;
        void refresh().catch((e) =>
            setError(
                e instanceof Error ? e.message : "Unable to load wallet state",
            ),
        );
    }, [open]);

    async function run(task: () => Promise<void>) {
        setBusy(true);
        setError("");
        setNotice("");
        try {
            await task();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Action failed");
        } finally {
            setBusy(false);
        }
    }

    async function claim(id: string) {
        await run(async () => {
            const result = await issueMyBadge(id);
            setNotice(
                result.status === "submitted"
                    ? "BSC Testnet transaction submitted. Wait for confirmation, then click Verify."
                    : `Claim status: ${result.status}`,
            );
            await refresh();
        });
    }

    async function check(id: string) {
        await run(async () => {
            const result: VerificationResult = await verifyMyBadge(id);
            setVerified((previous) => ({ ...previous, [id]: result.verified }));
            setNotice(
                result.verified
                    ? "Verified on BSC Testnet! Explorer evidence is below."
                    : "Not confirmed yet. Wait a few seconds and try Verify again.",
            );
            await refresh();
        });
    }

    return (
        <>
            <button
                type="button"
                className="cbw3-launch"
                onClick={() => setOpen(true)}
            >
                ◈ WALLET / PROOF
            </button>
            {open && (
                <div
                    className="cbw3-backdrop"
                    role="presentation"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget)
                            setOpen(false);
                    }}
                >
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-label="BSC Testnet Achievements"
                        className="cbw3-dialog"
                        onKeyDown={(event) => {
                            event.stopPropagation();
                            if (event.key === "Escape") {
                                event.preventDefault();
                                setOpen(false);
                            }
                        }}
                    >
                        <header className="cbw3-header">
                            <div>
                                <small>CAMPUSBOUNTY / WEB3 PROOF</small>
                                <h2>ACHIEVEMENT REGISTRY</h2>
                            </div>
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                            >
                                × CLOSE
                            </button>
                        </header>
                        <p className="cbw3-info">
                            BNB Smart Chain Testnet · Chain ID 97 · No real
                            money, token, or payout.
                        </p>
                        <ProgressionAccount />
                        {chain?.contract ? (
                            <p>
                                Contract:{" "}
                                <a
                                    href={`${chain.explorer}/address/${chain.contract}`}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    {fmtWallet(chain.contract)} · View on
                                    BscScan
                                </a>
                            </p>
                        ) : (
                            <p className="cbw3-warning">
                                Contract not configured. Deploy it before
                                claiming badges.
                            </p>
                        )}
                        <div className="cbw3-line">
                            <span>
                                Linked wallet:{" "}
                                <strong>
                                    {profile?.wallet
                                        ? fmtWallet(profile.wallet)
                                        : "Not linked"}
                                </strong>
                            </span>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                    void run(async () => {
                                        const wallet = await linkMyWallet();
                                        setNotice(
                                            `MetaMask wallet ${fmtWallet(wallet)} linked by signature.`,
                                        );
                                        await refresh();
                                    })
                                }
                            >
                                CONNECT + SIGN
                            </button>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => void run(refresh)}
                            >
                                REFRESH
                            </button>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                    void run(async () => {
                                        const { wallet } =
                                            await connectBscTestnet();
                                        setDemoWallet(wallet);
                                        setNotice(
                                            `MetaMask connected for public testnet proof: ${fmtWallet(wallet)}`,
                                        );
                                    })
                                }
                            >
                                CONNECT DEMO WALLET
                            </button>
                        </div>
                        <p className="cbw3-help">
                            Sign in to CampusBounty first. Connecting MetaMask
                            signs a text challenge; it does not move funds.
                        </p>
                        <h3>VERIFIED ACADEMY BADGES</h3>
                        {Object.entries(BADGES).map(([id, label]) => {
                            const earned = !!profile?.eligible.some(
                                (item) => item.achievementId === id,
                            );
                            const issued = profile?.issued.find(
                                (item) => item.achievementId === id,
                            );
                            return (
                                <div key={id} className="cbw3-badge">
                                    <div>
                                        <strong>{label}</strong>
                                        <small>
                                            {earned
                                                ? "Server-graded capstone earned"
                                                : "Locked — complete and pass the Academy capstone"}
                                        </small>
                                    </div>
                                    <div className="cbw3-actions">
                                        {issued?.txHash && (
                                            <a
                                                href={`https://testnet.bscscan.com/tx/${issued.txHash}`}
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                VIEW TX
                                            </a>
                                        )}
                                        {issued ? (
                                            <button
                                                type="button"
                                                disabled={busy}
                                                onClick={() => void check(id)}
                                            >
                                                VERIFY
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                disabled={
                                                    !chain?.issuerConfigured ||
                                                    !earned ||
                                                    !profile?.wallet ||
                                                    busy
                                                }
                                                onClick={() => void claim(id)}
                                            >
                                                ISSUE PROOF
                                            </button>
                                        )}
                                        {verified[id] && (
                                            <strong className="cbw3-success">
                                                ON-CHAIN VERIFIED ✓
                                            </strong>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        <div className="cbw3-demo">
                            <h3>DEMO-ONLY ON-CHAIN PROOF</h3>
                            <p>
                                A real BSC Testnet transaction can attest the
                                presentation badge{" "}
                                <code>demo-walkthrough-2026</code>. This is NOT
                                an Academy grade or verified quest completion.
                            </p>
                            <button
                                type="button"
                                disabled={
                                    !chain?.contract || !demoWallet || busy
                                }
                                onClick={() =>
                                    void run(async () => {
                                        if (!chain?.contract || !demoWallet)
                                            return;
                                        const exists =
                                            await checkPublicDemoBadge(
                                                chain.contract,
                                                demoWallet,
                                            );
                                        setDemoVerified(exists);
                                        setNotice(
                                            exists
                                                ? "BSC Testnet has the clearly labeled DEMO badge for this wallet."
                                                : "Demo badge not found. Issue it with the authorized issuer CLI first.",
                                        );
                                    })
                                }
                            >
                                CHECK PUBLIC DEMO BADGE
                            </button>
                            {demoVerified !== null && (
                                <p
                                    className={
                                        demoVerified
                                            ? "cbw3-success"
                                            : "cbw3-warning"
                                    }
                                >
                                    {demoVerified
                                        ? "ON-CHAIN: DEMONSTRATION BADGE EXISTS ✓"
                                        : "No demo badge found for this wallet."}
                                </p>
                            )}
                        </div>
                        <div className="cbw3-demo">
                            <h3>₱500 · CAMPUS BOUNTY (SIMULATION)</h3>
                            <p>
                                Future sponsor-funded work preview. No real
                                sponsor, escrow, cash, token, or transferable
                                reward exists.
                            </p>
                            <button
                                type="button"
                                onClick={() =>
                                    setBountyPreview((value) => !value)
                                }
                            >
                                {bountyPreview
                                    ? "HIDE APPROVAL PREVIEW"
                                    : "PREVIEW SIMULATED APPROVAL"}
                            </button>
                            {bountyPreview && (
                                <p className="cbw3-success">
                                    DEMO ONLY: sponsor review → accepted
                                    deliverable → illustrative ₱500 payment.
                                    Nothing was paid.
                                </p>
                            )}
                        </div>
                        {error && (
                            <p role="alert" className="cbw3-error">
                                {error}
                            </p>
                        )}
                        {notice && (
                            <p role="status" className="cbw3-notice">
                                {notice}
                            </p>
                        )}
                    </section>
                </div>
            )}
        </>
    );
}
