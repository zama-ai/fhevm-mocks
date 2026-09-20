// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {ForgeFhevmDeploy} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {FHEVM_EXECUTOR_ADDRESS} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {ICleartextFHEVMExecutor} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {ICleartextInputVerifier} from "../../pkg/forge/src/_internal/interfaces/ICleartextInputVerifier.sol";
import {LibForgeFhevmEncrypt} from "../../pkg/forge/src/LibForgeFhevmEncrypt.sol";
import {FheType} from "../../pkg/forge/src/shared/LibFheType.sol";
import {Bits} from "../utils/Bits.sol";

/**
 * `LibForgeFhevmEncrypt` produces a bundle the real `InputVerifier` accepts, and the cleartext survives
 * the round trip.
 *
 * The library is only useful if the stack agrees with it, and the stack is the judge: a handle derived
 * even slightly differently, or a digest signed over the wrong bytes, is rejected. So the control test is
 * the whole point, and the negative tests exist to prove the control is not passing by accident — a proof
 * that verified no matter what it contained would prove nothing.
 *
 * Type ids are written `uint8(FheType.Uint32)` rather than the bare ordinal. The library takes `uint8`
 * because a dApp cannot see that enum, but a test in this package can, and deriving the ordinal means a
 * reordering of `FheType` fails here instead of silently minting handles of the wrong type.
 *
 * `verifyInput` is called directly rather than through `FHE.fromExternal`, which is what a dApp would use.
 * They are the same call: `fromExternal` forwards to the executor with `msg.sender` as the bound contract.
 * The FHE library is not a dependency of this package, so reaching for it here is not possible.
 */
