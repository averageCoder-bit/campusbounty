"""BSC TESTNET verifiable achievements for server-graded CampusBounty Academy badges.

Security boundaries:
- Every state-changing API call requires a verified Supabase JWT (current_user_id).
- Wallet linking requires a short-lived, one-use personal_sign challenge.
- The server checks a genuinely awarded Academy capstone badge in cb_achievements.
- A sole designated issuer wallet signs chain transactions; the client cannot pick
  issuer, achievement proof, outcome, XP, or a different recipient.
- Client-reported adventure runs / demo skips are NEVER eligible here.

Hackathon code: use a TESTNET-ONLY isolated, low-value issuer wallet.
Future production should add external key management, durable queues, risk limits,
monitoring and an audited contract before any broader rollout.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
import os
import secrets
from typing import Any
from uuid import UUID

import asyncpg
from eth_account import Account
from eth_account.messages import encode_defunct
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from web3 import Web3

from .auth import current_user_id

router = APIRouter(prefix="/api/v1/web3", tags=["BSC Testnet Achievements"])
CHAIN_ID = 97
EXPLORER = "https://testnet.bscscan.com"
ELIGIBLE_BADGES = {"computing-apprentice", "ledger-explorer"}

CONTRACT_ABI = [
    {"inputs": [{"internalType":"address","name":"student","type":"address"},
                {"internalType":"string","name":"achievementId","type":"string"},
                {"internalType":"bytes32","name":"proofHash","type":"bytes32"}],
     "name":"issueAchievement","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs": [{"internalType":"address","name":"student","type":"address"},
                {"internalType":"string","name":"achievementId","type":"string"}],
     "name":"verifyAchievement",
     "outputs": [{"internalType":"bool","name":"exists","type":"bool"},
                 {"internalType":"bytes32","name":"proofHash","type":"bytes32"},
                 {"internalType":"uint64","name":"issuedAt","type":"uint64"},
                 {"internalType":"address","name":"issuer","type":"address"}],
     "stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"address","name":"account","type":"address"}],
     "name":"isIssuer","outputs":[{"internalType":"bool","name":"","type":"bool"}],
     "stateMutability":"view","type":"function"}
]

class ChallengeIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    wallet: str = Field(min_length=42, max_length=42)

class WalletLinkIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    challengeId: UUID
    signature: str = Field(min_length=130, max_length=132)


def checksum_address(value: str) -> str:
    if not Web3.is_address(value):
        raise HTTPException(422, "Invalid EVM wallet address")
    return Web3.to_checksum_address(value)


def setup() -> tuple[Web3, Any, Any]:
    address = os.getenv("BSC_ACHIEVEMENT_CONTRACT", "").strip()
    key = os.getenv("BSC_ISSUER_PRIVATE_KEY", "").strip()
    if not key or not Web3.is_address(address):
        raise HTTPException(503, "BSC issuance is not configured")
    try:
        web3 = Web3(Web3.HTTPProvider(
            os.getenv("BSC_TESTNET_RPC_URL", "https://bsc-testnet-dataseed.bnbchain.org"),
            request_kwargs={"timeout": 12},
        ))
        signer = Account.from_key(key)
        contract = web3.eth.contract(address=Web3.to_checksum_address(address), abi=CONTRACT_ABI)
    except (ValueError, TypeError):
        raise HTTPException(503, "BSC issuer configuration is invalid") from None
    return web3, signer, contract


def submit_claim(wallet: str, achievement_id: str, awarded_at: datetime) -> tuple[str, str]:
    """Run in worker thread. Must be called under pg_advisory_xact_lock for nonce serialization."""
    web3, signer, contract = setup()
    if web3.eth.chain_id != CHAIN_ID:
        raise HTTPException(503, "BSC RPC is not connected to chain 97")
    if not contract.functions.isIssuer(signer.address).call():
        raise HTTPException(503, "Configured issuer is not authorized by the contract")
    if contract.functions.verifyAchievement(wallet, achievement_id).call()[0]:
        raise HTTPException(409, "Achievement already exists on chain for this wallet")
    # Deterministic evidence commitment derived ONLY from the server's verified badge.
    digest = Web3.keccak(text=(f"campusbounty:academy:v1:{achievement_id}:"
                                f"{wallet.lower()}:{awarded_at.isoformat()}"))
    pending_nonce = web3.eth.get_transaction_count(signer.address, "pending")
    fn = contract.functions.issueAchievement(wallet, achievement_id, digest)
    gas_estimate = fn.estimate_gas({"from": signer.address})
    tx = fn.build_transaction({
        "from": signer.address,
        "nonce": pending_nonce,
        "chainId": CHAIN_ID,
        "gas": min(int(gas_estimate * 1.3) + 10000, 400000),
        "gasPrice": web3.eth.gas_price,
    })
    signed = signer.sign_transaction(tx)
    txid = web3.eth.send_raw_transaction(signed.raw_transaction)
    return Web3.to_hex(txid), Web3.to_hex(digest)


def onchain_verified(wallet: str, badge: str) -> tuple[bool, str | None]:
    web3, _signer, contract = setup()
    if web3.eth.chain_id != CHAIN_ID:
        raise HTTPException(503, "Wrong BSC chain")
    if not web3.eth.get_code(contract.address):
        raise HTTPException(503, "Achievement contract not deployed at configured address")
    result = contract.functions.verifyAchievement(wallet, badge).call()
    return bool(result[0]), Web3.to_hex(result[1]) if result[0] else None


def validate_badge(badge: str) -> None:
    if badge not in ELIGIBLE_BADGES:
        raise HTTPException(404, "Only server-graded Academy capstone achievements are issuable")


@router.get("/status")
async def status() -> dict[str, Any]:
    address = os.getenv("BSC_ACHIEVEMENT_CONTRACT", "")
    return {"chainId": CHAIN_ID, "network": "BSC Testnet", "contract":
            address if Web3.is_address(address) else None, "explorer": EXPLORER,
            "issuerConfigured": bool(os.getenv("BSC_ISSUER_PRIVATE_KEY"))}


@router.post("/challenge")
async def challenge(body: ChallengeIn, request: Request,
                    uid: UUID = Depends(current_user_id)) -> dict[str, Any]:
    wallet = checksum_address(body.wallet)
    now = datetime.now(timezone.utc)
    token = secrets.token_urlsafe(24)
    message = ("CampusBounty wallet verification (BSC Testnet)\n"
               f"Account ID: {uid}\nWallet: {wallet}\nNonce: {token}\n"
               f"Issued at: {now.isoformat()}\n"
               "Purpose: link this wallet to your signed-in CampusBounty account.\n"
               "Signing this text is NOT a transaction and does not transfer assets.")
    async with request.app.state.db.acquire() as conn:
        # Prevent unlimited unused challenges per account.
        await conn.execute("DELETE FROM public.cb_wallet_challenges WHERE user_id=$1", uid)
        row = await conn.fetchrow(
            "INSERT INTO public.cb_wallet_challenges(user_id,wallet_address,message,expires_at) "
            "VALUES($1,$2,$3,$4) RETURNING id,expires_at",
            uid, wallet.lower(), message, now + timedelta(minutes=5),
        )
    return {"challengeId": str(row["id"]), "message": message,
            "expiresAt": row["expires_at"].isoformat()}


@router.post("/link")
async def link_wallet(body: WalletLinkIn, request: Request,
                      uid: UUID = Depends(current_user_id)) -> dict[str, Any]:
    async with request.app.state.db.acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow(
                "SELECT wallet_address,message,expires_at,used_at "
                "FROM public.cb_wallet_challenges WHERE id=$1 AND user_id=$2 FOR UPDATE",
                body.challengeId, uid,
            )
            if not row or row["used_at"] is not None or row["expires_at"] < datetime.now(timezone.utc):
                raise HTTPException(410, "Wallet challenge expired; request a new one")
            try:
                signed_address = Account.recover_message(
                    encode_defunct(text=row["message"]), signature=body.signature)
            except Exception:
                raise HTTPException(401, "Invalid wallet signature") from None
            if signed_address.lower() != row["wallet_address"]:
                raise HTTPException(401, "Signature did not match requested wallet")
            # Don't reassign wallets once on-chain issuances exist: proof must stay bound to wallet.
            already = await conn.fetchval(
                "SELECT wallet_address FROM public.cb_wallet_connections WHERE user_id=$1", uid)
            if already and already != row["wallet_address"]:
                claim_count = await conn.fetchval(
                    "SELECT count(*) FROM public.cb_web3_issuances WHERE user_id=$1", uid)
                if claim_count:
                    raise HTTPException(409, "Wallet is locked after issuance. Contact an administrator.")
            try:
                await conn.execute(
                    "INSERT INTO public.cb_wallet_connections(user_id,wallet_address) VALUES($1,$2) "
                    "ON CONFLICT(user_id) DO UPDATE SET wallet_address=excluded.wallet_address, linked_at=now()",
                    uid, row["wallet_address"],
                )
            except asyncpg.UniqueViolationError:
                raise HTTPException(409, "Wallet already linked to another account") from None
            await conn.execute("UPDATE public.cb_wallet_challenges SET used_at=now() WHERE id=$1", body.challengeId)
    return {"linked": True, "wallet": Web3.to_checksum_address(row["wallet_address"])}


@router.get("/me")
async def my_web3(request: Request,
                  uid: UUID = Depends(current_user_id)) -> dict[str, Any]:
    async with request.app.state.db.acquire() as conn:
        wallet = await conn.fetchval(
            "SELECT wallet_address FROM public.cb_wallet_connections WHERE user_id=$1", uid)
        awarded = await conn.fetch(
            "SELECT achievement_id,awarded_at FROM public.cb_achievements "
            "WHERE user_id=$1 AND achievement_id=ANY($2::text[]) ORDER BY achievement_id", uid,
            list(ELIGIBLE_BADGES),
        )
        issued = await conn.fetch(
            "SELECT achievement_id,wallet_address,tx_hash,status,proof_hash "
            "FROM public.cb_web3_issuances WHERE user_id=$1", uid,
        )
    return {"wallet": Web3.to_checksum_address(wallet) if wallet else None,
            "eligible": [{"achievementId": r["achievement_id"], "awardedAt": r["awarded_at"].isoformat()} for r in awarded],
            "issued": [{"achievementId": r["achievement_id"], "wallet": r["wallet_address"],
                        "txHash": r["tx_hash"], "status": r["status"], "proofHash": r["proof_hash"]}
                       for r in issued], "chainId": CHAIN_ID}


@router.post("/achievements/{achievement_id}/issue", status_code=202)
async def issue(achievement_id: str, request: Request,
                uid: UUID = Depends(current_user_id)) -> dict[str, Any]:
    validate_badge(achievement_id)
    async with request.app.state.db.acquire() as conn:
        # Cross-instance advisory lock serializes issuer nonce across all serverless instances.
        async with conn.transaction():
            await conn.execute("SELECT pg_advisory_xact_lock(721236512)")
            wallet = await conn.fetchval(
                "SELECT wallet_address FROM public.cb_wallet_connections WHERE user_id=$1", uid)
            if not wallet:
                raise HTTPException(409, "Connect and sign your MetaMask wallet first")
            badge = await conn.fetchrow(
                "SELECT awarded_at FROM public.cb_achievements WHERE user_id=$1 AND achievement_id=$2",
                uid, achievement_id,
            )
            if not badge:
                raise HTTPException(403, "You have not earned this server-graded capstone badge")
            previous = await conn.fetchrow(
                "SELECT tx_hash,status FROM public.cb_web3_issuances "
                "WHERE user_id=$1 AND achievement_id=$2", uid, achievement_id,
            )
            if previous:
                return {"status": previous["status"], "txHash": previous["tx_hash"],
                        "explorer": f"{EXPLORER}/tx/{previous['tx_hash']}" if previous["tx_hash"] else None}
            try:
                tx_hash, proof_hash = await asyncio.to_thread(
                    submit_claim, Web3.to_checksum_address(wallet), achievement_id, badge["awarded_at"])
            except HTTPException:
                raise
            except Exception:
                # Avoid revealing RPC errors or private key material to API clients.
                raise HTTPException(503, "BSC issuance temporarily failed; check issuer balance, RPC and contract") from None
            await conn.execute(
                "INSERT INTO public.cb_web3_issuances "
                "(user_id,achievement_id,wallet_address,proof_hash,tx_hash,status) "
                "VALUES($1,$2,$3,$4,$5,'submitted')",
                uid, achievement_id, wallet, proof_hash, tx_hash,
            )
    return {"status": "submitted", "txHash": tx_hash, "explorer": f"{EXPLORER}/tx/{tx_hash}"}


@router.get("/achievements/{achievement_id}/verify")
async def verify(achievement_id: str, request: Request,
                 uid: UUID = Depends(current_user_id)) -> dict[str, Any]:
    validate_badge(achievement_id)
    async with request.app.state.db.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT wallet_address,tx_hash,status,proof_hash FROM public.cb_web3_issuances "
            "WHERE user_id=$1 AND achievement_id=$2", uid, achievement_id,
        )
        if not row:
            return {"verified": False, "status": "not-issued", "txHash": None}
        try:
            verified, chain_proof = await asyncio.to_thread(
                onchain_verified, Web3.to_checksum_address(row["wallet_address"]), achievement_id)
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(503, "Cannot reach BSC Testnet RPC") from None
        verified = verified and chain_proof == row["proof_hash"]
        if verified and row["status"] != "confirmed":
            await conn.execute(
                "UPDATE public.cb_web3_issuances SET status='confirmed',confirmed_at=now() "
                "WHERE user_id=$1 AND achievement_id=$2", uid, achievement_id)
        return {"verified": verified, "status": "confirmed" if verified else row["status"],
                "txHash": row["tx_hash"],
                "explorer": f"{EXPLORER}/tx/{row['tx_hash']}" if row["tx_hash"] else None}
