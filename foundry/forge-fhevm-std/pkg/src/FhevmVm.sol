// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Vm, VmSafe} from "forge-std/Vm.sol";

import {FORGE_VM_ADDRESS} from "./_host/IForgeVm.sol";
import {ForgeFhevmEventProcessor, IForgeVmLogs} from "./_host/ForgeFhevmEventProcessor.sol";
import {LibForgeFhevmContexts} from "./_host/LibForgeFhevmContexts.sol";
import {LibForgeFhevmConfig} from "./_host/LibForgeFhevmConfig.sol";
import {LibCleartextProbe} from "./_host/shared/LibCleartextProbe.sol";
import {LocalHostVersions} from "./_host/_internal/LocalHostVersions.sol";
import {ForgeFhevmDeploy} from "./_host/ForgeFhevmDeploy.sol";
import {
    ACL_ADDRESS,
    FHEVM_EXECUTOR_ADDRESS,
    DEPLOYER_ADDRESS,
    DEPLOYER_START_NONCE,
    PAUSER_SET_ADDRESS
} from "./_host/_internal/LocalHostAddresses.sol";
import {PAUSER_SET_RUNTIME_CODE} from "./_host/_internal/LocalHostBytecode.sol";
import {StdFhevmChains} from "./StdFhevmChains.sol";
import {LibFhevmFail} from "./LibFhevmFail.sol";

/// @dev `keccak256("fhevm cheat code")`, the same derivation forge uses for `vm`.
address constant FHEVM_VM_ADDRESS = address(uint160(uint256(keccak256("fhevm cheat code"))));

/// @dev What `currentForkId()` answers when no fork is active. Fork ids count from 0, so 0 cannot mean
///      "none"; this can, since forge will never hand out 2^256-1 of them.
uint256 constant NO_FORK = type(uint256).max;

/// @notice The three addresses a dApp is configured with — the stack this test is pointed at.
struct FhevmProtocolConfig {
    address acl;
    address executor;
    address kmsVerifier;
}

/**
 * @title fhevm — the FHEVM cheatcode handle
 * @notice The second VM handle in a forge-fhevm-std test, next to `vm`.
 *
 *         `vm` is forge's. `fhevm` is this SDK's, and it exists for the few cheats the SDK has to stand
 *         in front of because forge cannot intercept them: the fork family and the recorded-log buffer.
 *         A reader who knows `vm.createSelectFork` knows `fhevm.createSelectFork`; the rule is "fork and
 *         read logs through `fhevm`, everything else through `vm`".
 *
 * @dev WHY A CONTRACT AT A FIXED ADDRESS, like `vm` itself. Everything the SDK has to remember across a
 *      test — WHICH STACK IS CURRENT, which forks it has prepared, where the event processor is — lives
 *      here as ordinary state, reachable by every mixin and library through the `fhevm` constant, in
 *      every fork. The test contract's constructor etches the runtime code at `FHEVM_VM_ADDRESS`, calls
 *      `initialize()` (etch runs no constructor), makes the account persistent and grants it cheatcodes,
 *      so the same instance, with its state, is present after every `createSelectFork` and `selectFork`.
 *
 * @dev THE CURRENT STACK IS THE LOCAL CLEARTEXT ONE BY DEFAULT, and every fork operation on this handle
 *      moves it: `createSelectFork(chain, …)` and `selectFork(id)` point the protocol at the fork's
 *      stack the moment they return — version checked, signer sets swapped so proofs built here are
 *      accepted, the replay reading that stack's executor. Nothing is deferred to "the first call": a
 *      test that forks and then reads `currentConfig()` sees the fork's stack.
 *
 * @dev A REAL CALL FRAME, unlike a cheatcode. Forge special-cases only its own address, so a call to
 *      `fhevm` is an ordinary external call: it consumes a pending `vm.prank` or `vm.expectRevert` (rules.md
 *      §7.7), so keep it out of argument position and out of an `expectRevert` window. Its gas is hidden
 *      from the test's figure by the SDK's `unmetered` scope.
 *
 * @dev ETCHED, SO EIP-170 DOES NOT APPLY: `vm.etch` places code without the 24 KB creation check, and
 *      this contract may legitimately grow past it, like the `…Forge` executor variant. That is deliberate
 *      and no size test should be written against it.
 *
 * @dev FORK DRIFT FAILS LOUDLY. Forge cannot tell this handle that `vm.createSelectFork` or `vm.selectFork`
 *      ran, so a fork entered that way is one whose FHE events were not drained and whose stack nobody
 *      named. Rather than guess, every SDK entry checks that the active fork is the one `fhevm` last
 *      switched to, and refuses otherwise with a rendered FORK DRIFT message (rules.md 2.11) whose fix is
 *      always the same — fork through `fhevm`, not `vm`.
 *
 * @dev BORN ON A FORK (`forge test --fork-url <url>`). Forge then starts every test on fork 0 before any
 *      constructor runs, so nothing could have told `fhevm`. That context is taken as the baseline (no
 *      drift), the local cleartext stack is NOT deployed (the chain is a real one), and the stack is
 *      resolved at the first SDK entry exactly like a URL-only fork's: from the dApp the entry names, else
 *      from the chain table when the chain id is unambiguous; anvil behind `--fork-url` is provisioned
 *      like any anvil fork. `fhevm.createSelectFork` / `selectFork` work from there as usual.
 *
 * @dev SURFACE — only what is overridden, plus its fork family:
 *
 *      | `fhevm.`                                    | does                                                     |
 *      |---------------------------------------------|----------------------------------------------------------|
 *      | `createSelectFork(chain)`, `(chain, block)` | DRAIN, `vm.createSelectFork(chain.rpcUrl, …)`, prepare and POINT at that stack — the form to use |
 *      | `createSelectFork(url)`, `(url, block)`     | DRAIN and fork; the stack is RESOLVED at the first SDK entry: from the dApp the entry names, else from the chain table by chain id — refused by name when that is ambiguous (Sepolia carries two stacks) |
 *      | `selectFork(id)`                            | DRAIN the fork being left, `vm.selectFork`, POINT at the fork's stack |
 *      | `createFork(chain | url, [block])`          | `vm.createFork`: no switch, so no drain; the chain form remembers the stack for the first `selectFork` |
 *      | `rollFork([id,] block)`                     | DRAIN, `vm.rollFork`, then prepare the fork AGAIN with a fresh replay — a roll is a fresh fork at another block |
 *      | `useStack(chain)`                           | point the ACTIVE context (in memory or a fork) at a described stack, fully prepared — what `createSelectFork(chain, …)` does after forking |
 *      | `activeFork()`                              | forwarded |
 *      | `getRecordedLogs()`                         | `vm.getRecordedLogs()`, with the FHE events fed to the replay first — USE THIS, never `vm.getRecordedLogs()` (rules.md §2.3, §7.4) |
 *      | `setAnvilMirror(bool)`, `anvilMirror()`     | whether a stack the SDK deploys on an anvil fork is also written onto the NODE (default: yes) |
 *
 * @dev ANVIL IS A FIRST-CLASS TARGET (rules.md 2.14). A fork of a running anvil is a fork with nothing on
 *      it. On first contact the SDK looks for the cleartext stack at the canonical local addresses; if the
 *      executor has no code and the node answers `anvil_nodeInfo`, the SDK deploys the stack INTO THE FORK
 *      (the same deploy the local run does, same deployer, same nonce sequence, same addresses) and, unless
 *      `setAnvilMirror(false)`, MIRRORS the result onto the node through `anvil_setCode` /
 *      `anvil_setStorageAt` / `anvil_setNonce` — so the stack survives the test, and a relayer, a script or
 *      a second test process finds it. A cleartext stack needs no version gate and no signer swap: it is
 *      this package's own code, and it registers the cleartext signers itself.
 *      | `registerFork(id, chain)`                   | name the ACTIVE fork's stack after a URL-only fork; prepares and points |
 *      | `protocol()`, `setProtocol(...)`            | the current stack; `setProtocol` is what the local run and a manual declaration use |
 *      | `useCleartextVerifier()`, `setForceProductionPath(b)` | ask a cleartext verifier directly, or rebuild every answer (rules.md 3.1); the setter overrides `FHEVM_FORCE_FORK_STACK` |
 *      | `isForked()`, `currentForkId()`, `activeForkChecked()` | on a fork at all; `vm.activeFork()` or `NO_FORK`; the checked form reverts loudly on drift |
 *      | `hasRpcUrlFor(alias)`                       | did the run configure a URL for this alias (`foundry.toml` or `<ALIAS>_RPC_URL`)? — the opt-in a fork test checks |
 *      | `eventProcessor()`                          | the ACTIVE context's replay (one per context, created when a stack is pointed there) |
 *      | `ensureForkPrepared(dApp)`, `drainFheEvents()`, `setChainTable(...)`, `seedCleartext(...)`, `useFixedUnknownHandles(...)`, `useDeterministicUnknownHandles()`, `initialize()`, `enterUnmetered()` / `exitUnmetered()`, `isForkRegistered(id)` | plumbing for the `StdFhevm*` mixins; not for tests |
 */
