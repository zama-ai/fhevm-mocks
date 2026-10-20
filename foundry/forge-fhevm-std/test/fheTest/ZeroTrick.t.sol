// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {ebool, euint8, euint32, euint64} from "encrypted-types/EncryptedTypes.sol";

import {TestFhevm} from "../../pkg/src/TestFhevm.sol";
import {fhevm} from "../../pkg/src/FhevmVm.sol";

import {FHETest} from "./FHETest.sol";

/**
 * `_zeroEuint8` MUST BE ZERO FOR EVERY DRAW, and this is what proves it rather than hoping.
 *
 * WHAT THE TRICK IS. `setClearEuintN(v)` cannot trivially-encrypt `v`: a coprocessor is free to notice
 * `a ^ a = 0` and optimise the computation away, so the contract builds a zero the optimiser cannot see
 * through and ORs `v` onto it. The zero comes from a random value:
 *
 *      s = r >> 7          // the top bit of an 8-bit draw: 0 or 1, and NOTHING else
 *      a = (r >> s) >> s   // r >> 2s
 *      b = r >> (s + s)    // r >> 2s
 *      zero = a ^ b        // 0
 *
 * WHY THE BOUND ON `s` IS THE WHOLE TRICK. Shifts on this coprocessor reduce their amount MODULO the
 * width (`operators-data/data/shr.amount-mod-width`, verified against tfhe-rs), so `a` and `b` agree only
 * while `2s` stays under 8. `>> 7` guarantees `s ∈ {0,1}` and hence `2s ∈ {0,2}`. Shift by anything
 * larger -- `>> 1`, say, which admits `s` up to 127 -- and the two sides part company whenever `2s ≥ 8`:
 * `a` reduces to 0 while `b` is `r >> (2s mod 8)`, so the "zero" carries bits and `v | zero ≠ v`. That is
 * not a mock artefact; it is what the chain would compute.
 *
 * WHY IT IS FUZZED. The failure depends on the DRAW, not on the value being stored: with `>> 7` every
 * draw cancels, and with a wider shift about half do. A single run of a broken version passes half the
 * time, which is exactly the shape of bug a fuzz run exists to catch.
 */
contract ZeroTrickTest is TestFhevm {
    FHETest internal dapp;

    function setUp() public override {
        super.setUp();
        // No wiring call: `FHETest is ZamaEthereumConfig`, whose constructor picks the stack from
        // `block.chainid` -- and on a forge test that is the local one this suite just deployed.
        dapp = new FHETest();
    }

    /// EVERY VALUE, EVERY DRAW: the stored cleartext is the one asked for, with nothing ORed onto it.
    function testFuzz_setClearEuint8IsExactlyTheValue(uint8 value) public {
        bytes32 handle = euint8Handle(dapp.setClearEuint8(value, false));

        assertEq(plaintextOf8(handle), value, "the zero carried no bits");
        assertEq(dapp.getClearText(handle), value, "and the dApp agrees about what it stored");
    }

    /// The wider types build their zero from the same `_zeroEuint8`, widened -- so they inherit its bound.
    function testFuzz_setClearEuint32IsExactlyTheValue(uint32 value) public {
        bytes32 handle = euint32Handle(dapp.setClearEuint32(value, false));
        assertEq(plaintextOf32(handle), value, "the widened zero carried no bits either");
    }

    function testFuzz_setClearEuint64IsExactlyTheValue(uint64 value) public {
        bytes32 handle = euint64Handle(dapp.setClearEuint64(value, false));
        assertEq(plaintextOf64(handle), value, "same at 64 bits");
    }

    /// A bool is the narrowest case and the one where a stray bit is most visible: anything but 0 or 1
    /// would not even be a boolean.
    function testFuzz_setClearEboolIsExactlyTheValue(bool value) public {
        bytes32 handle = eboolHandle(dapp.setClearEbool(value, false));
        assertEq(plaintextOf8(handle), value ? 1 : 0, "0 or 1, never a mask");
    }

    /**
     * AND THE ZERO IS ZERO ON BOTH BRANCHES, hammered rather than fuzzed. The fuzzer varies the VALUE; the
     * draw varies by itself, once per call. Storing zero repeatedly is the cleanest way to see the zero:
     * anything other than 0 back is the mask, and 64 rounds makes missing the `s = 1` branch -- half the
     * draws -- vanishingly unlikely.
     *
     * `resetHCU()` each round because a forge test is ONE transaction and the per-transaction cap is real:
     * without it the loop is refused as a single enormous transaction, which is not what 64 calls would be
     * on a chain. Resetting reopens the cap, so each round is metered the way its own transaction would be.
     */
    function test_theZeroIsZeroAcrossManyDraws() public {
        for (uint256 i = 0; i < 64; i++) {
            resetHCU();
            bytes32 handle = euint8Handle(dapp.setClearEuint8(0, false));
            assertEq(plaintextOf8(handle), 0, "a draw produced a non-zero zero");
        }
    }

    // -- plumbing: the dApp speaks its own encrypted types, this speaks handles --------------------

    function euint8Handle(euint8 v) private pure returns (bytes32) {
        return euint8.unwrap(v);
    }

    function euint32Handle(euint32 v) private pure returns (bytes32) {
        return euint32.unwrap(v);
    }

    function euint64Handle(euint64 v) private pure returns (bytes32) {
        return euint64.unwrap(v);
    }

    function eboolHandle(ebool v) private pure returns (bytes32) {
        return ebool.unwrap(v);
    }

    function plaintextOf8(bytes32 handle) private returns (uint256) {
        return fhevm.plaintextOf(handle);
    }

    function plaintextOf32(bytes32 handle) private returns (uint256) {
        return fhevm.plaintextOf(handle);
    }

    function plaintextOf64(bytes32 handle) private returns (uint256) {
        return fhevm.plaintextOf(handle);
    }
}
