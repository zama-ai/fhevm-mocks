// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {LocalHostBootstrap} from "./_internal/LocalHostBootstrap.sol";
import {IForgeVm, FORGE_VM_ADDRESS} from "./IForgeVm.sol";
import {LibFhevmCleartextConfig} from "./shared/LibFhevmCleartextConfig.sol";

/**
 * @title LibForgeFhevmSigners
 * @notice The keys behind the two signer pools a cleartext stack is deployed with: the coprocessors,
 *         whose signatures authenticate an input proof, and the KMS nodes, whose signatures authenticate
 *         a decryption result.
 * @dev Every library that forges a protocol signature needs the same three things — which signers the
 *      stack registered, the key for one of them, and a random subset of them — so they live here once
 *      rather than in a private copy per library. `LibForgeFhevmEncrypt` signs as coprocessors,
 *      `LibKmsVerifier` and `LibForgeFhevmPublicDecrypt` as KMS nodes.
 *
 *      Sharing is free at the call site: an internal library function is copied into the calling contract
 *      once per definition, so a test that uses two of those libraries carries one copy of this code, not
 *      two.
 *
 *      Both pools follow the same shape, and each is split in two: a key BY INDEX, which derives and
 *      verifies, and a key BY ADDRESS, which finds the index and defers to the first. A caller that
 *      already knows which signer it wants does not pay for a search.
 *
 *      The stack's signer lists come from `LocalHostBootstrap`, the mnemonics and derivation paths from
 *      `LibFhevmCleartextConfig`. Those are independently generated facts, so a derived address is always
 *      checked against the registered one before the key is handed out: signing with a key the verifier
 *      does not know would otherwise surface much later as an opaque proof or share rejection.
 */
