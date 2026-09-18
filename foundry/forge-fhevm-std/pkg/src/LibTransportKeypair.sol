// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

/// ----------------------------------------------------------------------------
///   NAMING
///
///   After the js-sdk's `TransportKeyPair` (`core/kms/TransportKeyPair-p.ts`):
///   the ephemeral keypair a user decryption is encrypted TO, as opposed to the
///   account key that signs the permit. The two are easy to confuse, which is
///   why this one carries the word "transport".
/// ----------------------------------------------------------------------------

using LibTransportKeypair for TransportKeypair global;

/// @notice The ephemeral secp256k1 keypair a `userDecrypt` payload is masked with.
///
/// @dev Built by `generateTransportKeypair`. The two fields are one thing — the public key is derived
///      from the private one — so they travel together rather than as a loose pair a caller could
///      mismatch.
struct TransportKeypair {
    /// @dev UNCOMPRESSED secp256k1: 65 bytes, `0x04 || X || Y`. The encoding matters — see `mask`.
    bytes publicKey;
    /// @dev The secp256k1 scalar `publicKey` is derived from.
    uint256 privateKey;
}

/// @notice Reading a `TransportKeypair`. Pure: nothing here talks to the host.
library LibTransportKeypair {
    error PublicKeyTooShort(uint256 length);

    /// @notice The 32 bytes each cleartext is XOR-masked with.
    ///
    /// @dev The FIRST 32 bytes of the public key, which for the uncompressed encoding is `0x04`
    ///      followed by the first 31 bytes of X — NOT X. That is what the cleartext host does
    ///      (`FhevmCleartextDecrypt.decryptAndReconstruct`) and what the js-sdk mock does
    ///      (`_xorUnmaskWithPublicKey`), so it is what this returns. Exposed because it is the value
    ///      worth asserting on when a round trip decrypts to garbage.
    function mask(TransportKeypair memory self) internal pure returns (bytes32 m) {
        bytes memory publicKey = self.publicKey;
        if (publicKey.length < 32) revert PublicKeyTooShort(publicKey.length);
        // solhint-disable-next-line no-inline-assembly
        assembly {
            m := mload(add(publicKey, 32))
        }
    }
}
