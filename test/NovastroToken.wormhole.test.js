const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("NovastroToken Wormhole Integration", function () {
    let token;
    let mockWormhole;
    let owner;
    let user;
    let bridge;
    const chainId = 2; // Ethereum chain ID in Wormhole

    beforeEach(async function () {
        [owner, user, bridge] = await ethers.getSigners();

        // Deploy mock Wormhole contract
        const MockWormhole = await ethers.getContractFactory("MockWormhole");
        mockWormhole = await MockWormhole.deploy();

        // Deploy token with mock Wormhole
        const NovastroToken = await ethers.getContractFactory("NovastroToken");
        token = await NovastroToken.deploy(
            await mockWormhole.getAddress(),
            chainId
        );

        // Grant bridge role
        await token.connect(owner).setWormholeBridge(await bridge.getAddress());
    });

    describe("Bridge Operations", function () {
        const amount = ethers.parseEther("1000");
        const targetChain = 5; // Polygon chain ID in Wormhole

        beforeEach(async function () {
            // Transfer some tokens to user
            await token.connect(owner).transfer(user.address, amount);
        });

        it("Should allow users to bridge tokens", async function () {
            await expect(token.connect(user).bridgeTokens(amount, targetChain))
                .to.emit(token, "TokensBridged")
                .withArgs(user.address, amount, targetChain);

            // Check tokens are burned
            expect(await token.balanceOf(user.address)).to.equal(0);
        });

        it("Should not allow bridging to same chain", async function () {
            await expect(
                token.connect(user).bridgeTokens(amount, chainId)
            ).to.be.revertedWith("Cannot bridge to same chain");
        });

        it("Should not allow bridging zero amount", async function () {
            await expect(
                token.connect(user).bridgeTokens(0, targetChain)
            ).to.be.revertedWith("Amount must be > 0");
        });

        it("Should allow receiving tokens from other chains", async function () {
            const sourceChain = 4; // BSC chain ID in Wormhole
            const recipient = user.address;

            await expect(
                token
                    .connect(bridge)
                    .receiveTokens("0x", amount, recipient, sourceChain)
            )
                .to.emit(token, "TokensReceived")
                .withArgs(recipient, amount, sourceChain);

            // Check tokens are minted
            expect(await token.balanceOf(recipient)).to.equal(amount * 2n); // Initial balance + bridged tokens
        });

        it("Should not allow non-bridge to receive tokens", async function () {
            await expect(
                token
                    .connect(user)
                    .receiveTokens("0x", amount, user.address, targetChain)
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
                token.connect(user).setWormholeBridge(newBridge)
            ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
        });
    });
});
