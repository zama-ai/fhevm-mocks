// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {ForgeFhevmDeploy} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {CLEARTEXT_ARITHMETIC_ADDRESS, FHEVM_EXECUTOR_ADDRESS} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {ICleartextArithmetic} from "../../pkg/forge/src/_internal/interfaces/ICleartextArithmetic.sol";
import {ICleartextFHEVMExecutor} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {ForgeFhevmEventProcessor, ForgeFhevmEventProcessorDB} from "../../pkg/forge/src/ForgeFhevmEventProcessor.sol";
import {FheType} from "../../pkg/forge/src/shared/LibFheType.sol";
import {ICleartextDB} from "../../pkg/forge/src/shared/interfaces/ICleartextDB.sol";
import {Operators} from "../../pkg/forge/src/shared/FhevmOperatorsEnum.sol";
import {LibFhevmEvents} from "../../pkg/forge/src/shared/FhevmEvents.sol";

/// Stands in for a SECOND chain's executor: it emits the same events at a different address, which is
/// all the processor cares about. Cheaper and more pointed than a second fork.
contract OtherChainExecutor {
    function trivialEncrypt(uint256 pt, FheType toType, bytes32 result) external {
        emit LibFhevmEvents.TrivialEncrypt(msg.sender, pt, toType, result);
    }

    function rand(FheType randType, bytes16 seed, bytes32 result) external {
        emit LibFhevmEvents.FheRand(msg.sender, randType, seed, result);
    }
}

