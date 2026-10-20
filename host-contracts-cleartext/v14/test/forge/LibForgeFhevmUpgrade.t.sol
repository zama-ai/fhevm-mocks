// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {LibForgeFhevmUpgrade} from "../../pkg/forge/src/LibForgeFhevmUpgrade.sol";
import {LibHostUpgradeCode} from "../../pkg/forge/src/LibHostUpgradeCode.sol";
import {
    FhevmAddressRole,
    FhevmHostContracts,
    LocalHostUpgrade
} from "../../pkg/forge/src/_internal/LocalHostBytecode.sol";

/**
 * The op table that brings a forked stack up a generation.
 *
 * THREE TABLES, ONE INDEX. `opProxyRole`, `opImplementation` and `opInitData` are read together at every
 * step of the upgrade: the role says which proxy, the implementation says whose code goes behind it, and
 * the init data says what runs afterwards. Disagree by one and the upgrade installs `KMSVerifier`'s code
 * behind `HCULimit`'s proxy and calls the wrong reinitializer on it — an upgrade that reports success
 * and leaves a stack nobody can use. `Create2UpgradeOrdinals.t.sol` guards the create2 coordinator's
 * equivalent for the same reason; this is that test for the fork path.
 *
 * WHAT THIS FILE DOES NOT DO. It does not run the upgrade. Executing it needs a stack on the PREVIOUS
 * generation, and there is no such stack offline — this package deploys the current one. That coverage
 * lives in the fork suite, which needs an RPC and is skipped here.
 */
