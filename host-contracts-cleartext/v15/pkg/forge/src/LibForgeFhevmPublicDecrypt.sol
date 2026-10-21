// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {ACL_ADDRESS, FHEVM_EXECUTOR_ADDRESS, KMS_VERIFIER_ADDRESS} from "./_internal/LocalHostAddresses.sol";
import {LibForgeFhevmSigners} from "./LibForgeFhevmSigners.sol";
import {LibKmsVerifier} from "./shared/LibKmsVerifier.sol";
import {IForgeVm, FORGE_VM_ADDRESS} from "./IForgeVm.sol";

library LibForgeFhevmPublicDecrypt {
    IForgeVm private constant fvm = IForgeVm(FORGE_VM_ADDRESS);

    function decryptPublicWithProof(bytes32[] memory handles)
        internal
        view
        returns (bytes memory abiEncodedClearValues, bytes memory decryptionProof)
    {
        (abiEncodedClearValues, decryptionProof) =
            _decryptPublicOnStack(handles, KMS_VERIFIER_ADDRESS, ACL_ADDRESS, FHEVM_EXECUTOR_ADDRESS, true);
    }

    /// @notice Same, against a named stack, with the values coming from `plaintexts` when the verifier is
    ///         not asked directly.
    /// @param cleartextVerifier whether `kmsVerifierAddress` is a cleartext verifier that may be ASKED —
    ///        decided by the caller (forge-fhevm-std's `fhevm.useCleartextVerifier()`); this library reads
    ///        no environment and probes nothing. False for a production verifier, always: it has no such
    ///        function, and the answer is rebuilt from `aclAddress` and `plaintextsAddress` instead.
    function decryptPublicWithProof(
        bytes32[] memory handles,
        address kmsVerifierAddress,
        address aclAddress,
        address plaintextsAddress,
        bool cleartextVerifier
    ) internal view returns (bytes memory abiEncodedClearValues, bytes memory decryptionProof) {
        (abiEncodedClearValues, decryptionProof) =
            _decryptPublicOnStack(handles, kmsVerifierAddress, aclAddress, plaintextsAddress, cleartextVerifier);
    }

    /**
     * @notice Same, but the caller states what the handles decrypt to.
     *
     * @dev THE ONLY FORM THAT WORKS AGAINST A REAL VERIFIER. A cleartext stack can be asked what a
     *      handle is worth; a production one cannot, and no amount of rebuilding changes that — the
     *      values exist nowhere on it. So they are supplied, from a replay or from the caller's own
     *      knowledge, and bound into the digest the KMS signers are checked against.
     */
    function decryptPublicWithProof(
        bytes32[] memory handles,
        address kmsVerifierAddress,
        bytes memory abiEncodedClearValues
    ) internal view returns (bytes memory, bytes memory decryptionProof) {
        decryptionProof = _publicDecryptProof(handles, kmsVerifierAddress, abiEncodedClearValues);

        return (abiEncodedClearValues, decryptionProof);
    }

    /// @dev The proof half, over values the caller provides. Used for every verifier, cleartext or not:
    ///      `LibKmsVerifier` reads only the public surface, which a cleartext verifier has too. That is
    ///      also what makes the two paths comparable — `LibKmsVerifier.t.sol` asserts they agree.
    function _publicDecryptProof(bytes32[] memory handles, address kmsVerifierAddress, bytes memory values)
        private
        view
        returns (bytes memory decryptionProof)
    {
        (bytes32 digest, address[] memory signers,, bytes memory extraData) =
            LibKmsVerifier.publicDecryptProofDigest(kmsVerifierAddress, handles, values);

        return _sign(digest, signers, extraData);
    }

    /// @dev The values half is the library's: it probes the verifier, and either lets a cleartext one
    ///      answer or reads the values from `plaintexts` under `acl`. All that remains here is the
    ///      signing, which needs the forge VM and so cannot live there.
    function _decryptPublicOnStack(
        bytes32[] memory handles,
        address kmsVerifierAddress,
        address aclAddress,
        address plaintextsAddress,
        bool cleartextVerifier
    ) private view returns (bytes memory abiEncodedClearValues, bytes memory decryptionProof) {
        bytes32 digest;
        address[] memory signers;
        bytes memory extraData;

        // Two entry points, not one silent branch: a cleartext verifier holds its own ACL and values,
        // so passing it ours would be passing arguments it cannot use. Which one is the CALLER's decision,
        // handed in as `cleartextVerifier`.
        if (cleartextVerifier) {
            (abiEncodedClearValues, digest, signers, extraData) =
                LibKmsVerifier.publicDecryptV1OnCleartextStack(kmsVerifierAddress, handles);
        } else {
            (abiEncodedClearValues, digest, signers, extraData) =
                LibKmsVerifier.publicDecryptV1OnForkStack(kmsVerifierAddress, aclAddress, plaintextsAddress, handles);
        }

        decryptionProof = _sign(digest, signers, extraData);
    }

    /// @dev ALL the signers, not `threshold` of them. That is what the js-sdk relayer does for public
    ///      decryption, in contrast to the input path where it takes a threshold-sized subset. Signing
    ///      the full set is what a real KMS quorum produces, and the proof carries its own signer count.
    function _sign(bytes32 digest, address[] memory signers, bytes memory extraData)
        private
        view
        returns (bytes memory decryptionProof)
    {
        bytes memory signatures = LibForgeFhevmSigners.packSignatures(
            LibForgeFhevmSigners.randomKmsNodeSignatures(digest, signers, signers.length)
        );

        return abi.encodePacked(uint8(signers.length), signatures, extraData);
    }
}
