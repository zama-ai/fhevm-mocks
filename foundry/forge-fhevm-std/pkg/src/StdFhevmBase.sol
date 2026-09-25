// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Vm} from "forge-std/Vm.sol";

import {ForgeVmBase} from "./_host/ForgeVmBase.sol";
import {FORGE_VM_ADDRESS} from "./_host/IForgeVm.sol";
import {FhevmVm, FHEVM_VM_ADDRESS, fhevm} from "./FhevmVm.sol";
import {LibFhevmFail} from "./LibFhevmFail.sol";

abstract contract StdFhevmBase is ForgeVmBase {
    constructor() {
        _setUpFhevmVm();
    }

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
        // a test wiped it. Said loudly, not repaired quietly. Free: metering is paused.
        if (FHEVM_VM_ADDRESS.code.length == 0) revert(LibFhevmFail.handleMissing());
        fhevm.enterUnmetered();
    }

    function _exitUnmetered() internal virtual override returns (bool wasOutermost) {
        return fhevm.exitUnmetered();
    }
}
