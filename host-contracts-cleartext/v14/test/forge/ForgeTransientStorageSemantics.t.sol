// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

/// @dev A contract of its own, because the question is whether transient storage survives BETWEEN
///      external calls -- writing and reading inside one call would answer nothing.
contract TransientStore {
    uint256 private constant SLOT = uint256(keccak256("fhevm.test.transient-storage-semantics"));

    function write(uint256 value) external {
        uint256 slot = SLOT;
        assembly {
            tstore(slot, value)
        }
    }

    function read() external view returns (uint256 value) {
        uint256 slot = SLOT;
        assembly {
            value := tload(slot)
        }
    }
}

/**
 * @notice How long a `tstore` lasts under forge, measured with none of this package involved.
 *
 * @dev WHY THIS IS PINNED. Two things here depend on the answer and neither states it. `HCULimit` records
 *      each handle's reading with a bare `tstore(handle, hcu)`, and `CleartextForgeHCULimit` carries a
 *      `_clearOnNewTransaction` guard that is only meaningful -- indeed only reachable -- if transient
 *      state outlives a single call. If forge cleared between calls, that guard would read `false` every
 *      time and silently do nothing.
 *
 * @dev AND WHAT IT LETS US CONCLUDE. A handle's HCU reading is therefore readable for the whole test that
 *      minted it, which is what makes "did this stack mint this handle" answerable from data already
 *      stored, without a mapping of our own. The second test is the other half: the answer must not leak
 *      INTO another test, or one test's handles would look minted to the next.
 *
 * @dev Both tests assert they start clear, so whichever forge runs second proves the isolation. Depending
 *      on the order -- a `zzz` in a name, say -- would pin a forge implementation detail instead of the
 *      behaviour.
 *
 * @dev AND WHAT HAPPENS AT A FORK OR A SNAPSHOT, which is the half that decided a design. Transient
 *      storage turns out to be PER FORK and restored when you switch back -- so fork switching, the thing
 *      that looked dangerous, is fine -- while `revertToState` WIPES it rather than restoring it. That
 *      asymmetry is why `CleartextForgeHCULimit` records each handle in ordinary storage: the record is
 *      compared against the `CleartextDB`, and after a revert a transient one would disagree with the
 *      store it is compared against.
 */
contract ForgeTransientStorageSemanticsTest is Test {
    TransientStore internal store;

    function setUp() public {
        store = new TransientStore();
    }

    /// IT SURVIVES. A later external call in the same test sees what an earlier one wrote.
    function test_aTransientWriteOutlivesTheCallThatMadeIt() public {
        assertEq(store.read(), 0, "starts clear");

        store.write(42);

        assertEq(store.read(), 42, "a separate later call still sees it");
    }

    /// AND IT DOES NOT ESCAPE. Forge clears it between test functions, so nothing leaks across.
    function test_nothingLeaksFromOneTestIntoAnother() public {
        assertEq(store.read(), 0, "no other test's value is visible here");

        store.write(7);

        assertEq(store.read(), 7, "and this test's own write works the same way");
    }

    // -- At a fork, and at a snapshot -----------------------------------------------------------------

    /// PER FORK, AND RESTORED. Each fork has its own transient space; leaving one and coming back finds
    /// the writes again, so fork switching alone never loses a reading.
    function test_transientStorageIsPerForkAndComesBack() public {
        string memory rpc = _rpcOrSkip();
        vm.makePersistent(address(store)); // the CONTRACT must survive the switch for the question to mean anything

        uint256 forkA = vm.createSelectFork(rpc);
        store.write(42);
        assertEq(store.read(), 42, "written on A");

        uint256 forkB = vm.createSelectFork(rpc);
        assertEq(store.read(), 0, "B has its own space, and it is empty");

        vm.selectFork(forkA);
        assertEq(store.read(), 42, "and A's is still A's");

        vm.selectFork(forkB);
        assertEq(store.read(), 0, "B unchanged by the visit");
    }

    /// AND CREATING THE FIRST FORK DOES NOT CLEAR IT: what was written in memory is still readable after.
    function test_transientStorageSurvivesTheFirstFork() public {
        string memory rpc = _rpcOrSkip();
        vm.makePersistent(address(store));
        store.write(42);

        vm.createSelectFork(rpc);

        assertEq(store.read(), 42, "the in-memory write is still there");
    }

    /**
     * BUT A REVERT WIPES IT, rather than restoring it -- and that is the asymmetry that matters. Ordinary
     * storage comes BACK to what the snapshot held; transient storage just goes to zero. Anything kept
     * transiently and compared against ordinary storage will therefore disagree with it after a revert,
     * which is why the per-handle HCU record is not kept this way.
     */
    function test_aRevertWipesTransientStorageRatherThanRestoringIt() public {
        string memory rpc = _rpcOrSkip();
        vm.makePersistent(address(store));
        vm.createSelectFork(rpc);

        uint256 snapshot = vm.snapshotState();
        store.write(42);
        assertEq(store.read(), 42, "written after the snapshot");

        vm.revertToState(snapshot);

        assertEq(store.read(), 0, "gone -- not restored to what the snapshot held, which was also 0 here");
    }

    /// @dev The three fork cases need a network; without one they skip, like every other remote test here.
    function _rpcOrSkip() private returns (string memory rpc) {
        rpc = vm.envOr("SEPOLIA_RPC_URL", string(""));
        vm.skip(bytes(rpc).length == 0);
    }
}
