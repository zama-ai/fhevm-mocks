// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {BinaryOpVectorTest} from "./shared/BinaryOpVectorTest.sol";
import {XorDapp} from "./fixtures/XorDapp.sol";

// FHE.xor against test/data/xor. See OpVectorTest for what is asserted.
contract FHETestXor is BinaryOpVectorTest {
    XorDapp internal dapp;

    function setUp() public override {
        setUpCaller();
        dapp = new XorDapp();
        vm.label(address(dapp), "XorDapp");
    }

    function opName() internal pure override returns (string memory) {
        return "xor";
    }

    function dappAddress() internal view override returns (address) {
        return address(dapp);
    }

    function test_xor_256_normal() public {
        runPart("../../operators-data/data/xor/256.normal.json");
    }

    function test_xor_256_edge() public {
        runPart("../../operators-data/data/xor/256.edge.json");
    }

    function test_xor_128_normal() public {
        runPart("../../operators-data/data/xor/128.normal.json");
    }

    function test_xor_128_edge() public {
        runPart("../../operators-data/data/xor/128.edge.json");
    }

    function test_xor_64_normal() public {
        runPart("../../operators-data/data/xor/64.normal.json");
    }

    function test_xor_64_edge() public {
        runPart("../../operators-data/data/xor/64.edge.json");
    }

    function test_xor_32_normal() public {
        runPart("../../operators-data/data/xor/32.normal.json");
    }

    function test_xor_32_edge() public {
        runPart("../../operators-data/data/xor/32.edge.json");
    }

    function test_xor_16_normal() public {
        runPart("../../operators-data/data/xor/16.normal.json");
    }

    function test_xor_16_edge() public {
        runPart("../../operators-data/data/xor/16.edge.json");
    }

    function test_xor_8_normal() public {
        runPart("../../operators-data/data/xor/8.normal.json");
    }

    function test_xor_8_edge() public {
        runPart("../../operators-data/data/xor/8.edge.json");
    }

    function test_xor_1_edge() public {
        runPart("../../operators-data/data/xor/1.edge.json");
    }
}
