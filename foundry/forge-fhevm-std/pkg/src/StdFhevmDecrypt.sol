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

import {KMS_VERIFIER_ADDRESS} from "./_host/FhevmCleartextDeploy.sol";
import {ForgeVmBase} from "./_host/ForgeVmBase.sol";
import {FORGE_VM_ADDRESS, IForgeVm} from "./_host/IForgeVm.sol";
import {FhevmCleartextDecrypt, UserDecryptRequestV1} from "./_host/FhevmCleartextDecrypt.sol";
import {ICleartextKMSVerifier} from "./_host/_internal/interfaces/ICleartextKMSVerifier.sol";
import {Plaintexts} from "./LibPlaintexts.sol";

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

abstract contract StdFhevmDecrypt is ForgeVmBase {
    uint256 internal constant MAX_USER_DECRYPT_DURATION_DAYS = 365;

    function generateTransportKeypair() internal returns (TransportKeypair memory keypair) {
        (bytes memory publicKey, bytes memory privateKey) = FhevmCleartextDecrypt.generateTransportKeypair();
        // The cleartext mock mints a 32-byte secp256k1 scalar.
        require(privateKey.length == 32, "StdFhevm: transport private key must be 32 bytes");

        keypair.publicKey = publicKey;
        keypair.privateKey = privateKey;
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

    function decrypt(
        bytes memory abiEncryptedValues,
        address contractAddress,
        TransportKeypair memory transportKeypair,
        SignedDecryptionPermit memory permit
    ) internal view returns (Plaintexts memory decrypted) {
        decrypted._h = _toBatchHandles(abiEncryptedValues);
        decrypted._p = _decryptValues(decrypted._h, contractAddress, transportKeypair, permit);
    }

    function decrypt(bytes memory abiEncryptedValues, address contractAddress, uint256 userPrivateKey)
        internal
        returns (Plaintexts memory decrypted)
    {
        (TransportKeypair memory keypair, SignedDecryptionPermit memory permit) =
            _oneShotPermit(contractAddress, userPrivateKey);
        decrypted = decrypt(abiEncryptedValues, contractAddress, keypair, permit);
    }

    function decrypt(bytes memory abiEncryptedValues, address contractAddress, string memory walletLabel)
        internal
        returns (Plaintexts memory decrypted)
    {
        decrypted = decrypt(abiEncryptedValues, contractAddress, _walletPrivateKey(walletLabel));
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

    function _decryptValues(
        ICleartextKMSVerifier.HandleContractPair[] memory pairs,
        TransportKeypair memory transportKeypair,
        SignedDecryptionPermit memory permit
    ) private view returns (uint256[] memory clears) {
        require(permit.version == PERMIT_VERSION_V1, "StdFhevm: unsupported decryption permit version");
        require(
            keccak256(transportKeypair.publicKey) == keccak256(permit.transportPublicKey),
            "StdFhevm: transport keypair does not match the permit"
        );

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

        clears = _unmask(payload, transportKeypair);
    }

    function _decryptValues(
        bytes32[] memory handles,
        address contractAddress,
        TransportKeypair memory transportKeypair,
        SignedDecryptionPermit memory permit
    ) private view returns (uint256[] memory clears) {
        ICleartextKMSVerifier.HandleContractPair[] memory pairs =
            new ICleartextKMSVerifier.HandleContractPair[](handles.length);
        for (uint256 i = 0; i < handles.length; i++) {
            pairs[i] = ICleartextKMSVerifier.HandleContractPair({handle: handles[i], contractAddress: contractAddress});
        }

        clears = _decryptValues(pairs, transportKeypair, permit);
    }

    function _decryptValue(
        bytes32 handle,
        address contractAddress,
        TransportKeypair memory transportKeypair,
        SignedDecryptionPermit memory permit
    ) private view returns (uint256 clear) {
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
}
