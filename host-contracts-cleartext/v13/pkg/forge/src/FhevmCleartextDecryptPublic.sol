// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {KMS_VERIFIER_ADDRESS} from "./_internal/LocalHostAddresses.sol";
import {LocalHostBootstrap} from "./_internal/LocalHostBootstrap.sol";
import {ICleartextKMSVerifier} from "./_internal/interfaces/ICleartextKMSVerifier.sol";
import {IForgeVm, FORGE_VM_ADDRESS} from "./IForgeVm.sol";
import {FhevmCleartextConfig} from "./FhevmCleartextConfig.sol";

library FhevmCleartextDecryptPublic {
    IForgeVm private constant fvm = IForgeVm(FORGE_VM_ADDRESS);

    error ThresholdExceedsSigners(uint256 threshold, uint256 signers);
    error UnknownKmsSigner(address signer);
    error KmsNodeKeyMismatch(uint256 index, address derived, address registered);

    function decryptPublicWithProof(bytes32[] memory handles)
        internal
        view
        returns (bytes memory abiEncodedClearValues, bytes memory decryptionProof)
    {
        bytes32 digest;
        address[] memory signers;
        uint256 threshold;
        bytes memory extraData;
        // `threshold` is returned too and deliberately unused: this path signs
        // with EVERY signer, see below.
        (abiEncodedClearValues, digest, signers, threshold, extraData) =
            ICleartextKMSVerifier(KMS_VERIFIER_ADDRESS).publicDecrypt(handles);

        // A random threshold-sized subset of the signers the stack named, exactly as the SDK chooses one.
        uint256[] memory chosen = _randomUniqueIndices(signers.length, threshold);

        // ALL of them, not `threshold` of them. That is what the js-sdk relayer
        // does for public decryption, in contrast to the input path where it
        // takes a threshold-sized subset. Signing the full set is what a real
        // KMS quorum produces, and the proof carries its own signer count.
        bytes memory signatures;
        for (uint256 i = 0; i < signers.length; i++) {
            (uint8 v, bytes32 r, bytes32 s) = fvm.sign(_kmsNodeKeyFor(signers[chosen[i]]), digest);
            signatures = abi.encodePacked(signatures, r, s, v);
        }

        decryptionProof = abi.encodePacked(uint8(signers.length), signatures, extraData);
    }

    /**
     * @dev `count` distinct indices drawn uniformly from `[0, n)`, mirroring the SDK's
     *      `randomUniqueUints`: a partial Fisher-Yates shuffle of the index pool, first `count` taken.
     *
     *      Signing with the first `threshold` signers would also verify, because `InputVerifier` only
     *      counts distinct valid signers against the threshold. Choosing at random is what makes a forge
     *      test exercise the same signer-set variability a real client produces, instead of pinning one
     *      subset forever and never noticing a bug the others would surface.
     */
    function _randomUniqueIndices(uint256 n, uint256 count) private view returns (uint256[] memory pool) {
        if (count > n) revert ThresholdExceedsSigners(count, n);
        pool = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            pool[i] = i;
        }
        for (uint256 i = 0; i < count; i++) {
            uint256 j = i + (fvm.randomUint() % (n - i));
            (pool[i], pool[j]) = (pool[j], pool[i]);
        }
    }

    function _kmsNodeKeyFor(address signer) private pure returns (uint256 privateKey) {
        address[] memory registered = LocalHostBootstrap.kmsSigners();
        for (uint256 i = 0; i < registered.length; i++) {
            if (registered[i] != signer) continue;
            privateKey = fvm.deriveKey(
                FhevmCleartextConfig.CLEARTEXT_KMS_NODES_MNEMONIC,
                FhevmCleartextConfig.CLEARTEXT_KMS_NODES_MNEMONIC_PATH,
                uint32(i) + FhevmCleartextConfig.CLEARTEXT_KMS_NODES_MNEMONIC_INDEX
            );
            address derived = fvm.addr(privateKey);
            if (derived != signer) revert KmsNodeKeyMismatch(i, derived, signer);
            return privateKey;
        }
        revert UnknownKmsSigner(signer);
    }
}
