// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {KMS_VERIFIER_ADDRESS} from "./_internal/LocalHostAddresses.sol";
import {IForgeVm, FORGE_VM_ADDRESS} from "./IForgeVm.sol";
import {LocalHostBootstrap} from "./_internal/LocalHostBootstrap.sol";
import {ICleartextKMSVerifier} from "./_internal/interfaces/ICleartextKMSVerifier.sol";
import {FhevmCleartextSigners} from "./FhevmCleartextSigners.sol";

/// @notice The permit itself: everything both request shapes share.
///
/// @dev Exactly the fields the EIP-712 digest is built over, and nothing else. The accounts are not
///      in here — a plain request names one, a delegated one names two — and neither is the signature,
///      which is the authorisation OVER these fields rather than one of them. Both stay explicit
///      parameters, so what is signed and what does the signing never blur together.
///
///      Grouping them is also what keeps `delegatedUserDecryptV1` compiling: with the accounts loose
///      it would carry eight parameters, and solc's legacy codegen runs out of stack at that point
///      because parameters stay live for the whole body. Neither consuming project enables `via_ir`.
struct UserDecryptRequestV1 {
    /// @dev The client's transport key; the stack XOR-masks each value with its FIRST 32 BYTES.
    bytes transportPublicKey;
    /// @dev The contracts the permit covers, at most ten.
    address[] contractAddresses;
    /// @dev When the permit becomes valid, and for how many DAYS after that.
    uint256 startTimestamp;
    uint256 durationDays;
}

