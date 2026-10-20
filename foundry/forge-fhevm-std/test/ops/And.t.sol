// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {BinaryOpVectorTest} from "./shared/BinaryOpVectorTest.sol";
import {AndDapp} from "./fixtures/AndDapp.sol";

// FHE.and against test/data/and. See OpVectorTest for what is asserted.
contract FHETestAnd is BinaryOpVectorTest {
    AndDapp internal dapp;

    function setUp() public override {
        setUpCaller();
        dapp = new AndDapp();
        vm.label(address(dapp), "AndDapp");
    }

    function opName() internal pure override returns (string memory) {
        return "and";
    }

    function dappAddress() internal view override returns (address) {
        return address(dapp);
    }

    function test_and_256_normal() public {
        runPart("../../operators-data/data/and/256.normal.json");
    }

    function test_and_256_edge() public {
        runPart("../../operators-data/data/and/256.edge.json");
    }

    function test_and_128_normal() public {
        runPart("../../operators-data/data/and/128.normal.json");
    }

    function test_and_128_edge() public {
        runPart("../../operators-data/data/and/128.edge.json");
    }

    function test_and_64_normal() public {
        runPart("../../operators-data/data/and/64.normal.json");
    }

    function test_and_64_edge() public {
        runPart("../../operators-data/data/and/64.edge.json");
    }

    function test_and_32_normal() public {
        runPart("../../operators-data/data/and/32.normal.json");
    }

    function test_and_32_edge() public {
        runPart("../../operators-data/data/and/32.edge.json");
    }

    function test_and_16_normal() public {
        runPart("../../operators-data/data/and/16.normal.json");
    }

    function test_and_16_edge() public {
        runPart("../../operators-data/data/and/16.edge.json");
    }

    function test_and_8_normal() public {
        runPart("../../operators-data/data/and/8.normal.json");
    }

    function test_and_8_edge() public {
        runPart("../../operators-data/data/and/8.edge.json");
    }

    function test_and_1_edge() public {
        runPart("../../operators-data/data/and/1.edge.json");
    }
}
