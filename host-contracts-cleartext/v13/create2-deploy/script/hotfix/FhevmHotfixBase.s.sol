// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FhevmRepointBase} from "../repoint/FhevmRepointBase.s.sol";

/**
 *  A hotfix, as the re-point engine runs it: within one generation, re-point exactly the proxies whose live
 *  implementation's code differs from this build's. Nothing else moves — no
 *  proxy, no owner, no pauser. A contract whose reinitializer moved by exactly one gets its no-argument
 *  `reinitializeV<live>()` called in its op, as the coordinator sealed it (`.reinitialize`); any other change of
 *  reinitializer is refused before anything is sealed (create2-deploy/ts/hotfix.ts).
 *
 *  Outside `script/upgrade/` on purpose: a generation's hotfixes outlive the rotation that deletes that folder.
 */
abstract contract FhevmHotfixBase is FhevmRepointBase {
    function _flowName() internal pure override returns (string memory) {
        return "hotfix";
    }

    /// @dev Every proxy is a candidate: what changed is decided by the bytecode, not by a table.
    function _candidateRoles() internal pure override returns (string[] memory) {
        return _allProxyRoles();
    }

    /**
     * @dev Re-pointed when the live implementation's CODE is not this build's — compared by code, never by
     *      address. A CREATE2 address also hashes the salt, which carries the generation: a proxy a generation
     *      upgrade left alone still runs the previous generation's implementation, the same code at another
     *      address, and must not count as changed.
     */
    function _keepRole(string memory role, address) internal view override returns (bool) {
        return !_matchesDeployedCode(_implementationOf(_existingAddress(role)), _implArtifactFor(role));
    }

    /// @dev What compute sealed.
    function _repointRoles() internal view override returns (string[] memory) {
        return vm.parseJsonStringArray(_loadManifest(), ".repointed");
    }

    /// @dev OpenZeppelin `Initializable`'s namespaced storage: the low 8 bytes are the initialized version.
    bytes32 private constant INITIALIZABLE_STORAGE = 0xf0c57e16840df040f15088dc2f81fe391c3923bec73e23a9662efc9c229c6a00;

    /// @dev The reinitializer the coordinator sealed for `role` (`.reinitialize.<role>`), if any.
    function _sealedReinitializer(string memory role)
        private
        view
        returns (bool found, string memory call, uint256 from)
    {
        string memory manifest = _loadManifest();
        string memory key = string.concat(".reinitialize.", role);
        if (!vm.keyExistsJson(manifest, key)) return (false, "", 0);
        return (
            true,
            vm.parseJsonString(manifest, string.concat(key, ".call")),
            vm.parseJsonUint(manifest, string.concat(key, ".from"))
        );
    }

    /// @dev A plain re-point, or the contract's no-argument `reinitializeV<live>()` when its reinitializer moved by one.
    function _initData(uint256, string memory role) internal view override returns (bytes memory) {
        (bool found, string memory call,) = _sealedReinitializer(role);
        return found ? abi.encodeWithSignature(call) : bytes("");
    }

    function _initName(uint256, string memory role) internal view override returns (string memory) {
        (bool found, string memory call,) = _sealedReinitializer(role);
        return found ? call : "(no call: a plain re-point)";
    }

    /// @dev Every sealed reinitializer still starts from the version the proxy had at compute.
    function _liveStateFresh() internal view override returns (bool ok, string memory why) {
        string[] memory roles = _repointRoles();
        for (uint256 i; i < roles.length; i++) {
            (bool found,, uint256 from) = _sealedReinitializer(roles[i]);
            if (!found) continue;
            uint256 live = uint256(vm.load(_existingAddress(roles[i]), INITIALIZABLE_STORAGE)) & type(uint64).max;
            if (live != from) {
                return
                    (
                        false,
                        string.concat(roles[i], " is no longer initialized at the sealed version ", vm.toString(from))
                    );
            }
        }
        return (true, "every sealed reinitializer starts from the version the proxy is initialized at");
    }
}
