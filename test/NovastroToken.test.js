const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Novastro Token and Vesting", function () {
    let token;
    let vesting;
    let owner;
    let seed, team, marketing, dev, ecosystem, treasury, liquidity, airdrop, advisors;
    let mockWormhole;

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

        // Deploy mock Wormhole
        const MockWormhole = await ethers.getContractFactory("MockWormhole");
        mockWormhole = await MockWormhole.deploy();

        const NovastroTokenFactory = await ethers.getContractFactory("NovastroToken");
        token = await NovastroTokenFactory.deploy(await mockWormhole.getAddress(), 2); // 2 is Ethereum chain ID in Wormhole

        const TokenVestingFactory = await ethers.getContractFactory("TokenVesting");
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
            const amount = BigInt(ethers.parseEther("70000000"));

            beforeEach(async function () {
                await token.connect(owner).transfer(await vesting.getAddress(), amount);
                await vesting.createVestingSchedule(
                    seed.address,
                    amount,
                    0n,
                    3n,
                    18n
                );
            });

            it("Should not release tokens before cliff", async function () {
                await time.increase(60 * 24 * 60 * 60); // 2 months
                const vested = await vesting.getVestedAmount(seed.address);
                expect(vested).to.equal(0n);
            });

            it("Should start vesting after cliff", async function () {
                await time.increase(120 * 24 * 60 * 60); // 4 months
                const vested = await vesting.getVestedAmount(seed.address);
                const expectedVested = (amount * 1n) / 18n; // 1 month of vesting after 3 months cliff
                expect(vested).to.equal(expectedVested);
            });
        });

        describe("Airdrop (150M tokens)", function () {
            const amount = BigInt(ethers.parseEther("150000000"));

            it("Should release 100% tokens at TGE", async function () {
                await token.connect(owner).transfer(airdrop.address, amount);
                const balance = await token.balanceOf(airdrop.address);
                expect(balance).to.equal(amount);
            });

            it("Should not allow TGE percentage > 100%", async function () {
                await token.connect(owner).transfer(await vesting.getAddress(), amount);
                await expect(
                    vesting.createVestingSchedule(
                        airdrop.address,
                        amount,
                        1001n,
                        0n,
                        0n
                    )
                ).to.be.revertedWith("TGE percentage cannot exceed 100%");
            });
        });

        describe("Marketing Allocation (140M tokens)", function () {
            const amount = BigInt(ethers.parseEther("140000000"));
            const tgePercent = 225n;

            beforeEach(async function () {
                await token.connect(owner).transfer(await vesting.getAddress(), amount);
                await vesting.createVestingSchedule(
                    marketing.address,
                    amount,
                    tgePercent,
                    0n,
                    24n
                );
            });

            it("Should release correct TGE amount", async function () {
                const balance = await token.balanceOf(marketing.address);
                const expectedTGE = (amount * tgePercent) / 1000n;
                expect(balance).to.equal(expectedTGE);
            });

            it("Should vest remaining tokens linearly", async function () {
                await time.increase(180 * 24 * 60 * 60); // 6 months
                const vested = await vesting.getVestedAmount(marketing.address);
                const tgeAmount = (amount * tgePercent) / 1000n;
                const vestingAmount = amount - tgeAmount;
                const expectedVested = tgeAmount + (vestingAmount * 6n) / 24n;
                expect(vested).to.equal(expectedVested);
            });
        });

        describe("Edge Cases and Security", function () {
            const amount = BigInt(ethers.parseEther("1000000"));

            it("Should not allow non-owner to create vesting schedule", async function () {
                await token.connect(owner).transfer(await vesting.getAddress(), amount);
                await expect(
                    vesting.connect(seed).createVestingSchedule(
                        seed.address,
                        amount,
                        0n,
                        3n,
                        18n
                    )
                ).to.be.revertedWithCustomError(vesting, "OwnableUnauthorizedAccount");
            });

            it("Should not allow creating vesting schedule twice for same address", async function () {
                await token.connect(owner).transfer(await vesting.getAddress(), amount);
                await vesting.createVestingSchedule(
                    seed.address,
                    amount,
                    0n,
                    3n,
                    18n
                );

                await expect(
                    vesting.createVestingSchedule(
                        seed.address,
                        amount,
                        0n,
                        3n,
                        18n
                    )
                ).to.be.revertedWith("Vesting schedule already exists");
            });

            it("Should not release tokens if none are due", async function () {
                await token.connect(owner).transfer(await vesting.getAddress(), amount);
                await vesting.createVestingSchedule(
                    seed.address,
                    amount,
                    0n,
                    3n,
                    18n
                );

                await expect(
                    vesting.connect(seed).release()
                ).to.be.revertedWith("No tokens available for release");
            });
        });
    });

    describe("Bridge Operations", function () {
        let bridge;
        const amount = ethers.parseEther("1000");
        const targetChain = 5; // Polygon chain ID in Wormhole

        beforeEach(async function () {
            [bridge] = await ethers.getSigners();
            // Grant bridge role
            await token.connect(owner).setWormholeBridge(bridge.address);
            // Transfer some tokens to owner for testing
            await token.connect(owner).transfer(owner.address, amount);
        });

        it("Should allow users to bridge tokens", async function () {
            const initialBalance = await token.balanceOf(owner.address);
            await expect(token.connect(owner).bridgeTokens(amount, targetChain))
                .to.emit(token, "TokensBridged")
                .withArgs(owner.address, amount, targetChain);

            // Check tokens are burned
            const finalBalance = await token.balanceOf(owner.address);
            expect(finalBalance).to.equal(initialBalance - amount);
        });

        it("Should not allow bridging to same chain", async function () {
            await expect(
                token.connect(owner).bridgeTokens(amount, 2) // 2 is current chain ID
            ).to.be.revertedWith("Cannot bridge to same chain");
        });

        it("Should not allow bridging zero amount", async function () {
            await expect(
                token.connect(owner).bridgeTokens(0, targetChain)
            ).to.be.revertedWith("Amount must be > 0");
        });

        it("Should allow receiving tokens from other chains", async function () {
            const sourceChain = 4; // BSC chain ID in Wormhole
            const recipient = owner.address;
            const initialBalance = await token.balanceOf(recipient);

            await expect(
                token
                    .connect(bridge)
                    .receiveTokens(amount, recipient, sourceChain)
            )
                .to.emit(token, "TokensReceived")
                .withArgs(recipient, amount, sourceChain);

            // Check tokens are minted
            const finalBalance = await token.balanceOf(recipient);
            expect(finalBalance).to.equal(initialBalance + amount);
        });

        it("Should not allow non-bridge to receive tokens", async function () {
            // First revoke bridge role from owner if they have it
            if (await token.hasRole(await token.BRIDGE_ROLE(), owner.address)) {
                await token.connect(owner).revokeRole(await token.BRIDGE_ROLE(), owner.address);
            }

            await expect(
                token
                    .connect(owner)
                    .receiveTokens(amount, owner.address, targetChain)
            ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
        });
    });

    describe("Bridge Role Management", function () {
        it("Should allow admin to set bridge", async function () {
            const newBridge = ethers.Wallet.createRandom().address;
            await token.connect(owner).setWormholeBridge(newBridge);
            expect(await token.hasRole(await token.BRIDGE_ROLE(), newBridge)).to
                .be.true;
        });

        it("Should not allow non-admin to set bridge", async function () {
            const newBridge = ethers.Wallet.createRandom().address;
            await expect(
                token.connect(seed).setWormholeBridge(newBridge)
            ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
        });
    });
});
