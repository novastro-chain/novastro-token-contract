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

  // Example usage:
  // Single vesting schedule
  async function addSingleVesting() {
    const beneficiary = "BENEFICIARY_ADDRESS";
    const amount = ethers.parseEther("1000000"); // 1M tokens
    const tgePercent = 225n; // 22.5%
    const cliffMonths = 3n;
    const vestingMonths = 12n;
    
    await addVestingSchedule(
      beneficiary,
      amount,
      tgePercent,
      cliffMonths,
      vestingMonths,
      "Example Allocation"
    );
  }

  // Batch add multiple vesting schedules
  async function addBatchVesting() {
    const vestingSchedules = [
      {
        name: "Private Sale 1",
        beneficiary: "ADDRESS_1",
        amount: ethers.parseEther("500000"),
        tgePercent: 100n, // 10%
        cliffMonths: 1n,
        vestingMonths: 12n
      },
      {
        name: "Private Sale 2",
        beneficiary: "ADDRESS_2",
        amount: ethers.parseEther("750000"),
        tgePercent: 150n, // 15%
        cliffMonths: 2n,
        vestingMonths: 18n
      }
      // Add more schedules as needed
    ];

    for (const schedule of vestingSchedules) {
      await addVestingSchedule(
        schedule.beneficiary,
        schedule.amount,
        schedule.tgePercent,
        schedule.cliffMonths,
        schedule.vestingMonths,
        schedule.name
      );
    }
  }

  // Uncomment and modify the function you want to use
  // await addSingleVesting();
  // await addBatchVesting();
}

// Execute the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
