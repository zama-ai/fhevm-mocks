// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {StdFhevm} from "./StdFhevm.sol";

// forge-lint: disable-start(unused-import)
import {EncryptedInput} from "./LibEncryptedInput.sol";
import {SignedDecryptionPermit} from "./StdFhevmDecrypt.sol";
import {TransportKeypair} from "./StdFhevmDecrypt.sol";
import {TypedValue} from "./LibTypedValue.sol";

abstract contract TestFhevm is Test, StdFhevm {
    function setUp() public virtual {
        setUpFhevm();
    }
}
