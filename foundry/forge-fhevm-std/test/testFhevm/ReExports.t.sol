// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

// This package's own types reach a test through `TestFhevm.sol` alone — never through the
// `Lib*.sol` paths, which are an implementation detail. If either re-export goes missing, this
// file stops compiling.
import {TestFhevm, EncryptedInput, TypedValue} from "../../pkg/src/TestFhevm.sol";

// forge-std keeps its own import path: `TestFhevm` deliberately does NOT re-export it.
import {console, stdMath} from "forge-std/Test.sol";

contract ReExportsTest is TestFhevm {
    /// The two types this package owns, named without touching `LibEncryptedInput`.
    function test_ourOwnTypesComeFromTestFhevm() public {
        TypedValue memory t = asUint32(7);
        EncryptedInput memory e = encryptValues(t, address(this), makeAddr("alice"));

        assertEq(e.length(), 1);
        assertEq(e.typeNameAt(0), "euint32");
    }

    /// forge-std's own symbols still work, imported from forge-std as usual.
    function test_forgeStdKeepsItsOwnImportPath() public pure {
        console.log("ok");
        assertEq(stdMath.abs(-3), 3);
    }
}
