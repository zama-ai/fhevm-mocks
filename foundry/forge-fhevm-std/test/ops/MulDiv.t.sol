// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {OpVectorTest} from "./shared/OpVectorTest.sol";
import {MulDivDapp} from "./fixtures/MulDivDapp.sol";

// FHE.mulDiv against operators-data/data/muldiv. See OpVectorTest for what is asserted.
//
// A case is `lhs`, `rhs` and `divisor`, all of one width (8..64 bits). Each case runs through both
// overloads upstream's FHE.sol declares:
//
//     mulDiv(euintN a, euintN b, uintN divisor)  ->  mulDiv_e<N>_e<N>_u<N>(bytes32,bytes32,uintN,bytes)
//     mulDiv(euintN a, uintN b,  uintN divisor)  ->  mulDiv_e<N>_u<N>_u<N>(bytes32,uintN,uintN,bytes)
//
// The product is taken at double width and the quotient truncated to N bits, so the cases include
// products that overflow N bits and quotients that do not fit back. MulDivDapp explains why it calls the
// executor rather than FHE.mulDiv.
contract FHETestMulDiv is OpVectorTest {
    MulDivDapp internal dapp;

    function setUp() public override {
        setUpCaller();
        dapp = new MulDivDapp();
        vm.label(address(dapp), "MulDivDapp");
    }

    function opName() internal pure override returns (string memory) {
        return "muldiv";
    }

    function dappAddress() internal view override returns (address) {
        return address(dapp);
    }

    function runCase(Case memory c) internal override {
        require(
            c.rhsBits == c.lhsBits && c.divisorBits == c.lhsBits, string.concat(c.id, ": operands are not one width")
        );
        check(c, "enc,enc,clear", _encEnc(c));
        check(c, "enc,clear,clear", _encClear(c));
    }

    // a and b encrypted in one proof, divisor clear: "mulDiv_e8_e8_u8(bytes32,bytes32,uint8,bytes)"
    function _encEnc(Case memory c) private returns (bytes32) {
        (bytes32[] memory h, bytes memory proof) = encryptPair(fheType(c.lhsBits), c.lhs, fheType(c.lhsBits), c.rhs);
        string memory n = vm.toString(c.lhsBits);
        string memory sig = string.concat("mulDiv_e", n, "_e", n, "_u", n, "(bytes32,bytes32,uint", n, ",bytes)");
        return callDapp(c, sig, abi.encode(h[0], h[1], c.divisor, proof));
    }

    // a encrypted, b and divisor clear: "mulDiv_e8_u8_u8(bytes32,uint8,uint8,bytes)"
    function _encClear(Case memory c) private returns (bytes32) {
        (bytes32 h, bytes memory proof) = encryptOne(fheType(c.lhsBits), c.lhs);
        string memory n = vm.toString(c.lhsBits);
        string memory sig = string.concat("mulDiv_e", n, "_u", n, "_u", n, "(bytes32,uint", n, ",uint", n, ",bytes)");
        return callDapp(c, sig, abi.encode(h, c.rhs, c.divisor, proof));
    }

    function test_muldiv_8_normal() public {
        runPart("../../operators-data/data/muldiv/8.normal.json");
    }

    function test_muldiv_8_edge() public {
        runPart("../../operators-data/data/muldiv/8.edge.json");
    }

    function test_muldiv_16_normal() public {
        runPart("../../operators-data/data/muldiv/16.normal.json");
    }

    function test_muldiv_16_edge() public {
        runPart("../../operators-data/data/muldiv/16.edge.json");
    }

    function test_muldiv_32_normal() public {
        runPart("../../operators-data/data/muldiv/32.normal.json");
    }

    function test_muldiv_32_edge() public {
        runPart("../../operators-data/data/muldiv/32.edge.json");
    }

    function test_muldiv_64_normal() public {
        runPart("../../operators-data/data/muldiv/64.normal.json");
    }

    function test_muldiv_64_edge() public {
        runPart("../../operators-data/data/muldiv/64.edge.json");
    }
}
