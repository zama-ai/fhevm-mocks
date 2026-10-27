// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FhevmRepointBase} from "../repoint/FhevmRepointBase.s.sol";
import {UpgradeInitData} from "./UpgradeInitData.sol";
import {MaterializeInitData} from "../MaterializeInitData.sol";
import {LibForgeFhevmUpgrade} from "../../../pkg/forge/src/LibForgeFhevmUpgrade.sol";
import {IWiredProtocolConfig} from "../Interfaces.sol";

/**
 *  The V(N-1) -> V(N) CREATE2 upgrade, as the re-point engine runs it: the hooks of `FhevmRepointBase` overridden
 *  with this generation's table and its reinitializers.
 *
 *  Every script of the upgrade — compute, creates, precheck, materialize, verify — is the engine's script with
 *  these hooks, so a check and the operation it checks cannot disagree about what "the upgrade" is.
 *
 *  The table is upstream's rule applied to the two generations: a contract is upgraded exactly when its
 *  `REINITIALIZER_VERSION` moves, through a reinitializer that takes no arguments. Nothing is migrated.
 *
 *  Two contracts are new in this generation: `PaddedInputter` (RFC-030) and `ProtocolConfigReplica`. The upgrade creates
 *  their proxies over an empty implementation, exactly as a fresh deploy would (`_newProxyRoles`), and their ops
 *  initialize them from there. The replica is seeded from the live ProtocolConfig, sealed at compute.
 */
