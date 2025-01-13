const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Adding vesting schedule with account:", deployer.address);

  // Replace with your deployed vesting contract address
  const VESTING_ADDRESS = "YOUR_VESTING_ADDRESS";
  const vesting = await ethers.getContractAt("TokenVesting", VESTING_ADDRESS);

  // Helper function to add a vesting schedule
  async function addVestingSchedule(beneficiary, amount, tgePercent, cliffMonths, vestingMonths, name = "") {
    console.log(`\nAdding vesting schedule for ${name || beneficiary}:`);
    console.log("- Beneficiary:", beneficiary);
    console.log("- Amount:", ethers.formatEther(amount), "NOVAS");
    console.log("- TGE Percentage:", Number(tgePercent) / 10, "%");
    console.log("- Cliff Period:", cliffMonths, "months");
    console.log("- Vesting Period:", vestingMonths, "months");

    try {
      const tx = await vesting.createVestingSchedule(
        beneficiary,
        amount,
        tgePercent,
        cliffMonths,
        vestingMonths
      );
      await tx.wait();
      console.log("✓ Vesting schedule created successfully");

      // Get and display the schedule details
      const schedule = await vesting.vestingSchedules(beneficiary);
      console.log("\nSchedule confirmed:");
      console.log("- Total Amount:", ethers.formatEther(schedule.totalAmount), "NOVAS");
      console.log("- TGE Amount:", ethers.formatEther(schedule.tgeAmount), "NOVAS");
      console.log("- Start Time:", new Date(Number(schedule.startTime) * 1000).toLocaleString());
    } catch (error) {
      console.error("Error creating vesting schedule:", error.message);
    }
  }

  // Token metrics
  const NOVASTRO_METRICS = {
    SEED: {
      name: "Seed Round",
      amount: ethers.parseEther("70000000"), // 70M tokens
      tgePercent: 0n,
      cliffMonths: 3n,
      vestingMonths: 18n
    },
    TEAM: {
      name: "Team",
      amount: ethers.parseEther("75000000"), // 75M tokens
      tgePercent: 0n,
      cliffMonths: 12n,
      vestingMonths: 24n
    },
    MARKETING: {
      name: "Marketing",
      amount: ethers.parseEther("140000000"), // 140M tokens
      tgePercent: 225n, // 22.5%
      cliffMonths: 0n,
      vestingMonths: 24n
    },
    DEV: {
      name: "Development",
      amount: ethers.parseEther("140000000"), // 140M tokens
      tgePercent: 225n, // 22.5%
      cliffMonths: 0n,
      vestingMonths: 36n
    },
    ECOSYSTEM: {
      name: "Ecosystem Rewards & Staking",
      amount: ethers.parseEther("175000000"), // 175M tokens
      tgePercent: 225n, // 22.5%
      cliffMonths: 0n,
      vestingMonths: 48n
    },
    TREASURY: {
      name: "Treasury",
      amount: ethers.parseEther("150000000"), // 150M tokens
      tgePercent: 0n,
      cliffMonths: 12n,
      vestingMonths: 36n
    },
    AIRDROP: {
      name: "Airdrop",
      amount: ethers.parseEther("150000000"), // 150M tokens
      tgePercent: 1000n, // 100%
      cliffMonths: 0n,
      vestingMonths: 0n
    },
    LIQUIDITY: {
      name: "Liquidity",
      amount: ethers.parseEther("50000000"), // 50M tokens
      tgePercent: 1000n, // 100%
      cliffMonths: 0n,
      vestingMonths: 0n
    },
    ADVISORS: {
      name: "Advisors",
      amount: ethers.parseEther("50000000"), // 50M tokens
      tgePercent: 0n,
      cliffMonths: 10n,
      vestingMonths: 12n
    }
  };

  // Add single vesting schedule from metrics
  async function addMetricVesting(metricKey, beneficiary) {
    const metric = NOVASTRO_METRICS[metricKey];
    if (!metric) {
      console.error(`Invalid metric key: ${metricKey}`);
      return;
    }

    await addVestingSchedule(
      beneficiary,
      metric.amount,
      metric.tgePercent,
      metric.cliffMonths,
      metric.vestingMonths,
      metric.name
    );
  }

  // Add multiple vesting schedules from metrics
  async function addBatchMetricVesting(vestingSchedules) {
    for (const schedule of vestingSchedules) {
      const metric = NOVASTRO_METRICS[schedule.metricKey];
      if (!metric) {
        console.error(`Invalid metric key: ${schedule.metricKey}`);
        continue;
      }

      await addVestingSchedule(
        schedule.beneficiary,
        metric.amount,
        metric.tgePercent,
        metric.cliffMonths,
        metric.vestingMonths,
        metric.name
      );
    }
  }

  // Example usage:
  
  // 1. Add single vesting schedule
  // await addMetricVesting("SEED", "BENEFICIARY_ADDRESS");

  // 2. Add multiple vesting schedules
  // const schedules = [
  //   {
  //     metricKey: "TEAM",
  //     beneficiary: "TEAM_ADDRESS"
  //   },
  //   {
  //     metricKey: "ADVISORS",
  //     beneficiary: "ADVISORS_ADDRESS"
  //   }
  // ];
  // await addBatchMetricVesting(schedules);

  // 3. Add all vesting schedules
  // const allSchedules = [
  //   { metricKey: "SEED", beneficiary: "SEED_ADDRESS" },
  //   { metricKey: "TEAM", beneficiary: "TEAM_ADDRESS" },
  //   { metricKey: "MARKETING", beneficiary: "MARKETING_ADDRESS" },
  //   { metricKey: "DEV", beneficiary: "DEV_ADDRESS" },
  //   { metricKey: "ECOSYSTEM", beneficiary: "ECOSYSTEM_ADDRESS" },
  //   { metricKey: "TREASURY", beneficiary: "TREASURY_ADDRESS" },
  //   { metricKey: "AIRDROP", beneficiary: "AIRDROP_ADDRESS" },
  //   { metricKey: "LIQUIDITY", beneficiary: "LIQUIDITY_ADDRESS" },
  //   { metricKey: "ADVISORS", beneficiary: "ADVISORS_ADDRESS" }
  // ];
  // await addBatchMetricVesting(allSchedules);
}

// Execute the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
