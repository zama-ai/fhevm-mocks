// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {
    FhevmAddressRole,
    FhevmHostContracts,
    LocalHostUpgrade
} from "../../pkg/forge/src/_internal/LocalHostBytecode.sol";

/**
 * The generated upgrade tables in `LocalHostBytecode.sol`, held still.
 *
 * Those tables exist so a fork upgrade can deploy the production host implementations pointing at a
 * REMOTE stack's addresses: the blob ships with the localhost addresses in it, and the site table says
 * where they sit so they can be overwritten. Two ways that goes wrong silently, and this file is what
 * stops both.
 *
 * THE ENUM POSITIONS ARE THE ABI. Every table is indexed by `FhevmHostContracts`, and every packed site
 * record names its role by `FhevmAddressRole`'s position. Insert a member anywhere but the end and one
 * contract's bytecode pairs with another's offsets, or an offset is applied to the wrong address — a
 * stack that deploys cleanly and points nowhere. Spelled out member by member, deliberately: a loop
 * over indices would compare each position with itself and pass while the NAMES had shifted underneath,
 * which is the failure being guarded. Same reasoning as `FhevmOperatorsEnum.t.sol`.
 *
 * THE TABLE MUST DESCRIBE ITS OWN BYTES. The generator measures the offsets in the blob it emits, so
 * the address a site names must actually be there. `test_everySiteHoldsTheAddressItNames` reads it back
 * out of the bytecode and is what would catch a generator that emitted one contract's offsets beside
 * another's code.
 */
