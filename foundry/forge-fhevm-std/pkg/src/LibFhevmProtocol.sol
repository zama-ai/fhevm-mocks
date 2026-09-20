// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {LibCleartextProbe} from "./_host/shared/LibCleartextProbe.sol";
import {ICleartextFHEVMExecutor} from "./_host/_internal/interfaces/ICleartextFHEVMExecutor.sol";
import {ICleartextArithmetic} from "./_host/_internal/interfaces/ICleartextArithmetic.sol";
import {fhevm, FHEVM_VM_ADDRESS, FhevmProtocolConfig} from "./FhevmVm.sol";
import {LibFhevmFail} from "./LibFhevmFail.sol";

/// @notice Which FHEVM stack a test is pointed at, and what was discovered about it.
struct FhevmProtocol {
    /// @dev The three addresses a dApp is configured with — the same ones it calls.
    address acl;
    address executor;
    address kmsVerifier;
    /// @dev Read off the executor rather than stored: every executor, cleartext or production, names
    ///      its own input verifier, so there is nothing for a caller to configure or get wrong.
    address inputVerifier;
    /// @dev WHERE THE VALUES COME FROM — whatever implements `IPlaintexts`. RESOLVED, never named: on a
    ///      cleartext stack it is the executor itself; on any other the executor holds no cleartexts at
    ///      all and it is the event processor `fhevm` holds, which rebuilds them from the executor's
    ///      events. Zero only when neither exists — a non-cleartext stack in a contract without the `StdFhevm` constructor.
    address plaintexts;
    /// @dev True when the stack answers `IS_CLEARTEXT`, i.e. it is a mock rather than the real protocol.
    bool isCleartext;
    /// @dev Discovered from the executor, and zero unless `isCleartext`.
    address arithmetic;
    address cleartextDb;
}

/**
 * @title LibFhevmProtocol
 * @notice The one answer to "which FHEVM stack am I talking to", for everything else to build on.
 *
 * @dev WHY THIS EXISTS. Helpers used to reach the stack through compile-time constants —
 *      `CLEARTEXT_DB_ADDRESS` and friends — which is correct for exactly one deployment: the local one
 *      this package deploys itself. Point a test at anything else (a forked Sepolia, a cleartext stack
 *      on anvil, a devnet) and those constants name addresses that hold nothing, or worse, hold an
 *      unrelated contract. Every such helper now asks here instead.
 *
 * @dev HOW THE STACK IS DECIDED. By declaration, in THIS PACKAGE'S ERC-7201 slot — not the fhevm one the
 *      dApp's `ZamaConfig` writes, so that configuring the harness never makes the harness an FHE
 *      contract — and HELD BY `fhevm`, so that a fork operation on the handle can move it. THE DEFAULT IS
 *      THE LOCAL CLEARTEXT STACK, declared by `StdFhevm`'s constructor; `fhevm.createSelectFork(chain, …)`
 *      and `fhevm.selectFork(id)` re-point it at the fork's stack the moment they return. A fork entered
 *      with a URL only CLEARS it until the first SDK entry, which resolves the stack from the dApp it
 *      names or from the chain table (`StdFhevmFork`) — so it is never stale, only unknown.
 *
 * @dev WHAT IS DISCOVERED RATHER THAN DECLARED. Given the executor, the rest is asked for:
 *      `IS_CLEARTEXT` says whether this is a mock, and a mock is walked one step further to its
 *      arithmetic and from there to its store. So a cleartext stack is usable wherever it is deployed,
 *      at whatever addresses, with nothing configured beyond the three a dApp already configures.
 */
