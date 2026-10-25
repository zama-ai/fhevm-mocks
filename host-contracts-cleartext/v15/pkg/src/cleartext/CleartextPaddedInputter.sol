// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {PaddedInputter} from "../contracts/PaddedInputter.sol";
import {KMSVerifier} from "../contracts/KMSVerifier.sol";
import {ACL} from "../contracts/ACL.sol";
import {IProtocolConfig} from "../contracts/interfaces/IProtocolConfig.sol";
import {EXTRA_DATA_V2} from "../contracts/shared/Constants.sol";
import {aclAdd, kmsVerifierAdd, protocolConfigAdd} from "../addresses/FHEVMHostAddresses.sol";
import {LibCleartextPad} from "./shared/LibCleartextPad.sol";
import {LibKmsVerifier, UserDecryptPermitV2} from "./shared/LibKmsVerifier.sol";

// -----------------------------------------------------------------------------------------
// RFC-030 (pad-based input encryption) — pad decryption request/response types.
// Field names, types and order follow the RFC verbatim. The authentication struct is RFC-016's,
// `UserDecryptPermitV2` (LibKmsVerifier), the one `CleartextKMSVerifier.userDecryptV2` checks.
// -----------------------------------------------------------------------------------------

/// @notice One pad: its witness fields, its label (`hash(witness)`) and the number of bits to release.
struct PadWitness {
    address submitter; // witness field
    address consumer; // witness field
    uint64 expirationTimestamp; // witness field; Unix seconds
    address[] decryptors; // witness field
    bytes16 nonce; // witness field
    bytes32 label; // the pad's label, the hash of the witness
    uint16 padLength; // bits of the pad stream to release; not a witness field
}

/// @notice Unsigned part of a pad decryption request.
struct PadDecryptRequestPayload {
    uint8 witnessVersion; // shared witness field, fixed for the whole request
    uint16 prf; // shared witness field, fixed for the whole request
    uint64 chainId; // shared witness field, fixed for the whole request
    PadWitness[] witnesses; // one entry per pad
}

/// @notice Pad decryption request (`PadDecryptRequest` in RFC-030).
struct PadDecryptRequest {
    UserDecryptPermitV2 auth; // same as RFC-016
    bytes signature; // signature for auth
    PadDecryptRequestPayload payload; // unsigned
}

/// @notice A pad share keyed by label (`PadShare` in RFC-030).
struct PadShare {
    bytes32 label; // which pad this share belongs to
    bytes16 sessionId; // the MPC session that produced this share
    bytes share; // the (mock-encrypted) pad blocks
}

/**
 * @notice Everything the KMS nodes of a context would sign and return for a pad decryption request, except the
 *         signatures (cleartext mode only). `signers`, `partyIds` and `digests` are index-aligned: node
 *         `signers[i]` signs `digests[i]`, the EIP-712 digest of its `PadDecryptResponsePayload`
 *         `{packingFactor, extraData, degree, partyIds[i], padShares}`.
 */
struct CleartextPadSharesMaterial {
    bytes32 requestId; // mock-defined request id: keccak256(labels ‖ extraData ‖ signature)
    uint32 packingFactor; // PRF blocks per ring element
    uint32 degree; // sharing degree t of the context (n = 3t + 1)
    bytes extraData; // auth.extraData, verbatim
    PadShare[] padShares; // one entry per witness, in request order; the same for every node
    address[] signers; // KMS signers of the context named by extraData
    uint32[] partyIds; // partyIds[i] is the 1-based party id of signers[i]
    bytes32[] digests; // digests[i] is what signers[i] signs
    uint256 threshold; // user-decryption threshold of that context
}

/**
 * @title CleartextPaddedInputter
 * @notice The RFC-030 padded inputter of a cleartext stack: the markers that identify one, and the cleartext mock
 *         of RFC-030 pad DECRYPTION.
 * @dev The input half is `PaddedInputter`'s, unchanged: this overrides nothing. The cleartext value of a pad-based
 *      input is recovered by `CleartextArithmetic`, from the input package the executor hands it
 *      (`LibCleartextPad.unmaskPart`).
 *
 *      The decryption half, `getCleartextPadSharesMaterial`, stands in for the KMS Connector and Core, which serve
 *      it in production; nothing here does that on a real chain. It lives on this contract because it is the
 *      RFC-030 contract, reached from the executor (`CleartextFHEVMExecutor.getPaddedInputterAddress()`), and
 *      because it must hold a pad to the same witness rules the input half accepted it under: it reads
 *      `PaddedInputter`'s own constants and errors rather than a second copy of them. Ported from fhevm's
 *      sdk/js-sdk/contracts/src/v0.16.0/cleartext/CleartextInputVerifier.sol (`getPadShares`), adapted to this
 *      stack: `IProtocolConfig`, `LibCleartextPad`, `LibKmsVerifier`, the ACL's `isDelegatedForUserDecryption`
 *      (fhevm#4536, backported into the vendored ACL).
 *
 *      A real deployment has no `IS_CLEARTEXT` selector, so a consumer can probe it to tell a cleartext stack from
 *      a production deployment. The generation marker lives on `CleartextACL` alone, the one address every
 *      consumer already holds; `getVersion()` here still reports the base contract.
 *
 *      Constants rather than storage: these run behind proxies, where an initialized state variable is only ever
 *      written to the implementation's own storage and reads back as `false` or zero through the proxy.
 */
