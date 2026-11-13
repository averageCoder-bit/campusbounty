require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('node:fs');
const path = require('node:path');

async function main() {
  const recipient = process.env.DEMO_STUDENT_WALLET;
  const address = process.env.BSC_ACHIEVEMENT_CONTRACT;
  const key = process.env.BSC_ISSUER_PRIVATE_KEY || process.env.BSC_DEPLOYER_PRIVATE_KEY;
  if (!ethers.isAddress(recipient || '') || !ethers.isAddress(address || '') || !key) {
    throw new Error('Set DEMO_STUDENT_WALLET, BSC_ACHIEVEMENT_CONTRACT, and an authorized testnet issuer key in blockchain/.env');
  }
  const rpc = new ethers.JsonRpcProvider(process.env.BSC_TESTNET_RPC_URL || 'https://bsc-testnet-dataseed.bnbchain.org', 97);
  const issuer = new ethers.Wallet(key, rpc);
  const artifact = JSON.parse(fs.readFileSync(path.join(__dirname,'../artifacts/contracts/CampusBountyAchievements.sol/CampusBountyAchievements.json'),'utf8'));
  const contract = new ethers.Contract(address, artifact.abi, issuer);
  const achievementId = 'demo-walkthrough-2026'; // Explicitly NOT a graded or verified mastery badge.
  const exists = await contract.verifyAchievement(recipient, achievementId);
  if (exists[0]) {
    console.log('Already issued demo badge to', recipient);
    return;
  }
  const proofHash = ethers.keccak256(ethers.toUtf8Bytes(`CampusBounty TESTNET DEMONSTRATION ONLY|${recipient.toLowerCase()}|${achievementId}`));
  const tx = await contract.issueAchievement(recipient, achievementId, proofHash);
  console.log('DEMO-ONLY transaction:', `https://testnet.bscscan.com/tx/${tx.hash}`);
  const receipt = await tx.wait(1);
  if (!receipt || receipt.status !== 1) throw new Error('Transaction reverted');
  console.log('Confirmed in block:', receipt.blockNumber);
}
main().catch(err => { console.error(err); process.exitCode = 1; });
