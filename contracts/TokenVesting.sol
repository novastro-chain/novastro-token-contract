// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract TokenVesting is AccessControl {
    bytes32 public constant VESTING_MANAGER_ROLE = keccak256("VESTING_MANAGER_ROLE");

    struct VestingSchedule {
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
    
    constructor(address _token) {
        require(_token != address(0), "Token address cannot be 0");
        token = IERC20(_token);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(VESTING_MANAGER_ROLE, msg.sender);
    }
    
    function createVestingSchedule(
        address _beneficiary,
        uint256 _totalAmount,
        uint256 _tgePercentage,
        uint256 _cliffDuration,
        uint256 _vestingDuration
    ) external onlyRole(VESTING_MANAGER_ROLE) {
        require(_beneficiary != address(0), "Beneficiary cannot be 0");
        require(!vestingSchedules[_beneficiary].initialized, "Schedule exists");
        require(_tgePercentage <= 1000, "TGE percentage > 100%");
        require(_vestingDuration > 0 || _tgePercentage == 1000, "Invalid duration");
        require(_cliffDuration <= _vestingDuration, "Cliff > vesting");

        uint256 tgeAmount = (_totalAmount * _tgePercentage) / 1000;
        require(token.balanceOf(address(this)) >= _totalAmount, "Insufficient balance");

        vestingSchedules[_beneficiary] = VestingSchedule({
            totalAmount: _totalAmount,
            tgePercentage: _tgePercentage,
            startTime: block.timestamp,
            cliffDuration: _cliffDuration * 30 days,
            vestingDuration: _vestingDuration * 30 days,
            released: tgeAmount,
            initialized: true
        });

        if (tgeAmount > 0) {
            require(token.transfer(_beneficiary, tgeAmount), "TGE transfer failed");
        }
        
        emit VestingScheduleCreated(_beneficiary, _totalAmount, _tgePercentage);
    }

    function release(address _beneficiary) external {
        uint256 releasable = _getReleasableAmount(_beneficiary);
        require(releasable > 0, "Nothing to release");

        vestingSchedules[_beneficiary].released += releasable;
        require(token.transfer(_beneficiary, releasable), "Transfer failed");

        emit TokensReleased(_beneficiary, releasable);
    }

    function getVestedAmount(address _beneficiary) public view returns (uint256) {
        VestingSchedule storage schedule = vestingSchedules[_beneficiary];
        if (!schedule.initialized) return 0;

        if (schedule.tgePercentage == 1000) {
            return schedule.totalAmount;
        }

        uint256 tgeAmount = (schedule.totalAmount * schedule.tgePercentage) / 1000;

        if (block.timestamp < schedule.startTime + schedule.cliffDuration) {
            return tgeAmount;
        }

        if (block.timestamp >= schedule.startTime + schedule.cliffDuration + schedule.vestingDuration) {
            return schedule.totalAmount;
        }

        uint256 timeFromStart = block.timestamp - (schedule.startTime + schedule.cliffDuration);
        uint256 vestingAmount = schedule.totalAmount - tgeAmount;
        uint256 vestedVestingAmount = (vestingAmount * timeFromStart) / schedule.vestingDuration;

        uint256 totalVested = tgeAmount + vestedVestingAmount;
        return totalVested > schedule.totalAmount ? schedule.totalAmount : totalVested;
    }

    function getReleasableAmount(address _beneficiary) external view returns (uint256) {
        return _getReleasableAmount(_beneficiary);
    }

    function _getReleasableAmount(address _beneficiary) private view returns (uint256) {
        VestingSchedule storage schedule = vestingSchedules[_beneficiary];
        if (!schedule.initialized) return 0;

        uint256 vested = getVestedAmount(_beneficiary);
        return vested > schedule.released ? vested - schedule.released : 0;
    }
}
