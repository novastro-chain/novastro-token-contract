const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Novastro Token and Vesting", function () {
    let token, vesting;
    let owner, seed, team, marketing, dev, ecosystem, treasury, liquidity, airdrop, advisors;
    let startTime;
    const MONTH = 30 * 24 * 60 * 60; // 30 days in seconds

    // Token amounts for different allocations
    const ALLOCATIONS = {
        SEED: {
            total: "70000000",      // 7%
            tgePercent: 0n          // 0% TGE
        },
        TEAM: {
            total: "75000000",      // 7.5%
            tgePercent: 0n          // 0% TGE
        },
        MARKETING: {
            total: "140000000",     // 14%
            tgePercent: 225n        // 22.5% TGE
        },
        DEV: {
            total: "140000000",     // 14%
            tgePercent: 225n        // 22.5% TGE
        },
        ECOSYSTEM: {
            total: "175000000",     // 17.5%
            tgePercent: 225n        // 22.5% TGE
        },
        TREASURY: {
            total: "150000000",     // 15%
            tgePercent: 0n          // 0% TGE
        },
        AIRDROP: {
            total: "150000000",     // 15%
            tgePercent: 1000n       // 100% TGE
        },
        LIQUIDITY: {
            total: "50000000",      // 5%
            tgePercent: 1000n       // 100% TGE
        },
        ADVISORS: {
            total: "50000000",      // 5%
            tgePercent: 0n          // 0% TGE
        }
    };

    // Calculate TGE and vesting amounts
    const calculateAmounts = () => {
        let totalVesting = 0n;
        let totalTGE = 0n;

        for (const allocation of Object.values(ALLOCATIONS)) {
            const total = BigInt(ethers.parseEther(allocation.total));
            const tgeAmount = (total * allocation.tgePercent) / 1000n;
            totalTGE += tgeAmount;
            totalVesting += (total - tgeAmount);
        }

        return { totalVesting, totalTGE };
    };

    const { totalVesting, totalTGE } = calculateAmounts();

    beforeEach(async function () {
        // Reset timestamp to a fixed value
        const latestBlock = await ethers.provider.getBlock('latest');
        startTime = latestBlock.timestamp;

        [owner, seed, team, marketing, dev, ecosystem, treasury, liquidity, airdrop, advisors] = await ethers.getSigners();

        // Deploy Token
        const NovastroTokenFactory = await ethers.getContractFactory("NovastroToken", owner);
        token = await NovastroTokenFactory.deploy();

        // Deploy Vesting
        const TokenVestingFactory = await ethers.getContractFactory("TokenVesting", owner);
        vesting = await TokenVestingFactory.deploy(await token.getAddress());

        // Create vesting schedules and transfer tokens
        for (const [key, allocation] of Object.entries(ALLOCATIONS)) {
            const total = BigInt(ethers.parseEther(allocation.total));
            const recipient = eval(key.toLowerCase());

            // For 100% TGE, just transfer directly
            if (allocation.tgePercent === 1000n) {
                await token.connect(owner).transfer(recipient.address, total);
                continue;
            }

            // Transfer tokens to vesting contract first
            await token.connect(owner).approve(await vesting.getAddress(), total);
            await token.connect(owner).transfer(await vesting.getAddress(), total);

            // Then create vesting schedule
            await vesting.createVestingSchedule(
                recipient.address,
                total,
                allocation.tgePercent,
                key === "TEAM" ? 12n : key === "ADVISORS" ? 10n : key === "SEED" ? 3n : 0n, // Cliff periods
                key === "ECOSYSTEM" ? 48n :                            // Vesting periods
                key === "DEV" ? 36n :
                key === "TREASURY" ? 36n :
                key === "TEAM" ? 24n :
                key === "ADVISORS" ? 12n :
                key === "SEED" ? 18n :
                key === "MARKETING" ? 24n : 0n                        // 0 for AIRDROP and LIQUIDITY
            );
        }
    });

    describe("Token Distribution", function () {
        it("Should have correct initial supply", async function () {
            const totalSupply = await token.totalSupply();
            expect(totalSupply).to.equal(ethers.parseEther("1000000000"));
        });

        it("Should distribute TGE tokens correctly", async function () {
            // Check each allocation's TGE amount
            for (const [key, allocation] of Object.entries(ALLOCATIONS)) {
                const total = BigInt(ethers.parseEther(allocation.total));
                const tgeAmount = (total * allocation.tgePercent) / 1000n;
                if (tgeAmount > 0n) {
                    const recipient = eval(key.toLowerCase());
                    const balance = await token.balanceOf(recipient.address);
                    expect(balance).to.equal(tgeAmount);
                }
            }
        });

        it("Should send correct amount to vesting contract", async function () {
            const vestingBalance = await token.balanceOf(await vesting.getAddress());
            expect(vestingBalance).to.equal(totalVesting);
            
            // Log the percentages for verification
            const totalSupply = BigInt(ethers.parseEther("1000000000"));
            console.log("TGE Percentage:", Number(totalTGE * 10000n / totalSupply) / 100, "%");
            console.log("Vesting Percentage:", Number(totalVesting * 10000n / totalSupply) / 100, "%");
        });
    });

    describe("Vesting Schedules", function () {
        let scheduleStartTime;

        beforeEach(async function () {
            scheduleStartTime = await time.latest();
            await time.increase(1);
        });

        describe("Seed Round (70M tokens)", function () {
            it("Should not release tokens before cliff", async function () {
                await time.increase(2 * MONTH);
                const releasable = await vesting.getReleasableAmount(await seed.getAddress());
                expect(releasable).to.equal(0);
            });

            it("Should start vesting after cliff", async function () {
                await time.increase(3 * MONTH + 1);
                const vested = await vesting.getVestedAmount(await seed.getAddress());
                const total = BigInt(ethers.parseEther("70000000"));
                const timeElapsed = BigInt(1);
                const vestingDuration = BigInt(18 * MONTH);
                const expectedVested = (total * timeElapsed) / vestingDuration;
                expect(vested).to.be.closeTo(expectedVested, ethers.parseEther("100"));
            });
        });

        describe("Airdrop (150M tokens)", function () {
            it("Should release 100% tokens at TGE", async function () {
                const balance = await token.balanceOf(await airdrop.getAddress());
                expect(balance).to.equal(BigInt(ethers.parseEther("150000000")));
            });

            it("Should not allow TGE percentage > 100%", async function () {
                const randomAddr = ethers.Wallet.createRandom().address;
                await expect(
                    vesting.createVestingSchedule(
                        randomAddr,
                        BigInt(ethers.parseEther("150000000")),
                        1001n, // 100.1% TGE
                        0n,
                        0n
                    )
                ).to.be.revertedWith("TGE percentage must be <= 100%");
            });
        });

        describe("Marketing Allocation (140M tokens)", function () {
            it("Should release correct TGE amount", async function () {
                const total = BigInt(ethers.parseEther("140000000"));
                const tgeAmount = (total * 225n) / 1000n;
                const schedule = await vesting.vestingSchedules(await marketing.getAddress());
                expect(schedule.released).to.equal(tgeAmount);
            });

            it("Should vest remaining tokens linearly", async function () {
                await time.increase(12 * MONTH);
                const vested = await vesting.getVestedAmount(await marketing.getAddress());
                const total = BigInt(ethers.parseEther("140000000"));
                const tgeAmount = (total * 225n) / 1000n;
                const remainingAmount = total - tgeAmount;
                const expectedVested = tgeAmount + (remainingAmount * 12n) / 24n;
                expect(vested).to.be.closeTo(expectedVested, ethers.parseEther("100"));
            });
        });

        describe("Edge Cases and Security", function () {
            beforeEach(async function () {
                // Deploy fresh contracts for these tests
                const NovastroTokenFactory = await ethers.getContractFactory("NovastroToken", owner);
                token = await NovastroTokenFactory.deploy();

                const TokenVestingFactory = await ethers.getContractFactory("TokenVesting", owner);
                vesting = await TokenVestingFactory.deploy(await token.getAddress());
            });

            it("Should not allow non-owner to create vesting schedule", async function () {
                await expect(
                    vesting.connect(seed).createVestingSchedule(
                        ethers.Wallet.createRandom().address,
                        ethers.parseEther("1000000"),
                        0n,
                        0n,
                        12n
                    )
                ).to.be.revertedWithCustomError(vesting, "AccessControlUnauthorizedAccount");
            });

            it("Should not allow creating vesting schedule twice for same address", async function () {
                const randomAddr = ethers.Wallet.createRandom().address;
                const vestingAddr = await vesting.getAddress();
                const amount = ethers.parseEther("1000");

                // Create first vesting schedule
                await token.connect(owner).transfer(vestingAddr, amount);
                await vesting.createVestingSchedule(
                    randomAddr,
                    amount,
                    0n,
                    1n,
                    12n
                );

                // Try to create second vesting schedule with same address
                await expect(
                    vesting.createVestingSchedule(
                        randomAddr,
                        amount,
                        0n,
                        1n,
                        12n
                    )
                ).to.be.revertedWith("Vesting schedule exists");
            });

            it("Should not release tokens if none are due", async function () {
                const beneficiary = await seed.getAddress();
                const amount = ethers.parseEther("1000");

                // Create vesting schedule with no TGE
                await token.connect(owner).transfer(await vesting.getAddress(), amount);
                await vesting.createVestingSchedule(
                    beneficiary,
                    amount,
                    0n, // 0% TGE
                    1n, // 1 month cliff
                    12n // 12 month vesting
                );

                await expect(
                    vesting.release(beneficiary)
                ).to.be.revertedWith("Amount too small");
            });
        });
    });
});
