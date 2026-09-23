// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {BinaryOpVectorTest} from "./shared/BinaryOpVectorTest.sol";
import {SubDapp} from "./fixtures/SubDapp.sol";

// FHE.sub against test/data/sub. See OpVectorTest for what is asserted.
contract FHETestSub is BinaryOpVectorTest {
    SubDapp internal dapp;

    function setUp() public override {
        setUpCaller();
        dapp = new SubDapp();
        vm.label(address(dapp), "SubDapp");
    }

    function opName() internal pure override returns (string memory) {
        return "sub";
    }

    function dappAddress() internal view override returns (address) {
        return address(dapp);
    }

    function test_sub_8_normal() public {
        runPart("../../operators-data/data/sub/8.normal.json");
    }

    function test_sub_8_edge() public {
        runPart("../../operators-data/data/sub/8.edge.json");
    }

    function test_sub_16_normal() public {
        runPart("../../operators-data/data/sub/16.normal.json");
    }

    function test_sub_16_edge() public {
        runPart("../../operators-data/data/sub/16.edge.json");
    }

    function test_sub_32_normal() public {
        runPart("../../operators-data/data/sub/32.normal.json");
    }

    function test_sub_32_edge() public {
        runPart("../../operators-data/data/sub/32.edge.json");
    }

    function test_sub_64_normal() public {
        runPart("../../operators-data/data/sub/64.normal.json");
    }

    function test_sub_64_edge() public {
        runPart("../../operators-data/data/sub/64.edge.json");
    }

    function test_sub_128_normal() public {
        runPart("../../operators-data/data/sub/128.normal.json");
    }

    function test_sub_128_edge() public {
        runPart("../../operators-data/data/sub/128.edge.json");
    }
}
