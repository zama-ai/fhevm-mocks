// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {BinaryOpVectorTest} from "./shared/BinaryOpVectorTest.sol";
import {DivDapp} from "./fixtures/DivDapp.sol";

// FHE.div against test/data/sub. See OpVectorTest for what is asserted.
contract FHETestDiv is BinaryOpVectorTest {
    DivDapp internal dapp;

    function setUp() public override {
        setUpCaller();
        dapp = new DivDapp();
        vm.label(address(dapp), "DivDapp");
    }

    function opName() internal pure override returns (string memory) {
        return "div";
    }

    // FHE.div takes a plaintext divisor: euintN div uintN only.
    function hasEncEnc() internal pure override returns (bool) {
        return false;
    }

    function hasClearEnc() internal pure override returns (bool) {
        return false;
    }

    function dappAddress() internal view override returns (address) {
        return address(dapp);
    }

    function test_div_8_normal() public {
        runPart("../../operators-data/data/div/8.normal.json");
    }

    function test_div_8_edge() public {
        runPart("../../operators-data/data/div/8.edge.json");
    }

    function test_div_16_normal() public {
        runPart("../../operators-data/data/div/16.normal.json");
    }

    function test_div_16_edge() public {
        runPart("../../operators-data/data/div/16.edge.json");
    }

    function test_div_32_normal() public {
        runPart("../../operators-data/data/div/32.normal.json");
    }

    function test_div_32_edge() public {
        runPart("../../operators-data/data/div/32.edge.json");
    }

    function test_div_64_normal() public {
        runPart("../../operators-data/data/div/64.normal.json");
    }

    function test_div_64_edge() public {
        runPart("../../operators-data/data/div/64.edge.json");
    }

    function test_div_128_normal() public {
        runPart("../../operators-data/data/div/128.normal.json");
    }

    function test_div_128_edge() public {
        runPart("../../operators-data/data/div/128.edge.json");
    }
}
