// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {KMS_VERIFIER_ADDRESS} from "./_internal/LocalHostAddresses.sol";
import {ICleartextKMSVerifier} from "./_internal/interfaces/ICleartextKMSVerifier.sol";
import {FhevmCleartextSigners} from "./FhevmCleartextSigners.sol";

library FhevmCleartextDecryptPublic {
    function decryptPublicWithProof(bytes32[] memory handles)
        internal
        view
        returns (bytes memory abiEncodedClearValues, bytes memory decryptionProof)
    {
        bytes32 digest;
        address[] memory signers;
        bytes memory extraData;
        // The verifier's `threshold` is skipped, deliberately: this path signs with EVERY signer.
        (abiEncodedClearValues, digest, signers,, extraData) =
            ICleartextKMSVerifier(KMS_VERIFIER_ADDRESS).publicDecrypt(handles);

        // A random threshold-sized subset of the signers the stack named, exactly as the SDK chooses one.
        // ALL of them, not `threshold` of them. That is what the js-sdk relayer
        // does for public decryption, in contrast to the input path where it
        // takes a threshold-sized subset. Signing the full set is what a real
        // KMS quorum produces, and the proof carries its own signer count.
        bytes memory signatures = FhevmCleartextSigners.packSignatures(
            FhevmCleartextSigners.randomKmsNodeSignatures(digest, signers, signers.length)
        );

        decryptionProof = abi.encodePacked(uint8(signers.length), signatures, extraData);
    }
}
