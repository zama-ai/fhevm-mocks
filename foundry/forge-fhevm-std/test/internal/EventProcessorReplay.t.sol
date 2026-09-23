// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {euint8, externalEuint8} from "encrypted-types/EncryptedTypes.sol";

import {Vm} from "forge-std/Test.sol";
import {TestFhevm} from "../../pkg/src/TestFhevm.sol";
import {CoprocessorConfig} from "../../pkg/src/_host/shared/LibFhevmCoprocessorConfig.sol";
import {FhevmProtocol, LibFhevmProtocol} from "../../pkg/src/LibFhevmProtocol.sol";
import {ForgeFhevmEventProcessor, ForgeFhevmEventProcessorDB} from "../../pkg/src/_host/ForgeFhevmEventProcessor.sol";
import {fhevm} from "../../pkg/src/FhevmVm.sol";

import {APlusB} from "../examples/contracts/AplusB.sol";
import {ConstructorFhe} from "../fork/contracts/ConstructorFhe.sol";
import {ForkBlocks} from "../shared/ForkBlocks.sol";

/**
 * @notice INTERNALS TEST of the event processor, against a FORKED production stack (mainnet): encrypt
 *         through the ordinary `TestFhevm` API and watch the value come back out of the replay.
 *
 * @dev WHY IT LIVES UNDER `test/internal/`. It drives `ForgeFhevmEventProcessor(fhevm.eventProcessor())` and `processFheEvents` directly,
 *      reads `LibFhevmProtocol.currentConfig()` raw and calls `vm.getRecordedLogs()` on purpose to show the
 *      footgun — none of which a test of a dApp does. It documents the MECHANISM the public API hides.
 *
 * @dev WHAT THIS IS FOR. Every piece of the fork story exists, but nothing joins them: no `setUp` builds
 *      a processor, and no decryption asks one for values. This test does that joining BY HAND, in one
 *      file, so the shape of the missing wiring is visible before any of it is committed to the library.
 *
 *      Three things have to be true before an encryption can work against mainnet's own contracts:
 *
 *        1. the InputVerifier must accept a proof signed with keys this project holds — so the
 *           coprocessor signer set is swapped to the cleartext one, as the ACL owner;
 *        2. `LibFhevmProtocol` must name the FORKED addresses, not the locally deployed stack — hence
 *           `fhevm.createSelectFork`, after which the local stack is no longer where the test runs;
 *        3. something must be listening when the dApp calls, because the encryption itself emits no
 *           events. The executor emits `VerifyInput` when the proof is CONSUMED, and the proof carries
 *           the cleartext, which is what the processor reconstructs from.
 *
 *          MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com forge test --match-contract EventProcessorReplay
 */
