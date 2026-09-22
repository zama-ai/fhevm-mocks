// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {euint32, externalEuint32} from "encrypted-types/EncryptedTypes.sol";

import {TestFhevm} from "../../pkg/src/TestFhevm.sol";
import {ForgeFhevmEventProcessor} from "../../pkg/src/_host/ForgeFhevmEventProcessor.sol";
import {LibFhevmProtocol} from "../../pkg/src/LibFhevmProtocol.sol";
import {fhevm, NO_FORK} from "../../pkg/src/FhevmVm.sol";
import {LibFhevmFail} from "../../pkg/src/LibFhevmFail.sol";
import {ForkBlocks} from "./ForkBlocks.sol";

interface IFHETest {
    function getEuint32Of(address account) external view returns (euint32);
    function addEuint32(externalEuint32 input, bytes calldata inputProof, uint32 clearValue, bool makePublic) external;
}

/**
 * @notice Several forks in one test, switched back and forth, with the SDK following.
 *
 * @dev What this proves: the SDK's state is ONE object across `createSelectFork` and `selectFork`
 *      (`fhevm`, the processor, its stores); each fork is prepared once on first contact; the protocol
 *      is re-pointed on every switch — including between two DIFFERENT stacks, Sepolia's and mainnet's;
 *      and a fork entered or switched through `vm` instead of `fhevm` is refused as drift.
 *
 *      Forked with `fhevm.createSelectFork(chain, …)`; the drift cases use `vm` on purpose.
 *
 *          SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com \
 *          MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com forge test --match-contract TwoForks
 *
 * @dev THERE IS NO GOING BACK. Once a test has selected a fork, forge-std offers no way to return to the
 *      in-memory state it started from: `vm.selectFork` moves between CREATED forks only, and there is no
 *      "deselect" — fork id 0 is the first fork created, not "no fork". `fhevm` is the same: `fhevm.selectFork`
 *      moves between forks, and there is no `fhevm.selectLocal()`, because forge has nothing to implement
 *      it with. So the local cleartext stack these tests start on (see `setUp`) is gone for good after the
 *      first `createSelectFork`, and a suite that needs both the local stack and a fork is two contracts.
 *      (A fork of a local anvil IS a fork, and can be switched back to — that is the way out, when the SDK
 *      supports anvil.)
 *
 * @dev NOT devnet Sepolia for the second stack, although it is on the same RPC: it runs a NEWER protocol
 *      (`ACL v0.5.0`, `ProtocolConfig v0.2.0`) than this SDK vendors, so it cannot be prepared — see
 *      `ForkResolution.t.sol` for the error that says so.
 */
