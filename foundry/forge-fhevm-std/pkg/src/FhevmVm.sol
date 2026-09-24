// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Vm} from "forge-std/Vm.sol";

import {FORGE_VM_ADDRESS} from "./_host/IForgeVm.sol";
import {ForgeFhevmEventProcessor, IForgeVmLogs} from "./_host/ForgeFhevmEventProcessor.sol";
import {LibForgeFhevmAnvil} from "./_host/LibForgeFhevmAnvil.sol";
import {LibForgeFhevmStack} from "./_host/LibForgeFhevmStack.sol";
import {LibForgeFhevmConfig} from "./_host/LibForgeFhevmConfig.sol";
import {EncryptStack, LibForgeFhevmEncrypt} from "./_host/LibForgeFhevmEncrypt.sol";
import {LibForgeFhevmPublicDecrypt} from "./_host/LibForgeFhevmPublicDecrypt.sol";
import {IPlaintexts} from "./_host/shared/interfaces/IPlaintexts.sol";
import {LibKmsVerifier, UserDecryptRequestV1} from "./_host/shared/LibKmsVerifier.sol";
import {LibForgeFhevmHCU} from "./_host/LibForgeFhevmHCU.sol";
import {ICleartextFHEVMExecutor} from "./_host/_internal/interfaces/ICleartextFHEVMExecutor.sol";
import {LibFhevmHandle} from "./_host/shared/LibFhevmHandle.sol";
import {LibCleartextProbe} from "./_host/shared/LibCleartextProbe.sol";
import {LibFhevmVersion} from "./LibFhevmVersion.sol";
import {
    ACL_ADDRESS,
    FHEVM_EXECUTOR_ADDRESS,
    DEPLOYER_ADDRESS,
    DEPLOYER_START_NONCE
} from "./_host/_internal/LocalHostAddresses.sol";
import {FHEVM_LOCAL_GROUP, StdFhevmChains} from "./StdFhevmChains.sol";
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
 * @notice The stack this test is pointed at, RESOLVED: the three declared addresses plus everything the
 *         kernel discovers about them, in the one order that is right (prepare, drain, then read).
 *
 * @dev The kernel's own vocabulary, filled by its one resolver and fed to every kernel operation. Nothing
 *      here is configured: `inputVerifier` is read off the executor, `isCleartext` is asked of it, and
 *      `plaintexts` is WHATEVER IMPLEMENTS `IPlaintexts` for this stack — the executor itself when it is a
 *      cleartext one, else the active context's replay, or zero when neither exists. `cleartextVerifier` is
 *      `isCleartext` minus the `FHEVM_FORCE_FORK_STACK` override (rules.md 3.1).
 */
struct FhevmStack {
    address acl;
    address executor;
    address kmsVerifier;
    address inputVerifier;
    address plaintexts;
    bool isCleartext;
    bool cleartextVerifier;
}

/**
 * @notice One reading of the HCU meter: what a transaction spent, the way `Vm.Gas` reports gas.
 *
 * @dev `transaction` is the total the last metered transaction cost; `maxHandle` is the deepest single
 *      handle dependency chain inside it, which is the number the DEPTH cap is applied to — so a test
 *      that trips `HCUTransactionDepthLimitExceeded` reads `maxHandle` to see by how much.
 */
// `HCU` stays upper-case, as it is in every other identifier here; the lint wants `Fhevm Hcu Meter`.
// forge-lint: disable-next-line(pascal-case-struct)
struct FhevmHCUMeter {
    uint256 transaction;
    uint256 maxHandle;
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
 * @dev A CHAIN WITH NO FHEVM PROTOCOL (rules.md 2.17). `fhevm.createSelectFork(cleartextChain("arbitrum"))`
 *      forks a chain the table lists under no network group and, finding no code at the canonical local
 *      executor, deploys the cleartext stack INTO THE FORK on first contact — like anvil, minus the mirror,
 *      since there is no node the SDK owns. The fork keeps its real chain id. A chain that HAS the protocol
 *      is refused (`LIVE FHEVM STACK ON THIS CHAIN`): the mock never shadows a live stack. The production
 *      dApp's upstream config knows no such chain, which is what the `fhevm-debug` profile and
 *      `pkg/src/config/DebugZamaConfig.sol` are for (rules.md 2.18).
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
 *      | `recordLogs()`                              | IGNORED while a replay owns the buffer (armed already, from `initialize()`); forwarded where none does — never `vm.recordLogs()` (rules.md §2.3) |
 *      | `getRecordedLogs()`                         | `vm.getRecordedLogs()`, with the FHE events fed to the replay first — USE THIS, never `vm.getRecordedLogs()` (rules.md §2.3, §7.4) |
 *      | `snapshotState()`, `revertToState(id)`      | `vm.snapshotState` / `vm.revertToState`, with the replay and the SDK's context put back — forge's fork pointer goes stale across a revert and these are what reconcile it |
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
 *      | `ensureForkPrepared(dApp)`, `drainFheEvents()`, `setChainTable(...)`, `seedCleartext(...)`, `useFixedUnknownHandles(...)`, `useDeterministicUnknownHandles()`, `disableHCUDepthLimit()`, `disableHCULimits()`, `initialize()`, `enterUnmetered()` / `exitUnmetered()`, `isForkRegistered(id)` | plumbing for the `StdFhevm*` mixins; not for tests |
 *      | `encrypt(...)`, `decryptPublicWithProof(handles)`, `plaintextOf(handle)`, `hasPlaintext(handle)`, `tryPlaintextOf(handle)`, `userDecryptDigestV1(request, delegator)`, `resolveStack(dApp)` | THE PROTOCOL STEPS, handle-shaped (rules.md 2.10): prepare, drain, resolve and act, in one frame; the `StdFhevm*` mixins call these and speak `euint*` on top |
 */
interface IFhevmVm {
    // Setup failures — fork drift, an unsupported protocol version, a fork registered while inactive, an
    // empty RPC URL — revert with a rendered `LibFhevmFail` message, not a custom error (rules.md 2.11).

