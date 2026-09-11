// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {FhevmUpgradeBase} from "../../create2-deploy/script/upgrade/FhevmUpgradeBase.s.sol";
import {UpgradeInitData} from "../../create2-deploy/script/upgrade/UpgradeInitData.sol";

/**
 * @title Create2UpgradeOrdinalsTest
 * @notice Pins the index alignment of the 10-create / 7-op upgrade table, the way its sibling
 *         `Create2Ordinals.t.sol` pins the fresh deploy's four lists.
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
        return UpgradeInitData.initData(i, hex"12345678");
    }

    function test_upgradeRolesAndArtifactsAreIndexAligned() public pure {
        string[] memory roles = _upgradeProxyRoles();
        assertEq(roles.length, 7, "upgrade op count");
        assertEq(roles[0], "PROTOCOL_CONFIG_ADDRESS");
        assertEq(roles[1], "KMS_GENERATION_ADDRESS");
        assertEq(roles[2], "ACL_ADDRESS");
        assertEq(roles[3], "FHEVM_EXECUTOR_ADDRESS");
        assertEq(roles[4], "HCU_LIMIT_ADDRESS");
        assertEq(roles[5], "KMS_VERIFIER_ADDRESS");
        assertEq(roles[6], "CLEARTEXT_ARITHMETIC_ADDRESS");

        assertEq(_upgradeImplArtifact(0), "pkg/src/contracts/ProtocolConfig.sol:ProtocolConfig");
        assertEq(_upgradeImplArtifact(1), "pkg/src/contracts/KMSGeneration.sol:KMSGeneration");
        assertEq(_upgradeImplArtifact(2), "pkg/src/contracts/ACL.sol:ACL");
        assertEq(_upgradeImplArtifact(3), "pkg/src/cleartext/CleartextFHEVMExecutor.sol:CleartextFHEVMExecutor");
        assertEq(_upgradeImplArtifact(4), "pkg/src/contracts/HCULimit.sol:HCULimit");
        assertEq(_upgradeImplArtifact(5), "pkg/src/cleartext/CleartextKMSVerifier.sol:CleartextKMSVerifier");
        assertEq(_upgradeImplArtifact(6), "pkg/src/cleartext/CleartextArithmetic.sol:CleartextArithmetic");
    }

    function test_upgradeArtifactsResolveAndCreateCountIsTen() public view {
        string[] memory roles = _upgradeProxyRoles();
        for (uint256 i; i < roles.length; i++) {
            assertGt(vm.getCode(_upgradeImplArtifact(i)).length, 0);
        }
        assertEq(roles.length + 3, 10, "empty impl + two proxies + seven implementations");
    }

    function test_upgradeInitializerSelectorsAreIndexAligned() public pure {
        assertEq(bytes4(UpgradeInitData.initData(0, hex"12345678")), bytes4(hex"12345678"));
        assertEq(bytes4(UpgradeInitData.initData(1, "")), bytes4(keccak256("initializeFromEmptyProxy()")));
        assertEq(bytes4(UpgradeInitData.initData(2, "")), bytes4(keccak256("reinitializeV4()")));
        assertEq(bytes4(UpgradeInitData.initData(3, "")), bytes4(keccak256("reinitializeV4()")));
        assertEq(bytes4(UpgradeInitData.initData(4, "")), bytes4(keccak256("reinitializeV3()")));
        assertEq(bytes4(UpgradeInitData.initData(5, "")), bytes4(keccak256("reinitializeV3()")));
        assertEq(bytes4(UpgradeInitData.initData(6, "")), bytes4(keccak256("reinitializeV2()")));
    }

    function test_upgradeTablesRejectOutOfRange() public {
        vm.expectRevert(bytes("FhevmUpgradeBase: implementation index out of range"));
        this.callUpgradeArtifact(7);
        vm.expectRevert(bytes("UpgradeInitData: index out of range"));
        this.callUpgradeInitData(7);
    }
}