contract TwoForksTest is TestFhevm {
    IFHETest internal constant FHE_TEST = IFHETest(0x94B9d3aF050687D1F76251aD7D09a1F216a19845);
    address internal constant SENDER = 0x37AC010c1c566696326813b840319B58Bb5840E4;

    FhevmChain internal sepolia;
    FhevmChain internal mainnet;
    uint256 internal blockA;
    uint256 internal blockB;
    bool internal forked;
    bool internal mainnetToo;

    function setUp() public override {
        // `super.setUp()` is NOT auto-called: Solidity never chains an override to its parent unless the
        // override says `super.setUp()` — and this one does not. It is also NOT needed: `TestFhevm.setUp`
        // is empty; the local cleartext stack was deployed and declared by
        // `StdFhevm`'s CONSTRUCTOR, before this function ran. So at this line the current protocol is
        // already the in-memory cleartext stack, with no call of ours — which is what this asserts.
        assertTrue(LibFhevmProtocol.hasProtocol(), "super.setUp not called, and a stack is current anyway");
        assertTrue(LibFhevmProtocol.currentConfig().isCleartext, "and it is the local cleartext one");
        assertGt(LibFhevmProtocol.currentConfig().executor.code.length, 0, "deployed, from the constructor");

        if (!fhevm.hasRpcUrlFor("sepolia")) return; // opt in: [rpc_endpoints] sepolia, or SEPOLIA_RPC_URL
        sepolia = getFhevmChain("testnet", "sepolia");
        (blockA, blockB) = ForkBlocks.recentPair(sepolia.rpcUrl);
        forked = true;
        if (!fhevm.hasRpcUrlFor("mainnet")) return;
        mainnet = getFhevmChain("mainnet", "mainnet");
        mainnetToo = true;
    }

    /// Same stack on two forks: persistence, and a signer swap per fork.
    function test_decryptOnTheFirstForkAfterVisitingTheSecond() public {
        vm.skip(!forked);

        assertTrue(LibFhevmProtocol.currentConfig().isCleartext, "the local stack, before any fork");

        uint256 forkA = fhevm.createSelectFork(sepolia, blockA);
        assertEq(fhevm.currentForkId(), forkA, "A is active");
        assertEq(block.number, blockA, "at A's block");
        assertEq(LibFhevmProtocol.currentConfig().acl, sepolia.acl, "A's stack is current, at once");
        assertEq(
            ForgeFhevmEventProcessor(fhevm.eventProcessor()).selectedExecutor(),
            sepolia.fhevmExecutor,
            "and the replay reads its store"
        );
        forkUnknown(FHE_TEST.getEuint32Of(SENDER), 1000);
        _add(337);
        euint32 sumA = FHE_TEST.getEuint32Of(SENDER);

        uint256 forkB = fhevm.createSelectFork(sepolia, blockB);
        assertTrue(forkA != forkB, "two forks");
        assertEq(fhevm.currentForkId(), forkB, "B is active");
        assertEq(block.number, blockB, "at B's block");
        assertEq(LibFhevmProtocol.currentConfig().acl, sepolia.acl, "same stack on B");
        // B has its OWN replay: the pre-existing value seeded on A is not known here, so state it again.
        forkUnknown(FHE_TEST.getEuint32Of(SENDER), 1000);
        _add(5); // B's InputVerifier must accept our proof: B was prepared by createSelectFork
        assertEq(decryptPublic(FHE_TEST.getEuint32Of(SENDER)), 1005, "on B");

        fhevm.selectFork(forkA);
        assertEq(fhevm.currentForkId(), forkA, "back on A");
        assertEq(block.number, blockA, "at A's block again");
        assertEq(LibFhevmProtocol.currentConfig().acl, sepolia.acl, "A's stack is current again");
        assertEq(decryptPublic(sumA), 1337, "on A, after B");
        assertEq(
            euint32.unwrap(FHE_TEST.getEuint32Of(SENDER)), euint32.unwrap(sumA), "A's state is A's: B's add is not here"
        );
    }

    /// Two DIFFERENT stacks: the protocol must be re-pointed on the way back, or A's handle is checked
    /// against mainnet's ACL.
    function test_switchingStacksRepointsTheProtocol() public {
        vm.skip(!mainnetToo);

        uint256 forkA = fhevm.createSelectFork(sepolia, blockA);
        euint32 current = FHE_TEST.getEuint32Of(SENDER);
        forkUnknown(current, 1000);
        _add(337);
        euint32 sumA = FHE_TEST.getEuint32Of(SENDER);
        assertEq(LibFhevmProtocol.currentConfig().acl, sepolia.acl, "sepolia on A");

        uint256 forkC = fhevm.createSelectFork(mainnet);
        assertEq(fhevm.currentForkId(), forkC, "C is active");
        assertEq(block.chainid, 1, "on mainnet");
        assertEq(LibFhevmProtocol.currentConfig().acl, mainnet.acl, "mainnet on C, at once");
        assertEq(LibFhevmProtocol.currentConfig().executor, mainnet.fhevmExecutor);
        assertEq(LibFhevmProtocol.currentConfig().kmsVerifier, mainnet.kmsVerifier);
        assertEq(
            ForgeFhevmEventProcessor(fhevm.eventProcessor()).selectedExecutor(),
            mainnet.fhevmExecutor,
            "reads routed to mainnet's store"
        );
        forkUnknown(current, 1); // an entry on C: fine, nothing more to prepare

        fhevm.selectFork(forkA);
        assertEq(fhevm.currentForkId(), forkA, "back on A");
        assertEq(block.chainid, 11155111, "on sepolia");
        assertEq(LibFhevmProtocol.currentConfig().acl, sepolia.acl, "sepolia again, at once");
        assertEq(
            ForgeFhevmEventProcessor(fhevm.eventProcessor()).selectedExecutor(),
            sepolia.fhevmExecutor,
            "reads routed back to sepolia's store"
        );
        assertEq(decryptPublic(sumA), 1337, "back on A, sepolia again");
    }

    /// A fork entered through `vm` alone is drift, refused at the first entry.
    function test_RevertIf_ForkEnteredOutsideFhevm() public {
        vm.skip(!forked);
        uint256 forkId = vm.createSelectFork(sepolia.rpcUrl, blockA);
        euint32 current = FHE_TEST.getEuint32Of(SENDER);

        vm.expectRevert(bytes(LibFhevmFail.forkDrift(forkId, NO_FORK)));
        this.forkUnknownExternally(current);
    }

    /// A switch through `vm.selectFork` between two forks the SDK knows is drift too: the fork being left
    /// was not drained, and the SDK will not guess that it was harmless.
    function test_RevertIf_SwitchedOutsideFhevm() public {
        vm.skip(!forked);
        uint256 forkA = fhevm.createSelectFork(sepolia, blockA);
        uint256 forkB = fhevm.createSelectFork(sepolia, blockB);
        euint32 current = FHE_TEST.getEuint32Of(SENDER);

        vm.selectFork(forkA); // through vm: drift
        vm.expectRevert(bytes(LibFhevmFail.forkDrift(forkA, forkB)));
        this.forkUnknownExternally(current);

        fhevm.selectFork(forkA); // through fhevm: fine
        forkUnknown(current, 1);
    }

    /// `createFork` remembers the stack without touching the fork; the first `selectFork` prepares and points.
    function test_createForkThenSelectFork() public {
        vm.skip(!forked);
        uint256 forkA = fhevm.createFork(sepolia, blockA);
        assertTrue(LibFhevmProtocol.currentConfig().isCleartext, "not selected: still on the local stack");

        fhevm.selectFork(forkA);
        assertEq(fhevm.activeFork(), forkA);
        assertEq(LibFhevmProtocol.currentConfig().acl, sepolia.acl, "pointed on first selection");
        forkUnknown(FHE_TEST.getEuint32Of(SENDER), 1000);
        _add(337); // prepared on first selection: the proof is accepted
        assertEq(decryptPublic(FHE_TEST.getEuint32Of(SENDER)), 1337);
    }

    /// ISOLATION. A handle announced on fork A does not exist on fork B (same chain, other block), and B's
    /// replay does not know it either: the stores are per context now. Back on A it is 1337.
    function test_aForksHandlesAreUnknownToAnotherFork() public {
        vm.skip(!forked);
        uint256 forkA = fhevm.createSelectFork(sepolia, blockA);
        forkUnknown(FHE_TEST.getEuint32Of(SENDER), 1000);
        _add(337);
        euint32 sumA = FHE_TEST.getEuint32Of(SENDER);

        fhevm.createSelectFork(sepolia, blockB);
        vm.expectRevert(); // B's replay never saw sumA: refused by the default unknown-handle policy
        this.plaintextOfExternally(sumA);

        fhevm.selectFork(forkA);
        assertEq(decryptPublic(sumA), 1337, "A still knows its own");
    }

    function plaintextOfExternally(euint32 value) external returns (uint32) {
        return plaintextOf(value);
    }

    /// `rollFork` IS a fresh fork at another block: the signer swap is redone (the encrypt is accepted),
    /// the replay is a new one (the pre-roll handle is unknown), and the flow works at the new block.
    function test_rollForkIsAFreshForkAtAnotherBlock() public {
        vm.skip(!forked);
        fhevm.createSelectFork(sepolia, blockA);
        forkUnknown(FHE_TEST.getEuint32Of(SENDER), 1000);
        _add(1);
        euint32 beforeRoll = FHE_TEST.getEuint32Of(SENDER);
        address processorBefore = fhevm.eventProcessor();

        fhevm.rollFork(blockB);

        assertEq(block.number, blockB, "rolled");
        assertEq(LibFhevmProtocol.currentConfig().acl, sepolia.acl, "still pointed");
        assertTrue(fhevm.eventProcessor() != processorBefore, "a new replay for what is a new fork");
        vm.expectRevert(); // the pre-roll handle is unknown to the new replay, as to any fresh fork
        this.plaintextOfExternally(beforeRoll);

        forkUnknown(FHE_TEST.getEuint32Of(SENDER), 1000);
        _add(337); // accepted only if the signer sets were registered AGAIN after the roll
        assertEq(decryptPublic(FHE_TEST.getEuint32Of(SENDER)), 1337);
    }

    /// `useStack` is the pointing half of `createSelectFork(chain, …)`, callable on the active context.
    function test_useStackOnAForkIsTheChainFormMinusTheFork() public {
        vm.skip(!forked);
        fhevm.createSelectFork(sepolia.rpcUrl, blockA); // URL only: no stack yet
        assertFalse(LibFhevmProtocol.hasProtocol(), "unknown");

        fhevm.useStack(sepolia);

        assertEq(LibFhevmProtocol.currentConfig().acl, sepolia.acl, "pointed and prepared");
        forkUnknown(FHE_TEST.getEuint32Of(SENDER), 1000);
        _add(337);
        assertEq(decryptPublic(FHE_TEST.getEuint32Of(SENDER)), 1337);
    }

    /// DRAIN BEFORE SWITCH, proven. Events emitted on A and NOT yet replayed when the test moves to B must
    /// land in A's replay, not B's: `fhevm.selectFork` drains A first. Without that drain, A's add would be
    /// replayed into B's processor and A could never decrypt its own sum.
    function test_pendingEventsAreDrainedIntoTheForkTheyBelongTo() public {
        vm.skip(!forked);
        uint256 forkA = fhevm.createSelectFork(sepolia, blockA);
        forkUnknown(FHE_TEST.getEuint32Of(SENDER), 1000);
        _add(337); // announced on A, NOT decrypted: still in the buffer
        euint32 sumA = FHE_TEST.getEuint32Of(SENDER);

        uint256 forkB = fhevm.createSelectFork(sepolia, blockB); // drains A's events into A's replay first
        assertTrue(forkB != forkA);

        fhevm.selectFork(forkA);
        assertEq(decryptPublic(sumA), 1337, "A's replay got A's events");
    }

    /// External so `vm.expectRevert` has a call frame to catch.
    function forkUnknownExternally(euint32 value) external {
        forkUnknown(value, 1);
    }

    function _add(uint32 value) private {
        (externalEuint32 input, bytes memory proof) = encryptUint32(value, address(FHE_TEST), SENDER);
        vm.prank(SENDER);
        FHE_TEST.addEuint32(input, proof, value, true);
    }
}
