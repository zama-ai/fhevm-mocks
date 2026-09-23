// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {ForgeFhevmEventProcessor, ForgeFhevmEventProcessorDB} from "../../pkg/forge/src/ForgeFhevmEventProcessor.sol";
import {FheType} from "../../pkg/forge/src/shared/LibFheType.sol";
import {LibCleartextProbe} from "../../pkg/forge/src/shared/LibCleartextProbe.sol";
import {Operators} from "../../pkg/forge/src/shared/FhevmOperatorsEnum.sol";

/// The bits of the deployed `FHETest` this test touches. Its handles live in
/// `mapping(address => mapping(FheType => bytes32)) _etypeMap` at slot 0, per CALLER — which is why
/// slots 0..7 read as zero and the getters revert until something is planted for `msg.sender`.
interface IFHETest {
    function setClearEuint64(uint64 value, bool makePublic) external returns (bytes32);
    function setClearEuint32(uint32 value, bool makePublic) external returns (bytes32);
    function getHandleOf(address account, FheType fheType) external view returns (bytes32);
    function hasHandleOf(address account, FheType fheType) external view returns (bool);
    function getEbool() external view returns (bytes32);
    function getEuint64() external view returns (bytes32);
    function getEuint32() external view returns (bytes32);
}

/**
 * @notice Forks Sepolia and drives the event processor against a REAL deployed FHE contract.
 *
 * @dev The point of the suite is the awkward case the local tests cannot show: on a fork, handles
 *      already exist, no event ever announced them, and the real FHEVM host has no cleartext anywhere.
 *      That is the situation `UnknownHandlePolicy` is for.
 *
 *      Skipped unless `SEPOLIA_RPC_URL` is set, so the offline suite stays green:
 *
 *          SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com forge test --match-contract Sepolia
 */
/// Answers `IS_CLEARTEXT` like the real cleartext stack does. Deployed onto the fork, it stands in for
/// a cleartext stack deployed REMOTELY — on anvil, a devnet, or here.
contract RemoteCleartextExecutor {
    bool public constant IS_CLEARTEXT = true;
}

