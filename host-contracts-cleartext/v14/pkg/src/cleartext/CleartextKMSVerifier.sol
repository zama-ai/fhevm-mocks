// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {KMSVerifier} from "../contracts/KMSVerifier.sol";
import {aclAdd, fhevmExecutorAdd} from "../addresses/FHEVMHostAddresses.sol";
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

    /// @notice Returns cleartexts and KMS metadata for public decryption.
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
        PublicDecryptPayloadArgs memory p;
        p.aclAddress = aclAdd;
        p.plaintextsAddress = fhevmExecutorAdd;
        p.domainHash = _domainHashWithGatewayChainId();
        p.typeHash = DECRYPTION_RESULT_TYPEHASH;
        p.extraData = LibKmsVerifier.extraDataForContext(getCurrentKmsContextId());

        extraData = p.extraData;
        (abiEncodedCleartexts, digest) = LibKmsVerifier.publicDecryptPayload(handles, p);

        signers = getKmsSigners();
        threshold = getThreshold();
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
        if (contractAddresses.length > 10) {
            revert("Too many contracts");
        }

        // Missing startTimestamp / durationDays test
        UserDecryptPayloadArgsV1 memory p;
        p.aclAddress = aclAdd;
        p.plaintextsAddress = fhevmExecutorAdd;
        p.request = UserDecryptRequestV1(publicKey, contractAddresses, startTimestamp, durationDays);
        p.user = SignerSignaturePair(userAddress, userSignature);
        p.domainHash = _domainHashWithHostChainId();
        p.extraData = LibKmsVerifier.extraDataForContext(getCurrentKmsContextId());

        extraData = p.extraData;
        payload = LibKmsVerifier.userDecryptPayloadV1(pairs, p);

        signers = getKmsSigners();
        threshold = getThreshold();
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
        if (contractAddresses.length > 10) {
            revert("Too many contracts");
        }

        // Missing startTimestamp / durationDays test
        DelegatedUserDecryptPayloadArgsV1 memory p;
        p.aclAddress = aclAdd;
        p.plaintextsAddress = fhevmExecutorAdd;
        p.request = UserDecryptRequestV1(publicKey, contractAddresses, startTimestamp, durationDays);
        p.delegator = delegator;
        p.delegate = SignerSignaturePair(delegate, delegateSignature);
        p.domainHash = _domainHashWithHostChainId();
        p.extraData = LibKmsVerifier.extraDataForContext(getCurrentKmsContextId());

        extraData = p.extraData;
        payload = LibKmsVerifier.delegatedUserDecryptPayloadV1(pairs, p);

        signers = getKmsSigners();
        threshold = getThreshold();
    }
}
