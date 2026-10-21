// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {ForgeFhevmDeploy} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {ACL_ADDRESS, CLEARTEXT_DB_ADDRESS, FHEVM_EXECUTOR_ADDRESS} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {ICleartextDB, ICleartextFHEVMExecutor} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {IACL} from "../../pkg/forge/src/_internal/interfaces/IACL.sol";
import {LibCleartextProbe} from "../../pkg/forge/src/shared/LibCleartextProbe.sol";
import {FheType} from "../../pkg/forge/src/shared/LibFheType.sol";
import {FhevmHostContracts, LocalHostUpgrade} from "../../pkg/forge/src/_internal/LocalHostBytecode.sol";

interface IUUPSProxy {
    function upgradeToAndCall(address newImplementation, bytes calldata data) external payable;
}

/**
 * Can a stack running the PRODUCTION executor be turned into a cleartext one
 * by re-pointing its proxy, so that plaintexts come from the stack itself and the event replay has
 * nothing left to reconstruct?
 *
 * WHY IT IS DONE HERE AND NOT ON A FORK. Two risks sit on top of each other in the real thing: whether
 * the upgrade works at all (storage layout, initializers, the DB), and whether an implementation can be
 * patched to point at a remote stack's addresses. Only the first can kill the idea, and it does not need
 * a fork to answer -- so this drives a LOCAL stack down to production and back up, where every sibling
 * address is already the one the blobs bake in and nothing needs patching. If this passes, what is left
 * is table entries.
 *
 * WHAT WOULD MAKE IT FAIL. `CleartextFHEVMExecutor is FHEVMExecutor` and declares no state of its own,
 * so the two should share a layout exactly; a revert here, or a DB that stops answering for handles
 * minted before the round trip, says that reading is wrong.
 *
 * NEITHER IMPLEMENTATION IS COMPILED HERE, and that is rule 4.1 rather than a convenience. `new
 * FHEVMExecutor()` bakes in `internal/placeholders/`, so it calls a HCULimit that does not exist and
 * reverts on the first op. The production blob compiled against the LOCALHOST addresses is the one
 * `LocalHostUpgrade` already ships; the cleartext one is already behind the proxy, and its address is
 * read out of the ERC-1967 slot before anything moves.
 */
contract CleartextImplementationSwapTest is Test, ForgeFhevmDeploy {
    ICleartextFHEVMExecutor internal executor;
    ICleartextDB internal db;
    address internal owner;

    function setUp() public {
        deployLocalFhevm();
        executor = ICleartextFHEVMExecutor(FHEVM_EXECUTOR_ADDRESS);
        db = ICleartextDB(CLEARTEXT_DB_ADDRESS);
        owner = IACL(ACL_ADDRESS).owner();
    }

    /// @dev ERC-1967.
    bytes32 private constant IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    function test_theProxyMovesBetweenProductionAndCleartext() public {
        address cleartextImplementation =
            address(uint160(uint256(vm.load(FHEVM_EXECUTOR_ADDRESS, IMPLEMENTATION_SLOT))));
        assertTrue(cleartextImplementation != address(0), "the proxy names an implementation");

        // -- 1. cleartext, as deployed: the stack records what it computes -------------------------
        assertTrue(LibCleartextProbe.isCleartext(FHEVM_EXECUTOR_ADDRESS), "starts cleartext");
        bytes32 before = executor.trivialEncrypt(7, FheType.Uint32);
        assertEq(db.get(before), 7, "and the DB holds it");

        // -- 2. down to production: the same proxy, upstream's implementation ------------------------
        address production = _deploy(LocalHostUpgrade.creationCode(FhevmHostContracts.FHEVMExecutor));
        vm.prank(owner);
        IUUPSProxy(FHEVM_EXECUTOR_ADDRESS).upgradeToAndCall(production, "");

        assertFalse(LibCleartextProbe.isCleartext(FHEVM_EXECUTOR_ADDRESS), "now indistinguishable from a real chain");
        // called through the SAME interface: the ABI does not change, only what happens behind it
        bytes32 blind = executor.trivialEncrypt(8, FheType.Uint32);
        assertFalse(db.has(blind), "a handle minted with no cleartext layer records nothing");

        // -- 3. back up to cleartext: THE MOVE THE WHOLE IDEA RESTS ON -------------------------------
        vm.prank(owner);
        IUUPSProxy(FHEVM_EXECUTOR_ADDRESS).upgradeToAndCall(cleartextImplementation, "");

        assertTrue(LibCleartextProbe.isCleartext(FHEVM_EXECUTOR_ADDRESS), "cleartext again");
        assertEq(db.get(executor.trivialEncrypt(9, FheType.Uint32)), 9, "and recording again");

        // -- 4. nothing was lost on the way ----------------------------------------------------------
        assertEq(db.get(before), 7, "the DB kept what it had before the round trip");
        assertFalse(db.has(blind), "and did not invent what was never recorded");
    }

    function _deploy(bytes memory creationCode) private returns (address deployed) {
        assembly {
            deployed := create(0, add(creationCode, 0x20), mload(creationCode))
        }
        require(deployed != address(0), "deploy failed");
    }
}
