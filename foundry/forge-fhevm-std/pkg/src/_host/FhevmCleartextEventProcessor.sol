// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FheType, LibFheType} from "./shared/LibFheType.sol";
import {Operators} from "./shared/FhevmOperators.sol";
import {
    Cast,
    FheAdd,
    FheBitAnd,
    FheBitOr,
    FheBitXor,
    FheDiv,
    FheEq,
    FheGe,
    FheGt,
    FheIfThenElse,
    FheIsIn,
    FheLe,
    FheLt,
    FheMax,
    FheMin,
    FheMul,
    FheNe,
    FheNeg,
    FheNot,
    FheRand,
    FheRandBounded,
    FheRem,
    FheRotl,
    FheRotr,
    FheShl,
    FheShr,
    FheSub,
    FheSum,
    TrivialEncrypt,
    VerifyInput
} from "./shared/FhevmEvents.sol";
import {ICleartextDB} from "./shared/interfaces/ICleartextDB.sol";
import {CleartextArithmeticBase} from "./shared/CleartextArithmeticBase.sol";
import {LibFhevmHandle} from "./shared/LibFhevmHandle.sol";
import {LibCleartextProbe} from "./shared/LibCleartextProbe.sol";

/// @notice The log cheatcodes, declared here rather than widened into `IForgeVm`, so this file stands
///         on its own.
/// @dev The struct must match forge-std's `Vm.Log` field for field — the cheatcode ABI-encodes it.
interface IForgeVmLogs {
    struct Log {
        bytes32[] topics;
        bytes data;
        address emitter;
    }

    function recordLogs() external;
    function getRecordedLogs() external returns (Log[] memory logs);
}

/// @notice The one randomness cheatcode this file needs, declared for the same reason as the logs one.
interface IForgeVmRandom {
    function randomUint() external view returns (uint256);
}

/// @notice What this store asks of an upstream, and of the executor that names one.
interface ICleartextUpstream {
    function plaintexts(bytes32 handle) external view returns (uint256);
    function hasPlaintext(bytes32 handle) external view returns (bool);
}

interface IHasCleartextArithmetic {
    function getCleartextArithmeticAddress() external view returns (address);
}

/**
 * @title FhevmCleartextEventProcessorDB
 * @notice The store the processor writes into: an `ICleartextDB` with no proxy, no ACL and no owner
 *         beyond the one contract that created it.
 *
 * @dev Three differences from `CleartextDB`, all of them because this one backs a REPLAY rather than a
 *      live chain:
 *
 *      1. It is keyed BY CHAIN: `chainId -> handle -> value`, with the chain read out of the handle
 *         itself (bytes 22..29). `CleartextDB` is single-chain and its writer refuses a foreign
 *         handle outright, because on a live chain such a handle names a slot that is either empty or
 *         another handle's value. A replay has no such constraint — logs can come from more than one
 *         chain, and here each gets its own slot, so they cannot collide however they were captured.
 *      2. `get` REVERTS on a handle nothing has written. `CleartextDB` returns 0, which is right when
 *         the executor guarantees operands exist; here a missing handle means the log stream had a
 *         hole — recording started too late, or an event went unhandled — and answering 0 would
 *         compute a wrong result and blame the assertion instead.
 *      3. A handle can be marked NON-REPLAYABLE, for the one operation events cannot carry (see
 *         `FhevmCleartextEventProcessor._applyRand`). The mark is a LABEL, not a guard: it is what
 *         `statusOf` reports, and reading such a handle returns the stored value (0 until something
 *         writes one) rather than reverting. Callers that care ask `statusOf` first.
 *      4. The writer set is fixed at construction. There is no ACL to ask.
 */
