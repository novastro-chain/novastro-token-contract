// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract NovastroToken is ERC20, AccessControl {
    uint256 private constant MINIMUM_TRANSFER = 1000; // Minimum transfer amount
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 10**18; // 1 billion tokens

    constructor() ERC20("NOVASTRO", "NOVAS") {
        _mint(msg.sender, TOTAL_SUPPLY);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function _update(address from, address to, uint256 value) internal virtual override {
        require(value >= MINIMUM_TRANSFER || from == address(0) || to == address(0), "Transfer amount too low");
        super._update(from, to, value);
    }
}