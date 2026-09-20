// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {ForgeFhevmEventProcessor, ForgeFhevmEventProcessorDB} from "../../pkg/forge/src/ForgeFhevmEventProcessor.sol";
import {FheType} from "../../pkg/forge/src/shared/LibFheType.sol";
import {LibCleartextProbe} from "../../pkg/forge/src/shared/LibCleartextProbe.sol";
import {Operators} from "../../pkg/forge/src/shared/FhevmOperatorsEnum.sol";

/// The bits of the deployed `FHETest` (v2) this test touches.
interface IFHETest {
    function setClearEuint64(uint64 value, bool makePublic) external returns (bytes32);
    function setClearEuint32(uint32 value, bool makePublic) external returns (bytes32);
    function hasHandleOf(address account, FheType fheType) external view returns (bool);
}

/// The slice of the production host this test reads.
interface IHost {
    function getVersion() external view returns (string memory);
    function owner() external view returns (address);
    function getFHEVMExecutorAddress() external view returns (address);
    function getCoprocessorSigners() external view returns (address[] memory);
    function getKmsSigners() external view returns (address[] memory);
    function getThreshold() external view returns (uint256);
    function defineNewContext(address[] memory newSignersSet, uint256 newThreshold) external;
}

/// The KMS half of the host config. Shapes copied from `pkg/src/contracts/shared/Structs.sol` and
/// `IProtocolConfig`, which are the sources the deployed v0.1.0 was built from.
interface IProtocolConfig {
    struct KmsNode {
        address txSenderAddress;
        address signerAddress;
        string ipAddress;
        string storageUrl;
    }

    struct KmsThresholds {
        uint256 publicDecryption;
        uint256 userDecryption;
        uint256 kmsGen;
        uint256 mpc;
    }

    function defineNewKmsContext(KmsNode[] calldata kmsNodes, KmsThresholds calldata thresholds) external;
    function getCurrentKmsContextId() external view returns (uint256);
}

/**
 * @notice Forks ETHEREUM MAINNET and drives the event processor against the real Zama host.
 *
 * @dev The Sepolia suite's twin. Both chains run exactly the contracts vendored in
 *      `pkg/src/contracts` — ACL v0.4.0, FHEVMExecutor v0.4.0, KMSVerifier v0.3.0, InputVerifier
 *      v0.2.0, ProtocolConfig v0.1.0 — at different addresses and with different signer sets.
 *      Mainnet is worth its own file for that second half: it is the deployment that matters, and
 *      its numbers are its own.
 *
 *      Two things it covers that the Sepolia suite does not:
 *
 *      1. The host inventory — that the addresses hardcoded here are the ones the ACL itself names,
 *         so a silent redeployment shows up as a failure rather than as a test quietly reading a dead
 *         address.
 *      2. Whether the signer sets can be swapped by the ACL owner. That is the question the whole
 *         "run a cleartext test against a production fork" idea turns on, and the answer differs
 *         between the two signer sets.
 *
 *      Skipped unless `MAINNET_RPC_URL` is set, so the offline suite stays green:
 *
 *          MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com forge test --match-contract MainnetFork
 */
