// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {KMSVerifier} from "../contracts/KMSVerifier.sol";
import {IProtocolConfig} from "../contracts/interfaces/IProtocolConfig.sol";
import {EXTRA_DATA_V2} from "../contracts/shared/Constants.sol";
import {aclAdd, fhevmExecutorAdd, protocolConfigAdd} from "../addresses/FHEVMHostAddresses.sol";
import {
    DelegatedUserDecryptPayloadArgsV1,
    HandleContractPair,
    LibKmsVerifier,
    PublicDecryptPayloadArgs,
    SignerSignaturePair,
    UserDecryptPayloadArgsV1,
    UserDecryptRequestV1
} from "./shared/LibKmsVerifier.sol";

/**
 * @title CleartextKMSVerifier
 */
contract CleartextKMSVerifier is KMSVerifier {
    /// @notice Marks a cleartext (mock) implementation. Real host contracts have no such selector, so a
    ///         consumer can probe it to tell a cleartext stack from a production deployment.
    bool public constant IS_CLEARTEXT = true;

    /// @notice EIP-712 domain typehash.
    bytes32 private constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    /// @notice EIP-712 domain separator for this KMS verifier, read from `eip712Domain()`.
    function _domainHashWithGatewayChainId() private view returns (bytes32) {
        return _domainHash(0);
    }

    /// @notice EIP-712 domain separator using the current host chain id.
    function _domainHashWithHostChainId() private view returns (bytes32) {
        return _domainHash(block.chainid);
    }

    /// @notice Same as `_domainHash()` but lets the caller override the `chainId`
    ///         component of the EIP-712 domain. Pass `0` to use the default
    ///         (`eip712Domain().chainId`, which is the gateway chain id).
    ///         Useful when the caller signed the permit against a chain id that
    ///         differs from what this verifier was initialized with.
    function _domainHash(uint256 overrideChainId) private view returns (bytes32) {
        (, string memory name, string memory version, uint256 gatewayChainId, address verifyingContract,,) =
            eip712Domain();

        uint256 domainChainId = overrideChainId == 0 ? gatewayChainId : overrideChainId;

        return LibKmsVerifier.domainSeparatorFrom(name, version, domainChainId, verifyingContract);
    }

    /// @notice The extraData a public-decryption request names refers to no valid KMS context.
    error CleartextErrorInvalidKmsContext(uint256 kmsContextId);

    /// @notice Returns cleartexts and KMS metadata for public decryption, signed over the CURRENT KMS
    ///         context (extraData v1, `0x01 | contextId`). TEMPORARY: see the warning in the body.
    /// @dev    For sdks whose cleartext path does not pass the extraData they will verify the proof against
    ///         (FHEVM SDK 0.13.x and 0.14.x call `publicDecrypt(handles)`). The overload below, which takes the
    ///         extraData, serves any requested version.
    function publicDecrypt(bytes32[] memory handles)
        external
        view
        virtual
        returns (
            bytes memory abiEncodedCleartexts,
            bytes32 digest,
            address[] memory signers,
            uint256 threshold,
            bytes memory extraData
        )
    {
        // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        // !!! TEMPORARY — REMOVE WHEN THE PATCHED FHEVM SDK RELEASES ARE PINNED !!!
        // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        // extraData v1 on purpose. On a v14 chain the right default is v2 (`0x02 | contextId | epochId`),
        // which is what SDK 0.14 requests. But the hardhat plugins temporarily hide `protocolConfig` from the
        // SDK's chain definition (the "no protocolConfig address" trick), so SDK 0.14 requests v1 like SDK
        // 0.13, and this one-argument call must sign v1 for both to verify the proof.
        // EXIT: once the SDKs call `publicDecrypt(handles, extraData)` and the plugins restore
        // `protocolConfig`, replace the line below with:
        //     return _publicDecrypt(handles, _currentExtraDataV2());
        // Counterparts of this trick: cleartextChain() in hardhat/v3/plugin/pkg/src/internal/chains.ts and
        // localCleartext in hardhat/v2/plugin/pkg/src/internal/chains.ts, which omit protocolConfig.
        // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        return _publicDecrypt(handles, LibKmsVerifier.extraDataForContext(getCurrentKmsContextId()));
    }

    /// @notice Same, signed over exactly the `extraData` the requester names, as a real relayer has the KMS
    ///         sign over the extraData the request carries.
    /// @dev    v14 only. The sdk decides which KMS committee must sign and verifies the proof against its own
    ///         extraData, ignoring the one returned here. So the digest must be built over the REQUESTED
    ///         extraData: v0 (empty or `0x00`: the current context), v1 (`0x01 | contextId`) or v2
    ///         (`0x02 | contextId | epochId`). Parsed by KMSVerifier's own `_extractKmsContextId`, which rejects
    ///         a malformed or unsupported one; the context it names must be valid. The epoch id of a v2 is not
    ///         checked, as KMSVerifier does not check it when it verifies the proof either.
    function publicDecrypt(bytes32[] memory handles, bytes memory extraData)
        external
        view
        virtual
        returns (
            bytes memory abiEncodedCleartexts,
            bytes32 digest,
            address[] memory signers,
            uint256 threshold,
            bytes memory signedExtraData
        )
    {
        return _publicDecrypt(handles, extraData);
    }

    /// @notice Returns user-decryption payload and KMS metadata after verifying the user's signature.
    function userDecrypt(
        HandleContractPair[] calldata pairs,
        address userAddress,
        bytes memory publicKey,
        address[] memory contractAddresses,
        uint256 startTimestamp,
        uint256 durationDays,
        bytes memory userSignature
    )
        external
        view
        virtual
        returns (bytes memory payload, address[] memory signers, uint256 threshold, bytes memory extraData)
    {
        UserDecryptPayloadArgsV1 memory p = _userDecryptArgs(
            userAddress, publicKey, contractAddresses, startTimestamp, durationDays, userSignature
        );
        p.extraData = _userDecryptExtraData(p);
        return _userDecrypt(pairs, p);
    }

    /// @notice Same, verified against exactly the `extraData` the user signed their permit over.
    /// @dev    v14 only. A permit is reusable until it expires, and its extraData names the KMS context (and, in
    ///         v2, epoch) current WHEN IT WAS SIGNED, which may no longer be the current one; the sdk resolves
    ///         the signers of that context, not of the current one. So the host must not guess it: the caller
    ///         passes the permit's `message.extraData`, verbatim. Parsed by KMSVerifier's own
    ///         `_extractKmsContextId`; the context it names must be valid. Returns that context's signers and
    ///         threshold.
    function userDecrypt(
        HandleContractPair[] calldata pairs,
        address userAddress,
        bytes memory publicKey,
        address[] memory contractAddresses,
        uint256 startTimestamp,
        uint256 durationDays,
        bytes memory userSignature,
        bytes memory extraData
    )
        external
        view
        virtual
        returns (bytes memory payload, address[] memory signers, uint256 threshold, bytes memory signedExtraData)
    {
        UserDecryptPayloadArgsV1 memory p = _userDecryptArgs(
            userAddress, publicKey, contractAddresses, startTimestamp, durationDays, userSignature
        );
        p.extraData = extraData;
        return _userDecrypt(pairs, p);
    }

    /// @notice Returns delegated user-decryption payload and KMS metadata after verifying the delegate's signature.
    /// @dev The parameters are assembled into one struct rather than passed loose; see
    ///      `DelegatedUserDecryptPayloadArgsV1` for why the stack requires it.
    function delegatedUserDecrypt(
        HandleContractPair[] calldata pairs,
        address delegator,
        address delegate,
        bytes memory publicKey,
        address[] memory contractAddresses,
        uint256 startTimestamp,
        uint256 durationDays,
        bytes memory delegateSignature
    )
        external
        view
        virtual
        returns (bytes memory payload, address[] memory signers, uint256 threshold, bytes memory extraData)
    {
        DelegatedUserDecryptPayloadArgsV1 memory p = _delegatedUserDecryptArgs(
            delegator, delegate, publicKey, contractAddresses, startTimestamp, durationDays, delegateSignature
        );
        p.extraData = _delegatedUserDecryptExtraData(p);
        return _delegatedUserDecrypt(pairs, p);
    }

    /// @notice Same, verified against exactly the `extraData` the delegate signed their permit over.
    /// @dev    v14 only; see the `userDecrypt` overload that takes `extraData`.
    function delegatedUserDecrypt(
        HandleContractPair[] calldata pairs,
        address delegator,
        address delegate,
        bytes memory publicKey,
        address[] memory contractAddresses,
        uint256 startTimestamp,
        uint256 durationDays,
        bytes memory delegateSignature,
        bytes memory extraData
    )
        external
        view
        virtual
        returns (bytes memory payload, address[] memory signers, uint256 threshold, bytes memory signedExtraData)
    {
        DelegatedUserDecryptPayloadArgsV1 memory p = _delegatedUserDecryptArgs(
            delegator, delegate, publicKey, contractAddresses, startTimestamp, durationDays, delegateSignature
        );
        p.extraData = extraData;
        return _delegatedUserDecrypt(pairs, p);
    }

    /// @dev The request and signer of a user decryption, everything but `extraData`.
    function _userDecryptArgs(
        address userAddress,
        bytes memory publicKey,
        address[] memory contractAddresses,
        uint256 startTimestamp,
        uint256 durationDays,
        bytes memory userSignature
    ) private view returns (UserDecryptPayloadArgsV1 memory p) {
        if (contractAddresses.length > 10) {
            revert("Too many contracts");
        }

        // Missing startTimestamp / durationDays test
        p.aclAddress = aclAdd;
        p.plaintextsAddress = fhevmExecutorAdd;
        p.request = UserDecryptRequestV1(publicKey, contractAddresses, startTimestamp, durationDays);
        p.user = SignerSignaturePair(userAddress, userSignature);
        p.domainHash = _domainHashWithHostChainId();
    }

    /// @dev The same, for a delegated user decryption.
    function _delegatedUserDecryptArgs(
        address delegator,
        address delegate,
        bytes memory publicKey,
        address[] memory contractAddresses,
        uint256 startTimestamp,
        uint256 durationDays,
        bytes memory delegateSignature
    ) private view returns (DelegatedUserDecryptPayloadArgsV1 memory p) {
        if (contractAddresses.length > 10) {
            revert("Too many contracts");
        }

        // Missing startTimestamp / durationDays test
        p.aclAddress = aclAdd;
        p.plaintextsAddress = fhevmExecutorAdd;
        p.request = UserDecryptRequestV1(publicKey, contractAddresses, startTimestamp, durationDays);
        p.delegator = delegator;
        p.delegate = SignerSignaturePair(delegate, delegateSignature);
        p.domainHash = _domainHashWithHostChainId();
    }

    // ---------------------------------------------------------------------------------------------
    // v14 only: extraData for both SDK lines (SDK v(N) works with cleartext v(N)..v(N+2))
    // ---------------------------------------------------------------------------------------------

    /// @dev The public-decryption answer for `requestedExtraData`, with the signers and threshold of the
    ///      KMS context it names.
    function _publicDecrypt(bytes32[] memory handles, bytes memory requestedExtraData)
        private
        view
        returns (
            bytes memory abiEncodedCleartexts,
            bytes32 digest,
            address[] memory signers,
            uint256 threshold,
            bytes memory extraData
        )
    {
        uint256 kmsContextId = _validKmsContextId(requestedExtraData);

        PublicDecryptPayloadArgs memory p;
        p.aclAddress = aclAdd;
        p.plaintextsAddress = fhevmExecutorAdd;
        p.domainHash = _domainHashWithGatewayChainId();
        p.typeHash = DECRYPTION_RESULT_TYPEHASH;
        p.extraData = _signedExtraData(requestedExtraData);

        extraData = p.extraData;
        (abiEncodedCleartexts, digest) = LibKmsVerifier.publicDecryptPayload(handles, p);

        (signers, threshold) = _signersAndThreshold(kmsContextId);
    }

    /// @dev The user-decryption answer for a permit whose signed extraData is `p.extraData`.
    function _userDecrypt(HandleContractPair[] calldata pairs, UserDecryptPayloadArgsV1 memory p)
        private
        view
        returns (bytes memory payload, address[] memory signers, uint256 threshold, bytes memory signedExtraData)
    {
        uint256 kmsContextId = _validKmsContextId(p.extraData);
        signedExtraData = p.extraData;
        // Verifies the user's signature over `p.extraData` (`requireSigner`), then the pairs, then reads.
        payload = LibKmsVerifier.userDecryptPayloadV1(pairs, p);
        (signers, threshold) = _signersAndThreshold(kmsContextId);
    }

    /// @dev The same, for a delegate's permit.
    function _delegatedUserDecrypt(HandleContractPair[] calldata pairs, DelegatedUserDecryptPayloadArgsV1 memory p)
        private
        view
        returns (bytes memory payload, address[] memory signers, uint256 threshold, bytes memory signedExtraData)
    {
        uint256 kmsContextId = _validKmsContextId(p.extraData);
        signedExtraData = p.extraData;
        // Verifies the delegate's signature over `p.extraData` (`requireSigner`), then the pairs, then reads.
        payload = LibKmsVerifier.delegatedUserDecryptPayloadV1(pairs, p);
        (signers, threshold) = _signersAndThreshold(kmsContextId);
    }

    /// @dev The KMS context `extraData` names, parsed by KMSVerifier's own `_extractKmsContextId` (which
    ///      rejects a malformed or unsupported extraData); it must be a valid context.
    function _validKmsContextId(bytes memory extraData) private view returns (uint256 kmsContextId) {
        kmsContextId = _extractKmsContextId(extraData);
        if (!IProtocolConfig(protocolConfigAdd).isValidKmsContext(kmsContextId)) {
            revert CleartextErrorInvalidKmsContext(kmsContextId);
        }
    }

    /// @dev A KMS context's signers and public-decryption threshold, as
    ///      `KMSVerifier.getContextSignersAndThresholdFromExtraData` reports them for the same extraData.
    function _signersAndThreshold(uint256 kmsContextId)
        private
        view
        returns (address[] memory signers, uint256 threshold)
    {
        IProtocolConfig protocolConfig = IProtocolConfig(protocolConfigAdd);
        signers = protocolConfig.getKmsSignersForContext(kmsContextId);
        threshold = protocolConfig.getPublicDecryptionThresholdForContext(kmsContextId);
    }

    /// @dev For the overloads WITHOUT `extraData` (published sdk releases do not pass it): the extraData a user
    ///      signed their permit over, guessed as v2 (current context and epoch, what an sdk on protocol API 0.14
    ///      signs) if the signature matches it, otherwise v1 (current context, what an sdk capped at protocol API
    ///      0.13 signs). If neither matches, `LibKmsVerifier.userDecryptPayloadV1` refuses the signature as
    ///      before. LIMITATION: only a permit signed while the current context and epoch were already current
    ///      can match; one signed before a KMS context or epoch change is refused although it is valid. The
    ///      overload that takes `extraData` has no such limitation.
    function _userDecryptExtraData(UserDecryptPayloadArgsV1 memory p) private view returns (bytes memory) {
        bytes memory extraDataV2 = _currentExtraDataV2();
        bytes32 digestV2 = LibKmsVerifier.userDecryptionDigestV1(p.domainHash, p.request, extraDataV2);
        if (_isSignedBy(digestV2, p.user.signature, p.user.signer)) return extraDataV2;
        return LibKmsVerifier.extraDataForContext(getCurrentKmsContextId());
    }

    /// @dev The same, for a delegate's permit.
    function _delegatedUserDecryptExtraData(DelegatedUserDecryptPayloadArgsV1 memory p)
        private
        view
        returns (bytes memory)
    {
        bytes memory extraDataV2 = _currentExtraDataV2();
        bytes32 digestV2 =
            LibKmsVerifier.delegatedUserDecryptionDigestV1(p.domainHash, p.request, p.delegator, extraDataV2);
        if (_isSignedBy(digestV2, p.delegate.signature, p.delegate.signer)) return extraDataV2;
        return LibKmsVerifier.extraDataForContext(getCurrentKmsContextId());
    }

    /// @dev extraData v2 for the current KMS context and epoch: `0x02 | contextId | epochId`, 65 bytes.
    function _currentExtraDataV2() private view returns (bytes memory extraData) {
        (uint256 contextId, uint256 epochId) = IProtocolConfig(protocolConfigAdd).getCurrentKmsContextAndEpoch();
        extraData = new bytes(65);
        extraData[0] = bytes1(EXTRA_DATA_V2);
        assembly {
            mstore(add(extraData, 33), contextId)
            mstore(add(extraData, 65), epochId)
        }
    }

    /// @dev The bytes a v0 extraData is signed as: empty, never `0x00`, as the sdk signs it. v1 and v2 are
    ///      signed as they are.
    function _signedExtraData(bytes memory extraData) private pure returns (bytes memory) {
        if (extraData.length == 0 || uint8(extraData[0]) == 0x00) return new bytes(0);
        return extraData;
    }

    /// @dev Whether `signature` over `digest` recovers to `signer`. A malformed signature reverts, as in
    ///      `LibKmsVerifier.requireSigner`.
    function _isSignedBy(bytes32 digest, bytes memory signature, address signer) private pure returns (bool) {
        (uint8 v, bytes32 r, bytes32 s) = LibKmsVerifier.decodeSignature(signature);
        address recovered = ecrecover(digest, v, r, s);
        return recovered != address(0) && recovered == signer;
    }
}
