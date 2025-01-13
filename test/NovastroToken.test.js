const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Novastro Token and Vesting", function () {
    let token, vesting;
    let owner, seed, team, marketing, dev, ecosystem, treasury, liquidity, airdrop, advisors;
    const MONTH = 30 * 24 * 60 * 60; // 30 days in seconds

    beforeEach(async function () {
        [owner, seed, team, marketing, dev, ecosystem, treasury, liquidity, airdrop, advisors] = await ethers.getSigners();

        // Deploy Token
        const NovastroTokenFactory = await ethers.getContractFactory("NovastroToken", owner);
        token = await NovastroTokenFactory.deploy();

        // Deploy Vesting
        const TokenVestingFactory = await ethers.getContractFactory("TokenVesting", owner);
        vesting = await TokenVestingFactory.deploy(await token.getAddress());

        // Transfer tokens to vesting contract
        await token.transfer(await vesting.getAddress(), ethers.parseEther("1000000000"));
    });

    describe("Token", function () {
        it("Should have correct initial supply", async function () {
            const totalSupply = await token.totalSupply();
            expect(totalSupply).to.equal(ethers.parseEther("1000000000"));
        });

        it("Should have correct token name and symbol", async function () {
            const name = await token.name();
            const symbol = await token.symbol();
            expect(name).to.equal("NOVASTRO");
            expect(symbol).to.equal("NOVAS");
        });
    });

    describe("Vesting Schedules", function () {
        describe("Seed Round (70M tokens)", function () {
            const seedAmount = ethers.parseEther("70000000");

            beforeEach(async function () {
                await vesting.createVestingSchedule(
                    await seed.getAddress(),
                    seedAmount,
                    0n, // 0% TGE
                    3n, // 3 months cliff
                    18n // 18 months vesting
                );
            });

            it("Should not release tokens before cliff", async function () {
                await time.increase(2 * MONTH); // 2 months after start
                const vested = await vesting.getVestedAmount(await seed.getAddress());
                expect(vested).to.equal(0);
            });

            it("Should start vesting after cliff", async function () {
                await time.increase(4 * MONTH); // 4 months after start (1 month into vesting)
                const vested = await vesting.getVestedAmount(await seed.getAddress());
                const expectedVested = seedAmount / 18n; // Roughly 1/18th of tokens
                expect(vested).to.be.closeTo(expectedVested, ethers.parseEther("100"));
            });
        });

        describe("Airdrop (150M tokens)", function () {
            const airdropAmount = ethers.parseEther("150000000");

            it("Should release 100% tokens at TGE", async function () {
                await vesting.createVestingSchedule(
                    await airdrop.getAddress(),
                    airdropAmount,
                    1000n, // 100% TGE
                    0n, // no cliff
                    0n // no vesting
                );

                const balance = await token.balanceOf(await airdrop.getAddress());
                expect(balance).to.equal(airdropAmount);
            });
        });

        describe("Team Allocation (75M tokens)", function () {
            const teamAmount = ethers.parseEther("75000000");

            beforeEach(async function () {
                await vesting.createVestingSchedule(
                    await team.getAddress(),
                    teamAmount,
                    0n, // 0% TGE
                    12n, // 12 months cliff
                    24n // 24 months vesting
                );
            });

            it("Should not release tokens during 12-month cliff", async function () {
                await time.increase(11 * MONTH);
                const vested = await vesting.getVestedAmount(await team.getAddress());
                expect(vested).to.equal(0);
            });

            it("Should vest linearly over 24 months after cliff", async function () {
                await time.increase(18 * MONTH); // 6 months into vesting
                const vested = await vesting.getVestedAmount(await team.getAddress());
                const expectedVested = teamAmount * 6n / 24n; // 6/24 = 25% of tokens
                expect(vested).to.be.closeTo(expectedVested, ethers.parseEther("100"));
            });
        });

        describe("Advisors Allocation (50M tokens)", function () {
            const advisorsAmount = ethers.parseEther("50000000");

            beforeEach(async function () {
                await vesting.createVestingSchedule(
                    await advisors.getAddress(),
                    advisorsAmount,
                    0n, // 0% TGE
                    10n, // 10 months cliff
                    12n // 12 months vesting
                );
            });

            it("Should respect 10-month cliff", async function () {
                await time.increase(9 * MONTH);
                const vested = await vesting.getVestedAmount(await advisors.getAddress());
                expect(vested).to.equal(0);
            });

            it("Should complete vesting after cliff + vesting period", async function () {
                await time.increase(22 * MONTH); // 10 months cliff + 12 months vesting
                const vested = await vesting.getVestedAmount(await advisors.getAddress());
                expect(vested).to.equal(advisorsAmount);
            });
        });

        describe("Marketing Allocation (140M tokens)", function () {
            const marketingAmount = ethers.parseEther("140000000");

            beforeEach(async function () {
                await vesting.createVestingSchedule(
                    await marketing.getAddress(),
                    marketingAmount,
                    225n, // 22.5% TGE
                    0n, // no cliff
                    24n // 24 months vesting
                );
            });

            it("Should release correct TGE amount", async function () {
                const tgeAmount = marketingAmount * 225n / 1000n;
                const balance = await token.balanceOf(await marketing.getAddress());
                expect(balance).to.equal(tgeAmount);
            });

            it("Should vest remaining tokens linearly", async function () {
                await time.increase(12 * MONTH); // Half vesting period
                const vested = await vesting.getVestedAmount(await marketing.getAddress());
                const tgeAmount = marketingAmount * 225n / 1000n;
                const remainingAmount = marketingAmount - tgeAmount;
                const expectedVested = tgeAmount + (remainingAmount * 12n / 24n);
                expect(vested).to.be.closeTo(expectedVested, ethers.parseEther("100"));
            });
        });

        describe("Dev Allocation (140M tokens)", function () {
            const devAmount = ethers.parseEther("140000000");

            beforeEach(async function () {
                await vesting.createVestingSchedule(
                    await dev.getAddress(),
                    devAmount,
                    225n, // 22.5% TGE
                    0n, // no cliff
                    36n // 36 months vesting
                );
            });

            it("Should handle longer vesting period correctly", async function () {
                await time.increase(18 * MONTH); // Half vesting period
                const vested = await vesting.getVestedAmount(await dev.getAddress());
                const tgeAmount = devAmount * 225n / 1000n;
                const remainingAmount = devAmount - tgeAmount;
                const expectedVested = tgeAmount + (remainingAmount * 18n / 36n);
                expect(vested).to.be.closeTo(expectedVested, ethers.parseEther("100"));
            });
        });

        describe("Ecosystem Rewards & Staking (175M tokens)", function () {
            const ecosystemAmount = ethers.parseEther("175000000");

            beforeEach(async function () {
                await vesting.createVestingSchedule(
                    await ecosystem.getAddress(),
                    ecosystemAmount,
                    225n, // 22.5% TGE
                    0n, // no cliff
                    48n // 48 months vesting
                );
            });

            it("Should handle longest vesting period correctly", async function () {
                await time.increase(24 * MONTH); // Half vesting period
                const vested = await vesting.getVestedAmount(await ecosystem.getAddress());
                const tgeAmount = ecosystemAmount * 225n / 1000n;
                const remainingAmount = ecosystemAmount - tgeAmount;
                const expectedVested = tgeAmount + (remainingAmount * 24n / 48n);
                expect(vested).to.be.closeTo(expectedVested, ethers.parseEther("100"));
            });
        });

        describe("Treasury (150M tokens)", function () {
            const treasuryAmount = ethers.parseEther("150000000");

            beforeEach(async function () {
                await vesting.createVestingSchedule(
                    await treasury.getAddress(),
                    treasuryAmount,
                    0n, // 0% TGE
                    12n, // 12 months cliff
                    36n // 36 months vesting
                );
            });

            it("Should respect cliff and vesting periods", async function () {
                // Check at cliff
                await time.increase(12 * MONTH);
                let vested = await vesting.getVestedAmount(await treasury.getAddress());
                expect(vested).to.equal(0);

                // Check halfway through vesting
                await time.increase(18 * MONTH);
                vested = await vesting.getVestedAmount(await treasury.getAddress());
                const expectedVested = treasuryAmount * 18n / 36n;
                expect(vested).to.be.closeTo(expectedVested, ethers.parseEther("100"));
            });
        });

        describe("Liquidity (50M tokens)", function () {
            const liquidityAmount = ethers.parseEther("50000000");

            it("Should release 100% tokens at TGE", async function () {
                await vesting.createVestingSchedule(
                    await liquidity.getAddress(),
                    liquidityAmount,
                    1000n, // 100% TGE
                    0n, // no cliff
                    0n // no vesting
                );

                const balance = await token.balanceOf(await liquidity.getAddress());
                expect(balance).to.equal(liquidityAmount);
            });
        });

        describe("Edge Cases and Security", function () {
            it("Should not allow creating vesting schedule twice for same address", async function () {
                await vesting.createVestingSchedule(
                    await seed.getAddress(),
                    ethers.parseEther("1000"),
                    0n,
                    1n,
                    12n
                );

                await expect(
                    vesting.createVestingSchedule(
                        await seed.getAddress(),
                        ethers.parseEther("1000"),
                        0n,
                        1n,
                        12n
                    )
                ).to.be.revertedWith("Vesting schedule already exists");
            });

            it("Should not allow non-owner to create vesting schedule", async function () {
                await expect(
                    vesting.connect(seed).createVestingSchedule(
                        await seed.getAddress(),
                        ethers.parseEther("1000"),
                        0n,
                        1n,
                        12n
                    )
                ).to.be.reverted;
            });

            it("Should not release tokens if none are due", async function () {
                await vesting.createVestingSchedule(
                    await seed.getAddress(),
                    ethers.parseEther("1000"),
                    0n,
                    12n,
                    12n
                );

                await expect(
                    vesting.connect(seed).release(await seed.getAddress())
                ).to.be.revertedWith("No tokens are due for release");
            });
        });
    });
});
