// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {StdFhevmBase} from "./StdFhevmBase.sol";
import {fhevm} from "./FhevmVm.sol";
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
import {FORGE_VM_ADDRESS, IForgeVm} from "./_host/IForgeVm.sol";
import {LibForgeFhevmSigners} from "./_host/LibForgeFhevmSigners.sol";
import {
    HandleContractPair,
    LibKmsVerifier,
    SignerSignaturePair,
    UserDecryptRequestV1
} from "./_host/shared/LibKmsVerifier.sol";
import {Plaintexts} from "./LibPlaintexts.sol";
import {FhevmProtocol, LibFhevmProtocol} from "./LibFhevmProtocol.sol";

interface IForgeVmLabel {
    /// @dev Declared `view` where forge-std declares it mutating, so callers can stay `view`. The
    ///      cheatcode is reached by STATICCALL and still works — verified, labelling included — because
    ///      what it touches is forge's own bookkeeping, not EVM state.
    function createWallet(string calldata walletLabel) external view returns (IForgeVm.Wallet memory wallet);
}

struct SignedDecryptionPermit {
    uint8 version;
    bytes transportPublicKey;
    address[] contractAddresses;
    uint256 startTimestamp;
    uint256 durationSeconds;
    bytes signature;
    address signerAddress;
    address delegatorAddress;
}

uint8 constant PERMIT_VERSION_V1 = 1;

struct TransportKeypair {
    bytes publicKey;
    bytes privateKey;
}

/**
 * @title StdFhevmDecrypt
 * @notice User decryption: reading a handle as the user who was granted it.
 *
 * @dev NO KMS SIGNATURES ARE PRODUCED HERE, and that is deliberate.
 *
 *      A real user decryption ends with the KMS nodes signing each share and the CLIENT verifying
 *      those signatures off chain. On a cleartext stack this project is both halves: it would derive
 *      the node keys, sign with them, then immediately check the signatures it had just written. That
 *      loop can only ever succeed, so it proves nothing about the code under test while costing a
 *      signature per node on every read. What it does test — that a permit is signed by the user, that
 *      the ACL grants the handle, that every pair is covered — all happens before the signing, and all
 *      of it still happens here.
 *
 *      THE OTHER TWO PATHS ARE NOT LIKE THIS, because their proofs are checked by a contract rather
 *      than by us:
 *
 *        - public decryption returns a proof a dApp passes back on chain, where `KMSVerifier` checks it
 *          against the registered signers — so `LibForgeFhevmPublicDecrypt` really does sign;
 *        - an encrypted input carries a proof `InputVerifier` checks on chain — so
 *          `LibForgeFhevmEncrypt` really does sign.
 *
 *      In both of those the signature is consumed by a party that did not create it, which is what
 *      makes producing it worth the gas. A user-decryption share is consumed by its own author.
 *
 * @dev The transport mask is still applied and still undone: that is what the caller's keypair is for,
 *      and it is the part of the response format a client has to get right.
 */
