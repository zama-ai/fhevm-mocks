// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, ebool, eaddress, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";

import {TestFhevm} from "../../pkg/src/TestFhevm.sol";
import {Vault} from "../encrypt/Vault.sol";

/// `tryPlaintextOf` is `hasPlaintext` and `plaintextOf` in one call: `(exists, clear)`. It never reverts
/// for a value the stack does not hold, and it keeps "the value is 0" apart from "there is no value".
contract TryPlaintextOfTest is TestFhevm {
    Vault internal vault;
    address internal alice;

    function setUp() public override {
        super.setUp();
        vault = new Vault();
        alice = makeAddr("alice");
    }

    /// The zero word: no value, placeholder zero, no revert.
    function test_theZeroWordDoesNotExistAndReadsAsAPlaceholderZero() public {
        (bool exists, uint64 clear) = tryPlaintextOf(euint64.wrap(bytes32(0)));
        assertFalse(exists);
        assertEq(clear, 0);
    }

    /// A stored value exists and reads back — the same answer `plaintextOf` gives.
    function test_aStoredValueExistsAndReadsBack() public {
        _store(7);
        (bool exists, uint64 clear) = tryPlaintextOf(vault.eUint64());
        assertTrue(exists);
        assertEq(clear, 7);
        assertEq(clear, plaintextOf(vault.eUint64()));
    }

    /// A stored ZERO exists: this is the case an `orZero` reader could not tell from the zero word.
    function test_aStoredZeroExists() public {
        _store(0);
        (bool exists, uint64 clear) = tryPlaintextOf(vault.eUint64());
        assertTrue(exists, "the stack holds a value, and that value is zero");
        assertEq(clear, 0);
    }

    /// A well-formed handle this stack never computed: initialized for the dApp, absent here.
    function test_anUnknownButWellFormedHandleDoesNotExist() public {
        _store(7);
        bytes32 unknown = euint64.unwrap(vault.eUint64()) ^ bytes32(uint256(1) << 200);
        assertTrue(FHE.isInitialized(euint64.wrap(unknown)));
        (bool exists, uint64 clear) = tryPlaintextOf(euint64.wrap(unknown));
        assertFalse(exists);
        assertEq(clear, 0);
    }

    /// Every typed overload agrees with `hasPlaintext` on the zero word, whatever the type's zero is.
    function test_everyTypeAgreesWithHasPlaintextOnTheZeroWord() public {
        (bool eb, bool b) = tryPlaintextOf(ebool.wrap(bytes32(0)));
        assertFalse(eb);
        assertFalse(b);
        (bool ea, address a) = tryPlaintextOf(eaddress.wrap(bytes32(0)));
        assertFalse(ea);
        assertEq(a, address(0));
        assertFalse(hasPlaintext(ebool.wrap(bytes32(0))));
        assertFalse(hasPlaintext(eaddress.wrap(bytes32(0))));
    }

    function _store(uint64 value) internal {
        (externalEuint64 input, bytes memory proof) = encryptUint64(value, address(vault), alice);
        vm.prank(alice);
        vault.setEUint64(input, proof);
    }
}
