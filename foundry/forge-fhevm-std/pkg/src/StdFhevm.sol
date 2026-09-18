// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

// 💬 ABOUT
// Forge Fhevm Std's default Test.

// 🧩 MODULES
import {StdFhevmEncrypt} from "./StdFhevmEncrypt.sol";
import {StdFhevmDecryptPublic} from "./StdFhevmDecryptPublic.sol";
import {StdFhevmDecrypt} from "./StdFhevmDecrypt.sol";

// 🧩 HELPERS - re-export — load-bearing, do not remove as "unused".
// forge-lint: disable-start(unused-import)
import {EncryptedInput} from "./LibEncryptedInput.sol";
import {SignedDecryptionPermit} from "./StdFhevmDecrypt.sol";
import {TransportKeypair} from "./StdFhevmDecrypt.sol";
import {TypedValue} from "./LibTypedValue.sol";

abstract contract StdFhevm is StdFhevmEncrypt, StdFhevmDecryptPublic, StdFhevmDecrypt {
    function setUpFhevm() internal virtual {
        deployLocalFhevm();
    }
}
