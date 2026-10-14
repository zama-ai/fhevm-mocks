// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {console} from "forge-std/Script.sol";
import {FhevmRepointBase} from "./FhevmRepointBase.s.sol";
import {IACLOwner, IOwnable2Step, IVersioned} from "../Interfaces.sol";

/**
 *  Applies every re-point, with its reinitialization if any, in one admin-owned ACLOwner call.
 *
 *  The `require`s here are the load-bearing subset of `FhevmPreMaterializeCheck`, repeated because forge
 *  simulates this script before it broadcasts: a failed require ends the run before a transaction exists,
 *  whichever orchestrator invoked it and whether or not the gate was run first.
 */
abstract contract FhevmRepointMaterialize is FhevmRepointBase {
    function run() external {
        _loadUpgradeConfig();
        _requireMinBlock();
        require(msg.sender == cfg.admin, "FhevmRepointMaterialize: sender is not the existing admin");
        require(
            IACLOwner(existingAclOwner).owner() == cfg.admin, "FhevmRepointMaterialize: admin does not own ACLOwner"
        );
        require(
            IOwnable2Step(existingAcl).owner() == existingAclOwner, "FhevmRepointMaterialize: ACLOwner does not own ACL"
        );

        string memory manifest = _loadManifest();
        string[] memory roles = _repointRoles();
        uint256 complete;
        for (uint256 i; i < roles.length; i++) {
            address proxy = _readManifestAddress(manifest, roles[i]);
            address target = _readManifestAddress(manifest, _implRole(roles[i]));
            _requireImplementation(roles[i], target, _implArtifactFor(roles[i]));
            address current = _implementationOf(proxy);
            if (current == target) {
                complete++;
            } else {
                require(
                    current == _sealedPreviousImplementation(manifest, roles[i]),
                    string.concat("FhevmRepointMaterialize: live proxy implementation drift: ", roles[i])
                );
            }
        }
        if (complete == roles.length) {
            console.log("  materialize already complete");
            return;
        }
        require(complete == 0, "FhevmRepointMaterialize: partially materialized state is fatal");
        _requireUntouchedProxies(manifest);

        (bool fresh, string memory why) = _liveStateFresh();
        require(fresh, string.concat("FhevmRepointMaterialize: ", why));

        IACLOwner.Op[] memory ops = _ops(manifest);
        if (vm.envOr("FHEVM_PREPARE_ONLY", false)) {
            string memory path = string.concat(cfg.outDir, "/materialize-calldata.txt");
            vm.writeFile(path, vm.toString(abi.encodeCall(IACLOwner.upgrade, (ops))));
            console.log("  wrote externally-signable ACLOwner.upgrade calldata", path);
            return;
        }
        vm.startBroadcast();
        IACLOwner(existingAclOwner).upgrade(ops);
        vm.stopBroadcast();

        for (uint256 i; i < roles.length; i++) {
            require(
                _implementationOf(_readManifestAddress(manifest, roles[i]))
                    == _readManifestAddress(manifest, _implRole(roles[i])),
                string.concat("FhevmRepointMaterialize: slot mismatch after upgrade: ", roles[i])
            );
        }
        console.log(string.concat("  ", vm.toString(roles.length), " proxies upgraded atomically"));
    }

    /// @dev The implementation exists, is this build's bytecode, and identifies itself as the role's contract.
    function _requireImplementation(string memory role, address target, string memory artifact) private view {
        require(target.code.length != 0, string.concat("FhevmRepointMaterialize: implementation has no code: ", role));
        require(
            _matchesDeployedCode(target, artifact),
            string.concat("FhevmRepointMaterialize: implementation is not this build's bytecode: ", role)
        );
        require(
            keccak256(bytes(IVersioned(target).getVersion())) == keccak256(bytes(_versionFor(role))),
            string.concat("FhevmRepointMaterialize: implementation reports the wrong contract: ", role)
        );
    }

    /// @dev The proxies outside the op list still run what they ran at seal time.
    function _requireUntouchedProxies(string memory manifest) private view {
        string[] memory roles = _untouchedProxyRoles();
        for (uint256 i; i < roles.length; i++) {
            require(
                _implementationOf(_readManifestAddress(manifest, roles[i]))
                    == _sealedPreviousImplementation(manifest, roles[i]),
                string.concat("FhevmRepointMaterialize: untouched proxy implementation drift: ", roles[i])
            );
        }
    }
}
