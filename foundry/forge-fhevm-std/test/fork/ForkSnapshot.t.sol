// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {euint32, externalEuint32} from "encrypted-types/EncryptedTypes.sol";

import {TestFhevm} from "../../pkg/src/TestFhevm.sol";
import {LibFhevmProtocol} from "../../pkg/src/LibFhevmProtocol.sol";
import {LibFhevmFail} from "../../pkg/src/LibFhevmFail.sol";
import {fhevm, NO_FORK} from "../../pkg/src/FhevmVm.sol";

import {FHECounterPublicDecrypt} from "../examples/contracts/FHECounterPublicDecrypt.sol";

interface IFHETest {
    function getEuint32Of(address account) external view returns (euint32);
    function addEuint32(externalEuint32 input, bytes calldata inputProof, uint32 clearValue, bool makePublic) external;
}

/**
 * @notice SNAPSHOTS AND FORKS, SHAKEN TOGETHER. Both move the test between execution contexts, forge moves
 *         them by different rules, and one combination it cannot do at all. This suite is the combinations,
 *         not the happy path.
 *
 * @dev WHAT FORGE ACTUALLY DOES, measured with none of this SDK involved, before any of it was written:
 *        - an ordinary snapshot and revert, with no fork anywhere, restores everything;
 *        - a snapshot taken ON a fork restores that fork and its state correctly, whether the revert comes
 *          from that same fork or from another one;
 *        - a snapshot taken BEFORE any fork does NOT come back. The revert restores only the storage SLOTS
 *          this test happened to read beforehand, one slot at a time: a contract deployed in a constructor,
 *          an implementation behind a proxy, a signer set nobody read, all come back EMPTY. On top of that
 *          `vm.activeFork()` keeps naming the old fork, selecting it does nothing, and a fork created
 *          afterwards carries the right chain id with none of its chain's state.
 *      So `fhevm.snapshotState()` / `fhevm.revertToState()` support the first two and REFUSE the third by
 *      name, before the revert rather than after it. There is nothing to reconcile there: what comes back
 *      is not what was captured, and a test that carried on would be testing a chain that only looks right.
 *
 *          SEPOLIA_RPC_URL=... forge test --match-contract ForkSnapshot
 */
