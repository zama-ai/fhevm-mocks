// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FhevmRepointVerify} from "../repoint/FhevmRepointVerify.s.sol";
import {FhevmUpgradeBase} from "./FhevmUpgradeBase.s.sol";
import {IWiredInputVerifier, IWiredProtocolConfig} from "../Interfaces.sol";

/**
 * @notice The upgrade's terminal conditions: the re-point engine's, plus what only this generation step
 *         changes — the KMS signer set, thresholds and coprocessors survived, and the live context was
 *         promoted into the epoch model with the sealed migration as its anchor.
 */
contract FhevmVerifyUpgrade is FhevmRepointVerify, FhevmUpgradeBase {
    function _verifyExtras(string memory manifest) internal override {
        _checkSurvivedValues(manifest);
        _checkKmsContextPromoted(manifest);
    }

    function _checkSurvivedValues(string memory manifest) private {
        IWiredProtocolConfig pc = IWiredProtocolConfig(_readManifestAddress(manifest, R_PROTOCOL_CONFIG));
        _expectSignerSet(
            pc.getKmsSigners(),
            vm.parseJsonAddressArray(manifest, ".preUpgrade.kmsSigners"),
            "ProtocolConfig.getKmsSigners() == the pre-upgrade KMS set"
        );
        (bool nodesMatch, string memory why) = _migrationNodesMatch(pc.getKmsNodesForContext(_migrationContextId()));
        _expect(
            nodesMatch,
            nodesMatch
                ? "ProtocolConfig.getKmsNodesForContext(contextId) == the sealed migration's stored node fields"
                : why
        );
        _expectUint(
            pc.getCurrentKmsContextId(),
            vm.parseUint(vm.parseJsonString(manifest, ".preUpgrade.migration.existingContextId")),
            "ProtocolConfig.getCurrentKmsContextId() == the pre-upgrade context id"
        );

        string memory t = ".preUpgrade.kmsThresholds.";
        _expectUint(
            pc.getPublicDecryptionThreshold(),
            vm.parseJsonUint(manifest, string.concat(t, "publicDecryption")),
            "publicDecryption threshold survived"
        );
        _expectUint(
            pc.getUserDecryptionThreshold(),
            vm.parseJsonUint(manifest, string.concat(t, "userDecryption")),
            "userDecryption threshold survived"
        );
        _expectUint(
            pc.getKmsGenThreshold(), vm.parseJsonUint(manifest, string.concat(t, "kmsGen")), "kmsGen threshold survived"
        );
        _expectUint(pc.getMpcThreshold(), vm.parseJsonUint(manifest, string.concat(t, "mpc")), "mpc threshold survived");

        IWiredInputVerifier iv = IWiredInputVerifier(_readManifestAddress(manifest, R_INPUT_VERIFIER));
        _expectSignerSet(
            iv.getCoprocessorSigners(),
            vm.parseJsonAddressArray(manifest, ".preUpgrade.coprocessorSigners"),
            "InputVerifier.getCoprocessorSigners() untouched"
        );
        _expectUint(
            iv.getThreshold(),
            vm.parseJsonUint(manifest, ".preUpgrade.coprocessorThreshold"),
            "InputVerifier.getThreshold() untouched"
        );
    }

    /**
     * @dev v14's intended change to the KMS state, and the one place the seal is bound to the chain.
     *
     *      `reinitializeV2` promotes the live context into the epoch model and anchors
     *      `keccak256(abi.encode(kmsNodeParams, thresholds, softwareVersion, pcrValues))`. The node
     *      metadata, software version and PCR values are readable no other way, so recomputing that hash
     *      from the SEALED migration and comparing is what proves the chain recorded what the operator
     *      reviewed at the gate — and nothing else.
     */
    function _checkKmsContextPromoted(string memory manifest) private {
        IWiredProtocolConfig pc = IWiredProtocolConfig(_readManifestAddress(manifest, R_PROTOCOL_CONFIG));
        uint256 sealedContextId = _migrationContextId();
        (uint256 contextId, uint256 epochId) = pc.getCurrentKmsContextAndEpoch();
        _expectUint(contextId, sealedContextId, "getCurrentKmsContextAndEpoch() reports the promoted context");
        _expect(epochId != 0, "getCurrentKmsContextAndEpoch() reports its first epoch");
        (uint256 emissionBlock, bytes32 contextInfoHash) = pc.getKmsContextAnchor(sealedContextId);
        _expect(emissionBlock != 0, "getKmsContextAnchor(contextId) was backfilled");
        _expect(
            contextInfoHash == _migrationContextInfoHash(),
            "getKmsContextAnchor(contextId).contextInfoHash == keccak256 of the sealed migration"
        );
    }
}
