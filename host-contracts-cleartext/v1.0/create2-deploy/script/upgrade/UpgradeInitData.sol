// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {ACL} from "../../../pkg/src/contracts/ACL.sol";
import {FHEVMExecutor} from "../../../pkg/src/contracts/FHEVMExecutor.sol";
import {KMSVerifier} from "../../../pkg/src/contracts/KMSVerifier.sol";
import {InputVerifier} from "../../../pkg/src/contracts/InputVerifier.sol";
import {ProtocolConfig} from "../../../pkg/src/contracts/ProtocolConfig.sol";
import {KMSGeneration} from "../../../pkg/src/contracts/KMSGeneration.sol";
import {CleartextArithmetic} from "../../../pkg/src/cleartext/CleartextArithmetic.sol";
import {MaterializeInitData} from "../MaterializeInitData.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/**
 *  Index-aligned initializer payloads for FhevmUpgradeBase._upgradeProxyRoles().
 *
 *  The first seven take no arguments: V(N-1) -> V(N) moves each reinitializer by one and migrates nothing. The
 *  eighth initializes the PaddedInputter proxy the upgrade creates, with the deploy's own payload — the PRF
 *  instances it registers are bootstrap config, as on a fresh stack. The ninth op, the ProtocolConfigReplica the
 *  upgrade also creates, is not here: its seed is the live ProtocolConfig's state, read and sealed at compute by
 *  `FhevmUpgradeBase`, not a constant. Where the implementation deployed is a cleartext subclass, the payload is
 *  encoded against the base contract, which declares the function — solc cannot form a pointer to an inherited
 *  member. Same selector.
 */
library UpgradeInitData {
    function initData(uint256 i) internal pure returns (bytes memory) {
        if (i == 0) return abi.encodeCall(ACL.reinitializeV6, ());
        if (i == 1) return abi.encodeCall(FHEVMExecutor.reinitializeV7, ());
        if (i == 2) return abi.encodeCall(KMSVerifier.reinitializeV5, ());
        if (i == 3) return abi.encodeCall(InputVerifier.reinitializeV3, ());
        if (i == 4) return abi.encodeCall(ProtocolConfig.reinitializeV3, ());
        if (i == 5) return abi.encodeCall(KMSGeneration.reinitializeV3, ());
        if (i == 6) return abi.encodeCall(CleartextArithmetic.reinitializeV4, ());
        if (i == 7) return MaterializeInitData.paddedInputter();
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
        if (i == 6) return "CleartextArithmetic.reinitializeV4()";
        if (i == 7) {
            return string.concat("PaddedInputter.initializeFromEmptyProxy([", _prfList(), "])");
        }
        revert("UpgradeInitData: index out of range");
    }

    /// @dev The PRF instances op 7 registers, comma-separated, so the op listing shows values, not hex.
    function _prfList() private pure returns (string memory list) {
        uint16[] memory prfs = MaterializeInitData.paddedInputterPrfInstances();
        for (uint256 i; i < prfs.length; i++) {
            list = string.concat(list, i == 0 ? "" : ",", Strings.toString(prfs[i]));
        }
    }
}