contract FhevmCleartextEventProcessorDB is ICleartextDB {
    enum Status {
        Unset,
        Known,
        NonReplayable
    }

    /**
     * @notice What a read does when no event ever produced the handle.
     *
     * @dev THE FORKED-CHAIN PROBLEM. Replaying logs answers for handles the recording WATCHED being
     *      created. Fork Sepolia at a block and a `ConfidentialERC20` there already holds balances
     *      minted long before: real handles, with no event in the window and no way to learn their
     *      values. Nor can they be spotted — a handle is `hash21 | index | chainId | fheType |
     *      version`, carrying no block number, so one from ten thousand blocks ago looks exactly like
     *      one from the last. `Unset` cannot tell "never happened" from "happened before we looked".
     *
     *      So the store stops trying to distinguish them and lets the test say what such a handle is
     *      worth. Every mode below yields a value that is a PURE FUNCTION of the handle and the
     *      configuration, which is what arithmetic needs: read the same handle twice and it is the
     *      same number, so `a + a == 2a` holds and a dApp under test sees a coherent world.
     */
    enum UnknownHandlePolicy {
        /// @dev Refuse. Right when every handle is supposed to be accounted for; the default.
        Revert,
        /// @dev `keccak256(handle)`, clamped to the handle's type. Same value every run, so a failure
        ///      reproduces and can be pinned in an assertion.
        Deterministic,
        /// @dev Same, salted with one `vm.randomUint()` draw taken when the policy is set. Different
        ///      numbers each run — to catch a dApp that accidentally depends on a particular balance —
        ///      but still stable WITHIN a run.
        Random,
        /// @dev One value the developer chose, clamped to each handle's type.
        Fixed
    }

    /// @notice Read for a handle no processed event ever produced.
    error CleartextEventUnknownHandle(bytes32 handle);

    /// @notice This store's writer set is fixed at construction and cannot be changed.
    error CleartextEventWriterSetIsFixed();

    /// @dev chainId -> handle -> value. The chain comes from the handle, so the outer key is never
    ///      passed in: it is derived, and two handles from different chains cannot share a slot.
    /// @notice How unknown handles are answered. `Revert` until a test says otherwise.
    UnknownHandlePolicy public unknownHandlePolicy;

    /// @dev Mixed into the hash for `Deterministic` (0) and `Random` (a drawn value).
    uint256 private _salt;

    /// @dev The answer under `Fixed`.
    uint256 private _fixedValue;

    mapping(uint64 chainId => mapping(bytes32 handle => uint256 value)) private _values;
    mapping(uint64 chainId => mapping(bytes32 handle => Status status)) private _status;

    /// @dev The processor that created this store; the only address allowed to write.
    address public immutable writer;

    /**
     * @notice Where to ask about a handle this store never saw. Zero when there is nobody to ask.
     *
     * @dev THE FORKED-CLEARTEXT CASE. A cleartext stack deployed on a real chain still holds every
     *      handle's value in its own database, so a fork of it can simply be ASKED — there is nothing
     *      to synthesise and nothing to guess. That is strictly better than `UnknownHandlePolicy`: the
     *      answers are the real ones, they cover handles minted long before the recording window, and
     *      they include the one thing a replay can never reconstruct, a `vm.randomUint()` draw.
     *
     *      Left unset against a production stack, which keeps ciphertexts off chain and has nothing to
     *      answer with. There the policy is the only option.
     */
    address public upstream;

    modifier onlyWriter() {
        if (msg.sender != writer) revert CleartextErrorNotWriter(msg.sender);
        _;
    }

    constructor(address initialWriter) {
        if (initialWriter == address(0)) revert CleartextErrorInvalidNullWriter();
        writer = initialWriter;
        emit AddWriter(initialWriter);
    }

    /// @notice The chain a handle belongs to — bytes 22..29 of the handle, and this store's outer key.
    function chainIdOf(bytes32 handle) public pure returns (uint64) {
        return LibFhevmHandle.chainIdOf(handle);
    }

    /// @inheritdoc ICleartextDB
    /// @dev Reads the slot for the handle's OWN chain, whatever chain this is running on.
    function get(bytes32 handle) external view override returns (uint256) {
        return getForChain(chainIdOf(handle), handle);
    }

    /// @notice The value stored for `handle` under `chainId` explicitly.
    /// @dev    Only useful to inspect a slot a handle does not point at; `get` is the normal read.
    function getForChain(uint64 chainId, bytes32 handle) public view returns (uint256) {
        Status status = _status[chainId][handle];

        // Reconstructed here, so no one else need be asked.
        if (status == Status.Known) return _values[chainId][handle];

        // THE TRUTH BEFORE ANY STAND-IN. A cleartext stack on the forked chain holds every handle it
        // ever minted — including the ones minted before the recording window, and the drawn values no
        // event carries. It is asked first, and its answer is definitive: `hasPlaintext` tells a handle
        // worth zero from one it never saw, so a miss here really is a miss.
        (bool found, uint256 value) = _askUpstream(handle);
        if (found) return value;

        // SEEN BUT UNKNOWABLE is not the same as never seen, and only the latter is the policy's
        // business. A drawn value nobody can supply cannot be invented: the replay knows the handle
        // exists and knows it cannot say what it is, so it answers with nothing rather than with a
        // plausible number that would flow into every operation downstream of it.
        if (status == Status.NonReplayable) return _values[chainId][handle];

        return synthesize(handle);
    }

    /**
     * @dev A `staticcall` rather than a typed one: the upstream is whatever the fork happens to hold,
     *      and a handle it refuses — one minted on another chain, say — is an ordinary miss here rather
     *      than a revert to propagate.
     *
     *      Two calls, and the first is the point: `plaintexts` alone answers 0 both for a handle worth
     *      zero and for one never minted, so it cannot be trusted on its own. `hasPlaintext` settles
     *      that, which is what lets this run ahead of the policy instead of being one.
     */
    function _askUpstream(bytes32 handle) private view returns (bool found, uint256 value) {
        address source = upstream;
        if (source == address(0)) return (false, 0);

        // Existence FIRST. `plaintexts` answers 0 both for a handle worth zero and for one never
        // minted, so on its own it cannot be trusted; `hasPlaintext` is what separates them, and is
        // what lets this run ahead of the policy instead of being one.
        (bool ok, bytes memory ret) = source.staticcall(abi.encodeCall(ICleartextUpstream.hasPlaintext, (handle)));
        if (!ok || ret.length != 32 || !abi.decode(ret, (bool))) return (false, 0);

        (ok, ret) = source.staticcall(abi.encodeCall(ICleartextUpstream.plaintexts, (handle)));
        if (!ok || ret.length != 32) return (false, 0);

        return (true, abi.decode(ret, (uint256)));
    }

    /// @notice Chooses how unknown handles are answered.
    /// @param  salt     mixed into the hash; the processor draws one for `Random`, and passes 0 for
    ///                  `Deterministic`.
    /// @param  fixedValue the answer under `Fixed`, ignored otherwise.
    function setUnknownHandlePolicy(UnknownHandlePolicy policy, uint256 salt, uint256 fixedValue) external onlyWriter {
        unknownHandlePolicy = policy;
        _salt = salt;
        _fixedValue = fixedValue;
    }

    /**
     * @notice What `handle` reads as while nothing has written it.
     *
     * @dev Public so a test can predict the number it is about to assert on, and clamped to the
     *      handle's own type so a synthesised `euint8` balance is a `uint8` — an unclamped hash would
     *      overflow every downstream operation and fail for a reason that has nothing to do with the
     *      dApp.
     */
    function synthesize(bytes32 handle) public view returns (uint256) {
        UnknownHandlePolicy policy = unknownHandlePolicy;
        if (policy == UnknownHandlePolicy.Revert) revert CleartextEventUnknownHandle(handle);

        uint256 raw =
            (policy == UnknownHandlePolicy.Fixed) ? _fixedValue : uint256(keccak256(abi.encodePacked(_salt, handle)));

        uint256 bitWidth = LibFheType.bitWidthForType(LibFhevmHandle.typeOf(handle));
        if (bitWidth >= 256) return raw;
        return raw & ((uint256(1) << bitWidth) - 1);
    }

    /// @inheritdoc ICleartextDB
    function set(bytes32 handle, uint256 value) external override onlyWriter {
        uint64 chainId = chainIdOf(handle);
        _values[chainId][handle] = value;
        _status[chainId][handle] = Status.Known;
    }

    /// @notice Names a source to consult for handles this store never saw.
    function setUpstream(address source) external onlyWriter {
        upstream = source;
    }

    /// @notice Records that `handle` exists but its value cannot be reconstructed from the events.
    function markNonReplayable(bytes32 handle) external onlyWriter {
        _status[chainIdOf(handle)][handle] = Status.NonReplayable;
    }

    /// @inheritdoc ICleartextDB
    /// @dev True only for a value THIS store reconstructed. A handle it defers upstream for is not one
    ///      it holds, so it says no and the caller asks the upstream itself.
    function has(bytes32 handle) external view override returns (bool) {
        return _status[chainIdOf(handle)][handle] == Status.Known;
    }

    /// @notice What the store knows about `handle`, without reverting.
    function statusOf(bytes32 handle) external view returns (Status) {
        return statusOfForChain(chainIdOf(handle), handle);
    }

    /// @notice Same, against `chainId` explicitly.
    function statusOfForChain(uint64 chainId, bytes32 handle) public view returns (Status) {
        return _status[chainId][handle];
    }

    /// @inheritdoc ICleartextDB
    function isWriter(address account) external view override returns (bool) {
        return account == writer;
    }

    /// @inheritdoc ICleartextDB
    /// @dev Always reverts: the pair is deployed together and the writer never changes.
    function addWriter(address) external pure override {
        revert CleartextEventWriterSetIsFixed();
    }

    /// @inheritdoc ICleartextDB
    /// @dev Always reverts, for the same reason as `addWriter`.
    function removeWriter(address) external pure override {
        revert CleartextEventWriterSetIsFixed();
    }
}

