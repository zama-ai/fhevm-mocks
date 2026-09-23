// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {euint32, euint64} from "encrypted-types/EncryptedTypes.sol";

import {StdFhevmCheatsSafe} from "../../pkg/src/StdFhevmCheats.sol";
import {StdFhevmChains} from "../../pkg/src/StdFhevmChains.sol";
import {ForgeFhevmEventProcessor, ForgeFhevmEventProcessorDB} from "../../pkg/src/_host/ForgeFhevmEventProcessor.sol";
import {Operators} from "../../pkg/src/_host/shared/FhevmOperatorsEnum.sol";
import {FheType} from "../../pkg/src/_host/shared/LibFheType.sol";
import {fhevm} from "../../pkg/src/FhevmVm.sol";
import {ForkBlocks} from "../shared/ForkBlocks.sol";

/// The slice of the deployed `FHETest` this suite drives.
/// @dev Its handles live in `mapping(address => mapping(FheType => bytes32))` keyed by CALLER, which is
///      why every getter reverts until you prank an address that has actually set one.
interface IFHETest {
    function getHandleOf(address account, uint8 fheType) external view returns (bytes32);
    function getEuint64() external view returns (bytes32);
    function setClearEuint64(uint64 value, bool makePublic) external returns (bytes32);
    function setClearEuint32(uint32 value, bool makePublic) external returns (bytes32);
}

/**
 * @notice forge-fhevm-std against a REAL chain: fork Sepolia, leave its FHEVM stack untouched, and read
 *         cleartexts that only exist because the event processor reconstructed them.
 *
 * @dev WHAT IS DIFFERENT FROM EVERY OTHER SUITE HERE. The rest of `test/` inherits `StdFhevm`, whose constructor deploys, and gets
 *      a local cleartext stack where every handle's value is known by construction. There is no such
 *      stack here and none is deployed: Sepolia's own `FHEVMExecutor` runs each operation and announces
 *      it, and `ForgeFhevmEventProcessor` replays those announcements into a store of its own.
 *      Nothing on the fork is patched, etched or redeployed.
 *
 *      Two kinds of handle therefore exist, and the difference matters:
 *
 *        - Minted INSIDE the recording window. Every operand and operator is in the log stream, so the
 *          value is reconstructed exactly. `setClearEuint64(1337)` reads back as 1337.
 *        - Minted BEFORE it — the sender's pre-existing balances. No event, and nothing on Sepolia can
 *          decrypt them, so they take a value from `UnknownHandlePolicy`: deterministic, stable, and
 *          clamped to the handle's own type. Fine for exercising a dApp's logic, meaningless as data.
 *
 * @dev SKIPPED unless an RPC URL is configured for `sepolia` (`[rpc_endpoints]` in foundry.toml, or
 *      `SEPOLIA_RPC_URL`), so the offline suite stays green:
 *
 *          SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com forge test --match-path 'test/fork/*'
 */