    // -- Lifecycle ------------------------------------------------------------

    /// @notice Whether `initialize()` has run. False at a bare etch, and false in a fork the account was
    ///         not carried into — which is how a missing `makePersistent` shows up.
    function initialized() external view returns (bool);

    /// @notice One-time setup after the etch. Idempotent; callable by anyone, on purpose: there is nothing
    ///         to protect in a test EVM, and an owner check would only get in the way of a test that
    ///         re-etches.
    function initialize() external;

    // -- Gas metering ---------------------------------------------------------

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

    // -- The current stack ----------------------------------------------------

    /// @notice The stack this test is pointed at: the local cleartext one by default, the fork's after a
    ///         fork operation on this handle. All zero before `StdFhevm`'s constructor ran.
    function protocol() external view returns (FhevmProtocolConfig memory);

    /// @notice Points the test at a stack, and the replay at that stack's executor. The local run calls it
    ///         with the local addresses; a fork operation calls it with the fork's; a test may call it to
    ///         declare a stack the chain table does not know.
    function setProtocol(address acl, address executor, address kmsVerifier) external;

    // - Cleartext verifier policy (rules.md 3.1) ------------------------------

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

    // -- Forks ----------------------------------------------------------------

    // - Create, select, roll --------------------------------------------------

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
     * @notice `vm.selectFork`, the FHEVM way: the FHE events emitted on the fork being LEFT are replayed
     *         into the store first, then the switch happens, then the protocol is pointed at the selected
     *         fork's stack. Use this, never `vm.selectFork`, in a test that decrypts.
     * @dev WHY THE DRAIN MUST COME FIRST. The recorded-log buffer is one per test across forks, and a
     *      store answers a handle it never saw by asking its upstream ON THE ACTIVE FORK — so fork A's
     *      events replayed after moving to fork B would look A's operands up on B's chain.
     */
    function selectFork(uint256 forkId) external;

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

    /// @notice Names the stack of the ACTIVE fork `forkId`, entered with a URL only; prepares and points at
    ///         it as `createSelectFork(chain, …)` would have. `StdFhevmFork` calls this with what it
    ///         resolved; a test may call it to name a stack the resolution could not.
    function registerFork(uint256 forkId, StdFhevmChains.FhevmChain calldata chain) external;

    // - Queries ---------------------------------------------------------------

    /// @notice `vm.activeFork()`, forwarded — here so a fork test never needs `vm` for the fork family.
    function activeFork() external view returns (uint256 forkId);

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

    // - Snapshots -------------------------------------------------------------

    /**
     * @notice `vm.snapshotState`, the FHEVM way: the FHE events emitted so far are replayed into the store
     *         FIRST, so the snapshot captures them, and the context this snapshot belongs to is recorded.
     *         Use this, never `vm.snapshotState`, in a test that also forks.
     */
    function snapshotState() external returns (uint256 snapshotId);

    /**
     * @notice `vm.revertToState`, the FHEVM way: reverts, then puts the SDK back in the execution context
     *         the snapshot was taken in — WHICH FORGE DOES NOT DO ON ITS OWN.
     *
     * @dev WHAT FORGE DOES, MEASURED. Reverting restores the EVM state, persistent accounts included, and
     *      for a snapshot taken ON a fork it restores the fork selection too. For one taken BEFORE any
     *      fork it restores the in-memory chain but leaves `vm.activeFork()` reporting the fork you were
     *      on: the pointer is not part of the snapshot. Left alone that reads as FORK DRIFT at the next
     *      SDK call, because the SDK's own bookkeeping WAS reverted and the two no longer agree.
     *
     * @dev SO THIS RECONCILES. It remembers the snapshot's context across the revert in a local variable —
     *      storage and transient storage are both reverted, so neither could carry it — and afterwards
     *      answers `currentForkId()` from that rather than from forge's stale pointer.
     *
     * @dev AND IT DISCARDS PENDING FHE EVENTS. Events emitted after the snapshot describe work the revert
     *      undid; replaying them later would put values in the store that the chain no longer produced.
     *      Events from before it are already in the store, and the store is inside the snapshot.
     */
    function revertToState(uint256 snapshotId) external returns (bool success);

    // - Anvil -----------------------------------------------------------------

    /// @notice Whether a stack the SDK deploys on an anvil fork is also written onto the node. Default true.
    ///         Off, the stack exists in the fork only and the node is left untouched.
    function setAnvilMirror(bool enabled) external;
    function anvilMirror() external view returns (bool);

    // -- Preparation of a URL-only fork ---------------------------------------

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

    // -- The replay -----------------------------------------------------------

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

