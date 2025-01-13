# NOVASTRO Token Contract

This repository contains the smart contracts for the NOVASTRO token and its vesting mechanism. The NOVASTRO token is an ERC20 token with a total supply of 1 billion tokens, implementing a sophisticated vesting schedule for various token allocations.

## Contracts

### NovastroToken.sol
- ERC20 token implementation
- Symbol: NOVAS
- Total Supply: 1,000,000,000 tokens
- Features: Token burning capability

### TokenVesting.sol
- Manages token vesting schedules for different allocations
- Supports TGE (Token Generation Event) releases
- Configurable cliff periods and linear vesting
- Secure release mechanism

## Token Allocations

The token distribution includes various allocations with different vesting schedules:

1. **Seed Round (70M tokens)**
   - 0% TGE
   - 3 months cliff
   - 18 months linear vesting

2. **Team (75M tokens)**
   - 0% TGE
   - 12 months cliff
   - 24 months linear vesting

3. **Marketing (140M tokens)**
   - 22.5% TGE
   - No cliff
   - 24 months linear vesting

4. **Development (140M tokens)**
   - 22.5% TGE
   - No cliff
   - 36 months linear vesting

5. **Ecosystem Rewards & Staking (175M tokens)**
   - 22.5% TGE
   - No cliff
   - 48 months linear vesting

6. **Treasury (150M tokens)**
   - 0% TGE
   - 12 months cliff
   - 36 months linear vesting

7. **Airdrop (150M tokens)**
   - 100% at TGE

8. **Liquidity (50M tokens)**
   - 100% at TGE

9. **Advisors (50M tokens)**
   - 0% TGE
   - 10 months cliff
   - 12 months linear vesting

## Development

### Prerequisites
- Node.js
- npm or yarn
- Hardhat

### Setup
```bash
# Install dependencies
npm install

# Run tests
npm test

# Run hardhat local network
npx hardhat node

# Deploy contracts
npx hardhat run scripts/deploy.js --network <network-name>
```

### Scripts

#### 1. Deployment (`scripts/deploy.js`)
Deploys the token and vesting contracts, and sets up initial vesting schedules:
```bash
npx hardhat run scripts/deploy.js --network <network-name>
```

#### 2. Add Vesting (`scripts/add-vesting.js`)
Adds new vesting schedules after deployment. Supports both single and batch additions:
```bash
# Update the script with your vesting contract address and schedule details
npx hardhat run scripts/add-vesting.js --network <network-name>
```

#### 3. Manage Vesting (`scripts/manage-vesting.js`)
Manages existing vesting schedules, check status, and release tokens:
```bash
# Update the script with your contract addresses
npx hardhat run scripts/manage-vesting.js --network <network-name>
```

### Testing
The project includes comprehensive test coverage for all vesting scenarios and edge cases. Run the tests using:
```bash
npx hardhat test
```

## Security
- Owner-only vesting schedule creation
- Protection against double vesting
- Safe math operations using Solidity 0.8.20
- Built on proven OpenZeppelin contracts

## License
MIT License