interface IFhevmVm {
    // Setup failures — fork drift, an unsupported protocol version, a fork registered while inactive, an
    // empty RPC URL — revert with a rendered `LibFhevmFail` message, not a custom error (rules.md 2.11).

    // -- Plumbing ---------------------------------------------------------------------------------------

    /// @notice Whether `initialize()` has run. False at a bare etch, and false in a fork the account was
    ///         not carried into — which is how a missing `makePersistent` shows up.
    function initialized() external view returns (bool);

    /// @notice One-time setup after the etch. Idempotent; callable by anyone, on purpose: there is nothing
    ///         to protect in a test EVM, and an owner check would only get in the way of a test that
    ///         re-etches.
    function initialize() external;

    /**
     * @notice One scope deeper into "not charged to the test".
     * @dev THE ONE COUNTER, in this contract's TRANSIENT storage, for every `unmetered` scope in the test
     *      contract and in this contract's own entries. It has to be one: `TSTORE` is per address, so a
     *      counter per contract is two counters, and the inner one's exit resumes metering in the middle
     *      of the outer scope. Called by the `unmetered` modifier AFTER `pauseGasMetering`, so the call
     *      itself is never charged. Not a cheat a test calls.
     */
    function enterUnmetered() external;

    /// @notice One scope out. True when this was the outermost, i.e. the caller must resume metering.
    function exitUnmetered() external returns (bool wasOutermost);

    /**
     * @notice The event processor of the ACTIVE execution context — the in-memory chain or the active
     *         fork — or zero before a stack was pointed there.
     * @dev ONE PER CONTEXT, NEVER PERSISTENT (rules.md §2.3). A processor is the reconstruction of one
     *      chain's state, so it is created INSIDE the context whose chain it mirrors, by `setProtocol`, and
     *      lives and dies with that context: switch fork and it is gone with the chain, switch back and it
     *      is there as left, roll and it is discarded with the rest of the fork's local state. Whether it
     *      is READ is the stack's property, not the context's: `LibFhevmProtocol` resolves the plaintext
     *      source to the executor when the stack is cleartext, to this processor otherwise — in memory
     *      exactly as on a fork.
     */
    function eventProcessor() external view returns (address);

    // -- The current stack --------------------------------------------------------------------------------

    /**
     * @notice Whether the current stack's verifiers may be ASKED directly — a cleartext verifier answers
     *         `inputProof` / `userDecrypt` itself — or every answer must be REBUILT from the signer keys this
     *         package holds and the plaintext source (a production stack, which has no such functions).
     * @dev THE ONE PREDICATE that gates such a call (rules.md 3.1). True for a cleartext stack unless the
     *      run says otherwise: `FHEVM_FORCE_FORK_STACK=true` in the environment, or `setForceProductionPath(true)`
     *      — a cleartext stack on a REMOTE node is reachable both ways, and there every direct call is a
     *      round trip. False for a production stack, whatever the flag says.
     */
    function useCleartextVerifier() external view returns (bool);