    /// @notice Replays everything emitted since the last replay into the active context's store. Every
    ///         value-reading entry calls it before answering (rules.md §2.9); a test never needs to.
    function drainFheEvents() external;

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
    /**
     * @notice `vm.recordLogs()`, the FHEVM way: forwarded where nothing owns the buffer, IGNORED where the
     *         replay does — recording is armed from `initialize()` and must stay armed.
     * @dev WHY IT EXISTS AT ALL, given the SDK arms recording before any dApp call can run. Ported code
     *      comes in pairs. A test that had `vm.recordLogs()` … `vm.getRecordedLogs()` becomes one where
     *      the second line moved to `fhevm` and the first vanished, which reads like an omission at
     *      exactly the spot where the reader is asking what happened to the recording. So `fhevm` answers
     *      the call rather than leaving a hole, and the pair ports as a pair.
     * @dev WHY IT IS IGNORED WHERE IT IS. `vm.recordLogs()` RESETS the buffer, and with a replay running
     *      that buffer is shared (rules.md §2.3): forwarding would discard every FHE event recorded so far
     *      and the next decryption would fail on a handle the replay never saw. Ignoring loses nothing —
     *      `fhevm.getRecordedLogs()` still hands the test every log, from a window that opened earlier
     *      than the one it asked for.
     * @dev AND WHY IT IS NOT IGNORED EVERYWHERE. A context with no processor — a URL-only fork before its
     *      first SDK entry — has nobody feeding on the buffer, so there is nothing to starve and no reason
     *      to refuse: the cheat runs for real and the window is the one the test drew. Ignoring there
     *      would be the silent kind of wrong, a test reading logs from before its own `recordLogs()`.
     * @dev NOT FREE, like every `fhevm` call: it is a real frame and consumes a pending `vm.prank` or
     *      `vm.expectRevert` (rules.md §7.7).
     */
    function recordLogs() external;

    function getRecordedLogs() external returns (Vm.Log[] memory logs);

    // - Cheats, on the active context's store ---------------------------------
    //
    // FORK ONLY, and each one says so by name: on a cleartext stack every value is known, so there is
    // nothing to state, and a call here means the test is confused about which stack it is on. Each
    // prepares the fork and drains first, so the statement lands in the replay the next read consults.

    /// @notice States a handle's cleartext in the active context's store (`forkUnknown`).
    function seedCleartext(bytes32 handle, uint256 value) external;
    /// @notice Every unknown handle in the active context reads as `value`, clamped (`forkUnknownDefault`).
    function useFixedUnknownHandles(uint256 value) external;
    /// @notice Every unknown handle in the active context reads from its hash (`forkUnknownDeterministic`).
    function useDeterministicUnknownHandles() external;

    // - Cheats, on the current stack's HCULimit -------------------------------

    /**
     * @notice Lifts ONLY the CURRENT stack's HCU depth cap, as that stack's ACL owner: the depth cap
     *         becomes the per-transaction cap, past which it cannot bind on its own; the per-transaction
     *         and per-block caps keep metering (`disableHCUDepthLimit`).
     * @dev Prepares and resolves first, like every step: the `HCULimit` is the one the resolved executor
     *      names, and the owner is read off the resolved ACL, so this works on the local stack and on a
     *      fork alike. Not fork-only: a heavy local fuzz is exactly who asks for it.
     */
    // forge-lint: disable-next-line(mixed-case-function)
    function disableHCUDepthLimit() external;

    /**
     * @notice The HCU meter of the current stack: what the last metered transaction spent in total, and
     *         the deepest single handle chain within it — a gas-style reading, for asserting on cost.
     *
     * @dev ONLY ON A STACK THIS LIBRARY DEPLOYED. The meter lives on the forge variant of `HCULimit`, so
     *      the in-memory stack has it, and so does one auto-provisioned onto anvil; a cleartext stack that
     *      came from anywhere else, and every real network, runs the plain implementation and keeps no
     *      meter. Refused by name there rather than answering zero.
     *
     * @dev Both readings clear on the first metered operation of a new transaction, so a fresh reading
     *      needs an FHE call before it.
     */
    // forge-lint: disable-next-line(mixed-case-function)
    function lastHCU() external returns (FhevmHCUMeter memory);

    /// @notice Lifts EVERY HCU cap of the current stack — block, transaction and depth — to the ceiling,
    ///         as its ACL owner (`disableHCULimits`). Metering still runs; nothing is measured against.
    // forge-lint: disable-next-line(mixed-case-function)
    function disableHCULimits() external;

    // -- The protocol steps, for the mixins -----------------------------------
    //
    // ONE ENTRY, IN ONE ORDER, for each. Preparing the fork is what decides which stack is current, and
    // the stack is what every step computes against, so the two cannot be separate calls at the call
    // site: an argument list is evaluated before the call it belongs to, and a caller that read the
    // stack itself would be reading it one step too early. Each step prepares, drains, resolves and acts
    // here, and the caller names none of it. Handle-shaped (`bytes32`), which is kernel vocabulary; the
    // typed public API is the mixins' (rules.md 2.8).

    // - The resolver ----------------------------------------------------------

    /**
     * @notice The stack this test is pointed at, RESOLVED and READY TO READ: prepared, drained, and with
     *         a plaintext source guaranteed present.
     *
     * @dev For the one decryption path whose argument checks keep it in its mixin (`StdFhevmDecrypt`):
     *      it takes the resolved stack from here instead of assembling it from three calls. Every caller
     *      outside the kernel decrypts, and a decryption without a plaintext source has nothing to say,
     *      so the guard is part of the answer — loudly (rules.md 2.11), not a call on address zero.
     * @param dAppOrZero the contract the entry targets, or zero — what a URL-only fork resolves from.
     */
    function resolveStack(address dAppOrZero) external returns (FhevmStack memory stack);

