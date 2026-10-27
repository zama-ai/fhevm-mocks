// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FhevmRepointVerify} from "../repoint/FhevmRepointVerify.s.sol";
import {FhevmUpgradeBase} from "./FhevmUpgradeBase.s.sol";
import {IWiredInputVerifier, IWiredProtocolConfig} from "../Interfaces.sol";

/**
 * @notice The upgrade's terminal conditions: the re-point engine's, plus what only this generation step
 *         can get wrong — every proxy took its reinitializer, the KMS and coprocessor state it migrates
 *         nothing of came through unchanged, and the ProtocolConfigReplica it creates was seeded with that state.
 */
contract FhevmVerifyUpgrade is FhevmRepointVerify, FhevmUpgradeBase {
    function _verifyExtras(string memory manifest) internal override {
        _checkReinitialized(manifest);
        _checkSurvivedValues(manifest);
        _checkReplicaSeeded(manifest);
    }

    /// @dev Each proxy is initialized at this generation's version: the reinitializer ran, exactly once.
    function _checkReinitialized(string memory manifest) private {
        string[] memory roles = _upgradeProxyRoles();
        for (uint256 i; i < roles.length; i++) {
            _expectUint(
                uint256(_initializedVersion(_readManifestAddress(manifest, roles[i]))),
                uint256(_upgradeToVersion(i)),
                string.concat(
                    _initName(i, roles[i]), " ran: ", roles[i], " is initialized at this generation's version"
                )
            );
        }
    }

    /// @dev No reinitializer touches the KMS or coprocessor state, so all of it must read as before.
    function _checkSurvivedValues(string memory manifest) private {
        IWiredProtocolConfig pc = IWiredProtocolConfig(_readManifestAddress(manifest, R_PROTOCOL_CONFIG));
        _expectSignerSet(
            pc.getKmsSigners(),
            vm.parseJsonAddressArray(manifest, ".preUpgrade.kmsSigners"),
            "ProtocolConfig.getKmsSigners() == the pre-upgrade KMS set"
        );
        (uint256 contextId, uint256 epochId) = pc.getCurrentKmsContextAndEpoch();
        _expectUint(
            contextId,
            vm.parseJsonUint(manifest, ".preUpgrade.kmsContextId"),
            "ProtocolConfig.getCurrentKmsContextAndEpoch().contextId == the pre-upgrade context"
        );
        _expectUint(
            epochId,
            vm.parseJsonUint(manifest, ".preUpgrade.kmsEpochId"),
            "ProtocolConfig.getCurrentKmsContextAndEpoch().epochId == the pre-upgrade epoch"
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

    /// @dev The replica the upgrade created answers what ProtocolConfig answered before it: same context and
    ///      epoch, same signers, same thresholds. Its seed was sealed from that state and refused if it moved.
    function _checkReplicaSeeded(string memory manifest) private {
        IWiredProtocolConfig replica = IWiredProtocolConfig(_readManifestAddress(manifest, R_PROTOCOL_CONFIG_REPLICA));
        (uint256 contextId, uint256 epochId) = replica.getCurrentKmsContextAndEpoch();
        _expectUint(
            contextId,
            vm.parseJsonUint(manifest, ".preUpgrade.kmsContextId"),
            "ProtocolConfigReplica context == the pre-upgrade context"
        );
        _expectUint(
            epochId,
            vm.parseJsonUint(manifest, ".preUpgrade.kmsEpochId"),
            "ProtocolConfigReplica epoch == the pre-upgrade epoch"
        );
        _expectSignerSet(
            replica.getKmsSigners(),
            vm.parseJsonAddressArray(manifest, ".preUpgrade.kmsSigners"),
            "ProtocolConfigReplica.getKmsSigners() == the pre-upgrade KMS set"
        );
        string memory t = ".preUpgrade.kmsThresholds.";
        _expectUint(
            replica.getPublicDecryptionThreshold(),
            vm.parseJsonUint(manifest, string.concat(t, "publicDecryption")),
            "ProtocolConfigReplica publicDecryption threshold"
        );
        _expectUint(
            replica.getUserDecryptionThreshold(),
            vm.parseJsonUint(manifest, string.concat(t, "userDecryption")),
            "ProtocolConfigReplica userDecryption threshold"
        );
        _expectUint(
            replica.getKmsGenThreshold(),
            vm.parseJsonUint(manifest, string.concat(t, "kmsGen")),
            "ProtocolConfigReplica kmsGen threshold"
        );
        _expectUint(
            replica.getMpcThreshold(),
            vm.parseJsonUint(manifest, string.concat(t, "mpc")),
            "ProtocolConfigReplica mpc threshold"
        );
    }
}
