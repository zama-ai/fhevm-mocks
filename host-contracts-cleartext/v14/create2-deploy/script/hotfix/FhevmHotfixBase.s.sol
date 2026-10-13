// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FhevmRepointBase} from "../repoint/FhevmRepointBase.s.sol";

/**
 *  A hotfix, as the re-point engine runs it: within one generation, re-point exactly the proxies whose
 *  implementation in this build differs from the one they run, with no init data. Nothing else moves — no
 *  proxy, no storage layout, no owner, no pauser. A change that would need a reinitializer is refused by the
 *  coordinator before anything is sealed (create2-deploy/ts/hotfix.ts).
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

    /// @dev Re-pointed when this build's implementation is not the one the proxy runs.
    function _keepRole(string memory role, address implementation) internal view override returns (bool) {
        return _implementationOf(_existingAddress(role)) != implementation;
    }

    /// @dev What compute sealed.
    function _repointRoles() internal view override returns (string[] memory) {
        return vm.parseJsonStringArray(_loadManifest(), ".repointed");
    }

    function _initData(uint256, string memory) internal pure override returns (bytes memory) {
        return "";
    }

    function _initName(uint256, string memory) internal pure override returns (string memory) {
        return "(no call: a plain re-point)";
    }

    function _liveStateFresh() internal pure override returns (bool ok, string memory why) {
        return (true, "a plain re-point: nothing beyond the implementation slots to re-check");
    }
}