contract EventProcessorReplayTest is TestFhevm {
    address internal constant MAINNET_ACL = 0xcA2E8f1F656CD25C01F05d0b243Ab1ecd4a8ffb6;
    address internal constant MAINNET_INPUT_VERIFIER = 0xCe0FC2e05CFff1B719EFF7169f7D80Af770c8EA2;
    address internal constant MAINNET_KMS_VERIFIER = 0x77627828a55156b04Ac0DC0eb30467f1a552BB03;
    address internal constant MAINNET_EXECUTOR = 0xD82385dADa1ae3E969447f20A3164F6213100e75;

    ForgeFhevmEventProcessor internal processor;
    APlusB internal dapp;
    ConstructorFhe internal builtInSetUp;
    address internal alice;
    bool internal forked;

    function setUp() public override {
        if (!ForkBlocks.enabled("mainnet")) return; // opt in: [rpc_endpoints] mainnet, or MAINNET_RPC_URL

        // Fork and name the stack in one call; the SDK prepares it at the first entry — signer sets
        // swapped so the real InputVerifier accepts our proofs, protocol pointed. Nothing else to set up.
        fhevm.createSelectFork(getFhevmChain("mainnet", "mainnet")); // its rpcUrl is the configured one
        forked = true;

        // RECORDING IS PER TEST, though not for the reason it looks. `setUp` runs ONCE; forge snapshots
        // the state it produced and restores that before each test — and the snapshot includes the
        // armed recorder and its buffer. So arming here arms every test, while a side effect forge
        // cannot snapshot (a file write, say) would happen once, not once per test. Draining does not
        // disarm either, so a test may process as many times as it likes.
        //
        // Armed BEFORE the dApp is deployed, deliberately: a constructor that performs FHE work emits
        // through the executor like any other call, and a processor armed afterwards would never see
        // it. `APlusB`'s constructor happens to emit nothing, which is why other tests start from an
        // empty buffer; `test_aConstructorsFheWorkIsCaptured` covers the case that does emit.
        // One line: `ForgeFhevmEventProcessor(fhevm.eventProcessor())` creates it, arms recording, and names it as this stack's
        // plaintext source — mainnet's executor holds no cleartexts, so a decryption has to read from
        // whatever rebuilt them.
        processor = ForgeFhevmEventProcessor(fhevm.eventProcessor());

        dapp = new APlusB();
        alice = makeAddr("alice");

        // Deployed HERE, inside the recording window, so its constructor's FHE work is replayable.
        builtInSetUp = new ConstructorFhe(7);

        // Every address here is mainnet's, and `APlusB` inherits `ZamaEthereumConfig`, which hardcodes
        // mainnet too — so an RPC pointed elsewhere must fail here rather than somewhere puzzling.
        assertEq(block.chainid, 1, "MAINNET_RPC_URL must point at ethereum mainnet");
    }

    modifier onlyForked() {
        vm.skip(!forked);
        _;
    }

    /// `fhevm.createSelectFork(mainnet)` POINTED the protocol at mainnet's stack the moment it returned:
    /// no SDK entry needed. It really is the forked one, and it really is not cleartext.
    function test_theProtocolNamesTheForkedStack() public onlyForked {
        assertEq(LibFhevmProtocol.currentConfig().executor, MAINNET_EXECUTOR);
        assertEq(LibFhevmProtocol.currentConfig().inputVerifier, MAINNET_INPUT_VERIFIER, "read off the executor");
        assertFalse(LibFhevmProtocol.currentConfig().isCleartext, "mainnet's stack is the real one");
    }

    /// @dev Encrypt 20 and 22 through the public API, let the dApp consume both proofs and add them,
    ///      then replay what mainnet's executor announced.
    function _encryptAddAndReplay() private {
        (externalEuint8 a, bytes memory proofA) = encryptUint8(20, address(dapp), alice);
        (externalEuint8 b, bytes memory proofB) = encryptUint8(22, address(dapp), alice);

        vm.startPrank(alice);
        dapp.setA(a, proofA);
        dapp.setB(b, proofB);
        dapp.computeAPlusB();
        vm.stopPrank();

        processor.processFheEvents();
    }

    /// A dApp that does FHE work in its CONSTRUCTOR is replayed too — and this one was deployed in
    /// `setUp`, which is what makes the arming ORDER load-bearing rather than incidental. Arm the
    /// recorder after the deployments instead and this is the test that fails.
    function test_aConstructorsFheWorkInSetUpIsCaptured() public onlyForked {
        assertGt(processor.processFheEvents(), 0, "the constructor emitted through the executor");
        assertEq(processor.plaintexts(euint8.unwrap(builtInSetUp.value())), 7, "reconstructed from setUp");
    }

    /// The recorder armed in `setUp` survives a drain: a test may process in stages, and later events
    /// still land. This is what makes one call in `setUp` enough for every test.
    function test_eventsCanBeProcessedInStages() public onlyForked {
        (externalEuint8 a, bytes memory proofA) = encryptUint8(20, address(dapp), alice);
        vm.prank(alice);
        dapp.setA(a, proofA);

        assertGt(processor.processFheEvents(), 0, "first drain");
        assertEq(processor.plaintexts(externalEuint8.unwrap(a)), 20);

        // Nothing re-armed in between.
        (externalEuint8 b, bytes memory proofB) = encryptUint8(22, address(dapp), alice);
        vm.prank(alice);
        dapp.setB(b, proofB);

        assertGt(processor.processFheEvents(), 0, "second drain, same recorder");
        assertEq(processor.plaintexts(externalEuint8.unwrap(b)), 22);
    }

    /// THE DECRYPT DRAINS BY ITSELF. Nothing here calls `processFheEvents` — `StdFhevmDecrypt` owns the
    /// processor and replays whatever has been emitted before it reads.
    function test_decryptReplaysPendingEventsWithoutBeingAsked() public onlyForked {
        (externalEuint8 a, bytes memory proofA) = encryptUint8(20, address(dapp), alice);
        (externalEuint8 b, bytes memory proofB) = encryptUint8(22, address(dapp), alice);

        vm.startPrank(alice);
        dapp.setA(a, proofA);
        dapp.setB(b, proofB);
        dapp.computeAPlusB();
        vm.stopPrank();

        assertEq(decrypt(dapp.aplusb(), address(dapp), "alice"), 42, "replayed on demand");
    }

    /// @dev A dApp's OWN event, the kind a test would assert on.
    event Computed(address by);

    /// THE FIX. The same test, reading its logs through `fhevm.getRecordedLogs()`: it still gets every log
    /// — its own event included — and the decryption that follows still works, because the one allowed
    /// read fed the replay on the way past.
    function test_fhevmGetRecordedLogsServesBothReaders() public onlyForked {
        (externalEuint8 a, bytes memory proofA) = encryptUint8(20, address(dapp), alice);
        (externalEuint8 b, bytes memory proofB) = encryptUint8(22, address(dapp), alice);

        vm.startPrank(alice);
        dapp.setA(a, proofA);
        dapp.setB(b, proofB);
        dapp.computeAPlusB();
        vm.stopPrank();

        emit Computed(alice);

        Vm.Log[] memory mine = fhevm.getRecordedLogs();
        assertGt(mine.length, 0, "the test still gets its logs");

        bool sawMine;
        for (uint256 i = 0; i < mine.length; i++) {
            if (mine[i].emitter == address(this) && mine[i].topics[0] == Computed.selector) sawMine = true;
        }
        assertTrue(sawMine, "including its own event");

        assertEq(decrypt(dapp.aplusb(), address(dapp), "alice"), 42, "and the decryption still works");
    }

    /// THE COLLISION. A test that reads the log buffer to check its own events consumes the FHE events
    /// too — `getRecordedLogs()` is one buffer per test and reading it empties it — so the decryption
    /// that follows has nothing to replay and fails on the handle it was asked about.
    function test_readingTheLogsYourselfBreaksTheNextDecrypt() public onlyForked {
        (externalEuint8 a, bytes memory proofA) = encryptUint8(20, address(dapp), alice);
        (externalEuint8 b, bytes memory proofB) = encryptUint8(22, address(dapp), alice);

        vm.startPrank(alice);
        dapp.setA(a, proofA);
        dapp.setB(b, proofB);
        dapp.computeAPlusB();
        vm.stopPrank();

        emit Computed(alice);

        // What a test asserting on its own events does — and it takes the FHE events with it.
        Vm.Log[] memory mine = vm.getRecordedLogs();
        assertGt(mine.length, 0, "the test got the logs, including every FHE one");

        euint8 sum = dapp.aplusb();
        vm.expectRevert(
            abi.encodeWithSelector(ForgeFhevmEventProcessorDB.CleartextEventUnknownHandle.selector, euint8.unwrap(sum))
        );
        this.decryptExternally(sum);
    }

    /// The debug cheat replays too: no permit, no ACL, no explicit `processFheEvents`, and it still
    /// sees a value that exists only in the replay.
    function test_plaintextOfReplaysPendingEventsWithoutBeingAsked() public onlyForked {
        (externalEuint8 a, bytes memory proofA) = encryptUint8(20, address(dapp), alice);
        (externalEuint8 b, bytes memory proofB) = encryptUint8(22, address(dapp), alice);

        vm.startPrank(alice);
        dapp.setA(a, proofA);
        dapp.setB(b, proofB);
        dapp.computeAPlusB();
        vm.stopPrank();

        assertEq(plaintextOf(dapp.aplusb()), 42, "revealed without asking anyone");
    }

    // -- Values the replay cannot know -------------------------------------------------------------

    /// A handle minted before the fork block has no events anywhere, so nothing can reconstruct it.
    /// `seedCleartext` is how a test says what it is worth — and from then on the simulation carries
    /// that value through arithmetic like any other.
    ///
    /// @dev The situation is staged by DISCARDING the logs rather than by finding an old handle: the
    ///      processor cannot tell the difference, and the test needs no chain archaeology.
    function test_aHandleTheReplayNeverSawCanBeSeededByHand() public onlyForked {
        (externalEuint8 a, bytes memory proofA) = encryptUint8(20, address(dapp), alice);
        vm.prank(alice);
        dapp.setA(a, proofA);

        // Thrown away: from here this handle is indistinguishable from one minted before the fork.
        vm.getRecordedLogs();

        bytes32 handle = externalEuint8.unwrap(a);
        vm.expectRevert(abi.encodeWithSelector(ForgeFhevmEventProcessorDB.CleartextEventUnknownHandle.selector, handle));
        processor.plaintexts(handle);

        // The developer knows what it is; the chain cannot say.
        processor.seedCleartext(handle, 20);
        assertEq(processor.plaintexts(handle), 20, "worth what we said");
        assertEq(plaintextOf(euint8.wrap(handle)), 20, "and the cheats agree");
    }

    /// AND THE SIMULATION KEEPS COMPUTING WITH IT. The seeded value is the left operand of an addition
    /// mainnet's executor performs; the right one is replayed from events as usual.
    function test_aSeededValueFlowsThroughLaterArithmetic() public onlyForked {
        (externalEuint8 a, bytes memory proofA) = encryptUint8(20, address(dapp), alice);
        vm.prank(alice);
        dapp.setA(a, proofA);
        vm.getRecordedLogs();

        processor.seedCleartext(externalEuint8.unwrap(a), 20);

        (externalEuint8 b, bytes memory proofB) = encryptUint8(22, address(dapp), alice);
        vm.startPrank(alice);
        dapp.setB(b, proofB);
        dapp.computeAPlusB();
        vm.stopPrank();

        assertEq(plaintextOf(dapp.aplusb()), 42, "seeded + replayed, added on chain");
    }

    /// END TO END, through nothing but the public API: the sum mainnet's executor computed is read back
    /// as alice, with the processor standing in for the cleartexts the production stack does not have.
    function test_theSumIsUserDecryptedThroughThePublicApi() public onlyForked {
        _encryptAddAndReplay();

        assertEq(decrypt(dapp.aplusb(), address(dapp), "alice"), 42, "decrypted on a production stack");
    }

    /// External so `vm.expectRevert` has a call frame to catch.
    function decryptExternally(euint8 value) external returns (uint8) {
        return decrypt(value, address(dapp), "alice");
    }

    /// The two configs agree: the stack this test drives is the stack the dApp was compiled against.
    ///
    /// @dev `APlusB` inherits `ZamaEthereumConfig`, so it holds mainnet's addresses whatever the test
    ///      believes. Reading them out of its storage is what makes that checkable rather than assumed.
    function test_theDappHoldsTheSameConfigTheTestDrives() public onlyForked {
        CoprocessorConfig memory dappHolds = getCoprocessorConfig(address(dapp));

        assertEq(dappHolds.ACLAddress, MAINNET_ACL, "the dApp's own ACL");
        assertEq(dappHolds.CoprocessorAddress, MAINNET_EXECUTOR, "the dApp's own executor");
        assertEq(dappHolds.KMSVerifierAddress, MAINNET_KMS_VERIFIER, "the dApp's own KMS verifier");

        // And they are the stack this test drives — which is what makes the dApp reachable at all.
        FhevmProtocol memory stackUnderTest = LibFhevmProtocol.currentConfig();
        assertEq(dappHolds.ACLAddress, stackUnderTest.acl);
        assertEq(dappHolds.CoprocessorAddress, stackUnderTest.executor);
        assertEq(dappHolds.KMSVerifierAddress, stackUnderTest.kmsVerifier);
    }

    /// A contract that inherited no config holds nothing — which is the state this very test contract
    /// is in, deliberately: `FHE` must not work on the test itself.
    function test_anUnconfiguredContractHoldsNothing() public onlyForked {
        CoprocessorConfig memory none = getCoprocessorConfig(address(this));

        assertEq(none.ACLAddress, address(0));
        assertEq(none.CoprocessorAddress, address(0));
        assertEq(none.KMSVerifierAddress, address(0));
    }

    /// THE POINT. Encrypt with the ordinary API, let the dApp consume the proof, and the value the
    /// production executor computed comes back out of the processor's database.
    function test_anEncryptedInputLandsInTheProcessorDb() public onlyForked {
        (externalEuint8 a, bytes memory proofA) = encryptUint8(20, address(dapp), alice);
        (externalEuint8 b, bytes memory proofB) = encryptUint8(22, address(dapp), alice);

        // Mainnet's own FHEVMExecutor verifies both proofs and announces what it did.
        vm.startPrank(alice);
        dapp.setA(a, proofA);
        dapp.setB(b, proofB);
        dapp.computeAPlusB();
        vm.stopPrank();

        uint256 applied = processor.processFheEvents();
        assertGt(applied, 2, "two inputs verified and one addition");

        // The inputs, keyed by the handles the encryption produced.
        assertEq(processor.plaintexts(externalEuint8.unwrap(a)), 20, "input a");
        assertEq(processor.plaintexts(externalEuint8.unwrap(b)), 22, "input b");

        // And the result the dApp holds, which no one on mainnet can read.
        assertEq(processor.plaintexts(euint8.unwrap(dapp.aplusb())), 42, "a + b, replayed from events");
    }

    /// Nothing is reconstructed without the replay: the processor only knows what it was told.
    function test_withoutProcessingTheValueIsUnknown() public onlyForked {
        (externalEuint8 a, bytes memory proofA) = encryptUint8(20, address(dapp), alice);
        vm.prank(alice);
        dapp.setA(a, proofA);

        // `processFheEvents` deliberately not called.
        vm.expectRevert();
        processor.plaintexts(externalEuint8.unwrap(a));
    }
}