contract LibForgeFhevmEncryptTest is Test, ForgeFhevmDeploy {
    address internal alice;
    address internal bob;

    function setUp() public {
        deployLocalFhevm();
        alice = vm.addr(uint256(keccak256("alice")));
        bob = vm.addr(uint256(keccak256("bob")));
    }

    // ---------------------------------------------------------------------------------------------
    // Control: the stack accepts what the library produces
    // ---------------------------------------------------------------------------------------------

    function test_singleValueIsAcceptedAndTheCleartextSurvives() public {
        (uint8[] memory typeIds, uint256[] memory values) = _one(uint8(FheType.Uint32), 4242);
        (bytes32[] memory handles, bytes memory proof) =
            LibForgeFhevmEncrypt.encrypt(typeIds, values, address(this), alice);

        bytes32 result = _verify(handles[0], alice, proof, FheType.Uint32);
        assertEq(_plaintext(result), 4242, "the cleartext did not survive verifyInput");
    }

    /// Several values in one bundle: every handle verifies against the same proof, and each carries its
    /// own value. A bundle that only worked for its first entry would pass the test above.
    function test_everyValueInABundleSurvives() public {
        uint8[] memory typeIds = new uint8[](3);
        uint256[] memory values = new uint256[](3);
        typeIds[0] = uint8(FheType.Uint32);
        values[0] = 1;
        typeIds[1] = uint8(FheType.Uint64);
        values[1] = type(uint64).max;
        typeIds[2] = uint8(FheType.Uint32);
        values[2] = 7;

        (bytes32[] memory handles, bytes memory proof) =
            LibForgeFhevmEncrypt.encrypt(typeIds, values, address(this), alice);

        assertEq(_plaintext(_verify(handles[0], alice, proof, FheType.Uint32)), 1, "value 0");
        assertEq(_plaintext(_verify(handles[1], alice, proof, FheType.Uint64)), type(uint64).max, "value 1");
        assertEq(_plaintext(_verify(handles[2], alice, proof, FheType.Uint32)), 7, "value 2");
    }

    /// The `abi.encode(typeId, value, ...)` overload is a front end for the array form, so it must produce
    /// a bundle the stack accepts too.
    function test_pairEncodedOverloadIsAlsoAccepted() public {
        (bytes32[] memory handles, bytes memory proof) = LibForgeFhevmEncrypt.encrypt(
            abi.encode(uint8(FheType.Uint32), uint256(99), uint8(FheType.Uint64), uint256(100)), address(this), alice
        );

        assertEq(handles.length, 2, "one handle per pair");
        assertEq(_plaintext(_verify(handles[0], alice, proof, FheType.Uint32)), 99, "first pair");
        assertEq(_plaintext(_verify(handles[1], alice, proof, FheType.Uint64)), 100, "second pair");
    }

    /// The blob carries a random nonce per value, so the same input twice must not collide. Reusing a
    /// handle would silently alias two distinct inputs in the DB.
    function test_theSameValueTwiceYieldsDifferentHandles() public {
        (uint8[] memory typeIds, uint256[] memory values) = _one(uint8(FheType.Uint32), 4242);
        (bytes32[] memory first,) = LibForgeFhevmEncrypt.encrypt(typeIds, values, address(this), alice);
        (bytes32[] memory second,) = LibForgeFhevmEncrypt.encrypt(typeIds, values, address(this), alice);

        assertNotEq(first[0], second[0], "handles must not repeat across calls");
    }

    // ---------------------------------------------------------------------------------------------
    // The bundle is bound to its contract, its user and its bytes
    // ---------------------------------------------------------------------------------------------

    /// Both addresses go into the metadata the handle hashes over AND into the signed digest, so a bundle
    /// minted for another dApp cannot be replayed here.
    function test_aProofBoundToAnotherContractIsRejected() public {
        (uint8[] memory typeIds, uint256[] memory values) = _one(uint8(FheType.Uint32), 4242);
        (bytes32[] memory handles, bytes memory proof) =
            LibForgeFhevmEncrypt.encrypt(typeIds, values, address(0xBEEF), alice);

        _expectSignatureRejection(handles[0], alice, proof, FheType.Uint32);
    }

    function test_aProofBoundToAnotherUserIsRejected() public {
        (uint8[] memory typeIds, uint256[] memory values) = _one(uint8(FheType.Uint32), 4242);
        (bytes32[] memory handles, bytes memory proof) =
            LibForgeFhevmEncrypt.encrypt(typeIds, values, address(this), alice);

        _expectSignatureRejection(handles[0], bob, proof, FheType.Uint32);
    }

    /// The cleartext region is inside the signed digest, so editing the value the stack would read back
    /// invalidates the signatures rather than quietly changing the result.
    function test_tamperingWithTheCleartextRegionIsRejected() public {
        (uint8[] memory typeIds, uint256[] memory values) = _one(uint8(FheType.Uint32), 4242);
        (bytes32[] memory handles, bytes memory proof) =
            LibForgeFhevmEncrypt.encrypt(typeIds, values, address(this), alice);

        // Last byte of the value word: 1 handle, 1 signature => 2 + 32 + 65 + 32 - 1.
        proof[2 + 32 + 65 + 32 - 1] ^= bytes1(uint8(1));

        _expectSignatureRejection(handles[0], alice, proof, FheType.Uint32);
    }

    // ---------------------------------------------------------------------------------------------
    // Every bit of the proof is load-bearing
    // ---------------------------------------------------------------------------------------------
    //
    // Layout, as `encrypt` packs it:
    //
    //   byte 0             number of handles
    //   byte 1             number of signatures (the coprocessor threshold)
    //   32 * n             handles
    //   65 * threshold     signatures (r, s, v)
    //   32 * n + 1         cleartextExtraData: the values, then the v0 extraData byte
    //
    // A proof that still verified after an edit would mean some region is not actually authenticated.

    function test_flippingTheHandleCountToZeroIsRejected() public {
        _assertFlipRejected(0, "handle count -> 0");
    }

    function test_flippingTheHandleCountUpIsRejected() public {
        _assertFlipRejected(1, "handle count -> 2");
    }

    function test_flippingTheSignatureCountIsRejected() public {
        _assertFlipRejected(8, "signature count low bit");
    }

    function test_flippingAHandleByteIsRejected() public {
        _assertFlipRejected(2 * 8, "first byte of the handle");
    }

    function test_flippingASignatureByteIsRejected() public {
        _assertFlipRejected((2 + 32) * 8, "first byte of the first signature");
    }

    /// The exhaustive claim: no single bit anywhere in the proof can be changed and still verify.
    function test_noSingleFlippedBitIsAccepted() public {
        (bytes32 handle, bytes memory proof) = _proof();
        uint256 bits = proof.length * 8;
        for (uint256 bit = 0; bit < bits; bit++) {
            bytes memory tampered = bytes.concat(proof);
            Bits.flip(tampered, bit);
            _singleChangedByte(proof, tampered);
            assertTrue(_verifyReverts(handle, tampered), "a flipped bit was accepted");
        }
    }

    /// The same claim under the fuzzer, against a fresh proof each run — so it is not one bundle's luck.
    function testFuzz_noFlippedBitIsAccepted(uint256 bit) public {
        (bytes32 handle, bytes memory proof) = _proof();
        bytes memory tampered = bytes.concat(proof);
        Bits.flip(tampered, bit % (proof.length * 8));
        assertTrue(_verifyReverts(handle, tampered), "a flipped bit was accepted");
    }

    // ---------------------------------------------------------------------------------------------
    // The library's own guards
    // ---------------------------------------------------------------------------------------------

    function test_mismatchedArrayLengthsRevert() public {
        uint8[] memory typeIds = new uint8[](2);
        uint256[] memory values = new uint256[](1);
        vm.expectRevert(abi.encodeWithSelector(LibForgeFhevmEncrypt.InputLengthMismatch.selector, 2, 1));
        this.callEncrypt(typeIds, values);
    }

    function test_anEmptyBundleReverts() public {
        vm.expectRevert(abi.encodeWithSelector(LibForgeFhevmEncrypt.TooManyInputs.selector, 0));
        this.callEncrypt(new uint8[](0), new uint256[](0));
    }

    /// One byte of the handle holds the index, and `InputVerifier` rejects anything above 254.
    function test_moreThan254InputsReverts() public {
        vm.expectRevert(abi.encodeWithSelector(LibForgeFhevmEncrypt.TooManyInputs.selector, 255));
        this.callEncrypt(new uint8[](255), new uint256[](255));
    }

    function test_aPairBufferThatIsNotAMultipleOf64Reverts() public {
        vm.expectRevert(abi.encodeWithSelector(LibForgeFhevmEncrypt.MalformedTypeValuePairs.selector, 32));
        this.callEncryptPairs(new bytes(32));
    }

    /// The array form takes `uint8` and cannot express this; the pair form takes a full word, where
    /// narrowing 256 to 0 would mint a `Bool` handle that verifies and decrypts to the wrong thing.
    function test_anOutOfRangeTypeIdReverts() public {
        vm.expectRevert(abi.encodeWithSelector(LibForgeFhevmEncrypt.InvalidFheTypeId.selector, 256));
        this.callEncryptPairs(abi.encode(uint256(256), uint256(1)));
    }

    // ---------------------------------------------------------------------------------------------
    // Helpers. The `call*` ones are external so `vm.expectRevert` sees a call boundary.
    // ---------------------------------------------------------------------------------------------

    /**
     * @dev The bundle must be rejected BY SIGNATURE VERIFICATION, and the exact error is not stable.
     *      A changed digest makes `ECDSA.recover` either return an address that is not a registered
     *      signer (`InvalidSigner`) or fail outright (`ECDSAInvalidSignature`/`...S`). Which one depends
     *      on the signature bytes, and the random per-value nonce makes those different on every run, so
     *      pinning one selector gives a test that passes until it does not.
     *
     *      Accepting the three still pins the interesting part: it failed in signature verification, and
     *      not somewhere earlier that would mean the test never exercised what it claims to.
     */
    function _expectSignatureRejection(bytes32 handle, address user, bytes memory proof, FheType fheType) private {
        try this.callVerifyInput(handle, user, proof, fheType) {
            revert("the proof was accepted, but its digest should not match");
        } catch (bytes memory err) {
            bytes4 selector;
            assembly {
                selector := mload(add(err, 32))
            }
            assertTrue(
                selector == ICleartextInputVerifier.InvalidSigner.selector
                    || selector == ICleartextInputVerifier.ECDSAInvalidSignature.selector
                    || selector == ICleartextInputVerifier.ECDSAInvalidSignatureS.selector,
                "rejected, but not by signature verification"
            );
        }
    }

    function _proof() private returns (bytes32 handle, bytes memory proof) {
        (uint8[] memory typeIds, uint256[] memory values) = _one(uint8(FheType.Uint32), 4242);
        bytes32[] memory handles;
        (handles, proof) = LibForgeFhevmEncrypt.encrypt(typeIds, values, address(this), alice);
        handle = handles[0];
    }

    /// @dev Flips one bit of a fresh proof and requires the result to be rejected.
    function _assertFlipRejected(uint256 bit, string memory what) private {
        (bytes32 handle, bytes memory proof) = _proof();
        Bits.flip(proof, bit);
        assertTrue(_verifyReverts(handle, proof), string.concat("accepted after flipping ", what));
    }

    /// @dev True when `verifyInput` rejects the bundle. The selector is deliberately not pinned: which
    ///      error a given region raises depends on how far the verifier gets, and for the signature bytes
    ///      it depends on the random nonce too. What matters is that nothing gets through.
    function _verifyReverts(bytes32 handle, bytes memory proof) private returns (bool) {
        try this.callVerifyInput(handle, alice, proof, FheType.Uint32) {
            return false;
        } catch {
            return true;
        }
    }

    /// @dev Exactly one byte differs, by exactly one bit — so a broken flip helper is caught here rather
    ///      than mistaken for a property of the verifier.
    function _singleChangedByte(bytes memory original, bytes memory tampered) private pure {
        assertEq(original.length, tampered.length, "tampering changed the length");
        bool found;
        for (uint256 i = 0; i < original.length; i++) {
            if (original[i] == tampered[i]) continue;
            assertFalse(found, "more than one byte changed");
            uint8 diff = uint8(original[i]) ^ uint8(tampered[i]);
            assertEq(diff & (diff - 1), 0, "more than one bit changed");
            found = true;
        }
        assertTrue(found, "no byte changed");
    }

    function callVerifyInput(bytes32 handle, address user, bytes calldata proof, FheType fheType) external {
        ICleartextFHEVMExecutor(FHEVM_EXECUTOR_ADDRESS).verifyInput(handle, user, proof, fheType);
    }

    function callEncrypt(uint8[] calldata typeIds, uint256[] calldata values) external {
        LibForgeFhevmEncrypt.encrypt(typeIds, values, address(this), alice);
    }

    function callEncryptPairs(bytes calldata pairs) external {
        LibForgeFhevmEncrypt.encrypt(pairs, address(this), alice);
    }

    function _one(uint8 typeId, uint256 value) private pure returns (uint8[] memory typeIds, uint256[] memory values) {
        typeIds = new uint8[](1);
        values = new uint256[](1);
        typeIds[0] = typeId;
        values[0] = value;
    }

    function _verify(bytes32 handle, address user, bytes memory proof, FheType fheType) private returns (bytes32) {
        return ICleartextFHEVMExecutor(FHEVM_EXECUTOR_ADDRESS).verifyInput(handle, user, proof, fheType);
    }

    function _plaintext(bytes32 handle) private view returns (uint256) {
        return ICleartextFHEVMExecutor(FHEVM_EXECUTOR_ADDRESS).plaintexts(handle);
    }
}
