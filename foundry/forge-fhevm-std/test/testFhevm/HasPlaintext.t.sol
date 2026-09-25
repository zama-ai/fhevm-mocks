// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";

import {TestFhevm} from "../../pkg/src/TestFhevm.sol";
import {LibFhevmHandle} from "../../pkg/src/_host/shared/LibFhevmHandle.sol";
import {Vault} from "../encrypt/Vault.sol";

/// `hasPlaintext` is the predicate to `plaintextOf`: it never reverts, and it is false exactly where
/// `plaintextOf` refuses. The zero word — an encrypted value nothing ever wrote to — is the case a test
/// meets most: a confidential balance that was never credited.
contract HasPlaintextTest is TestFhevm {
    Vault internal vault;
    address internal alice;

    function setUp() public override {
        super.setUp();
        vault = new Vault();
        alice = makeAddr("alice");
    }

    /// The zero word: not initialized, so the stack holds nothing for it — and reading it is refused BY NAME,
    /// not as a chain mismatch (the zero word carries chain id 0, which is what it used to fail on).
    function test_theZeroWordHasNoPlaintextAndReadsAreRefusedByName() public {
        euint64 never = euint64.wrap(bytes32(0));
        assertFalse(FHE.isInitialized(never), "what the dApp can check on chain");
        assertFalse(hasPlaintext(never), "what the stack knows: nothing");

        vm.expectRevert(abi.encodeWithSelector(LibFhevmHandle.CleartextErrorHandleUninitialized.selector, bytes32(0)));
        this.plaintextOfExternally(never);
    }

    /// A value the stack computed is known, and reads back.
    function test_aStoredValueHasAPlaintext() public {
        (externalEuint64 input, bytes memory proof) = encryptUint64(7, address(vault), alice);
        vm.prank(alice);
        vault.setEUint64(input, proof);

        assertTrue(hasPlaintext(vault.eUint64()));
        assertEq(plaintextOf(vault.eUint64()), 7);
    }

    /// A well-formed handle this stack never computed: initialized as far as the dApp can tell, unknown here.
    function test_anUnknownButWellFormedHandleHasNoPlaintext() public {
        (externalEuint64 input, bytes memory proof) = encryptUint64(7, address(vault), alice);
        vm.prank(alice);
        vault.setEUint64(input, proof);
        bytes32 real = euint64.unwrap(vault.eUint64());
        // Same chain id and type bytes, a different hash: nothing was ever computed under it.
        bytes32 unknown = real ^ bytes32(uint256(1) << 200);

        assertTrue(FHE.isInitialized(euint64.wrap(unknown)), "non-zero, so initialized as far as a dApp knows");
        assertFalse(hasPlaintext(euint64.wrap(unknown)), "but this stack holds nothing for it");
    }

    /// External so `vm.expectRevert` has a call frame to catch.
    function plaintextOfExternally(euint64 value) external returns (uint64) {
        return plaintextOf(value);
    }
}