    // - Encrypt ---------------------------------------------------------------

    /**
     * @notice Mints a batch of encrypted inputs for `contractAddress`, as `userAddress`, and returns
     *         everything an `EncryptedInput` is made of.
     *
     * @return handles     The external handles, in the order the values were given.
     * @return inputProof  The proof the whole batch shares.
     * @return chainId     The chain the handles were minted for, read back off the first of them.
     * @return version     The handle format version, likewise.
     */
    function encrypt(uint8[] calldata typeIds, uint256[] calldata values, address contractAddress, address userAddress)
        external
        returns (bytes32[] memory handles, bytes memory inputProof, uint256 chainId, uint8 version);

    /// @notice The same, from `abi.encode(typeId, value, typeId, value, ...)`.
    function encrypt(bytes calldata abiTypeValuePairs, address contractAddress, address userAddress)
        external
        returns (bytes32[] memory handles, bytes memory inputProof, uint256 chainId, uint8 version);

    // - Read ------------------------------------------------------------------

    /**
     * @notice Public decryption of `handles` against the current stack: the values and the proof a dApp's
     *         `checkSignatures` accepts.
     * @dev The local cleartext verifier is asked directly (unless the production path is forced); a
     *      production one is served from the ACL and the plaintext source the resolved stack names.
     */
    function decryptPublicWithProof(bytes32[] calldata handles)
        external
        returns (bytes memory abiEncodedClearValues, bytes memory decryptionProof);

    /// @notice What `handle` is worth, read from whatever holds cleartexts for the current stack — the
    ///         cleartext executor locally, the context's replay on a fork — after draining what is pending.
    function plaintextOf(bytes32 handle) external returns (uint256 clear);

    /// @notice Whether the current stack holds a cleartext for `handle` — the predicate to `plaintextOf`,
    ///         after the same draining. Never reverts: false for the zero word, a foreign-chain handle
    ///         and a handle this stack never computed or was told about.
    function hasPlaintext(bytes32 handle) external returns (bool);

    /// @notice `hasPlaintext` and `plaintextOf` in one frame: `exists` is what `hasPlaintext` answers, and
    ///         `clear` is the value when it does, zero otherwise. The zero on a miss is a PLACEHOLDER, not a
    ///         reading — callers branch on `exists`.
    function tryPlaintextOf(bytes32 handle) external returns (bool exists, uint256 clear);

    // - Sign ------------------------------------------------------------------