/**
 * @title FhevmCleartextEventProcessor
 * @notice Rebuilds every handle's cleartext from `FHEVMExecutor`'s EVENTS alone. Deployed as a PAIR
 *         with its own `FhevmCleartextEventProcessorDB`, which it creates in its constructor:
 *
 *              FhevmCleartextEventProcessor p = new FhevmCleartextEventProcessor();
 *              p.startRecordingFheEvents();
 *              dapp.doSomething(...);
 *              uint256 v = p.plaintexts(handle);
 *
 * @dev WHY EVENTS. The executor announces each operation it performs — `FheAdd(caller, lhs, rhs,
 *      scalarByte, result)` and friends — and those events carry every input the cleartext semantics
 *      need. The log stream IS a program: replay it in order and this pair's DB ends up holding what a
 *      deployed `CleartextArithmetic` would have written to the real `CleartextDB`.
 *
 * @dev WHY THERE IS ALMOST NO CODE HERE. This contract IS a `CleartextArithmeticBase`, pointed at its
 *      own store by overriding `getCleartextDBAddress()`. So replaying an event is not "decode, then
 *      compute, then persist" — it is just "decode, then call the `record*` entry point that already
 *      does both". Each handler below is a single `abi.decode` and a single call. There is no second
 *      implementation of any operator, no local `mapping` shadowing the DB, and so nothing that can
 *      drift from the on-chain mock.
 *
 *      The ten `record*` functions are inherited, public, and are the replay: `recordBinaryOp` covers
 *      twenty of the events on its own, since the only thing that differs between `FheAdd` and
 *      `FheMax` is which `Operators` value the selector maps to.
 */