/// @custom:security-contact https://github.com/zama-ai/fhevm/blob/main/SECURITY.md
contract CleartextPaddedInputter is PaddedInputter {
    /// @notice Marks a cleartext (mock) implementation. Real host contracts have no such selector, so a
    ///         consumer can probe it to tell a cleartext stack from a production deployment.
    bool public constant IS_CLEARTEXT = true;

    // ---- RFC-030 pad decryption constants (the witness limits are PaddedInputter's own) ----

    /// @notice PRF blocks per ring element in the cleartext mock: one 32-byte block each.
    uint32 private constant PAD_DECRYPT_PACKING_FACTOR = 1;

    /// @notice Upper bound on the number of witnesses in one request (implementation-specific).
    uint256 private constant PAD_DECRYPT_MAX_WITNESSES = 32;

    // ---- RFC-030 pad decryption errors (PaddedInputter's own where the meaning is the same) ----

    error PadDecryptInvalidUserAddress();
    error PadDecryptInvalidSignature(address userAddress);
    error PadDecryptRequestExpired(uint256 startTimestamp, uint256 durationSeconds);
    error PadDecryptSignatureInvalidated(address userAddress, uint256 startTimestamp, uint256 invalidatedBefore);
    error PadDecryptInvalidExtraData(bytes extraData);
    error PadDecryptInvalidKmsContextOrEpoch(uint256 contextId, uint256 epochId);
    error PadDecryptInvalidWitnessCount(uint256 count);
    error PadDecryptDuplicateLabel(bytes32 label);
    error PadDecryptTooManyDecryptors(bytes32 label, uint256 count);
    error PadDecryptNullWitnessAddress(bytes32 label);
    error PadDecryptInvalidPadLength(bytes32 label, uint16 padLength);
    error PadDecryptWitnessExpired(bytes32 label, uint64 expirationTimestamp);
    error PadDecryptConsumerNotAllowed(bytes32 label, address consumer);
    error PadDecryptUserNotAuthorized(bytes32 label, address userAddress);
    error PadDecryptPublicKeyTooShort(uint256 length);

    // -----------------------------------------------------------------------------------------
    // RFC-030 pad decryption ("Request pad decryption")
    // -----------------------------------------------------------------------------------------

    /**
     * @notice Cleartext mock of the KMS pad decryption flow (RFC-030 `verify_pad_decryption_request`): everything
     *         each KMS node of the context would sign and send back, except the signature.
     * @dev Runs the RFC's authentication and authorization checks against host-chain state, releases each
     *      requested pad keyed by label, and builds, for every signer of the context, the EIP-712 digest of the
     *      `PadDecryptResponsePayload` that node signs. The SDK then only signs `digests[i]` with the key of
     *      `signers[i]` and wraps the result. All-or-nothing: any failing witness reverts.
     *
     *      Deviations from the real KMS, all inherent to cleartext mode:
     *      - The pad comes from a keccak-based stand-in PRF (see `LibCleartextPad`), not from
     *        `PRF_{FHE(k)}(label)`. It is deterministic in `(prf, label)` only, as RFC-030 requires.
     *      - Every PRF instance id is accepted (the registry this contract keeps is not consulted yet); `prf`
     *        is still bound into both the label and the cleartext pad.
     *      - Instead of per-node threshold shares encrypted with ML-KEM + AES-GCM, each share is the
     *        whole encrypted pad — ⌈padLength/256⌉ cleartext PRF blocks of 32 bytes, i.e. one ring
     *        element per block (packing factor 1) — XOR-masked with the first 32 bytes of
     *        `auth.publicKey` (repeated), the same mock as `CleartextKMSVerifier`. The client unmasks
     *        it with the same 32 bytes and keeps the first `padLength` bits. Every node returns the same
     *        shares; only `partyId`, and so the digest, differs.
     *      - Each share's `sessionId` is a deterministic function of `(prf, label)`: one mock
     *        "session" per label, shared by every node and every requester of that label.
     *      - `degree` is `⌊(n - 1) / 3⌋` for the context's `n` signers (n = 3t + 1), and `requestId` is a
     *        mock-defined hint: keccak256(labels ‖ extraData ‖ signature).
     *      - `auth.startTimestamp <= block.timestamp` is not enforced: a view call on anvil can
     *        observe a block timestamp older than the client's wall clock. Expiry is enforced.
     *
     * @param request The pad decryption request.
     * @return material What every node of the context signs, index-aligned with `material.signers`.
     */
    function getCleartextPadSharesMaterial(PadDecryptRequest calldata request)
        external
        view
        returns (CleartextPadSharesMaterial memory material)
    {
        uint256 contextId;
        (material.padShares, contextId) = _releasePadShares(request);

        // Production: each KMS Core node of the context signs its own PadDecryptResponsePayload.
        IProtocolConfig protocolConfig = IProtocolConfig(protocolConfigAdd);
        material.signers = protocolConfig.getKmsSignersForContext(contextId);
        material.threshold = protocolConfig.getUserDecryptionThresholdForContext(contextId);
        material.extraData = request.auth.extraData;
        material.packingFactor = PAD_DECRYPT_PACKING_FACTOR;
        uint256 n = material.signers.length;
        // forge-lint: disable-next-line(unsafe-typecast)
        material.degree = n == 0 ? 0 : uint32((n - 1) / 3);
        material.requestId = _padRequestId(request);

        // Only `partyId` differs between nodes: the shares are hashed once.
        bytes32 padSharesHash = _padSharesHash(material.padShares);
        bytes32 domainHash = _responseDomainHash();
        material.partyIds = new uint32[](n);
        material.digests = new bytes32[](n);
        for (uint256 i = 0; i < n; ++i) {
            // Party ids are 1-based, matching the deployed KMS node set.
            // forge-lint: disable-next-line(unsafe-typecast)
            uint32 partyId = uint32(i + 1);
            material.partyIds[i] = partyId;
            material.digests[i] = keccak256(
                abi.encodePacked(
                    hex"1901",
                    domainHash,
                    LibCleartextPad.padDecryptResponseStructHash(
                        material.packingFactor, material.extraData, material.degree, partyId, padSharesHash
                    )
                )
            );
        }
    }

    /**
     * @notice Computes an RFC-030 label:
     *         keccak256("FHE_padl" ‖ witnessVersion ‖ prf ‖ chainId ‖ submitter ‖ consumer ‖
     *                   expirationTimestamp ‖ decryptorCount ‖ decryptors ‖ nonce)
     * @dev Fixed-width big-endian fields; each decryptor is 20 bytes (not ABI-padded).
     *      `witness.label` and `witness.padLength` are ignored.
     *      Production: the client (SDK) computes the label; Connector, PaddedInputter, coprocessor verify it.
     */
    function computePadLabel(uint8 witnessVersion, uint16 prf, uint64 chainId, PadWitness calldata witness)
        public
        pure
        returns (bytes32)
    {
        return LibCleartextPad.padLabel(
            witnessVersion,
            prf,
            chainId,
            witness.submitter,
            witness.consumer,
            witness.expirationTimestamp,
            witness.decryptors,
            witness.nonce
        );
    }

    // ---- RFC-030 internals ----

    /// @dev Steps 1 to 7 of the RFC: authenticate, check freshness, resolve the context, check and authorize every
    ///      witness, then release each pad mock-encrypted under the user's public key.
    function _releasePadShares(PadDecryptRequest calldata request)
        private
        view
        returns (PadShare[] memory padShares, uint256 contextId)
    {
        UserDecryptPermitV2 calldata auth = request.auth;
        PadDecryptRequestPayload calldata payload = request.payload;

        // 1. Authenticate that the request is from the user (ecrecover, then ERC-1271 fallback).
        // Production: KMS Connector.
        _authenticatePadRequest(auth, request.signature, payload.chainId);

        // 2. Check freshness of the request.
        // Production: KMS Connector.
        ACL acl = ACL(aclAdd);
        if (block.timestamp > auth.startTimestamp + auth.durationSeconds) {
            revert PadDecryptRequestExpired(auth.startTimestamp, auth.durationSeconds);
        }
        uint256 invalidatedBefore = acl.decryptionSignatureInvalidatedBefore(auth.userAddress);
        if (auth.startTimestamp < invalidatedBefore) {
            revert PadDecryptSignatureInvalidated(auth.userAddress, auth.startTimestamp, invalidatedBefore);
        }

        // 3. Resolve the context and epoch to serve the request under (v2 extraData only).
        // Production: KMS Connector, against ProtocolConfig.
        contextId = _checkPadExtraData(auth.extraData);

        // 4.-6. Witness structure, label authentication, pad authorization.
        // Production: KMS Connector; it verifies each label, the client (SDK) computed it.
        _checkPadPayload(payload);
        for (uint256 i = 0; i < payload.witnesses.length; ++i) {
            _authorizePadWitness(acl, auth, payload.witnesses[i]);
        }

        // 7. Release each pad, mock-encrypted under the user's public key.
        // Production: KMS Core encrypts each node's payload with ML-KEM + AES-128-GCM under auth.publicKey.
        bytes32 mask = _publicKeyMask(auth.publicKey);
        padShares = new PadShare[](payload.witnesses.length);
        for (uint256 i = 0; i < payload.witnesses.length; ++i) {
            PadWitness calldata w = payload.witnesses[i];
            padShares[i] = PadShare({
                label: w.label,
                // Production: KMS Core, the MPC session that produced this node's share.
                sessionId: LibCleartextPad.sessionId(payload.prf, w.label),
                // Production: coprocessor computes FHE(r) = PRF_{FHE(k)}(label); KMS Core threshold-decrypts it.
                share: LibCleartextPad.xorMask(LibCleartextPad.padBlocks(payload.prf, w.label, w.padLength), mask)
            });
        }
    }

    /// @dev The mock request id over the request's labels, in request order.
    function _padRequestId(PadDecryptRequest calldata request) private pure returns (bytes32) {
        PadWitness[] calldata witnesses = request.payload.witnesses;
        bytes32[] memory labels = new bytes32[](witnesses.length);
        for (uint256 i = 0; i < witnesses.length; ++i) {
            labels[i] = witnesses[i].label;
        }
        return LibCleartextPad.padRequestId(labels, request.auth.extraData, request.signature);
    }

    /// @dev EIP-712 `encodeData` of the `PadShare[] pad_shares` member: the hash of the shares' struct hashes.
    function _padSharesHash(PadShare[] memory padShares) private pure returns (bytes32) {
        bytes32[] memory hashes = new bytes32[](padShares.length);
        for (uint256 i = 0; i < padShares.length; ++i) {
            hashes[i] =
                LibCleartextPad.padShareStructHash(padShares[i].label, padShares[i].sessionId, padShares[i].share);
        }
        return keccak256(abi.encodePacked(hashes));
    }

    /// @dev The domain KMS responses are signed under: the KMSVerifier's own, with the gateway chain id.
    function _responseDomainHash() private view returns (bytes32) {
        (, string memory name, string memory version, uint256 gatewayChainId, address verifyingContract,,) =
            KMSVerifier(kmsVerifierAdd).eip712Domain();
        return LibKmsVerifier.domainSeparatorFrom(name, version, gatewayChainId, verifyingContract);
    }

    /// @dev RFC-016 EIP-712 digest under the KMS `Decryption` domain, with the host chain id
    ///      (`payload.chainId`) as domain chain id, then ecrecover with ERC-1271 fallback.
    function _authenticatePadRequest(UserDecryptPermitV2 calldata auth, bytes calldata signature, uint64 chainId)
        private
        view
    {
        if (auth.userAddress == address(0)) revert PadDecryptInvalidUserAddress();

        bytes32 structHash = keccak256(
            abi.encode(
                LibKmsVerifier.USER_DECRYPT_REQUEST_V2_TYPEHASH,
                auth.userAddress,
                keccak256(auth.publicKey),
                keccak256(abi.encodePacked(auth.allowedContracts)),
                auth.startTimestamp,
                auth.durationSeconds,
                keccak256(auth.extraData)
            )
        );
        bytes32 digest = keccak256(abi.encodePacked(hex"1901", _decryptionDomainHash(chainId), structHash));

        if (signature.length != 0) {
            (address recovered, ECDSA.RecoverError err,) = ECDSA.tryRecover(digest, signature);
            if (err == ECDSA.RecoverError.NoError && recovered == auth.userAddress) {
                return;
            }
        }
        if (!SignatureChecker.isValidERC1271SignatureNow(auth.userAddress, digest, signature)) {
            revert PadDecryptInvalidSignature(auth.userAddress);
        }
    }

    /// @dev KMS `Decryption` EIP-712 domain (name, version, verifyingContract read from the KMSVerifier).
    function _decryptionDomainHash(uint64 chainId) private view returns (bytes32) {
        (, string memory name, string memory version,, address verifyingContract,,) =
            KMSVerifier(kmsVerifierAdd).eip712Domain();
        return LibKmsVerifier.domainSeparatorFrom(name, version, chainId, verifyingContract);
    }

    /// @dev Requires v2 extraData `[0x02 | contextId | epochId]` naming a valid context and epoch.
    function _checkPadExtraData(bytes calldata extraData) private view returns (uint256 contextId) {
        if (extraData.length != 65 || uint8(extraData[0]) != EXTRA_DATA_V2) {
            revert PadDecryptInvalidExtraData(extraData);
        }
        contextId = uint256(bytes32(extraData[1:33]));
        uint256 epochId = uint256(bytes32(extraData[33:65]));

        IProtocolConfig protocolConfig = IProtocolConfig(protocolConfigAdd);
        if (!protocolConfig.isValidKmsContext(contextId) || !protocolConfig.isValidEpochForContext(contextId, epochId))
        {
            revert PadDecryptInvalidKmsContextOrEpoch(contextId, epochId);
        }
    }

    /// @dev Steps 4 and 5: request-wide fields, per-witness structure and freshness, label authentication.
    function _checkPadPayload(PadDecryptRequestPayload calldata payload) private view {
        if (payload.witnessVersion != PAD_WITNESS_VERSION) revert PadUnsupportedWitnessVersion(payload.witnessVersion);
        if (payload.chainId != block.chainid) revert PadInvalidChainId(payload.chainId);

        uint256 n = payload.witnesses.length;
        if (n == 0 || n > PAD_DECRYPT_MAX_WITNESSES) revert PadDecryptInvalidWitnessCount(n);

        for (uint256 i = 0; i < n; ++i) {
            PadWitness calldata w = payload.witnesses[i];

            for (uint256 j = 0; j < i; ++j) {
                if (payload.witnesses[j].label == w.label) revert PadDecryptDuplicateLabel(w.label);
            }

            if (w.decryptors.length > PAD_MAX_DECRYPTORS) {
                revert PadDecryptTooManyDecryptors(w.label, w.decryptors.length);
            }
            if (w.submitter == address(0)) revert PadDecryptNullWitnessAddress(w.label);
            for (uint256 j = 0; j < w.decryptors.length; ++j) {
                if (w.decryptors[j] == address(0)) revert PadDecryptNullWitnessAddress(w.label);
            }
            if (w.padLength == 0 || w.padLength > PAD_MAX_PAD_LENGTH) {
                revert PadDecryptInvalidPadLength(w.label, w.padLength);
            }
            if (w.expirationTimestamp <= block.timestamp) {
                revert PadDecryptWitnessExpired(w.label, w.expirationTimestamp);
            }

            bytes32 expectedLabel = computePadLabel(payload.witnessVersion, payload.prf, payload.chainId, w);
            if (expectedLabel != w.label) revert PadLabelMismatch(w.label, expectedLabel);
        }
    }

    /// @dev Step 6: the consumer must be in `allowedContracts` (unless empty), and the user must be
    ///      the submitter, a listed decryptor, or a live delegate of one of them for the consumer.
    function _authorizePadWitness(ACL acl, UserDecryptPermitV2 calldata auth, PadWitness calldata w) private view {
        if (auth.allowedContracts.length != 0) {
            bool allowed;
            for (uint256 i = 0; i < auth.allowedContracts.length; ++i) {
                if (auth.allowedContracts[i] == w.consumer) {
                    allowed = true;
                    break;
                }
            }
            if (!allowed) revert PadDecryptConsumerNotAllowed(w.label, w.consumer);
        }

        address user = auth.userAddress;
        if (user == w.submitter) return;
        for (uint256 i = 0; i < w.decryptors.length; ++i) {
            if (user == w.decryptors[i]) return;
        }

        // Delegation fallback (RFC-030: the ACL's handle-free `isDelegatedForUserDecryption` view).
        if (acl.isDelegatedForUserDecryption(w.submitter, user, w.consumer)) return;
        for (uint256 i = 0; i < w.decryptors.length; ++i) {
            if (acl.isDelegatedForUserDecryption(w.decryptors[i], user, w.consumer)) return;
        }
        revert PadDecryptUserNotAuthorized(w.label, user);
    }

    /// @dev First 32 bytes of the user's public key, the mock encryption mask.
    function _publicKeyMask(bytes calldata publicKey) private pure returns (bytes32) {
        if (publicKey.length < 32) revert PadDecryptPublicKeyTooShort(publicKey.length);
        return bytes32(publicKey[0:32]);
    }
}
