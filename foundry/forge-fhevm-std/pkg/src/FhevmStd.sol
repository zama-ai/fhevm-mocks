// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {euint32, euint64, externalEuint64, externalEuint32} from "encrypted-types/EncryptedTypes.sol";

import {FhevmCleartextDeploy} from "./_host/FhevmCleartextDeploy.sol";
import {FhevmCleartextDecryptPublic} from "./_host/FhevmCleartextDecryptPublic.sol";
import {FhevmCleartextEncrypt} from "./_host/FhevmCleartextEncrypt.sol";
import {FheType} from "./_host/shared/FheType.sol";

abstract contract FhevmStd is FhevmCleartextDeploy {
    function setUpFhevm() internal virtual {
        deployLocalFhevm();
    }

    // -- Encrypt Single Value -------------------------------------------------

    function encryptEuint32(uint32 value, address contractAddress, address userAddress)
        internal
        returns (externalEuint32 externalEnc, bytes memory inputProof)
    {
        bytes32 handle;
        (handle, inputProof) = _encryptValue(uint256(value), FheType.Uint32, contractAddress, userAddress);
        externalEnc = externalEuint32.wrap(handle);
    }

    function encryptEuint64(uint64 value, address contractAddress, address userAddress)
        internal
        returns (externalEuint64 externalEnc, bytes memory inputProof)
    {
        bytes32 handle;
        (handle, inputProof) = _encryptValue(uint256(value), FheType.Uint64, contractAddress, userAddress);
        externalEnc = externalEuint64.wrap(handle);
    }

    // -- Decrypt Public Values ------------------------------------------------

    /*
        (address clearAddr, uint128 clearUint128, uint256 clearUint256) =
        abi.decode(decrypt(abi.encode(eAddr, eUint128, eUint256), FHETEST), (address, uint128, uint256));
    */
    function decryptPublicWithProof(euint64 value) internal view returns (uint64 clear, bytes memory decryptionProof) {
        bytes32[] memory handles = new bytes32[](1);
        handles[0] = _toBytes32(value);

        bytes memory abiEncodedClearValues;
        (abiEncodedClearValues, decryptionProof) = FhevmCleartextDecryptPublic.decryptPublicWithProof(handles);
        clear = abi.decode(abiEncodedClearValues, (uint64));
    }

    // -- Decrypt Single Public Value ------------------------------------------

    function decryptPublic(euint32 value) internal view returns (uint32 clear) {
        clear = abi.decode(_decryptPublicHandle(_toBytes32(value)), (uint32));
    }

    function decryptPublic(euint64 value) internal view returns (uint64 clear) {
        clear = abi.decode(_decryptPublicHandle(_toBytes32(value)), (uint64));
    }

    // -- PRIVATE HELPER FUNCTIONS ---------------------------------------------

    function _toBytes32(euint32 value) private pure returns (bytes32 handle) {
        return euint32.unwrap(value);
    }

    function _toBytes32(euint64 value) private pure returns (bytes32 handle) {
        return euint64.unwrap(value);
    }

    function _encryptValue(uint256 value, FheType typeId, address contractAddress, address userAddress)
        internal
        returns (bytes32 externalHandle, bytes memory inputProof)
    {
        uint8[] memory typeIds = new uint8[](1);
        uint256[] memory values = new uint256[](1);
        typeIds[0] = uint8(typeId);
        values[0] = uint256(value);

        bytes32[] memory handles;
        (handles, inputProof) = FhevmCleartextEncrypt.encrypt(typeIds, values, contractAddress, userAddress);
        externalHandle = handles[0];
    }

    function _decryptPublicHandle(bytes32 handle) private view returns (bytes memory abiEncodedClearValues) {
        bytes32[] memory handles = new bytes32[](1);
        handles[0] = handle;
        (abiEncodedClearValues,) = FhevmCleartextDecryptPublic.decryptPublicWithProof(handles);
    }
}
