// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockWormhole {
    event MessagePublished(
        address indexed sender,
        uint32 nonce,
        bytes payload,
        uint8 consistencyLevel
    );

    function publishMessage(
        uint32 nonce,
        bytes memory payload,
        uint8 consistencyLevel
    ) external payable returns (uint64) {
        emit MessagePublished(msg.sender, nonce, payload, consistencyLevel);
        return 1; // Return dummy sequence number
    }
}
