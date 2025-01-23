const { ethers } = require("hardhat");

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

  // Transfer tokens to vesting contract
  const totalSupply = await token.totalSupply();
  console.log("Transferring tokens to vesting contract...");
  await token.transfer(vestingAddress, totalSupply);
  console.log("Tokens transferred to vesting contract");

  // Set up vesting schedules
  console.log("\nSetting up vesting schedules...");

  const vestingSchedules = [
    {
      name: "Seed Round",
      amount: ethers.parseEther("70000000"),
      tgePercent: 0n,
      cliff: 3n,
      vesting: 18n
    },
    {
      name: "Team",
      amount: ethers.parseEther("75000000"),
      tgePercent: 0n,
      cliff: 12n,
      vesting: 24n
    },
    {
      name: "Marketing",
      amount: ethers.parseEther("140000000"),
      tgePercent: 225n,
      cliff: 0n,
      vesting: 24n
    },
    {
      name: "Development",
      amount: ethers.parseEther("140000000"),
      tgePercent: 225n,
      cliff: 0n,
      vesting: 36n
    },
    {
      name: "Ecosystem",
      amount: ethers.parseEther("175000000"),
      tgePercent: 225n,
      cliff: 0n,
      vesting: 48n
    },
    {
      name: "Treasury",
      amount: ethers.parseEther("150000000"),
      tgePercent: 0n,
      cliff: 12n,
      vesting: 36n
    },
    {
      name: "Airdrop",
      amount: ethers.parseEther("150000000"),
      tgePercent: 1000n,
      cliff: 0n,
      vesting: 0n
    },
    {
      name: "Liquidity",
      amount: ethers.parseEther("50000000"),
      tgePercent: 1000n,
      cliff: 0n,
      vesting: 0n
    },
    {
      name: "Advisors",
      amount: ethers.parseEther("50000000"),
      tgePercent: 0n,
      cliff: 10n,
      vesting: 12n
    }
  ];

  // You'll need to replace these with actual addresses for production deployment
  const vestingAddresses = {
    "Seed Round": "0x...", // Replace with actual address
    "Team": "0x...",
    "Marketing": "0x...",
    "Development": "0x...",
    "Ecosystem": "0x...",
    "Treasury": "0x...",
    "Airdrop": "0x...",
    "Liquidity": "0x...",
    "Advisors": "0x..."
  };

  for (const schedule of vestingSchedules) {
    const address = vestingAddresses[schedule.name];
    console.log(`\nSetting up ${schedule.name} vesting:`);
    console.log(`- Amount: ${ethers.formatEther(schedule.amount)} NOVAS`);
    console.log(`- TGE: ${Number(schedule.tgePercent) / 10}%`);
    console.log(`- Cliff: ${schedule.cliff} months`);
    console.log(`- Vesting: ${schedule.vesting} months`);
    
    // Comment out the actual creation until addresses are provided
    /*
    await vesting.createVestingSchedule(
      address,
      schedule.amount,
      schedule.tgePercent,
      schedule.cliff,
      schedule.vesting
    );
    console.log(`✓ ${schedule.name} vesting schedule created`);
    */
  }

  console.log("\nDeployment completed!");
  console.log("Token:", tokenAddress);
  console.log("Vesting:", vestingAddress);

  // Verify contracts on Etherscan
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("\nVerifying contracts on Etherscan...");
    await hre.run("verify:verify", {
      address: tokenAddress,
      constructorArguments: []
    });

    await hre.run("verify:verify", {
      address: vestingAddress,
      constructorArguments: [tokenAddress]
    });
    console.log("Contracts verified on Etherscan");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