contract MainnetForkEventProcessorTest is Test {
    /// @dev sdk/js-sdk/src/core/chains/definitions/mainnet.ts, plus the executor the ACL names.
    address internal constant MAINNET_ACL = 0xcA2E8f1F656CD25C01F05d0b243Ab1ecd4a8ffb6;
    address internal constant MAINNET_INPUT_VERIFIER = 0xCe0FC2e05CFff1B719EFF7169f7D80Af770c8EA2;
    address internal constant MAINNET_KMS_VERIFIER = 0x77627828a55156b04Ac0DC0eb30467f1a552BB03;
    address internal constant MAINNET_PROTOCOL_CONFIG = 0xD8236B57394f90726b26aB25D38CeAC776E1a7C4;
    address internal constant MAINNET_EXECUTOR = 0xD82385dADa1ae3E969447f20A3164F6213100e75;

    /// @dev Sepolia's ProtocolConfig is a DIFFERENT address (`0x51f9AFBc…ee83`) — the deployments are
    ///      independent, so nothing here may be reused as a cross-chain constant.

    /// @dev A deployed `FHETest` v2.
    address internal constant FHE_TEST = 0xba4d707745689eD409d4Afac8722224f5FD78C63;

    uint64 internal constant MAINNET_CHAIN_ID = 1;

    ForgeFhevmEventProcessor internal processor;
    address internal alice;
    bool internal forked;

    function setUp() public {
        string memory rpc = vm.envOr("MAINNET_RPC_URL", string(""));
        if (bytes(rpc).length == 0) return;

        vm.createSelectFork(rpc);
        forked = true;
        alice = makeAddr("alice");
        processor = new ForgeFhevmEventProcessor();
        processor.addExecutor(MAINNET_EXECUTOR);
    }

    modifier onlyForked() {
        vm.skip(!forked);
        _;
    }

    // -- What the fork actually gives us -------------------------------------------

    /// Every address this file hardcodes is live code, and the executor is the one the ACL names —
    /// so a redeployment fails here rather than somewhere subtler.
    function test_theForkHasTheRealHost() public onlyForked {
        assertEq(block.chainid, MAINNET_CHAIN_ID);

        assertGt(MAINNET_ACL.code.length, 0, "ACL");
        assertGt(MAINNET_INPUT_VERIFIER.code.length, 0, "InputVerifier");
        assertGt(MAINNET_KMS_VERIFIER.code.length, 0, "KMSVerifier");
        assertGt(MAINNET_PROTOCOL_CONFIG.code.length, 0, "ProtocolConfig");
        assertGt(MAINNET_EXECUTOR.code.length, 0, "FHEVMExecutor");
        assertGt(FHE_TEST.code.length, 0, "FHETest");

        assertEq(IHost(MAINNET_ACL).getFHEVMExecutorAddress(), MAINNET_EXECUTOR, "the ACL names this executor");
    }

    /// The signer sets are read, not pinned: counts rotate, the shape does not.
    function test_theSignerSetsAreWellFormed() public onlyForked {
        address[] memory kms = IHost(MAINNET_KMS_VERIFIER).getKmsSigners();
        uint256 kmsThreshold = IHost(MAINNET_KMS_VERIFIER).getThreshold();
        assertGt(kms.length, 0, "KMS signers");
        assertGt(kmsThreshold, 0);
        assertLe(kmsThreshold, kms.length, "a threshold no quorum could ever meet would be unusable");

        address[] memory coprocessors = IHost(MAINNET_INPUT_VERIFIER).getCoprocessorSigners();
        uint256 inputThreshold = IHost(MAINNET_INPUT_VERIFIER).getThreshold();
        assertGt(coprocessors.length, 0, "coprocessor signers");
        assertGt(inputThreshold, 0);
        assertLe(inputThreshold, coprocessors.length);
    }

    /// And nothing on that fork can tell you what any handle is worth: the real host keeps ciphertexts
    /// off chain, so there is no `plaintexts(handle)` to call. That absence is the whole problem.
    function test_theRealHostExposesNoCleartext() public onlyForked {
        (bool ok,) = MAINNET_EXECUTOR.staticcall(abi.encodeWithSignature("plaintexts(bytes32)", bytes32(uint256(1))));
        assertFalse(ok, "the production executor has no cleartext database");

        assertFalse(LibCleartextProbe.isCleartext(MAINNET_EXECUTOR), "executor");
        assertFalse(LibCleartextProbe.isCleartext(MAINNET_ACL), "acl");
        assertFalse(LibCleartextProbe.isCleartext(MAINNET_KMS_VERIFIER), "kms verifier");
    }

    // -- Shadowing the REAL executor ------------------------------------------------
    //
    // Nothing on the fork is patched, etched or redeployed. Mainnet's own FHEVMExecutor runs the
    // operation exactly as it always does and announces it; the processor listens to that address and
    // rebuilds the cleartext from the announcement alone.

    function test_theProcessorShadowsMainnetsOwnExecutor() public onlyForked {
        processor.useDeterministicUnknownHandles();
        processor.startRecordingFheEvents();

        vm.prank(alice);
        bytes32 handle = IFHETest(FHE_TEST).setClearEuint64(1337, false);

        uint256 applied = processor.processFheEvents();
        assertGt(applied, 1, "the real executor emitted a whole chain of ops");

        assertEq(processor.plaintexts(handle), 1337, "reconstructed from mainnet's own events");
        assertEq(processor.db().chainIdOf(handle), MAINNET_CHAIN_ID);
    }

    /// Two calls, one processor, then a local computation over both: the chained-contract case, on
    /// real infrastructure.
    function test_chainedCallsAreAllReplayed() public onlyForked {
        processor.useDeterministicUnknownHandles();
        processor.startRecordingFheEvents();

        vm.startPrank(alice);
        bytes32 a = IFHETest(FHE_TEST).setClearEuint64(1000, false);
        bytes32 b = IFHETest(FHE_TEST).setClearEuint32(337, false);
        vm.stopPrank();

        processor.processFheEvents();

        assertEq(processor.plaintexts(a), 1000);
        assertEq(processor.plaintexts(b), 337);

        bytes32 total = keccak256("local dapp result");
        processor.recordBinaryOp(Operators.fheAdd, total, a, b, 0x00, FheType.Uint64);
        assertEq(processor.plaintexts(total), 1337, "a value no one on mainnet can read");
    }

    // -- Handles the processor never saw --------------------------------------------

    /// @dev A handle minted while nothing was recording. Indistinguishable, to the processor, from one
    ///      minted before the fork block: it exists, it is opaque, and no event ever reached the store.
    function _unseenHandle() private returns (bytes32) {
        vm.prank(alice);
        return IFHETest(FHE_TEST).setClearEuint64(4242, false);
    }

    /// By default such a handle is refused rather than invented.
    function test_anUnseenHandleIsRefusedByDefault() public onlyForked {
        bytes32 handle = _unseenHandle();

        vm.expectRevert(abi.encodeWithSelector(ForgeFhevmEventProcessorDB.CleartextEventUnknownHandle.selector, handle));
        processor.plaintexts(handle);
    }

    /// With a policy it reads as a value of the right width, stably, and the store keys it under
    /// MAINNET's chain id — read out of the handle, not out of `block.chainid`.
    function test_anUnseenHandleGetsAValueFromThePolicy() public onlyForked {
        bytes32 handle = _unseenHandle();
        processor.useDeterministicUnknownHandles();

        uint256 v = processor.plaintexts(handle);

        assertEq(processor.db().chainIdOf(handle), MAINNET_CHAIN_ID, "keyed by the handle's own chain");
        assertLt(v, 1 << 64, "clamped to euint64");
        assertTrue(v != 4242, "the policy invents a value; it cannot know the real one");
        assertEq(processor.plaintexts(handle), v, "same handle, same value");
    }

    /// A value the developer knows beats the policy — the escape hatch when a balance IS known.
    function test_aKnownBalanceCanBeSeeded() public onlyForked {
        bytes32 handle = _unseenHandle();
        processor.useDeterministicUnknownHandles();
        processor.seedCleartext(handle, 5_000_000);

        assertEq(processor.plaintexts(handle), 5_000_000);
        assertTrue(processor.statusOf(handle) == ForgeFhevmEventProcessorDB.Status.Known);
    }

    // -- Making the production stack sign with keys we hold --------------------------
    //
    // The processor answers what a handle is WORTH. It does not make the production stack accept a
    // proof we built, because that needs the signers' private keys. The only way to have those is for
    // the registered signers to be addresses we derived — which the ACL owner can arrange, on the
    // fork, for free. These two tests record which halves of that are reachable.

    /// @dev `onlyACLOwner` is `msg.sender == Ownable2StepUpgradeable(acl).owner()`, so a prank is the
    ///      whole of it — no ownership transfer, no storage patching.
    function _aclOwner() private view returns (address) {
        return IHost(MAINNET_ACL).owner();
    }

    /// THE COPROCESSOR HALF WORKS. `InputVerifier` keeps its own signer set and exposes an
    /// owner-gated setter, so a fork can be made to accept input proofs signed with keys we derived.
    function test_theCoprocessorSignerSetCanBeSwappedByTheAclOwner() public onlyForked {
        address ours = vm.addr(uint256(keccak256("cleartext coprocessor")));

        address[] memory replacement = new address[](1);
        replacement[0] = ours;

        vm.prank(_aclOwner());
        IHost(MAINNET_INPUT_VERIFIER).defineNewContext(replacement, 1);

        address[] memory now_ = IHost(MAINNET_INPUT_VERIFIER).getCoprocessorSigners();
        assertEq(now_.length, 1, "the set was replaced wholesale");
        assertEq(now_[0], ours, "and it is ours");
        assertEq(IHost(MAINNET_INPUT_VERIFIER).getThreshold(), 1);
    }

    /// And it really is the owner gate doing the work, not an open setter.
    function test_theCoprocessorSignerSetIsNotSwappableByAnyoneElse() public onlyForked {
        address[] memory replacement = new address[](1);
        replacement[0] = alice;

        vm.prank(alice);
        vm.expectRevert();
        IHost(MAINNET_INPUT_VERIFIER).defineNewContext(replacement, 1);
    }

    /// THE KMS HALF WORKS TOO, through a different contract. `KMSVerifier` holds no signers of its
    /// own: `getKmsSigners` forwards to `ProtocolConfig`, so that is where the lever is — and
    /// `defineNewKmsContext` activates the context it creates (`newContextId = ++currentKmsContextId`),
    /// which is what makes one call enough.
    function test_theKmsSignerSetCanBeSwappedByTheAclOwner() public onlyForked {
        address ours = vm.addr(uint256(keccak256("cleartext kms node")));
        uint256 contextBefore = IProtocolConfig(MAINNET_PROTOCOL_CONFIG).getCurrentKmsContextId();

        IProtocolConfig.KmsNode[] memory nodes = new IProtocolConfig.KmsNode[](1);
        nodes[0] = IProtocolConfig.KmsNode({
            txSenderAddress: vm.addr(uint256(keccak256("cleartext kms connector"))),
            signerAddress: ours,
            ipAddress: "127.0.0.1",
            storageUrl: "http://localhost"
        });

        vm.prank(_aclOwner());
        IProtocolConfig(MAINNET_PROTOCOL_CONFIG)
            .defineNewKmsContext(
                nodes, IProtocolConfig.KmsThresholds({publicDecryption: 1, userDecryption: 1, kmsGen: 1, mpc: 1})
            );

        // Read back through the VERIFIER, which is what a prover actually asks.
        address[] memory now_ = IHost(MAINNET_KMS_VERIFIER).getKmsSigners();
        assertEq(now_.length, 1, "the set was replaced wholesale");
        assertEq(now_[0], ours, "and it is ours");
        assertEq(IHost(MAINNET_KMS_VERIFIER).getThreshold(), 1);

        uint256 contextAfter = IProtocolConfig(MAINNET_PROTOCOL_CONFIG).getCurrentKmsContextId();
        assertTrue(contextAfter != contextBefore, "the new context is the current one");
    }

    /// And it really is the owner gate, here too.
    function test_theKmsSignerSetIsNotSwappableByAnyoneElse() public onlyForked {
        IProtocolConfig.KmsNode[] memory nodes = new IProtocolConfig.KmsNode[](1);
        nodes[0] =
            IProtocolConfig.KmsNode({txSenderAddress: alice, signerAddress: alice, ipAddress: "", storageUrl: ""});

        vm.prank(alice);
        vm.expectRevert();
        IProtocolConfig(MAINNET_PROTOCOL_CONFIG)
            .defineNewKmsContext(
                nodes, IProtocolConfig.KmsThresholds({publicDecryption: 1, userDecryption: 1, kmsGen: 1, mpc: 1})
            );
    }
}
