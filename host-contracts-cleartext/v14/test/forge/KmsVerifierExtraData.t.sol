// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {ForgeFhevmDeploy} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {ACL_ADDRESS, FHEVM_EXECUTOR_ADDRESS, KMS_VERIFIER_ADDRESS} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {ICleartextACL} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {ICleartextFHEVMExecutor} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {ICleartextKMSVerifier} from "../../pkg/forge/src/_internal/interfaces/ICleartextKMSVerifier.sol";
import {LibForgeFhevmEncrypt} from "../../pkg/forge/src/LibForgeFhevmEncrypt.sol";
import {LibForgeFhevmPublicDecrypt} from "../../pkg/forge/src/LibForgeFhevmPublicDecrypt.sol";
import {FheType} from "../../pkg/forge/src/shared/LibFheType.sol";

/**
 * The v14 KMSVerifier refuses a malformed proof AS MALFORMED, before it recovers a single signer.
 *
 * A decryption proof is `numSigners (1 byte) | signatures (65 bytes each) | extraData`, so bytes appended to
 * it land in extraData. Since v0.14 `KMSVerifier._extractKmsContextId` requires a version-1 extraData to be
 * exactly 33 bytes and a version-2 one exactly 65, and reverts `DeserializingExtraDataFail` otherwise. v0.13
 * tolerated trailing bytes, which then corrupted the signed digest and surfaced later as `KMSInvalidSigner`.
 *
 * This file is v14's own on purpose: the behaviour is the contract's, not the SDK's, so the shared
 * doc-example tests in hardhat check a corrupted SIGNATURE instead, which both generations reject the same
 * way (`KMSInvalidSigner`).
 */
contract KmsVerifierExtraDataTest is Test, ForgeFhevmDeploy {
    address internal alice;

    function setUp() public {
        deployLocalFhevm();
        alice = vm.addr(uint256(keccak256("alice")));
    }

    /// Control: the untouched proof verifies, and its extraData is a versioned one, the kind whose length
    /// is checked. A v0 extraData would make the test below pass for the wrong reason.
    function test_theUntouchedProofVerifiesAndCarriesAVersionedExtraData() public {
        (bytes32[] memory handles, bytes memory values, bytes memory proof) = _proof(4242);

        uint8 version = _extraDataVersion(proof);
        assertTrue(version == 0x01 || version == 0x02, "the stack's extraData is not version 1 or 2");
        assertTrue(
            ICleartextKMSVerifier(KMS_VERIFIER_ADDRESS).verifyDecryptionEIP712KMSSignatures(handles, values, proof),
            "the KMS verifier rejected an untouched proof"
        );
    }

    function test_aByteAppendedToTheProofIsRefusedAsMalformed() public {
        (bytes32[] memory handles, bytes memory values, bytes memory proof) = _proof(4242);
        bytes memory malformed = bytes.concat(proof, hex"00");

        vm.expectRevert(abi.encodeWithSignature("DeserializingExtraDataFail()"));
        ICleartextKMSVerifier(KMS_VERIFIER_ADDRESS).verifyDecryptionEIP712KMSSignatures(handles, values, malformed);
    }

    /// @dev One `Uint32` handle holding `value`, marked publicly decryptable, with its public-decryption proof.
    function _proof(uint256 value) private returns (bytes32[] memory handles, bytes memory values, bytes memory proof) {
        uint8[] memory typeIds = new uint8[](1);
        uint256[] memory clear = new uint256[](1);
        typeIds[0] = uint8(FheType.Uint32);
        clear[0] = value;
        (bytes32[] memory inputs, bytes memory inputProof) =
            LibForgeFhevmEncrypt.encrypt(typeIds, clear, address(this), alice);

        handles = new bytes32[](1);
        handles[0] =
            ICleartextFHEVMExecutor(FHEVM_EXECUTOR_ADDRESS).verifyInput(inputs[0], alice, inputProof, FheType.Uint32);
        ICleartextACL(ACL_ADDRESS).allowForDecryption(handles);

        (values, proof) = LibForgeFhevmPublicDecrypt.decryptPublicWithProof(handles);
    }

    /// @dev The first byte after the signatures: extraData's version.
    function _extraDataVersion(bytes memory proof) private pure returns (uint8) {
        uint256 numSigners = uint8(proof[0]);
        uint256 at = 1 + 65 * numSigners;
        require(proof.length > at, "the proof carries no extraData");
        return uint8(proof[at]);
    }
}