contract SepoliaForkTest is Test, StdFhevmChains, StdFhevmCheatsSafe {
    // -- Sepolia, hardcoded ---------------------------------------------------------

    uint256 internal constant SEPOLIA_CHAIN_ID = 11_155_111;

    /// @dev A deployed `FHETest` (fhevm4/sdk/js-sdk/contracts/src/FHETest.sol).
    address internal constant FHE_TEST = 0x94B9d3aF050687D1F76251aD7D09a1F216a19845;

    /// @dev An address that really did set handles on it, long before any block this test forks at.
    address internal constant SENDER = 0x37AC010c1c566696326813b840319B58Bb5840E4;

    /// @dev Sepolia's own FHEVM host, from the chain table (`getFhevmChain("testnet", "sepolia")`). Left
    ///      entirely alone: nothing here is modified, the SDK only listens to it.
    FhevmChain internal sepolia;

    /// @dev FheType.Uint64 / FheType.Uint32, spelled as the wire does — the enum is host-internal.
    uint8 internal constant TYPE_UINT64 = 5;
    uint8 internal constant TYPE_UINT32 = 4;

    ForgeFhevmEventProcessor internal processor;
    bool internal forked;

    function setUp() public {
        if (!ForkBlocks.enabled("sepolia")) return; // opt in: [rpc_endpoints] sepolia, or SEPOLIA_RPC_URL

        // Fork and name the stack in one call; the SDK prepares it from there (this suite inherits the
        // cheats mixin alone, so the preparation happens at the first SDK entry below).
        sepolia = getFhevmChain("testnet", "sepolia"); // its rpcUrl is the configured one
        fhevm.createSelectFork(sepolia, ForkBlocks.recent(sepolia.rpcUrl));
        forked = true;

        // The policy through the SDK, which prepares the fork first — so it lands on Sepolia's store, not
        // on whichever executor the processor registered first. `processor` is kept for the assertions
        // below that read the store directly.
        forkUnknownDeterministic();
        processor = ForgeFhevmEventProcessor(fhevm.eventProcessor());
    }

    modifier onlyForked() {
        vm.skip(!forked);
        _;
    }

    // -- Ground truth, before anything clever ---------------------------------------

    /// The fork is what we think it is, and the contract really is deployed on it.
    function test_theForkIsSepoliaAndTheContractIsThere() public onlyForked {
        assertEq(block.chainid, SEPOLIA_CHAIN_ID);
        assertGt(FHE_TEST.code.length, 0, "FHETest");
        assertGt(sepolia.fhevmExecutor.code.length, 0, "the real coprocessor");
        assertGt(sepolia.acl.code.length, 0, "the real ACL");
    }

    /// The sender's handles predate the fork, and carry Sepolia's chain id in bytes 22..29.
    function test_theSenderHasPreExistingHandles() public onlyForked {
        bytes32 handle = IFHETest(FHE_TEST).getHandleOf(SENDER, TYPE_UINT64);

        assertTrue(handle != bytes32(0), "minted long ago");
        // casting to 'uint64' is safe because SEPOLIA_CHAIN_ID is 11155111, far inside the range, and
        // the shift leaves the handle's own 8-byte chain field in the low bits.
        // forge-lint: disable-next-line(unsafe-typecast)
        assertEq(uint64(uint256(handle) >> 16), uint64(SEPOLIA_CHAIN_ID), "minted on Sepolia");
    }

    // -- THE FIRST REAL TEST --------------------------------------------------------

    /// `read` on a value Sepolia computed and nobody can decrypt. The operation ran on the real
    /// executor; the number comes from replaying what it announced.
    function test_readReturnsAValueReconstructedFromSepoliasEvents() public onlyForked {
        vm.prank(SENDER);
        bytes32 handle = IFHETest(FHE_TEST).setClearEuint64(1337, false);

        processor.processFheEvents();

        assertEq(plaintextOf(euint64.wrap(handle)), 1337, "plaintextOf() through StdFhevmCheatsSafe");
    }

    /// A chain of operations across two calls, all replayed. Every intermediate has to be right for
    /// the last one to be.
    function test_readAcrossSeveralOperations() public onlyForked {
        vm.startPrank(SENDER);
        bytes32 a = IFHETest(FHE_TEST).setClearEuint64(1000, false);
        bytes32 b = IFHETest(FHE_TEST).setClearEuint32(337, false);
        vm.stopPrank();

        processor.processFheEvents();

        assertEq(plaintextOf(euint64.wrap(a)), 1000);
        assertEq(plaintextOf(euint32.wrap(b)), 337);
    }

    /// A PRE-EXISTING handle: no event ever announced it and nothing on Sepolia can decrypt it, so the
    /// policy answers — stably, and clamped to the handle's own width. Usable as a dApp input; not data.
    function test_readAPreExistingHandleThroughThePolicy() public onlyForked {
        bytes32 balance = IFHETest(FHE_TEST).getHandleOf(SENDER, TYPE_UINT64);

        uint64 v = plaintextOf(euint64.wrap(balance));

        assertEq(plaintextOf(euint64.wrap(balance)), v, "same handle, same value");
        assertEq(processor.db().synthesize(balance), v, "predictable before reading");
    }

    // -- Values the chain cannot supply ---------------------------------------------

    /// A PRE-EXISTING handle given its value BY HAND. The policy can only invent one; `seedCleartext`
    /// states it, and beats the policy — which is what a test wants when the balance is actually known
    /// from somewhere outside the chain.
    function test_aPreExistingHandleCanBeSeededWithAKnownValue() public onlyForked {
        bytes32 balance = IFHETest(FHE_TEST).getHandleOf(SENDER, TYPE_UINT64);

        uint64 invented = plaintextOf(euint64.wrap(balance));
        assertTrue(invented != 5_000_000, "the policy's value is not the one we are about to set");

        processor.seedCleartext(balance, 5_000_000);

        assertEq(plaintextOf(euint64.wrap(balance)), 5_000_000, "the value we set");
        assertTrue(processor.statusOf(balance) == ForgeFhevmEventProcessorDB.Status.Known, "known, not synthesised");
    }

    /// AND IT IS A REAL VALUE FROM THERE ON. A dApp adds the seeded balance to one Sepolia computed
    /// moments ago, and the sum is what both parts say it should be.
    function test_aSeededBalanceCombinesWithAReplayedOne() public onlyForked {
        bytes32 balance = IFHETest(FHE_TEST).getHandleOf(SENDER, TYPE_UINT64);
        processor.seedCleartext(balance, 5_000_000);

        vm.prank(SENDER);
        bytes32 fresh = IFHETest(FHE_TEST).setClearEuint64(1337, false);
        processor.processFheEvents();

        bytes32 total = keccak256("the dapp's result handle");
        processor.recordBinaryOp(Operators.fheAdd, total, balance, fresh, 0x00, FheType.Uint64);

        assertEq(plaintextOf(euint64.wrap(total)), 5_001_337, "seeded + replayed");
    }

    /// Without a policy the same handle is refused by name, rather than answered with zero.
    function test_aPreExistingHandleIsRefusedWithoutAPolicy() public onlyForked {
        processor.revertOnUnknownHandles();
        bytes32 balance = IFHETest(FHE_TEST).getHandleOf(SENDER, TYPE_UINT64);

        vm.expectRevert();
        this.readBalance(balance);
    }

    /// External so `vm.expectRevert` has a call frame to catch.
    function readBalance(bytes32 handle) external returns (uint64) {
        return plaintextOf(euint64.wrap(handle));
    }
}
