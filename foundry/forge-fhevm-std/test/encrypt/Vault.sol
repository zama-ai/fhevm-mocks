// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {FHE} from "@fhevm/solidity/lib/FHE.sol";
import {
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
} from "encrypted-types/EncryptedTypes.sol";

/// @notice A dApp with one slot per encrypted width, so a test can hand it whatever it just encrypted.
///
/// @dev Slots are named for the ENCRYPTED type they hold — `eUint32`, not `u32` — so a call site says
///      what it is handling: `vault.eUint32()` returns a handle, never a number.
///
///      Every setter takes an `externalE*` plus the proof — exactly the shape `FHE.fromExternal` wants,
///      which is the shape `encryptValues` produces. Each slot is made PUBLICLY decryptable, so these
///      are read with `decryptPublic`; `decryptUser/UserVault.sol` is the same fixture granting one
///      named reader instead.
contract Vault is ZamaEthereumConfig {
    ebool public eBool;
    euint8 public eUint8;
    euint16 public eUint16;
    euint32 public eUint32;
    euint64 public eUint64;
    euint128 public eUint128;
    euint256 public eUint256;
    eaddress public eAddress;

    function setEBool(externalEbool v, bytes calldata proof) external {
        eBool = FHE.fromExternal(v, proof);
        FHE.makePubliclyDecryptable(eBool);
    }

    function setEUint8(externalEuint8 v, bytes calldata proof) external {
        eUint8 = FHE.fromExternal(v, proof);
        FHE.makePubliclyDecryptable(eUint8);
    }

    function setEUint16(externalEuint16 v, bytes calldata proof) external {
        eUint16 = FHE.fromExternal(v, proof);
        FHE.makePubliclyDecryptable(eUint16);
    }

    function setEUint32(externalEuint32 v, bytes calldata proof) external {
        eUint32 = FHE.fromExternal(v, proof);
        FHE.makePubliclyDecryptable(eUint32);
    }

    function setEUint64(externalEuint64 v, bytes calldata proof) external {
        eUint64 = FHE.fromExternal(v, proof);
        FHE.makePubliclyDecryptable(eUint64);
    }

    function setEUint128(externalEuint128 v, bytes calldata proof) external {
        eUint128 = FHE.fromExternal(v, proof);
        FHE.makePubliclyDecryptable(eUint128);
    }

    function setEUint256(externalEuint256 v, bytes calldata proof) external {
        eUint256 = FHE.fromExternal(v, proof);
        FHE.makePubliclyDecryptable(eUint256);
    }

    function setEAddress(externalEaddress v, bytes calldata proof) external {
        eAddress = FHE.fromExternal(v, proof);
        FHE.makePubliclyDecryptable(eAddress);
    }
}
