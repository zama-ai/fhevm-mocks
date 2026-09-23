// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {LibHostUpgradeCode} from "../../pkg/forge/src/LibHostUpgradeCode.sol";
import {
    FhevmAddressRole,
    FhevmHostContracts,
    LocalHostUpgrade
} from "../../pkg/forge/src/_internal/LocalHostBytecode.sol";
import {IACL} from "../../pkg/forge/src/_internal/interfaces/IACL.sol";
import {IFHEVMExecutor} from "../../pkg/forge/src/_internal/interfaces/IFHEVMExecutor.sol";

/// @dev `HCULimit`'s one address getter. Declared here rather than pulled from a generated interface
///      because only this file needs it, and naming it is cheaper than a file nobody else imports.
interface IHCULimitAddresses {
    function getFHEVMExecutorAddress() external view returns (address);
}

/**
 * `LibHostUpgradeCode`, which rewrites a host implementation's baked-in addresses so it can be deployed
 * beside a stack that lives somewhere else.
 *
 * WHAT WOULD GO WRONG WITHOUT THIS FILE. A wrong offset splices twenty bytes into the middle of an
 * opcode. The result still deploys, still runs, and is wrong — wrong in a way that surfaces as an
 * unrelated revert inside a dApp much later. So the tests here are not "does it return bytes": they
 * check the bytes mean what they should, and the strongest of them deploys the result and asks the
 * contract itself where it thinks its siblings are.
 *
 * THE ADVERSARIAL SETS ARE THE POINT of `test_anyAddressSetWorks`. A splice must be value independent,
 * and the values most likely to break one are the ones with structure: leading zero bytes, all ones, a
 * role set to another role's address, every role the same.
 */