library FhevmCleartextDecrypt {
    IForgeVm private constant fvm = IForgeVm(FORGE_VM_ADDRESS);

    /// @dev The order of the secp256k1 curve: a private key is any scalar in `[1, N-1]`.
    uint256 private constant SECP256K1_N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;

    error NoShares();
    error InvalidKmsExtraData(uint256 length);
    error InvalidShareSignature(uint256 index);
    error UnknownShareSigner(uint256 index, address recovered);
    error ExtraDataMismatch();
    error PublicKeyTooShort(uint256 length);

    /// @dev EIP-712 domain typehash, as `CleartextKMSVerifier` declares it.
    bytes32 private constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    /// @dev `USER_DECRYPT_REQUEST_TYPEHASH` in `CleartextKMSVerifier`. The string is the contract's, and
    ///      a single character apart from it produces a digest the verifier will never accept.
    bytes32 private constant USER_DECRYPT_REQUEST_TYPEHASH = keccak256(
        "UserDecryptRequestVerification(bytes publicKey,address[] contractAddresses,uint256 startTimestamp,uint256 durationDays,bytes extraData)"
    );

    /// @dev `DELEGATED_USER_DECRYPT_REQUEST_TYPEHASH` in `CleartextKMSVerifier`. Note the extra
    ///      `delegatorAddress` field, which the plain request does not carry.
    bytes32 private constant DELEGATED_USER_DECRYPT_REQUEST_TYPEHASH = keccak256(
        "DelegatedUserDecryptRequestVerification(bytes publicKey,address[] contractAddresses,address delegatorAddress,uint256 startTimestamp,uint256 durationDays,bytes extraData)"
    );

    /// @dev `UserDecryptResponseVerification` in the gateway's `Decryption.sol`: what every KMS node signs per
    ///      response share. `userDecryptedShare` is the share payload.
    bytes32 private constant USER_DECRYPT_RESPONSE_TYPEHASH = keccak256(
        "UserDecryptResponseVerification(bytes publicKey,bytes32[] ctHandles,bytes userDecryptedShare,bytes extraData)"
    );
    /// @dev The KMS signs shares under the GATEWAY's `Decryption` domain, not the host verifier's.
    ///      `createKmsEip712Domain` in the SDK: name "Decryption", version "1", the gateway chain id and the
    ///      gateway Decryption contract, both of which the stack was bootstrapped with.
    string private constant DECRYPTION_DOMAIN_NAME = "Decryption";
    string private constant DECRYPTION_DOMAIN_VERSION = "1";

    /**
     * @notice The digest a user must sign to authorize a `userDecrypt` request.
     * @param request The permit to sign: transport key, covered contracts, window.
     * @return digest The EIP-712 digest. Sign it with the user's key and pass the signature to
     *         `userDecrypt`.
     * @return extraData The bytes the digest was hashed over, returned so the two cannot disagree.
     *
     * @dev Mirrors `CleartextKMSVerifier._hashUserDecryptionResult`, which is `private` and so cannot be
     *      called. Two details are easy to get wrong and are the reason this helper exists:
     *
     *      `extraData` is NOT a caller input. `userDecrypt` builds it from the CURRENT KMS context and
     *      verifies the signature against that, so a caller who signs over anything else is rejected for
     *      reasons that point nowhere. It is read from the live verifier here for the same reason, and
     *      handed back rather than left for the caller to fetch again: a second read could land after the
     *      context moved, leaving a digest and an `extraData` that describe different things.
     *
     *      The domain carries the HOST chain id, not the gateway's. The verifier uses
     *      `_domainHashWithHostChainId` for this request while other paths use the gateway chain id from
     *      `eip712Domain()`, so the value in the domain struct is deliberately overridden below.
     */
    function userDecryptDigestV1(UserDecryptRequestV1 memory request)
        internal
        view
        returns (bytes32 digest, bytes memory extraData)
    {
        extraData = currentExtraData();
        bytes32 structHash = keccak256(
            abi.encode(
                USER_DECRYPT_REQUEST_TYPEHASH,
                keccak256(request.transportPublicKey),
                keccak256(abi.encodePacked(request.contractAddresses)),
                request.startTimestamp,
                request.durationDays,
                keccak256(extraData)
            )
        );
        digest = _toTypedDataHash(_domainHash(), structHash);
    }

    /**
     * @notice The digest a DELEGATE must sign to authorize a `delegatedUserDecrypt` request.
     * @param request The permit to sign: transport key, covered contracts, window.
     * @param delegatorAddress The account whose access is being exercised.
     * @return digest The EIP-712 digest. Sign it with the DELEGATE's key, not the delegator's.
     * @return extraData The bytes the digest was hashed over, returned so the two cannot disagree.
     *
     * @dev Mirrors `CleartextKMSVerifier._hashDelegatedUserDecryptionResult`.
     *
     *      The two parties are easy to swap, and the compiler cannot help: `delegatedUserDecrypt` names
     *      the DELEGATOR inside the signed struct but recovers the signature against the DELEGATE. So the
     *      address that appears here as a parameter is precisely the one that must NOT have signed.
     *
     *      `extraData` and the host chain id behave exactly as in `userDecryptDigestV1`; see there.
     */
    function delegatedUserDecryptDigestV1(UserDecryptRequestV1 memory request, address delegatorAddress)
        internal
        view
        returns (bytes32 digest, bytes memory extraData)
    {
        extraData = currentExtraData();
        bytes32 structHash = keccak256(
            abi.encode(
                DELEGATED_USER_DECRYPT_REQUEST_TYPEHASH,
                keccak256(request.transportPublicKey),
                keccak256(abi.encodePacked(request.contractAddresses)),
                delegatorAddress,
                request.startTimestamp,
                request.durationDays,
                keccak256(extraData)
            )
        );
        digest = _toTypedDataHash(_domainHash(), structHash);
    }

    /**
     * @notice The user-decryption round trip the relayer performs for a signed permit: the masked payload
     *         the stack computes, plus the KMS shares a client reconstructs the values from.
     * @param pairs The handles to decrypt, each with the contract it was allowed for.
     * @param request The permit: transport key, covered contracts, window.
     * @param userAddress The permit's signer, who must hold persistent access to every handle.
     * @param userSignature The signer's 65-byte `r || s || v` over `userDecryptDigestV1(request)`.
     * @return payload `abi.encode(uint256[] masked, bytes extraData)`, common to every share.
     * @return signatures One 65-byte `r || s || v` per share, from a random threshold-sized subset of the
     *         registered KMS signers.
     * @return extraData The KMS context the stack answered under, common to every share.
     *
     * @dev Mirrors the js-sdk's `fetchUserDecryptV1` on its on-chain path. The verifier does the real
     *      work: the permit signature, every ACL check, the pair authorisation and the masking all happen
     *      inside `ICleartextKMSVerifier.userDecrypt`, so a rejected request reverts there with the
     *      contract's own error rather than being second-guessed here.
     *
     *      Shares mirror `KmsSigncryptedShare {payload, signature, extraData}`: the payload and the
     *      extraData are the same for every share, so they are returned once and only the signatures are
     *      a list. As in the input path, the subset is random and threshold-sized rather than the full
     *      set, which is what `randomUniqueUints` does in the SDK; public decryption is the path that
     *      signs with everyone.
     *
     *      WHAT IS SIGNED. Each share carries what a real KMS node signs: an EIP-712 signature over
     *      `UserDecryptResponseVerification(publicKey, ctHandles, userDecryptedShare, extraData)` under the
     *      gateway `Decryption` domain, with the payload as `userDecryptedShare`. That is the check the
     *      SDK's `verifyKmsSigncryptedShare` performs and the tkms WASM performs during reconstruction,
     *      so these shares are the kind the protocol itself accepts.
     *
     *      The SDK's cleartext mock does NOT sign this way. It hands the raw payload to `sign({hash})`, which
     *      secp256k1 silently truncates to a constant leading word, and its own reconstruct step recovers the
     *      same way, so its check passes for any content. That verification loop is commented out in
     *      `fetchKmsSigncryptedSharesV1`. This library follows the protocol rather than the mock's bug.
     */
    function userDecryptV1(
        ICleartextKMSVerifier.HandleContractPair[] memory pairs,
        UserDecryptRequestV1 memory request,
        address userAddress,
        bytes memory userSignature
    ) internal view returns (bytes memory payload, bytes[] memory signatures, bytes memory extraData) {
        address[] memory signers;
        uint256 threshold;
        (payload, signers, threshold, extraData) = ICleartextKMSVerifier(KMS_VERIFIER_ADDRESS)
            .userDecrypt(
                pairs,
                userAddress,
                request.transportPublicKey,
                request.contractAddresses,
                request.startTimestamp,
                request.durationDays,
                userSignature
            );

        bytes32 digest = _shareDigest(request.transportPublicKey, _handlesOf(pairs), payload, extraData);

        // A random threshold-sized subset of the signers the stack named, exactly as the SDK chooses one.
        signatures = FhevmCleartextSigners.randomKmsNodeSignatures(digest, signers, threshold);
    }

    /**
     * @notice `userDecryptV1` for a DELEGATED permit: the delegate signed it, the delegator owns the
     *         handles.
     * @param pairs The handles to decrypt, each with the contract it was allowed for.
     * @param request The permit: the delegate's transport key, covered contracts, window.
     * @param delegator The account whose access is being exercised, and who holds it on every handle.
     * @param delegate The account that signed the permit and receives the masked values — it is the
     *        DELEGATE who signs, not the delegator.
     * @param delegateSignature The delegate's 65-byte `r || s || v` over
     *        `delegatedUserDecryptDigestV1(request, delegator)`. The two digests are different EIP-712
     *        structs, so a signature made for the plain request never verifies here.
     * @return payload `abi.encode(uint256[] masked, bytes extraData)`, common to every share.
     * @return signatures One 65-byte `r || s || v` per share, from a random threshold-sized subset of the
     *         registered KMS signers.
     * @return extraData The KMS context the stack answered under, common to every share.
     *
     * @dev Identical to `userDecryptV1` once the request is through the verifier: the response shares
     *      are built and signed the same way, over the same
     *      `UserDecryptResponseVerification(publicKey, ctHandles, userDecryptedShare, extraData)`. Only
     *      the authorisation differs, and that happens entirely inside
     *      `ICleartextKMSVerifier.delegatedUserDecrypt` — which additionally checks the delegation
     *      itself, reverting `CleartextErrorHandleNotDelegatedForUserDecryption` when it is missing.
     *
     *      The digest the delegate signs is the one carrying `delegatorAddress`, so a signature made
     *      for the plain request will not verify here and vice versa.
     */
    function delegatedUserDecryptV1(
        ICleartextKMSVerifier.HandleContractPair[] memory pairs,
        UserDecryptRequestV1 memory request,
        address delegator,
        address delegate,
        bytes memory delegateSignature
    ) internal view returns (bytes memory, bytes[] memory, bytes memory) {
        // Split across two private frames purely to stay inside solc's stack limit. Parameters are
        // stacked in declaration order, so with `request` second its FIELDS sit deep, and unpacking
        // them for an eight-argument call while three more parameters and the returns are live goes
        // over. Neither consuming project enables `via_ir`.
        (bytes memory payload, address[] memory signers, uint256 threshold, bytes memory extraData) =
            _delegatedVerify(pairs, request, delegator, delegate, delegateSignature);

        return _delegatedShares(pairs, request.transportPublicKey, payload, extraData, signers, threshold);
    }

    /// @dev The verifier call of `delegatedUserDecryptV1`, in its own frame so unpacking `request` is
    ///      not competing for stack with that function's other parameters.
    function _delegatedVerify(
        ICleartextKMSVerifier.HandleContractPair[] memory pairs,
        UserDecryptRequestV1 memory request,
        address delegator,
        address delegate,
        bytes memory delegateSignature
    ) private view returns (bytes memory, address[] memory, uint256, bytes memory) {
        return ICleartextKMSVerifier(KMS_VERIFIER_ADDRESS)
            .delegatedUserDecrypt(
                pairs,
                delegator,
                delegate,
                request.transportPublicKey,
                request.contractAddresses,
                request.startTimestamp,
                request.durationDays,
                delegateSignature
            );
    }

    /// @dev The tail of `delegatedUserDecryptV1`, for the same reason. Identical to what
    ///      `userDecryptV1` does inline.
    function _delegatedShares(
        ICleartextKMSVerifier.HandleContractPair[] memory pairs,
        bytes memory transportPublicKey,
        bytes memory payload,
        bytes memory extraData,
        address[] memory signers,
        uint256 threshold
    ) private view returns (bytes memory, bytes[] memory, bytes memory) {
        // A random threshold-sized subset of the signers the stack named, exactly as the SDK chooses one.
        bytes[] memory signatures = FhevmCleartextSigners.randomKmsNodeSignatures(
            _shareDigest(transportPublicKey, _handlesOf(pairs), payload, extraData), signers, threshold
        );
        return (payload, signatures, extraData);
    }

    /**
     * @notice The client's half of user decryption: checks the shares `userDecrypt` returned and
     *         recovers the clear values from them.
     * @param payload The `payload` returned by `userDecrypt`.
     * @param signatures The `signatures` returned by `userDecrypt`, one 65-byte `r || s || v` each.
     * @param extraData The `extraData` returned by `userDecrypt`.
     * @param handles The handles of `pairs`, in order: they are inside every share's signed message.
     * @param publicKey The SAME bytes that were passed to `userDecrypt`; the mask is their first 32 bytes.
     * @return cleartexts The values, in `pairs` order, still `uint256`-wide. Narrowing to each handle's
     *         type is the caller's presentation choice, as it is in the SDK.
     *
     * @dev Mirrors the js-sdk's `decryptAndReconstruct`, check for check and in its order:
     *
     *      1. at least one share;
     *      2. the extraData is well-formed KMS extraData (`0x`, `0x00`, or a versioned v1/v2 blob);
     *      3. every share's signature recovers, over the rebuilt `UserDecryptResponseVerification` digest,
     *         to a KMS signer registered for THAT extraData's context, read through
     *         `getContextSignersAndThresholdFromExtraData` so a share from another context fails;
     *      4. the payload decodes as `(uint256[] masked, bytes signedExtraData)`;
     *      5. the extraData carried inside the payload equals the one carried beside it;
     *      6. each value is unmasked by XOR with the first 32 bytes of the public key.
     *
     *      Like the SDK, this checks MEMBERSHIP of each signer, not that the shares reach the context's
     *      threshold, and it does not reject a signer appearing twice. The threshold is returned by the
     *      same call and is discarded here on purpose, to stay faithful rather than stricter.
     *
     *      Recovery rebuilds the exact EIP-712 message each KMS node signs, as `verifyKmsSigncryptedShare`
     *      does, which is why the handles are needed here: they are part of the signed struct.
     *
     *      The SDK takes the client's PRIVATE key and derives the public key from it. Here the public key
     *      bytes are taken directly, because the mask is simply the first 32 bytes of whatever bytes were
     *      handed to `userDecrypt`, and a forge test holds those already.
     */
    function decryptAndReconstruct(
        bytes memory payload,
        bytes[] memory signatures,
        bytes memory extraData,
        bytes32[] memory handles,
        bytes memory publicKey
    ) internal view returns (uint256[] memory cleartexts) {
        if (signatures.length == 0) revert NoShares();
        _requireValidKmsExtraData(extraData);

        // The signer set of the context these shares claim, not merely the current one.
        (address[] memory signers,) =
            ICleartextKMSVerifier(KMS_VERIFIER_ADDRESS).getContextSignersAndThresholdFromExtraData(extraData);

        bytes32 digest = _shareDigest(publicKey, handles, payload, extraData);
        for (uint256 i = 0; i < signatures.length; i++) {
            address recovered = _recoverShareSigner(digest, signatures[i], i);
            if (!_contains(signers, recovered)) revert UnknownShareSigner(i, recovered);
        }

        (uint256[] memory masked, bytes memory signedExtraData) = abi.decode(payload, (uint256[], bytes));
        if (keccak256(signedExtraData) != keccak256(extraData)) revert ExtraDataMismatch();

        if (publicKey.length < 32) revert PublicKeyTooShort(publicKey.length);
        bytes32 mask;
        assembly {
            mask := mload(add(publicKey, 32))
        }

        cleartexts = new uint256[](masked.length);
        for (uint256 i = 0; i < masked.length; i++) {
            cleartexts[i] = masked[i] ^ uint256(mask);
        }
    }

    /**
     * @notice The `extraData` the verifier will build for itself, exposed because the digest hashes over
     *         it and a caller may want to assert on it.
     * @dev `CleartextKMSVerifier._buildCurrentExtradata`: a v1 version byte followed by the 32-byte
     *      current KMS context id.
     */
    function currentExtraData() internal view returns (bytes memory extraData) {
        uint256 contextId = ICleartextKMSVerifier(KMS_VERIFIER_ADDRESS).getCurrentKmsContextId();
        extraData = new bytes(33);
        extraData[0] = 0x01;
        assembly {
            mstore(add(extraData, 33), contextId)
        }
    }

    /**
     * @dev The EIP-712 digest a KMS node signs for one response share, `UserDecryptResponseVerification`
     *      under the gateway `Decryption` domain. Shared by the signing side and the verifying side so the
     *      two cannot drift apart.
     */
    function _shareDigest(
        bytes memory publicKey,
        bytes32[] memory handles,
        bytes memory payload,
        bytes memory extraData
    ) private pure returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                USER_DECRYPT_RESPONSE_TYPEHASH,
                keccak256(publicKey),
                keccak256(abi.encodePacked(handles)),
                keccak256(payload),
                keccak256(_signedExtraData(extraData))
            )
        );
        bytes32 domainHash = keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes(DECRYPTION_DOMAIN_NAME)),
                keccak256(bytes(DECRYPTION_DOMAIN_VERSION)),
                uint256(LocalHostBootstrap.GATEWAY_CHAIN_ID),
                LocalHostBootstrap.DECRYPTION_ADDRESS
            )
        );
        return _toTypedDataHash(domainHash, structHash);
    }

    /// @dev `toKmsSignedExtraDataBytesHex`: the KMS signs over EMPTY bytes for v0 extraData (the `0x00`
    ///      sentinel is a transport form), and over the versioned blob verbatim otherwise.
    function _signedExtraData(bytes memory extraData) private pure returns (bytes memory) {
        if (extraData.length == 0 || uint8(extraData[0]) == 0x00) return "";
        return extraData;
    }

    function _handlesOf(ICleartextKMSVerifier.HandleContractPair[] memory pairs)
        private
        pure
        returns (bytes32[] memory handles)
    {
        handles = new bytes32[](pairs.length);
        for (uint256 i = 0; i < pairs.length; i++) {
            handles[i] = pairs[i].handle;
        }
    }

    /// @dev `assertIsKmsExtraDataBytesHex`: empty and `0x00` pass outright; otherwise the version byte
    ///      fixes the length. v1 is the byte plus a 32-byte context id, v2 adds a 32-byte epoch id.
    function _requireValidKmsExtraData(bytes memory extraData) private pure {
        uint256 len = extraData.length;
        if (len == 0) return;
        uint8 version = uint8(extraData[0]);
        bool ok = (version == 0x00 && len == 1) || (version == 0x01 && len == 33) || (version == 0x02 && len == 65);
        if (!ok) revert InvalidKmsExtraData(len);
    }

    /// @dev `ecrecover` over a 65-byte `r || s || v` share signature. `v` is accepted as 0/1 or 27/28, as
    ///      the SDK's own recovery does; anything else, or a zero recovery, is a malformed share.
    function _recoverShareSigner(bytes32 digest, bytes memory signature, uint256 index)
        private
        pure
        returns (address recovered)
    {
        if (signature.length != 65) revert InvalidShareSignature(index);
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := byte(0, mload(add(signature, 0x60)))
        }
        if (v < 27) v += 27;
        if (v != 27 && v != 28) revert InvalidShareSignature(index);
        recovered = ecrecover(digest, v, r, s);
        if (recovered == address(0)) revert InvalidShareSignature(index);
    }

    function _contains(address[] memory set, address value) private pure returns (bool) {
        for (uint256 i = 0; i < set.length; i++) {
            if (set[i] == value) return true;
        }
        return false;
    }

    /// @dev The verifier's own domain, read live rather than reconstructed, so a redeploy or a renamed
    ///      domain cannot silently desynchronise this library from the stack it is signing for.
    function _domainHash() private view returns (bytes32) {
        (, string memory name, string memory version,, address verifyingContract,,) =
            ICleartextKMSVerifier(KMS_VERIFIER_ADDRESS).eip712Domain();

        return keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes(name)),
                keccak256(bytes(version)),
                block.chainid,
                verifyingContract
            )
        );
    }

    /// @dev EIP-712: `keccak256("\x19\x01" || domainHash || structHash)`.
    function _toTypedDataHash(bytes32 domainHash, bytes32 structHash) private pure returns (bytes32 typedDataHash) {
        assembly ("memory-safe") {
            let ptr := mload(0x40)
            mstore(ptr, hex"1901")
            mstore(add(ptr, 0x02), domainHash)
            mstore(add(ptr, 0x22), structHash)
            typedDataHash := keccak256(ptr, 0x42)
        }
    }

    /**
     * @notice A fresh, RANDOM transport keypair — the pair a `userDecrypt` payload is masked with.
     * @return publicKey The UNCOMPRESSED secp256k1 public key: 65 bytes, `0x04 || X || Y`.
     * @return privateKey The 32 bytes `publicKey` is derived from.
     *
     * @dev Mirrors the js-sdk cleartext mock (`core/modules/decrypt/mock.ts`) step for step:
     *
     *      1. `generateTkmsPrivateKey` -> `generatePrivateKey()`, i.e.
     *         `toHex(secp256k1.utils.randomPrivateKey())`, a random scalar in `[1, N-1]`. Forced into
     *         range branchlessly: `>> 1` puts it below `2**255 < N`, `| 1` keeps it non-zero. That
     *         spends two bits, so 254 of entropy remain — every key it yields is one
     *         `randomPrivateKey()` could have yielded, which is what compatibility needs.
     *      2. `getTkmsPublicKeyHex` -> `getPublicKey({privateKey})`, which is
     *         `SigningKey.computePublicKey(pk, false)` in the ethers build and `account.publicKey` in
     *         the viem one. Both return the UNCOMPRESSED form.
     *
     *      The uncompressed encoding is not cosmetic: the mask is the FIRST 32 BYTES of `publicKey`
     *      (see `decryptAndReconstruct` below, and `_xorUnmaskWithPublicKey` in the mock), so it is
     *      `0x04` followed by the first 31 bytes of X, NOT X. The 64-byte `X || Y` form, or the
     *      compressed one, would mask with different bytes and decrypt to garbage rather than fail.
     *
     *      Two loose `bytes` rather than a struct: this library is the payload copied into every
     *      consumer, so it must stay a leaf and cannot name a type defined above it.
     */
    function generateTransportKeypair() internal returns (bytes memory publicKey, bytes memory privateKey) {
        uint256 scalar = (fvm.randomUint() >> 1) | 1;
        IForgeVm.Wallet memory wallet = fvm.createWallet(scalar);

        publicKey = abi.encodePacked(bytes1(0x04), wallet.publicKeyX, wallet.publicKeyY);
        privateKey = abi.encodePacked(scalar);
    }
}
