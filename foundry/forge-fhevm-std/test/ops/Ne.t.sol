// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {BinaryOpVectorTest} from "./shared/BinaryOpVectorTest.sol";
import {NeDapp} from "./fixtures/NeDapp.sol";

// FHE.ne against test/data/ne. See OpVectorTest for what is asserted.
contract FHETestNe is BinaryOpVectorTest {
    NeDapp internal dapp;

    function setUp() public override {
        setUpCaller();
        dapp = new NeDapp();
        vm.label(address(dapp), "NeDapp");
    }

    function opName() internal pure override returns (string memory) {
        return "ne";
    }

    function dappAddress() internal view override returns (address) {
        return address(dapp);
    }

    function test_ne_256_normal() public {
        runPart("../../operators-data/data/ne/256.normal.json");
    }

    function test_ne_256_edge() public {
        runPart("../../operators-data/data/ne/256.edge.json");
    }

    function test_ne_160_normal() public {
        runPart("../../operators-data/data/ne/160.normal.json");
    }

    function test_ne_160_edge() public {
        runPart("../../operators-data/data/ne/160.edge.json");
    }

    function test_ne_128_normal() public {
        runPart("../../operators-data/data/ne/128.normal.json");
    }

    function test_ne_128_edge() public {
        runPart("../../operators-data/data/ne/128.edge.json");
    }

    function test_ne_64_normal() public {
        runPart("../../operators-data/data/ne/64.normal.json");
    }

    function test_ne_64_edge() public {
        runPart("../../operators-data/data/ne/64.edge.json");
    }

    function test_ne_32_normal() public {
        runPart("../../operators-data/data/ne/32.normal.json");
    }

    function test_ne_32_edge() public {
        runPart("../../operators-data/data/ne/32.edge.json");
    }

    function test_ne_16_normal() public {
        runPart("../../operators-data/data/ne/16.normal.json");
    }

    function test_ne_16_edge() public {
        runPart("../../operators-data/data/ne/16.edge.json");
    }

    function test_ne_8_normal() public {
        runPart("../../operators-data/data/ne/8.normal.json");
    }

    function test_ne_8_edge() public {
        runPart("../../operators-data/data/ne/8.edge.json");
    }

    function test_ne_1_edge() public {
        runPart("../../operators-data/data/ne/1.edge.json");
    }
}