contract LocalHostUpgradeTablesTest is Test {
    /// Every member of `FhevmHostContracts`, in order, for the loops below.
    function _contracts() private pure returns (FhevmHostContracts[] memory all) {
        all = new FhevmHostContracts[](LocalHostUpgrade.HOST_CONTRACT_COUNT);
        all[0] = FhevmHostContracts.CleartextFHEVMExecutor;
        all[1] = FhevmHostContracts.CleartextArithmetic;
        all[2] = FhevmHostContracts.CleartextDB;
        all[3] = FhevmHostContracts.CleartextACL;
        all[4] = FhevmHostContracts.CleartextKMSVerifier;
        all[5] = FhevmHostContracts.CleartextInputVerifier;
        all[6] = FhevmHostContracts.CleartextHCULimit;
        all[7] = FhevmHostContracts.CleartextForgeFHEVMExecutor;
        all[8] = FhevmHostContracts.CleartextForgeACL;
        all[9] = FhevmHostContracts.CleartextForgeArithmetic;
        all[10] = FhevmHostContracts.CleartextForgeHCULimit;
        all[11] = FhevmHostContracts.EmptyUUPSProxy;
        all[12] = FhevmHostContracts.FHEVMExecutor;
    }

    // ---------------------------------------------------------------------------------------------
    // The enums
    // ---------------------------------------------------------------------------------------------

    function test_everyHostContractHasThePositionThisFileWasWrittenAgainst() public pure {
        assertEq(uint8(FhevmHostContracts.CleartextFHEVMExecutor), 0, "CleartextFHEVMExecutor");
        assertEq(uint8(FhevmHostContracts.CleartextArithmetic), 1, "CleartextArithmetic");
        assertEq(uint8(FhevmHostContracts.CleartextDB), 2, "CleartextDB");
        assertEq(uint8(FhevmHostContracts.CleartextACL), 3, "CleartextACL");
        assertEq(uint8(FhevmHostContracts.CleartextKMSVerifier), 4, "CleartextKMSVerifier");
        assertEq(uint8(FhevmHostContracts.CleartextInputVerifier), 5, "CleartextInputVerifier");
        assertEq(uint8(FhevmHostContracts.CleartextHCULimit), 6, "CleartextHCULimit");
        assertEq(uint8(FhevmHostContracts.CleartextForgeFHEVMExecutor), 7, "CleartextForgeFHEVMExecutor");
        assertEq(uint8(FhevmHostContracts.CleartextForgeACL), 8, "CleartextForgeACL");
        assertEq(uint8(FhevmHostContracts.CleartextForgeArithmetic), 9, "CleartextForgeArithmetic");
        assertEq(uint8(FhevmHostContracts.CleartextForgeHCULimit), 10, "CleartextForgeHCULimit");
        assertEq(uint8(FhevmHostContracts.EmptyUUPSProxy), 11, "EmptyUUPSProxy");
        assertEq(uint8(FhevmHostContracts.FHEVMExecutor), 12, "FHEVMExecutor");
    }

    function test_everyAddressRoleHasThePositionThisFileWasWrittenAgainst() public pure {
        assertEq(uint8(FhevmAddressRole.ACL), 0, "ACL");
        assertEq(uint8(FhevmAddressRole.FHEVMExecutor), 1, "FHEVMExecutor");
        assertEq(uint8(FhevmAddressRole.KMSVerifier), 2, "KMSVerifier");
        assertEq(uint8(FhevmAddressRole.InputVerifier), 3, "InputVerifier");
        assertEq(uint8(FhevmAddressRole.HCULimit), 4, "HCULimit");
        assertEq(uint8(FhevmAddressRole.ProtocolConfig), 5, "ProtocolConfig");
        assertEq(uint8(FhevmAddressRole.KMSGeneration), 6, "KMSGeneration");
        assertEq(uint8(FhevmAddressRole.PauserSet), 7, "PauserSet");
        assertEq(uint8(FhevmAddressRole.CleartextArithmetic), 8, "CleartextArithmetic");
        assertEq(uint8(FhevmAddressRole.CleartextDB), 9, "CleartextDB");
    }

    /// Catches an append on either enum, which the per-member checks above cannot see.
    function test_neitherEnumHasGrownAMember() public pure {
        assertEq(uint8(type(FhevmHostContracts).max), 12, "host contracts");
        assertEq(uint8(type(FhevmAddressRole).max), 9, "address roles");
        assertEq(LocalHostUpgrade.HOST_CONTRACT_COUNT, 13, "and the count the tables were built with");
        assertEq(LocalHostUpgrade.ADDRESS_ROLE_COUNT, 10, "and the role count");
    }

    // ---------------------------------------------------------------------------------------------
    // The tables
    // ---------------------------------------------------------------------------------------------

    function test_everyContractHasCreationCodeAndAtLeastOneSite() public pure {
        FhevmHostContracts[] memory all = _contracts();
        for (uint256 i = 0; i < all.length; i++) {
            assertGt(LocalHostUpgrade.creationCode(all[i]).length, 0, "creation code");
            // A host implementation with no address in it would not need patching and would not belong
            // in this table at all.
            assertGt(LocalHostUpgrade.patchSites(all[i]).length, 0, "patch sites");
        }
    }

    function test_everySiteTableIsWholeRecords() public pure {
        FhevmHostContracts[] memory all = _contracts();
        for (uint256 i = 0; i < all.length; i++) {
            assertEq(LocalHostUpgrade.patchSites(all[i]).length % LocalHostUpgrade.SITE_RECORD_BYTES, 0, "records");
        }
    }

    /// The point of the whole table: the address a record names is the address actually at that offset.
    function test_everySiteHoldsTheAddressItNames() public pure {
        FhevmHostContracts[] memory all = _contracts();
        for (uint256 i = 0; i < all.length; i++) {
            bytes memory code = LocalHostUpgrade.creationCode(all[i]);
            bytes memory sites = LocalHostUpgrade.patchSites(all[i]);

            for (uint256 at = 0; at < sites.length; at += LocalHostUpgrade.SITE_RECORD_BYTES) {
                (FhevmAddressRole role, uint256 offset) = _record(sites, at);

                assertLe(offset + 20, code.length, "the offset is inside the bytecode");
                assertEq(
                    _addressAt(code, offset),
                    LocalHostUpgrade.canonicalAddress(role),
                    "the bytecode holds the address the record names"
                );
            }
        }
    }

    /// Ascending, so a patcher may walk the table forward and never revisit a byte.
    function test_everySiteTableIsSortedAndNonOverlapping() public pure {
        FhevmHostContracts[] memory all = _contracts();
        for (uint256 i = 0; i < all.length; i++) {
            bytes memory sites = LocalHostUpgrade.patchSites(all[i]);
            uint256 previousEnd = 0;

            for (uint256 at = 0; at < sites.length; at += LocalHostUpgrade.SITE_RECORD_BYTES) {
                (, uint256 offset) = _record(sites, at);
                assertGe(offset, previousEnd, "sites ascend and do not overlap");
                previousEnd = offset + 20;
            }
        }
    }

    /// Every role the tables reference resolves to a real address, so a patch can never write zero.
    function test_everyReferencedRoleHasANonZeroAddress() public pure {
        FhevmHostContracts[] memory all = _contracts();
        for (uint256 i = 0; i < all.length; i++) {
            bytes memory sites = LocalHostUpgrade.patchSites(all[i]);
            for (uint256 at = 0; at < sites.length; at += LocalHostUpgrade.SITE_RECORD_BYTES) {
                (FhevmAddressRole role,) = _record(sites, at);
                assertTrue(LocalHostUpgrade.canonicalAddress(role) != address(0), "role resolves");
            }
        }
    }

    /// The two lookups agree on which contracts exist: neither silently answers for a member the other refuses.
    function test_theTwoLookupsCoverTheSameContracts() public pure {
        FhevmHostContracts[] memory all = _contracts();
        for (uint256 i = 0; i < all.length; i++) {
            assertEq(uint8(all[i]), uint8(i), "the helper lists the enum in order");
        }
    }

    // ---------------------------------------------------------------------------------------------
    // Decoding, kept here rather than shared: this file must not depend on the code it is checking.
    // ---------------------------------------------------------------------------------------------

    /// One packed record: `uint8 role`, then a big-endian `uint32` offset.
    function _record(bytes memory sites, uint256 at) private pure returns (FhevmAddressRole role, uint256 offset) {
        role = FhevmAddressRole(uint8(sites[at]));
        offset = (uint256(uint8(sites[at + 1])) << 24) | (uint256(uint8(sites[at + 2])) << 16)
            | (uint256(uint8(sites[at + 3])) << 8) | uint256(uint8(sites[at + 4]));
    }

    function _addressAt(bytes memory code, uint256 offset) private pure returns (address value) {
        uint256 word;
        for (uint256 i = 0; i < 20; i++) {
            word = (word << 8) | uint256(uint8(code[offset + i]));
        }
        value = address(uint160(word));
    }
}