    /**
     * @notice The digest a user signs to request a decryption from the CURRENT stack's KMS verifier, with
     *         `delegatorOrZero` naming a delegator for the delegated form.
     * @dev A permit is bound to one verifier's domain and KMS context, so the verifier it is built against
     *      must be the one the decryption will be checked by. Resolving here, after preparing the fork from
     *      the permit's own first contract address, is what makes that so: a permit signed as the FIRST
     *      entry on a URL-only fork resolves the stack exactly as an encryption would, and a later decrypt
     *      finds the same stack. The mixin signs the digest with the caller's key; the key never comes here.
     */
    function userDecryptDigestV1(UserDecryptRequestV1 calldata request, address delegatorOrZero)
        external
        returns (bytes32 digest);
}

/// @dev The handle. Declared here so one import brings the constant and its interface. Lowercase like
///      forge-std's `vm`, on purpose: it is read as a handle, not as a constant.
// forge-lint: disable-next-line(screaming-snake-case-const)
IFhevmVm constant fhevm = IFhevmVm(FHEVM_VM_ADDRESS);

/// The runtime behind `fhevm`. Never deployed with `new`: `StdFhevmBase`'s constructor etches
/// `type(FhevmVm).runtimeCode` at `FHEVM_VM_ADDRESS`.
contract FhevmVm is IFhevmVm {
    // -- Storage --------------------------------------------------------------

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

    /// @dev The context each `snapshotState()` was taken in. Two mappings rather than a plus-one encoding
    ///      because "no fork" is spelled `type(uint256).max`, which has no room for the plus one.
    mapping(uint256 snapshotId => bool) private _snapshotIsOurs;
    mapping(uint256 snapshotId => uint256) private _snapshotContext;

    /// @dev Transient, not storage: a cold `SSTORE` is ~20k and would itself be charged to the test if the
    ///      pause ever came after it; `TSTORE` is ~100 and clears with the transaction, i.e. the test.
    bytes32 private constant UNMETERED_DEPTH_SLOT = keccak256("fhevm.FhevmVm.unmeteredDepth");

    // -- Lifecycle ------------------------------------------------------------

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

    // -- Gas metering ---------------------------------------------------------

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

    // -- The current stack ----------------------------------------------------

    function protocol() external view returns (FhevmProtocolConfig memory) {
        return _protocol;
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

    // - Cleartext verifier policy (rules.md 3.1) ------------------------------

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

    // -- Forks ----------------------------------------------------------------

    // - Create, select, roll --------------------------------------------------

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

    function useStack(StdFhevmChains.FhevmChain calldata chain) external {
        uint256 context = _activeFork();
        _remember(context, chain);
        if (context != NO_FORK) _lastSwitchedForkId = context;
        _pointAt(context);
    }

    function registerFork(uint256 forkId, StdFhevmChains.FhevmChain calldata chain) external {
        uint256 active = _activeFork();
        if (active != forkId) revert(LibFhevmFail.registeredForkNotActive(forkId, active));
        _enterFork(forkId, chain);
    }

    // - Queries ---------------------------------------------------------------

    function activeFork() external view returns (uint256 forkId) {
        return Vm(FORGE_VM_ADDRESS).activeFork();
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
        string memory envName = string.concat(Vm(FORGE_VM_ADDRESS).toUppercase(chainAlias), "_RPC_URL");
        return bytes(Vm(FORGE_VM_ADDRESS).envOr(envName, string(""))).length != 0;
    }

    // - Snapshots -------------------------------------------------------------

    function snapshotState() external returns (uint256 snapshotId) {
        // Drained BEFORE the snapshot, so what the events produced is part of what is captured.
        _drainFheEvents();
        snapshotId = Vm(FORGE_VM_ADDRESS).snapshotState();
        // Written AFTER, so it is not in the snapshot — which is fine: it is read before the revert undoes
        // it, and a local variable carries the value across.
        _snapshotIsOurs[snapshotId] = true;
        _snapshotContext[snapshotId] = _activeFork();
    }

    function revertToState(uint256 snapshotId) external returns (bool success) {
        if (!_snapshotIsOurs[snapshotId]) revert(LibFhevmFail.unknownSnapshot(snapshotId));
        // a LOCAL: storage and transient storage are both about to revert
        uint256 context = _snapshotContext[snapshotId];
        uint256 active = _activeFork();

        // The one direction forge cannot do. Refused BEFORE the revert, so nothing is disturbed.
        if (context == NO_FORK && active != NO_FORK) revert(LibFhevmFail.cannotRevertPastFork(snapshotId));

        success = Vm(FORGE_VM_ADDRESS).revertToState(snapshotId);

        // Everything emitted since the snapshot describes work the revert undid. Drop it, or the next
        // replay would write values into a store the chain no longer agrees with.
        Vm(FORGE_VM_ADDRESS).getRecordedLogs();

        // Nothing to put back. Forge restores its own fork pointer correctly in every direction that is
        // left, and this handle's bookkeeping -- the stack it points at, the drift guard's memory, each
        // context's replay -- is storage, so it came back with the state. `context` is read only to
        // decide, above, whether the revert is one forge can do at all.
    }

    // - Bookkeeping -----------------------------------------------------------

    /// @dev The active fork `forkId` now has a named stack: remember it, prepare it once, point at it.
    function _enterFork(uint256 forkId, StdFhevmChains.FhevmChain memory chain) private {
        _remember(forkId, chain);
        _lastSwitchedForkId = forkId;
        _pointAt(forkId);
    }

    /// @dev The active fork changed and its stack is not known yet: the current stack is CLEARED, never
    ///      left pointing at wherever the test came from. The first SDK entry resolves and points.
    function _enterUnresolvedFork(uint256 forkId) private {
        _lastSwitchedForkId = forkId;
        _protocol = FhevmProtocolConfig({acl: address(0), executor: address(0), kmsVerifier: address(0)});
    }

    /// @dev Names `forkId`'s stack without touching it — for a fork that is not active (`createFork`).
    ///      A re-registration names a (possibly different) stack: prepare again on next contact.
    function _remember(uint256 forkId, StdFhevmChains.FhevmChain memory chain) private {
        _forkChain[forkId] = chain;
        _forkRegistered[forkId] = true;
        _forkPrepared[forkId] = false;
    }

    /// @dev The roll reset the fork's local state: our signer swap is gone, and so is the fork's processor
    ///      (created inside the fork, never persistent). Forget both, so the next contact prepares afresh.
    function _forgetForkState(uint256 forkId) private {
        _forkPrepared[forkId] = false;
        _processorOf[forkId] = address(0);
    }

    /// @dev Prepare on first contact, point on every contact. Runs with `forkId` ACTIVE.
    function _pointAt(uint256 forkId) private {
        // An entry made by `cleartextChain(alias)` carries no chain id: the fork's own is the truth, and
        // this is the first moment it can be read. Recorded once, so the table lookup and the messages
        // below see it.
        if (_forkChain[forkId].chainId == 0) _forkChain[forkId].chainId = block.chainid;
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
                LibForgeFhevmStack.defineCleartextContexts(chain.inputVerifier, chain.protocolConfig, chain.acl);
            }
            // A cleartext stack is this package's own code: no version to check, and it registers the
            // cleartext signers itself.
            _forkPrepared[forkId] = true;
        }
        _setProtocol(chain.acl, chain.fhevmExecutor, chain.kmsVerifier);
    }

    function _requireRpcUrl(StdFhevmChains.FhevmChain calldata chain) private pure {
        if (bytes(chain.rpcUrl).length == 0) revert(LibFhevmFail.noRpcUrl(chain.fhevmGroup, chain.chainAlias));
    }

    /// @dev The context the test is REALLY in. Forge's pointer, except right after a revert that left it
    ///      stale, where `revertToState` recorded the truth (see there).
    function _activeFork() private view returns (uint256) {
        return _reportedFork();
    }

    /// @dev What forge says, with "no fork" spelled as `NO_FORK` rather than as a revert.
    function _reportedFork() private view returns (uint256) {
        try Vm(FORGE_VM_ADDRESS).activeFork() returns (uint256 forkId) {
            return forkId;
        } catch {
            return NO_FORK;
        }
    }

