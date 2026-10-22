// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {ACL} from "../../../pkg/src/contracts/ACL.sol";
import {FHEVMExecutor} from "../../../pkg/src/contracts/FHEVMExecutor.sol";
import {KMSVerifier} from "../../../pkg/src/contracts/KMSVerifier.sol";
import {InputVerifier} from "../../../pkg/src/contracts/InputVerifier.sol";
import {ProtocolConfig} from "../../../pkg/src/contracts/ProtocolConfig.sol";
import {KMSGeneration} from "../../../pkg/src/contracts/KMSGeneration.sol";

/**
 *  Index-aligned initializer payloads for FhevmUpgradeBase._upgradeProxyRoles().
 *
 *  None takes arguments: v14 -> v15 moves each reinitializer by one and migrates nothing. Where the
 *  implementation deployed is a cleartext subclass, the payload is encoded against the base contract,
 *  which declares the function — solc cannot form a pointer to an inherited member. Same selector.
 */
library UpgradeInitData {
    function initData(uint256 i) internal pure returns (bytes memory) {
        if (i == 0) return abi.encodeCall(ACL.reinitializeV6, ());
        if (i == 1) return abi.encodeCall(FHEVMExecutor.reinitializeV7, ());
        if (i == 2) return abi.encodeCall(KMSVerifier.reinitializeV5, ());
        if (i == 3) return abi.encodeCall(InputVerifier.reinitializeV3, ());
        if (i == 4) return abi.encodeCall(ProtocolConfig.reinitializeV3, ());
        if (i == 5) return abi.encodeCall(KMSGeneration.reinitializeV3, ());
        revert("UpgradeInitData: index out of range");
    }

    /// @dev The human-readable name of each payload above, index-aligned, for the gate's op listing.
    function initName(uint256 i) internal pure returns (string memory) {
        if (i == 0) return "ACL.reinitializeV6()";
        if (i == 1) return "FHEVMExecutor.reinitializeV7()";
        if (i == 2) return "KMSVerifier.reinitializeV5()";
        if (i == 3) return "InputVerifier.reinitializeV3()";
        if (i == 4) return "ProtocolConfig.reinitializeV3()";
        if (i == 5) return "KMSGeneration.reinitializeV3()";
        revert("UpgradeInitData: index out of range");
    }
}
