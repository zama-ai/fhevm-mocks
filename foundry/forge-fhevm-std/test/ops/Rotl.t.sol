// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {BinaryOpVectorTest} from "./shared/BinaryOpVectorTest.sol";
import {RotlDapp} from "./fixtures/RotlDapp.sol";

// FHE.rotl against test/data/rotl. See OpVectorTest for what is asserted.
contract FHETestRotl is BinaryOpVectorTest {
    RotlDapp internal dapp;

    function setUp() public override {
        setUpCaller();
        dapp = new RotlDapp();
        vm.label(address(dapp), "RotlDapp");
    }

    function opName() internal pure override returns (string memory) {
        return "rotl";
    }

    function dappAddress() internal view override returns (address) {
        return address(dapp);
    }

    // FHE.rotl takes an 8-bit amount, encrypted or clear, for every value width;
    // there is no clear-value form.
    function hasScalarPair(uint256, uint256 rhsBits) internal pure override returns (bool) {
        return rhsBits == 8;
    }

    function hasClearEnc() internal pure override returns (bool) {
        return false;
    }

    function test_rotl_256_normal() public {
        runPart("../../operators-data/data/rotl/256.normal.json");
    }

    function test_rotl_256_edge() public {
        runPart("../../operators-data/data/rotl/256.edge.json");
    }

    function test_rotl_128_normal() public {
        runPart("../../operators-data/data/rotl/128.normal.json");
    }

    function test_rotl_128_edge() public {
        runPart("../../operators-data/data/rotl/128.edge.json");
    }

    function test_rotl_64_normal() public {
        runPart("../../operators-data/data/rotl/64.normal.json");
    }

    function test_rotl_64_edge() public {
        runPart("../../operators-data/data/rotl/64.edge.json");
    }

    function test_rotl_32_normal() public {
        runPart("../../operators-data/data/rotl/32.normal.json");
    }

    function test_rotl_32_edge() public {
        runPart("../../operators-data/data/rotl/32.edge.json");
    }

    function test_rotl_16_normal() public {
        runPart("../../operators-data/data/rotl/16.normal.json");
    }

    function test_rotl_16_edge() public {
        runPart("../../operators-data/data/rotl/16.edge.json");
    }

    function test_rotl_8_normal() public {
        runPart("../../operators-data/data/rotl/8.normal.json");
    }

    function test_rotl_8_edge() public {
        runPart("../../operators-data/data/rotl/8.edge.json");
    }
}
