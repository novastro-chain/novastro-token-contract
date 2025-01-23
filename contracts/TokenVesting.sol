// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TokenVesting is Ownable {
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

    IERC20 public immutable token;  // Fixed order of modifiers
    
    // Mapping from beneficiary address to vesting schedule
    mapping(address => VestingSchedule) public vestingSchedules;
    
    event VestingScheduleCreated(address indexed beneficiary, uint256 totalAmount, uint256 tgePercentage);
    event TokensReleased(address indexed beneficiary, uint256 amount);
    
    constructor(address _token) Ownable(msg.sender) {
        require(_token != address(0), "Token address cannot be 0");
        token = IERC20(_token);
    }
    
    function createVestingSchedule(
        address _beneficiary,
        uint256 _totalAmount,
        uint256 _tgePercentage,
        uint256 _cliffDuration,
        uint256 _vestingDuration
    ) external onlyOwner {
        require(_beneficiary != address(0), "Beneficiary address cannot be 0");
        require(_totalAmount > 0, "Total amount must be greater than 0");
        require(!vestingSchedules[_beneficiary].initialized, "Vesting schedule already exists");
        require(_tgePercentage <= 1000, "TGE percentage must be less than or equal to 100%");
        require(_vestingDuration > 0 || _tgePercentage == 1000, "Vesting duration must be greater than 0");

        uint256 tgeAmount = (_totalAmount * _tgePercentage) / 1000;

        // Check if contract has enough balance
        require(IERC20(token).balanceOf(address(this)) >= _totalAmount, "Insufficient balance");

        vestingSchedules[_beneficiary] = VestingSchedule({
            initialized: true,
            beneficiary: _beneficiary,
            totalAmount: _totalAmount,
            tgePercentage: _tgePercentage,
            startTime: block.timestamp,
            cliffDuration: _cliffDuration * 30 days,
            vestingDuration: _vestingDuration * 30 days,
            released: 0
        });

        if (tgeAmount > 0) {
            vestingSchedules[_beneficiary].released = tgeAmount;
            IERC20(token).transfer(_beneficiary, tgeAmount);
        }

        emit VestingScheduleCreated(_beneficiary, _totalAmount, _tgePercentage);
    }

    function release(address _beneficiary) external {
        VestingSchedule storage schedule = vestingSchedules[_beneficiary];
        require(schedule.initialized, "No vesting schedule found");

        uint256 releasable = _getReleasableAmount(_beneficiary);
        require(releasable > 0, "No tokens are due for release");

        schedule.released += releasable;
        require(IERC20(token).transfer(_beneficiary, releasable), "Token transfer failed");

        emit TokensReleased(_beneficiary, releasable);
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
