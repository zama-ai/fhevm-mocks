// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {OpVectorTest} from "./OpVectorTest.sol";

// Vector test for a unary operator whose fixture exposes one wrapper per
// FHE.sol overload, named by operand width (generated upstream by scripts/gen-op-dapp.py):
//
//     <op>_e<N>(bytes32,bytes)
abstract contract UnaryOpVectorTest is OpVectorTest {
    // 1. encrypt a
    // 2. build the wrapper name from the width: 8 bits -> "neg_e8(bytes32,bytes)"
    // 3. call it on the dApp
    function runCase(Case memory c) internal override {
        (bytes32 h, bytes memory proof) = encryptOne(fheType(c.lhsBits), c.lhs);
        string memory sig = string.concat(opName(), "_e", vm.toString(c.lhsBits), "(bytes32,bytes)");
        check(c, "enc", callDapp(c, sig, abi.encode(h, proof)));
    }
}
