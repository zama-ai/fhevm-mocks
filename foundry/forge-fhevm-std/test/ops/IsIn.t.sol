// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {OpVectorTest} from "./shared/OpVectorTest.sol";
import {IsInDapp} from "./fixtures/IsInDapp.sol";

// FHE.isIn against operators-data/data/isin. See OpVectorTest for what is asserted.
//
// A case is `lhs`, the value, and `values`, the set, all of one width; the set may be empty. The value
// and the set are encrypted in ONE proof, value first, and passed to `isIn_e<N>(bytes32,bytes32[],bytes)`.
// 160 bits is eaddress. The cases include the upstream fhevm e2e ones (ids with `e2e_`), matches at
// every position, near-misses one bit away across the whole width, and sets of the executor's maximum
// size: 100 elements up to 32 bits, 60 above.
contract FHETestIsIn is OpVectorTest {
    IsInDapp internal dapp;

    function setUp() public override {
        setUpCaller();
        dapp = new IsInDapp();
        vm.label(address(dapp), "IsInDapp");
    }

    function opName() internal pure override returns (string memory) {
        return "isin";
    }

    function dappAddress() internal view override returns (address) {
        return address(dapp);
    }

    function runCase(Case memory c) internal override {
        uint256 w = c.lhsBits;
        require(c.values.length == 0 || c.valuesBits == w, string.concat(c.id, ": set is not value-wide"));
        uint256[] memory all = new uint256[](c.values.length + 1);
        all[0] = c.lhs;
        for (uint256 i = 0; i < c.values.length; i++) {
            all[i + 1] = c.values[i];
        }
        (bytes32[] memory h, bytes memory proof) = encryptList(fheType(w), all);
        bytes32[] memory set = new bytes32[](c.values.length);
        for (uint256 i = 0; i < set.length; i++) {
            set[i] = h[i + 1];
        }
        string memory sig = string.concat("isIn_e", vm.toString(w), "(bytes32,bytes32[],bytes)");
        check(c, "enc,enc[]", callDapp(c, sig, abi.encode(h[0], set, proof)));
    }

    function test_isin_8_normal() public {
        runPart("../../operators-data/data/isin/8.normal.json");
    }

    function test_isin_8_edge() public {
        runPart("../../operators-data/data/isin/8.edge.json");
    }

    function test_isin_16_normal() public {
        runPart("../../operators-data/data/isin/16.normal.json");
    }

    function test_isin_16_edge() public {
        runPart("../../operators-data/data/isin/16.edge.json");
    }

    function test_isin_32_normal() public {
        runPart("../../operators-data/data/isin/32.normal.json");
    }

    function test_isin_32_edge() public {
        runPart("../../operators-data/data/isin/32.edge.json");
    }

    function test_isin_64_normal() public {
        runPart("../../operators-data/data/isin/64.normal.json");
    }

    function test_isin_64_edge() public {
        runPart("../../operators-data/data/isin/64.edge.json");
    }

    function test_isin_128_normal() public {
        runPart("../../operators-data/data/isin/128.normal.json");
    }

    function test_isin_128_edge() public {
        runPart("../../operators-data/data/isin/128.edge.json");
    }

    function test_isin_160_normal() public {
        runPart("../../operators-data/data/isin/160.normal.json");
    }

    function test_isin_160_edge() public {
        runPart("../../operators-data/data/isin/160.edge.json");
    }

    function test_isin_256_normal() public {
        runPart("../../operators-data/data/isin/256.normal.json");
    }

    function test_isin_256_edge() public {
        runPart("../../operators-data/data/isin/256.edge.json");
    }
}