    /// @notice Forces the rebuilt path for a cleartext stack (or lifts the force), overriding the
    ///         environment. For tests of the rule: `vm.setEnv` mutates the process and races the suites
    ///         forge runs in parallel (rules.md 7.5).
    function setForceProductionPath(bool force) external;

    /// @notice The stack this test is pointed at: the local cleartext one by default, the fork's after a
    ///         fork operation on this handle. All zero before `StdFhevm`'s constructor ran.
    function protocol() external view returns (FhevmProtocolConfig memory);

    /// @notice Points the test at a stack, and the replay at that stack's executor. The local run calls it
    ///         with the local addresses; a fork operation calls it with the fork's; a test may call it to
    ///         declare a stack the chain table does not know.
    function setProtocol(address acl, address executor, address kmsVerifier) external;

    // -- Forks ----------------------------------------------------------------------------------------------

    /**
     * @notice `vm.createSelectFork`, the FHEVM way, with the stack named: pending FHE events are drained,
     *         the fork is created and selected, and `chain` becomes the current stack — version checked,
     *         signer sets swapped, replay pointed. Everything a test does afterwards is against it.
     *
     *          fhevm.createSelectFork(getFhevmChain("testnet", "sepolia"), 11_743_572);
     */
    function createSelectFork(StdFhevmChains.FhevmChain calldata chain) external returns (uint256 forkId);
    function createSelectFork(StdFhevmChains.FhevmChain calldata chain, uint256 blockNumber)
        external
        returns (uint256 forkId);

    /**
     * @notice `vm.createSelectFork` with only a URL: drained and switched like the form above, but the
     *         stack is RESOLVED at the first SDK entry — from the coprocessor config of the dApp that entry
     *         names (`encrypt…(…, contractAddress, …)`, `decrypt(…, contractAddress, …)`), else from the
     *         chain table by `block.chainid`. A chain the table lists under several groups (Sepolia:
     *         `testnet` and `devnet`) cannot be resolved without a dApp and is refused by name; use the
     *         chain form there. Until that entry, `protocol()` is EMPTY: never the stack of wherever the
     *         test came from.
     */
    function createSelectFork(string calldata urlOrAlias) external returns (uint256 forkId);
    function createSelectFork(string calldata urlOrAlias, uint256 blockNumber) external returns (uint256 forkId);

    /**
     * @notice `vm.createFork`, the FHEVM way: creates WITHOUT selecting, so nothing is drained and nothing is
     *         prepared — the chain form remembers the stack, and `selectFork(id)` prepares and points when
     *         the fork is first entered. The URL forms leave the stack to be resolved then.
     */
    function createFork(StdFhevmChains.FhevmChain calldata chain) external returns (uint256 forkId);
    function createFork(StdFhevmChains.FhevmChain calldata chain, uint256 blockNumber) external returns (uint256 forkId);
    function createFork(string calldata urlOrAlias) external returns (uint256 forkId);
    function createFork(string calldata urlOrAlias, uint256 blockNumber) external returns (uint256 forkId);

    /**
     * @notice `vm.rollFork`, the FHEVM way: drain the FHE events first, roll, then treat the fork as a FRESH
     *         fork at that block — because that is what a roll is. Forge resets the fork's local state, and
     *         with it this SDK's signer swap AND the fork's replay (a contract created inside the fork, not
     *         persistent): the fork is prepared again and gets a new processor. Handles announced before the
     *         roll are unknown to it, as they are to any fresh fork; `forkUnknown` states them again.
     * @dev The two-argument form rolls another fork; that fork is prepared again when next selected.
     */
    function rollFork(uint256 blockNumber) external;
    function rollFork(uint256 forkId, uint256 blockNumber) external;

    /**
     * @notice Points the ACTIVE execution context at a described stack, with the full preparation a fork
     *         gets: version gate, signer sets swapped (unless the stack is cleartext), replay following.
     *         `createSelectFork(chain, …)` is "fork, then this". In memory it is how a non-cleartext stack a
     *         test deployed itself would be adopted: deploy it, describe it, `useStack(desc)` — nothing else
     *         moves. Not wired to any deploy yet.
     */
    function useStack(StdFhevmChains.FhevmChain calldata chain) external;

    /// @notice `vm.activeFork()`, forwarded — here so a fork test never needs `vm` for the fork family.
    function activeFork() external view returns (uint256 forkId);

    /**
     * @notice `vm.getRecordedLogs()`, the FHEVM way: drains the buffer ONCE, feeds the FHE events to the
     *         replay, and hands back everything — the dApp's events and the FHE ones alike.
     * @dev WHY THERE IS A REPLACEMENT AT ALL. The recorded-logs buffer is one per test and reading it
     *      EMPTIES it, for everyone. A test that calls `vm.getRecordedLogs()` to inspect its own events
     *      swallows every FHE event with them, and the next decryption fails on a handle the replay never
     *      saw. The reverse is just as bad and quieter: decrypt first, and the test's own log assertions
     *      run against an empty array. This drains once and serves both readers. For asserting on a dApp's
     *      own events, `vm.expectEmit` needs no such care and is the better tool.
     */
    function getRecordedLogs() external returns (Vm.Log[] memory logs);

    /**
     * @notice `vm.selectFork`, the FHEVM way: the FHE events emitted on the fork being LEFT are replayed
     *         into the store first, then the switch happens, then the protocol is pointed at the selected
     *         fork's stack. Use this, never `vm.selectFork`, in a test that decrypts.
     * @dev WHY THE DRAIN MUST COME FIRST. The recorded-log buffer is one per test across forks, and a
     *      store answers a handle it never saw by asking its upstream ON THE ACTIVE FORK — so fork A's
     *      events replayed after moving to fork B would look A's operands up on B's chain.
     */
    function selectFork(uint256 forkId) external;

