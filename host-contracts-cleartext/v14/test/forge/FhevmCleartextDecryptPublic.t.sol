// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {FhevmCleartextDeploy} from "../../pkg/forge/src/FhevmCleartextDeploy.sol";
import {ACL_ADDRESS, FHEVM_EXECUTOR_ADDRESS, KMS_VERIFIER_ADDRESS} from "../../pkg/forge/src/FhevmCleartextDeploy.sol";
import {ICleartextACL} from "../../pkg/forge/src/FhevmCleartextDeploy.sol";
import {ICleartextFHEVMExecutor} from "../../pkg/forge/src/FhevmCleartextDeploy.sol";
import {ICleartextKMSVerifier} from "../../pkg/forge/src/_internal/interfaces/ICleartextKMSVerifier.sol";
import {FhevmCleartextEncrypt} from "../../pkg/forge/src/FhevmCleartextEncrypt.sol";
import {FhevmCleartextDecryptPublic} from "../../pkg/forge/src/FhevmCleartextDecryptPublic.sol";
import {FheType} from "../../pkg/src/contracts/shared/FheType.sol";
import {Bits} from "../utils/Bits.sol";

/**
 * `FhevmCleartextDecryptPublic` produces a result the real `KMSVerifier` accepts, and the values it
 * carries are the ones the stack holds.
 *
 * Same shape as `FhevmCleartextEncrypt.t.sol`, for the same reason: the library is only useful if the
 * stack agrees with it, so the control tests are the point and the negative tests exist to prove the
 * control is not passing by accident.
 *
 * This path differs from the input path in one way worth stating. It is ACCESS-CONTROLLED: the stack
 * refuses any handle not marked publicly decryptable, so a test that gets a result has also proved the
 * dApp called `FHE.makePubliclyDecryptable`. That gate is exercised below.
 */
