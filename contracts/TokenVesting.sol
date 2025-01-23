// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract TokenVesting is AccessControl {
    bytes32 public constant VESTING_MANAGER_ROLE = keccak256("VESTING_MANAGER_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");
    uint256 private constant MINIMUM_TRANSFER = 1000; // Minimum transfer amount
    bool private _paused;

    struct VestingSchedule {
        address beneficiary;
        uint256 totalAmount;
        uint256 tgePercentage;
        uint256 cliffDuration;
        uint256 vestingDuration;
        uint256 startTime;
        uint256 released;
        bool initialized;
    }

    IERC20 public immutable token;
    
    mapping(address => VestingSchedule) public vestingSchedules;
    
    event VestingScheduleCreated(address indexed beneficiary, uint256 totalAmount, uint256 tgePercentage);
    event TokensReleased(address indexed beneficiary, uint256 amount);
    event EmergencyWithdraw(address indexed token, uint256 amount);
    event ERC20Recovered(address indexed token, address indexed to, uint256 amount);
    event Paused(address account);
    event Unpaused(address account);
    
    modifier whenNotPaused() {
        require(!_paused, "Contract is paused");
        _;
    }

    constructor(address _token) {
        require(_token != address(0), "Token address cannot be 0");
        token = IERC20(_token);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(VESTING_MANAGER_ROLE, msg.sender);
        _grantRole(EMERGENCY_ROLE, msg.sender);
    }
    
    function createVestingSchedule(
        address _beneficiary,
        uint256 _totalAmount,
        uint256 _tgePercentage,
        uint256 _cliffDuration,
        uint256 _vestingDuration
    ) external whenNotPaused onlyRole(VESTING_MANAGER_ROLE) {
        require(_beneficiary != address(0), "Beneficiary address cannot be 0");
        require(_totalAmount > MINIMUM_TRANSFER, "Amount too small");
        require(!vestingSchedules[_beneficiary].initialized, "Vesting schedule exists");
        require(_tgePercentage <= 1000, "TGE percentage must be <= 100%");
        require(_vestingDuration > 0 || _tgePercentage == 1000, "Invalid vesting duration");

        uint256 tgeAmount = (_totalAmount * _tgePercentage) / 1000;
        require(token.balanceOf(address(this)) >= _totalAmount, "Insufficient balance");

        vestingSchedules[_beneficiary] = VestingSchedule({
            initialized: true,
            beneficiary: _beneficiary,
            totalAmount: _totalAmount,
            tgePercentage: _tgePercentage,
            startTime: block.timestamp,
            cliffDuration: _cliffDuration * 30 days,
            vestingDuration: _vestingDuration * 30 days,
            released: tgeAmount
        });

        if (tgeAmount > 0) {
            require(token.transfer(_beneficiary, tgeAmount), "TGE transfer failed");
        }
        
        emit VestingScheduleCreated(_beneficiary, _totalAmount, _tgePercentage);
    }

    function release(address _beneficiary) external whenNotPaused {
        VestingSchedule storage schedule = vestingSchedules[_beneficiary];
        require(schedule.initialized, "No vesting schedule found");

        uint256 releasable = _getReleasableAmount(_beneficiary);
        require(releasable >= MINIMUM_TRANSFER, "Amount too small");

        schedule.released += releasable;
        require(token.transfer(_beneficiary, releasable), "Transfer failed");

        emit TokensReleased(_beneficiary, releasable);
    }

    function emergencyWithdraw() external onlyRole(EMERGENCY_ROLE) {
        uint256 balance = token.balanceOf(address(this));
        require(balance > 0, "No tokens to withdraw");
        require(token.transfer(msg.sender, balance), "Withdraw failed");
        emit EmergencyWithdraw(address(token), balance);
    }

    function recoverERC20(address tokenAddress, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(tokenAddress != address(token), "Cannot recover vesting token");
        IERC20(tokenAddress).transfer(msg.sender, amount);
        emit ERC20Recovered(tokenAddress, msg.sender, amount);
    }

    function pause() external onlyRole(EMERGENCY_ROLE) {
        require(!_paused, "Already paused");
        _paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_paused, "Not paused");
        _paused = false;
        emit Unpaused(msg.sender);
    }

    function getVestedAmount(address _beneficiary) public view returns (uint256) {
        VestingSchedule storage schedule = vestingSchedules[_beneficiary];
        if (!schedule.initialized) return 0;

        // Get TGE amount
        uint256 tgeAmount = (schedule.totalAmount * schedule.tgePercentage) / 1000;

        // If no vesting (100% TGE), return total amount
        if (schedule.tgePercentage == 1000) {
            return schedule.totalAmount;
        }

        // During cliff period, only TGE amount is vested
        if (block.timestamp < schedule.startTime + schedule.cliffDuration) {
            return schedule.tgePercentage > 0 ? schedule.released : 0;
        }

        // After vesting period, all tokens are vested
        if (block.timestamp >= schedule.startTime + schedule.cliffDuration + schedule.vestingDuration) {
            return schedule.totalAmount;
        }

        // During vesting period, calculate linear vesting
        uint256 vestingAmount = schedule.totalAmount - tgeAmount;
        uint256 timeFromStart = block.timestamp - (schedule.startTime + schedule.cliffDuration);
        uint256 vestedVestingAmount = (vestingAmount * timeFromStart) / schedule.vestingDuration;

        // Cap vested amount to total amount
        uint256 totalVested = tgeAmount + vestedVestingAmount;
        if (totalVested > schedule.totalAmount) {
            return schedule.totalAmount;
        }
        return totalVested;
    }

    function _getReleasableAmount(address _beneficiary) private view returns (uint256) {
        VestingSchedule storage schedule = vestingSchedules[_beneficiary];
        if (!schedule.initialized) return 0;

        // During cliff period, only TGE amount is releasable
        if (block.timestamp < schedule.startTime + schedule.cliffDuration) {
            if (schedule.tgePercentage == 0) {
                return 0;
            }
            if (schedule.released >= (schedule.totalAmount * schedule.tgePercentage) / 1000) {
                return 0;
            }
            return (schedule.totalAmount * schedule.tgePercentage) / 1000 - schedule.released;
        }

        uint256 vested = getVestedAmount(_beneficiary);
        if (vested <= schedule.released) {
            return 0;
        }
        return vested - schedule.released;
    }

    function getReleasableAmount(address _beneficiary) external view returns (uint256) {
        return _getReleasableAmount(_beneficiary);
    }
}