contract FhevmCleartextEventProcessor is CleartextArithmeticBase {
    IForgeVmLogs private constant fvmLogs = IForgeVmLogs(address(uint160(uint256(keccak256("hevm cheat code")))));
    IForgeVmRandom private constant fvmRandom = IForgeVmRandom(address(uint160(uint256(keccak256("hevm cheat code")))));

    /// @dev The executors whose events this processor replays. See `addExecutor`.
    address[] private _executors;
    mapping(address executor => bool listening) private _isExecutor;

    /// @dev One store per executor, created with it. See `dbOf`.
    mapping(address executor => FhevmCleartextEventProcessorDB store) private _dbOf;

    /// @dev Whose store the unqualified calls use. See `selectExecutor`.
    address private _selected;

    /// @notice A `VerifyInput` event whose proof does not carry the cleartext for its own handle.
    error CleartextEventProofWithoutCleartext(bytes32 inputHandle);

    /// @notice An executor address of zero, which no log can ever have as its emitter.
    error CleartextEventNullExecutor();

    /// @notice The same executor added twice, which would double-apply every one of its events.
    error CleartextEventDuplicateExecutor(address executor);

    /// @notice An address that was never added as an executor, and so has no store.
    error CleartextEventUnknownExecutor(address executor);

    /// @param executor The first `FHEVMExecutor` to listen to. For a local cleartext stack that is
    ///                  `FHEVM_EXECUTOR_ADDRESS`; on a forked chain it is THAT chain's executor —
    ///                  Sepolia's coprocessor, say. Add more with `addExecutor`.
    constructor(address executor) {
        addExecutor(executor);
    }

    /// @inheritdoc CleartextArithmeticBase
    /// @dev The whole reason the pairing works: every inherited `record*` reads and writes one of THESE
    ///      stores rather than the host's `cleartextDbAdd`. Which one is `_selected`, which the replay
    ///      moves to the emitting executor for the duration of each event — so an inherited `record*`
    ///      lands in the right store without any of them taking an executor argument.
    function getCleartextDBAddress() public view virtual override returns (address) {
        return address(_dbOf[_selected]);
    }

    /// @dev Accepts handles from ANY chain, overriding the base's refusal. That refusal exists because
    ///      a single-chain store would give a foreign handle someone else's slot; this pair's store is
    ///      keyed by chain, so there is no slot to collide with. Without this override the multi-chain
    ///      store would be unreachable — every `record*` would revert before writing.
    function _checkHandleChainId(bytes32) internal view override {}

    /**
     * @notice Listens to one more `FHEVMExecutor`.
     *
     * @dev EXECUTORS ARE A SET, not a single address, because a test can hold more than one chain at a
     *      time. Fork Sepolia and Polygon Amoy and each has its own executor at its own address; a dApp
     *      spanning both produces one interleaved log stream, and one processor replaying all of it
     *      keeps a single coherent view. The store is already keyed by the chain in the handle, so two
     *      chains' handles cannot collide however they arrive.
     *
     *      Addresses, not the compiled-in `FHEVM_EXECUTOR_ADDRESS`, because the executor worth
     *      listening to is rarely the local one — and nothing about the forked stack is patched,
     *      etched or redeployed to make this work. The real executor does its normal job and announces
     *      each operation; those announcements carry every operand the cleartext semantics need.
     *      Handles minted BEFORE the recording window have no event, and those are what
     *      `UnknownHandlePolicy` answers for.
     *
     *      Refusing a duplicate matters: an executor listed twice would apply each of its events twice,
     *      which is harmless for an idempotent `record*` but not for one reading its own prior result.
     */
    function addExecutor(address executor) public {
        if (executor == address(0)) revert CleartextEventNullExecutor();
        if (_isExecutor[executor]) revert CleartextEventDuplicateExecutor(executor);

        _isExecutor[executor] = true;
        _executors.push(executor);
        FhevmCleartextEventProcessorDB store = new FhevmCleartextEventProcessorDB(address(this));
        _dbOf[executor] = store;

        // A CLEARTEXT executor knows every handle's value and will say so, which beats synthesising
        // one. A production executor keeps ciphertexts off chain and has nothing to answer with, so it
        // is left unasked and the policy decides.
        // A CLEARTEXT executor names the store that holds every value it ever computed; that store is
        // the upstream. The EXECUTOR itself is not asked — it has no existence accessor, and giving it
        // one would shift the bytecode offsets the deploy pipeline patches placeholders at.
        if (LibCleartextProbe.isCleartext(executor)) {
            (bool ok, bytes memory ret) =
                executor.staticcall(abi.encodeCall(IHasCleartextArithmetic.getCleartextArithmeticAddress, ()));
            if (ok && ret.length == 32) store.setUpstream(abi.decode(ret, (address)));
        }

        if (_selected == address(0)) _selected = executor;
    }

    /// @notice The store holding what `executor`'s events produced.
    /// @dev    ONE STORE PER EXECUTOR, so a chain's replay can be read, seeded and given its own
    ///         unknown-handle policy without touching another's. The stores are independent even
    ///         though each is internally keyed by chain: two executors can serve the same chain, and
    ///         one being reconfigured must not silently reconfigure the other.
    function dbOf(address executor) public view returns (FhevmCleartextEventProcessorDB) {
        FhevmCleartextEventProcessorDB store = _dbOf[executor];
        if (address(store) == address(0)) revert CleartextEventUnknownExecutor(executor);
        return store;
    }

    /// @notice The store the unqualified calls read and write.
    function db() public view returns (FhevmCleartextEventProcessorDB) {
        return _dbOf[_selected];
    }

    /// @notice Which executor's store the unqualified calls use. The first one added, until changed.
    function selectedExecutor() public view returns (address) {
        return _selected;
    }

    /// @notice Points `db`, `plaintexts`, `seedCleartext` and the policy setters at `executor`'s store.
    /// @dev    A replay overrides this per event and restores it afterwards, so selecting is a reading
    ///         convenience and never changes where an event lands.
    function selectExecutor(address executor) public {
        if (!_isExecutor[executor]) revert CleartextEventUnknownExecutor(executor);
        _selected = executor;
    }

    /// @notice Whether events from `emitter` are replayed.
    function isExecutor(address emitter) public view returns (bool) {
        return _isExecutor[emitter];
    }

    /// @notice Every executor being listened to, in the order they were added.
    function executors() public view returns (address[] memory) {
        return _executors;
    }

    // -----------------------------------------------------------------------
    // Replay
    // -----------------------------------------------------------------------

    /// @notice Starts capturing logs. Nothing emitted before this call can be replayed.
    function startRecordingFheEvents() public {
        fvmLogs.recordLogs();
    }

    /// @notice Folds every FHE event recorded since the last drain into the store.
    /// @dev    Draining is destructive — `getRecordedLogs` empties the buffer — which is why results
    ///         accumulate in the DB rather than being recomputed on each read.
    /// @return count How many executor events were applied.
    function processFheEvents() public returns (uint256 count) {
        return processFheEvents(fvmLogs.getRecordedLogs());
    }

    /// @notice Same, over logs the caller already drained.
    /// @dev    Logs from any emitter that is not a registered executor are skipped: a test records
    ///         everything, and only an executor's events describe FHE operations.
    function processFheEvents(IForgeVmLogs.Log[] memory logs) public returns (uint256 count) {
        address restore = _selected;

        for (uint256 i = 0; i < logs.length; i++) {
            if (!_isExecutor[logs[i].emitter]) continue;
            if (logs[i].topics.length == 0) continue;

            // Each event lands in ITS OWN executor's store, whatever the caller had selected.
            _selected = logs[i].emitter;
            if (_apply(logs[i].topics[0], logs[i].data)) count++;
        }

        _selected = restore;
    }

    /// @notice Declares a handle's cleartext directly, for values that entered play before recording
    ///         started, came from a route that emits nothing, or were drawn randomly.
    /// @dev    Always wins: an explicitly set handle is `Known`, so no policy below applies to it. This
    ///         is the per-handle form of "the developer decides"; `useFixedUnknownHandles` is the
    ///         blanket form.
    function seedCleartext(bytes32 handle, uint256 value) public {
        db().set(handle, value);
    }

    // -----------------------------------------------------------------------
    // Unknown handles — see `FhevmCleartextEventProcessorDB.UnknownHandlePolicy`
    // -----------------------------------------------------------------------

    /// @notice Refuse handles no event produced. The default, and right when the test owns every value.
    function revertOnUnknownHandles() public {
        db().setUnknownHandlePolicy(FhevmCleartextEventProcessorDB.UnknownHandlePolicy.Revert, 0, 0);
    }

    /// @notice Answer unknown handles from `keccak256(handle)`, clamped to the handle's type.
    /// @dev    The one to reach for on a fork: reproducible run to run, so an assertion can be pinned
    ///         to a number `synthesize` will predict.
    function useDeterministicUnknownHandles() public {
        db().setUnknownHandlePolicy(FhevmCleartextEventProcessorDB.UnknownHandlePolicy.Deterministic, 0, 0);
    }

    /// @notice Same, salted with a fresh draw, so the numbers differ between runs.
    /// @dev    The draw happens HERE, once — not per read — so the store stays a pure function and two
    ///         reads of one handle cannot disagree. That is what lets a synthesised balance be used in
    ///         arithmetic at all.
    function useRandomUnknownHandles() public {
        db()
            .setUnknownHandlePolicy(
                FhevmCleartextEventProcessorDB.UnknownHandlePolicy.Random, fvmRandom.randomUint(), 0
            );
    }

    /// @notice Answer every unknown handle with `value`, clamped to each handle's type.
    function useFixedUnknownHandles(uint256 value) public {
        db().setUnknownHandlePolicy(FhevmCleartextEventProcessorDB.UnknownHandlePolicy.Fixed, 0, value);
    }

    /// @notice What the store knows about `handle`, without reverting. `plaintexts` is the read.
    function statusOf(bytes32 handle) public view returns (FhevmCleartextEventProcessorDB.Status) {
        return db().statusOf(handle);
    }

    // -----------------------------------------------------------------------
    // Dispatch — selector to `record*`, and nothing else
    // -----------------------------------------------------------------------

    /// @dev Returns whether the topic was one this processor understands.
    function _apply(bytes32 topic, bytes memory data) private returns (bool) {
        Operators op;
        bool isBinary = true;

        if (topic == FheAdd.selector) op = Operators.fheAdd;
        else if (topic == FheSub.selector) op = Operators.fheSub;
        else if (topic == FheMul.selector) op = Operators.fheMul;
        else if (topic == FheDiv.selector) op = Operators.fheDiv;
        else if (topic == FheRem.selector) op = Operators.fheRem;
        else if (topic == FheBitAnd.selector) op = Operators.fheBitAnd;
        else if (topic == FheBitOr.selector) op = Operators.fheBitOr;
        else if (topic == FheBitXor.selector) op = Operators.fheBitXor;
        else if (topic == FheShl.selector) op = Operators.fheShl;
        else if (topic == FheShr.selector) op = Operators.fheShr;
        else if (topic == FheRotl.selector) op = Operators.fheRotl;
        else if (topic == FheRotr.selector) op = Operators.fheRotr;
        else if (topic == FheEq.selector) op = Operators.fheEq;
        else if (topic == FheNe.selector) op = Operators.fheNe;
        else if (topic == FheGe.selector) op = Operators.fheGe;
        else if (topic == FheGt.selector) op = Operators.fheGt;
        else if (topic == FheLe.selector) op = Operators.fheLe;
        else if (topic == FheLt.selector) op = Operators.fheLt;
        else if (topic == FheMin.selector) op = Operators.fheMin;
        else if (topic == FheMax.selector) op = Operators.fheMax;
        else isBinary = false;

        if (isBinary) {
            _applyBinary(op, data);
            return true;
        }

        if (topic == FheNeg.selector) return _applyUnary(Operators.fheNeg, data);
        if (topic == FheNot.selector) return _applyUnary(Operators.fheNot, data);
        if (topic == FheSum.selector) return _applySum(data);
        if (topic == FheIsIn.selector) return _applyIsIn(data);
        if (topic == FheIfThenElse.selector) return _applyIfThenElse(data);
        if (topic == Cast.selector) return _applyCast(data);
        if (topic == TrivialEncrypt.selector) return _applyTrivialEncrypt(data);
        if (topic == FheRand.selector) return _applyRand(data);
        if (topic == FheRandBounded.selector) return _applyRandBounded(data);
        if (topic == VerifyInput.selector) return _applyVerifyInput(data);

        return false;
    }

    /// @dev `CleartextFHEVMExecutor` records binary ops with `_typeOf(lhs)`, so the width comes off the
    ///      LHS handle and not the result: a comparison returns a Bool but operates at the operands'
    ///      width. Every other handler below reads its type the same way the executor recorded it.
    function _applyBinary(Operators op, bytes memory data) private {
        (bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result) =
            abi.decode(data, (bytes32, bytes32, bytes1, bytes32));

        recordBinaryOp(op, result, lhs, rhs, scalarByte, LibFhevmHandle.typeOf(lhs));
    }

    function _applyUnary(Operators op, bytes memory data) private returns (bool) {
        (bytes32 ct, bytes32 result) = abi.decode(data, (bytes32, bytes32));

        recordUnaryOp(op, result, ct, LibFhevmHandle.typeOf(ct));
        return true;
    }

    /// @dev `fheSum` is recorded with the RESULT's type, and with `bytes32(0)` where a needle would go.
    function _applySum(bytes memory data) private returns (bool) {
        (bytes32[] memory values, bytes32 result) = abi.decode(data, (bytes32[], bytes32));

        recordNaryOp(Operators.fheSum, result, bytes32(0), values, LibFhevmHandle.typeOf(result));
        return true;
    }

    /// @dev `fheIsIn` is recorded with the NEEDLE's type.
    function _applyIsIn(bytes memory data) private returns (bool) {
        (bytes32 value, bytes32[] memory values, bytes32 result) = abi.decode(data, (bytes32, bytes32[], bytes32));

        recordNaryOp(Operators.fheIsIn, result, value, values, LibFhevmHandle.typeOf(value));
        return true;
    }

    function _applyIfThenElse(bytes memory data) private returns (bool) {
        (bytes32 control, bytes32 ifTrue, bytes32 ifFalse, bytes32 result) =
            abi.decode(data, (bytes32, bytes32, bytes32, bytes32));

        recordTernaryOp(Operators.fheIfThenElse, result, control, ifTrue, ifFalse);
        return true;
    }

    function _applyCast(bytes memory data) private returns (bool) {
        (bytes32 ct, FheType toType, bytes32 result) = abi.decode(data, (bytes32, FheType, bytes32));

        recordCast(result, ct, toType);
        return true;
    }

    function _applyTrivialEncrypt(bytes memory data) private returns (bool) {
        (uint256 pt, FheType toType, bytes32 result) = abi.decode(data, (uint256, FheType, bytes32));

        recordTrivialEncrypt(result, pt, toType);
        return true;
    }

    /// @dev THE ONE OPERATION EVENTS CANNOT CARRY, and so the one handler that does not forward to a
    ///      `record*`. `FheRand` announces `(randType, seed, result)`, and for the plain
    ///      `CleartextArithmetic` the value really is a function of the seed — but the forge payload
    ///      deploys `CleartextForgeArithmetic`, which overrides `randomUint256` to `vmSafe.randomUint()`,
    ///      a draw that depends on nothing in the event. Calling `recordRand` here would derive from
    ///      the seed and store a number that looks right and is not the one the chain holds.
    ///
    ///      So the handle is marked, not valued: `statusOf` reports `NonReplayable`, and the read
    ///      answers 0 until a value arrives. A test that needs the value reads it from the host once
    ///      and calls `seedCleartext`, which overwrites the mark.
    function _applyRand(bytes memory data) private returns (bool) {
        (,, bytes32 result) = abi.decode(data, (FheType, bytes16, bytes32));

        _recordRandomResult(result);
        return true;
    }

    /// @dev Same as `_applyRand`: `randomBoundedUint256` is overridden the same way.
    function _applyRandBounded(bytes memory data) private returns (bool) {
        (,,, bytes32 result) = abi.decode(data, (uint256, FheType, bytes16, bytes32));

        _recordRandomResult(result);
        return true;
    }

    /// @dev A drawn value is the one thing no event carries. With an UPSTREAM there is somewhere to
    ///      fetch it from, so the handle is left for the lookup to resolve; without one it is marked,
    ///      so that reading it says so rather than answering with a number derived from the seed.
    function _recordRandomResult(bytes32 result) private {
        if (db().upstream() == address(0)) db().markNonReplayable(result);
    }

    /// @dev Where cleartexts ENTER the replay. An encrypted input has no producing operation — its
    ///      value rides along in the proof, which is why the event carries the proof at all.
    ///      `recordVerifyInput` silently writes nothing when the proof holds no cleartext for this
    ///      handle, so that case is caught here instead of surfacing later as an unknown handle.
    function _applyVerifyInput(bytes memory data) private returns (bool) {
        (bytes32 inputHandle,, bytes memory inputProof, FheType inputType, bytes32 result) =
            abi.decode(data, (bytes32, address, bytes, FheType, bytes32));

        (bool found,) = _tryReadCleartextFromProof(inputHandle, inputProof);
        if (!found) revert CleartextEventProofWithoutCleartext(inputHandle);

        recordVerifyInput(result, inputHandle, inputProof, inputType);
        return true;
    }
}
