const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  
  // Replace these with your deployed contract addresses
  const TOKEN_ADDRESS = "YOUR_TOKEN_ADDRESS";
  const VESTING_ADDRESS = "YOUR_VESTING_ADDRESS";

  // Get contract instances
  const token = await ethers.getContractAt("NovastroToken", TOKEN_ADDRESS);
  const vesting = await ethers.getContractAt("TokenVesting", VESTING_ADDRESS);

  // Helper function to format amounts
  const formatAmount = (amount) => ethers.formatEther(amount) + " NOVAS";

  // Check vesting schedule for an address
  async function checkVestingSchedule(address) {
    const schedule = await vesting.vestingSchedules(address);
    const vested = await vesting.getVestedAmount(address);
    const released = await vesting.released(address);
    const balance = await token.balanceOf(address);

    console.log("\nVesting Schedule for", address);
    console.log("Total Amount:", formatAmount(schedule.totalAmount));
    console.log("TGE Amount:", formatAmount(schedule.tgeAmount));
    console.log("Cliff Duration:", schedule.cliffDuration.toString(), "seconds");
    console.log("Vesting Duration:", schedule.vestingDuration.toString(), "seconds");
    console.log("Start Time:", new Date(Number(schedule.startTime) * 1000).toLocaleString());
    console.log("\nCurrent Status:");
    console.log("Vested Amount:", formatAmount(vested));
    console.log("Released Amount:", formatAmount(released));
    console.log("Current Balance:", formatAmount(balance));
    console.log("Releasable Amount:", formatAmount(vested - released));
  }

  // Release tokens for an address
  async function releaseTokens(address) {
    console.log("\nReleasing tokens for", address);
    const vested = await vesting.getVestedAmount(address);
    const released = await vesting.released(address);
    const releasable = vested - released;

    if (releasable > 0) {
      console.log("Releasable amount:", formatAmount(releasable));
      const tx = await vesting.release(address);
      await tx.wait();
      console.log("✓ Tokens released successfully");
    } else {
      console.log("No tokens available for release");
    }
  }

  // Example usage:
  // const addressToCheck = "BENEFICIARY_ADDRESS";
  // await checkVestingSchedule(addressToCheck);
  // await releaseTokens(addressToCheck);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
