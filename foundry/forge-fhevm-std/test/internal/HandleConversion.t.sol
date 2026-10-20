// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {euint32, euint64, externalEuint32} from "encrypted-types/EncryptedTypes.sol";

import {TestFhevm} from "../../pkg/src/TestFhevm.sol";
import {LibFhevmFail} from "../../pkg/src/LibFhevmFail.sol";
import {LibFhevmHandle} from "../../pkg/src/_host/shared/LibFhevmHandle.sol";

import {FHETest} from "../fheTest/FHETest.sol";

/**
 * A RAW `bytes32` IS NOT YET A VALUE, and these say so rather than wrapping it.
 *
 * A handle read out of a dApp's storage, decoded from an event or pasted from a trace arrives untyped.
 * Wrapping it blind produces a value that LOOKS right and answers wrongly: a `euint32` handle wrapped as
 * `euint64` reads at the wrong width, and a handle from another chain names a slot in THIS chain's store
 * that belongs to something else. Both are silent. So the conversion checks what the handle says about
 * itself -- it carries its own type, chain and initialised-ness -- and refuses when it disagrees.
 *
 * AND THERE ARE TWO KINDS. Byte 21 is `0xff` on everything the executor computes and a batch position on
 * an input, so a handle says which family it belongs to. `toEuint32` takes the first, `toExternalEuint32`
 * the second, and each refuses the other -- otherwise a test hands a dApp an `externalEuint32` the input
 * verifier will reject, for a reason nowhere near the line that made it.
 */
contract HandleConversionTest is TestFhevm {
    FHETest internal dapp;

    function setUp() public override {
        super.setUp();
        dapp = new FHETest();
    }

    /// The ordinary case: a handle this stack minted, converted as what it is, still reads correctly.
    function test_aHandleConvertsToItsOwnType() public {
        resetHCU();
        bytes32 raw = euint32.unwrap(dapp.setClearEuint32(7, false));

        euint32 typed = toEuint32(raw);

        assertEq(plaintextOf(typed), 7, "the value survives the round trip through bytes32");
    }

    /// Every type has one, and each accepts only its own.
    function test_eachTypeAcceptsItsOwn() public {
        resetHCU();
        bytes32 raw32 = euint32.unwrap(dapp.setClearEuint32(1, false));
        resetHCU();
        bytes32 raw64 = euint64.unwrap(dapp.setClearEuint64(2, false));

        assertEq(plaintextOf(toEuint32(raw32)), 1, "euint32");
        assertEq(plaintextOf(toEuint64(raw64)), 2, "euint64");
    }

    /// THE POINT: asking for the wrong type is refused, and the message names both sides.
    function test_RevertIf_theHandleIsAnotherType() public {
        resetHCU();
        bytes32 raw32 = euint32.unwrap(dapp.setClearEuint32(7, false));

        vm.expectRevert(bytes(LibFhevmFail.handleTypeMismatch(raw32, "euint64", "euint32")));
        this.toEuint64Externally(raw32);
    }

    /// The zero word is uninitialised, not "chain 0" -- the stack's own distinction, reported as its own.
    function test_RevertIf_theHandleIsUninitialized() public {
        vm.expectRevert(abi.encodeWithSelector(LibFhevmHandle.CleartextErrorHandleUninitialized.selector, bytes32(0)));
        this.toEuint32Externally(bytes32(0));
    }

    /// A handle minted on another chain names nothing here, and is refused before it can answer.
    function test_RevertIf_theHandleIsFromAnotherChain() public {
        resetHCU();
        bytes32 mine = euint32.unwrap(dapp.setClearEuint32(7, false));
        // Same handle, one chain-id byte changed: bytes 22..29 carry the chain it was minted on.
        bytes32 foreign = mine ^ bytes32(uint256(1) << 16);

        vm.expectRevert();
        this.toEuint32Externally(foreign);
    }

    // -- The other kind: inputs ---------------------------------------------------------------------

    /// An input handle converts as an input, and the dApp accepts it -- which is the real test of it.
    function test_anInputHandleConvertsAndIsUsable() public {
        address alice = makeAddr("alice");
        // `addEuint32` adds to what the account already holds, so it needs something to add to.
        resetHCU();
        vm.prank(alice);
        dapp.setClearEuint32(1, false);

        resetHCU();
        (externalEuint32 input, bytes memory proof) = encryptUint32(5, address(dapp), alice);

        externalEuint32 roundTripped = toExternalEuint32(externalEuint32.unwrap(input));

        vm.prank(alice);
        dapp.addEuint32(roundTripped, proof, 5, false);
        assertEq(plaintextOf(dapp.getEuint32Of(alice)), 6, "1 + the converted input's 5");
    }

    /// A COMPUTED handle is not an input, and says so rather than producing one a dApp would reject.
    function test_RevertIf_aComputedHandleIsConvertedAsAnInput() public {
        resetHCU();
        bytes32 computed = euint32.unwrap(dapp.setClearEuint32(7, false));

        vm.expectRevert(bytes(LibFhevmFail.handleWrongKind(computed, false, 0xff)));
        this.toExternalEuint32Externally(computed);
    }

    /// And the reverse: an input handle is not something the stack computed.
    function test_RevertIf_anInputHandleIsConvertedAsComputed() public {
        address alice = makeAddr("alice");
        (externalEuint32 input,) = encryptUint32(5, address(dapp), alice);
        bytes32 raw = externalEuint32.unwrap(input);

        vm.expectRevert(bytes(LibFhevmFail.handleWrongKind(raw, true, LibFhevmHandle.indexOf(raw))));
        this.toEuint32Externally(raw);
    }

    // -- External wrappers, so `vm.expectRevert` has a call frame to catch --------------------------

    function toExternalEuint32Externally(bytes32 handle) external view returns (externalEuint32) {
        return toExternalEuint32(handle);
    }

    function toEuint32Externally(bytes32 handle) external view returns (euint32) {
        return toEuint32(handle);
    }

    function toEuint64Externally(bytes32 handle) external view returns (euint64) {
        return toEuint64(handle);
    }
}