    // - Version gate ----------------------------------------------------------

    /// @dev ANY RELEASE OF THE VENDORED LINE is accepted (rules.md 2.15): each contract's `getVersion()`
    ///      must fall between what the line first shipped (`LibFhevmVersion.*_FLOOR`, fhevm v0.13.0) and
    ///      what this SDK vendors (`LocalHostVersions`, the ceiling). Another line — older or newer — is
    ///      refused by name before anything else is attempted.
    function _requireSupportedVersions(StdFhevmChains.FhevmChain memory chain) private view {
        if (LibCleartextProbe.isCleartext(chain.fhevmExecutor)) return;
        _requireVersion(chain, "ACL", chain.acl, LibFhevmVersion.ACL_FLOOR, LibFhevmVersion.aclCeiling());
        _requireVersion(
            chain,
            "FHEVMExecutor",
            chain.fhevmExecutor,
            LibFhevmVersion.FHEVM_EXECUTOR_FLOOR,
            LibFhevmVersion.fhevmExecutorCeiling()
        );
        _requireVersion(
            chain,
            "InputVerifier",
            chain.inputVerifier,
            LibFhevmVersion.INPUT_VERIFIER_FLOOR,
            LibFhevmVersion.inputVerifierCeiling()
        );
        _requireVersion(
            chain,
            "KMSVerifier",
            chain.kmsVerifier,
            LibFhevmVersion.KMS_VERIFIER_FLOOR,
            LibFhevmVersion.kmsVerifierCeiling()
        );
        _requireVersion(
            chain,
            "ProtocolConfig",
            chain.protocolConfig,
            LibFhevmVersion.PROTOCOL_CONFIG_FLOOR,
            LibFhevmVersion.protocolConfigCeiling()
        );
    }

    function _requireVersion(
        StdFhevmChains.FhevmChain memory chain,
        string memory contractName,
        address target,
        string memory floor,
        string memory ceiling
    ) private view {
        (bool ok, bytes memory ret) = target.staticcall(abi.encodeWithSignature("getVersion()"));
        string memory actual = (ok && ret.length >= 64) ? abi.decode(ret, (string)) : "";
        if (!LibFhevmVersion.accepts(actual, floor, ceiling)) {
            revert(
                LibFhevmFail.versionMismatch(chain.fhevmGroup, chain.chainAlias, contractName, floor, ceiling, actual)
            );
        }
    }

    // - Anvil -----------------------------------------------------------------

    function setAnvilMirror(bool enabled) external {
        _anvilMirrorOff = !enabled;
    }

    function anvilMirror() external view returns (bool) {
        return !_anvilMirrorOff;
    }

    /// @dev The executor has no code, so the SDK deploys the cleartext stack itself — into the fork, and onto
    ///      the node too when the node is anvil. THE DECISIONS ARE HERE and the mechanism is the payload's
    ///      (`LibForgeFhevmAnvil`): what is canonical, where a live stack forbids it, what the deployer's
    ///      nonce allows, whether to mirror, and what to tell the user are this package's to answer — the
    ///      payload cannot render a boxed message, because `LibFhevmFail` carries this package's own version.
    ///
    ///      THE MOCK NEVER SHADOWS A LIVE STACK. A chain the table lists under a network group (`mainnet`,
    ///      `testnet`, `devnet`) HAS the protocol; a fork of it whose executor holds no code is a fork of the
    ///      wrong thing (a pruned node, an entry with the wrong addresses, a `vm.etch` in a test), never a
    ///      place to put the cleartext stack. Only a chain no group lists — Arbitrum, Base, a bare anvil —
    ///      gets one.
    function _provisionLocalStack(StdFhevmChains.FhevmChain memory chain) private {
        bool canonical = chain.acl == ACL_ADDRESS && chain.fhevmExecutor == FHEVM_EXECUTOR_ADDRESS;
        if (!canonical) {
            revert(LibFhevmFail.stackMissing(chain.fhevmGroup, chain.chainAlias, chain.fhevmExecutor));
        }
        StdFhevmChains.FhevmChain[] memory candidates = _candidatesFor(block.chainid);
        for (uint256 i = 0; i < candidates.length; i++) {
            if (keccak256(bytes(candidates[i].fhevmGroup)) != keccak256(bytes(FHEVM_LOCAL_GROUP))) {
                revert(LibFhevmFail.liveStackExists(block.chainid, candidates[i].fhevmGroup, candidates[i].chainAlias));
            }
        }
        uint64 nonce = Vm(FORGE_VM_ADDRESS).getNonce(DEPLOYER_ADDRESS);
        if (nonce != DEPLOYER_START_NONCE) {
            revert(LibFhevmFail.localStackCannotDeploy(DEPLOYER_ADDRESS, DEPLOYER_START_NONCE, nonce));
        }

        // Anvil: deploy and, unless told otherwise, mirror onto the node so the stack survives the test.
        // Any other fork: deploy into the fork only; there is no node the SDK owns to write to.
        bool mirror = !_anvilMirrorOff && LibForgeFhevmAnvil.isAnvilNode();
        if (!LibForgeFhevmAnvil.provision(mirror)) {
            revert(LibFhevmFail.anvilMirrorFailed(ACL_ADDRESS));
        }
    }

    // -- Preparation of a URL-only fork ---------------------------------------

    function ensureForkPrepared(address dAppOrZero) external {
        _ensureForkPrepared(dAppOrZero);
    }

