// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {BinaryOpVectorTest} from "./shared/BinaryOpVectorTest.sol";
import {OrDapp} from "./fixtures/OrDapp.sol";

// FHE.or against test/data/or. See OpVectorTest for what is asserted.
contract FHETestOr is BinaryOpVectorTest {
    OrDapp internal dapp;

    function setUp() public override {
        setUpCaller();
        dapp = new OrDapp();
        vm.label(address(dapp), "OrDapp");
    }

    function opName() internal pure override returns (string memory) {
        return "or";
    }

    function dappAddress() internal view override returns (address) {
        return address(dapp);
    }

    function test_or_256_normal() public {
        runPart("../../operators-data/data/or/256.normal.json");
    }

    function test_or_256_edge() public {
        runPart("../../operators-data/data/or/256.edge.json");
    }

    function test_or_128_normal() public {
        runPart("../../operators-data/data/or/128.normal.json");
    }

    function test_or_128_edge() public {
        runPart("../../operators-data/data/or/128.edge.json");
    }

    function test_or_64_normal() public {
        runPart("../../operators-data/data/or/64.normal.json");
    }

    function test_or_64_edge() public {
        runPart("../../operators-data/data/or/64.edge.json");
    }

    function test_or_32_normal() public {
        runPart("../../operators-data/data/or/32.normal.json");
    }

    function test_or_32_edge() public {
        runPart("../../operators-data/data/or/32.edge.json");
    }

    function test_or_16_normal() public {
        runPart("../../operators-data/data/or/16.normal.json");
    }

    function test_or_16_edge() public {
        runPart("../../operators-data/data/or/16.edge.json");
    }

    function test_or_8_normal() public {
        runPart("../../operators-data/data/or/8.normal.json");
    }

    function test_or_8_edge() public {
        runPart("../../operators-data/data/or/8.edge.json");
    }

    function test_or_1_edge() public {
        runPart("../../operators-data/data/or/1.edge.json");
    }
}
