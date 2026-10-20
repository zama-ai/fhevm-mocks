// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {BinaryOpVectorTest} from "./shared/BinaryOpVectorTest.sol";
import {AddDapp} from "./fixtures/AddDapp.sol";

// FHE.add against test/data/add. See OpVectorTest for what is asserted.
contract FHETestAdd is BinaryOpVectorTest {
    AddDapp internal dapp;

    function setUp() public override {
        setUpCaller();
        dapp = new AddDapp();
        vm.label(address(dapp), "AddDapp");
    }

    function opName() internal pure override returns (string memory) {
        return "add";
    }

    function dappAddress() internal view override returns (address) {
        return address(dapp);
    }

    function test_add_8_normal() public {
        runPart("../../operators-data/data/add/8.normal.json");
    }

    function test_add_8_edge() public {
        runPart("../../operators-data/data/add/8.edge.json");
    }

    function test_add_16_normal() public {
        runPart("../../operators-data/data/add/16.normal.json");
    }

    function test_add_16_edge() public {
        runPart("../../operators-data/data/add/16.edge.json");
    }

    function test_add_32_normal() public {
        runPart("../../operators-data/data/add/32.normal.json");
    }

    function test_add_32_edge() public {
        runPart("../../operators-data/data/add/32.edge.json");
    }

    function test_add_64_normal() public {
        runPart("../../operators-data/data/add/64.normal.json");
    }

    function test_add_64_edge() public {
        runPart("../../operators-data/data/add/64.edge.json");
    }

    function test_add_128_normal() public {
        runPart("../../operators-data/data/add/128.normal.json");
    }

    function test_add_128_edge() public {
        runPart("../../operators-data/data/add/128.edge.json");
    }
}