abstract contract StdFhevmDecrypt is StdFhevmBase {
    uint256 internal constant MAX_USER_DECRYPT_DURATION_DAYS = 365;

    // -- Transport Keypair functions ------------------------------------------

    function generateTransportKeypair() internal unmetered returns (TransportKeypair memory keypair) {
        (bytes memory publicKey, bytes memory privateKey) = LibForgeFhevmSigners.generateTransportKeypair();
        // The cleartext mock mints a 32-byte secp256k1 scalar.
        require(privateKey.length == 32, "StdFhevm: transport private key must be 32 bytes");

        keypair.publicKey = publicKey;
        keypair.privateKey = privateKey;
    }

    // -- Decryption Permit functions ------------------------------------------

    function signLegacyDecryptionPermit(
        uint256 privateKey,
        TransportKeypair memory transportKeypair,
        address[] memory contractAddresses,
        uint256 startTimestamp,
        uint256 durationSeconds
    ) internal unmetered returns (SignedDecryptionPermit memory signedPermit) {
        uint256 durationDays = _requireWholeDays(durationSeconds);

        (bytes32 digest,) = LibKmsVerifier.userDecryptDigestV1OnStack(
            _kmsVerifier(), _request(transportKeypair, contractAddresses, startTimestamp, durationDays)
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

    function signLegacyDecryptionPermit(
        uint256 privateKey,
        TransportKeypair memory transportKeypair,
        address[] memory contractAddresses,
        uint256 startTimestamp,
        uint256 durationSeconds,
        address delegatorAddress
    ) internal unmetered returns (SignedDecryptionPermit memory signedPermit) {
        uint256 durationDays = _requireWholeDays(durationSeconds);

        (bytes32 digest,) = LibKmsVerifier.delegatedUserDecryptDigestV1OnStack(
            _kmsVerifier(),
            _request(transportKeypair, contractAddresses, startTimestamp, durationDays),
            delegatorAddress
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

    function signLegacyDecryptionPermit(
        string memory walletLabel,
        TransportKeypair memory transportKeypair,
        address[] memory contractAddresses,
        uint256 startTimestamp,
        uint256 durationSeconds
    ) internal unmetered returns (SignedDecryptionPermit memory signedPermit) {
        signedPermit = signLegacyDecryptionPermit(
            _walletPrivateKey(walletLabel), transportKeypair, contractAddresses, startTimestamp, durationSeconds
        );
    }

    function signLegacyDecryptionPermit(
        string memory walletLabel,
        TransportKeypair memory transportKeypair,
        address[] memory contractAddresses,
        uint256 startTimestamp,
        uint256 durationSeconds,
        address delegatorAddress
    ) internal unmetered returns (SignedDecryptionPermit memory signedPermit) {
        signedPermit = signLegacyDecryptionPermit(
            _walletPrivateKey(walletLabel),
            transportKeypair,
            contractAddresses,
            startTimestamp,
            durationSeconds,
            delegatorAddress
        );
    }

    // -- Decrypt single value functions ---------------------------------------

    function decrypt(ebool value, address contractAddress, string memory walletLabel)
        internal
        unmetered
        returns (bool clear)
    {
        clear = decrypt(value, contractAddress, _walletPrivateKey(walletLabel));
    }

    function decrypt(euint8 value, address contractAddress, string memory walletLabel)
        internal
        unmetered
        returns (uint8 clear)
    {
        clear = decrypt(value, contractAddress, _walletPrivateKey(walletLabel));
    }

    function decrypt(euint16 value, address contractAddress, string memory walletLabel)
        internal
        unmetered
        returns (uint16 clear)
    {
        clear = decrypt(value, contractAddress, _walletPrivateKey(walletLabel));
    }

    function decrypt(euint32 value, address contractAddress, string memory walletLabel)
        internal
        unmetered
        returns (uint32 clear)
    {
        clear = decrypt(value, contractAddress, _walletPrivateKey(walletLabel));
    }

    function decrypt(euint64 value, address contractAddress, string memory walletLabel)
        internal
        unmetered
        returns (uint64 clear)
    {
        clear = decrypt(value, contractAddress, _walletPrivateKey(walletLabel));
    }

    function decrypt(euint128 value, address contractAddress, string memory walletLabel)
        internal
        unmetered
        returns (uint128 clear)
    {
        clear = decrypt(value, contractAddress, _walletPrivateKey(walletLabel));
    }

    function decrypt(euint256 value, address contractAddress, string memory walletLabel)
        internal
        unmetered
        returns (uint256 clear)
    {
        clear = decrypt(value, contractAddress, _walletPrivateKey(walletLabel));
    }

    function decrypt(eaddress value, address contractAddress, string memory walletLabel)
        internal
        unmetered
        returns (address clear)
    {
        clear = decrypt(value, contractAddress, _walletPrivateKey(walletLabel));
    }

    function decrypt(ebool value, address contractAddress, uint256 userPrivateKey)
        internal
        unmetered
        returns (bool clear)
    {
        (TransportKeypair memory keypair, SignedDecryptionPermit memory permit) =
            _oneShotPermit(contractAddress, userPrivateKey);
        clear = _decryptValue(ebool.unwrap(value), contractAddress, keypair, permit) != 0;
    }

    function decrypt(euint8 value, address contractAddress, uint256 userPrivateKey)
        internal
        unmetered
        returns (uint8 clear)
    {
        (TransportKeypair memory keypair, SignedDecryptionPermit memory permit) =
            _oneShotPermit(contractAddress, userPrivateKey);
        clear = uint8(_decryptValue(euint8.unwrap(value), contractAddress, keypair, permit));
    }

    function decrypt(euint16 value, address contractAddress, uint256 userPrivateKey)
        internal
        unmetered
        returns (uint16 clear)
    {
        (TransportKeypair memory keypair, SignedDecryptionPermit memory permit) =
            _oneShotPermit(contractAddress, userPrivateKey);
        clear = uint16(_decryptValue(euint16.unwrap(value), contractAddress, keypair, permit));
    }

    function decrypt(euint32 value, address contractAddress, uint256 userPrivateKey)
        internal
        unmetered
        returns (uint32 clear)
    {
        (TransportKeypair memory keypair, SignedDecryptionPermit memory permit) =
            _oneShotPermit(contractAddress, userPrivateKey);
        clear = uint32(_decryptValue(euint32.unwrap(value), contractAddress, keypair, permit));
    }

    function decrypt(euint64 value, address contractAddress, uint256 userPrivateKey)
        internal
        unmetered
        returns (uint64 clear)
    {
        (TransportKeypair memory keypair, SignedDecryptionPermit memory permit) =
            _oneShotPermit(contractAddress, userPrivateKey);
        clear = uint64(_decryptValue(euint64.unwrap(value), contractAddress, keypair, permit));
    }

    function decrypt(euint128 value, address contractAddress, uint256 userPrivateKey)
        internal
        unmetered
        returns (uint128 clear)
    {
        (TransportKeypair memory keypair, SignedDecryptionPermit memory permit) =
            _oneShotPermit(contractAddress, userPrivateKey);
        clear = uint128(_decryptValue(euint128.unwrap(value), contractAddress, keypair, permit));
    }

    function decrypt(euint256 value, address contractAddress, uint256 userPrivateKey)
        internal
        unmetered
        returns (uint256 clear)
    {
        (TransportKeypair memory keypair, SignedDecryptionPermit memory permit) =
            _oneShotPermit(contractAddress, userPrivateKey);
        clear = _decryptValue(euint256.unwrap(value), contractAddress, keypair, permit);
    }

    function decrypt(eaddress value, address contractAddress, uint256 userPrivateKey)
        internal
        unmetered
        returns (address clear)
    {
        (TransportKeypair memory keypair, SignedDecryptionPermit memory permit) =
            _oneShotPermit(contractAddress, userPrivateKey);
        clear = address(uint160(_decryptValue(eaddress.unwrap(value), contractAddress, keypair, permit)));
    }

    function decrypt(
        ebool value,
        address contractAddress,
        TransportKeypair memory transportKeypair,
        SignedDecryptionPermit memory permit
    ) internal unmetered returns (bool clear) {
        clear = _decryptValue(ebool.unwrap(value), contractAddress, transportKeypair, permit) != 0;
    }

    function decrypt(
        euint8 value,
        address contractAddress,
        TransportKeypair memory transportKeypair,
        SignedDecryptionPermit memory permit
    ) internal unmetered returns (uint8 clear) {
        clear = uint8(_decryptValue(euint8.unwrap(value), contractAddress, transportKeypair, permit));
    }

    function decrypt(
        euint16 value,
        address contractAddress,
        TransportKeypair memory transportKeypair,
        SignedDecryptionPermit memory permit
    ) internal unmetered returns (uint16 clear) {
        clear = uint16(_decryptValue(euint16.unwrap(value), contractAddress, transportKeypair, permit));
    }

    function decrypt(
        euint32 value,
        address contractAddress,
        TransportKeypair memory transportKeypair,
        SignedDecryptionPermit memory permit
    ) internal unmetered returns (uint32 clear) {
        clear = uint32(_decryptValue(euint32.unwrap(value), contractAddress, transportKeypair, permit));
    }

    function decrypt(
        euint64 value,
        address contractAddress,
        TransportKeypair memory transportKeypair,
        SignedDecryptionPermit memory permit
    ) internal unmetered returns (uint64 clear) {
        clear = uint64(_decryptValue(euint64.unwrap(value), contractAddress, transportKeypair, permit));
    }

    function decrypt(
        euint128 value,
        address contractAddress,
        TransportKeypair memory transportKeypair,
        SignedDecryptionPermit memory permit
    ) internal unmetered returns (uint128 clear) {
        clear = uint128(_decryptValue(euint128.unwrap(value), contractAddress, transportKeypair, permit));
    }

    function decrypt(
        euint256 value,
        address contractAddress,
        TransportKeypair memory transportKeypair,
        SignedDecryptionPermit memory permit
    ) internal unmetered returns (uint256 clear) {
        clear = _decryptValue(euint256.unwrap(value), contractAddress, transportKeypair, permit);
    }

    function decrypt(
        eaddress value,
        address contractAddress,
        TransportKeypair memory transportKeypair,
        SignedDecryptionPermit memory permit
    ) internal unmetered returns (address clear) {
        clear = address(uint160(_decryptValue(eaddress.unwrap(value), contractAddress, transportKeypair, permit)));
    }

    // -- Decrypt multiple values functions ------------------------------------

    function decrypt(
        bytes memory abiEncryptedValues,
        address contractAddress,
        TransportKeypair memory transportKeypair,
        SignedDecryptionPermit memory permit
    ) internal unmetered returns (Plaintexts memory decrypted) {
        decrypted._h = _toBatchHandles(abiEncryptedValues);
        decrypted._p = _decryptValues(decrypted._h, contractAddress, transportKeypair, permit);
    }

    function decrypt(bytes memory abiEncryptedValues, address contractAddress, uint256 userPrivateKey)
        internal
        unmetered
        returns (Plaintexts memory decrypted)
    {
        (TransportKeypair memory keypair, SignedDecryptionPermit memory permit) =
            _oneShotPermit(contractAddress, userPrivateKey);
        decrypted = decrypt(abiEncryptedValues, contractAddress, keypair, permit);
    }

    function decrypt(bytes memory abiEncryptedValues, address contractAddress, string memory walletLabel)
        internal
        unmetered
        returns (Plaintexts memory decrypted)
    {
        decrypted = decrypt(abiEncryptedValues, contractAddress, _walletPrivateKey(walletLabel));
    }

    // -- PRIVATE HELPER FUNCTIONS ---------------------------------------------

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

    function _requireWholeDays(uint256 durationSeconds) private pure returns (uint256 durationDays) {
        require(durationSeconds % 1 days == 0, "StdFhevm: durationSeconds must be a whole number of days");
        durationDays = durationSeconds / 1 days;
        require(durationDays != 0, "StdFhevm: durationSeconds must be at least one day");
        require(
            durationDays <= MAX_USER_DECRYPT_DURATION_DAYS, "StdFhevm: durationSeconds is above the maximum duration"
        );
    }

    function _toBatchHandles(bytes memory abiEncryptedValues) private pure returns (bytes32[] memory handles) {
        require(abiEncryptedValues.length != 0, "StdFhevm: no encrypted value to decrypt");
        require(
            abiEncryptedValues.length % 32 == 0, "StdFhevm: abiEncryptedValues is not a whole number of 32-byte handles"
        );

        uint256 count = abiEncryptedValues.length / 32;
        handles = new bytes32[](count);
        for (uint256 i = 0; i < count; i++) {
            bytes32 handle;
            // solhint-disable-next-line no-inline-assembly
            assembly {
                handle := mload(add(add(abiEncryptedValues, 0x20), mul(i, 0x20)))
            }
            handles[i] = handle;
        }
    }

    function _walletPrivateKey(string memory walletLabel) private view returns (uint256) {
        return IForgeVmLabel(FORGE_VM_ADDRESS).createWallet(walletLabel).privateKey;
    }

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
     * @notice The decryption, asked of a verifier that holds its own ACL and values.
     *
     * @dev A cleartext verifier reaches its ACL and plaintext store through compile-time constants and
     *      exposes no getter for either, so it takes neither from us. Passing them would be passing
     *      arguments that are silently discarded — which is why this is a separate call rather than a
     *      branch inside one.
     */
    function _onCleartextStack(
        address kmsVerifier,
        HandleContractPair[] memory pairs,
        UserDecryptRequestV1 memory request,
        address delegator,
        SignerSignaturePair memory signer
    ) private view returns (bytes memory payload) {
        if (delegator == address(0)) {
            (payload,,,) = LibKmsVerifier.userDecryptV1OnCleartextStack(kmsVerifier, pairs, request, signer);
        } else {
            (payload,,,) =
                LibKmsVerifier.delegatedUserDecryptV1OnCleartextStack(kmsVerifier, pairs, request, delegator, signer);
        }
    }

    /// @notice The same, against a stack that must be told where its ACL and values live.
    function _onForkStack(
        FhevmProtocol memory protocol,
        HandleContractPair[] memory pairs,
        UserDecryptRequestV1 memory request,
        address delegator,
        SignerSignaturePair memory signer
    ) private view returns (bytes memory payload) {
        if (delegator == address(0)) {
            (payload,,,) = LibKmsVerifier.userDecryptV1OnForkStack(
                protocol.kmsVerifier, protocol.acl, protocol.plaintexts, pairs, request, signer
            );
        } else {
            (payload,,,) = LibKmsVerifier.delegatedUserDecryptV1OnForkStack(
                protocol.kmsVerifier, protocol.acl, protocol.plaintexts, pairs, request, delegator, signer
            );
        }
    }

    function _decryptValues(
        HandleContractPair[] memory pairs,
        TransportKeypair memory transportKeypair,
        SignedDecryptionPermit memory permit
    ) private returns (uint256[] memory clears) {
        fhevm.ensureForkPrepared(pairs.length != 0 ? pairs[0].contractAddress : address(0));
        fhevm.drainFheEvents();

        require(permit.version == PERMIT_VERSION_V1, "StdFhevm: unsupported decryption permit version");
        require(
            keccak256(transportKeypair.publicKey) == keccak256(permit.transportPublicKey),
            "StdFhevm: transport keypair does not match the permit"
        );

        // The request, unpacked once. Everything past this point is the library's decision: which
        // verifier, whether it is a cleartext one, and what to do when it is not.
        UserDecryptRequestV1 memory request = UserDecryptRequestV1({
            transportPublicKey: permit.transportPublicKey,
            contractAddresses: permit.contractAddresses,
            startTimestamp: permit.startTimestamp,
            durationDays: permit.durationSeconds / 1 days
        });

        FhevmProtocol memory protocol = LibFhevmProtocol.currentConfigWithPlaintexts();
        SignerSignaturePair memory signer =
            SignerSignaturePair({signer: permit.signerAddress, signature: permit.signature});

        // LOCAL cleartext only. A cleartext stack deployed on a testnet is the same contract, but every
        // call into it is a remote round trip and a user decryption is not a cheap one — on a fork the
        // answer is rebuilt locally instead, from the ACL and plaintext source this config names.
        bytes memory payload = protocol.isCleartext && !fhevm.isForked()
            ? _onCleartextStack(protocol.kmsVerifier, pairs, request, permit.delegatorAddress, signer)
            : _onForkStack(protocol, pairs, request, permit.delegatorAddress, signer);

        clears = _unmask(payload, transportKeypair);
    }

    function _decryptValues(
        bytes32[] memory handles,
        address contractAddress,
        TransportKeypair memory transportKeypair,
        SignedDecryptionPermit memory permit
    ) private returns (uint256[] memory clears) {
        HandleContractPair[] memory pairs = new HandleContractPair[](handles.length);
        for (uint256 i = 0; i < handles.length; i++) {
            pairs[i] = HandleContractPair({handle: handles[i], contractAddress: contractAddress});
        }

        clears = _decryptValues(pairs, transportKeypair, permit);
    }

    function _decryptValue(
        bytes32 handle,
        address contractAddress,
        TransportKeypair memory transportKeypair,
        SignedDecryptionPermit memory permit
    ) private returns (uint256 clear) {
        bytes32[] memory handles = new bytes32[](1);
        handles[0] = handle;

        clear = _decryptValues(handles, contractAddress, transportKeypair, permit)[0];
    }

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

    /**
     * @notice The KMS verifier of the stack this test is pointed at.
     *
     * @dev RESOLVED, NOT NAMED. A permit must be signed under the domain and KMS context of the
     *      verifier that will check it, so this and the decryption below both read the same config —
     *      they cannot end up aimed at different stacks.
     */
    function _kmsVerifier() private view returns (address) {
        return LibFhevmProtocol.currentConfig().kmsVerifier;
    }
}
