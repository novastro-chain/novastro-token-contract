// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract TokenVesting is Ownable, ReentrancyGuard {
    struct VestingSchedule {
        uint256 totalAmount;
        uint256 tgeAmount;
        uint256 startTime;
        uint256 cliffDuration;
        uint256 vestingDuration;
        uint256 released;
    }

    IERC20 public immutable token;
    mapping(address => VestingSchedule) public vestingSchedules;

    event VestingScheduleCreated(
        address indexed beneficiary,
        uint256 totalAmount,
        uint256 tgeAmount,
        uint256 cliffDuration,
        uint256 vestingDuration
    );
    event TokensReleased(address indexed beneficiary, uint256 amount);

    constructor(address _token) Ownable(msg.sender) {
        require(_token != address(0), "Invalid token address");
        token = IERC20(_token);
    }

    function createVestingSchedule(
        address beneficiary,
        uint256 amount,
        uint256 tgePercent,
        uint256 cliffMonths,
        uint256 vestingMonths
    ) external onlyOwner {
        require(beneficiary != address(0), "Invalid beneficiary");
        require(amount > 0, "Amount must be > 0");
        require(vestingSchedules[beneficiary].totalAmount == 0, "Vesting schedule already exists");
        require(tgePercent <= 1000, "TGE percentage cannot exceed 100%");
        require(token.balanceOf(address(this)) >= amount, "Insufficient tokens");

        uint256 tgeAmount = (amount * tgePercent) / 1000;
        uint256 startTime = block.timestamp;

        vestingSchedules[beneficiary] = VestingSchedule({
            totalAmount: amount,
            tgeAmount: tgeAmount,
            startTime: startTime,
            cliffDuration: cliffMonths * 30 days,
            vestingDuration: vestingMonths * 30 days,
            released: 0
        });

        emit VestingScheduleCreated(
            beneficiary,
            amount,
            tgeAmount,
            cliffMonths,
            vestingMonths
        );

        if (tgeAmount > 0) {
            _release(beneficiary, tgeAmount);
        }
    }

    function release() external nonReentrant {
        address beneficiary = msg.sender;
        uint256 releasable = getReleasableAmount(beneficiary);
        require(releasable > 0, "No tokens available for release");
        _release(beneficiary, releasable);
    }

    function getVestedAmount(address beneficiary) public view returns (uint256) {
        VestingSchedule memory schedule = vestingSchedules[beneficiary];
        if (schedule.totalAmount == 0) {
            return 0;
        }

        if (block.timestamp < schedule.startTime + schedule.cliffDuration) {
            return schedule.tgeAmount;
        }

        if (block.timestamp >= schedule.startTime + schedule.cliffDuration + schedule.vestingDuration) {
            return schedule.totalAmount;
        }

        uint256 timeFromStart = block.timestamp - schedule.startTime - schedule.cliffDuration;
        uint256 vestedAmount = schedule.tgeAmount + 
            ((schedule.totalAmount - schedule.tgeAmount) * timeFromStart) / schedule.vestingDuration;

        return vestedAmount;
    }

    function getReleasableAmount(address beneficiary) public view returns (uint256) {
        return getVestedAmount(beneficiary) - vestingSchedules[beneficiary].released;
    }

    function _release(address beneficiary, uint256 amount) private {
        VestingSchedule storage schedule = vestingSchedules[beneficiary];
        schedule.released += amount;
        emit TokensReleased(beneficiary, amount);
        require(token.transfer(beneficiary, amount), "Token transfer failed");
    }
}
