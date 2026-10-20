// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {OpVectorTest} from "./OpVectorTest.sol";

// Vector test for a binary operator whose fixture exposes one wrapper per
// FHE.sol overload, named by operand kinds (generated upstream by scripts/gen-op-dapp.py):
//
//     <op>_e<L>_e<R>(bytes32,bytes32,bytes)
//     <op>_e<L>_u<R>(bytes32,uintR,bytes)
//     <op>_u<L>_e<R>(uintL,bytes32,bytes)
//
// The wrapper for a case is addressed by computing that signature from the
// case's widths, so neither side carries a width table: the fixture is a flat
// list of overloads and this contract is width-agnostic. A pair FHE.sol does
// not declare has no wrapper and the call reverts, which is the intended
// signal for an unwired width.
abstract contract BinaryOpVectorTest is OpVectorTest {
    // Which overload families FHE.sol declares for this operator. Most have all
    // three; div and rem take a plaintext divisor only (encClear).
    function hasEncEnc() internal pure virtual returns (bool) {
        return true;
    }

    function hasEncClear() internal pure virtual returns (bool) {
        return true;
    }

    function hasClearEnc() internal pure virtual returns (bool) {
        return true;
    }

    // Whether FHE.sol declares scalar overloads for this operand pair. Equal
    // widths for most operators; shifts and rotations take an 8-bit amount
    // whatever the value width.
    function hasScalarPair(uint256 lhsBits, uint256 rhsBits) internal pure virtual returns (bool) {
        return lhsBits == rhsBits;
    }

    function runCase(Case memory c) internal override {
        if (hasEncEnc()) check(c, "enc,enc", _encEnc(c));
        if (hasScalarPair(c.lhsBits, c.rhsBits)) {
            if (hasEncClear()) check(c, "enc,clear", _encClear(c));
            if (hasClearEnc()) check(c, "clear,enc", _clearEnc(c));
        }
    }

    // 1. encrypt a and b (one proof for both)
    // 2. build the wrapper name from the widths: lhs 8 bits, rhs 16 bits
    //    -> "add_e8_e16(bytes32,bytes32,bytes)"
    // 3. call it on the dApp
    function _encEnc(Case memory c) private returns (bytes32) {
        (bytes32[] memory h, bytes memory proof) = encryptPair(fheType(c.lhsBits), c.lhs, fheType(c.rhsBits), c.rhs);
        string memory sig = string.concat(
            opName(), "_e", vm.toString(c.lhsBits), "_e", vm.toString(c.rhsBits), "(bytes32,bytes32,bytes)"
        );
        return callDapp(c, sig, abi.encode(h[0], h[1], proof));
    }

    // 1. encrypt a only, b stays clear
    // 2. build the wrapper name from the widths: lhs 8 bits, rhs 8 bits
    //    -> "add_e8_u8(bytes32,uint8,bytes)"
    // 3. call it on the dApp
    function _encClear(Case memory c) private returns (bytes32) {
        (bytes32 h, bytes memory proof) = encryptOne(fheType(c.lhsBits), c.lhs);
        string memory sig = string.concat(
            opName(),
            "_e",
            vm.toString(c.lhsBits),
            "_u",
            vm.toString(c.rhsBits),
            "(bytes32,",
            clearType(c.rhsBits),
            ",bytes)"
        );
        return callDapp(c, sig, abi.encode(h, c.rhs, proof));
    }

    // 1. encrypt b only, a stays clear
    // 2. build the wrapper name from the widths: lhs 8 bits, rhs 8 bits
    //    -> "add_u8_e8(uint8,bytes32,bytes)"
    // 3. call it on the dApp
    function _clearEnc(Case memory c) private returns (bytes32) {
        (bytes32 h, bytes memory proof) = encryptOne(fheType(c.rhsBits), c.rhs);
        string memory sig = string.concat(
            opName(),
            "_u",
            vm.toString(c.lhsBits),
            "_e",
            vm.toString(c.rhsBits),
            "(",
            clearType(c.lhsBits),
            ",bytes32,bytes)"
        );
        return callDapp(c, sig, abi.encode(c.lhs, h, proof));
    }

    // The clear operand's Solidity type at width N, as spelled in the signature.
    function clearType(uint256 bits) private pure returns (string memory) {
        if (bits == 1) return "bool";
        if (bits == 160) return "address";
        return string.concat("uint", vm.toString(bits));
    }
}
