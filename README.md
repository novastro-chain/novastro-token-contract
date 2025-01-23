# Novastro Token Contracts

This repository contains the smart contracts for the NOVASTRO (NOVAS) token and its vesting mechanism.

## Overview

- **Token Name**: NOVASTRO
- **Symbol**: NOVAS
- **Total Supply**: 1,000,000,000 (1 billion) tokens
- **Decimals**: 18

## Features

### Token Distribution
- **Seed Round**: 7% (70M tokens) - 0% TGE, 3 months cliff, 18 months vesting
- **Team**: 7.5% (75M tokens) - 0% TGE, 12 months cliff, 24 months vesting
- **Marketing**: 14% (140M tokens) - 22.5% TGE, no cliff, 24 months vesting
- **Development**: 14% (140M tokens) - 22.5% TGE, no cliff, 36 months vesting
- **Ecosystem**: 17.5% (175M tokens) - 22.5% TGE, no cliff, 48 months vesting
- **Treasury**: 15% (150M tokens) - 0% TGE, no cliff, 36 months vesting
- **Airdrop**: 15% (150M tokens) - 100% TGE
- **Liquidity**: 5% (50M tokens) - 100% TGE
- **Advisors**: 5% (50M tokens) - 0% TGE, 10 months cliff, 12 months vesting

### Cross-Chain Support
The token now supports cross-chain transfers through Wormhole's Native Token Transfer (NTT) protocol, enabling:
- Seamless token transfers between supported blockchains
- Automatic token bridging with consistent supply across chains
- Secure bridge operations with role-based access control

## Contracts

1. **NovastroToken.sol**: ERC20 token contract with:
   - Role-based access control
   - Cross-chain transfer capabilities via Wormhole
   - Bridge operations for token minting/burning

2. **TokenVesting.sol**: Vesting contract with:
   - Linear vesting schedule support
   - Cliff periods
   - TGE (Token Generation Event) releases
   - Multiple beneficiary support

3. **MockWormhole.sol**: Mock contract for testing Wormhole integration

## Deployment

### Prerequisites
```bash
npm install
```

### Deploy to Different Networks
```bash
# Deploy to Ethereum Mainnet
npx hardhat run scripts/deploy-with-wormhole.js --network ethereum

# Deploy to Polygon
npx hardhat run scripts/deploy-with-wormhole.js --network polygon

# Deploy to BSC
npx hardhat run scripts/deploy-with-wormhole.js --network bsc

# Deploy to Avalanche
npx hardhat run scripts/deploy-with-wormhole.js --network avalanche
```

### Create Vesting Schedules
```bash
npx hardhat run scripts/add-vesting.js --network <network>
```

## Testing
```bash
# Run all tests
npx hardhat test

# Run specific test file
npx hardhat test test/NovastroToken.test.js
npx hardhat test test/NovastroToken.wormhole.test.js
```

## Cross-Chain Operations

### Bridge Tokens
To bridge tokens to another chain:
```solidity
// Amount in wei (18 decimals)
uint256 amount = 1000000000000000000; // 1 NOVAS
uint16 targetChain = 5; // Polygon chain ID in Wormhole

// Bridge tokens
await novastroToken.bridgeTokens(amount, targetChain, { value: wormholeFee });
```

### Supported Networks
- Ethereum (Chain ID: 2)
- BSC (Chain ID: 4)
- Polygon (Chain ID: 5)
- Avalanche (Chain ID: 6)
- Optimism (Chain ID: 24)
- Arbitrum (Chain ID: 23)
- Base (Chain ID: 30)

## Security

The contracts use OpenZeppelin's battle-tested implementations for:
- ERC20 token standard
- Access Control
- Safe math operations

## License

MIT