library LibFhevmProtocol {
    // "No stack is current" and "nothing is at the fhevm address" are SETUP failures and revert with a
    // rendered `LibFhevmFail` message (rules.md 2.11), not a custom error.

    /// @notice A decryption was asked for on a stack that holds no cleartexts, before any replay exists.
    /// @dev Raised in place of reading `plaintexts(handle)` off an executor that has no such function —
    ///      a production one — when `fhevm` holds no event processor yet, i.e. no stack was ever pointed in this context.
    error FhevmPlaintextsSourceNotConfigured(address executor);

    /// @notice Points this test at a stack. The addresses a dApp would be configured with — held by `fhevm`,
    ///         where they configure the HARNESS and not the test contract's FHE identity. The local run
    ///         calls this with the local addresses; a fork operation on `fhevm` does the equivalent itself.
    function setProtocol(address acl, address executor, address kmsVerifier) internal {
        fhevm.setProtocol(acl, executor, kmsVerifier);
    }

    /// @dev The declared stack, or all zero — including when `fhevm` itself is not there yet (a contract
    ///      that inherits no mixin and asks before anything etched it).
    function _declared() private view returns (FhevmProtocolConfig memory) {
        if (FHEVM_VM_ADDRESS.code.length == 0) {
            return FhevmProtocolConfig({acl: address(0), executor: address(0), kmsVerifier: address(0)});
        }
        return fhevm.protocol();
    }

    /// @notice The stack this test is pointed at, with the cleartext layer resolved if there is one.
    /// @dev    `view`, and cheap enough to call per read: three storage words plus at most two staticcalls.
    /**
     * @dev A `staticcall`, not a typed one, so that `currentConfig()` stays total: an executor that
     *      does not answer — an address with no code, a stand-in in a test — leaves this zero instead
     *      of making every helper that resolves through here revert.
     */
    function _inputVerifierOf(address executor) private view returns (address) {
        (bool ok, bytes memory ret) =
            executor.staticcall(abi.encodeCall(ICleartextFHEVMExecutor.getInputVerifierAddress, ()));
        return (ok && ret.length == 32) ? abi.decode(ret, (address)) : address(0);
    }

    /// @notice `currentConfig()`, with the plaintext source guaranteed present.
    /// @dev For the decryption paths, which cannot do anything useful without one and should say so
    ///      rather than calling `plaintexts(handle)` on a contract that has no such function.
    function currentConfigWithPlaintexts() internal view returns (FhevmProtocol memory protocol) {
        protocol = currentConfig();
        if (protocol.plaintexts == address(0)) revert FhevmPlaintextsSourceNotConfigured(protocol.executor);
    }

    function currentConfig() internal view returns (FhevmProtocol memory protocol) {
        FhevmProtocolConfig memory declared = _declared();
        protocol.acl = declared.acl;
        protocol.executor = declared.executor;
        protocol.kmsVerifier = declared.kmsVerifier;

        if (protocol.executor == address(0)) {
            revert(FHEVM_VM_ADDRESS.code.length == 0 ? LibFhevmFail.handleMissing() : LibFhevmFail.noCurrentStack());
        }

        protocol.inputVerifier = _inputVerifierOf(protocol.executor);

        protocol.isCleartext = LibCleartextProbe.isCleartext(protocol.executor);

        // A cleartext executor IS the plaintext source; anything else reads the replay `fhevm` holds.
        protocol.plaintexts = protocol.isCleartext ? protocol.executor : _eventProcessor();

        if (!protocol.isCleartext) return protocol;

        protocol.arithmetic = ICleartextFHEVMExecutor(protocol.executor).getCleartextArithmeticAddress();
        protocol.cleartextDb = ICleartextArithmetic(protocol.arithmetic).getCleartextDBAddress();
    }

    /// @dev The processor `fhevm` holds, or zero — including when `fhevm` itself is not there yet. A test
    ///      that inherits one mixin and declares its stack before its first `unmetered` entry reaches here
    ///      with nothing etched at that address; that is a legal moment, not an error.
    function _eventProcessor() private view returns (address) {
        if (FHEVM_VM_ADDRESS.code.length == 0) return address(0);
        return fhevm.eventProcessor();
    }

    /// @notice Whether a stack has been configured at all, without reverting if none has.
    function hasProtocol() internal view returns (bool) {
        return _declared().executor != address(0);
    }
}