/// The replay must agree with the DB the on-chain mock actually wrote — that is the whole claim, so
/// every case asserts BOTH: the expected value, and that the processor's own store matches the host's.
contract ForgeFhevmEventProcessorTest is Test, ForgeFhevmDeploy {
    ICleartextArithmetic internal arithmetic;
    ICleartextFHEVMExecutor internal executor;
    ForgeFhevmEventProcessor internal processor;

    function setUp() public {
        deployLocalFhevm();
        arithmetic = ICleartextArithmetic(CLEARTEXT_ARITHMETIC_ADDRESS);
        executor = ICleartextFHEVMExecutor(FHEVM_EXECUTOR_ADDRESS);

        processor = new ForgeFhevmEventProcessor();
        processor.addExecutor(FHEVM_EXECUTOR_ADDRESS);
        processor.startRecordingFheEvents();
    }

    function _assertAgrees(bytes32 handle, uint256 expected) private {
        processor.processFheEvents();
        assertEq(processor.plaintexts(handle), expected, "replayed from events");
        assertEq(arithmetic.plaintexts(handle), expected, "recorded on chain");
    }

    /// The pair is deployed together: the processor owns its store and is its only writer.
    function test_theProcessorAndItsStoreArePaired() public view {
        assertEq(processor.getCleartextDBAddress(), address(processor.db()));
        assertEq(processor.db().writer(), address(processor));
        assertTrue(processor.db().isWriter(address(processor)));
        assertFalse(processor.db().isWriter(address(this)));
        assertTrue(processor.getCleartextDBAddress() != CLEARTEXT_ARITHMETIC_ADDRESS);
    }

    function test_theWriterSetIsFixed() public {
        // Hoisted: `processor.db()` is itself an external call and would consume the expectRevert.
        ForgeFhevmEventProcessorDB store = processor.db();

        vm.expectRevert(ForgeFhevmEventProcessorDB.CleartextEventWriterSetIsFixed.selector);
        store.addWriter(address(this));
    }

    function test_onlyTheProcessorMayWrite() public {
        ForgeFhevmEventProcessorDB store = processor.db();

        vm.expectRevert(abi.encodeWithSelector(ICleartextDB.CleartextErrorNotWriter.selector, address(this)));
        store.set(keccak256("x"), 1);
    }

    function test_trivialEncrypt() public {
        _assertAgrees(executor.trivialEncrypt(42, FheType.Uint32), 42);
    }

    function test_binaryOpBetweenTwoHandles() public {
        bytes32 a = executor.trivialEncrypt(1000, FheType.Uint32);
        bytes32 b = executor.trivialEncrypt(337, FheType.Uint32);

        _assertAgrees(executor.fheAdd(a, b, 0x00), 1337);
    }

    function test_binaryOpWithAScalar() public {
        bytes32 a = executor.trivialEncrypt(21, FheType.Uint32);

        _assertAgrees(executor.fheMul(a, bytes32(uint256(2)), 0x01), 42);
    }

    /// The width comes off the LHS handle, so an overflow wraps at the operand type, not at uint256.
    function test_binaryOpWrapsAtTheOperandWidth() public {
        bytes32 a = executor.trivialEncrypt(200, FheType.Uint8);

        _assertAgrees(executor.fheAdd(a, bytes32(uint256(100)), 0x01), 44);
    }

    /// A comparison returns a Bool while operating at the operands' width.
    function test_comparisonReturnsABool() public {
        bytes32 a = executor.trivialEncrypt(7, FheType.Uint64);
        bytes32 b = executor.trivialEncrypt(7, FheType.Uint64);

        _assertAgrees(executor.fheEq(a, b, 0x00), 1);
    }

    function test_unaryOp() public {
        bytes32 a = executor.trivialEncrypt(0, FheType.Uint8);

        _assertAgrees(executor.fheNot(a), 255);
    }

    function test_cast() public {
        bytes32 a = executor.trivialEncrypt(300, FheType.Uint16);

        _assertAgrees(executor.cast(a, FheType.Uint8), 44);
    }

    function test_ifThenElse() public {
        bytes32 control = executor.trivialEncrypt(1, FheType.Bool);
        bytes32 ifTrue = executor.trivialEncrypt(11, FheType.Uint32);
        bytes32 ifFalse = executor.trivialEncrypt(22, FheType.Uint32);

        _assertAgrees(executor.fheIfThenElse(control, ifTrue, ifFalse), 11);
    }

    function test_sum() public {
        bytes32[] memory values = new bytes32[](3);
        values[0] = executor.trivialEncrypt(1, FheType.Uint32);
        values[1] = executor.trivialEncrypt(2, FheType.Uint32);
        values[2] = executor.trivialEncrypt(3, FheType.Uint32);

        _assertAgrees(executor.fheSum(values, FheType.Uint32), 6);
    }

    function test_isIn() public {
        bytes32[] memory values = new bytes32[](2);
        values[0] = executor.trivialEncrypt(5, FheType.Uint32);
        values[1] = executor.trivialEncrypt(9, FheType.Uint32);
        bytes32 needle = executor.trivialEncrypt(9, FheType.Uint32);

        _assertAgrees(executor.fheIsIn(needle, values, FheType.Uint32), 1);
    }

    /// A chain of ops: every intermediate has to be right for the last one to be.
    function test_aChainOfOperations() public {
        bytes32 a = executor.trivialEncrypt(100, FheType.Uint32);
        bytes32 b = executor.fheMul(a, bytes32(uint256(3)), 0x01);
        bytes32 c = executor.fheAdd(b, bytes32(uint256(37)), 0x01);

        _assertAgrees(c, 337);
    }

    /// The forge host draws randomness from a cheatcode, so the value is nowhere in the event. The
    /// replay marks the handle rather than recomputing a plausible wrong number from the seed — and
    /// the mark, not the read, is what says so.
    function test_randComesFromTheUpstream() public {
        bytes32 r = executor.fheRand(FheType.Uint16);
        processor.processFheEvents();

        // A draw is the one thing no event carries. Against a cleartext executor there is somewhere to
        // fetch it from, so it is never marked and never guessed — it is simply the real value.
        assertTrue(processor.statusOf(r) != ForgeFhevmEventProcessorDB.Status.NonReplayable);
        assertEq(processor.plaintexts(r), arithmetic.plaintexts(r), "the host's own draw");
        assertTrue(arithmetic.plaintexts(r) != 0, "and it really did draw something");
    }

    /// Without an upstream to ask, the same draw is marked rather than guessed from the seed.
    function test_randIsMarkedWhenThereIsNoUpstream() public {
        ForgeFhevmEventProcessor p = new ForgeFhevmEventProcessor();
        p.addExecutor(address(new OtherChainExecutor()));
        p.startRecordingFheEvents();

        bytes32 r = bytes32((uint256(keccak256("rand")) >> 96 << 96) | (uint256(SEPOLIA) << 16) | (3 << 8));
        OtherChainExecutor(p.executors()[0]).rand(FheType.Uint16, bytes16(0), r);
        p.processFheEvents();

        assertTrue(p.statusOf(r) == ForgeFhevmEventProcessorDB.Status.NonReplayable);
    }

    /// Seeding a random handle from the host makes it usable again, including as an operand.
    function test_aSeededRandomHandleBecomesUsable() public {
        bytes32 r = executor.fheRand(FheType.Uint16);
        processor.processFheEvents();
        processor.seedCleartext(r, arithmetic.plaintexts(r));

        assertTrue(processor.statusOf(r) == ForgeFhevmEventProcessorDB.Status.Known);
        _assertAgrees(executor.fheAdd(r, bytes32(uint256(0)), 0x01), arithmetic.plaintexts(r));
    }

    /// A handle the replay never saw is still answered, because a CLEARTEXT executor holds it and is
    /// asked. This is the forked-cleartext case in miniature: nothing is synthesised, the store simply
    /// defers to the stack that has the values.
    function test_anUnprocessedHandleComesFromTheUpstream() public {
        bytes32 stranger = executor.trivialEncrypt(7, FheType.Uint32);
        // Deliberately NOT processed: the events are still sitting in the recorder.

        assertTrue(processor.statusOf(stranger) == ForgeFhevmEventProcessorDB.Status.Unset);
        assertEq(processor.plaintexts(stranger), 7, "answered by the cleartext stack itself");
    }

    /// A handle that exists NOWHERE — not in the replay, not in the cleartext stack — is still refused
    /// by name. The upstream runs ahead of the policy but does not swallow it: `hasPlaintext` reports
    /// honestly, so a miss upstream really is a miss.
    function test_aHandleNobodyHasIsRefused() public {
        bytes32 stranger = bytes32((uint256(keccak256("nowhere")) >> 96 << 96) | (uint256(block.chainid) << 16));

        assertFalse(arithmetic.hasPlaintext(stranger), "not in the cleartext stack either");

        vm.expectRevert(
            abi.encodeWithSelector(ForgeFhevmEventProcessorDB.CleartextEventUnknownHandle.selector, stranger)
        );
        processor.plaintexts(stranger);
    }

    /// And the distinction that makes it possible: a handle whose value IS zero is not a missing one.
    function test_aHandleWorthZeroIsNotAMissingHandle() public {
        bytes32 zero = executor.trivialEncrypt(0, FheType.Uint32);

        assertTrue(arithmetic.hasPlaintext(zero), "written, and worth zero");
        assertEq(processor.plaintexts(zero), 0, "answered, not refused");
    }

    // -- Multi-chain ---------------------------------------------------------------

    /// The store is keyed by the chain in the handle, so the same 21-byte body from two chains lands
    /// in two slots rather than overwriting one.
    function test_twoChainsDoNotCollide() public {
        bytes32 local = executor.trivialEncrypt(111, FheType.Uint32);
        processor.processFheEvents();

        uint64 here = uint64(block.chainid);
        uint64 elsewhere = here + 1;
        bytes32 foreign = _withChainId(local, elsewhere);

        assertEq(processor.db().chainIdOf(local), here);
        assertEq(processor.db().chainIdOf(foreign), elsewhere);

        // A handle from another chain is accepted, and does not disturb the local one.
        processor.seedCleartext(foreign, 222);

        assertEq(processor.plaintexts(local), 111, "local slot untouched");
        assertEq(processor.plaintexts(foreign), 222, "foreign slot is its own");
        assertEq(processor.db().getForChain(here, local), 111);
        assertEq(processor.db().getForChain(elsewhere, foreign), 222);
    }

    /// A foreign handle is unknown until something writes it — not silently answered from another
    /// chain's slot.
    function test_aForeignHandleStartsUnknown() public {
        bytes32 local = executor.trivialEncrypt(111, FheType.Uint32);
        processor.processFheEvents();
        bytes32 foreign = _withChainId(local, uint64(block.chainid) + 1);

        assertTrue(processor.statusOf(foreign) == ForgeFhevmEventProcessorDB.Status.Unset);

        vm.expectRevert(
            abi.encodeWithSelector(ForgeFhevmEventProcessorDB.CleartextEventUnknownHandle.selector, foreign)
        );
        processor.plaintexts(foreign);
    }

    /// The host's own store still refuses what this one accepts — the relaxation is the processor's,
    /// not the arithmetic's.
    function test_theHostStillRefusesForeignHandles() public {
        bytes32 local = executor.trivialEncrypt(111, FheType.Uint32);
        bytes32 foreign = _withChainId(local, uint64(block.chainid) + 1);

        vm.expectRevert();
        arithmetic.plaintexts(foreign);
    }

    /// @dev Rewrites bytes 22..29, the chain field, leaving every other field intact.
    function _withChainId(bytes32 handle, uint64 chainId) private pure returns (bytes32) {
        uint256 cleared = uint256(handle) & ~(uint256(type(uint64).max) << 16);
        return bytes32(cleared | (uint256(chainId) << 16));
    }

    // -- Unknown handles, the forked-chain case -------------------------------------
    //
    // Fork Sepolia and Polygon Amoy, read `balanceOf` from a ConfidentialERC20 already deployed on
    // each, and you hold two real handles whose values were minted before the fork block. No event
    // exists for either, and nothing in a handle says how old it is. These are the ways to give them
    // a value anyway.

    uint64 internal constant SEPOLIA = 11_155_111;
    uint64 internal constant AMOY = 80_002;

    /// A handle shaped like one read off a forked chain: right chain, right type, body we never saw.
    function _foreignHandle(uint64 chainId, FheType fheType, uint256 nonce) private pure returns (bytes32) {
        uint256 body = uint256(keccak256(abi.encodePacked("pre-fork balance", chainId, nonce))) >> 96;
        return bytes32((body << 96) | (uint256(chainId) << 16) | (uint256(uint8(fheType)) << 8));
    }

    /// The default stands: an unknown handle is refused rather than invented.
    function test_unknownHandlesRevertByDefault() public {
        bytes32 sepoliaBalance = _foreignHandle(SEPOLIA, FheType.Uint64, 1);

        vm.expectRevert(
            abi.encodeWithSelector(ForgeFhevmEventProcessorDB.CleartextEventUnknownHandle.selector, sepoliaBalance)
        );
        processor.plaintexts(sepoliaBalance);
    }

    /// Deterministic: stable across reads, different per handle, and reproducible run to run.
    function test_deterministicUnknownHandles() public {
        processor.useDeterministicUnknownHandles();

        bytes32 sepoliaBalance = _foreignHandle(SEPOLIA, FheType.Uint64, 1);
        bytes32 amoyBalance = _foreignHandle(AMOY, FheType.Uint64, 1);

        uint256 a = processor.plaintexts(sepoliaBalance);
        uint256 b = processor.plaintexts(amoyBalance);

        assertEq(processor.plaintexts(sepoliaBalance), a, "same handle, same value");
        assertTrue(a != b, "two chains, two values");
        assertEq(processor.db().synthesize(sepoliaBalance), a, "predictable before reading");
    }

    /// Clamped to the handle's own type, so a synthesised euint8 balance is a uint8.
    function test_synthesisedValuesAreClampedToTheHandleType() public {
        processor.useDeterministicUnknownHandles();

        assertLt(processor.plaintexts(_foreignHandle(SEPOLIA, FheType.Uint8, 2)), 1 << 8);
        assertLt(processor.plaintexts(_foreignHandle(SEPOLIA, FheType.Uint16, 2)), 1 << 16);
        assertLt(processor.plaintexts(_foreignHandle(SEPOLIA, FheType.Uint32, 2)), 1 << 32);

        uint256 flag = processor.plaintexts(_foreignHandle(SEPOLIA, FheType.Bool, 2));
        assertTrue(flag == 0 || flag == 1, "an ebool reads as 0 or 1");
    }

    /// Random: a different number from the deterministic one, still stable within the run.
    function test_randomUnknownHandles() public {
        bytes32 h = _foreignHandle(SEPOLIA, FheType.Uint64, 3);

        processor.useDeterministicUnknownHandles();
        uint256 deterministic = processor.plaintexts(h);

        processor.useRandomUnknownHandles();
        uint256 drawn = processor.plaintexts(h);

        assertTrue(drawn != deterministic, "salted away from the unsalted hash");
        assertEq(processor.plaintexts(h), drawn, "stable within the run");
    }

    /// Fixed: every unknown handle is the value the developer chose.
    function test_fixedUnknownHandles() public {
        processor.useFixedUnknownHandles(1_000_000);

        assertEq(processor.plaintexts(_foreignHandle(SEPOLIA, FheType.Uint64, 4)), 1_000_000);
        assertEq(processor.plaintexts(_foreignHandle(AMOY, FheType.Uint64, 5)), 1_000_000);
        assertEq(processor.plaintexts(_foreignHandle(AMOY, FheType.Uint8, 6)), 1_000_000 % 256, "clamped");
    }

    /// A seeded handle beats the policy: the per-handle answer wins over the blanket one.
    function test_aSeededHandleBeatsThePolicy() public {
        processor.useFixedUnknownHandles(1_000_000);
        bytes32 h = _foreignHandle(SEPOLIA, FheType.Uint64, 7);

        processor.seedCleartext(h, 42);

        assertEq(processor.plaintexts(h), 42);
        assertTrue(processor.statusOf(h) == ForgeFhevmEventProcessorDB.Status.Known);
    }

    /// THE SCENARIO: a dApp adds a Sepolia balance to an Amoy one. Neither operand was ever seen, both
    /// are synthesised, and the result is a real recorded value the dApp's own assertions can use.
    function test_aDappCombinesBalancesFromTwoForkedChains() public {
        processor.useDeterministicUnknownHandles();

        bytes32 sepoliaBalance = _foreignHandle(SEPOLIA, FheType.Uint64, 8);
        bytes32 amoyBalance = _foreignHandle(AMOY, FheType.Uint64, 8);
        bytes32 total = _foreignHandle(uint64(block.chainid), FheType.Uint64, 9);

        uint256 a = processor.plaintexts(sepoliaBalance);
        uint256 b = processor.plaintexts(amoyBalance);
        // Modular at the operand width, exactly as the coprocessor is: two synthesised euint64s can
        // easily sum past 2^64, and wrapping is the right answer, not an overflow to catch.
        uint256 expected = uint64(a + b);

        processor.recordBinaryOp(Operators.fheAdd, total, sepoliaBalance, amoyBalance, 0x00, FheType.Uint64);

        assertTrue(a + b > type(uint64).max, "these two really do overflow");
        assertEq(processor.plaintexts(total), expected, "the sum of two values nobody knew");
        assertTrue(processor.statusOf(total) == ForgeFhevmEventProcessorDB.Status.Known);
    }

    // -- Several executors ----------------------------------------------------------

    /// The set starts with the constructor's executor and grows.
    function test_theExecutorSetIsASet() public {
        assertTrue(processor.isExecutor(FHEVM_EXECUTOR_ADDRESS));
        assertEq(processor.executors().length, 1);

        address other = address(new OtherChainExecutor());
        processor.addExecutor(other);

        assertTrue(processor.isExecutor(other));
        assertEq(processor.executors().length, 2);
        assertEq(processor.executors()[0], FHEVM_EXECUTOR_ADDRESS);
        assertEq(processor.executors()[1], other);
    }

    /// A duplicate would apply every one of that executor's events twice.
    function test_aDuplicateExecutorIsRefused() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                ForgeFhevmEventProcessor.CleartextEventDuplicateExecutor.selector, FHEVM_EXECUTOR_ADDRESS
            )
        );
        processor.addExecutor(FHEVM_EXECUTOR_ADDRESS);
    }

    function test_aNullExecutorIsRefused() public {
        vm.expectRevert(ForgeFhevmEventProcessor.CleartextEventNullExecutor.selector);
        processor.addExecutor(address(0));
    }

    /// TWO EXECUTORS, TWO STORES. One interleaved log stream, and each event lands in ITS OWN
    /// executor's store — whichever one the caller happened to have selected.
    function test_eachExecutorKeepsItsOwnStore() public {
        OtherChainExecutor other = new OtherChainExecutor();
        processor.addExecutor(address(other));

        bytes32 here = executor.trivialEncrypt(111, FheType.Uint32);
        bytes32 there = bytes32((uint256(keccak256("elsewhere")) >> 96 << 96) | (uint256(SEPOLIA) << 16) | (4 << 8));
        other.trivialEncrypt(222, FheType.Uint32, there);

        assertEq(processor.processFheEvents(), 2, "one event from each executor");

        // Each value is in its own executor's store, and in neither of the other's.
        assertEq(processor.dbOf(FHEVM_EXECUTOR_ADDRESS).get(here), 111);
        assertEq(processor.dbOf(address(other)).get(there), 222);
        assertTrue(
            processor.dbOf(address(other)).statusOf(here) == ForgeFhevmEventProcessorDB.Status.Unset,
            "not in the other store"
        );
        assertTrue(
            processor.dbOf(FHEVM_EXECUTOR_ADDRESS).statusOf(there) == ForgeFhevmEventProcessorDB.Status.Unset,
            "nor the reverse"
        );

        assertEq(processor.dbOf(address(other)).chainIdOf(there), SEPOLIA, "kept under its own chain");
    }

    /// Replaying restores whatever the caller had selected, so it is a reading convenience only.
    function test_selectingAnExecutorSurvivesAReplay() public {
        OtherChainExecutor other = new OtherChainExecutor();
        processor.addExecutor(address(other));

        assertEq(processor.selectedExecutor(), FHEVM_EXECUTOR_ADDRESS, "the first one added");
        processor.selectExecutor(address(other));

        bytes32 here = executor.trivialEncrypt(111, FheType.Uint32);
        processor.processFheEvents();

        assertEq(processor.selectedExecutor(), address(other), "restored after the replay");
        assertEq(address(processor.db()), address(processor.dbOf(address(other))));

        // The unqualified read follows the selection, so it does not see the other store's handle.
        vm.expectRevert(abi.encodeWithSelector(ForgeFhevmEventProcessorDB.CleartextEventUnknownHandle.selector, here));
        processor.plaintexts(here);
    }

    /// The stores are configured independently — a policy on one is not a policy on the other.
    function test_policyIsPerExecutor() public {
        OtherChainExecutor other = new OtherChainExecutor();
        processor.addExecutor(address(other));

        processor.useFixedUnknownHandles(777); // applies to the SELECTED executor only
        bytes32 stranger = bytes32((uint256(keccak256("x")) >> 96 << 96) | (uint256(SEPOLIA) << 16) | (5 << 8));

        assertEq(processor.dbOf(FHEVM_EXECUTOR_ADDRESS).get(stranger), 777);

        // Hoisted: `dbOf` is itself an external call and would consume the expectRevert.
        ForgeFhevmEventProcessorDB otherStore = processor.dbOf(address(other));

        vm.expectRevert(
            abi.encodeWithSelector(ForgeFhevmEventProcessorDB.CleartextEventUnknownHandle.selector, stranger)
        );
        otherStore.get(stranger);
    }

    function test_anUnknownExecutorHasNoStore() public {
        vm.expectRevert(
            abi.encodeWithSelector(ForgeFhevmEventProcessor.CleartextEventUnknownExecutor.selector, address(0xBEEF))
        );
        processor.dbOf(address(0xBEEF));
    }

    /// An emitter that was never added stays ignored, however well-formed its events look.
    function test_anUnregisteredEmitterIsIgnored() public {
        OtherChainExecutor stranger = new OtherChainExecutor();

        bytes32 h = bytes32((uint256(keccak256("stranger")) >> 96 << 96) | (uint256(SEPOLIA) << 16) | (4 << 8));
        stranger.trivialEncrypt(999, FheType.Uint32, h);

        assertEq(processor.processFheEvents(), 0, "not an executor");
        assertTrue(processor.statusOf(h) == ForgeFhevmEventProcessorDB.Status.Unset);
    }

    /// Only the executor's events are replayed; everything else in the log stream is ignored.
    function test_countsOnlyExecutorEvents() public {
        emit log("noise from the test itself");
        bytes32 a = executor.trivialEncrypt(1, FheType.Uint32);

        assertEq(processor.processFheEvents(), 1, "one TrivialEncrypt, and nothing else");
        assertEq(processor.plaintexts(a), 1);
    }

    // -- An empty processor -----------------------------------------------------------------------

    /// A processor is legitimately empty: construction adds no executor, because which one it should
    /// listen to is not a property of existing.
    function test_aProcessorCanExistWithNoExecutor() public {
        ForgeFhevmEventProcessor empty = new ForgeFhevmEventProcessor();

        assertEq(empty.executors().length, 0, "none registered");
        assertEq(empty.selectedExecutor(), address(0), "and none selected");
    }

    /// Asking such a processor for a store names the state rather than handing back a zero address.
    function test_anEmptyProcessorHasNoStore() public {
        ForgeFhevmEventProcessor empty = new ForgeFhevmEventProcessor();

        vm.expectRevert(ForgeFhevmEventProcessor.CleartextEventNoExecutor.selector);
        empty.db();
    }

    /// And it becomes usable the moment one is added — the first added is the selected one.
    function test_anExecutorCanBeAddedAfterConstruction() public {
        ForgeFhevmEventProcessor empty = new ForgeFhevmEventProcessor();
        address executor = address(new OtherChainExecutor());

        empty.addExecutor(executor);

        assertEq(empty.selectedExecutor(), executor);
        assertTrue(address(empty.db()) != address(0), "a store of its own");
    }
}