    function _ensureForkPrepared(address dAppOrZero) private {
        uint256 active = _activeFork();
        if (active != _lastSwitchedForkId) revert(LibFhevmFail.forkDrift(active, _lastSwitchedForkId));
        if (active == NO_FORK || _forkRegistered[active]) return;
        _enterFork(active, _resolveStack(dAppOrZero));
    }

    function setChainTable(StdFhevmChains.FhevmChain[] calldata chains) external {
        delete _chainTable;
        for (uint256 i = 0; i < chains.length; i++) {
            _chainTable.push(chains[i]);
        }
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

    // -- The replay -----------------------------------------------------------

    function eventProcessor() external view returns (address) {
        return _processorOf[_activeFork()];
    }

    function drainFheEvents() external {
        _drainFheEvents();
    }

    /// @dev Everything emitted since the last replay, into the ACTIVE context's store, while the context
    ///      that emitted it is still the active one. A no-op when that context has no processor yet (a
    ///      URL-only fork before its first entry): nothing of its own is pending that a later context
    ///      would want.
    function _drainFheEvents() private {
        address processor = _processorOf[_activeFork()];
        if (processor != address(0)) ForgeFhevmEventProcessor(processor).processFheEvents();
    }

    /// @dev Two contexts, two answers, and the processor is what tells them apart. WITH one, the buffer is
    ///      the replay's and a reset would rob it, so the call is ignored — recording is armed already and
    ///      stays armed. WITHOUT one (a URL-only fork before its first entry), nothing is feeding on the
    ///      buffer and nothing can be starved, so the real cheat runs and the test gets the fresh window it
    ///      asked for. A test that forks and then calls this gets the `vm` behaviour exactly.
    function recordLogs() external {
        if (_processorOf[_activeFork()] != address(0)) return;
        Vm(FORGE_VM_ADDRESS).recordLogs();
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

    // - Cheats, on the active context's store ---------------------------------

    function seedCleartext(bytes32 handle, uint256 value) external {
        _forkReplay().seedCleartext(handle, value);
    }

    function useFixedUnknownHandles(uint256 value) external {
        _forkReplay().useFixedUnknownHandles(value);
    }

    function useDeterministicUnknownHandles() external {
        _forkReplay().useDeterministicUnknownHandles();
    }

    /// @dev The replay a fork-only cheat writes to: the resolved stack's plaintext source, which on a
    ///      non-cleartext stack IS the active context's processor. Refused by name on a cleartext stack.
    function _forkReplay() private returns (ForgeFhevmEventProcessor) {
        FhevmStack memory stack = _resolveForReading(address(0));
        if (stack.isCleartext) revert(LibFhevmFail.notAFork(stack.executor));
        return ForgeFhevmEventProcessor(stack.plaintexts);
    }

    // - Cheats, on the current stack's HCULimit -------------------------------

    // forge-lint: disable-next-line(mixed-case-function)
    function disableHCUDepthLimit() external {
        // The bare resolver: lifting a cap reads no plaintext. The executor names its own HCULimit, so
        // nothing here is configured — a forked stack's is found the same way as the local one's.
        FhevmStack memory stack = _resolve(address(0));
        address hcuLimit = ICleartextFHEVMExecutor(stack.executor).getHCULimitAddress();
        LibForgeFhevmHCU.disableHCUDepthLimit(hcuLimit, stack.acl);
    }

    // forge-lint: disable-next-line(mixed-case-function)
    function disableHCULimits() external {
        FhevmStack memory stack = _resolve(address(0));
        address hcuLimit = ICleartextFHEVMExecutor(stack.executor).getHCULimitAddress();
        LibForgeFhevmHCU.disableHCULimits(hcuLimit, stack.acl);
    }

    // forge-lint: disable-next-line(mixed-case-function)
    function lastHCU() external returns (FhevmHCUMeter memory meter) {
        // The same bare resolver the lifts use: reading a meter reads no plaintext, and the executor names
        // its own HCULimit, so a forked stack's is found exactly like the local one's.
        FhevmStack memory stack = _resolve(address(0));
        address hcuLimit = ICleartextFHEVMExecutor(stack.executor).getHCULimitAddress();
        // The guard belongs HERE, not in the library: only this layer may render a failure (rules.md 2.16),
        // and without it the plain implementation reverts on a missing function with nothing to say.
        if (!LibCleartextProbe.isForge(hcuLimit)) revert(LibFhevmFail.noHCUMeter(hcuLimit));
        (meter.transaction, meter.maxHandle) = LibForgeFhevmHCU.lastHCU(hcuLimit);
    }

    // -- The protocol steps, for the mixins -----------------------------------

    // - The resolver ----------------------------------------------------------

    function resolveStack(address dAppOrZero) external returns (FhevmStack memory stack) {
        return _resolveForReading(dAppOrZero);
    }

    /**
     * @dev THE ONE RESOLVER, feeding every kernel operation. Prepares the fork, drains the replay, and only
     *      THEN reads the stack — in that order, because preparing is what decides which stack is current
     *      and draining is what makes its replay complete. Inside one function the three cannot get out
     *      of order, which is why the mixins call an operation here rather than assembling this themselves.
     *
     * RESOLVED, NOT NAMED. The input verifier is read off the executor, which names its own, cleartext or
     * production alike; a `staticcall` rather than a typed one so an executor that does not answer leaves
     * it zero instead of reverting. The plaintext source is zero when there is none — a production stack
     * with no replay yet — and it is the OPERATION that needs one that says so, loudly.
     */
    function _resolve(address dAppOrZero) private returns (FhevmStack memory stack) {
        _ensureForkPrepared(dAppOrZero);
        _drainFheEvents();

        address executor = _protocol.executor;
        if (executor == address(0)) revert(LibFhevmFail.noCurrentStack());

        (bool ok, bytes memory ret) =
            executor.staticcall(abi.encodeCall(ICleartextFHEVMExecutor.getInputVerifierAddress, ()));
        bool isCleartext = LibCleartextProbe.isCleartext(executor);

        stack.acl = _protocol.acl;
        stack.executor = executor;
        stack.kmsVerifier = _protocol.kmsVerifier;
        stack.inputVerifier = (ok && ret.length == 32) ? abi.decode(ret, (address)) : address(0);
        stack.plaintexts = isCleartext ? executor : _processorOf[_activeFork()];
        stack.isCleartext = isCleartext;
        stack.cleartextVerifier = !_forceProductionPath() && isCleartext;
    }

    /// @dev `_resolve`, for a step that READS values: a stack with no plaintext source cannot answer, and
    ///      says so by name rather than calling `plaintexts(handle)` on address zero.
    function _resolveForReading(address dAppOrZero) private returns (FhevmStack memory stack) {
        stack = _resolve(dAppOrZero);
        if (stack.plaintexts == address(0)) revert(LibFhevmFail.noPlaintextsSource(stack.executor));
    }

    // - Encrypt ---------------------------------------------------------------

    function encrypt(uint8[] calldata typeIds, uint256[] calldata values, address contractAddress, address userAddress)
        external
        returns (bytes32[] memory handles, bytes memory inputProof, uint256 chainId, uint8 version)
    {
        EncryptStack memory stack = _encryptStackOf(_resolve(contractAddress));
        (handles, inputProof) = LibForgeFhevmEncrypt.encrypt(typeIds, values, contractAddress, userAddress, stack);
        (chainId, version) = _originOf(handles);
    }

    function encrypt(bytes calldata abiTypeValuePairs, address contractAddress, address userAddress)
        external
        returns (bytes32[] memory handles, bytes memory inputProof, uint256 chainId, uint8 version)
    {
        EncryptStack memory stack = _encryptStackOf(_resolve(contractAddress));
        (handles, inputProof) = LibForgeFhevmEncrypt.encrypt(abiTypeValuePairs, contractAddress, userAddress, stack);
        (chainId, version) = _originOf(handles);
    }

    /// @dev The slice of the resolved stack an encryption is computed against. The ACL address goes into
    ///      the blob hash and into every handle, so a constant here would produce handles a forked chain
    ///      has never heard of, and nothing would say so until the dApp call failed.
    function _encryptStackOf(FhevmStack memory stack) private pure returns (EncryptStack memory) {
        return
            EncryptStack({
                inputVerifier: stack.inputVerifier, acl: stack.acl, cleartextVerifier: stack.cleartextVerifier
            });
    }

    /// @dev Where a batch was minted, read back off its own first handle. One `encrypt` mints one batch on
    ///      one chain in one format, and the typed accessors check every other handle against this.
    function _originOf(bytes32[] memory handles) private pure returns (uint256 chainId, uint8 version) {
        chainId = LibFhevmHandle.chainIdOf(handles[0]);
        version = LibFhevmHandle.versionOf(handles[0]);
    }

    // - Read ------------------------------------------------------------------

    function decryptPublicWithProof(bytes32[] calldata handles)
        external
        returns (bytes memory abiEncodedClearValues, bytes memory decryptionProof)
    {
        FhevmStack memory stack = _resolveForReading(address(0));
        return LibForgeFhevmPublicDecrypt.decryptPublicWithProof(
            handles, stack.kmsVerifier, stack.acl, stack.plaintexts, stack.cleartextVerifier
        );
    }

    function plaintextOf(bytes32 handle) external returns (uint256 clear) {
        return IPlaintexts(_resolveForReading(address(0)).plaintexts).plaintexts(handle);
    }

    function hasPlaintext(bytes32 handle) external returns (bool) {
        return IPlaintexts(_resolveForReading(address(0)).plaintexts).hasPlaintext(handle);
    }

    function tryPlaintextOf(bytes32 handle) external returns (bool exists, uint256 clear) {
        IPlaintexts source = IPlaintexts(_resolveForReading(address(0)).plaintexts);
        exists = source.hasPlaintext(handle);
        if (exists) clear = source.plaintexts(handle);
    }

    // - Sign ------------------------------------------------------------------

    function userDecryptDigestV1(UserDecryptRequestV1 calldata request, address delegatorOrZero)
        external
        returns (bytes32 digest)
    {
        // The permit's first contract is the dApp hint, as the first pair is for a decryption. No plaintext
        // source is needed to sign, so the bare resolver.
        address hint = request.contractAddresses.length != 0 ? request.contractAddresses[0] : address(0);
        address kmsVerifier = _resolve(hint).kmsVerifier;
        if (delegatorOrZero == address(0)) {
            (digest,) = LibKmsVerifier.userDecryptDigestV1OnStack(kmsVerifier, request);
        } else {
            (digest,) = LibKmsVerifier.delegatedUserDecryptDigestV1OnStack(kmsVerifier, request, delegatorOrZero);
        }
    }
}
