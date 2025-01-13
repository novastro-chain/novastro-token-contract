// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TokenVesting is Ownable {
    struct VestingSchedule {
        uint256 totalAmount;
        uint256 tgeAmount;
        uint256 cliffDuration;
        uint256 vestingDuration;
        uint256 startTime;
        uint256 released;
        bool initialized;
    }

    IERC20 public token;
    
    // Mapping from beneficiary address to vesting schedule
    mapping(address => VestingSchedule) public vestingSchedules;

    event TokensReleased(address beneficiary, uint256 amount);
    event VestingScheduleCreated(address beneficiary, uint256 totalAmount);

    constructor(address _token) Ownable(msg.sender) {
        require(_token != address(0), "Token address cannot be 0");
        token = IERC20(_token);
    }

    function createVestingSchedule(
        address _beneficiary,
        uint256 _totalAmount,
        uint256 _tgePercentage, // Percentage * 10 (e.g., 225 for 22.5%)
        uint256 _cliffMonths,
        uint256 _vestingMonths
    ) external onlyOwner {
        require(_beneficiary != address(0), "Beneficiary address cannot be 0");
        require(_totalAmount > 0, "Total amount must be greater than 0");
        require(!vestingSchedules[_beneficiary].initialized, "Vesting schedule already exists");

        uint256 tgeAmount = (_totalAmount * _tgePercentage) / 1000; // Divide by 1000 since percentage is multiplied by 10
        uint256 cliffDuration = _cliffMonths * 30 days;
        uint256 vestingDuration = _vestingMonths * 30 days;

        vestingSchedules[_beneficiary] = VestingSchedule({
            totalAmount: _totalAmount,
            tgeAmount: tgeAmount,
            cliffDuration: cliffDuration,
            vestingDuration: vestingDuration,
            startTime: block.timestamp,
            released: 0,
            initialized: true
        });

        // Transfer TGE tokens immediately if any
        if (tgeAmount > 0) {
            require(token.transfer(_beneficiary, tgeAmount), "Token transfer failed");
            vestingSchedules[_beneficiary].released = tgeAmount;
        }

        emit VestingScheduleCreated(_beneficiary, _totalAmount);
    }

    function release(address _beneficiary) external {
        VestingSchedule storage schedule = vestingSchedules[_beneficiary];
        require(schedule.initialized, "No vesting schedule found");

        uint256 releasable = _getReleasableAmount(_beneficiary);
        require(releasable > 0, "No tokens are due for release");

        schedule.released += releasable;
        require(token.transfer(_beneficiary, releasable), "Token transfer failed");

        emit TokensReleased(_beneficiary, releasable);
    }

    function getVestedAmount(address _beneficiary) public view returns (uint256) {
        VestingSchedule storage schedule = vestingSchedules[_beneficiary];
        if (!schedule.initialized) return 0;

        if (block.timestamp < schedule.startTime + schedule.cliffDuration) {
            return schedule.tgeAmount;
        }

        if (block.timestamp >= schedule.startTime + schedule.cliffDuration + schedule.vestingDuration) {
            return schedule.totalAmount;
        }

        uint256 timeFromStart = block.timestamp - (schedule.startTime + schedule.cliffDuration);
        uint256 vestedAmount = schedule.tgeAmount + 
            ((schedule.totalAmount - schedule.tgeAmount) * timeFromStart) / schedule.vestingDuration;

        return vestedAmount;
    }

    function _getReleasableAmount(address _beneficiary) private view returns (uint256) {
        return getVestedAmount(_beneficiary) - vestingSchedules[_beneficiary].released;
    }

    function getReleasableAmount(address _beneficiary) external view returns (uint256) {
        return _getReleasableAmount(_beneficiary);
    }
}
