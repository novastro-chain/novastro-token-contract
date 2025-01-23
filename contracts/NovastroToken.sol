// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

interface IWormhole {
    function publishMessage(
        uint32 nonce,
        bytes memory payload,
        uint8 consistencyLevel
    ) external payable returns (uint64 sequence);
}

contract NovastroToken is ERC20, AccessControl {
    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 10**18; // 1 billion tokens
    
    IWormhole public immutable wormhole;
    uint16 public immutable chainId;
    uint8 public constant CONSISTENCY_LEVEL = 1;

    event TokensBridged(address indexed from, uint256 amount, uint16 targetChain);
    event TokensReceived(address indexed to, uint256 amount, uint16 sourceChain);

    constructor(address _wormholeCore, uint16 _chainId) ERC20("NOVASTRO", "NOVAS") {
        require(_wormholeCore != address(0), "Invalid Wormhole core");
        wormhole = IWormhole(_wormholeCore);
        chainId = _chainId;
        
        _mint(msg.sender, TOTAL_SUPPLY);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function bridgeTokens(uint256 amount, uint16 targetChain) external payable {
        require(amount > 0, "Amount must be > 0");
        require(targetChain != chainId, "Cannot bridge to same chain");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");

        // Burn tokens on this chain
        _burn(msg.sender, amount);

        // Create bridge payload
        bytes memory payload = abi.encode(
            msg.sender,  // recipient on target chain
            amount
        );

        // Publish message to Wormhole
        wormhole.publishMessage{value: msg.value}(
            0,  // nonce
            payload,
            CONSISTENCY_LEVEL
        );

        emit TokensBridged(msg.sender, amount, targetChain);
    }

    function receiveTokens(
        uint256 amount,
        address recipient,
        uint16 sourceChain
    ) external onlyRole(BRIDGE_ROLE) {
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be > 0");
        require(sourceChain != chainId, "Invalid source chain");

        // Mint tokens on this chain
        _mint(recipient, amount);

        emit TokensReceived(recipient, amount, sourceChain);
    }

    function setWormholeBridge(address bridge) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(bridge != address(0), "Invalid bridge address");
        _grantRole(BRIDGE_ROLE, bridge);
    }
}