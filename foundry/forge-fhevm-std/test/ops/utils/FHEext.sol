// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.24;

import {FheType} from "../../../pkg/src/_host/shared/FheType.sol";
import {
    FHE,
    ebool,
    euint8,
    euint16,
    euint32,
    euint64,
    euint128,
    euint256,
    eaddress,
    externalEbool,
    externalEuint8,
    externalEuint16,
    externalEuint32,
    externalEuint64,
    externalEuint128,
    externalEuint256,
    externalEaddress
} from "@fhevm/solidity/lib/FHE.sol";

// Shared by the generated operator fixtures (generated upstream by scripts/gen-op-dapp.py; copied here).
//
// `fromExternalEuintN`: turns a raw input handle into the typed encrypted
// value, through `FHE.fromExternal` with the proof the caller supplied.
//
// `allowToBytes32`: what a real dApp does with a result before handing it
// back - grant it to itself and to the caller, so the caller can user-decrypt
// it - then returns the raw handle for the test to check.
//
// Internal functions: they run in the fixture's own context, which is what
// FHE.sol needs (coprocessor config, and `msg.sender` being the dApp's caller).
library FHEext {
    // ── handle layout ──────────────────────────────────────────────────────
    //
    //   bytes 0..20  keccak prefix
    //   byte  21     input handles: index within the proof (0..254)
    //                computed handles: 0xff
    //   bytes 22..29 chain id (uint64)
    //   byte  30     FHE type id
    //   byte  31     handle version

    uint8 internal constant COMPUTED_HANDLE_MARKER = 0xff;

    function fheTypeOf(bytes32 handle) internal pure returns (FheType) {
        return FheType(uint8(handle[30]));
    }

    function chainIdOf(bytes32 handle) internal pure returns (uint64) {
        return uint64(uint256(handle) >> 16);
    }

    // True for a handle that came out of an input proof, false for one the
    // coprocessor computed.
    function isExternalHandle(bytes32 handle) internal pure returns (bool) {
        return uint8(handle[21]) != COMPUTED_HANDLE_MARKER;
    }

    // ── inputs ─────────────────────────────────────────────────────────────

    function fromExternalEbool(bytes32 externalHandle, bytes calldata proof) internal returns (ebool) {
        return FHE.fromExternal(externalEbool.wrap(externalHandle), proof);
    }

    function fromExternalEuint8(bytes32 externalHandle, bytes calldata proof) internal returns (euint8) {
        return FHE.fromExternal(externalEuint8.wrap(externalHandle), proof);
    }

    function fromExternalEuint16(bytes32 externalHandle, bytes calldata proof) internal returns (euint16) {
        return FHE.fromExternal(externalEuint16.wrap(externalHandle), proof);
    }

    function fromExternalEuint32(bytes32 externalHandle, bytes calldata proof) internal returns (euint32) {
        return FHE.fromExternal(externalEuint32.wrap(externalHandle), proof);
    }

    function fromExternalEuint64(bytes32 externalHandle, bytes calldata proof) internal returns (euint64) {
        return FHE.fromExternal(externalEuint64.wrap(externalHandle), proof);
    }

    function fromExternalEuint128(bytes32 externalHandle, bytes calldata proof) internal returns (euint128) {
        return FHE.fromExternal(externalEuint128.wrap(externalHandle), proof);
    }

    function fromExternalEuint256(bytes32 externalHandle, bytes calldata proof) internal returns (euint256) {
        return FHE.fromExternal(externalEuint256.wrap(externalHandle), proof);
    }

    function fromExternalEaddress(bytes32 externalHandle, bytes calldata proof) internal returns (eaddress) {
        return FHE.fromExternal(externalEaddress.wrap(externalHandle), proof);
    }

    // ── results ────────────────────────────────────────────────────────────

    function allowToBytes32(ebool r) internal returns (bytes32) {
        FHE.allowThis(r);
        FHE.allow(r, msg.sender);
        return FHE.toBytes32(r);
    }

    function allowToBytes32(euint8 r) internal returns (bytes32) {
        FHE.allowThis(r);
        FHE.allow(r, msg.sender);
        return FHE.toBytes32(r);
    }

    function allowToBytes32(euint16 r) internal returns (bytes32) {
        FHE.allowThis(r);
        FHE.allow(r, msg.sender);
        return FHE.toBytes32(r);
    }

    function allowToBytes32(euint32 r) internal returns (bytes32) {
        FHE.allowThis(r);
        FHE.allow(r, msg.sender);
        return FHE.toBytes32(r);
    }

    function allowToBytes32(euint64 r) internal returns (bytes32) {
        FHE.allowThis(r);
        FHE.allow(r, msg.sender);
        return FHE.toBytes32(r);
    }

    function allowToBytes32(euint128 r) internal returns (bytes32) {
        FHE.allowThis(r);
        FHE.allow(r, msg.sender);
        return FHE.toBytes32(r);
    }

    function allowToBytes32(euint256 r) internal returns (bytes32) {
        FHE.allowThis(r);
        FHE.allow(r, msg.sender);
        return FHE.toBytes32(r);
    }

    function allowToBytes32(eaddress r) internal returns (bytes32) {
        FHE.allowThis(r);
        FHE.allow(r, msg.sender);
        return FHE.toBytes32(r);
    }
}