contract LibForgeFhevmUpgradeTest is Test {
    /// Written out rather than looped: the pairing is the thing under test, so it is stated, not derived.
    function test_everyOpNamesOneContractInAllThreeTables() public pure {
        _assertOp(0, FhevmAddressRole.ProtocolConfig, FhevmHostContracts.ProtocolConfig, "reinitializeV2");
        _assertOp(1, FhevmAddressRole.KMSGeneration, FhevmHostContracts.KMSGeneration, "reinitializeV2");
        _assertOp(2, FhevmAddressRole.ACL, FhevmHostContracts.ACL, "reinitializeV5");
        _assertOp(3, FhevmAddressRole.FHEVMExecutor, FhevmHostContracts.FHEVMExecutor, "reinitializeV6");
        _assertOp(4, FhevmAddressRole.HCULimit, FhevmHostContracts.HCULimit, "reinitializeV4");
        _assertOp(5, FhevmAddressRole.KMSVerifier, FhevmHostContracts.KMSVerifier, "reinitializeV4");
    }

    function test_theOpCountIsWhatTheTablesHold() public {
        assertEq(LibForgeFhevmUpgrade.OP_COUNT, 6, "six proxies are re-pointed");

        // One past the end fails in every table, so a caller looping on a stale count cannot read
        // silently wrong entries.
        vm.expectRevert(
            abi.encodeWithSelector(LibForgeFhevmUpgrade.UpgradeIndexOutOfRange.selector, LibForgeFhevmUpgrade.OP_COUNT)
        );
        this.proxyRoleExternally(LibForgeFhevmUpgrade.OP_COUNT);
        vm.expectRevert(
            abi.encodeWithSelector(LibForgeFhevmUpgrade.UpgradeIndexOutOfRange.selector, LibForgeFhevmUpgrade.OP_COUNT)
        );
        this.implementationExternally(LibForgeFhevmUpgrade.OP_COUNT);
        vm.expectRevert(
            abi.encodeWithSelector(LibForgeFhevmUpgrade.UpgradeIndexOutOfRange.selector, LibForgeFhevmUpgrade.OP_COUNT)
        );
        this.initDataExternally(LibForgeFhevmUpgrade.OP_COUNT);
    }

    /// Every implementation an op names must be one the patcher can rewrite, or the upgrade would deploy
    /// code pointing at this package's localhost addresses onto someone else's chain.
    function test_everyImplementationIsPatchable() public pure {
        for (uint256 index = 0; index < LibForgeFhevmUpgrade.OP_COUNT; index++) {
            FhevmHostContracts implementation = LibForgeFhevmUpgrade.opImplementation(index);
            assertGt(LocalHostUpgrade.creationCode(implementation).length, 0, "has creation code");
            assertGt(LocalHostUpgrade.patchSites(implementation).length, 0, "and patch sites");
        }
    }

    /// No proxy is re-pointed twice, which would burn the second reinitializer on an already-upgraded one.
    function test_noProxyAppearsTwice() public pure {
        for (uint256 i = 0; i < LibForgeFhevmUpgrade.OP_COUNT; i++) {
            for (uint256 j = i + 1; j < LibForgeFhevmUpgrade.OP_COUNT; j++) {
                assertTrue(
                    LibForgeFhevmUpgrade.opProxyRole(i) != LibForgeFhevmUpgrade.opProxyRole(j), "a proxy repeats"
                );
            }
        }
    }

    /**
     * The three contracts the list deliberately leaves out, each for its own reason. Stated here because
     * "absent" is a decision, and the next person to compare this table with `pkg/ts/upgrade.ts` will
     * find one more entry there and need to know why.
     */
    function test_theDeliberateOmissions() public pure {
        for (uint256 index = 0; index < LibForgeFhevmUpgrade.OP_COUNT; index++) {
            FhevmAddressRole role = LibForgeFhevmUpgrade.opProxyRole(index);
            // Its bytecode is identical across the two generations, so re-pointing it would consume a
            // reinitializer and change nothing.
            assertTrue(role != FhevmAddressRole.InputVerifier, "InputVerifier is not upgraded");
            // Neither exists on a real deployment; the TypeScript upgrade re-points the first only
            // because it runs against a cleartext stack.
            assertTrue(role != FhevmAddressRole.CleartextArithmetic, "CleartextArithmetic is not on a real chain");
            assertTrue(role != FhevmAddressRole.CleartextDB, "CleartextDB is not on a real chain");
            assertTrue(role != FhevmAddressRole.PauserSet, "PauserSet is not a proxy");
        }
    }

    /// `upgradeFromPreviousGeneration` writes its array length out, so the two must agree.
    function test_theRoleCountIsStillTen() public pure {
        assertEq(LibHostUpgradeCode.ROLE_COUNT, 10, "the signature's array literal assumes it");
        assertEq(LocalHostUpgrade.ADDRESS_ROLE_COUNT, 10, "and so does the generated table");
    }

    // External wrappers, so `vm.expectRevert` has a call frame to catch.
    function proxyRoleExternally(uint256 index) external pure returns (FhevmAddressRole) {
        return LibForgeFhevmUpgrade.opProxyRole(index);
    }

    function implementationExternally(uint256 index) external pure returns (FhevmHostContracts) {
        return LibForgeFhevmUpgrade.opImplementation(index);
    }

    function initDataExternally(uint256 index) external pure returns (bytes memory) {
        return LibForgeFhevmUpgrade.opInitData(index);
    }

    function _assertOp(
        uint256 index,
        FhevmAddressRole expectedRole,
        FhevmHostContracts expectedImplementation,
        string memory expectedInitializer
    ) private pure {
        assertEq(uint8(LibForgeFhevmUpgrade.opProxyRole(index)), uint8(expectedRole), "proxy role");
        assertEq(uint8(LibForgeFhevmUpgrade.opImplementation(index)), uint8(expectedImplementation), "implementation");
        assertEq(
            bytes4(LibForgeFhevmUpgrade.opInitData(index)),
            bytes4(keccak256(bytes(string.concat(expectedInitializer, _signature(index))))),
            "initializer selector"
        );
        // The name is what a failure message shows, so it must say the same thing as the selector.
        assertTrue(vm.contains(LibForgeFhevmUpgrade.opName(index), expectedInitializer), "name matches selector");
    }

    /// @dev Only `ProtocolConfig.reinitializeV2` takes arguments; every other op is no-arg.
    function _signature(uint256 index) private pure returns (string memory) {
        if (index == 0) {
            return "((address,address,string,string,int32,string,bytes,string)[],string,(bytes,bytes,bytes)[])";
        }
        return "()";
    }
}
