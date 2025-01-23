const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Novastro Token and Vesting", function () {
    let token;
    let vesting;
    let owner;
    let seed;
    let airdrop;
    let marketing;

    beforeEach(async function () {
        [owner, seed, airdrop, marketing] = await ethers.getSigners();

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

        it("Should distribute TGE tokens correctly", async function () {
            const distributions = {
                seed: {
                    amount: BigInt(ethers.parseEther("70000000")),
                    tge: 100n, // 10%
                    cliff: 6n,
                    vesting: 18n
                },
                airdrop: {
                    amount: BigInt(ethers.parseEther("150000000")),
                    tge: 1000n, // 100%
                    cliff: 0n,
                    vesting: 0n
                },
                marketing: {
                    amount: BigInt(ethers.parseEther("140000000")),
                    tge: 200n, // 20%
                    cliff: 0n,
                    vesting: 12n
                }
            };

            let totalTGEAmount = 0n;
            let totalVestingAmount = 0n;
            const totalSupply = BigInt(ethers.parseEther("1000000000"));

            for (const [key, value] of Object.entries(distributions)) {
                const tgeAmount = (value.amount * value.tge) / 1000n;
                totalTGEAmount += tgeAmount;
                totalVestingAmount += value.amount - tgeAmount;
            }

            const tgePercentage = (totalTGEAmount * 10000n) / totalSupply;
            const vestingPercentage = (totalVestingAmount * 10000n) / totalSupply;

            console.log("TGE Percentage:", (tgePercentage / 100n).toString(), "%");
            console.log("Vesting Percentage:", (vestingPercentage / 100n).toString(), "%");
        });

        it("Should send correct amount to vesting contract", async function () {
            const totalVestingAmount = BigInt(ethers.parseEther("360000000")); // 360M tokens for vesting
            await token.connect(owner).transfer(await vesting.getAddress(), totalVestingAmount);
            const vestingBalance = await token.balanceOf(await vesting.getAddress());
            expect(vestingBalance).to.equal(totalVestingAmount);
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
                    100n, // 10% TGE
                    6n, // 6 months cliff
                    18n // 18 months vesting
                );
            });

            it("Should not release tokens before cliff", async function () {
                const releasable = await vesting.getReleasableAmount(await seed.getAddress());
                expect(releasable).to.equal(0n);
            });

            it("Should start vesting after cliff", async function () {
                // Move past cliff period and some vesting duration
                await time.increase(210 * 24 * 60 * 60); // 7 months (6 months cliff + 1 month vesting)
                const releasable = await vesting.getReleasableAmount(await seed.getAddress());
                expect(releasable).to.be.gt(0n);
            });
        });

        describe("Airdrop (150M tokens)", function () {
            it("Should release 100% tokens at TGE", async function () {
                const amount = BigInt(ethers.parseEther("150000000"));
                await token.connect(owner).transfer(await vesting.getAddress(), amount);

                await vesting.createVestingSchedule(
                    await airdrop.getAddress(),
                    amount,
                    1000n, // 100% TGE
                    0n,
                    0n
                );

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
                    200n, // 20% TGE
                    0n,
                    12n // 12 months vesting
                );
            });

            it("Should release correct TGE amount", async function () {
                const totalAmount = BigInt(ethers.parseEther("140000000"));
                const expectedTGE = (totalAmount * 200n) / 1000n; // 20%
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
