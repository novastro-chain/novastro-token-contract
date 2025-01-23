const hre = require("hardhat");

// Wormhole Core Contract Addresses
const WORMHOLE_CORE_ADDRESSES = {
  ethereum: "0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B",
  bsc: "0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B",
  avalanche: "0x54a8e5f9c4CbA08F9943965859F6c34eAF03E26c",
  polygon: "0x7A4B5a56256163F07b2C80A7cA55aBE66c4ec4d7",
  optimism: "0xEe91C335eab126dF5fDB3797EA9d6aD93aeC9722",
  arbitrum: "0xa5f208e072434bC67592E4C49C1B991BA79BCA46",
  base: "0xbf3922a0ceEF19C667343B7190573B32bF33c0A8",
};

// Chain IDs as defined by Wormhole
const CHAIN_IDS = {
  ethereum: 2,
  bsc: 4,
  avalanche: 6,
  polygon: 5,
  optimism: 24,
  arbitrum: 23,
  base: 30,
};

async function main() {
  const network = hre.network.name;
  console.log(`Deploying to ${network}...`);

  // Get Wormhole Core address for the current network
  const wormholeCore = WORMHOLE_CORE_ADDRESSES[network];
  if (!wormholeCore) {
    throw new Error(`No Wormhole Core address found for network: ${network}`);
  }

  // Get Chain ID for the current network
  const chainId = CHAIN_IDS[network];
  if (!chainId) {
    throw new Error(`No Chain ID found for network: ${network}`);
  }

  // Deploy NovastroToken
  const NovastroToken = await hre.ethers.getContractFactory("NovastroToken");
  const token = await NovastroToken.deploy(wormholeCore, chainId);
  await token.waitForDeployment();

  console.log(`NovastroToken deployed to: ${await token.getAddress()}`);
  console.log(`Wormhole Core: ${wormholeCore}`);
  console.log(`Chain ID: ${chainId}`);

  // Deploy TokenVesting
  const TokenVesting = await hre.ethers.getContractFactory("TokenVesting");
  const vesting = await TokenVesting.deploy(await token.getAddress());
  await vesting.waitForDeployment();

  console.log(`TokenVesting deployed to: ${await vesting.getAddress()}`);

  // Verify contracts on Etherscan
  if (network !== "hardhat" && network !== "localhost") {
    console.log("Waiting for block confirmations...");
    await token.deployTransaction.wait(6);
    await vesting.deployTransaction.wait(6);

    console.log("Verifying contracts...");
    await hre.run("verify:verify", {
      address: await token.getAddress(),
      constructorArguments: [wormholeCore, chainId],
    });

    await hre.run("verify:verify", {
      address: await vesting.getAddress(),
      constructorArguments: [await token.getAddress()],
    });
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
