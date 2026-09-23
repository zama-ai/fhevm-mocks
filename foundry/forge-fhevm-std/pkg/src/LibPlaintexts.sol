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
import {FheType} from "./_host/shared/FheType.sol";
import {LibFheType} from "./_host/shared/LibFheType.sol";
import {LibFhevmHandle} from "./_host/shared/LibFhevmHandle.sol";

using LibPlaintexts for Plaintexts global;

struct Plaintexts {
    /// @dev The handles that were decrypted, in the order they were given.
    bytes32[] _h;
    /// @dev One plaintext per handle, at the same index, widened to `uint256`.
    uint256[] _p;
}

library LibPlaintexts {
    error IndexOutOfBounds(uint256 index, uint256 length);
    error TypeMismatch(uint256 index, uint8 expected, uint8 actual);
    error LengthMismatch(uint256 handles, uint256 plaintexts);
    error HandleNotFound(bytes32 handle);

    // -- TYPED ACCESSORS ---------------------------------------------------------

    function boolAt(Plaintexts memory self, uint256 index) internal pure returns (bool) {
        return _checked(self, index, FheType.Bool) != 0;
    }

    function uint8At(Plaintexts memory self, uint256 index) internal pure returns (uint8) {
        return uint8(_checked(self, index, FheType.Uint8));
    }

    function uint16At(Plaintexts memory self, uint256 index) internal pure returns (uint16) {
        return uint16(_checked(self, index, FheType.Uint16));
    }

    function uint32At(Plaintexts memory self, uint256 index) internal pure returns (uint32) {
        return uint32(_checked(self, index, FheType.Uint32));
    }

    function uint64At(Plaintexts memory self, uint256 index) internal pure returns (uint64) {
        return uint64(_checked(self, index, FheType.Uint64));
    }

    function uint128At(Plaintexts memory self, uint256 index) internal pure returns (uint128) {
        return uint128(_checked(self, index, FheType.Uint128));
    }

    function uint256At(Plaintexts memory self, uint256 index) internal pure returns (uint256) {
        return _checked(self, index, FheType.Uint256);
    }

    function addressAt(Plaintexts memory self, uint256 index) internal pure returns (address) {
        return address(uint160(_checked(self, index, FheType.Uint160)));
    }

    // -- TYPED ACCESSORS, BY ENCRYPTED VALUE -------------------------------------

    function plaintext(Plaintexts memory self, ebool value) internal pure returns (bool) {
        return _checkedByHandle(self, ebool.unwrap(value), FheType.Bool) != 0;
    }

    function plaintext(Plaintexts memory self, euint8 value) internal pure returns (uint8) {
        return uint8(_checkedByHandle(self, euint8.unwrap(value), FheType.Uint8));
    }

    function plaintext(Plaintexts memory self, euint16 value) internal pure returns (uint16) {
        return uint16(_checkedByHandle(self, euint16.unwrap(value), FheType.Uint16));
    }

    function plaintext(Plaintexts memory self, euint32 value) internal pure returns (uint32) {
        return uint32(_checkedByHandle(self, euint32.unwrap(value), FheType.Uint32));
    }

    function plaintext(Plaintexts memory self, euint64 value) internal pure returns (uint64) {
        return uint64(_checkedByHandle(self, euint64.unwrap(value), FheType.Uint64));
    }

    function plaintext(Plaintexts memory self, euint128 value) internal pure returns (uint128) {
        return uint128(_checkedByHandle(self, euint128.unwrap(value), FheType.Uint128));
    }

    function plaintext(Plaintexts memory self, euint256 value) internal pure returns (uint256) {
        return _checkedByHandle(self, euint256.unwrap(value), FheType.Uint256);
    }

    function plaintext(Plaintexts memory self, eaddress value) internal pure returns (address) {
        return address(uint160(_checkedByHandle(self, eaddress.unwrap(value), FheType.Uint160)));
    }

    // -- RAW VIEWS ----------------------------------------------------------------

    function length(Plaintexts memory self) internal pure returns (uint256) {
        return self._p.length;
    }

    function typeNameAt(Plaintexts memory self, uint256 index) internal pure returns (string memory) {
        if (index >= self._h.length) revert IndexOutOfBounds(index, self._h.length);
        return LibFheType.toString(LibFhevmHandle.typeOf(self._h[index]));
    }

    /// @notice The handles, in the order they were decrypted — the first argument of `FHE.checkSignatures`.
    function handles(Plaintexts memory self) internal pure returns (bytes32[] memory) {
        return self._h;
    }

    /// @notice One 32-byte word per value, each clamped to its FHE type — the `abi.encode` of the clear
    ///         values, and the bytes a KMS public-decryption signature covers: the second argument of
    ///         `FHE.checkSignatures`.
    function abiEncoded(Plaintexts memory self) internal pure returns (bytes memory) {
        return abi.encodePacked(self._p);
    }

    // -- PRIVATE ------------------------------------------------------------------

    function _checkedByHandle(Plaintexts memory self, bytes32 handle, FheType expected) private pure returns (uint256) {
        for (uint256 i = 0; i < self._h.length; i++) {
            if (self._h[i] == handle) return _checked(self, i, expected);
        }
        revert HandleNotFound(handle);
    }

    function _checked(Plaintexts memory self, uint256 index, FheType expected) private pure returns (uint256 value) {
        if (self._h.length != self._p.length) {
            revert LengthMismatch(self._h.length, self._p.length);
        }
        if (index >= self._p.length) revert IndexOutOfBounds(index, self._p.length);

        FheType actual = LibFhevmHandle.typeOf(self._h[index]);
        if (actual != expected) {
            revert TypeMismatch(index, uint8(expected), uint8(actual));
        }
        value = self._p[index];
    }
}