library LibForgeFhevmSigners {
    IForgeVm private constant fvm = IForgeVm(FORGE_VM_ADDRESS);

    error ThresholdExceedsSigners(uint256 threshold, uint256 signers);
    error CoprocessorIndexOutOfRange(uint256 index, uint256 signers);
    error UnknownCoprocessorSigner(address signer);
    error CoprocessorKeyMismatch(uint256 index, address derived, address registered);
    error KmsNodeIndexOutOfRange(uint256 index, uint256 signers);
    error UnknownKmsSigner(address signer);
    error KmsNodeKeyMismatch(uint256 index, address derived, address registered);

    // ---------------------------------------------------------------------------------------------
    // Coprocessors — the signers `InputVerifier` counts against its threshold
    // ---------------------------------------------------------------------------------------------

    /// @notice The private key of coprocessor signer number `index`, as this stack registered it.
    function coprocessorKey(uint256 index) internal pure returns (uint256 privateKey) {
        address[] memory registered = LocalHostBootstrap.coprocessorSigners();
        if (index >= registered.length) revert CoprocessorIndexOutOfRange(index, registered.length);

        privateKey = fvm.deriveKey(
            LibFhevmCleartextConfig.CLEARTEXT_COPROCESSORS_MNEMONIC,
            LibFhevmCleartextConfig.CLEARTEXT_COPROCESSORS_MNEMONIC_PATH,
            LibFhevmCleartextConfig.CLEARTEXT_COPROCESSORS_MNEMONIC_INDEX + uint32(index)
        );

        address derived = fvm.addr(privateKey);
        if (derived != registered[index]) revert CoprocessorKeyMismatch(index, derived, registered[index]);
    }

    /// @notice The private key for `signer`, which must be one of the coprocessors this stack registered.
    function coprocessorKeyFor(address signer) internal pure returns (uint256 privateKey) {
        address[] memory registered = LocalHostBootstrap.coprocessorSigners();
        for (uint256 i = 0; i < registered.length; i++) {
            if (registered[i] == signer) return coprocessorKey(i);
        }
        revert UnknownCoprocessorSigner(signer);
    }

    // ---------------------------------------------------------------------------------------------
    // KMS nodes — the signers a decryption result is verified against
    // ---------------------------------------------------------------------------------------------

    /// @notice The private key of KMS node number `index`, as this stack registered it.
    function kmsNodeKey(uint256 index) internal pure returns (uint256 privateKey) {
        address[] memory registered = LocalHostBootstrap.kmsSigners();
        if (index >= registered.length) revert KmsNodeIndexOutOfRange(index, registered.length);

        privateKey = fvm.deriveKey(
            LibFhevmCleartextConfig.CLEARTEXT_KMS_NODES_MNEMONIC,
            LibFhevmCleartextConfig.CLEARTEXT_KMS_NODES_MNEMONIC_PATH,
            LibFhevmCleartextConfig.CLEARTEXT_KMS_NODES_MNEMONIC_INDEX + uint32(index)
        );

        address derived = fvm.addr(privateKey);
        if (derived != registered[index]) revert KmsNodeKeyMismatch(index, derived, registered[index]);
    }

    /// @notice The private key for `signer`, which must be one of the KMS nodes this stack registered.
    function kmsNodeKeyFor(address signer) internal pure returns (uint256 privateKey) {
        address[] memory registered = LocalHostBootstrap.kmsSigners();
        for (uint256 i = 0; i < registered.length; i++) {
            if (registered[i] == signer) return kmsNodeKey(i);
        }
        revert UnknownKmsSigner(signer);
    }

    // ---------------------------------------------------------------------------------------------
    // Transport keys — the keypair a user-decryption response is masked to
    // ---------------------------------------------------------------------------------------------

    /// @notice A fresh secp256k1 keypair for one user-decryption round trip.
    /// @dev Lives here, with the other key derivation, rather than beside the decryption that consumes
    ///      it: nothing about it is decryption-specific, and it is the only part of that path that
    ///      needs the forge VM.
    function generateTransportKeypair() internal returns (bytes memory publicKey, bytes memory privateKey) {
        uint256 scalar = (fvm.randomUint() >> 1) | 1;
        IForgeVm.Wallet memory wallet = fvm.createWallet(scalar);

        publicKey = abi.encodePacked(bytes1(0x04), wallet.publicKeyX, wallet.publicKeyY);
        privateKey = abi.encodePacked(scalar);
    }

    // ---------------------------------------------------------------------------------------------
    // Signing
    // ---------------------------------------------------------------------------------------------

    /**
     * @notice `count` coprocessor signatures over `digest`, from a random subset of `signers`.
     * @dev One 65-byte `r || s || v` per entry. `packSignatures` concatenates them where a caller needs
     *      the flat form an input proof or a decryption proof carries.
     */
    function randomCoprocessorSignatures(bytes32 digest, address[] memory signers, uint256 count)
        internal
        view
        returns (bytes[] memory signatures)
    {
        return _randomSignatures(digest, signers, count, coprocessorKeyFor);
    }

    /// @notice `count` KMS node signatures over `digest`, from a random subset of `signers`.
    function randomKmsNodeSignatures(bytes32 digest, address[] memory signers, uint256 count)
        internal
        view
        returns (bytes[] memory signatures)
    {
        return _randomSignatures(digest, signers, count, kmsNodeKeyFor);
    }

    /// @notice The signatures concatenated, 65 bytes each, with no length prefix.
    function packSignatures(bytes[] memory signatures) internal pure returns (bytes memory packed) {
        for (uint256 i = 0; i < signatures.length; i++) {
            packed = abi.encodePacked(packed, signatures[i]);
        }
    }

    /**
     * @dev The one signing loop behind both pools. `keyFor` is the only difference between forging a
     *      coprocessor quorum and forging a KMS one, so it is passed in rather than written twice: an
     *      internal function pointer, resolved at compile time within this library.
     *
     *      `count` drives both halves — the subset drawn and the signatures produced — so asking for
     *      every signer (`count == signers.length`) yields the whole set in random order.
     */
    function _randomSignatures(
        bytes32 digest,
        address[] memory signers,
        uint256 count,
        function(address) internal pure returns (uint256) keyFor
    ) private view returns (bytes[] memory signatures) {
        uint256[] memory chosen = _randomUniqueIndices(signers.length, count);
        signatures = new bytes[](count);
        for (uint256 i = 0; i < count; i++) {
            (uint8 v, bytes32 r, bytes32 s) = fvm.sign(keyFor(signers[chosen[i]]), digest);
            signatures[i] = abi.encodePacked(r, s, v);
        }
    }

    // ---------------------------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------------------------

    /**
     * @notice A permutation of `[0, n)` whose first `count` entries are drawn uniformly at random.
     * @dev Mirrors the SDK's `randomUniqueUints`: a partial Fisher-Yates shuffle of the index pool. The
     *      WHOLE pool is returned, not the first `count`, so a caller that wants every signer in a random
     *      order can use all of it — `LibForgeFhevmPublicDecrypt` does exactly that.
     *
     *      Signing with the first `threshold` signers would also verify, because the verifiers only count
     *      distinct valid signers against the threshold. Choosing at random is what makes a forge test
     *      exercise the same signer-set variability a real client produces, instead of pinning one subset
     *      forever and never noticing a bug the others would surface.
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
}
