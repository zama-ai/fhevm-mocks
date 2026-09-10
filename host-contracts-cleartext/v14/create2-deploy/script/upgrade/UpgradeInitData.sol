// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {ACL} from "../../../pkg/src/contracts/ACL.sol";
import {FHEVMExecutor} from "../../../pkg/src/contracts/FHEVMExecutor.sol";
import {HCULimit} from "../../../pkg/src/contracts/HCULimit.sol";
import {KMSVerifier} from "../../../pkg/src/contracts/KMSVerifier.sol";
import {KMSGeneration} from "../../../pkg/src/contracts/KMSGeneration.sol";
import {CleartextArithmetic} from "../../../pkg/src/cleartext/CleartextArithmetic.sol";

/**
 *  Index-aligned initializer payloads for FhevmUpgradeBase._upgradeProxyRoles().
 */
library UpgradeInitData {
    function initData(uint256 i, bytes memory protocolConfigInit) internal pure returns (bytes memory) {
        if (i == 0) return protocolConfigInit;
        if (i == 1) return abi.encodeCall(KMSGeneration.reinitializeV2, ());
        if (i == 2) return abi.encodeCall(ACL.reinitializeV5, ());
        if (i == 3) return abi.encodeCall(FHEVMExecutor.reinitializeV5, ());
        if (i == 4) return abi.encodeCall(HCULimit.reinitializeV4, ());
        if (i == 5) return abi.encodeCall(KMSVerifier.reinitializeV4, ());
        if (i == 6) return abi.encodeCall(CleartextArithmetic.reinitializeV3, ());
        revert("UpgradeInitData: index out of range");
    }

    /// @dev The human-readable name of each payload above, index-aligned, for the gate's op listing.
    function initName(uint256 i) internal pure returns (string memory) {
        if (i == 0) {
            return "ProtocolConfig.reinitializeV2(kmsNodeParams, softwareVersion, pcrValues)";
        }
        if (i == 1) return "KMSGeneration.reinitializeV2()";
        if (i == 2) return "ACL.reinitializeV5()";
        if (i == 3) return "FHEVMExecutor.reinitializeV5()";
        if (i == 4) return "HCULimit.reinitializeV4()";
        if (i == 5) return "KMSVerifier.reinitializeV4()";
        if (i == 6) return "CleartextArithmetic.reinitializeV3()";
        revert("UpgradeInitData: index out of range");
    }
}
