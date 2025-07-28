require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();
const PRIVATE_KEY = process.env.PRIVATE_KEY || '0000000000000000000000000000000000000000000000000000000000000000';

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {
      chainId: 1337
    },
    ethereum: {
      url: `https://eth.llamarpc.com`,
      accounts: [PRIVATE_KEY],
      chainId: 1,
      timeout: 300000, // 5 minutes (in milliseconds)
      gasMultiplier: 2.0,
      // Add higher gas limit for complex transactions
      //gas: 8000000,
    },
  }
};
