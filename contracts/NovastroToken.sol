// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Context.sol";

contract NovastroToken is ERC20, Ownable {
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 10**18; // 1 billion tokens
    
    mapping(address => bool) public vestingContracts;
    
    constructor() ERC20("NOVASTRO", "NOVAS") Ownable(msg.sender) {
        _mint(msg.sender, TOTAL_SUPPLY);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
    
    function setVestingContract(address _vestingContract, bool _status) external onlyOwner {
        require(_vestingContract != address(0), "Invalid vesting contract address");
        vestingContracts[_vestingContract] = _status;
        emit VestingContractUpdated(_vestingContract, _status);
    }
    
    function transferToVesting(address _vestingContract, uint256 _amount) external onlyOwner {
        require(vestingContracts[_vestingContract], "Not a valid vesting contract");
        require(_amount > 0, "Amount must be greater than 0");
        _transfer(msg.sender, _vestingContract, _amount);
    }
    
    event VestingContractUpdated(address indexed vestingContract, bool status);
}