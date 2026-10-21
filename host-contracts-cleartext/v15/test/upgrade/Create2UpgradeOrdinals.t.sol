// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {FhevmUpgradeBase} from "../../create2-deploy/script/upgrade/FhevmUpgradeBase.s.sol";
import {UpgradeInitData} from "../../create2-deploy/script/upgrade/UpgradeInitData.sol";

/**
 * @title Create2UpgradeOrdinalsTest
 * @notice Pins the index alignment of the independent 6-create / 6-op table used only by the
 *         v14 -> v15 upgrade, the way its sibling `Create2Ordinals.t.sol` pins the fresh deploy's lists.
 *
 * The upgrade table is INDEPENDENT of the deploy one: it visits a different set of roles, in a
 * different order, with a per-position initializer that depends on which version each live proxy is
 * coming from. Nothing derives one from the other, so nothing catches a renumber of one against the
 * other either — hence a second oracle here rather than a shared one.
 *
 * Its own file because it belongs to the cross-generation lane: it exercises
 * `create2-deploy/script/upgrade/`, which exists only while a V(N-1) is live. When the pair rotates,
 * this file goes with that directory, and `Create2Ordinals.t.sol` keeps testing the deploy path
 * untouched. Forge discovers tests from `test/` alone, which is why this sits here rather than beside
 * the scripts it pins.
 */
contract Create2UpgradeOrdinalsTest is Test, FhevmUpgradeBase {
    function callUpgradeArtifact(uint256 i) external pure returns (string memory) {
        return _upgradeImplArtifact(i);
    }

    function callUpgradeInitData(uint256 i) external pure returns (bytes memory) {
        return UpgradeInitData.initData(i);
    }

    function callUpgradeFromVersion(uint256 i) external pure returns (uint64) {
        return _upgradeFromVersion(i);
    }

    function test_upgradeRolesAndArtifactsAreIndexAligned() public pure {
        string[] memory roles = _upgradeProxyRoles();
        assertEq(roles.length, 6, "upgrade op count");
        assertEq(roles[0], "ACL_ADDRESS");
        assertEq(roles[1], "FHEVM_EXECUTOR_ADDRESS");
        assertEq(roles[2], "KMS_VERIFIER_ADDRESS");
        assertEq(roles[3], "INPUT_VERIFIER_ADDRESS");
        assertEq(roles[4], "PROTOCOL_CONFIG_ADDRESS");
        assertEq(roles[5], "KMS_GENERATION_ADDRESS");

        assertEq(_upgradeImplArtifact(0), "pkg/src/cleartext/CleartextACL.sol:CleartextACL");
        assertEq(_upgradeImplArtifact(1), "pkg/src/cleartext/CleartextFHEVMExecutor.sol:CleartextFHEVMExecutor");
        assertEq(_upgradeImplArtifact(2), "pkg/src/cleartext/CleartextKMSVerifier.sol:CleartextKMSVerifier");
        assertEq(_upgradeImplArtifact(3), "pkg/src/cleartext/CleartextInputVerifier.sol:CleartextInputVerifier");
        assertEq(_upgradeImplArtifact(4), "pkg/src/contracts/ProtocolConfig.sol:ProtocolConfig");
        assertEq(_upgradeImplArtifact(5), "pkg/src/contracts/KMSGeneration.sol:KMSGeneration");
    }

    /// The engine creates from the deploy path's artifact per role; this table must name the same one.
    function test_upgradeArtifactsAreTheDeployPathOnes() public pure {
        string[] memory roles = _upgradeProxyRoles();
        for (uint256 i; i < roles.length; i++) {
            assertEq(_upgradeImplArtifact(i), _implArtifactFor(roles[i]), roles[i]);
        }
    }

    /// One implementation create per op, and nothing else: v15 adds no proxy to the live stack.
    function test_upgradeArtifactsResolveAndCreateCountIsSix() public view {
        string[] memory roles = _upgradeProxyRoles();
        for (uint256 i; i < roles.length; i++) {
            assertGt(vm.getCode(_upgradeImplArtifact(i)).length, 0);
        }
        assertEq(_upgradeCreateTable().length, 6, "six implementations, no empty implementation, no proxy");
    }

    /// The untouched set and the op set partition the nine live proxies.
    function test_untouchedAndUpgradedRolesPartitionTheStack() public view {
        string[] memory untouched = _untouchedProxyRoles();
        assertEq(untouched.length, 3, "untouched count");
        assertEq(untouched[0], "HCU_LIMIT_ADDRESS");
        assertEq(untouched[1], "CLEARTEXT_ARITHMETIC_ADDRESS");
        assertEq(untouched[2], "CLEARTEXT_DB_ADDRESS");
        assertEq(
            untouched.length + _upgradeProxyRoles().length,
            _allProxyRoles().length,
            "every live proxy is one or the other"
        );
    }

    function test_upgradeInitializerSelectorsAreIndexAligned() public pure {
        assertEq(bytes4(UpgradeInitData.initData(0)), bytes4(keccak256("reinitializeV6()")));
        assertEq(bytes4(UpgradeInitData.initData(1)), bytes4(keccak256("reinitializeV7()")));
        assertEq(bytes4(UpgradeInitData.initData(2)), bytes4(keccak256("reinitializeV5()")));
        assertEq(bytes4(UpgradeInitData.initData(3)), bytes4(keccak256("reinitializeV3()")));
        assertEq(bytes4(UpgradeInitData.initData(4)), bytes4(keccak256("reinitializeV3()")));
        assertEq(bytes4(UpgradeInitData.initData(5)), bytes4(keccak256("reinitializeV3()")));
        for (uint256 i; i < 6; i++) {
            assertEq(UpgradeInitData.initData(i).length, 4, "no reinitializer takes arguments");
        }
    }

    /// Each reinitializer `reinitializeV<k>()` runs at `reinitializer(k + 1)`: it moves the proxy from k to k + 1.
    function test_upgradeVersionsMatchTheReinitializers() public pure {
        uint64[6] memory k = [uint64(6), 7, 5, 3, 3, 3];
        for (uint256 i; i < 6; i++) {
            assertEq(_upgradeFromVersion(i), k[i], UpgradeInitData.initName(i));
            assertEq(_upgradeToVersion(i), k[i] + 1, UpgradeInitData.initName(i));
            assertEq(
                UpgradeInitData.initName(i),
                string.concat(_contractName(i), ".reinitializeV", vm.toString(uint256(k[i])), "()"),
                "initName names the reinitializer from the from-version"
            );
        }
    }

    function test_upgradeTablesRejectOutOfRange() public {
        vm.expectRevert(bytes("FhevmUpgradeBase: implementation index out of range"));
        this.callUpgradeArtifact(6);
        vm.expectRevert(bytes("UpgradeInitData: index out of range"));
        this.callUpgradeInitData(6);
        vm.expectRevert(bytes("FhevmUpgradeBase: version index out of range"));
        this.callUpgradeFromVersion(6);
    }

    function _contractName(uint256 i) private pure returns (string memory) {
        if (i == 0) return "ACL";
        if (i == 1) return "FHEVMExecutor";
        if (i == 2) return "KMSVerifier";
        if (i == 3) return "InputVerifier";
        if (i == 4) return "ProtocolConfig";
        return "KMSGeneration";
    }
}
