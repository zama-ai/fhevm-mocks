// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Vm} from "forge-std/Vm.sol";

import {ForgeVmBase} from "./_host/ForgeVmBase.sol";
import {FORGE_VM_ADDRESS} from "./_host/IForgeVm.sol";
import {FhevmVm, FHEVM_VM_ADDRESS, fhevm} from "./FhevmVm.sol";
import {LibFhevmFail} from "./LibFhevmFail.sol";

/**
 * @title StdFhevmBase
 * @notice `ForgeVmBase` with the gas-metering counter moved into `fhevm`, and `fhevm` itself put in place.
 *
 * @dev ONE COUNTER FOR THE WHOLE TEST (rules.md §2.3). The payload's `ForgeVmBase` keeps its depth in
 *      the inheriting contract's transient storage, which is one counter per contract address. Once the
 *      SDK has code in a second contract — `fhevm` — that would be two counters, and the inner scope's
 *      exit would resume metering inside the outer scope (measured at 93k gas for work that costs 0
 *      when the counter is shared). Every `StdFhevm*` mixin inherits this instead of `ForgeVmBase`.
 *
 * @dev THE HANDLE PUTS ITSELF IN PLACE, FROM THE CONSTRUCTOR. A test talks to `fhevm` directly the
 *      moment it forks — `fhevm.registerFork(...)`, later `fhevm.createSelectFork(...)` — and that is in
 *      `setUp`, often BEFORE `super.setUp()`. Nothing can self-heal a direct call to an empty address, so
 *      the etch happens where nothing can precede it: this contract's constructor, which every mixin
 *      inheritor runs at deployment. The enter hook checks the handle is still there and fails LOUDLY if
 *      not — that state is unreachable without a test wiping the account, and hiding it by re-etching
 *      would hide the test's mistake. Private: nothing outside this contract has a reason to call it.
 */
abstract contract StdFhevmBase is ForgeVmBase {
    constructor() {
        _setUpFhevmVm();
    }

    /**
     * @notice Puts the `fhevm` handle in place: etch, initialize, persist. Idempotent.
     *
     * @dev Persistent, so a fork created afterwards carries it — and a fork test that forks FIRST and
     *      then runs `StdFhevm`'s constructor etches it inside the fork, which is just as good since no test returns
     *      to the pre-fork state. `setUp` runs once per contract and forge restores its snapshot before
     *      each test, so this is one etch per test contract.
     */
    function _setUpFhevmVm() private {
        Vm forgeVm = Vm(FORGE_VM_ADDRESS);
        if (FHEVM_VM_ADDRESS.code.length == 0) {
            forgeVm.etch(FHEVM_VM_ADDRESS, type(FhevmVm).runtimeCode);
        }
        // Forge grants cheatcodes to the test contract and to what it CREATES; an etched account is
        // neither, and every cheat it issued — `activeFork`, `prank`, `recordLogs` — would revert (and a
        // `try` around one would quietly answer "no fork"). Granted explicitly, once, BEFORE `initialize`,
        // which arms the log recorder.
        forgeVm.allowCheatcodes(FHEVM_VM_ADDRESS);
        forgeVm.makePersistent(FHEVM_VM_ADDRESS);
        fhevm.initialize();
    }

    function _enterUnmetered() internal virtual override {
        // Cannot happen after this contract's constructor ran — the handle is etched and persistent — unless
        // a test wiped it. Said loudly, not repaired quietly (rules.md 2.11). Free: metering is paused.
        if (FHEVM_VM_ADDRESS.code.length == 0) revert(LibFhevmFail.handleMissing());
        fhevm.enterUnmetered();
    }

    function _exitUnmetered() internal virtual override returns (bool wasOutermost) {
        return fhevm.exitUnmetered();
    }
}