abstract contract FhevmUpgradeBase is FhevmRepointBase {
    /// @dev OpenZeppelin `Initializable`'s namespaced storage: the low 8 bytes are the proxy's initialized version.
    bytes32 private constant INITIALIZABLE_STORAGE = 0xf0c57e16840df040f15088dc2f81fe391c3923bec73e23a9662efc9c229c6a00;

    /// @dev The ops of the proxies the upgrade creates, in `_upgradeProxyRoles()`.
    uint256 private constant PADDED_INPUTTER_OP = 7;
    uint256 private constant PROTOCOL_CONFIG_REPLICA_OP = 8;

    /// @dev `ProtocolConfigReplica`'s `REINITIALIZER_VERSION`: `initializeFromCanonical` runs at it, from 1.
    uint64 private constant PROTOCOL_CONFIG_REPLICA_VERSION = 4;

    // ---------------------------------------------------------------------------------------
    // Roles
    // ---------------------------------------------------------------------------------------

    /**
     * Nine proxies re-pointed by the atomic upgrade, in ACLOwner.Op order — the order of upstream's
     * `upgrade-manifest.json`, then `CleartextArithmetic`, which is cleartext-only and so not in it: this generation changes
     * its bytecode (RFC-030 pad-based unmasking) and moves its reinitializer. Then `PaddedInputter` and
     * `ProtocolConfigReplica`, which v14 does not have: their proxies are created by this upgrade's `creates`, so
     * they are the ops on proxies that are not live yet when compute seals.
     */
    function _upgradeProxyRoles() internal pure returns (string[] memory roles) {
        roles = new string[](9);
        roles[0] = R_ACL;
        roles[1] = R_FHEVM_EXECUTOR;
        roles[2] = R_KMS_VERIFIER;
        roles[3] = R_INPUT_VERIFIER;
        roles[4] = R_PROTOCOL_CONFIG;
        roles[5] = R_KMS_GENERATION;
        roles[6] = R_CLEARTEXT_ARITHMETIC;
        roles[7] = R_PADDED_INPUTTER;
        roles[8] = R_PROTOCOL_CONFIG_REPLICA;
    }

    /// @dev The table's artifacts, index-aligned with `_upgradeProxyRoles()`: the deploy path's own, by role.
    function _upgradeImplArtifact(uint256 i) internal pure returns (string memory) {
        if (i == 0) return "pkg/src/cleartext/CleartextACL.sol:CleartextACL";
        if (i == 1) return "pkg/src/cleartext/CleartextFHEVMExecutor.sol:CleartextFHEVMExecutor";
        if (i == 2) return "pkg/src/cleartext/CleartextKMSVerifier.sol:CleartextKMSVerifier";
        if (i == 3) return "pkg/src/cleartext/CleartextInputVerifier.sol:CleartextInputVerifier";
        if (i == 4) return "pkg/src/contracts/ProtocolConfig.sol:ProtocolConfig";
        if (i == 5) return "pkg/src/contracts/KMSGeneration.sol:KMSGeneration";
        if (i == 6) return "pkg/src/cleartext/CleartextArithmetic.sol:CleartextArithmetic";
        if (i == 7) return "pkg/src/cleartext/CleartextPaddedInputter.sol:CleartextPaddedInputter";
        if (i == 8) return "pkg/src/contracts/ProtocolConfigReplica.sol:ProtocolConfigReplica";
        revert("FhevmUpgradeBase: implementation index out of range");
    }

    /// @dev The version each proxy is initialized at on a v14 stack: the reinitializer the upgrade starts from.
    ///      The created proxies' is their empty proxy's `initialize()`, as `creates` left them.
    function _upgradeFromVersion(uint256 i) internal pure returns (uint64) {
        if (i == 0) return 6;
        if (i == 1) return 7;
        if (i == 2) return 5;
        if (i == 3) return 3;
        if (i == 4) return 3;
        if (i == 5) return 3;
        if (i == 6) return 4;
        if (i == 7) return 1;
        if (i == 8) return 1;
        revert("FhevmUpgradeBase: version index out of range");
    }

    /// @dev The version each proxy is initialized at once upgraded: this generation's `REINITIALIZER_VERSION`. One step
    ///      for every op but the replica's, whose initializer jumps from its empty proxy's 1 to its own 4.
    function _upgradeToVersion(uint256 i) internal pure returns (uint64) {
        if (i == PROTOCOL_CONFIG_REPLICA_OP) return PROTOCOL_CONFIG_REPLICA_VERSION;
        return _upgradeFromVersion(i) + 1;
    }

    /// @dev The initialized version a live proxy reports, read from `Initializable`'s storage.
    function _initializedVersion(address proxy) internal view returns (uint64) {
        return uint64(uint256(vm.load(proxy, INITIALIZABLE_STORAGE)));
    }

    // ---------------------------------------------------------------------------------------
    // The engine's hooks
    // ---------------------------------------------------------------------------------------

    function _newProxyRoles() internal pure override returns (string[] memory roles) {
        roles = new string[](2);
        roles[0] = R_PADDED_INPUTTER;
        roles[1] = R_PROTOCOL_CONFIG_REPLICA;
    }

    function _flowName() internal pure override returns (string memory) {
        return "upgrade";
    }

    /// @dev The table, whatever the live stack runs: every one of the nine moves to this generation.
    function _candidateRoles() internal pure override returns (string[] memory) {
        return _upgradeProxyRoles();
    }

    function _keepRole(string memory, address) internal pure override returns (bool) {
        return true;
    }

    function _repointRoles() internal pure override returns (string[] memory) {
        return _upgradeProxyRoles();
    }

    /// @dev The two ops with arguments are sent only with what compute sealed: PaddedInputter's PRF instances, and
    ///      the replica's seed, which `_liveStateFresh` has already found unchanged on the live ProtocolConfig.
    function _initData(uint256 i, string memory) internal view override returns (bytes memory) {
        if (i == PADDED_INPUTTER_OP) {
            require(
                keccak256(abi.encode(_sealedPrfInstances()))
                    == keccak256(abi.encode(MaterializeInitData.paddedInputterPrfInstances())),
                "FhevmUpgradeBase: the PaddedInputter PRF instances moved since the seal"
            );
        }
        if (i == PROTOCOL_CONFIG_REPLICA_OP) {
            require(_replicaSeedFresh(), "FhevmUpgradeBase: the canonical ProtocolConfig moved since the seal");
            return _sealedReplicaSeed();
        }
        return UpgradeInitData.initData(i);
    }

    /**
     * @dev Sealed for the operator to read as values, and for materialize to send as sealed: PaddedInputter's PRF
     *      instances, and the replica's `initializeFromCanonical` payload, read from the live ProtocolConfig.
     */
    function _sealExtras(string memory o) internal override {
        uint16[] memory prfs = MaterializeInitData.paddedInputterPrfInstances();
        uint256[] memory values = new uint256[](prfs.length);
        for (uint256 i; i < prfs.length; i++) {
            values[i] = prfs[i];
        }
        vm.serializeUint(o, "paddedInputterPrfInstances", values);
        vm.serializeBytes(o, "protocolConfigReplicaInitData", _liveReplicaSeed());
        // The payload's context and epoch, as values: what the op listing names.
        (uint256 contextId, uint256 epochId) =
            IWiredProtocolConfig(existingProtocolConfig).getCurrentKmsContextAndEpoch();
        vm.serializeUint(o, "protocolConfigReplicaContextId", contextId);
        vm.serializeUint(o, "protocolConfigReplicaEpochId", epochId);
    }

    /// @dev The replica's seed as the live canonical ProtocolConfig gives it now: its current context and epoch.
    function _liveReplicaSeed() private view returns (bytes memory) {
        return LibForgeFhevmUpgrade.protocolConfigReplicaInitData(existingProtocolConfig);
    }

    function _sealedReplicaSeed() private view returns (bytes memory) {
        return vm.parseJsonBytes(_loadManifest(), ".protocolConfigReplicaInitData");
    }

    /// @dev A KMS context or epoch change between compute and materialize would seed the replica with a stale set.
    function _replicaSeedFresh() private view returns (bool) {
        return keccak256(_liveReplicaSeed()) == keccak256(_sealedReplicaSeed());
    }

    function _sealedPrfInstances() private view returns (uint16[] memory prfs) {
        uint256[] memory values = vm.parseJsonUintArray(_loadManifest(), ".paddedInputterPrfInstances");
        prfs = new uint16[](values.length);
        for (uint256 i; i < values.length; i++) {
            prfs[i] = uint16(values[i]);
        }
    }

    function _initName(uint256 i, string memory) internal view override returns (string memory) {
        if (i == PROTOCOL_CONFIG_REPLICA_OP) {
            string memory manifest = _loadManifest();
            return string.concat(
                "ProtocolConfigReplica.initializeFromCanonical(context ",
                vm.toString(vm.parseJsonUint(manifest, ".protocolConfigReplicaContextId")),
                ", epoch ",
                vm.toString(vm.parseJsonUint(manifest, ".protocolConfigReplicaEpochId")),
                ", the sealed nodes and thresholds)"
            );
        }
        return UpgradeInitData.initName(i);
    }

    /// @dev Every proxy is still initialized at its v14 version: a v14 stack, and not upgraded yet. The created
    ///      proxies at their empty proxy's: created, and not initialized by anyone else since. And the canonical
    ///      ProtocolConfig still holds the KMS context the replica's seed was sealed from.
    function _liveStateFresh() internal view override returns (bool ok, string memory why) {
        if (!_replicaSeedFresh()) {
            return
                (false, "the canonical ProtocolConfig's KMS context, epoch, nodes or thresholds moved since the seal");
        }
        string[] memory roles = _upgradeProxyRoles();
        for (uint256 i; i < roles.length; i++) {
            uint64 live = _initializedVersion(_existingAddress(roles[i]));
            if (live != _upgradeFromVersion(i)) {
                return (
                    false,
                    string.concat(
                        roles[i],
                        " is initialized at ",
                        vm.toString(uint256(live)),
                        ", not at its v14 version ",
                        vm.toString(uint256(_upgradeFromVersion(i)))
                    )
                );
            }
        }
        return (true, "every proxy is initialized at its v14 version, and the replica's seed is current");
    }
}