contract ForkSnapshotTest is TestFhevm {
    IFHETest internal constant FHE_TEST = IFHETest(0x94B9d3aF050687D1F76251aD7D09a1F216a19845);
    address internal constant SENDER = 0x37AC010c1c566696326813b840319B58Bb5840E4;

    FhevmChain internal sepolia;
    address internal alice;
    bool internal forked;

    function setUp() public override {
        alice = makeAddr("alice");
        if (!fhevm.hasRpcUrlFor("sepolia")) return;
        sepolia = getFhevmChain("testnet", "sepolia");
        forked = true;
    }

    // -- In memory only: the pair must not disturb a test that never forks ---------------------------

    /// A snapshot and a revert with no fork anywhere: the local stack is untouched and still works.
    function test_inMemory_snapshotAndRevertKeepsTheLocalStack() public {
        assertTrue(LibFhevmProtocol.currentConfig().isCleartext);
        uint256 snap = fhevm.snapshotState();

        FHECounterPublicDecrypt counter = new FHECounterPublicDecrypt();
        _increment(counter, 5);
        assertEq(decryptPublic(counter.getCount()), 5);

        assertTrue(fhevm.revertToState(snap));

        assertFalse(fhevm.isForked(), "still in memory");
        assertEq(fhevm.currentForkId(), NO_FORK);
        assertTrue(LibFhevmProtocol.currentConfig().isCleartext, "the local stack survived");
        // and it still works: the counter above is gone with the revert, so a fresh one decrypts fine
        FHECounterPublicDecrypt fresh = new FHECounterPublicDecrypt();
        _increment(fresh, 9);
        assertEq(decryptPublic(fresh.getCount()), 9);
    }

    /// The replay is restored with everything else: a handle announced before the snapshot is still known.
    function test_inMemory_aHandleFromBeforeTheSnapshotSurvives() public {
        FHECounterPublicDecrypt counter = new FHECounterPublicDecrypt();
        _increment(counter, 3);
        euint32 before = counter.getCount();

        uint256 snap = fhevm.snapshotState();
        _increment(counter, 4); // 7
        assertEq(decryptPublic(counter.getCount()), 7);

        fhevm.revertToState(snap);
        assertEq(decryptPublic(before), 3, "the pre-snapshot value is intact");
        assertEq(decryptPublic(counter.getCount()), 3, "and the dApp is back at 3");
    }

    /// Nested snapshots, reverted innermost first and then outermost.
    function test_inMemory_nestedSnapshots() public {
        FHECounterPublicDecrypt counter = new FHECounterPublicDecrypt();
        _increment(counter, 1);
        uint256 outer = fhevm.snapshotState();
        _increment(counter, 10); // 11
        uint256 inner = fhevm.snapshotState();
        _increment(counter, 100); // 111
        assertEq(decryptPublic(counter.getCount()), 111);

        fhevm.revertToState(inner);
        assertEq(decryptPublic(counter.getCount()), 11, "back to the inner snapshot");

        fhevm.revertToState(outer);
        assertEq(decryptPublic(counter.getCount()), 1, "back to the outer one");
    }

    /// A snapshot forge never handed out, or one taken with `vm` rather than `fhevm`, is refused by name.
    function test_RevertIf_SnapshotIsNotOurs() public {
        uint256 raw = vm.snapshotState(); // the raw pair: fhevm never saw it
        vm.expectRevert(bytes(LibFhevmFail.unknownSnapshot(raw)));
        this.revertExternally(raw);
    }

    // -- Across the fork boundary --------------------------------------------------------------------

    /// THE ONE FORGE CANNOT DO, refused BEFORE it breaks anything. A revert to a snapshot taken before
    /// the fork would put the test back on the in-memory chain in name only: forge restores just the
    /// storage slots this test happened to read beforehand, so the local stack comes back missing most
    /// of itself. Nothing here tries to reconcile that; the SDK says so and stops.
    function test_RevertIf_TheSnapshotPredatesTheFork() public {
        vm.skip(!forked);
        uint256 snap = fhevm.snapshotState();
        fhevm.createSelectFork(sepolia, 11_743_572);

        vm.expectRevert(bytes(LibFhevmFail.cannotRevertPastFork(snap)));
        this.revertExternally(snap);

        // and the refusal left the fork alone: the test carries on exactly where it was
        assertTrue(fhevm.isForked(), "still on the fork");
        assertEq(LibFhevmProtocol.currentConfig().acl, sepolia.acl);
        forkUnknown(FHE_TEST.getEuint32Of(SENDER), 1000);
        _add(337);
        assertEq(decryptPublic(FHE_TEST.getEuint32Of(SENDER)), 1337, "the fork still works");
    }

    /// Creating a fork without selecting it does not move the test, so a snapshot from before it is
    /// still reachable. The refusal is about crossing the boundary, not about a fork existing.
    function test_aForkThatWasNeverSelectedDoesNotBlockTheRevert() public {
        vm.skip(!forked);
        FHECounterPublicDecrypt counter = new FHECounterPublicDecrypt();
        _increment(counter, 5);
        uint256 snap = fhevm.snapshotState();

        fhevm.createFork(sepolia, 11_743_572); // created, NOT selected
        _increment(counter, 6); // 11, still in memory
        assertEq(decryptPublic(counter.getCount()), 11);

        assertTrue(fhevm.revertToState(snap), "allowed: the test never left the in-memory chain");
        assertFalse(fhevm.isForked());
        assertEq(decryptPublic(counter.getCount()), 5, "and the local stack is whole");
    }

    /// The raw pair has no such guard, and the damage is quiet: the SDK's first entry afterwards reports
    /// drift rather than running against a chain that only looks right.
    function test_RevertIf_TheRawPairIsUsedAcrossAFork() public {
        vm.skip(!forked);
        uint256 raw = vm.snapshotState();
        fhevm.createSelectFork(sepolia, 11_743_572);
        vm.revertToState(raw); // forge's pointer stays on the fork; this handle's bookkeeping reverted

        vm.expectRevert(bytes(LibFhevmFail.forkDrift(0, NO_FORK)));
        this.sdkEntry();
    }

    /// Snapshot ON a fork, move to a second fork, come back to the first.
    function test_fork_revertToAForkSnapshotFromAnotherFork() public {
        vm.skip(!forked);
        uint256 forkA = fhevm.createSelectFork(sepolia, 11_743_572);
        forkUnknown(FHE_TEST.getEuint32Of(SENDER), 1000);
        _add(337);
        euint32 sumA = FHE_TEST.getEuint32Of(SENDER);
        uint256 snap = fhevm.snapshotState();

        uint256 forkB = fhevm.createSelectFork(sepolia, 11_743_000);
        assertTrue(forkA != forkB);
        assertEq(block.number, 11_743_000);

        fhevm.revertToState(snap);

        assertEq(fhevm.currentForkId(), forkA, "back on A");
        assertEq(block.number, 11_743_572, "at A's block");
        assertEq(LibFhevmProtocol.currentConfig().acl, sepolia.acl);
        assertEq(decryptPublic(sumA), 1337, "A's replay is intact");
    }

    /// Snapshot on a fork and revert without leaving it: the work in between is undone, the stack is not.
    function test_fork_revertWithoutLeavingTheFork() public {
        vm.skip(!forked);
        fhevm.createSelectFork(sepolia, 11_743_572);
        forkUnknown(FHE_TEST.getEuint32Of(SENDER), 1000);
        uint256 snap = fhevm.snapshotState();

        _add(337);
        assertEq(decryptPublic(FHE_TEST.getEuint32Of(SENDER)), 1337);

        fhevm.revertToState(snap);

        assertEq(fhevm.currentForkId(), 0, "still on the fork");
        assertEq(LibFhevmProtocol.currentConfig().acl, sepolia.acl);
        _add(5); // the add was undone, so from 1000 again
        assertEq(decryptPublic(FHE_TEST.getEuint32Of(SENDER)), 1005, "the add was undone, the seed was not");
    }

    /// Once the test is on a fork it stays on forks, and everything the pair supports still works there:
    /// a fresh fork, a snapshot on it, a revert to it, from the same fork or another.
    function test_afterAFork_theWholePairStillWorksOnForks() public {
        vm.skip(!forked);
        fhevm.createSelectFork(sepolia, 11_743_572);
        uint256 onA = fhevm.snapshotState();

        uint256 forkB = fhevm.createSelectFork(sepolia, 11_743_000);
        forkUnknown(FHE_TEST.getEuint32Of(SENDER), 2000);
        uint256 onB = fhevm.snapshotState();
        _add(5);
        assertEq(decryptPublic(FHE_TEST.getEuint32Of(SENDER)), 2005);

        assertTrue(fhevm.revertToState(onB), "a snapshot on B, from B");
        assertEq(block.number, 11_743_000);

        assertTrue(fhevm.revertToState(onA), "a snapshot on A, from B");
        assertEq(block.number, 11_743_572);
        assertTrue(forkB != fhevm.currentForkId());

        fhevm.selectFork(forkB);
        assertEq(block.number, 11_743_000, "and B is still reachable");
    }

    /// Events emitted after a snapshot describe work the revert undid, so they are discarded rather than
    /// replayed into a store that no longer matches the chain.
    function test_fork_eventsAfterTheSnapshotAreDiscarded() public {
        vm.skip(!forked);
        fhevm.createSelectFork(sepolia, 11_743_572);
        forkUnknown(FHE_TEST.getEuint32Of(SENDER), 1000);
        uint256 snap = fhevm.snapshotState();

        _add(337); // announced, NOT decrypted: the events are still in forge's buffer
        euint32 ghost = FHE_TEST.getEuint32Of(SENDER);

        fhevm.revertToState(snap);

        // the handle the undone add produced is unknown here, rather than answering 1337 from a stale replay
        vm.expectRevert();
        this.plaintextExternally(ghost);
        assertEq(decryptPublic(FHE_TEST.getEuint32Of(SENDER)), 1000, "and the chain is back at the seed");
    }

    /// Repeated snapshots and reverts on ONE fork: the pair survives being used over and over, as long as
    /// the test does not try to leave home again (see the refusal above).
    function test_shake_repeatedSnapshotsOnOneFork() public {
        vm.skip(!forked);
        fhevm.createSelectFork(sepolia, 11_743_572);
        forkUnknown(FHE_TEST.getEuint32Of(SENDER), 1000);
        for (uint32 i = 1; i <= 4; i++) {
            uint256 snap = fhevm.snapshotState();
            _add(i);
            assertEq(decryptPublic(FHE_TEST.getEuint32Of(SENDER)), 1000 + i, "the add landed");
            fhevm.revertToState(snap);
            assertEq(fhevm.currentForkId(), 0, "still on the fork");
            assertEq(decryptPublic(FHE_TEST.getEuint32Of(SENDER)), 1000, "and it was undone");
        }
    }

    /// Interleaved: fork A, snapshot, fork B, snapshot, back to A's snapshot, then on to a fresh fork.
    function test_shake_interleavedForksAndSnapshots() public {
        vm.skip(!forked);
        uint256 forkA = fhevm.createSelectFork(sepolia, 11_743_572);
        forkUnknown(FHE_TEST.getEuint32Of(SENDER), 1000);
        uint256 atA = fhevm.snapshotState();

        fhevm.createSelectFork(sepolia, 11_743_000);
        forkUnknown(FHE_TEST.getEuint32Of(SENDER), 2000);
        uint256 atB = fhevm.snapshotState();
        _add(5);
        assertEq(decryptPublic(FHE_TEST.getEuint32Of(SENDER)), 2005, "on B");

        fhevm.revertToState(atB);
        assertEq(block.number, 11_743_000, "still B, before the add");
        _add(7);
        assertEq(decryptPublic(FHE_TEST.getEuint32Of(SENDER)), 2007);

        fhevm.revertToState(atA);
        assertEq(fhevm.currentForkId(), forkA, "back on A");
        assertEq(block.number, 11_743_572);
        _add(337);
        assertEq(decryptPublic(FHE_TEST.getEuint32Of(SENDER)), 1337, "A's own seed, A's own replay");
    }

    /// `fhevm.selectFork` after a revert that did NOT leave the pointer stale is ordinary and allowed.
    function test_shake_selectForkStillWorksAfterAForkSnapshot() public {
        vm.skip(!forked);
        uint256 forkA = fhevm.createSelectFork(sepolia, 11_743_572);
        uint256 snap = fhevm.snapshotState();
        uint256 forkB = fhevm.createSelectFork(sepolia, 11_743_000);
        fhevm.revertToState(snap); // back on A, forge agrees, no override

        fhevm.selectFork(forkB);
        assertEq(fhevm.currentForkId(), forkB, "B is reachable: nothing was stale");
        assertEq(block.number, 11_743_000);
        fhevm.selectFork(forkA);
        assertEq(fhevm.currentForkId(), forkA);
    }

    // -- External wrappers, so `vm.expectRevert` has a call frame to catch ---------------------------

    function revertExternally(uint256 snapshotId) external {
        fhevm.revertToState(snapshotId);
    }

    function selectExternally(uint256 forkId) external {
        fhevm.selectFork(forkId);
    }

    function sdkEntry() external {
        encryptUint32(1, address(FHE_TEST), SENDER);
    }

    function plaintextExternally(euint32 value) external returns (uint32) {
        return plaintextOf(value);
    }

    // -- Helpers -------------------------------------------------------------------------------------

    function _increment(FHECounterPublicDecrypt counter, uint32 by) private {
        (externalEuint32 v, bytes memory proof) = encryptUint32(by, address(counter), alice);
        vm.prank(alice);
        counter.increment(v, proof);
    }

    function _add(uint32 value) private {
        (externalEuint32 input, bytes memory proof) = encryptUint32(value, address(FHE_TEST), SENDER);
        vm.prank(SENDER);
        FHE_TEST.addEuint32(input, proof, value, true);
    }
}