    /// @notice Names the stack of the ACTIVE fork `forkId`, entered with a URL only; prepares and points at
    ///         it as `createSelectFork(chain, …)` would have. `StdFhevmFork` calls this with what it
    ///         resolved; a test may call it to name a stack the resolution could not.
    function registerFork(uint256 forkId, StdFhevmChains.FhevmChain calldata chain) external;

    /// @notice Whether the test executes on a fork — created by `fhevm.createSelectFork`, or by forge itself
    ///         under `forge test --fork-url` — rather than on the in-memory chain. The question a test asks;
    ///         `currentForkId()` is for when the id itself is needed.
    function isForked() external view returns (bool);

    /// @notice The active fork's id, or `NO_FORK` when the test executes on the in-memory chain
    ///         (`vm.activeFork()` reverts there; this does not).
    function currentForkId() external view returns (uint256);

    /// @notice The active fork, checked against the one this handle last switched to. Reverts with
    ///         a rendered FORK DRIFT message when they differ: the test forked or switched through `vm`, not `fhevm`.
    function activeForkChecked() external view returns (uint256);

    /// @notice Whether `forkId` has a stack named (chain form, `registerFork`, or a resolved URL-only fork).
    function isForkRegistered(uint256 forkId) external view returns (bool);

    /**
     * @notice Whether the RUN configured an RPC URL for `chainAlias` — an `[rpc_endpoints]` entry in
     *         `foundry.toml`, or the `<ALIAS>_RPC_URL` environment variable — as opposed to the built-in
     *         default `getFhevmChain` would otherwise fall back to.
     * @dev THE OPT-IN A FORK TEST CHECKS before forking (rules.md 7.3): the built-in defaults are shared
     *      public endpoints, good for a quick experiment and the first to answer 429 to a suite, so a test
     *      that forks only when asked treats "configured" as the asking, either forge-native way. The same
     *      two places, in the same order, that `getFhevmChain` and forge-std's `getChain` read.
     */
    function hasRpcUrlFor(string calldata chainAlias) external view returns (bool);

    /**
     * @notice THE ONE CALL EVERY SDK ENTRY MAKES FIRST. The drift check (reverts loudly on a fork entered
     *         through `vm`), then — for a fork entered with a URL only — the resolution of its stack: from
     *         the dApp the entry names (its coprocessor config holds the ACL, which picks the chain-table
     *         entry), else from the chain table alone when `block.chainid` is listed under exactly one
     *         group; then preparation and pointing, as `createSelectFork(chain, …)` does. In memory, and on
     *         any fork with a stack, one `activeFork()` and nothing else.
     * @param dAppOrZero the contract the entry targets, or zero.
     */
    function ensureForkPrepared(address dAppOrZero) external;

    /// @notice The chain table's entries, for resolution. Pushed by `StdFhevm` at construction and after
    ///         every `setFhevmChain`, so the test's table stays the source of truth and this is its copy.
    function setChainTable(StdFhevmChains.FhevmChain[] calldata chains) external;

    /// @notice Replays everything emitted since the last replay into the active context's store. Every
    ///         value-reading entry calls it before answering (rules.md §2.9); a test never needs to.
    function drainFheEvents() external;

    // -- The active context's replay, for the cheats -------------------------------------------------------

    /// @notice States a handle's cleartext in the active context's store (`forkUnknown`).
    function seedCleartext(bytes32 handle, uint256 value) external;
    /// @notice Every unknown handle in the active context reads as `value`, clamped (`forkUnknownDefault`).
    function useFixedUnknownHandles(uint256 value) external;
    /// @notice Every unknown handle in the active context reads from its hash (`forkUnknownDeterministic`).
    function useDeterministicUnknownHandles() external;

    // -- anvil ----------------------------------------------------------------------------------------------

    /// @notice Whether a stack the SDK deploys on an anvil fork is also written onto the node. Default true.
    ///         Off, the stack exists in the fork only and the node is left untouched.
    function setAnvilMirror(bool enabled) external;
    function anvilMirror() external view returns (bool);
}

/// @dev The handle. Declared here so one import brings the constant and its interface. Lowercase like
///      forge-std's `vm`, on purpose: it is read as a handle, not as a constant.
// forge-lint: disable-next-line(screaming-snake-case-const)
IFhevmVm constant fhevm = IFhevmVm(FHEVM_VM_ADDRESS);

