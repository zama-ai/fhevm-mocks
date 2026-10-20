// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {
    externalEbool,
    externalEuint8,
    externalEuint16,
    externalEuint32,
    externalEuint64,
    externalEuint128,
    externalEuint256,
    externalEaddress
} from "encrypted-types/EncryptedTypes.sol";

import {FheType} from "./_host/shared/FheType.sol";
import {LibFheType} from "./_host/shared/LibFheType.sol";
import {LibFhevmHandle} from "./_host/shared/LibFhevmHandle.sol";

using LibEncryptedInput for EncryptedInput global;

struct EncryptedInput {
    /// @dev The external handles, in the order the values were given.
    bytes32[] _h;
    /// @dev The input proof the whole batch shares.
    bytes _ip;
    /// @dev The chain the handles were minted for
    uint256 _cid;
    /// @dev The handle version
    uint8 _ver;
}

library LibEncryptedInput {
    error IndexOutOfBounds(uint256 index, uint256 length);
    error TypeMismatch(uint256 index, uint8 expected, uint8 actual);
    error IndexMismatch(uint256 index, uint8 handleIndex);
    error ChainIdMismatch(uint256 index, uint256 expected, uint64 actual);
    error VersionMismatch(uint256 index, uint8 expected, uint8 actual);

    // -- TYPED ACCESSORS ---------------------------------------------------------

    function externalEboolAt(EncryptedInput memory self, uint256 index) internal pure returns (externalEbool) {
        return externalEbool.wrap(_checked(self, index, FheType.Bool));
    }

    function externalEuint8At(EncryptedInput memory self, uint256 index) internal pure returns (externalEuint8) {
        return externalEuint8.wrap(_checked(self, index, FheType.Uint8));
    }

    function externalEuint16At(EncryptedInput memory self, uint256 index) internal pure returns (externalEuint16) {
        return externalEuint16.wrap(_checked(self, index, FheType.Uint16));
    }

    function externalEuint32At(EncryptedInput memory self, uint256 index) internal pure returns (externalEuint32) {
        return externalEuint32.wrap(_checked(self, index, FheType.Uint32));
    }

    function externalEuint64At(EncryptedInput memory self, uint256 index) internal pure returns (externalEuint64) {
        return externalEuint64.wrap(_checked(self, index, FheType.Uint64));
    }

    function externalEuint128At(EncryptedInput memory self, uint256 index) internal pure returns (externalEuint128) {
        return externalEuint128.wrap(_checked(self, index, FheType.Uint128));
    }

    function externalEuint256At(EncryptedInput memory self, uint256 index) internal pure returns (externalEuint256) {
        return externalEuint256.wrap(_checked(self, index, FheType.Uint256));
    }

    function externalEaddressAt(EncryptedInput memory self, uint256 index) internal pure returns (externalEaddress) {
        return externalEaddress.wrap(_checked(self, index, FheType.Uint160));
    }

    // -- RAW VIEWS ----------------------------------------------------------------

    /// @notice The input proof the whole batch shares — the second argument of every dApp call that
    ///         takes an `externalE*`.
    function inputProof(EncryptedInput memory self) internal pure returns (bytes memory) {
        return self._ip;
    }

    function chainId(EncryptedInput memory self) internal pure returns (uint256) {
        return self._cid;
    }

    /// @notice The handle format version
    function version(EncryptedInput memory self) internal pure returns (uint8) {
        return self._ver;
    }

    /// @notice How many values were encrypted.
    function length(EncryptedInput memory self) internal pure returns (uint256) {
        return self._h.length;
    }

    function typeNameAt(EncryptedInput memory self, uint256 index) internal pure returns (string memory) {
        if (index >= self._h.length) revert IndexOutOfBounds(index, self._h.length);
        return LibFheType.toString(LibFhevmHandle.typeOf(self._h[index]));
    }

    function abiEncoded(EncryptedInput memory self) internal pure returns (bytes memory) {
        return abi.encodePacked(self._h);
    }

    // -- PRIVATE ------------------------------------------------------------------

    function _checked(EncryptedInput memory self, uint256 index, FheType expected) private pure returns (bytes32 h) {
        if (index >= self._h.length) revert IndexOutOfBounds(index, self._h.length);
        h = self._h[index];
        FheType actual = LibFhevmHandle.typeOf(h);
        if (actual != expected) {
            revert TypeMismatch(index, uint8(expected), uint8(actual));
        }
        uint8 handleIndex = LibFhevmHandle.indexOf(h);
        if (handleIndex != index) revert IndexMismatch(index, handleIndex);

        uint64 handleChainId = LibFhevmHandle.chainIdOf(h);
        if (handleChainId != uint64(self._cid)) revert ChainIdMismatch(index, self._cid, handleChainId);

        uint8 handleVersion = LibFhevmHandle.versionOf(h);
        if (handleVersion != self._ver) revert VersionMismatch(index, self._ver, handleVersion);
    }
}
