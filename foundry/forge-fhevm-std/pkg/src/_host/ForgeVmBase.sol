// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {IForgeVm, FORGE_VM_ADDRESS} from "./IForgeVm.sol";

/**
 * @title ForgeVmBase
 * @notice Binds the cheatcode address.
 * @dev The constant is `fvm`, NOT `vm`: forge-std's `CommonBase` declares `Vm internal constant vm`, so a
 *      consumer writing `is Test, ForgeFhevmDeploy` would hit `Error (9097): Identifier already declared`.
 */
abstract contract ForgeVmBase {
    IForgeVm internal constant fvm = IForgeVm(FORGE_VM_ADDRESS);

    /**
     * @dev How many `unmetered` scopes are open, in TRANSIENT storage. Only the outermost scope touches
     *      the cheatcode.
     *
     *      Transient, not storage, because the counter is itself charged to the test: a cold `SSTORE`
     *      is ~20k gas, which showed up as an encryption "costing" 29k after everything else had been
     *      paused. `TSTORE` is ~100. The slot is namespaced so it cannot collide with a consumer's.
     */
    bytes32 private constant UNMETERED_DEPTH_SLOT = keccak256("fhevm.forge.ForgeVmBase.unmeteredDepth");

    /**
     * @notice Runs the body without charging its gas to the test.
     *
     * @dev THE ONE OWNER OF GAS METERING. Everything this project does on a test's behalf — encrypting,
     *      signing permits, replaying events, rebuilding proofs — stands in for an SDK that runs off
     *      chain, so a test's gas figure must not carry it. What is left is the dApp's own call.
     *
     * @dev DEPTH-COUNTED, because the entry points call each other: `decrypt` reaches
     *      `generateTransportKeypair` and `signLegacyDecryptionPermit`, which are entry points too. A
     *      plain pause/resume pair would have the inner one resume metering two thirds of the way
     *      through the outer, and nothing would report it — measured at 0 gas before the inner call and
     *      93k after, for identical work. forge-std's `noGasMetering` guards only against itself, via a
     *      private flag no other contract can read, which is why this exists rather than that.
     *
     * @dev Nothing below an entry point may pause or resume on its own. A library that did would resume
     *      out from under this scope, which is the same bug seen from the other side.
     */
    modifier unmetered() {
        // PAUSE FIRST, unconditionally: `pauseGasMetering` is idempotent, and pausing before the counter
        // is touched means the counter's own cost — including an external call, when the counter lives
        // in another contract — is never charged to the test. Only the outermost exit resumes.
        fvm.pauseGasMetering();
        _enterUnmetered();
        _;
        if (_exitUnmetered()) fvm.resumeGasMetering();
    }

    /**
     * @dev The counter is read and written INSIDE these two, not in the modifier body: a modifier's locals
     *      belong to the frame of every function it wraps, and this one wraps functions already at solc's
     *      stack limit — `signLegacyDecryptionPermit` overflowed the moment the modifier held a `depth`
     *      variable. Pause-first leaves the wrapped frame with no extra slot at all.
     */
    /**
     * @dev THE COUNTER'S HOME IS A HOOK. Here it is this contract's transient storage, which is right for
     *      the payload compiled on its own. forge-fhevm-std overrides both hooks to keep the ONE counter in
     *      its `fhevm` contract instead — because `TSTORE` is per address, a test contract and a helper
     *      contract each pausing on a counter of their own would resume metering out from under each
     *      other, which is the very bug this modifier exists to prevent.
     */
    function _enterUnmetered() internal virtual {
        _setUnmeteredDepth(_unmeteredDepth() + 1);
    }

    function _exitUnmetered() internal virtual returns (bool wasOutermost) {
        uint256 remaining = _unmeteredDepth() - 1;
        _setUnmeteredDepth(remaining);
        return remaining == 0;
    }

    function _unmeteredDepth() private view returns (uint256 depth) {
        bytes32 slot = UNMETERED_DEPTH_SLOT;
        assembly ("memory-safe") {
            depth := tload(slot)
        }
    }

    function _setUnmeteredDepth(uint256 depth) private {
        bytes32 slot = UNMETERED_DEPTH_SLOT;
        assembly ("memory-safe") {
            tstore(slot, depth)
        }
    }
}
