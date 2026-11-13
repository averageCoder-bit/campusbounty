require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const [student, achievementId] = process.argv.slice(2);
  const address = process.env.BSC_ACHIEVEMENT_CONTRACT;
  if (!ethers.isAddress(student || '') || !ethers.isAddress(address || '') || !achievementId) {
    throw new Error('Usage: node scripts/verify.cjs <student-wallet> <achievement-id>; set contract in .env');
  }
  const provider = new ethers.JsonRpcProvider(process.env.BSC_TESTNET_RPC_URL || 'https://bsc-testnet-dataseed.bnbchain.org', 97);
  const abi = JSON.parse(fs.readFileSync(path.join(__dirname,'../artifacts/contracts/CampusBountyAchievements.sol/CampusBountyAchievements.json'),'utf8')).abi;
  const contract = new ethers.Contract(address, abi, provider);
  const [exists, proofHash, issuedAt, issuer] = await contract.verifyAchievement(student, achievementId);
  console.log({ exists, proofHash, issuedAt: issuedAt.toString(), issuer });
})().catch(err => { console.error(err); process.exitCode = 1; });
