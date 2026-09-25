// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {UnaryOpVectorTest} from "./shared/UnaryOpVectorTest.sol";
import {NotDapp} from "./fixtures/NotDapp.sol";

// FHE.not against test/data/not. See OpVectorTest for what is asserted.
contract FHETestNot is UnaryOpVectorTest {
    NotDapp internal dapp;

    function setUp() public override {
        setUpCaller();
        dapp = new NotDapp();
        vm.label(address(dapp), "NotDapp");
    }

    function opName() internal pure override returns (string memory) {
        return "not";
    }

    function dappAddress() internal view override returns (address) {
        return address(dapp);
    }

    function test_not_256_normal() public {
        runPart("../../operators-data/data/not/256.normal.json");
    }

    function test_not_256_edge() public {
        runPart("../../operators-data/data/not/256.edge.json");
    }

    function test_not_128_normal() public {
        runPart("../../operators-data/data/not/128.normal.json");
    }

    function test_not_128_edge() public {
        runPart("../../operators-data/data/not/128.edge.json");
    }

    function test_not_64_normal() public {
        runPart("../../operators-data/data/not/64.normal.json");
    }

    function test_not_64_edge() public {
        runPart("../../operators-data/data/not/64.edge.json");
    }

    function test_not_32_normal() public {
        runPart("../../operators-data/data/not/32.normal.json");
    }

    function test_not_32_edge() public {
        runPart("../../operators-data/data/not/32.edge.json");
    }

    function test_not_16_normal() public {
        runPart("../../operators-data/data/not/16.normal.json");
    }

    function test_not_16_edge() public {
        runPart("../../operators-data/data/not/16.edge.json");
    }

    function test_not_8_normal() public {
        runPart("../../operators-data/data/not/8.normal.json");
    }

    function test_not_8_edge() public {
        runPart("../../operators-data/data/not/8.edge.json");
    }

    function test_not_1_edge() public {
        runPart("../../operators-data/data/not/1.edge.json");
    }
}
