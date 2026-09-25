// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {StdFhevmBase} from "./StdFhevmBase.sol";
import {fhevm, FhevmStack} from "./FhevmVm.sol";
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
import {Vm} from "forge-std/Vm.sol";
import {FORGE_VM_ADDRESS} from "./_host/IForgeVm.sol";
import {LibForgeFhevmSigners} from "./_host/LibForgeFhevmSigners.sol";
import {
    HandleContractPair,
    LibKmsVerifier,
    SignerSignaturePair,
    UserDecryptRequestV1
} from "./_host/shared/LibKmsVerifier.sol";
import {LibEncryptedTypes} from "./LibEncryptedTypes.sol";
import {Plaintexts} from "./LibPlaintexts.sol";

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

struct TransportKeypair {
    bytes publicKey;
    bytes privateKey;
}

uint8 constant PERMIT_VERSION_V1 = 1;

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

        bytes32 digest = fhevm.userDecryptDigestV1(
            _request(transportKeypair, contractAddresses, startTimestamp, durationDays), address(0)
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

        bytes32 digest = fhevm.userDecryptDigestV1(
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

    // -- Decrypt single (euintN -> clear) - wallet label ----------------------

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

    // -- Decrypt single (euintN -> clear) - private key -----------------------

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

    // -- Decrypt single (euintN -> clear) - permit ----------------------------

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

    // -- Decrypt multiple (bytes32 a..e -> Plaintexts) - wallet label ---------

    function decrypt(bytes32 a, bytes32 b, address contractAddress, string memory walletLabel)
        internal
        unmetered
        returns (Plaintexts memory decrypted)
    {
        decrypted = decrypt(LibEncryptedTypes.handles(a, b), contractAddress, walletLabel);
    }

    function decrypt(bytes32 a, bytes32 b, bytes32 c, address contractAddress, string memory walletLabel)
        internal
        unmetered
        returns (Plaintexts memory decrypted)
    {
        decrypted = decrypt(LibEncryptedTypes.handles(a, b, c), contractAddress, walletLabel);
    }

    function decrypt(bytes32 a, bytes32 b, bytes32 c, bytes32 d, address contractAddress, string memory walletLabel)
        internal
        unmetered
        returns (Plaintexts memory decrypted)
    {
        decrypted = decrypt(LibEncryptedTypes.handles(a, b, c, d), contractAddress, walletLabel);
    }

    function decrypt(
        bytes32 a,
        bytes32 b,
        bytes32 c,
        bytes32 d,
        bytes32 e,
        address contractAddress,
        string memory walletLabel
    ) internal unmetered returns (Plaintexts memory decrypted) {
        decrypted = decrypt(LibEncryptedTypes.handles(a, b, c, d, e), contractAddress, walletLabel);
    }

    // -- Decrypt multiple (bytes32 a..e -> Plaintexts) - private key ----------

    function decrypt(bytes32 a, bytes32 b, address contractAddress, uint256 userPrivateKey)
        internal
        unmetered
        returns (Plaintexts memory decrypted)
    {
        decrypted = decrypt(LibEncryptedTypes.handles(a, b), contractAddress, userPrivateKey);
    }

    function decrypt(bytes32 a, bytes32 b, bytes32 c, address contractAddress, uint256 userPrivateKey)
        internal
        unmetered
        returns (Plaintexts memory decrypted)
    {
        decrypted = decrypt(LibEncryptedTypes.handles(a, b, c), contractAddress, userPrivateKey);
    }

    function decrypt(bytes32 a, bytes32 b, bytes32 c, bytes32 d, address contractAddress, uint256 userPrivateKey)
        internal
        unmetered
        returns (Plaintexts memory decrypted)
    {
        decrypted = decrypt(LibEncryptedTypes.handles(a, b, c, d), contractAddress, userPrivateKey);
    }

    function decrypt(
        bytes32 a,
        bytes32 b,
        bytes32 c,
        bytes32 d,
        bytes32 e,
        address contractAddress,
        uint256 userPrivateKey
    ) internal unmetered returns (Plaintexts memory decrypted) {
        decrypted = decrypt(LibEncryptedTypes.handles(a, b, c, d, e), contractAddress, userPrivateKey);
    }

    // -- Decrypt multiple (bytes32 a..e -> Plaintexts) - permit ---------------

    function decrypt(
        bytes32 a,
        bytes32 b,
        address contractAddress,
        TransportKeypair memory transportKeypair,
        SignedDecryptionPermit memory permit
    ) internal unmetered returns (Plaintexts memory decrypted) {
        decrypted = decrypt(LibEncryptedTypes.handles(a, b), contractAddress, transportKeypair, permit);
    }

    function decrypt(
        bytes32 a,
        bytes32 b,
        bytes32 c,
        address contractAddress,
        TransportKeypair memory transportKeypair,
        SignedDecryptionPermit memory permit
    ) internal unmetered returns (Plaintexts memory decrypted) {
        decrypted = decrypt(LibEncryptedTypes.handles(a, b, c), contractAddress, transportKeypair, permit);
    }

    function decrypt(
        bytes32 a,
        bytes32 b,
        bytes32 c,
        bytes32 d,
        address contractAddress,
        TransportKeypair memory transportKeypair,
        SignedDecryptionPermit memory permit
    ) internal unmetered returns (Plaintexts memory decrypted) {
        decrypted = decrypt(LibEncryptedTypes.handles(a, b, c, d), contractAddress, transportKeypair, permit);
    }

    function decrypt(
        bytes32 a,
        bytes32 b,
        bytes32 c,
        bytes32 d,
        bytes32 e,
        address contractAddress,
        TransportKeypair memory transportKeypair,
        SignedDecryptionPermit memory permit
    ) internal unmetered returns (Plaintexts memory decrypted) {
        decrypted = decrypt(LibEncryptedTypes.handles(a, b, c, d, e), contractAddress, transportKeypair, permit);
    }

    // -- Decrypt multiple (bytes32[] -> Plaintexts) - wallet label ------------

    function decrypt(bytes32[] memory handles, address contractAddress, string memory walletLabel)
        internal
        unmetered
        returns (Plaintexts memory decrypted)
    {
        decrypted = decrypt(handles, contractAddress, _walletPrivateKey(walletLabel));
    }

    // -- Decrypt multiple (bytes32[] -> Plaintexts) - private key -------------

    function decrypt(bytes32[] memory handles, address contractAddress, uint256 userPrivateKey)
        internal
        unmetered
        returns (Plaintexts memory decrypted)
    {
        (TransportKeypair memory keypair, SignedDecryptionPermit memory permit) =
            _oneShotPermit(contractAddress, userPrivateKey);
        decrypted = decrypt(handles, contractAddress, keypair, permit);
    }

    // -- Decrypt multiple (bytes32[] -> Plaintexts) - permit ------------------

    function decrypt(
        bytes32[] memory handles,
        address contractAddress,
        TransportKeypair memory transportKeypair,
        SignedDecryptionPermit memory permit
    ) internal unmetered returns (Plaintexts memory decrypted) {
        decrypted._h = handles;
        decrypted._p = _decryptValues(handles, contractAddress, transportKeypair, permit);
    }

    // -- Decrypt multiple (bytes abi -> Plaintexts) - wallet label ------------

    function decrypt(bytes memory abiEncryptedValues, address contractAddress, string memory walletLabel)
        internal
        unmetered
        returns (Plaintexts memory decrypted)
    {
        decrypted = decrypt(LibEncryptedTypes.handles(abiEncryptedValues), contractAddress, walletLabel);
    }

    // -- Decrypt multiple (bytes abi -> Plaintexts) - private key -------------

    function decrypt(bytes memory abiEncryptedValues, address contractAddress, uint256 userPrivateKey)
        internal
        unmetered
        returns (Plaintexts memory decrypted)
    {
        decrypted = decrypt(LibEncryptedTypes.handles(abiEncryptedValues), contractAddress, userPrivateKey);
    }

    // -- Decrypt multiple (bytes abi -> Plaintexts) - permit ------------------

    function decrypt(
        bytes memory abiEncryptedValues,
        address contractAddress,
        TransportKeypair memory transportKeypair,
        SignedDecryptionPermit memory permit
    ) internal unmetered returns (Plaintexts memory decrypted) {
        decrypted = decrypt(LibEncryptedTypes.handles(abiEncryptedValues), contractAddress, transportKeypair, permit);
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

    function _walletPrivateKey(string memory walletLabel) private returns (uint256) {
        return Vm(FORGE_VM_ADDRESS).createWallet(walletLabel).privateKey;
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

    function _onForkStack(
        FhevmStack memory stack,
        HandleContractPair[] memory pairs,
        UserDecryptRequestV1 memory request,
        address delegator,
        SignerSignaturePair memory signer
    ) private view returns (bytes memory payload) {
        if (delegator == address(0)) {
            (payload,,,) = LibKmsVerifier.userDecryptV1OnForkStack(
                stack.kmsVerifier, stack.acl, stack.plaintexts, pairs, request, signer
            );
        } else {
            (payload,,,) = LibKmsVerifier.delegatedUserDecryptV1OnForkStack(
                stack.kmsVerifier, stack.acl, stack.plaintexts, pairs, request, delegator, signer
            );
        }
    }

    function _decryptValues(
        HandleContractPair[] memory pairs,
        TransportKeypair memory transportKeypair,
        SignedDecryptionPermit memory permit
    ) private returns (uint256[] memory clears) {
        // THE KERNEL'S STEP, then this mixin's checks. Prepared, drained and resolved in one frame, with a
        // plaintext source guaranteed; what follows is policy about the caller's arguments, which stays here.
        FhevmStack memory stack = fhevm.resolveStack(pairs.length != 0 ? pairs[0].contractAddress : address(0));

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

        SignerSignaturePair memory signer =
            SignerSignaturePair({signer: permit.signerAddress, signature: permit.signature});

        // LOCAL cleartext only. A cleartext stack deployed on a testnet is the same contract, but every
        // call into it is a remote round trip and a user decryption is not a cheap one — on a fork the
        // answer is rebuilt locally instead, from the ACL and plaintext source this config names.
        bytes memory payload = stack.isCleartext && !fhevm.isForked()
            ? _onCleartextStack(stack.kmsVerifier, pairs, request, permit.delegatorAddress, signer)
            : _onForkStack(stack, pairs, request, permit.delegatorAddress, signer);

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