/// The runtime behind `fhevm`. Never deployed with `new`: `StdFhevmBase`'s constructor etches
/// `type(FhevmVm).runtimeCode` at `FHEVM_VM_ADDRESS`.
contract FhevmVm is IFhevmVm, ForgeFhevmDeploy {
    bool private _initialized;
    FhevmProtocolConfig private _protocol;
    /// @dev Tri-state override of `FHEVM_FORCE_FORK_STACK`: unset → the environment decides.
    bool private _forceOverrideSet;
    bool private _forceOverride;
    /// @dev The replay of each execution context, keyed by fork id (`NO_FORK` for the in-memory chain).
    mapping(uint256 contextId => address) private _processorOf;
    /// @dev A copy of the test's chain table, for resolving a URL-only fork's stack. The table itself stays
    ///      the test's (`StdFhevmChains`): it is what resolves RPC URLs and what a test overrides.
    StdFhevmChains.FhevmChain[] private _chainTable;
    bool private _anvilMirrorOff; // inverted so the zero value is the default: mirror

    mapping(uint256 forkId => StdFhevmChains.FhevmChain) private _forkChain;
    mapping(uint256 forkId => bool) private _forkRegistered;
    mapping(uint256 forkId => bool) private _forkPrepared;
    /// @dev The fork this handle last switched to — the only fork that is not drift.
    uint256 private _lastSwitchedForkId;

    // -- Plumbing ---------------------------------------------------------------------------------------

    function initialized() external view returns (bool) {
        return _initialized;
    }

    function initialize() external {
        if (_initialized) return;
        _initialized = true;
        // THE CONTEXT THIS HANDLE IS BORN IN IS LEGITIMATE, whatever it is: `NO_FORK` in a plain run, fork 0
        // under `forge test --fork-url`, where forge starts every test on a fork before any constructor
        // runs. Taking it as the baseline is what keeps the drift check honest in both modes.
        _lastSwitchedForkId = _activeFork();
        // RECORDING IS ARMED ONCE, HERE, before any dApp call can happen. The buffer is one per test across
        // every context; each drain empties it into the ACTIVE context's processor. No processor arms it
        // again: re-arming could drop what was emitted between a switch and the next processor's birth.
        Vm(FORGE_VM_ADDRESS).recordLogs();
    }

    /// @dev Transient, not storage: a cold `SSTORE` is ~20k and would itself be charged to the test if the
    ///      pause ever came after it; `TSTORE` is ~100 and clears with the transaction, i.e. the test.
    bytes32 private constant UNMETERED_DEPTH_SLOT = keccak256("fhevm.FhevmVm.unmeteredDepth");

    function enterUnmetered() external {
        bytes32 slot = UNMETERED_DEPTH_SLOT;
        assembly ("memory-safe") {
            tstore(slot, add(tload(slot), 1))
        }
    }

    function exitUnmetered() external returns (bool wasOutermost) {
        bytes32 slot = UNMETERED_DEPTH_SLOT;
        uint256 remaining;
        assembly ("memory-safe") {
            remaining := sub(tload(slot), 1)
            tstore(slot, remaining)
        }
        return remaining == 0;
    }

    function eventProcessor() external view returns (address) {
        return _processorOf[_activeFork()];
    }

    // -- The current stack --------------------------------------------------------------------------------

    function protocol() external view returns (FhevmProtocolConfig memory) {
        return _protocol;
    }

    function useCleartextVerifier() external view returns (bool) {
        return !_forceProductionPath() && LibCleartextProbe.isCleartext(_protocol.executor);
    }

    function setForceProductionPath(bool force) external {
        _forceOverrideSet = true;
        _forceOverride = force;
    }

    function _forceProductionPath() private view returns (bool) {
        if (_forceOverrideSet) return _forceOverride;
        return Vm(FORGE_VM_ADDRESS).envOr("FHEVM_FORCE_FORK_STACK", false);
    }

    function setProtocol(address acl, address executor, address kmsVerifier) external {
        _setProtocol(acl, executor, kmsVerifier);
    }

    /// @dev Points, and makes the ACTIVE context's replay follow: created here if the context has none —
    ///      inside the context, cheat-enabled, NOT persistent — with this stack's executor registered and
    ///      selected. The processor writes each event into its emitter's store but reads from ONE selected
    ///      store, so pointing at a stack and reading another's store would be a silent mismatch. An
    ///      executor of zero (a cleared stack, see `_enterUnresolvedFork`) points nothing.
    function _setProtocol(address acl, address executor, address kmsVerifier) private {
        _protocol = FhevmProtocolConfig({acl: acl, executor: executor, kmsVerifier: kmsVerifier});
        if (executor == address(0)) return;

        uint256 context = _activeFork();
        address processor = _processorOf[context];
        if (processor == address(0)) {
            processor = address(new ForgeFhevmEventProcessor());
            // Created by an etched account, not by the test: cheat access does not follow, grant it.
            Vm(FORGE_VM_ADDRESS).allowCheatcodes(processor);
            _processorOf[context] = processor;
        }
        ForgeFhevmEventProcessor replay = ForgeFhevmEventProcessor(processor);
        if (!replay.isExecutor(executor)) replay.addExecutor(executor);
        replay.selectExecutor(executor);
    }

    // -- Forks ----------------------------------------------------------------------------------------------

    function createSelectFork(StdFhevmChains.FhevmChain calldata chain) external returns (uint256 forkId) {
        _requireRpcUrl(chain);
        _drainFheEvents();
        forkId = Vm(FORGE_VM_ADDRESS).createSelectFork(chain.rpcUrl);
        _enterFork(forkId, chain);
    }

    function createSelectFork(StdFhevmChains.FhevmChain calldata chain, uint256 blockNumber)
        external
        returns (uint256 forkId)
    {
        _requireRpcUrl(chain);
        _drainFheEvents();
        forkId = Vm(FORGE_VM_ADDRESS).createSelectFork(chain.rpcUrl, blockNumber);
        _enterFork(forkId, chain);
    }

    function createSelectFork(string calldata urlOrAlias) external returns (uint256 forkId) {
        _drainFheEvents();
        forkId = Vm(FORGE_VM_ADDRESS).createSelectFork(urlOrAlias);
        _enterUnresolvedFork(forkId);
    }

    function createSelectFork(string calldata urlOrAlias, uint256 blockNumber) external returns (uint256 forkId) {
        _drainFheEvents();
        forkId = Vm(FORGE_VM_ADDRESS).createSelectFork(urlOrAlias, blockNumber);
        _enterUnresolvedFork(forkId);
    }

    function createFork(StdFhevmChains.FhevmChain calldata chain) external returns (uint256 forkId) {
        _requireRpcUrl(chain);
        forkId = Vm(FORGE_VM_ADDRESS).createFork(chain.rpcUrl);
        _remember(forkId, chain);
    }

    function createFork(StdFhevmChains.FhevmChain calldata chain, uint256 blockNumber)
        external
        returns (uint256 forkId)
    {
        _requireRpcUrl(chain);
        forkId = Vm(FORGE_VM_ADDRESS).createFork(chain.rpcUrl, blockNumber);
        _remember(forkId, chain);
    }

    function createFork(string calldata urlOrAlias) external returns (uint256 forkId) {
        return Vm(FORGE_VM_ADDRESS).createFork(urlOrAlias);
    }

    function createFork(string calldata urlOrAlias, uint256 blockNumber) external returns (uint256 forkId) {
        return Vm(FORGE_VM_ADDRESS).createFork(urlOrAlias, blockNumber);
    }

    function rollFork(uint256 blockNumber) external {
        _drainFheEvents();
        Vm(FORGE_VM_ADDRESS).rollFork(blockNumber);
        _forgetForkState(_activeFork());
        if (_forkRegistered[_activeFork()]) _pointAt(_activeFork());
    }

    function rollFork(uint256 forkId, uint256 blockNumber) external {
        _drainFheEvents();
        Vm(FORGE_VM_ADDRESS).rollFork(forkId, blockNumber);
        _forgetForkState(forkId);
        if (forkId == _activeFork() && _forkRegistered[forkId]) _pointAt(forkId);
    }

    /// @dev The roll reset the fork's local state: our signer swap is gone, and so is the fork's processor
    ///      (created inside the fork, never persistent). Forget both, so the next contact prepares afresh.
    function _forgetForkState(uint256 forkId) private {
        _forkPrepared[forkId] = false;
        _processorOf[forkId] = address(0);
    }

    function useStack(StdFhevmChains.FhevmChain calldata chain) external {
        uint256 context = _activeFork();
        _remember(context, chain);
        if (context != NO_FORK) _lastSwitchedForkId = context;
        _pointAt(context);
    }

    function activeFork() external view returns (uint256 forkId) {
        return Vm(FORGE_VM_ADDRESS).activeFork();
    }

    function getRecordedLogs() external returns (Vm.Log[] memory logs) {
        logs = Vm(FORGE_VM_ADDRESS).getRecordedLogs();
        address processor = _processorOf[_activeFork()];
        if (processor == address(0)) return logs;

        // Same three fields in the same order, but nominally distinct types: the payload declares its own
        // `Log` so it never depends on forge-std.
        IForgeVmLogs.Log[] memory forwarded = new IForgeVmLogs.Log[](logs.length);
        for (uint256 i = 0; i < logs.length; i++) {
            forwarded[i] = IForgeVmLogs.Log({topics: logs[i].topics, data: logs[i].data, emitter: logs[i].emitter});
        }
        ForgeFhevmEventProcessor(processor).processFheEvents(forwarded);
    }

    function selectFork(uint256 forkId) external {
        _drainFheEvents();
        Vm(FORGE_VM_ADDRESS).selectFork(forkId);
        if (_forkRegistered[forkId]) {
            _lastSwitchedForkId = forkId;
            _pointAt(forkId);
        } else {
            _enterUnresolvedFork(forkId);
        }
    }

    /// @dev The active fork changed and its stack is not known yet: the current stack is CLEARED, never
    ///      left pointing at wherever the test came from. The first SDK entry resolves and points.
    function _enterUnresolvedFork(uint256 forkId) private {
        _lastSwitchedForkId = forkId;
        _protocol = FhevmProtocolConfig({acl: address(0), executor: address(0), kmsVerifier: address(0)});
    }

    function registerFork(uint256 forkId, StdFhevmChains.FhevmChain calldata chain) external {
        uint256 active = _activeFork();
        if (active != forkId) revert(LibFhevmFail.registeredForkNotActive(forkId, active));
        _enterFork(forkId, chain);
    }

    function isForked() external view returns (bool) {
        return _activeFork() != NO_FORK;
    }

    function currentForkId() external view returns (uint256) {
        return _activeFork();
    }

    function activeForkChecked() external view returns (uint256 active) {
        active = _activeFork();
        if (active != _lastSwitchedForkId) revert(LibFhevmFail.forkDrift(active, _lastSwitchedForkId));
    }

    function isForkRegistered(uint256 forkId) external view returns (bool) {
        return _forkRegistered[forkId];
    }

    function hasRpcUrlFor(string calldata chainAlias) external view returns (bool) {
        try Vm(FORGE_VM_ADDRESS).rpcUrl(chainAlias) returns (string memory configured) {
            if (bytes(configured).length != 0) return true;
        } catch {}
        string memory envName = string.concat(_toUpper(chainAlias), "_RPC_URL");
        return bytes(Vm(FORGE_VM_ADDRESS).envOr(envName, string(""))).length != 0;
    }

    function _toUpper(string memory str) private pure returns (string memory) {
        bytes memory b = bytes(str);
        for (uint256 i = 0; i < b.length; i++) {
            if (b[i] >= 0x61 && b[i] <= 0x7A) b[i] = bytes1(uint8(b[i]) - 32);
        }
        return string(b);
    }

    function ensureForkPrepared(address dAppOrZero) external {
        uint256 active = _activeFork();
        if (active != _lastSwitchedForkId) revert(LibFhevmFail.forkDrift(active, _lastSwitchedForkId));
        if (active == NO_FORK || _forkRegistered[active]) return;
        _enterFork(active, _resolveStack(dAppOrZero));
    }

    /// @dev Which table entry the active chain is. The dApp's ACL first — it is the address the dApp
    ///      itself calls, so it cannot name the wrong stack — then the table, only if it is unambiguous.
    function _resolveStack(address dAppOrZero) private view returns (StdFhevmChains.FhevmChain memory) {
        StdFhevmChains.FhevmChain[] memory candidates = _candidatesFor(block.chainid);
        if (candidates.length == 0) revert(LibFhevmFail.unknownChain(block.chainid));

        if (dAppOrZero != address(0) && LibForgeFhevmConfig.hasCoprocessorConfig(dAppOrZero)) {
            address acl = LibForgeFhevmConfig.getCoprocessorConfig(dAppOrZero).ACLAddress;
            for (uint256 i = 0; i < candidates.length; i++) {
                if (candidates[i].acl == acl) return candidates[i];
            }
            // A dApp configured for a stack the table does not know: fall through to the table rule.
        }

        if (candidates.length == 1) return candidates[0];
        string[] memory groups = new string[](candidates.length);
        for (uint256 i = 0; i < candidates.length; i++) {
            groups[i] = candidates[i].fhevmGroup;
        }
        revert(LibFhevmFail.ambiguousGroup(block.chainid, groups));
    }

    function _candidatesFor(uint256 chainId) private view returns (StdFhevmChains.FhevmChain[] memory matching) {
        uint256 n;
        for (uint256 i = 0; i < _chainTable.length; i++) {
            if (_chainTable[i].chainId == chainId) n++;
        }
        matching = new StdFhevmChains.FhevmChain[](n);
        uint256 j;
        for (uint256 i = 0; i < _chainTable.length; i++) {
            if (_chainTable[i].chainId == chainId) matching[j++] = _chainTable[i];
        }
    }

    function setChainTable(StdFhevmChains.FhevmChain[] calldata chains) external {
        delete _chainTable;
        for (uint256 i = 0; i < chains.length; i++) {
            _chainTable.push(chains[i]);
        }
    }

    function drainFheEvents() external {
        _drainFheEvents();
    }

    // -- The active context's replay, for the cheats -------------------------------------------------------

    function seedCleartext(bytes32 handle, uint256 value) external {
        _activeProcessor().seedCleartext(handle, value);
    }

    function useFixedUnknownHandles(uint256 value) external {
        _activeProcessor().useFixedUnknownHandles(value);
    }

    function useDeterministicUnknownHandles() external {
        _activeProcessor().useDeterministicUnknownHandles();
    }

    /// @dev The active context's processor, or the NO CURRENT STACK box: no stack, no replay.
    function _activeProcessor() private view returns (ForgeFhevmEventProcessor) {
        address processor = _processorOf[_activeFork()];
        if (processor == address(0)) revert(LibFhevmFail.noCurrentStack());
        return ForgeFhevmEventProcessor(processor);
    }

    function setAnvilMirror(bool enabled) external {
        _anvilMirrorOff = !enabled;
    }

    function anvilMirror() external view returns (bool) {
        return !_anvilMirrorOff;
    }

    /// @dev The active fork `forkId` now has a named stack: remember it, prepare it once, point at it.
    function _enterFork(uint256 forkId, StdFhevmChains.FhevmChain memory chain) private {
        _remember(forkId, chain);
        _lastSwitchedForkId = forkId;
        _pointAt(forkId);
    }

    /// @dev Names `forkId`'s stack without touching it — for a fork that is not active (`createFork`).
    ///      A re-registration names a (possibly different) stack: prepare again on next contact.
    function _remember(uint256 forkId, StdFhevmChains.FhevmChain memory chain) private {
        _forkChain[forkId] = chain;
        _forkRegistered[forkId] = true;
        _forkPrepared[forkId] = false;
    }

    /// @dev Prepare on first contact, point on every contact. Runs with `forkId` ACTIVE.
    function _pointAt(uint256 forkId) private {
        StdFhevmChains.FhevmChain memory chain = _forkChain[forkId];
        if (!_forkPrepared[forkId]) {
            // Nothing at the executor: an anvil node the SDK can put the stack on, or a mistake it names.
            if (chain.fhevmExecutor.code.length == 0) _provisionLocalStack(chain);

            if (!LibCleartextProbe.isCleartext(chain.fhevmExecutor)) {
                _requireSupportedVersions(chain);
                // The fork's verifiers are registered against signers nobody here holds a key for;
                // re-register the cleartext ones, so the input proofs and decryption proofs built here are
                // accepted. Fork state persists across switches, so once per fork. The pranks are this
                // contract's: it has cheatcode access (`allowCheatcodes`) precisely for this.
                LibForgeFhevmContexts.defineCleartextContexts(chain.inputVerifier, chain.protocolConfig, chain.acl);
            }
            // A cleartext stack is this package's own code: no version to check, and it registers the
            // cleartext signers itself.
            _forkPrepared[forkId] = true;
        }
        _setProtocol(chain.acl, chain.fhevmExecutor, chain.kmsVerifier);
    }

    // -- anvil ----------------------------------------------------------------------------------------------

    /// @dev The executor has no code. On anvil, deploy the canonical local stack into the fork — and onto
    ///      the node, unless told not to. Anywhere else, say so: the SDK does not put stacks on chains it
    ///      does not own.
    function _provisionLocalStack(StdFhevmChains.FhevmChain memory chain) private {
        bool canonical = chain.acl == ACL_ADDRESS && chain.fhevmExecutor == FHEVM_EXECUTOR_ADDRESS;
        if (!canonical || !_isAnvilNode()) {
            revert(LibFhevmFail.stackMissing(chain.fhevmGroup, chain.chainAlias, chain.fhevmExecutor));
        }
        uint64 nonce = fvm.getNonce(DEPLOYER_ADDRESS);
        if (nonce != DEPLOYER_START_NONCE) {
            revert(LibFhevmFail.localStackCannotDeploy(DEPLOYER_ADDRESS, DEPLOYER_START_NONCE, nonce));
        }

        Vm forgeVm = Vm(FORGE_VM_ADDRESS);
        forgeVm.startStateDiffRecording();
        deployLocalFhevm(); // the local run's deploy, verbatim: same deployer, same sequence, same addresses
        VmSafe.AccountAccess[] memory diff = forgeVm.stopAndReturnStateDiff();
        if (!_anvilMirrorOff) _mirrorOntoNode(diff);

        // A FRESH ANVIL IS AT BLOCK 0, and the executor derives every handle from `blockhash(block.number - 1)`:
        // the first FHE operation on it panics with an arithmetic underflow, far from here. Forge's own
        // in-memory chain starts at block 1 for the same reason. So the fork moves to block 1 now, and the
        // node is asked to mine one block too (in `_mirrorOntoNode`), so a client that is not this test
        // does not hit the same wall.
        if (block.number == 0) forgeVm.roll(1);
    }

    /// @dev Does the node behind the active fork answer anvil's own RPC namespace?
    function _isAnvilNode() private returns (bool ok) {
        (ok,) = _rpcRaw("anvil_nodeInfo", "[]");
    }

    /// @dev Everything the deploy created or wrote, pushed onto the node with anvil's setters: byte-identical
    ///      to what the fork computed, no deployer key, no gas. Storage writes are replayed in order, so the
    ///      last write to a slot wins as it did in the fork. `PauserSet` was etched, not created, so the
    ///      diff does not list it; it is set explicitly. The deployer's nonce is set last, to what it is in
    ///      the fork, so a later deploy on this node is refused the same way a reused local EVM is.
    function _mirrorOntoNode(VmSafe.AccountAccess[] memory diff) private {
        for (uint256 i = 0; i < diff.length; i++) {
            VmSafe.AccountAccess memory access = diff[i];
            if (access.reverted) continue;
            if (access.kind == VmSafe.AccountAccessKind.Create && access.deployedCode.length != 0) {
                _anvilSetCode(access.account, access.deployedCode);
                _anvilSetNonce(access.account, 1);
            }
            for (uint256 j = 0; j < access.storageAccesses.length; j++) {
                VmSafe.StorageAccess memory write = access.storageAccesses[j];
                if (!write.isWrite || write.reverted) continue;
                _anvilRpc(
                    "anvil_setStorageAt",
                    string.concat(
                        "[\"", _hex(write.account), "\",\"", _hex(write.slot), "\",\"", _hex(write.newValue), "\"]"
                    )
                );
            }
        }
        _anvilSetCode(PAUSER_SET_ADDRESS, PAUSER_SET_RUNTIME_CODE);
        _anvilSetNonce(DEPLOYER_ADDRESS, fvm.getNonce(DEPLOYER_ADDRESS));
        // Off block 0, for the executor's `blockhash(block.number - 1)` (see `_provisionLocalStack`).
        if (block.number == 0) _anvilRpc("anvil_mine", "[\"0x1\"]");

        // READ BACK: the node must now hold code at the ACL, or the mirror did not take, and say so.
        // (`eth_getCode` answers a hex string, which the cheat encodes as ABI `bytes`: decodable.)
        (bool ok, bytes memory ret) = _rpcRaw("eth_getCode", string.concat("[\"", _hex(ACL_ADDRESS), "\",\"latest\"]"));
        if (!ok || ret.length < 64 || abi.decode(ret, (bytes)).length == 0) {
            revert(LibFhevmFail.anvilMirrorFailed(ACL_ADDRESS));
        }
    }

    function _anvilSetCode(address account, bytes memory code) private {
        _anvilRpc(
            "anvil_setCode", string.concat("[\"", _hex(account), "\",\"", Vm(FORGE_VM_ADDRESS).toString(code), "\"]")
        );
    }

    function _anvilSetNonce(address account, uint64 nonce) private {
        _anvilRpc("anvil_setNonce", string.concat("[\"", _hex(account), "\",\"", _hex(bytes32(uint256(nonce))), "\"]"));
    }

    /// @dev A setter's success is the call succeeding; its JSON result is not looked at. The cheat encodes a
    ///      bare `true` (what `anvil_setStorageAt` answers) as one 32-byte word, which is not a valid ABI
    ///      `bytes` — so a typed `vm.rpc` call REVERTS on decoding a result that meant success, and Solidity
    ///      cannot `catch` a return-data decoding failure. Hence the raw call, return data ignored.
    function _anvilRpc(string memory method, string memory params) private {
        (bool ok,) = _rpcRaw(method, params);
        if (!ok) revert(LibFhevmFail.anvilMirrorFailed(ACL_ADDRESS));
    }

    /// @dev `vm.rpc(method, params)` as a low-level call: `ok` is whether the node answered, `ret` is the
    ///      cheat's encoding of the JSON result, to be decoded by a caller that knows its shape.
    function _rpcRaw(string memory method, string memory params) private returns (bool ok, bytes memory ret) {
        (ok, ret) = FORGE_VM_ADDRESS.call(abi.encodeWithSignature("rpc(string,string)", method, params));
    }

    function _hex(address a) private pure returns (string memory) {
        return Vm(FORGE_VM_ADDRESS).toString(a);
    }

    function _hex(bytes32 b) private pure returns (string memory) {
        return Vm(FORGE_VM_ADDRESS).toString(b);
    }

    /// @dev Five `staticcall`s, once per fork. Skipped for a cleartext stack: that is this package's own
    ///      code, at the vendored version by construction.
    function _requireSupportedVersions(StdFhevmChains.FhevmChain memory chain) private view {
        if (LibCleartextProbe.isCleartext(chain.fhevmExecutor)) return;
        _requireVersion(chain, "ACL", chain.acl, LocalHostVersions.ACL);
        _requireVersion(chain, "FHEVMExecutor", chain.fhevmExecutor, LocalHostVersions.FHEVM_EXECUTOR);
        _requireVersion(chain, "InputVerifier", chain.inputVerifier, LocalHostVersions.INPUT_VERIFIER);
        _requireVersion(chain, "KMSVerifier", chain.kmsVerifier, LocalHostVersions.KMS_VERIFIER);
        _requireVersion(chain, "ProtocolConfig", chain.protocolConfig, LocalHostVersions.PROTOCOL_CONFIG);
    }

    function _requireVersion(
        StdFhevmChains.FhevmChain memory chain,
        string memory contractName,
        address target,
        string memory expected
    ) private view {
        (bool ok, bytes memory ret) = target.staticcall(abi.encodeWithSignature("getVersion()"));
        string memory actual = (ok && ret.length >= 64) ? abi.decode(ret, (string)) : "";
        if (keccak256(bytes(actual)) != keccak256(bytes(expected))) {
            revert(LibFhevmFail.versionMismatch(chain.fhevmGroup, chain.chainAlias, contractName, expected, actual));
        }
    }

    function _requireRpcUrl(StdFhevmChains.FhevmChain calldata chain) private pure {
        if (bytes(chain.rpcUrl).length == 0) revert(LibFhevmFail.noRpcUrl(chain.fhevmGroup, chain.chainAlias));
    }

    function _activeFork() private view returns (uint256) {
        try Vm(FORGE_VM_ADDRESS).activeFork() returns (uint256 forkId) {
            return forkId;
        } catch {
            return NO_FORK;
        }
    }

    /// @dev Everything emitted since the last replay, into the ACTIVE context's store, while the context
    ///      that emitted it is still the active one. A no-op when that context has no processor yet (a
    ///      URL-only fork before its first entry): nothing of its own is pending that a later context
    ///      would want.
    function _drainFheEvents() private {
        address processor = _processorOf[_activeFork()];
        if (processor != address(0)) ForgeFhevmEventProcessor(processor).processFheEvents();
    }
}
