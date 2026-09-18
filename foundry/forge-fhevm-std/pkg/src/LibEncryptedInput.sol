// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

/// ----------------------------------------------------------------------------
///   NAMING
///
///   `EncryptedInput` is named after "encrypted-types/EncryptedTypes.sol", the
///   standard package that defines the `externalEbool` / `externalEuintN` /
///   `externalEaddress` types. Those are exactly what this struct holds — one
///   per encrypted value — so it carries their name rather than inventing one.
///
///   Read it as "the encrypted input of a dApp call": the `externalE*` handles
///   a dApp takes, plus the single `inputProof` that binds them.
/// ----------------------------------------------------------------------------

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

import {FheType} from "./_internal/FheType.sol";
import {LibFheType} from "./_internal/LibFheType.sol";
import {LibFhevmHandle} from "./_internal/LibFhevmHandle.sol";

// Enable globally: `e.externalEuint8At(0)` on any `EncryptedInput`.
using LibEncryptedInput for EncryptedInput global;

/// @notice The result of `encryptValues(...)`: one input handle per cleartext, in call order, all
///         bound by a single `inputProof`.
///
/// @dev Two ways to read it back:
///
///      1. Typed accessors, checked against the FHE type id the handle itself carries:
///
///          EncryptedInput memory e = encryptValues(asUint8(3), asUint32(70_000), address(dapp), alice);
///          dapp.deposit(e.externalEuint8At(0), e.externalEuint32At(1), e.inputProof);
///
///      2. The ABI blob, for callers who prefer the tuple form (the types are restated, not verified):
///
///          (externalEuint8 a, externalEuint32 b) =
///              abi.decode(e.abiEncoded(), (externalEuint8, externalEuint32));
struct EncryptedInput {
    bytes32[] handles;
    bytes inputProof;
    uint256 chainId;
    uint8 version;
}

/// @notice Type-safe coercion of `EncryptedInput` handles to the `externalE*` input types.
///
/// @dev    Every `externalE*` type is a `bytes32` underneath, so `externalEuint32.wrap(handle)` compiles
///         for any handle and a wrong width only surfaces inside the coprocessor. These accessors read
///         the FHE type id encoded in the handle and revert with `TypeMismatch` before that happens.
///         The handle layout itself is owned by `LibFhevmHandle`.
library LibEncryptedInput {
    error IndexOutOfBounds(uint256 index, uint256 length);
    error TypeMismatch(uint256 index, string expected, string actual);
    /// @dev The handle at slot `index` says it was minted at `handleIndex`. Only reachable if an
    ///      `EncryptedInput` was assembled by hand from handles of different batches.
    error IndexMismatch(uint256 index, uint8 handleIndex);
    /// @dev The handle was minted on another chain, or in a handle format this library does not know.
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

    /// @notice Number of encrypted values.
    function length(EncryptedInput memory self) internal pure returns (uint256) {
        return self.handles.length;
    }

    /// @notice The Solidity-side name of the value at `index` ("euint32", "eaddress", ...), read from
    ///         the handle itself.
    /// @dev    Returns the name rather than the `FheType` id so that the enum stays internal to
    ///         `forge-fhevm-std`.
    function typeNameAt(EncryptedInput memory self, uint256 index) internal pure returns (string memory) {
        if (index >= self.handles.length) revert IndexOutOfBounds(index, self.handles.length);
        return LibFheType.toString(LibFhevmHandle.typeOf(self.handles[index]));
    }

    /// @notice The handles as `abi.encode(eA, eB, ...)` would lay them out.
    /// @dev    Each handle is one static 32-byte word, so packing them is exactly the ABI encoding of the
    ///         tuple. Decode with `abi.decode(e.abiEncoded(), (externalEuintN, ...))`.
    function abiEncoded(EncryptedInput memory self) internal pure returns (bytes memory) {
        return abi.encodePacked(self.handles);
    }

    // -- PRIVATE ------------------------------------------------------------------

    function _checked(EncryptedInput memory self, uint256 index, FheType expected) private pure returns (bytes32 h) {
        if (index >= self.handles.length) revert IndexOutOfBounds(index, self.handles.length);
        h = self.handles[index];
        FheType actual = LibFhevmHandle.typeOf(h);
        if (actual != expected) {
            revert TypeMismatch(index, LibFheType.toString(expected), LibFheType.toString(actual));
        }
        uint8 handleIndex = LibFhevmHandle.indexOf(h);
        if (handleIndex != index) revert IndexMismatch(index, handleIndex);

        uint64 handleChainId = LibFhevmHandle.chainIdOf(h);
        if (handleChainId != uint64(self.chainId)) revert ChainIdMismatch(index, self.chainId, handleChainId);

        uint8 handleVersion = LibFhevmHandle.versionOf(h);
        if (handleVersion != self.version) revert VersionMismatch(index, self.version, handleVersion);
    }
}
