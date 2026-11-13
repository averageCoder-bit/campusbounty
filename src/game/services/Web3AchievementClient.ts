/** BSC Testnet + Supabase-authenticated achievement API client.
 * Never use a private key, service-role key, or JWT secret in browser code.
 */
import { BrowserProvider, Contract, type Eip1193Provider } from "ethers";
import { supabase } from "./ProgressionClient";

const API = (import.meta.env.VITE_PROGRESSION_API_URL as string | undefined)?.replace(/\/$/, "");
const HEX_CHAIN_ID = "0x61";

interface WalletBridge {
    request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

function injectedWallet(): WalletBridge {
    const bridge = (window as Window & { ethereum?: WalletBridge }).ethereum;
    if (!bridge) throw new Error("MetaMask not detected. Install/enable MetaMask and reopen this page.");
    return bridge;
}

export async function connectBscTestnet(): Promise<{ wallet: string; provider: BrowserProvider }> {
    const bridge = injectedWallet();
    await bridge.request({ method: "eth_requestAccounts" });
    const chain = await bridge.request({ method: "eth_chainId" });
    if (chain !== HEX_CHAIN_ID) {
        try {
            await bridge.request({ method: "wallet_switchEthereumChain", params: [{ chainId: HEX_CHAIN_ID }] });
        } catch (error) {
            const code = (error as { code?: number }).code;
            if (code !== 4902) throw error;
            await bridge.request({
                method: "wallet_addEthereumChain",
                params: [{
                    chainId: HEX_CHAIN_ID,
                    chainName: "BNB Smart Chain Testnet",
                    nativeCurrency: { name: "Test BNB", symbol: "tBNB", decimals: 18 },
                    rpcUrls: ["https://bsc-testnet-dataseed.bnbchain.org"],
                    blockExplorerUrls: ["https://testnet.bscscan.com"],
                }],
            });
        }
    }
    const provider = new BrowserProvider(bridge as unknown as Eip1193Provider);
    if ((await provider.getNetwork()).chainId !== 97n) throw new Error("Please switch MetaMask to BSC Testnet (chain 97).");
    const wallet = await (await provider.getSigner()).getAddress();
    return { wallet, provider };
}

async function authCall<T>(route: string, method: "GET" | "POST" = "GET", body?: object): Promise<T> {
    if (!supabase || !API) throw new Error("Configure Supabase sign-in and VITE_PROGRESSION_API_URL first.");
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) throw new Error("Sign in to CampusBounty using Supabase before linking a wallet.");
    const response = await fetch(`${API}${route}`, {
        method,
        headers: { Authorization: `Bearer ${data.session.access_token}`, "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) {
        const payload: { detail?: unknown } = await response.json().catch(() => ({}));
        throw new Error(typeof payload.detail === "string" ? payload.detail : `Web3 API returned HTTP ${response.status}`);
    }
    return response.json() as Promise<T>;
}

interface Challenge { challengeId: string; message: string; expiresAt: string }
export interface Issuance { achievementId: string; wallet: string; txHash: string | null; status: string; proofHash: string }
export interface WalletSnapshot {
    wallet: string | null;
    eligible: Array<{ achievementId: string; awardedAt: string }>;
    issued: Issuance[];
    chainId: number;
}
export interface ChainStatus {
    chainId: number;
    network: string;
    contract: string | null;
    explorer: string;
    issuerConfigured: boolean;
}
export interface IssuanceResult {
    status: string;
    txHash: string | null;
    explorer: string | null;
}
export interface VerificationResult extends IssuanceResult { verified: boolean }

export async function getChainStatus(): Promise<ChainStatus> {
    if (!API) throw new Error("Set VITE_PROGRESSION_API_URL for the deployed API.");
    const response = await fetch(`${API}/api/v1/web3/status`);
    if (!response.ok) throw new Error("BSC achievement API unavailable");
    return response.json() as Promise<ChainStatus>;
}

export async function linkMyWallet(): Promise<string> {
    const { wallet, provider } = await connectBscTestnet();
    const challenge = await authCall<Challenge>("/api/v1/web3/challenge", "POST", { wallet });
    const signature = await (await provider.getSigner()).signMessage(challenge.message);
    const linked = await authCall<{ linked: boolean; wallet: string }>(
        "/api/v1/web3/link", "POST", { challengeId: challenge.challengeId, signature },
    );
    return linked.wallet;
}

export const getMyWeb3 = (): Promise<WalletSnapshot> => authCall("/api/v1/web3/me");
export const issueMyBadge = (id: string): Promise<IssuanceResult> =>
    authCall(`/api/v1/web3/achievements/${encodeURIComponent(id)}/issue`, "POST");
export const verifyMyBadge = (id: string): Promise<VerificationResult> =>
    authCall(`/api/v1/web3/achievements/${encodeURIComponent(id)}/verify`);

/** Publicly verify a clearly labeled demo attestation; does not require sign-in. */
export async function checkPublicDemoBadge(contractAddress: string, wallet: string): Promise<boolean> {
    const rpc = new BrowserProvider(injectedWallet() as unknown as Eip1193Provider);
    if ((await rpc.getNetwork()).chainId !== 97n) throw new Error("Switch MetaMask to BSC Testnet first.");
    const contract = new Contract(contractAddress, [
        "function verifyAchievement(address student,string achievementId) view returns (bool exists,bytes32 proofHash,uint64 issuedAt,address issuer)",
    ], rpc);
    const result: readonly unknown[] = await contract.verifyAchievement(wallet, "demo-walkthrough-2026");
    return result[0] === true;
}