contract SepoliaForkEventProcessorTest is Test {
    /// @dev A deployed `FHETest` (sdk/js-sdk/contracts/src/FHETest.sol).
    address internal constant FHE_TEST = 0x94B9d3aF050687D1F76251aD7D09a1F216a19845;

    /// @dev An address that really did set handles on that contract, long before the fork block. Its
    ///      eight handles are genuine: opaque bodies, Sepolia's chain id (0xaa36a7), and no event in
    ///      any window this test could record.
    address internal constant SENDER = 0x37AC010c1c566696326813b840319B58Bb5840E4;

    /// @dev Sepolia's real host, from `ZamaConfig._getSepoliaConfig()`.
    address internal constant SEPOLIA_ACL = 0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D;
    address internal constant SEPOLIA_COPROCESSOR = 0x92C920834Ec8941d2C77D188936E1f7A6f49c127;

    uint64 internal constant SEPOLIA_CHAIN_ID = 11_155_111;

    ForgeFhevmEventProcessor internal processor;
    address internal alice;
    bool internal forked;

    function setUp() public {
        string memory rpc = vm.envOr("SEPOLIA_RPC_URL", string(""));
        if (bytes(rpc).length == 0) return;

        vm.createSelectFork(rpc);
        forked = true;
        alice = makeAddr("alice");
        processor = new ForgeFhevmEventProcessor();
        processor.addExecutor(SEPOLIA_COPROCESSOR);
    }

    modifier onlyForked() {
        vm.skip(!forked);
        _;
    }

    /// @dev `_etypeMap[account][fheType]`, the nested mapping at slot 0.
    function _handleSlot(address account, FheType fheType) private pure returns (bytes32) {
        bytes32 inner = keccak256(abi.encode(account, uint256(0)));
        return keccak256(abi.encode(uint256(fheType), inner));
    }

    /// @dev The sender's real handle for `fheType`, read off the forked chain.
    function _realHandle(FheType fheType) private view returns (bytes32) {
        return IFHETest(FHE_TEST).getHandleOf(SENDER, fheType);
    }

    // -- What the fork actually gives us -------------------------------------------

    /// The contract is really there, and so is Sepolia's own FHEVM host.
    function test_theForkHasTheContractAndTheRealHost() public onlyForked {
        assertEq(block.chainid, SEPOLIA_CHAIN_ID);
        assertGt(FHE_TEST.code.length, 0, "FHETest is deployed");
        assertGt(SEPOLIA_ACL.code.length, 0, "the real ACL is deployed");
        assertGt(SEPOLIA_COPROCESSOR.code.length, 0, "the real coprocessor is deployed");
    }

    /// The sender's handles are really on chain, one per type, and they say so themselves: each
    /// carries Sepolia's chain id in bytes 22..29 and its own type in byte 30.
    function test_theSenderHasRealHandles() public onlyForked {
        FheType[8] memory types = [
            FheType.Bool,
            FheType.Uint8,
            FheType.Uint16,
            FheType.Uint32,
            FheType.Uint64,
            FheType.Uint128,
            FheType.Uint160,
            FheType.Uint256
        ];

        for (uint256 i = 0; i < types.length; i++) {
            bytes32 handle = _realHandle(types[i]);

            assertTrue(handle != bytes32(0), "minted");
            assertEq(processor.db().chainIdOf(handle), SEPOLIA_CHAIN_ID, "minted on Sepolia");
            assertEq(uint8(handle[30]), uint8(types[i]), "carries its own type");
        }

        // And the caller-facing getters agree, which is how a dApp would reach them.
        vm.startPrank(SENDER);
        assertEq(IFHETest(FHE_TEST).getEbool(), _realHandle(FheType.Bool));
        assertEq(IFHETest(FHE_TEST).getEuint64(), _realHandle(FheType.Uint64));
        vm.stopPrank();
    }

    /// And nothing on that fork can tell you what any of them is worth: the real host keeps ciphertexts
    /// off chain, so there is no `plaintexts(handle)` to call. That absence is the whole problem.
    function test_theRealHostExposesNoCleartext() public onlyForked {
        bytes32 handle = _realHandle(FheType.Uint64);

        (bool ok,) = SEPOLIA_COPROCESSOR.staticcall(abi.encodeWithSignature("plaintexts(bytes32)", handle));
        assertFalse(ok, "the production coprocessor has no cleartext database");
    }

    // -- Writing to a forked contract ----------------------------------------------

    /// Storage of a contract you did not deploy is writable locally: the fork is a private EVM whose
    /// state is lazily pulled from RPC, and a write never leaves the machine.
    function test_aHandleCanBePlantedInTheForkedContract() public onlyForked {
        bytes32 borrowed = _realHandle(FheType.Uint64);

        // `alice` has nothing on the real chain.
        vm.prank(alice);
        vm.expectRevert("Handle does not exist");
        IFHETest(FHE_TEST).getEuint64();

        vm.store(FHE_TEST, _handleSlot(alice, FheType.Uint64), borrowed);

        vm.prank(alice);
        assertEq(IFHETest(FHE_TEST).getEuint64(), borrowed, "the deployed getter returns what we wrote");
        assertEq(_realHandle(FheType.Uint64), borrowed, "and the real sender's entry is untouched");
    }

    // -- Giving those handles a value ----------------------------------------------

    /// By default an opaque forked handle is refused rather than invented.
    function test_aForkedHandleIsRefusedByDefault() public onlyForked {
        bytes32 handle = _realHandle(FheType.Uint64);

        vm.expectRevert(abi.encodeWithSelector(ForgeFhevmEventProcessorDB.CleartextEventUnknownHandle.selector, handle));
        processor.plaintexts(handle);
    }

    /// With a policy it reads as a value of the right width, stably, and the store keys it under
    /// SEPOLIA's chain id — read out of the handle, not out of `block.chainid`.
    function test_aForkedHandleGetsAValueFromThePolicy() public onlyForked {
        processor.useDeterministicUnknownHandles();

        bytes32 balance = _realHandle(FheType.Uint64);
        uint256 v = processor.plaintexts(balance);

        assertEq(processor.db().chainIdOf(balance), SEPOLIA_CHAIN_ID, "keyed by the handle's own chain");
        assertLt(v, 1 << 64, "clamped to euint64");
        assertEq(processor.plaintexts(balance), v, "same handle, same value");
        assertEq(processor.db().synthesize(balance), v, "predictable before reading");
    }

    /// THE SCENARIO: a dApp adds two balances it found on chain, neither of which anyone can decrypt.
    /// The replay gives both a value and records the result, so the dApp's own assertions have
    /// something to stand on.
    function test_aDappCombinesTwoOpaqueForkedBalances() public onlyForked {
        processor.useDeterministicUnknownHandles();

        // Two genuine handles off the fork, of different widths — as an `add(euint64, euint32)` would
        // take. Neither value is knowable to anyone holding only this chain's state.
        bytes32 balanceA = _realHandle(FheType.Uint64);
        bytes32 balanceB = _realHandle(FheType.Uint32);
        bytes32 total = keccak256("the dapp's result handle");

        uint256 a = processor.plaintexts(balanceA);
        uint256 b = processor.plaintexts(balanceB);
        assertTrue(a != b, "two handles, two values");
        assertLt(b, 1 << 32, "each clamped to its own width");

        processor.recordBinaryOp(Operators.fheAdd, total, balanceA, balanceB, 0x00, FheType.Uint64);

        assertEq(processor.plaintexts(total), uint64(a + b), "modular at the LHS width");
        assertTrue(processor.statusOf(total) == ForgeFhevmEventProcessorDB.Status.Known);
    }

    // -- Shadowing the REAL executor ------------------------------------------------
    //
    // Nothing on the fork is patched, etched or redeployed. Sepolia's own FHEVMExecutor runs the
    // operation exactly as it always does and announces it; the processor listens to that address and
    // rebuilds the cleartext from the announcement alone.

    /// `setClearEuint64(v)` computes `rand -> shr/xor (zero by construction) -> cast -> or(v)`, so the
    /// answer is `v` however the random draw came out. The processor never sees the coprocessor's
    /// randomness and does not need to: it replays the same chain and lands on the same handle.
    function test_theProcessorShadowsSepoliasOwnExecutor() public onlyForked {
        processor.useDeterministicUnknownHandles();
        processor.startRecordingFheEvents();

        vm.prank(SENDER);
        bytes32 handle = IFHETest(FHE_TEST).setClearEuint64(1337, false);

        uint256 applied = processor.processFheEvents();
        assertGt(applied, 1, "the real executor emitted a whole chain of ops");

        assertEq(processor.plaintexts(handle), 1337, "reconstructed from Sepolia's own events");
        assertEq(processor.db().chainIdOf(handle), SEPOLIA_CHAIN_ID);
    }

    /// Two contracts, two calls, one processor: the chained-contract case, on real infrastructure.
    function test_chainedCallsAreAllReplayed() public onlyForked {
        processor.useDeterministicUnknownHandles();
        processor.startRecordingFheEvents();

        vm.startPrank(SENDER);
        bytes32 a = IFHETest(FHE_TEST).setClearEuint64(1000, false);
        bytes32 b = IFHETest(FHE_TEST).setClearEuint32(337, false);
        vm.stopPrank();

        processor.processFheEvents();

        assertEq(processor.plaintexts(a), 1000);
        assertEq(processor.plaintexts(b), 337);

        // And a local computation over both, recorded into the same store.
        bytes32 total = keccak256("local dapp result");
        processor.recordBinaryOp(Operators.fheAdd, total, a, b, 0x00, FheType.Uint64);
        assertEq(processor.plaintexts(total), 1337, "a value no one on Sepolia can read");
    }

    /// RULE 1: a cleartext stack is fine to replay when it is deployed REMOTELY. Only the local
    /// in-memory one is refused, and the difference is whether a fork is selected — which it is here.
    /// The same construction reverts in the offline suite, where no fork is.
    function test_aRemotelyDeployedCleartextExecutorIsAccepted() public onlyForked {
        address remote = address(new RemoteCleartextExecutor());

        ForgeFhevmEventProcessor p = new ForgeFhevmEventProcessor();
        p.addExecutor(remote);

        assertTrue(p.isExecutor(remote), "accepted because a fork is selected");
        assertTrue(LibCleartextProbe.isCleartext(remote), "and it really is a cleartext stack");
    }

    /// A value the developer knows beats the policy — the escape hatch when a balance IS known.
    function test_aKnownBalanceCanBeSeeded() public onlyForked {
        processor.useDeterministicUnknownHandles();

        bytes32 balance = _realHandle(FheType.Uint64);
        processor.seedCleartext(balance, 5_000_000);

        assertEq(processor.plaintexts(balance), 5_000_000);
        assertTrue(processor.statusOf(balance) == ForgeFhevmEventProcessorDB.Status.Known);
    }
}
