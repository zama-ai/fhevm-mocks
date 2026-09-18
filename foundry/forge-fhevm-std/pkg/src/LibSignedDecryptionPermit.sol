// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

/// ----------------------------------------------------------------------------
///   NAMING
///
///   "Permit" in the ERC-2612 sense: an off-chain signature that authorizes
///   something on-chain, rather than a transaction that does it. Here the user
///   signs ONCE and the signature then stands for any `userDecrypt` call within
///   its window and contract set.
///
///   The signed fields are exactly the `UserDecryptRequestVerification` struct
///   the KMS verifier declares — see `FhevmCleartextDecrypt.userDecryptDigestV1`,
///   which turns this into the EIP-712 digest to sign.
/// ----------------------------------------------------------------------------

using LibSignedDecryptionPermit for SignedDecryptionPermit global;

/// @notice What a user signs to authorize `userDecrypt`, plus the signature itself.
///
/// @dev `userDecrypt` takes these as loose arguments; they are one thing, so they travel as one
///      struct. The first four fields are what the EIP-712 digest is built over — change any of them
///      after signing and `signature` no longer verifies.
struct SignedDecryptionPermit {
    /// @dev Which permit format this is — `PERMIT_VERSION_V1` today.
    ///
    ///      The version decides the EIP-712 structs the signature was made over, so a consumer cannot
    ///      treat an unknown one as "probably like the last": it must refuse. Mirrors the js-sdk's
    ///      `SignedDecryptionPermit.version`, which is likewise `1 | 2` and rejected outside that set.
    uint8 version;
    /// @dev The transport key the payload is masked with — `TransportKeypair.publicKey`. The mask is
    ///      its first 32 bytes. Named for the transport pair, not the signer's key, because both are
    ///      "the public key" in a user decryption and only this one goes into the digest.
    bytes transportPublicKey;
    /// @dev The contracts the permit covers.
    address[] contractAddresses;
    /// @dev When the permit becomes valid, and how long it stays valid for.
    uint256 startTimestamp;
    /// @dev Seconds — but the signed request measures the window in DAYS (`durationDays` in
    ///      `UserDecryptRequestVerification`), so a value that is not a whole number of days cannot be
    ///      expressed in the digest and will not round-trip.
    uint256 durationSeconds;
    /// @dev The signer's EIP-712 signature over the fields above, and the account that made it.
    ///
    ///      `signerAddress` is stored rather than recovered per call: it is what the verifier must be
    ///      told the request comes from, so every consumer would otherwise recover the same value from
    ///      the same signature. For a delegated permit this is the DELEGATE — the delegator is
    ///      `delegatorAddress` below.
    bytes signature;
    address signerAddress;
    /// @dev The account whose access this permit exercises, or `address(0)` when there is none.
    ///
    ///      Not a flag but a discriminator: a delegated permit is signed over
    ///      `DelegatedUserDecryptRequestVerification`, which carries this address, while a plain one is
    ///      signed over `UserDecryptRequestVerification`, which has no such field. They are different
    ///      EIP-712 structs, so a signature made for one never verifies as the other — which is why
    ///      this must travel with the signature rather than be supplied at call time.
    address delegatorAddress;
}

/// @dev The permit format `signLegacyDecryptionPermit` produces: `UserDecryptRequestVerification`, or
///      `DelegatedUserDecryptRequestVerification` when delegated.
uint8 constant PERMIT_VERSION_V1 = 1;

/// @notice Reading a `SignedDecryptionPermit`. Pure: nothing here talks to the host.
///
/// @dev These mirror checks the KMS verifier makes, so a test can assert WHY a permit would be
///      rejected instead of only that it was.
library LibSignedDecryptionPermit {
    /// @notice When the permit stops being valid.
    function expiresAt(SignedDecryptionPermit memory self) internal pure returns (uint256) {
        return self.startTimestamp + self.durationSeconds;
    }

    /// @notice Whether `timestamp` falls inside the permit's window.
    /// @dev Half-open: the start instant is inside, the expiry instant is not.
    function isValidAt(SignedDecryptionPermit memory self, uint256 timestamp) internal pure returns (bool) {
        return timestamp >= self.startTimestamp && timestamp < expiresAt(self);
    }

    /// @notice Whether the permit names `contractAddress`.
    function covers(SignedDecryptionPermit memory self, address contractAddress) internal pure returns (bool) {
        for (uint256 i = 0; i < self.contractAddresses.length; i++) {
            if (self.contractAddresses[i] == contractAddress) return true;
        }
        return false;
    }
}
