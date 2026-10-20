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

/// @notice One slot per encrypted width, each readable by ONE named account.
///
/// @dev Slots are named for the ENCRYPTED type they hold — `eUint32`, not `u32` — so a call site says
///      what it is handling: `vault.eUint32()` returns a handle, never a number.
///
///      `FHE.allow(x, reader)`, NOT `makePubliclyDecryptable` — that is the difference between user
///      decryption and public decryption, and the reason this fixture exists beside `encrypt/Vault.sol`.
contract UserVault is ZamaEthereumConfig {
    ebool public eBool;
    euint8 public eUint8;
    euint16 public eUint16;
    euint32 public eUint32;
    euint64 public eUint64;
    euint128 public eUint128;
    euint256 public eUint256;
    eaddress public eAddress;

    function setEBool(externalEbool v, bytes calldata proof, address reader) external {
        eBool = FHE.fromExternal(v, proof);
        FHE.allowThis(eBool);
        FHE.allow(eBool, reader);
    }

    function setEUint8(externalEuint8 v, bytes calldata proof, address reader) external {
        eUint8 = FHE.fromExternal(v, proof);
        FHE.allowThis(eUint8);
        FHE.allow(eUint8, reader);
    }

    function setEUint16(externalEuint16 v, bytes calldata proof, address reader) external {
        eUint16 = FHE.fromExternal(v, proof);
        FHE.allowThis(eUint16);
        FHE.allow(eUint16, reader);
    }

    function setEUint32(externalEuint32 v, bytes calldata proof, address reader) external {
        eUint32 = FHE.fromExternal(v, proof);
        FHE.allowThis(eUint32);
        FHE.allow(eUint32, reader);
    }

    function setEUint64(externalEuint64 v, bytes calldata proof, address reader) external {
        eUint64 = FHE.fromExternal(v, proof);
        FHE.allowThis(eUint64);
        FHE.allow(eUint64, reader);
    }

    function setEUint128(externalEuint128 v, bytes calldata proof, address reader) external {
        eUint128 = FHE.fromExternal(v, proof);
        FHE.allowThis(eUint128);
        FHE.allow(eUint128, reader);
    }

    function setEUint256(externalEuint256 v, bytes calldata proof, address reader) external {
        eUint256 = FHE.fromExternal(v, proof);
        FHE.allowThis(eUint256);
        FHE.allow(eUint256, reader);
    }

    function setEAddress(externalEaddress v, bytes calldata proof, address reader) external {
        eAddress = FHE.fromExternal(v, proof);
        FHE.allowThis(eAddress);
        FHE.allow(eAddress, reader);
    }
}
