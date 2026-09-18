// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {
    ebool,
    euint8,
    euint16,
    euint32,
    euint64,
    euint128,
    euint256,
    eaddress
} from "encrypted-types/EncryptedTypes.sol";

import {FhevmCleartextDeploy, KMS_VERIFIER_ADDRESS} from "./_host/FhevmCleartextDeploy.sol";
import {FORGE_VM_ADDRESS} from "./_host/IForgeVm.sol";
import {IForgeVmLabel} from "./_internal/IForgeVmLabel.sol";
import {FhevmCleartextDecrypt, UserDecryptRequestV1} from "./_host/FhevmCleartextDecrypt.sol";
import {ICleartextKMSVerifier} from "./_host/_internal/interfaces/ICleartextKMSVerifier.sol";
import {SignedDecryptionPermit, PERMIT_VERSION_V1} from "./LibSignedDecryptionPermit.sol";
import {TransportKeypair} from "./LibTransportKeypair.sol";

/// @notice User decryption: the transport keypair, the permit a user signs, and the calls it authorizes.
/// @dev The forge counterpart of the js-sdk's `core/kms/TransportKeyPair-p.ts` and
///      `core/kms/SignedDecryptionPermit-p.ts`.
abstract contract StdFhevmDecrypt is FhevmCleartextDeploy {
    /// @dev The window the KMS verifier accepts, mirroring `MAX_USER_DECRYPT_DURATION_DAYS` in the
    ///      js-sdk's `SignedDecryptionPermitV1-p.ts`.
    uint256 internal constant MAX_USER_DECRYPT_DURATION_DAYS = 365;

    /**
     * @notice A fresh, RANDOM transport keypair.
     * @return keypair The pair. Hand it to `signLegacyDecryptionPermit`.
     *
     * @dev The generation itself lives in `FhevmCleartextDecrypt`, beside the `decryptAndReconstruct`
     *      that consumes it — the encoding and the unmasking have to agree, so they stay together.
     *      That library is the payload copied into every consumer and cannot name `TransportKeypair`,
     *      so it returns two loose `bytes` and this wraps them.
     */
    function generateTransportKeypair() internal returns (TransportKeypair memory keypair) {
        (bytes memory publicKey, bytes memory privateKey) = FhevmCleartextDecrypt.generateTransportKeypair();
        // `abi.decode` would read a full word regardless, so a shorter or longer key would decode to a
        // silently wrong scalar rather than fail.
        require(privateKey.length == 32, "StdFhevm: transport private key must be 32 bytes");

        keypair.publicKey = publicKey;
        keypair.privateKey = abi.decode(privateKey, (uint256));
    }

    function signLegacyDecryptionPermit(
        uint256 privateKey,
        TransportKeypair memory transportKeypair,
        address[] memory contractAddresses,
        uint256 startTimestamp,
        uint256 durationSeconds
    ) internal view returns (SignedDecryptionPermit memory signedPermit) {
        uint256 durationDays = _requireWholeDays(durationSeconds);

        (bytes32 digest,) = FhevmCleartextDecrypt.userDecryptDigestV1(
            _request(transportKeypair, contractAddresses, startTimestamp, durationDays)
        );
        (uint8 v, bytes32 r, bytes32 s) = fvm.sign(privateKey, digest);

        signedPermit = SignedDecryptionPermit({
            version: PERMIT_VERSION_V1,
            transportPublicKey: transportKeypair.publicKey,
            contractAddresses: contractAddresses,
            startTimestamp: startTimestamp,
            durationSeconds: durationSeconds,
            signature: abi.encodePacked(r, s, v),
            signerAddress: fvm.addr(privateKey),
            delegatorAddress: address(0)
        });
    }

    /// @dev A zero `delegatorAddress` is NOT "delegated to nobody" — the two digests are different
    ///      EIP-712 structs, so a permit must be signed under one or the other. Zero means the plain
    ///      one, which is what the no-delegator overload above produces.

    function signLegacyDecryptionPermit(
        uint256 privateKey,
        TransportKeypair memory transportKeypair,
        address[] memory contractAddresses,
        uint256 startTimestamp,
        uint256 durationSeconds,
        address delegatorAddress
    ) internal view returns (SignedDecryptionPermit memory signedPermit) {
        uint256 durationDays = _requireWholeDays(durationSeconds);

        (bytes32 digest,) = FhevmCleartextDecrypt.delegatedUserDecryptDigestV1(
            _request(transportKeypair, contractAddresses, startTimestamp, durationDays), delegatorAddress
        );
        (uint8 v, bytes32 r, bytes32 s) = fvm.sign(privateKey, digest);

        signedPermit = SignedDecryptionPermit({
            version: PERMIT_VERSION_V1,
            transportPublicKey: transportKeypair.publicKey,
            contractAddresses: contractAddresses,
            startTimestamp: startTimestamp,
            durationSeconds: durationSeconds,
            signature: abi.encodePacked(r, s, v),
            signerAddress: fvm.addr(privateKey),
            delegatorAddress: delegatorAddress
        });
    }

    /**
     * @notice Signs a permit as the account named `walletLabel`.
     * @param walletLabel The signer's name — the SAME account `makeAddrAndKey(walletLabel)` names,
     *        since both derive the key from the name.
     * @param transportKeypair The pair the payload will be masked with.
     * @param contractAddresses The contracts the permit covers.
     * @param startTimestamp When the permit becomes valid.
     * @param durationSeconds How long it stays valid. Must be a whole number of days.
     * @return signedPermit The signed permit.
     *
     * @dev The name is derived, never looked up, so a mistyped one is a valid account with access to
     *      nothing — see the `decrypt` overloads for the same caveat.
     */
    function signLegacyDecryptionPermit(
        string memory walletLabel,
        TransportKeypair memory transportKeypair,
        address[] memory contractAddresses,
        uint256 startTimestamp,
        uint256 durationSeconds
    ) internal view returns (SignedDecryptionPermit memory signedPermit) {
        signedPermit = signLegacyDecryptionPermit(
            _walletPrivateKey(walletLabel), transportKeypair, contractAddresses, startTimestamp, durationSeconds
        );
    }

    /// @notice The delegated form, signed as the account named `walletLabel`.
    /// @dev The NAMED account is the delegate — the one that signs — and `delegatorAddress` is whose
    ///      access it exercises.
    function signLegacyDecryptionPermit(
        string memory walletLabel,
        TransportKeypair memory transportKeypair,
        address[] memory contractAddresses,
        uint256 startTimestamp,
        uint256 durationSeconds,
        address delegatorAddress
    ) internal view returns (SignedDecryptionPermit memory signedPermit) {
        signedPermit = signLegacyDecryptionPermit(
            _walletPrivateKey(walletLabel),
            transportKeypair,
            contractAddresses,
            startTimestamp,
            durationSeconds,
            delegatorAddress
        );
    }

    /// @dev The permit the digest is built over, in the host's own shape.
    function _request(
        TransportKeypair memory transportKeypair,
        address[] memory contractAddresses,
        uint256 startTimestamp,
        uint256 durationDays
    ) private pure returns (UserDecryptRequestV1 memory) {
        return UserDecryptRequestV1({
            transportPublicKey: transportKeypair.publicKey,
            contractAddresses: contractAddresses,
            startTimestamp: startTimestamp,
            durationDays: durationDays
        });
    }

    /// @dev The three duration rules, shared by every `signLegacyDecryptionPermit` overload.
    function _requireWholeDays(uint256 durationSeconds) private pure returns (uint256 durationDays) {
        require(durationSeconds % 1 days == 0, "StdFhevm: durationSeconds must be a whole number of days");
        durationDays = durationSeconds / 1 days;
        require(durationDays != 0, "StdFhevm: durationSeconds must be at least one day");
        require(
            durationDays <= MAX_USER_DECRYPT_DURATION_DAYS, "StdFhevm: durationSeconds is above the maximum duration"
        );
    }

    /**
     * @notice Decrypts ONE handle as the account named `walletLabel`.
     * @param value The handle to decrypt.
     * @param contractAddress The contract holding it.
     * @param walletLabel The reader's name — the SAME account `makeAddrAndKey(walletLabel)` names,
     *        since both derive the key from the name.
     * @return clear The cleartext.
     *
     * @dev The shortest form there is: `decrypt(dapp.value(), address(dapp), "alice")`.
     *
     *      The name is DERIVED, not looked up: `vm.createWallet(name)` is `keccak256(name)`, a pure
     *      function, so it always resolves and never fails. Two consequences worth knowing. The good
     *      one: the same name means the same account everywhere, including in `makeAddrAndKey`, with
     *      no setup and nothing to register. The sharp one: a MISTYPED name is still a valid account —
     *      one with access to nothing — so it surfaces as an authorisation error rather than as a
     *      typo. If a read fails for an account that should have access, check the spelling first.
     *
     *      This is the WALLET label, the account that signs the permit and holds the ACL access. It has
     *      nothing to do with the transport keypair, which is minted fresh per call and never named.
     */
    function decrypt(ebool value, address contractAddress, string memory walletLabel) internal returns (bool clear) {
        clear = decrypt(value, contractAddress, _walletPrivateKey(walletLabel));
    }

    function decrypt(euint8 value, address contractAddress, string memory walletLabel) internal returns (uint8 clear) {
        clear = decrypt(value, contractAddress, _walletPrivateKey(walletLabel));
    }

    function decrypt(euint16 value, address contractAddress, string memory walletLabel)
        internal
        returns (uint16 clear)
    {
        clear = decrypt(value, contractAddress, _walletPrivateKey(walletLabel));
    }

    function decrypt(euint32 value, address contractAddress, string memory walletLabel)
        internal
        returns (uint32 clear)
    {
        clear = decrypt(value, contractAddress, _walletPrivateKey(walletLabel));
    }

    function decrypt(euint64 value, address contractAddress, string memory walletLabel)
        internal
        returns (uint64 clear)
    {
        clear = decrypt(value, contractAddress, _walletPrivateKey(walletLabel));
    }

    function decrypt(euint128 value, address contractAddress, string memory walletLabel)
        internal
        returns (uint128 clear)
    {
        clear = decrypt(value, contractAddress, _walletPrivateKey(walletLabel));
    }

    function decrypt(euint256 value, address contractAddress, string memory walletLabel)
        internal
        returns (uint256 clear)
    {
        clear = decrypt(value, contractAddress, _walletPrivateKey(walletLabel));
    }

    function decrypt(eaddress value, address contractAddress, string memory walletLabel)
        internal
        returns (address clear)
    {
        clear = decrypt(value, contractAddress, _walletPrivateKey(walletLabel));
    }

    /**
     * @notice Decrypts ONE handle as the owner of `userPrivateKey`, with no permit to build first.
     * @param value The handle to decrypt.
     * @param contractAddress The contract holding it — the handle must be ACL-allowed for both this
     *        contract and the key's account.
     * @param userPrivateKey The reader's signing key. Pair it with `makeAddrAndKey`.
     * @return clear The cleartext.
     *
     * @dev The whole read in one call: a throwaway transport keypair, a permit covering just
     *      `contractAddress` for the shortest window the verifier accepts, then the decryption. Use it
     *      when the permit is not what the test is about.
     *
     *      Reach for the four-argument `decrypt*` instead when the permit matters — to reuse one across
     *      several reads, cover more than one contract, choose the window, or exercise a delegation.
     *      Every call here signs a fresh permit, which is wasted work if you are making many.
     *
     *      NOT `view`: minting the transport keypair is a cheatcode that writes.
     */
    function decrypt(ebool value, address contractAddress, uint256 userPrivateKey) internal returns (bool clear) {
        (TransportKeypair memory keypair, SignedDecryptionPermit memory permit) =
            _oneShotPermit(contractAddress, userPrivateKey);
        clear = _decryptValue(ebool.unwrap(value), contractAddress, keypair, permit) != 0;
    }

    function decrypt(euint8 value, address contractAddress, uint256 userPrivateKey) internal returns (uint8 clear) {
        (TransportKeypair memory keypair, SignedDecryptionPermit memory permit) =
            _oneShotPermit(contractAddress, userPrivateKey);
        clear = uint8(_decryptValue(euint8.unwrap(value), contractAddress, keypair, permit));
    }

    function decrypt(euint16 value, address contractAddress, uint256 userPrivateKey) internal returns (uint16 clear) {
        (TransportKeypair memory keypair, SignedDecryptionPermit memory permit) =
            _oneShotPermit(contractAddress, userPrivateKey);
        clear = uint16(_decryptValue(euint16.unwrap(value), contractAddress, keypair, permit));
    }

    function decrypt(euint32 value, address contractAddress, uint256 userPrivateKey) internal returns (uint32 clear) {
        (TransportKeypair memory keypair, SignedDecryptionPermit memory permit) =
            _oneShotPermit(contractAddress, userPrivateKey);
        clear = uint32(_decryptValue(euint32.unwrap(value), contractAddress, keypair, permit));
    }

    function decrypt(euint64 value, address contractAddress, uint256 userPrivateKey) internal returns (uint64 clear) {
        (TransportKeypair memory keypair, SignedDecryptionPermit memory permit) =
            _oneShotPermit(contractAddress, userPrivateKey);
        clear = uint64(_decryptValue(euint64.unwrap(value), contractAddress, keypair, permit));
    }

    function decrypt(euint128 value, address contractAddress, uint256 userPrivateKey) internal returns (uint128 clear) {
        (TransportKeypair memory keypair, SignedDecryptionPermit memory permit) =
            _oneShotPermit(contractAddress, userPrivateKey);
        clear = uint128(_decryptValue(euint128.unwrap(value), contractAddress, keypair, permit));
    }

    function decrypt(euint256 value, address contractAddress, uint256 userPrivateKey) internal returns (uint256 clear) {
        (TransportKeypair memory keypair, SignedDecryptionPermit memory permit) =
            _oneShotPermit(contractAddress, userPrivateKey);
        clear = _decryptValue(euint256.unwrap(value), contractAddress, keypair, permit);
    }

    function decrypt(eaddress value, address contractAddress, uint256 userPrivateKey) internal returns (address clear) {
        (TransportKeypair memory keypair, SignedDecryptionPermit memory permit) =
            _oneShotPermit(contractAddress, userPrivateKey);
        clear = address(uint160(_decryptValue(eaddress.unwrap(value), contractAddress, keypair, permit)));
    }

    /**
     * @notice Decrypts ONE handle for `userAddress`, under a permit they already signed.
     * @param value The handle to decrypt.
     * @param contractAddress The contract holding it — the handle must be ACL-allowed for both this
     *        contract and the reader.
     * @param transportKeypair The pair the permit was signed for. Its PRIVATE half is what makes the
     *        payload readable, so holding the permit is not enough — this is the client's own key.
     * @param permit The signed permit; it supplies the transport key, the covered contracts and the
     *        validity window, so none of them is passed again.
     * @return clear The cleartext.
     *
     * @dev One per encrypted type, each narrowing what `_decryptValue` returns — see there for what
     *      the call actually does and, as importantly, what it deliberately does not.
     */
    function decrypt(
        ebool value,
        address contractAddress,
        TransportKeypair memory transportKeypair,
        SignedDecryptionPermit memory permit
    ) internal view returns (bool clear) {
        clear = _decryptValue(ebool.unwrap(value), contractAddress, transportKeypair, permit) != 0;
    }

    function decrypt(
        euint8 value,
        address contractAddress,
        TransportKeypair memory transportKeypair,
        SignedDecryptionPermit memory permit
    ) internal view returns (uint8 clear) {
        clear = uint8(_decryptValue(euint8.unwrap(value), contractAddress, transportKeypair, permit));
    }

    function decrypt(
        euint16 value,
        address contractAddress,
        TransportKeypair memory transportKeypair,
        SignedDecryptionPermit memory permit
    ) internal view returns (uint16 clear) {
        clear = uint16(_decryptValue(euint16.unwrap(value), contractAddress, transportKeypair, permit));
    }

    function decrypt(
        euint32 value,
        address contractAddress,
        TransportKeypair memory transportKeypair,
        SignedDecryptionPermit memory permit
    ) internal view returns (uint32 clear) {
        clear = uint32(_decryptValue(euint32.unwrap(value), contractAddress, transportKeypair, permit));
    }

    function decrypt(
        euint64 value,
        address contractAddress,
        TransportKeypair memory transportKeypair,
        SignedDecryptionPermit memory permit
    ) internal view returns (uint64 clear) {
        clear = uint64(_decryptValue(euint64.unwrap(value), contractAddress, transportKeypair, permit));
    }

    function decrypt(
        euint128 value,
        address contractAddress,
        TransportKeypair memory transportKeypair,
        SignedDecryptionPermit memory permit
    ) internal view returns (uint128 clear) {
        clear = uint128(_decryptValue(euint128.unwrap(value), contractAddress, transportKeypair, permit));
    }

    function decrypt(
        euint256 value,
        address contractAddress,
        TransportKeypair memory transportKeypair,
        SignedDecryptionPermit memory permit
    ) internal view returns (uint256 clear) {
        clear = _decryptValue(euint256.unwrap(value), contractAddress, transportKeypair, permit);
    }

    function decrypt(
        eaddress value,
        address contractAddress,
        TransportKeypair memory transportKeypair,
        SignedDecryptionPermit memory permit
    ) internal view returns (address clear) {
        clear = address(uint160(_decryptValue(eaddress.unwrap(value), contractAddress, transportKeypair, permit)));
    }

    /// @dev The signing key of the account named `walletLabel`.
    ///
    ///      Through the cheatcode rather than recomputing `keccak256(label)`, so this library and
    ///      forge-std can never disagree about which account a name means — and so the account is
    ///      labelled, making traces print the name instead of the address. Despite the name,
    ///      `createWallet` creates nothing: it is a pure derivation, safe to call per read.
    function _walletPrivateKey(string memory walletLabel) private view returns (uint256) {
        return IForgeVmLabel(FORGE_VM_ADDRESS).createWallet(walletLabel).privateKey;
    }

    /**
     * @dev A transport keypair and a permit good for exactly one contract, from now, for the shortest
     *      window `signLegacyDecryptionPermit` allows — one day, since the signed request counts in
     *      days and zero is refused.
     */
    function _oneShotPermit(address contractAddress, uint256 userPrivateKey)
        private
        returns (TransportKeypair memory keypair, SignedDecryptionPermit memory permit)
    {
        keypair = generateTransportKeypair();

        address[] memory contractAddresses = new address[](1);
        contractAddresses[0] = contractAddress;

        permit = signLegacyDecryptionPermit(userPrivateKey, keypair, contractAddresses, block.timestamp, 1 days);
    }

    /**
     * @notice The one user decryption every `decrypt*` above performs, before narrowing.
     * @param handle The handle to decrypt, already unwrapped.
     * @param contractAddress The contract holding it.
     * @param transportKeypair The pair the permit was signed for; the mask comes off with its key.
     * @param permit The signed permit. It names its own signer, so no reader address is passed.
     * @return clear The cleartext, still `uint256`-wide.
     *
     * @dev Only what runs ON-CHAIN. The permit signature, every ACL check, the pair authorisation and
     *      the masking all happen inside the KMS verifier, so a rejected request reverts there with the
     *      contract's own error. The mask is then undone by hand, one XOR.
     *
     *      What is deliberately NOT done is the off-chain KMS emulation: `FhevmCleartextDecrypt`
     *      forges threshold node signatures and `decryptAndReconstruct` verifies them again. In
     *      cleartext mode that is a closed loop — this library signing shares to itself and checking
     *      its own work — so it proves nothing about the dApp under test while costing the gas and the
     *      indirection. The host library proves that loop in its own tests; see `_userDecrypt` vs
     *      `_userDecryptFull` in `FhevmCleartextEncryptDecrypt.t.sol`, which draws the same line.
     *
     *      Which request is sent follows `permit.delegatorAddress`, because the permit was signed over
     *      one of two different EIP-712 structs and only the matching request will verify.
     *
     *      Only `PERMIT_VERSION_V1` is understood; anything else is refused up front.
     */
    function _decryptValue(
        bytes32 handle,
        address contractAddress,
        TransportKeypair memory transportKeypair,
        SignedDecryptionPermit memory permit
    ) private view returns (uint256 clear) {
        // The version decides which EIP-712 structs `permit.signature` was made over, so a permit this
        // library does not know how to send is refused here rather than rejected by the verifier as a
        // bad signature — which would point at the key, not the format.
        require(permit.version == PERMIT_VERSION_V1, "StdFhevm: unsupported decryption permit version");
        // The permit names the key it was signed for; a different pair would unmask to garbage rather
        // than fail, so the mismatch is caught here instead of surfacing as a wrong value.
        require(
            keccak256(transportKeypair.publicKey) == keccak256(permit.transportPublicKey),
            "StdFhevm: transport keypair does not match the permit"
        );

        ICleartextKMSVerifier.HandleContractPair[] memory pairs = new ICleartextKMSVerifier.HandleContractPair[](1);
        pairs[0] = ICleartextKMSVerifier.HandleContractPair({handle: handle, contractAddress: contractAddress});

        bytes memory payload;
        if (permit.delegatorAddress == address(0)) {
            (payload,,,) = ICleartextKMSVerifier(KMS_VERIFIER_ADDRESS)
                .userDecrypt(
                    pairs,
                    permit.signerAddress,
                    permit.transportPublicKey,
                    permit.contractAddresses,
                    permit.startTimestamp,
                    permit.durationSeconds / 1 days,
                    permit.signature
                );
        } else {
            (payload,,,) = ICleartextKMSVerifier(KMS_VERIFIER_ADDRESS)
                .delegatedUserDecrypt(
                    pairs,
                    permit.delegatorAddress,
                    permit.signerAddress,
                    permit.transportPublicKey,
                    permit.contractAddresses,
                    permit.startTimestamp,
                    permit.durationSeconds / 1 days,
                    permit.signature
                );
        }

        clear = _unmask(payload, transportKeypair)[0];
    }

    /**
     * @notice The client half of a cleartext user decryption: the values the verifier returned, with
     *         the transport mask taken off.
     * @param payload The verifier's `abi.encode(uint256[] masked, bytes extraData)`.
     * @param transportKeypair The client's own pair; its key carries the mask.
     * @return cleartexts One per handle, in the order the handles were sent, still `uint256`-wide.
     *
     * @dev XOR is its own inverse, so masking and unmasking are the same operation — the verifier
     *      applied this exact mask on the way out.
     *
     *      Returns every value rather than just the first: the payload carries one per handle, and a
     *      single-value helper would quietly drop the rest of a batch.
     */
    /**
     * @notice The 32 bytes each cleartext is XOR-masked with.
     * @dev The FIRST 32 bytes of the permit's transport key — for the uncompressed encoding that is
     *      `0x04` followed by the first 31 bytes of X, NOT X.
     *
     *      Taken from the CALLER's keypair, not from the permit's copy — the client unmasks with its
     *      own key, exactly as the js-sdk mock does, and `_decryptValue` has already checked the two
     *      agree.
     *
     *      Private, and here rather than on `TransportKeypair`: XOR-masking is what the CLEARTEXT host
     *      does. A real deployment encrypts each share to the transport key, so a mask is not a
     *      property the pair has — it is a property of this mock, and belongs beside the code that
     *      undoes it.
     */
    function _mask(TransportKeypair memory transportKeypair) private pure returns (bytes32 m) {
        bytes memory key = transportKeypair.publicKey;
        require(key.length >= 32, "StdFhevm: transport public key must be at least 32 bytes");
        // solhint-disable-next-line no-inline-assembly
        assembly {
            m := mload(add(key, 32))
        }
    }

    function _unmask(bytes memory payload, TransportKeypair memory transportKeypair)
        private
        pure
        returns (uint256[] memory cleartexts)
    {
        (uint256[] memory masked,) = abi.decode(payload, (uint256[], bytes));

        uint256 m = uint256(_mask(transportKeypair));
        cleartexts = new uint256[](masked.length);
        for (uint256 i = 0; i < masked.length; i++) {
            cleartexts[i] = masked[i] ^ m;
        }
    }
}
