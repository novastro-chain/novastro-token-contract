const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Novastro Token and Vesting", function () {
    let token;
    let vesting;
    let owner;
    let seed, team, marketing, dev, ecosystem, treasury, liquidity, airdrop, advisors;

    const ALLOCATIONS = {
        SEED: {
            total: "70000000",      // 7%
            tgePercent: 0n,         // 0% TGE
            cliff: 3n,              // 3 months cliff
            vesting: 18n            // 18 months vesting
        },
        TEAM: {
            total: "75000000",      // 7.5%
            tgePercent: 0n,         // 0% TGE
            cliff: 12n,             // 12 months cliff
            vesting: 24n            // 24 months vesting
        },
        MARKETING: {
            total: "140000000",     // 14%
            tgePercent: 225n,       // 22.5% TGE
            cliff: 0n,
            vesting: 24n            // 24 months vesting
        },
        DEV: {
            total: "140000000",     // 14%
            tgePercent: 225n,       // 22.5% TGE
            cliff: 0n,
            vesting: 36n            // 36 months vesting
        },
        ECOSYSTEM: {
            total: "175000000",     // 17.5%
            tgePercent: 225n,       // 22.5% TGE
            cliff: 0n,
            vesting: 48n            // 48 months vesting
        },
        TREASURY: {
            total: "150000000",     // 15%
            tgePercent: 0n,         // 0% TGE
            cliff: 0n,
            vesting: 36n            // 36 months vesting
        },
        AIRDROP: {
            total: "150000000",     // 15%
            tgePercent: 1000n,      // 100% TGE
            cliff: 0n,
            vesting: 0n
        },
        LIQUIDITY: {
            total: "50000000",      // 5%
            tgePercent: 1000n,      // 100% TGE
            cliff: 0n,
            vesting: 0n
        },
        ADVISORS: {
            total: "50000000",      // 5%
            tgePercent: 0n,         // 0% TGE
            cliff: 10n,             // 10 months cliff
            vesting: 12n            // 12 months vesting
        }
    };

    beforeEach(async function () {
        [owner, seed, team, marketing, dev, ecosystem, treasury, liquidity, airdrop, advisors] = await ethers.getSigners();

        const NovastroTokenFactory = await ethers.getContractFactory("NovastroToken", owner);
        token = await NovastroTokenFactory.deploy();

        const TokenVestingFactory = await ethers.getContractFactory("TokenVesting", owner);
        vesting = await TokenVestingFactory.deploy(await token.getAddress());
    });

    describe("Token Distribution", function () {
        it("Should have correct initial supply", async function () {
            const totalSupply = await token.totalSupply();
            expect(totalSupply).to.equal(BigInt(ethers.parseEther("1000000000")));
        });

        it("Should have correct token allocations and TGE amounts", async function () {
            let totalAllocation = 0n;
            let totalTGEAmount = 0n;
            let totalVestingAmount = 0n;

            for (const [role, allocation] of Object.entries(ALLOCATIONS)) {
                const amount = BigInt(ethers.parseEther(allocation.total));
                const tgeAmount = (amount * allocation.tgePercent) / 1000n;
                
                totalAllocation += amount;
                totalTGEAmount += tgeAmount;
                totalVestingAmount += amount - tgeAmount;

                // For 100% TGE allocations, transfer directly
                if (allocation.tgePercent === 1000n) {
                    const recipient = eval(role.toLowerCase());
                    await token.connect(owner).transfer(recipient.address, amount);
                    const balance = await token.balanceOf(recipient.address);
                    expect(balance).to.equal(amount);
                    continue;
                }

                // For vesting allocations, create vesting schedule
                const recipient = eval(role.toLowerCase());
                await token.connect(owner).transfer(await vesting.getAddress(), amount);
                await vesting.createVestingSchedule(
                    recipient.address,
                    amount,
                    allocation.tgePercent,
                    allocation.cliff,
                    allocation.vesting
                );

                // Verify TGE amount if any
                if (allocation.tgePercent > 0n) {
                    const balance = await token.balanceOf(recipient.address);
                    const expectedTGE = (amount * allocation.tgePercent) / 1000n;
                    expect(balance).to.equal(expectedTGE);
                }
            }

            // Verify total allocations
            const totalSupply = BigInt(ethers.parseEther("1000000000"));
            expect(totalAllocation).to.equal(totalSupply);

            // Log distribution percentages
            console.log("TGE Amount:", ethers.formatEther(totalTGEAmount), "tokens");
            console.log("Vesting Amount:", ethers.formatEther(totalVestingAmount), "tokens");
            console.log("TGE Percentage:", Number(totalTGEAmount * 10000n / totalSupply) / 100, "%");
            console.log("Vesting Percentage:", Number(totalVestingAmount * 10000n / totalSupply) / 100, "%");
        });

        it("Should vest tokens correctly after cliff", async function () {
            // Setup all vesting schedules first
            for (const [role, allocation] of Object.entries(ALLOCATIONS)) {
                if (allocation.tgePercent === 1000n) continue;

                const amount = BigInt(ethers.parseEther(allocation.total));
                const recipient = eval(role.toLowerCase());
                await token.connect(owner).transfer(await vesting.getAddress(), amount);
                await vesting.createVestingSchedule(
                    recipient.address,
                    amount,
                    allocation.tgePercent,
                    allocation.cliff,
                    allocation.vesting
                );
            }

            // Test vesting after 6 months
            await time.increase(180 * 24 * 60 * 60); // 6 months

            // Check each allocation
            for (const [role, allocation] of Object.entries(ALLOCATIONS)) {
                if (allocation.tgePercent === 1000n) continue;

                const recipient = eval(role.toLowerCase());
                const amount = BigInt(ethers.parseEther(allocation.total));
                const tgeAmount = (amount * allocation.tgePercent) / 1000n;
                const vestingAmount = amount - tgeAmount;

                // Calculate expected vested amount
                let expectedVested = tgeAmount;
                if (allocation.cliff <= 6n) {
                    const vestedMonths = 6n - allocation.cliff;
                    if (vestedMonths > 0n) {
                        expectedVested += (vestingAmount * vestedMonths) / allocation.vesting;
                    }
                }

                const vested = await vesting.getVestedAmount(recipient.address);
                // Check if vested amount is within 0.01% of expected
                const difference = vested > expectedVested ? vested - expectedVested : expectedVested - vested;
                const maxDifference = expectedVested / 10000n; // 0.01%
                expect(difference).to.be.lte(maxDifference);
            }
        });
    });

    describe("Vesting Schedules", function () {
        describe("Seed Round (70M tokens)", function () {
            beforeEach(async function () {
                const amount = BigInt(ethers.parseEther("70000000"));
                await token.connect(owner).transfer(await vesting.getAddress(), amount);

                await vesting.createVestingSchedule(
                    await seed.getAddress(),
                    amount,
                    0n, // 0% TGE
                    3n, // 3 months cliff
                    18n // 18 months vesting
                );
            });

            it("Should not release tokens before cliff", async function () {
                const releasable = await vesting.getReleasableAmount(await seed.getAddress());
                expect(releasable).to.equal(0n);
            });

            it("Should start vesting after cliff", async function () {
                // Move past cliff period and some vesting duration
                await time.increase(210 * 24 * 60 * 60); // 7 months (3 months cliff + 4 months vesting)
                const releasable = await vesting.getReleasableAmount(await seed.getAddress());
                expect(releasable).to.be.gt(0n);
            });
        });

        describe("Airdrop (150M tokens)", function () {
            it("Should release 100% tokens at TGE", async function () {
                const amount = BigInt(ethers.parseEther("150000000"));
                await token.connect(owner).transfer(await airdrop.getAddress(), amount);

                const balance = await token.balanceOf(await airdrop.getAddress());
                expect(balance).to.equal(amount);
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
            beforeEach(async function () {
                const amount = BigInt(ethers.parseEther("140000000"));
                await token.connect(owner).transfer(await vesting.getAddress(), amount);

                await vesting.createVestingSchedule(
                    await marketing.getAddress(),
                    amount,
                    225n, // 22.5% TGE
                    0n,
                    24n // 24 months vesting
                );
            });

            it("Should release correct TGE amount", async function () {
                const totalAmount = BigInt(ethers.parseEther("140000000"));
                const expectedTGE = (totalAmount * 225n) / 1000n; // 22.5%
                const balance = await token.balanceOf(await marketing.getAddress());
                expect(balance).to.equal(expectedTGE);
            });

            it("Should vest remaining tokens linearly", async function () {
                await time.increase(180 * 24 * 60 * 60); // 6 months
                const releasable = await vesting.getReleasableAmount(await marketing.getAddress());
                expect(releasable).to.be.gt(0n);
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
                await expect(
                    vesting.release(await seed.getAddress())
                ).to.be.revertedWith("No vesting schedule found");
            });
        });
    });
});
