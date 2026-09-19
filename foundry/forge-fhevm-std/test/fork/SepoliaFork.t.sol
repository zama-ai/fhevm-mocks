// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {euint32, euint64} from "encrypted-types/EncryptedTypes.sol";

import {StdFhevmDebug} from "../../pkg/src/StdFhevmDebug.sol";
import {FhevmCleartextEventProcessor} from "../../pkg/src/_host/FhevmCleartextEventProcessor.sol";

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
 * @dev WHAT IS DIFFERENT FROM EVERY OTHER SUITE HERE. The rest of `test/` calls `setUpFhevm()` and gets
 *      a local cleartext stack where every handle's value is known by construction. There is no such
 *      stack here and none is deployed: Sepolia's own `FHEVMExecutor` runs each operation and announces
 *      it, and `FhevmCleartextEventProcessor` replays those announcements into a store of its own.
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
 * @dev SKIPPED unless `SEPOLIA_RPC_URL` is set, so the offline suite stays green:
 *
 *          SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com forge test --match-path 'test/fork/*'
 */
contract SepoliaForkTest is Test, StdFhevmDebug {
    // -- Sepolia, hardcoded ---------------------------------------------------------

    uint256 internal constant SEPOLIA_CHAIN_ID = 11_155_111;

    /// @dev A deployed `FHETest` (fhevm4/sdk/js-sdk/contracts/src/FHETest.sol).
    address internal constant FHE_TEST = 0x94B9d3aF050687D1F76251aD7D09a1F216a19845;

    /// @dev An address that really did set handles on it, long before any block this test forks at.
    address internal constant SENDER = 0x37AC010c1c566696326813b840319B58Bb5840E4;

    /// @dev Sepolia's own FHEVM host, from `ZamaConfig._getSepoliaConfig()` and the js-sdk chain
    ///      definition. Left entirely alone — listed because the processor must know which emitter to
    ///      listen to, not because anything here is modified.
    address internal constant ACL = 0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D;
    address internal constant COPROCESSOR = 0x92C920834Ec8941d2C77D188936E1f7A6f49c127;
    address internal constant INPUT_VERIFIER = 0xBBC1fFCdc7C316aAAd72E807D9b0272BE8F84DA0;
    address internal constant KMS_VERIFIER = 0xbE0E383937d564D7FF0BC3b46c51f0bF8d5C311A;
    address internal constant PROTOCOL_CONFIG = 0x51f9AFBc89Ea792e1a21a12AB802ab58D4dbee83;

    /// @dev FheType.Uint64 / FheType.Uint32, spelled as the wire does — the enum is host-internal.
    uint8 internal constant TYPE_UINT64 = 5;
    uint8 internal constant TYPE_UINT32 = 4;

    FhevmCleartextEventProcessor internal processor;
    bool internal forked;

    function setUp() public {
        string memory rpc = vm.envOr("SEPOLIA_RPC_URL", string(""));
        if (bytes(rpc).length == 0) return;

        vm.createSelectFork(rpc);
        forked = true;

        processor = new FhevmCleartextEventProcessor(COPROCESSOR);
        processor.useDeterministicUnknownHandles();
        processor.startRecordingFheEvents();
    }

    /// @inheritdoc StdFhevmDebug
    /// @dev The whole bridge: `read` resolves through here, so pointing it at the processor's store
    ///      makes every `read(...)` below answer from Sepolia's replayed event stream instead of a
    ///      local cleartext stack that does not exist on this fork.
    function cleartextDbAddress() public view override returns (address) {
        return address(processor.db());
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
        assertGt(COPROCESSOR.code.length, 0, "the real coprocessor");
        assertGt(ACL.code.length, 0, "the real ACL");
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

        assertEq(read(euint64.wrap(handle)), 1337, "read() through StdFhevmDebug");
    }

    /// A chain of operations across two calls, all replayed. Every intermediate has to be right for
    /// the last one to be.
    function test_readAcrossSeveralOperations() public onlyForked {
        vm.startPrank(SENDER);
        bytes32 a = IFHETest(FHE_TEST).setClearEuint64(1000, false);
        bytes32 b = IFHETest(FHE_TEST).setClearEuint32(337, false);
        vm.stopPrank();

        processor.processFheEvents();

        assertEq(read(euint64.wrap(a)), 1000);
        assertEq(read(euint32.wrap(b)), 337);
    }

    /// A PRE-EXISTING handle: no event ever announced it and nothing on Sepolia can decrypt it, so the
    /// policy answers — stably, and clamped to the handle's own width. Usable as a dApp input; not data.
    function test_readAPreExistingHandleThroughThePolicy() public onlyForked {
        bytes32 balance = IFHETest(FHE_TEST).getHandleOf(SENDER, TYPE_UINT64);

        uint64 v = read(euint64.wrap(balance));

        assertEq(read(euint64.wrap(balance)), v, "same handle, same value");
        assertEq(processor.db().synthesize(balance), v, "predictable before reading");
    }

    /// Without a policy the same handle is refused by name, rather than answered with zero.
    function test_aPreExistingHandleIsRefusedWithoutAPolicy() public onlyForked {
        processor.revertOnUnknownHandles();
        bytes32 balance = IFHETest(FHE_TEST).getHandleOf(SENDER, TYPE_UINT64);

        vm.expectRevert();
        this.readBalance(balance);
    }

    /// External so `vm.expectRevert` has a call frame to catch.
    function readBalance(bytes32 handle) external view returns (uint64) {
        return read(euint64.wrap(handle));
    }
}
