// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {StdFhevmBase} from "./StdFhevmBase.sol";
import {fhevm} from "./FhevmVm.sol";
import {
    ebool,
    euint8,
    euint16,
    euint32,
    euint64,
    euint128,
    euint256,
    eaddress
} from "encrypted-types/EncryptedTypes.sol";
import {CoprocessorConfig} from "./_host/shared/LibFhevmCoprocessorConfig.sol";
import {LibForgeFhevmConfig} from "./_host/LibForgeFhevmConfig.sol";

/**
 * @title StdFhevmCheatsSafe
 * @notice The cheats: reading an encrypted value outright, with no permit, no ACL and no KMS.
 *
 * @dev THE `Safe` SUFFIX FOLLOWS forge-std, where `StdCheatsSafe` holds what is safe to inherit
 *      anywhere and `StdCheats is StdCheatsSafe` adds the rest. Nothing here needs the split yet — a
 *      `StdFhevmCheats is StdFhevmCheatsSafe` is where a cheat with a footgun would go, and the name
 *      leaves that door open rather than having to rename this one later.
 *
 * @dev `plaintextOf` is named for what it RETURNS — the same word the rest of the stack uses, from
 *      `IPlaintexts.plaintexts` to the `Plaintexts` struct. What it is remains a cheat, and that is
 *      this contract's job to say: nothing a dApp can do reaches these values, because a real reader
 *      needs a signed permit and an ACL grant. A test calling this steps outside the protocol to look,
 *      exactly as a forge cheatcode steps outside the EVM.
 *
 * @dev SO IT PROVES NOTHING ABOUT ACCESS. That a value is the one expected says nothing about whether
 *      any user could obtain it; `decrypt` is what tests that. Use this for assertions on arithmetic
 *      and for debugging, and reach for `decrypt` when the question is who may read.
 */
abstract contract StdFhevmCheatsSafe is StdFhevmBase {
    function getCoprocessorConfig(address contractAddress) internal view returns (CoprocessorConfig memory config) {
        config = LibForgeFhevmConfig.getCoprocessorConfig(contractAddress);
    }

    function plaintextOf(ebool value) internal unmetered returns (bool clear) {
        clear = fhevm.plaintextOf(ebool.unwrap(value)) != 0;
    }

    function plaintextOf(euint8 value) internal unmetered returns (uint8 clear) {
        clear = uint8(fhevm.plaintextOf(euint8.unwrap(value)));
    }

    function plaintextOf(euint16 value) internal unmetered returns (uint16 clear) {
        clear = uint16(fhevm.plaintextOf(euint16.unwrap(value)));
    }

    function plaintextOf(euint32 value) internal unmetered returns (uint32 clear) {
        clear = uint32(fhevm.plaintextOf(euint32.unwrap(value)));
    }

    function plaintextOf(euint64 value) internal unmetered returns (uint64 clear) {
        clear = uint64(fhevm.plaintextOf(euint64.unwrap(value)));
    }

    function plaintextOf(euint128 value) internal unmetered returns (uint128 clear) {
        clear = uint128(fhevm.plaintextOf(euint128.unwrap(value)));
    }

    function plaintextOf(euint256 value) internal unmetered returns (uint256 clear) {
        clear = fhevm.plaintextOf(euint256.unwrap(value));
    }

    function plaintextOf(eaddress value) internal unmetered returns (address clear) {
        clear = address(uint160(fhevm.plaintextOf(eaddress.unwrap(value))));
    }

    /**
     * @notice On a FORK, state what an encrypted value is worth, because nothing can know it.
     *
     * @dev FORK ONLY. A value minted before the fork block has no events anywhere, so no replay can
     *      reconstruct it, and the production stack holds no cleartext to ask. The test says what it
     *      is, and from then on the simulation carries that value through arithmetic like any other. It
     *      always wins over an unknown-handle policy.
     *
     * @dev REFUSED ON A CLEARTEXT STACK, by name: there every value is known, so there is nothing to
     *      state, and a call here would mean the test is confused about which stack it is on.
     *
     * @dev A CHEAT, like `plaintextOf`: nothing on chain changes, and no dApp can tell. A value that
     *      Sepolia in fact computed as something else proves nothing about the dApp.
     */
    function forkUnknown(ebool value, bool clear) internal unmetered {
        fhevm.seedCleartext(ebool.unwrap(value), clear ? 1 : 0);
    }

    function forkUnknown(euint8 value, uint8 clear) internal unmetered {
        fhevm.seedCleartext(euint8.unwrap(value), clear);
    }

    function forkUnknown(euint16 value, uint16 clear) internal unmetered {
        fhevm.seedCleartext(euint16.unwrap(value), clear);
    }

    function forkUnknown(euint32 value, uint32 clear) internal unmetered {
        fhevm.seedCleartext(euint32.unwrap(value), clear);
    }

    function forkUnknown(euint64 value, uint64 clear) internal unmetered {
        fhevm.seedCleartext(euint64.unwrap(value), clear);
    }

    function forkUnknown(euint128 value, uint128 clear) internal unmetered {
        fhevm.seedCleartext(euint128.unwrap(value), clear);
    }

    function forkUnknown(euint256 value, uint256 clear) internal unmetered {
        fhevm.seedCleartext(euint256.unwrap(value), clear);
    }

    function forkUnknown(eaddress value, address clear) internal unmetered {
        fhevm.seedCleartext(eaddress.unwrap(value), uint256(uint160(clear)));
    }

    /**
     * @notice On a FORK, the blanket form of `forkUnknown`: EVERY value nothing can know is worth `clear`.
     *
     * @dev ONE NUMBER FOR EVERY TYPE, clamped to each value's width — the store keeps a single default,
     *      not one per type. So `forkUnknownDefault(1000)` also makes an unknown `euint8` read 232 and an
     *      unknown `ebool` read true; `forkUnknownDefault(true)` makes every unknown number read 1; and
     *      `forkUnknownDefault(address)` makes them read that address's low bits. Reach for it when the
     *      test asserts on none of the unknown values, and for `forkUnknown` when it asserts on one — an
     *      explicit `forkUnknown` always wins over this default.
     *
     * @dev Called once in `setUp`, it covers every test: forge snapshots what `setUp` produced and
     *      restores it before each one.
     */
    function forkUnknownDefault(uint256 clear) internal unmetered {
        fhevm.useFixedUnknownHandles(clear);
    }

    function forkUnknownDefault(bool clear) internal unmetered {
        fhevm.useFixedUnknownHandles(clear ? 1 : 0);
    }

    function forkUnknownDefault(address clear) internal unmetered {
        fhevm.useFixedUnknownHandles(uint256(uint160(clear)));
    }

    /**
     * @notice On a FORK, answer every value nothing can know from `keccak256(handle)`, clamped to its
     *         type: stable run to run, so an assertion can be pinned to a number, and different per value.
     * @dev The third policy, next to `forkUnknown` (one value, stated) and `forkUnknownDefault` (every
     *      value, one number). Reach for it when a dApp needs plausible, distinct inputs it never asserts
     *      on. Refused on a cleartext stack, like the other two.
     */
    function forkUnknownDeterministic() internal unmetered {
        fhevm.useDeterministicUnknownHandles();
    }
}
