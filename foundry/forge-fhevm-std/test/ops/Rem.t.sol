// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {BinaryOpVectorTest} from "./shared/BinaryOpVectorTest.sol";
import {RemDapp} from "./fixtures/RemDapp.sol";

// FHE.rem against test/data/sub. See OpVectorTest for what is asserted.
contract FHETestRem is BinaryOpVectorTest {
    RemDapp internal dapp;

    function setUp() public override {
        setUpCaller();
        dapp = new RemDapp();
        vm.label(address(dapp), "RemDapp");
    }

    function opName() internal pure override returns (string memory) {
        return "rem";
    }

    // FHE.rem takes a plaintext divisor: euintN rem uintN only.
    function hasEncEnc() internal pure override returns (bool) {
        return false;
    }

    function hasClearEnc() internal pure override returns (bool) {
        return false;
    }

    function dappAddress() internal view override returns (address) {
        return address(dapp);
    }

    function test_rem_8_normal() public {
        runPart("../../operators-data/data/rem/8.normal.json");
    }

    function test_rem_8_edge() public {
        runPart("../../operators-data/data/rem/8.edge.json");
    }

    function test_rem_16_normal() public {
        runPart("../../operators-data/data/rem/16.normal.json");
    }

    function test_rem_16_edge() public {
        runPart("../../operators-data/data/rem/16.edge.json");
    }

    function test_rem_32_normal() public {
        runPart("../../operators-data/data/rem/32.normal.json");
    }

    function test_rem_32_edge() public {
        runPart("../../operators-data/data/rem/32.edge.json");
    }

    function test_rem_64_normal() public {
        runPart("../../operators-data/data/rem/64.normal.json");
    }

    function test_rem_64_edge() public {
        runPart("../../operators-data/data/rem/64.edge.json");
    }

    function test_rem_128_normal() public {
        runPart("../../operators-data/data/rem/128.normal.json");
    }

    function test_rem_128_edge() public {
        runPart("../../operators-data/data/rem/128.edge.json");
    }
}
