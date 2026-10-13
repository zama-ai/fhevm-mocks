// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FhevmCreate2Base} from "../FhevmCreate2Base.s.sol";
import {IACLOwner} from "../Interfaces.sol";
import {LocalHostVersions} from "../../../pkg/forge/src/_internal/LocalHostVersions.sol";

/**
 *  The re-point engine's forge side: what every script that re-points a live stack's proxies shares, whatever
 *  generation it runs on and whatever it re-points — a generation upgrade (`script/upgrade/`, deleted at every
 *  rotation) or a hotfix. Generation-agnostic, and outside `upgrade/` for that reason.
 *
 *  A flow plugs in through the hooks below, implemented by its own base: the upgrade's (`script/upgrade/`) with
 *  its table, its reinitializers and its migration; the hotfix's (`script/hotfix/`) with every proxy as a
 *  candidate, kept when this build's implementation differs from the live one, and no init data. The generic
 *  scripts in this folder are abstract; a flow's concrete script is one of them plus its base.
 */
abstract contract FhevmRepointBase is FhevmCreate2Base {
    address internal existingAcl;
    address internal existingExecutor;
    address internal existingKmsVerifier;
    address internal existingInputVerifier;
    address internal existingHcuLimit;
    address internal existingProtocolConfig;
    address internal existingKmsGeneration;
    address internal existingArithmetic;
    address internal existingDb;
    address internal existingPauserSet;
    address internal existingAclOwner;

    function _loadUpgradeConfig() internal {
        _loadConfig();
        existingAcl = vm.envAddress("FHEVM_EXISTING_ACL_ADDRESS");
        existingExecutor = vm.envAddress("FHEVM_EXISTING_FHEVM_EXECUTOR_ADDRESS");
        existingKmsVerifier = vm.envAddress("FHEVM_EXISTING_KMS_VERIFIER_ADDRESS");
        existingInputVerifier = vm.envAddress("FHEVM_EXISTING_INPUT_VERIFIER_ADDRESS");
        existingHcuLimit = vm.envAddress("FHEVM_EXISTING_HCU_LIMIT_ADDRESS");
        existingProtocolConfig = vm.envAddress("FHEVM_EXISTING_PROTOCOL_CONFIG_ADDRESS");
        existingKmsGeneration = vm.envAddress("FHEVM_EXISTING_KMS_GENERATION_ADDRESS");
        existingArithmetic = vm.envAddress("FHEVM_EXISTING_CLEARTEXT_ARITHMETIC_ADDRESS");
        existingDb = vm.envAddress("FHEVM_EXISTING_CLEARTEXT_DB_ADDRESS");
        existingPauserSet = vm.envAddress("FHEVM_EXISTING_PAUSER_SET_ADDRESS");
        existingAclOwner = vm.envAddress("FHEVM_EXISTING_ACL_OWNER");
    }

    // ---------------------------------------------------------------------------------------
    // Hooks: each flow implements them in its own base (script/upgrade/, script/hotfix/)
    // ---------------------------------------------------------------------------------------

    /// @dev The flow's name in messages: `upgrade`, `hotfix`.
    function _flowName() internal pure virtual returns (string memory);

    /// @dev The proxies `compute` considers, in op order.
    function _candidateRoles() internal view virtual returns (string[] memory);

    /// @dev Whether `compute` re-points `role` to `implementation`.
    function _keepRole(string memory role, address implementation) internal view virtual returns (bool);

    /// @dev The proxies re-pointed, in op order, once sealed.
    function _repointRoles() internal view virtual returns (string[] memory);

    /// @dev Op `i`'s init data, for `role`.
    function _initData(uint256 i, string memory role) internal view virtual returns (bytes memory);

    /// @dev What op `i` calls, for the gate's op listing.
    function _initName(uint256 i, string memory role) internal view virtual returns (string memory);

    /// @dev Is the live stack still what the seal planned the payload for, beyond the slots? `why` says what was
    ///      checked when it is, and what moved when it is not.
    function _liveStateFresh() internal view virtual returns (bool ok, string memory why);

    // ---------------------------------------------------------------------------------------
    // Roles
    // ---------------------------------------------------------------------------------------

    /// @dev The proxies the op list must NOT touch: every proxy that is not re-pointed.
    function _untouchedProxyRoles() internal view returns (string[] memory roles) {
        string[] memory all = _allProxyRoles();
        string[] memory ops = _repointRoles();
        roles = new string[](all.length - ops.length);
        uint256 n;
        for (uint256 i; i < all.length; i++) {
            if (!_contains(ops, all[i])) roles[n++] = all[i];
        }
        require(n == roles.length, "FhevmRepointBase: the re-pointed roles are not all proxies");
    }

    function _contains(string[] memory list, string memory item) internal pure returns (bool) {
        bytes32 key = keccak256(bytes(item));
        for (uint256 i; i < list.length; i++) {
            if (keccak256(bytes(list[i])) == key) return true;
        }
        return false;
    }

    /// @dev This generation's implementation artifact for a proxy role: the deploy path's own table.
    function _implArtifactFor(string memory role) internal pure returns (string memory) {
        string[] memory all = _allProxyRoles();
        bytes32 key = keccak256(bytes(role));
        for (uint256 i; i < all.length; i++) {
            if (keccak256(bytes(all[i])) == key) return _implArtifact(i);
        }
        revert(string.concat("FhevmRepointBase: not a proxy role: ", role));
    }

    /**
     * @dev The `getVersion()` string a proxy role must report once it runs this generation's code. Read
     *      from the generated `LocalHostVersions`, never a literal. Called on an IMPLEMENTATION address it
     *      says which contract that implementation is — `getVersion` is pure, so no proxy is needed.
     */
    function _versionFor(string memory role) internal pure returns (string memory) {
        bytes32 key = keccak256(bytes(role));
        if (key == keccak256(bytes(R_ACL))) return LocalHostVersions.ACL;
        if (key == keccak256(bytes(R_FHEVM_EXECUTOR))) return LocalHostVersions.FHEVM_EXECUTOR;
        if (key == keccak256(bytes(R_HCU_LIMIT))) return LocalHostVersions.HCU_LIMIT;
        if (key == keccak256(bytes(R_KMS_VERIFIER))) return LocalHostVersions.KMS_VERIFIER;
        if (key == keccak256(bytes(R_CLEARTEXT_ARITHMETIC))) return LocalHostVersions.CLEARTEXT_ARITHMETIC;
        if (key == keccak256(bytes(R_PROTOCOL_CONFIG))) return LocalHostVersions.PROTOCOL_CONFIG;
        if (key == keccak256(bytes(R_KMS_GENERATION))) return LocalHostVersions.KMS_GENERATION;
        if (key == keccak256(bytes(R_INPUT_VERIFIER))) return LocalHostVersions.INPUT_VERIFIER;
        if (key == keccak256(bytes(R_CLEARTEXT_DB))) return LocalHostVersions.CLEARTEXT_DB;
        if (key == keccak256(bytes(R_PAUSER_SET))) return LocalHostVersions.PAUSER_SET;
        revert("FhevmRepointBase: no version for role");
    }

    function _existingAddress(string memory role) internal view returns (address) {
        bytes32 key = keccak256(bytes(role));
        if (key == keccak256(bytes(R_ACL))) return existingAcl;
        if (key == keccak256(bytes(R_FHEVM_EXECUTOR))) return existingExecutor;
        if (key == keccak256(bytes(R_KMS_VERIFIER))) return existingKmsVerifier;
        if (key == keccak256(bytes(R_INPUT_VERIFIER))) return existingInputVerifier;
        if (key == keccak256(bytes(R_HCU_LIMIT))) return existingHcuLimit;
        if (key == keccak256(bytes(R_PROTOCOL_CONFIG))) return existingProtocolConfig;
        if (key == keccak256(bytes(R_KMS_GENERATION))) return existingKmsGeneration;
        if (key == keccak256(bytes(R_CLEARTEXT_ARITHMETIC))) return existingArithmetic;
        if (key == keccak256(bytes(R_CLEARTEXT_DB))) return existingDb;
        if (key == keccak256(bytes(R_PAUSER_SET))) return existingPauserSet;
        if (key == keccak256(bytes(R_ACL_OWNER))) return existingAclOwner;
        revert("FhevmRepointBase: unknown existing role");
    }

    // ---------------------------------------------------------------------------------------
    // The creates: one implementation per op
    // ---------------------------------------------------------------------------------------

    /// @dev One create with the artifact it was built from, so a check can ask the artifact what the
    ///      chain should hold. `Create` (role, initCode) is what the deploy path's loop consumes.
    struct UpgradeCreate {
        string role;
        string artifact;
        bytes initCode;
    }

    /// @dev The permissionless CREATE2 operations, one implementation per op, each with its artifact.
    function _upgradeCreateTable() internal view returns (UpgradeCreate[] memory t) {
        string[] memory roles = _repointRoles();
        t = new UpgradeCreate[](roles.length);
        for (uint256 i; i < roles.length; i++) {
            string memory artifact = _implArtifactFor(roles[i]);
            t[i] = UpgradeCreate(_implRole(roles[i]), artifact, _initCode(artifact));
        }
    }

    function _upgradeCreates() internal view returns (Create[] memory creates) {
        UpgradeCreate[] memory t = _upgradeCreateTable();
        creates = new Create[](t.length);
        for (uint256 i; i < t.length; i++) {
            creates[i] = Create(t[i].role, t[i].initCode);
        }
    }

    // ---------------------------------------------------------------------------------------
    // The state the seal recorded
    // ---------------------------------------------------------------------------------------

    /// @dev The implementation a live proxy ran when `compute` sealed, from `.preUpgrade.implementation`.
    function _sealedPreviousImplementation(string memory manifest, string memory role) internal pure returns (address) {
        return vm.parseJsonAddress(manifest, string.concat(".preUpgrade.implementation.", role));
    }

    /**
     * @dev Does the code at `a` equal the artifact's deployed bytecode, allowing only the UUPS `__self`
     *      immutable to differ: 32 zero bytes in the artifact, `a` itself on chain. Anything else — a stale
     *      build, another contract, a patched byte — is a mismatch.
     */
    function _matchesDeployedCode(address a, string memory artifact) internal view returns (bool) {
        bytes memory want = vm.getDeployedCode(artifact);
        bytes memory got = a.code;
        if (want.length == 0 || got.length != want.length) return false;

        bytes32 self = bytes32(uint256(uint160(a)));
        uint256 firstNonZero;
        while (firstNonZero < 32 && self[firstNonZero] == 0) firstNonZero++;

        for (uint256 i; i < want.length; i++) {
            if (got[i] == want[i]) continue;
            // The first differing byte is the address's first non-zero byte; the window starts before it.
            if (i < firstNonZero || i - firstNonZero + 32 > want.length) return false;
            uint256 start = i - firstNonZero;
            for (uint256 j; j < 32; j++) {
                if (want[start + j] != 0 || got[start + j] != self[j]) return false;
            }
            i = start + 31;
        }
        return true;
    }

    // ---------------------------------------------------------------------------------------
    // The ops
    // ---------------------------------------------------------------------------------------

    function _ops(string memory manifest) internal view returns (IACLOwner.Op[] memory ops) {
        string[] memory roles = _repointRoles();
        ops = new IACLOwner.Op[](roles.length);
        for (uint256 i; i < roles.length; i++) {
            ops[i] = IACLOwner.Op({
                proxy: _readManifestAddress(manifest, roles[i]),
                implementation: _readManifestAddress(manifest, _implRole(roles[i])),
                initData: _initData(i, roles[i])
            });
        }
    }

    /// @dev The exact `ACLOwner.upgrade` payload, whether sent by a key here or by a multisig elsewhere.
    function _upgradeCalldata(string memory manifest) internal view returns (bytes memory) {
        return abi.encodeCall(IACLOwner.upgrade, (_ops(manifest)));
    }
}
