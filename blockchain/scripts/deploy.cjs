const hre = require('hardhat');

async function main() {
  if (hre.network.config.chainId !== 97) throw new Error('Deploy on BSC TESTNET only (chain ID 97)');
  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) throw new Error('Set BSC_DEPLOYER_PRIVATE_KEY in blockchain/.env');
  const issuerKey = process.env.BSC_ISSUER_PRIVATE_KEY;
  const issuerAddress = issuerKey
    ? new hre.ethers.Wallet(issuerKey).address : deployer.address;
  const factory = await hre.ethers.getContractFactory('CampusBountyAchievements');
  const contract = await factory.deploy(issuerAddress);
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log('Chain ID: 97 (BSC Testnet)');
  console.log('Contract:', address);
  console.log('Issuer:', issuerAddress);
  console.log(`Explorer: https://testnet.bscscan.com/address/${address}`);
  console.log(`Add to backend production: BSC_ACHIEVEMENT_CONTRACT=${address}`);
}
main().catch(err => { console.error(err); process.exitCode = 1; });
