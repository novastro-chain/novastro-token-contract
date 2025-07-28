const { ethers, network } = require("hardhat");
const hre = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Deploy NovastroToken
  const NovastroToken = await ethers.getContractFactory("NovastroToken");
  const token = await NovastroToken.deploy();
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("NovastroToken deployed to:", tokenAddress);

  // Deploy TokenVesting
  const TokenVesting = await ethers.getContractFactory("TokenVesting");
  const vesting = await TokenVesting.deploy(tokenAddress);
  await vesting.waitForDeployment();
  const vestingAddress = await vesting.getAddress();
  console.log("TokenVesting deployed to:", vestingAddress);



 

  console.log("\nDeployment completed!");
  console.log("Token:", tokenAddress);
  console.log("Vesting:", vestingAddress);

 
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