contract FhevmCleartextDecryptPublicTest is Test, FhevmCleartextDeploy {
    address internal alice;

    function setUp() public {
        deployLocalFhevm();
        alice = vm.addr(uint256(keccak256("alice")));
    }

    // ---------------------------------------------------------------------------------------------
    // Control: the stack accepts what the library produces
    // ---------------------------------------------------------------------------------------------

    function test_aPubliclyDecryptableHandleYieldsAVerifiableProof() public {
        bytes32[] memory handles = _decryptable(4242);

        (bytes memory values, bytes memory proof) = FhevmCleartextDecryptPublic.decryptPublicWithProof(handles);

        assertEq(abi.decode(values, (uint256)), 4242, "the clear value is not the one the stack holds");
        assertTrue(_verify(handles, values, proof), "the KMS verifier rejected an untouched proof");
    }

    /// Several handles at once: each word of the result is its own handle's value, in handle order.
    function test_everyHandleInABatchCarriesItsOwnValue() public {
        bytes32[] memory handles = new bytes32[](3);
        handles[0] = _mint(uint8(FheType.Uint32), 1);
        handles[1] = _mint(uint8(FheType.Uint64), type(uint64).max);
        handles[2] = _mint(uint8(FheType.Uint32), 7);
        ICleartextACL(ACL_ADDRESS).allowForDecryption(handles);

        (bytes memory values, bytes memory proof) = FhevmCleartextDecryptPublic.decryptPublicWithProof(handles);

        (uint256 a, uint256 b, uint256 c) = abi.decode(values, (uint256, uint256, uint256));
        assertEq(a, 1, "value 0");
        assertEq(b, type(uint64).max, "value 1");
        assertEq(c, 7, "value 2");
        assertTrue(_verify(handles, values, proof), "the KMS verifier rejected an untouched batch");
    }

    /// The proof carries a signature from EVERY registered KMS signer, not a threshold-sized subset.
    /// That is what a real KMS quorum produces, and what the js-sdk relayer signs for this path.
    function test_theProofCarriesOneSignaturePerRegisteredSigner() public {
        bytes32[] memory handles = _decryptable(4242);
        (, bytes memory proof) = FhevmCleartextDecryptPublic.decryptPublicWithProof(handles);

        uint256 signerCount = ICleartextKMSVerifier(KMS_VERIFIER_ADDRESS).getKmsSigners().length;
        assertEq(uint8(proof[0]), signerCount, "the proof's signer count");
        assertGe(proof.length, 1 + 65 * signerCount, "the proof is too short for that many signatures");
    }

    // ---------------------------------------------------------------------------------------------
    // The access-control gate
    // ---------------------------------------------------------------------------------------------

    /// The difference between this path and peeking at `plaintexts`: a handle nobody made publicly
    /// decryptable is refused, so a passing test also proves the dApp granted it.
    function test_aHandleNotMarkedForDecryptionIsRefused() public {
        bytes32[] memory handles = new bytes32[](1);
        handles[0] = _mint(uint8(FheType.Uint32), 4242);

        vm.expectPartialRevert(ICleartextKMSVerifier.CleartextErrorHandleNotAllowedForPublicDecryption.selector);
        this.callDecryptPublic(handles);
    }

    /// One ungranted handle spoils the batch, rather than being quietly dropped from the result.
    function test_oneUngrantedHandleRefusesTheWholeBatch() public {
        bytes32[] memory granted = _decryptable(1);
        bytes32[] memory handles = new bytes32[](2);
        handles[0] = granted[0];
        handles[1] = _mint(uint8(FheType.Uint32), 2);

        vm.expectPartialRevert(ICleartextKMSVerifier.CleartextErrorHandleNotAllowedForPublicDecryption.selector);
        this.callDecryptPublic(handles);
    }

    // ---------------------------------------------------------------------------------------------
    // Every bit of the proof is load-bearing
    // ---------------------------------------------------------------------------------------------
    //
    // Layout, as `decryptPublicWithProof` packs it:
    //
    //   byte 0                 number of signatures (every registered KMS signer)
    //   65 * numSigners        signatures (r, s, v)
    //   rest                   extraData, as the deployed KMS context reports it

    function test_flippingTheSignatureCountIsRejected() public {
        _assertFlipRejected(0, "signature count");
    }

    function test_flippingASignatureByteIsRejected() public {
        _assertFlipRejected(1 * 8, "first byte of the first signature");
    }

    /// The values are not inside the proof, but they ARE inside the signed digest, so changing what the
    /// caller claims was decrypted must not still verify.
    function test_alteringTheClearValuesIsRejected() public {
        bytes32[] memory handles = _decryptable(4242);
        (bytes memory values, bytes memory proof) = FhevmCleartextDecryptPublic.decryptPublicWithProof(handles);

        Bits.flip(values, 0);

        assertFalse(_verify(handles, values, proof), "an altered clear value still verified");
    }

    /// The exhaustive claim: no single bit anywhere in the proof can be changed and still verify.
    function test_noSingleFlippedBitIsAccepted() public {
        bytes32[] memory handles = _decryptable(4242);
        (bytes memory values, bytes memory proof) = FhevmCleartextDecryptPublic.decryptPublicWithProof(handles);

        uint256 bits = proof.length * 8;
        for (uint256 bit = 0; bit < bits; bit++) {
            bytes memory tampered = bytes.concat(proof);
            Bits.flip(tampered, bit);
            _singleChangedByte(proof, tampered);
            assertFalse(_verify(handles, values, tampered), "a flipped bit was accepted");
        }
    }

    /// The same claim under the fuzzer, against a fresh proof each run.
    function testFuzz_noFlippedBitIsAccepted(uint256 bit) public {
        bytes32[] memory handles = _decryptable(4242);
        (bytes memory values, bytes memory proof) = FhevmCleartextDecryptPublic.decryptPublicWithProof(handles);

        bytes memory tampered = bytes.concat(proof);
        Bits.flip(tampered, bit % (proof.length * 8));
        assertFalse(_verify(handles, values, tampered), "a flipped bit was accepted");
    }

    // ---------------------------------------------------------------------------------------------
    // Helpers. The `call*` ones are external so `vm.expectRevert` sees a call boundary.
    // ---------------------------------------------------------------------------------------------

    function callDecryptPublic(bytes32[] calldata handles) external view {
        FhevmCleartextDecryptPublic.decryptPublicWithProof(handles);
    }

    /// @dev A handle holding `value`, minted the way a dApp would: an input bundle through `verifyInput`.
    ///      `verifyInput` grants the caller transient access, which is what lets this contract go on to
    ///      mark it publicly decryptable.
    function _mint(uint8 typeId, uint256 value) private returns (bytes32) {
        uint8[] memory typeIds = new uint8[](1);
        uint256[] memory values = new uint256[](1);
        typeIds[0] = typeId;
        values[0] = value;

        (bytes32[] memory handles, bytes memory proof) =
            FhevmCleartextEncrypt.encrypt(typeIds, values, address(this), alice);
        return ICleartextFHEVMExecutor(FHEVM_EXECUTOR_ADDRESS).verifyInput(handles[0], alice, proof, FheType(typeId));
    }

    /// @dev One `Uint32` handle holding `value`, already marked publicly decryptable.
    function _decryptable(uint256 value) private returns (bytes32[] memory handles) {
        handles = new bytes32[](1);
        handles[0] = _mint(uint8(FheType.Uint32), value);
        ICleartextACL(ACL_ADDRESS).allowForDecryption(handles);
    }

    /// @dev True when the KMS verifier accepts. It returns a bool on some rejections and reverts on
    ///      others, so both are folded into one answer: nothing got through.
    function _verify(bytes32[] memory handles, bytes memory values, bytes memory proof) private returns (bool) {
        try ICleartextKMSVerifier(KMS_VERIFIER_ADDRESS)
            .verifyDecryptionEIP712KMSSignatures(handles, values, proof) returns (
            bool ok
        ) {
            return ok;
        } catch {
            return false;
        }
    }

    function _assertFlipRejected(uint256 bit, string memory what) private {
        bytes32[] memory handles = _decryptable(4242);
        (bytes memory values, bytes memory proof) = FhevmCleartextDecryptPublic.decryptPublicWithProof(handles);
        Bits.flip(proof, bit);
        assertFalse(_verify(handles, values, proof), string.concat("accepted after flipping ", what));
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
}
