// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {FhevmUpgradeBase} from "../../create2-deploy/script/upgrade/FhevmUpgradeBase.s.sol";
import {UpgradeInitData} from "../../create2-deploy/script/upgrade/UpgradeInitData.sol";
import {MaterializeInitData} from "../../create2-deploy/script/MaterializeInitData.sol";
import {LibFhevmCleartextConfig} from "../../pkg/src/cleartext/shared/LibFhevmCleartextConfig.sol";

/**
 * @title Create2UpgradeOrdinalsTest
 * @notice Pins the index alignment of the independent 10-create / 8-op table used only by the
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
        assertEq(roles.length, 8, "upgrade op count");
        assertEq(roles[0], "ACL_ADDRESS");
        assertEq(roles[1], "FHEVM_EXECUTOR_ADDRESS");
        assertEq(roles[2], "KMS_VERIFIER_ADDRESS");
        assertEq(roles[3], "INPUT_VERIFIER_ADDRESS");
        assertEq(roles[4], "PROTOCOL_CONFIG_ADDRESS");
        assertEq(roles[5], "KMS_GENERATION_ADDRESS");
        assertEq(roles[6], "CLEARTEXT_ARITHMETIC_ADDRESS");
        assertEq(roles[7], "PADDED_INPUTTER_ADDRESS");

        assertEq(_upgradeImplArtifact(0), "pkg/src/cleartext/CleartextACL.sol:CleartextACL");
        assertEq(_upgradeImplArtifact(1), "pkg/src/cleartext/CleartextFHEVMExecutor.sol:CleartextFHEVMExecutor");
        assertEq(_upgradeImplArtifact(2), "pkg/src/cleartext/CleartextKMSVerifier.sol:CleartextKMSVerifier");
        assertEq(_upgradeImplArtifact(3), "pkg/src/cleartext/CleartextInputVerifier.sol:CleartextInputVerifier");
        assertEq(_upgradeImplArtifact(4), "pkg/src/contracts/ProtocolConfig.sol:ProtocolConfig");
        assertEq(_upgradeImplArtifact(5), "pkg/src/contracts/KMSGeneration.sol:KMSGeneration");
        assertEq(_upgradeImplArtifact(6), "pkg/src/cleartext/CleartextArithmetic.sol:CleartextArithmetic");
        assertEq(_upgradeImplArtifact(7), "pkg/src/cleartext/CleartextPaddedInputter.sol:CleartextPaddedInputter");
    }

    /// The engine creates from the deploy path's artifact per role; this table must name the same one.
    function test_upgradeArtifactsAreTheDeployPathOnes() public pure {
        string[] memory roles = _upgradeProxyRoles();
        for (uint256 i; i < roles.length; i++) {
            assertEq(_upgradeImplArtifact(i), _implArtifactFor(roles[i]), roles[i]);
        }
    }

    /// v15 adds one proxy, PaddedInputter: the upgrade creates it over an empty implementation, first.
    function test_upgradeCreatesTheNewProxyFirst() public pure {
        string[] memory created = _newProxyRoles();
        assertEq(created.length, 1, "created proxy count");
        assertEq(created[0], "PADDED_INPUTTER_ADDRESS");
    }

    /// The empty implementation, the created proxy, then one implementation create per op.
    function test_upgradeArtifactsResolveAndCreateCountIsTen() public {
        existingAcl = address(0xA11CE);
        string[] memory roles = _upgradeProxyRoles();
        for (uint256 i; i < roles.length; i++) {
            assertGt(vm.getCode(_upgradeImplArtifact(i)).length, 0);
        }
        UpgradeCreate[] memory t = _upgradeCreateTable();
        assertEq(t.length, 10, "an empty implementation, one proxy, eight implementations");
        assertEq(t[0].role, "UPGRADE_EMPTY_UUPS_PROXY");
        assertEq(t[1].role, "PADDED_INPUTTER_ADDRESS");
        for (uint256 i; i < roles.length; i++) {
            assertEq(t[i + 2].role, string.concat("IMPL_", roles[i]));
        }
    }

    /// The created proxy sits on the empty implementation's predicted address, initialized like the deploy's.
    function test_createdProxyIsOverTheEmptyImplementation() public {
        existingAcl = address(0xA11CE);
        UpgradeCreate[] memory t = _upgradeCreateTable();
        address emptyImpl = _predictCreate2Address(t[0].role, t[0].initCode);
        assertEq(
            keccak256(t[1].initCode),
            keccak256(_proxyInitCode(emptyImpl, abi.encodeWithSignature("initialize()"))),
            "the committed ERC1967Proxy, over the empty implementation"
        );
    }

    /// The untouched set and the op set partition the ten live proxies.
    function test_untouchedAndUpgradedRolesPartitionTheStack() public view {
        string[] memory untouched = _untouchedProxyRoles();
        assertEq(untouched.length, 2, "untouched count");
        assertEq(untouched[0], "HCU_LIMIT_ADDRESS");
        assertEq(untouched[1], "CLEARTEXT_DB_ADDRESS");
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
        assertEq(bytes4(UpgradeInitData.initData(6)), bytes4(keccak256("reinitializeV4()")));
        for (uint256 i; i < 7; i++) {
            assertEq(UpgradeInitData.initData(i).length, 4, "no reinitializer takes arguments");
        }
        // The created proxy's initializer is the fresh deploy's, PRF instances and all.
        assertEq(bytes4(UpgradeInitData.initData(7)), bytes4(keccak256("initializeFromEmptyProxy(uint16[])")));
        assertEq(UpgradeInitData.initData(7), MaterializeInitData.paddedInputter(), "the deploy's payload");
    }

    /// Each reinitializer `reinitializeV<k>()` runs at `reinitializer(k + 1)`: it moves the proxy from k to k + 1.
    function test_upgradeVersionsMatchTheReinitializers() public pure {
        uint64[7] memory k = [uint64(6), 7, 5, 3, 3, 3, 4];
        for (uint256 i; i < 7; i++) {
            assertEq(_upgradeFromVersion(i), k[i], UpgradeInitData.initName(i));
            assertEq(_upgradeToVersion(i), k[i] + 1, UpgradeInitData.initName(i));
            assertEq(
                UpgradeInitData.initName(i),
                string.concat(_contractName(i), ".reinitializeV", vm.toString(uint256(k[i])), "()"),
                "initName names the reinitializer from the from-version"
            );
        }
    }

    /// The created proxy starts at its empty proxy's `initialize()` and ends at PaddedInputter's reinitializer(2).
    function test_createdProxyVersions() public pure {
        assertEq(_upgradeFromVersion(7), 1);
        assertEq(_upgradeToVersion(7), 2);
        assertEq(
            UpgradeInitData.initName(7),
            string.concat(
                "PaddedInputter.initializeFromEmptyProxy([",
                vm.toString(uint256(LibFhevmCleartextConfig.CLEARTEXT_PAD_PRF_INSTANCE)),
                "])"
            ),
            "the default PRF instance, from cleartext-config.json"
        );
    }

    function test_upgradeTablesRejectOutOfRange() public {
        vm.expectRevert(bytes("FhevmUpgradeBase: implementation index out of range"));
        this.callUpgradeArtifact(8);
        vm.expectRevert(bytes("UpgradeInitData: index out of range"));
        this.callUpgradeInitData(8);
        vm.expectRevert(bytes("FhevmUpgradeBase: version index out of range"));
        this.callUpgradeFromVersion(8);
    }

    function _contractName(uint256 i) private pure returns (string memory) {
        if (i == 0) return "ACL";
        if (i == 1) return "FHEVMExecutor";
        if (i == 2) return "KMSVerifier";
        if (i == 3) return "InputVerifier";
        if (i == 4) return "ProtocolConfig";
        if (i == 5) return "KMSGeneration";
        return "CleartextArithmetic";
    }
}