contract LibHostUpgradeCodeTest is Test {
    /// @dev The literal is unavoidable: Solidity refuses another library's constant as an array length,
    ///      so `address[10]` is written out below and `test_theRoleCountIsStillTen` is what stops the two
    ///      from drifting apart.
    uint256 internal constant ROLES = 10;

    function _contracts() private pure returns (FhevmHostContracts[] memory all) {
        all = new FhevmHostContracts[](LocalHostUpgrade.HOST_CONTRACT_COUNT);
        all[0] = FhevmHostContracts.ACL;
        all[1] = FhevmHostContracts.FHEVMExecutor;
        all[2] = FhevmHostContracts.KMSVerifier;
        all[3] = FhevmHostContracts.InputVerifier;
        all[4] = FhevmHostContracts.HCULimit;
    }

    /// The localhost set, which is what every blob ships holding.
    function _canonical() private pure returns (address[10] memory set) {
        for (uint256 role = 0; role < ROLES; role++) {
            set[role] = LocalHostUpgrade.canonicalAddress(FhevmAddressRole(uint8(role)));
        }
    }

    /// A distinct, obviously-not-canonical address per role.
    function _remote() private pure returns (address[10] memory set) {
        for (uint256 role = 0; role < ROLES; role++) {
            // A flat, obviously synthetic set: nothing here can collide with a localhost address.
            set[role] = address(uint160(uint256(0xDEADBEEF) << 128) + uint160(role + 1));
        }
    }

    // ---------------------------------------------------------------------------------------------
    // The core properties
    // ---------------------------------------------------------------------------------------------

    function test_theRoleCountIsStillTen() public pure {
        assertEq(LibHostUpgradeCode.ROLE_COUNT, ROLES, "the array literals in this file assume it");
        assertEq(LocalHostUpgrade.ADDRESS_ROLE_COUNT, ROLES, "and so does the generated table");
    }

    /// Patching with the set already in place changes nothing: the verify step passes and every write
    /// is a write of the value that was there.
    function test_patchingToTheCanonicalSetIsTheIdentity() public pure {
        FhevmHostContracts[] memory all = _contracts();
        for (uint256 i = 0; i < all.length; i++) {
            assertEq(
                LibHostUpgradeCode.creationCodeFor(all[i], _canonical()),
                LocalHostUpgrade.creationCode(all[i]),
                "canonical patch must be a no-op"
            );
        }
    }

    /// There and back again. Catches a write that is not the exact inverse of the read.
    function test_roundTripReturnsTheOriginalBytes() public pure {
        FhevmHostContracts[] memory all = _contracts();
        for (uint256 i = 0; i < all.length; i++) {
            bytes memory original = LocalHostUpgrade.creationCode(all[i]);
            bytes memory there = LibHostUpgradeCode.creationCodeFor(all[i], _remote());
            bytes memory back =
                LibHostUpgradeCode.patch(there, LocalHostUpgrade.patchSites(all[i]), _remote(), _canonical());

            assertTrue(keccak256(there) != keccak256(original), "the trip must actually change something");
            assertEq(back, original, "and come back exactly");
        }
    }

    function test_theLengthNeverMoves() public pure {
        FhevmHostContracts[] memory all = _contracts();
        for (uint256 i = 0; i < all.length; i++) {
            assertEq(
                LibHostUpgradeCode.creationCodeFor(all[i], _remote()).length,
                LocalHostUpgrade.creationCode(all[i]).length,
                "a splice replaces, never resizes"
            );
        }
    }

    /// Every site holds the NEW address afterwards, read back out of the bytecode.
    function test_everySiteHoldsTheRequestedAddress() public pure {
        FhevmHostContracts[] memory all = _contracts();
        address[10] memory remote = _remote();

        for (uint256 i = 0; i < all.length; i++) {
            bytes memory patched = LibHostUpgradeCode.creationCodeFor(all[i], remote);
            bytes memory sites = LocalHostUpgrade.patchSites(all[i]);

            for (uint256 at = 0; at < sites.length; at += LocalHostUpgrade.SITE_RECORD_BYTES) {
                (uint8 role, uint256 offset) = _record(sites, at);
                assertEq(_addressAt(patched, offset), remote[role], "site holds what was asked for");
            }
        }
    }

    /// Nothing outside a site moved. The check a length comparison cannot make.
    function test_onlyTheSitesChange() public pure {
        FhevmHostContracts[] memory all = _contracts();

        for (uint256 i = 0; i < all.length; i++) {
            bytes memory original = LocalHostUpgrade.creationCode(all[i]);
            bytes memory patched = LibHostUpgradeCode.creationCodeFor(all[i], _remote());
            bytes memory sites = LocalHostUpgrade.patchSites(all[i]);

            for (uint256 index = 0; index < original.length; index++) {
                if (_isInsideASite(sites, index)) continue;
                assertEq(patched[index], original[index], "a byte outside every site was rewritten");
            }
        }
    }

    /// No localhost address survives anywhere in the result — the check that catches a site the
    /// GENERATED TABLE never recorded, which every other test here would sail past.
    function test_noCanonicalAddressSurvivesAnywhere() public pure {
        FhevmHostContracts[] memory all = _contracts();
        address[10] memory canonical = _canonical();

        for (uint256 i = 0; i < all.length; i++) {
            bytes memory patched = LibHostUpgradeCode.creationCodeFor(all[i], _remote());
            (bool found, address which, uint256 offset) = _findAny(patched, canonical);
            assertFalse(found, string.concat("localhost address still at offset ", vm.toString(offset)));
            assertEq(which, address(0), "and no address to report");
        }
    }

    // ---------------------------------------------------------------------------------------------
    // The strongest one: deploy it and ask
    // ---------------------------------------------------------------------------------------------

    /// Bytes that look right and a contract that behaves right are different claims. This makes the
    /// second one: deploy each patched implementation and read its siblings back from its own getters.
    function test_theDeployedImplementationPointsWhereWeSaid() public {
        address[10] memory remote = _remote();
        address acl = remote[uint8(FhevmAddressRole.ACL)];
        address executor = remote[uint8(FhevmAddressRole.FHEVMExecutor)];
        address inputVerifier = remote[uint8(FhevmAddressRole.InputVerifier)];
        address hcuLimit = remote[uint8(FhevmAddressRole.HCULimit)];
        address pauserSet = remote[uint8(FhevmAddressRole.PauserSet)];

        address deployedExecutor = _deploy(LibHostUpgradeCode.creationCodeFor(FhevmHostContracts.FHEVMExecutor, remote));
        assertEq(IFHEVMExecutor(deployedExecutor).getACLAddress(), acl, "executor -> acl");
        assertEq(IFHEVMExecutor(deployedExecutor).getInputVerifierAddress(), inputVerifier, "executor -> inputVerifier");
        assertEq(IFHEVMExecutor(deployedExecutor).getHCULimitAddress(), hcuLimit, "executor -> hcuLimit");

        address deployedAcl = _deploy(LibHostUpgradeCode.creationCodeFor(FhevmHostContracts.ACL, remote));
        assertEq(IACL(deployedAcl).getFHEVMExecutorAddress(), executor, "acl -> executor");
        assertEq(IACL(deployedAcl).getPauserSetAddress(), pauserSet, "acl -> pauserSet");

        address deployedHcu = _deploy(LibHostUpgradeCode.creationCodeFor(FhevmHostContracts.HCULimit, remote));
        assertEq(IHCULimitAddresses(deployedHcu).getFHEVMExecutorAddress(), executor, "hcuLimit -> executor");
    }

    /// The same, for the set the blobs ship with: a patch that is a no-op must still deploy and answer.
    function test_theCanonicalImplementationStillDeploysAndAnswers() public {
        address deployed = _deploy(LibHostUpgradeCode.creationCodeFor(FhevmHostContracts.FHEVMExecutor, _canonical()));
        assertEq(
            IFHEVMExecutor(deployed).getACLAddress(),
            LocalHostUpgrade.canonicalAddress(FhevmAddressRole.ACL),
            "executor -> canonical acl"
        );
    }

    // ---------------------------------------------------------------------------------------------
    // Address sets with structure
    // ---------------------------------------------------------------------------------------------

    /// A splice must not care what it is writing. These are the shapes most likely to prove otherwise.
    function test_anyAddressSetWorks() public pure {
        address[10] memory leadingZeros;
        address[10] memory allOnes;
        address[10] memory allTheSame;
        address[10] memory shuffledCanonical;
        address[10] memory canonical = _canonical();

        for (uint256 role = 0; role < ROLES; role++) {
            // One significant byte, nineteen leading zeros: the shape an optimizer would shorten a PUSH
            // for, if this were a compile rather than a splice.
            leadingZeros[role] = address(uint160(role + 1));
            allOnes[role] = address(type(uint160).max);
            allTheSame[role] = address(uint160(uint256(keccak256("one address for every role"))));
            // Every role given ANOTHER role's canonical address: the verify step must key off position,
            // not off the value happening to be "a canonical address".
            shuffledCanonical[role] = canonical[(role + 1) % ROLES];
        }

        FhevmHostContracts[] memory all = _contracts();
        for (uint256 i = 0; i < all.length; i++) {
            bytes memory original = LocalHostUpgrade.creationCode(all[i]);
            bytes memory sites = LocalHostUpgrade.patchSites(all[i]);

            _assertRoundTrips(all[i], original, sites, leadingZeros);
            _assertRoundTrips(all[i], original, sites, allOnes);
            _assertRoundTrips(all[i], original, sites, allTheSame);
            _assertRoundTrips(all[i], original, sites, shuffledCanonical);
        }
    }

    function _assertRoundTrips(
        FhevmHostContracts contractId,
        bytes memory original,
        bytes memory sites,
        address[10] memory set
    ) private pure {
        bytes memory patched = LibHostUpgradeCode.creationCodeFor(contractId, set);
        assertEq(patched.length, original.length, "length");
        assertEq(LibHostUpgradeCode.patch(patched, sites, set, _canonical()), original, "reversible for any set");
    }

    // ---------------------------------------------------------------------------------------------
    // Refusals
    // ---------------------------------------------------------------------------------------------

    function test_RevertIf_theTableIsNotWholeRecords() public {
        vm.expectRevert(abi.encodeWithSelector(LibHostUpgradeCode.MalformedSiteTable.selector, 3));
        this.patchExternally(hex"00112233445566", hex"000000", _canonical(), _remote());
    }

    function test_RevertIf_aSitePointsPastTheEnd() public {
        // One record, role 0, offset 100, against ten bytes of code.
        bytes memory sites = hex"0000000064";
        vm.expectRevert(abi.encodeWithSelector(LibHostUpgradeCode.SiteOutOfRange.selector, 100, 10));
        this.patchExternally(hex"00112233445566778899", sites, _canonical(), _remote());
    }

    /// The one that matters: the table and the bytecode disagree, so nothing is overwritten.
    function test_RevertIf_theBytecodeDoesNotHoldTheAddressTheTableClaims() public {
        bytes memory code = new bytes(40);
        bytes memory sites = hex"0000000000"; // role 0 (ACL) at offset 0
        vm.expectRevert(
            abi.encodeWithSelector(
                LibHostUpgradeCode.UnexpectedAddressAtSite.selector,
                0,
                address(0),
                LocalHostUpgrade.canonicalAddress(FhevmAddressRole.ACL)
            )
        );
        this.patchExternally(code, sites, _canonical(), _remote());
    }

    function test_RevertIf_aReferencedRoleHasNoAddress() public {
        address[10] memory incomplete = _remote();
        incomplete[uint8(FhevmAddressRole.ACL)] = address(0);

        // FHEVMExecutor references ACL, so the gap is reached rather than ignored.
        vm.expectRevert(abi.encodeWithSelector(LibHostUpgradeCode.NoAddressForRole.selector, FhevmAddressRole.ACL));
        this.creationCodeForExternally(FhevmHostContracts.FHEVMExecutor, incomplete);
    }

    /// A role no site references may stay zero: the loop never reaches it.
    function test_anUnreferencedRoleMayBeZero() public pure {
        address[10] memory set = _remote();
        set[uint8(FhevmAddressRole.CleartextDB)] = address(0);

        // The vendored implementations know nothing about the cleartext contracts.
        assertGt(LibHostUpgradeCode.creationCodeFor(FhevmHostContracts.FHEVMExecutor, set).length, 0, "patched");
    }

    // External wrappers, so `vm.expectRevert` has a call frame to catch.
    function patchExternally(
        bytes calldata code,
        bytes calldata sites,
        address[10] calldata expected,
        address[10] calldata replacement
    ) external pure returns (bytes memory) {
        return LibHostUpgradeCode.patch(code, sites, expected, replacement);
    }

    function creationCodeForExternally(FhevmHostContracts contractId, address[10] calldata set)
        external
        pure
        returns (bytes memory)
    {
        return LibHostUpgradeCode.creationCodeFor(contractId, set);
    }

    // ---------------------------------------------------------------------------------------------
    // Helpers, written out rather than shared with the library under test
    // ---------------------------------------------------------------------------------------------

    function _deploy(bytes memory creationCode) private returns (address deployed) {
        assembly {
            deployed := create(0, add(creationCode, 0x20), mload(creationCode))
        }
        require(deployed != address(0), "deploy failed");
    }

    function _record(bytes memory sites, uint256 at) private pure returns (uint8 role, uint256 offset) {
        role = uint8(sites[at]);
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

    function _isInsideASite(bytes memory sites, uint256 index) private pure returns (bool) {
        for (uint256 at = 0; at < sites.length; at += LocalHostUpgrade.SITE_RECORD_BYTES) {
            (, uint256 offset) = _record(sites, at);
            if (index >= offset && index < offset + 20) return true;
        }
        return false;
    }

    /// @dev Every 20-byte window of `code`, against the whole set at once.
    ///      One `mload` per window rather than the twenty bounds-checked byte reads `_addressAt` does:
    ///      the naive version costs about a billion gas over these blobs and simply runs out.
    function _findAny(bytes memory code, address[10] memory set)
        private
        pure
        returns (bool found, address which, uint256 at)
    {
        if (code.length < 20) return (false, address(0), 0);

        for (uint256 offset = 0; offset + 20 <= code.length; offset++) {
            uint256 word;
            assembly {
                // Reads 32 bytes; only the top 20 are used, so the tail past the array is discarded.
                word := mload(add(add(code, 0x20), offset))
            }
            address candidate = address(uint160(word >> 96));
            for (uint256 role = 0; role < ROLES; role++) {
                if (candidate == set[role]) return (true, candidate, offset);
            }
        }
        return (false, address(0), 0);
    }
}
