// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {StdFhevm} from "./StdFhevm.sol";

// forge-lint: disable-start(unused-import)
import {EncryptedInput} from "./LibEncryptedInput.sol";
import {Plaintexts} from "./LibPlaintexts.sol";
import {SignedDecryptionPermit} from "./StdFhevmDecrypt.sol";
import {TransportKeypair} from "./StdFhevmDecrypt.sol";
import {TypedValue} from "./TypedValue.sol";

abstract contract TestFhevm is Test, StdFhevm {
    /**
     * @notice Nothing to set up: the local cleartext stack is deployed and declared by the CONSTRUCTOR,
     *         before any `setUp` runs, and a fork test moves off it with `fhevm.createSelectFork(...)`.
     *
     * @dev Declared, and empty, so that a test may `override` it and call `super.setUp()` exactly as it
     *      would with forge-std's `Test` — on the in-memory stack or on a fork, the call changes nothing.
     */
    function setUp() public virtual {}
}
