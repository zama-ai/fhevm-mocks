// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FhevmRepointBase} from "../repoint/FhevmRepointBase.s.sol";
import {UpgradeInitData} from "./UpgradeInitData.sol";
import {MaterializeInitData} from "../MaterializeInitData.sol";

/**
 *  The v14 -> v15 CREATE2 upgrade, as the re-point engine runs it: the hooks of `FhevmRepointBase` overridden
 *  with this generation's table and its reinitializers.
 *
 *  Every script of the upgrade — compute, creates, precheck, materialize, verify — is the engine's script with
 *  these hooks, so a check and the operation it checks cannot disagree about what "the upgrade" is.
 *
 *  The table is upstream's rule applied to the two generations: a contract is upgraded exactly when its
 *  `REINITIALIZER_VERSION` moves, through a reinitializer that takes no arguments. Nothing is migrated.
 *
 *  One contract is new in v15: `PaddedInputter` (RFC-030). The upgrade creates its proxy over an empty
 *  implementation, exactly as a fresh deploy would (`_newProxyRoles`), and its op initializes it from there.
 */
abstract contract FhevmUpgradeBase is FhevmRepointBase {
    /// @dev OpenZeppelin `Initializable`'s namespaced storage: the low 8 bytes are the proxy's initialized version.
    bytes32 private constant INITIALIZABLE_STORAGE = 0xf0c57e16840df040f15088dc2f81fe391c3923bec73e23a9662efc9c229c6a00;

    /// @dev The op of the proxy the upgrade creates, in `_upgradeProxyRoles()`.
    uint256 private constant PADDED_INPUTTER_OP = 7;

    // ---------------------------------------------------------------------------------------
    // Roles
    // ---------------------------------------------------------------------------------------

    /**
     * Eight proxies re-pointed by the atomic upgrade, in ACLOwner.Op order — the order of upstream's
     * `upgrade-manifest.json`, then `CleartextArithmetic`, which is cleartext-only and so not in it: v15 changes
     * its bytecode (RFC-030 pad-based unmasking) and moves its reinitializer. Then `PaddedInputter`, which v14
     * does not have: its proxy is created by this upgrade's `creates`, so it is the one op on a proxy that is
     * not live yet when compute seals.
     */
    function _upgradeProxyRoles() internal pure returns (string[] memory roles) {
        roles = new string[](8);
        roles[0] = R_ACL;
        roles[1] = R_FHEVM_EXECUTOR;
        roles[2] = R_KMS_VERIFIER;
        roles[3] = R_INPUT_VERIFIER;
        roles[4] = R_PROTOCOL_CONFIG;
        roles[5] = R_KMS_GENERATION;
        roles[6] = R_CLEARTEXT_ARITHMETIC;
        roles[7] = R_PADDED_INPUTTER;
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
        revert("FhevmUpgradeBase: implementation index out of range");
    }

    /// @dev The version each proxy is initialized at on a v14 stack: the reinitializer the upgrade starts from.
    ///      PaddedInputter's is its empty proxy's `initialize()`, as `creates` left it.
    function _upgradeFromVersion(uint256 i) internal pure returns (uint64) {
        if (i == 0) return 6;
        if (i == 1) return 7;
        if (i == 2) return 5;
        if (i == 3) return 3;
        if (i == 4) return 3;
        if (i == 5) return 3;
        if (i == 6) return 4;
        if (i == 7) return 1;
        revert("FhevmUpgradeBase: version index out of range");
    }

    /// @dev The version each proxy is initialized at once upgraded: the v15 `REINITIALIZER_VERSION`.
    function _upgradeToVersion(uint256 i) internal pure returns (uint64) {
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
        roles = new string[](1);
        roles[0] = R_PADDED_INPUTTER;
    }

    function _flowName() internal pure override returns (string memory) {
        return "upgrade";
    }

    /// @dev The table, whatever the live stack runs: every one of the eight moves to this generation.
    function _candidateRoles() internal pure override returns (string[] memory) {
        return _upgradeProxyRoles();
    }

    function _keepRole(string memory, address) internal pure override returns (bool) {
        return true;
    }

    function _repointRoles() internal pure override returns (string[] memory) {
        return _upgradeProxyRoles();
    }

    /// @dev The one op with arguments, PaddedInputter's, is sent only with the PRF instances compute sealed.
    function _initData(uint256 i, string memory) internal view override returns (bytes memory) {
        if (i == PADDED_INPUTTER_OP) {
            require(
                keccak256(abi.encode(_sealedPrfInstances()))
                    == keccak256(abi.encode(MaterializeInitData.paddedInputterPrfInstances())),
                "FhevmUpgradeBase: the PaddedInputter PRF instances moved since the seal"
            );
        }
        return UpgradeInitData.initData(i);
    }

    /// @dev The PRF instances PaddedInputter is initialized with, sealed for the operator to read as values.
    function _sealExtras(string memory o) internal override {
        uint16[] memory prfs = MaterializeInitData.paddedInputterPrfInstances();
        uint256[] memory values = new uint256[](prfs.length);
        for (uint256 i; i < prfs.length; i++) {
            values[i] = prfs[i];
        }
        vm.serializeUint(o, "paddedInputterPrfInstances", values);
    }

    function _sealedPrfInstances() private view returns (uint16[] memory prfs) {
        uint256[] memory values = vm.parseJsonUintArray(_loadManifest(), ".paddedInputterPrfInstances");
        prfs = new uint16[](values.length);
        for (uint256 i; i < values.length; i++) {
            prfs[i] = uint16(values[i]);
        }
    }

    function _initName(uint256 i, string memory) internal pure override returns (string memory) {
        return UpgradeInitData.initName(i);
    }

    /// @dev Every proxy is still initialized at its v14 version: a v14 stack, and not upgraded yet. The created
    ///      PaddedInputter at its empty proxy's: created, and not initialized by anyone else since.
    function _liveStateFresh() internal view override returns (bool ok, string memory why) {
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
        return (true, "every proxy is initialized at its v14 version");
    }
}
