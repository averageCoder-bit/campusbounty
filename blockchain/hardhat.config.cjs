require('@nomicfoundation/hardhat-ethers');
require('@nomicfoundation/hardhat-verify');
require('dotenv').config();
const rpc = process.env.BSC_TESTNET_RPC_URL || 'https://bsc-testnet-dataseed.bnbchain.org';
const pk = (process.env.BSC_DEPLOYER_PRIVATE_KEY || '').trim();
module.exports = {
  solidity: { version: '0.8.24', settings: { optimizer: { enabled: true, runs: 200 } } },
  etherscan: { apiKey: process.env.ETHERSCAN_API_KEY || '' },
  networks: {
    hardhat: { chainId: 31337 },
    bscTestnet: { url: rpc, chainId: 97, accounts: pk ? [pk] : [] }
  }
};
