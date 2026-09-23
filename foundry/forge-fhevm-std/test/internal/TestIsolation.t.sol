// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {euint32, externalEuint32} from "encrypted-types/EncryptedTypes.sol";

import {TestFhevm} from "../../pkg/src/TestFhevm.sol";
import {fhevm} from "../../pkg/src/FhevmVm.sol";
import {ForgeFhevmEventProcessor} from "../../pkg/src/_host/ForgeFhevmEventProcessor.sol";
import {FHEVM_EXECUTOR_ADDRESS} from "../../pkg/src/_host/_internal/LocalHostAddresses.sol";

import {FHECounterPublicDecrypt} from "../examples/contracts/FHECounterPublicDecrypt.sol";

/**
 * @notice WHAT A TEST DOES TO THE STACK DOES NOT REACH THE NEXT TEST — even though the stack, the `fhevm`
 *         handle and this dApp were all created in CONSTRUCTORS, not in `setUp`.
 *
 * @dev Forge deploys the test contract (constructors run), calls `setUp`, then SNAPSHOTS; every test starts
 *      from that snapshot and its changes are reverted before the next one. Constructor state is inside the
 *      snapshot, so it is reset exactly like `setUp` state — including the storage of `fhevm`, a separate
 *      persistent contract, and of the cleartext stack's own contracts. This suite pins that: each test
 *      FIRST asserts everything is pristine, THEN dirties everything it can reach, so whichever order forge
 *      runs them in, a leak from one into the other fails an assertion.
 */
contract TestIsolationTest is TestFhevm {
    FHECounterPublicDecrypt internal counter = new FHECounterPublicDecrypt(); // constructor-created, like the stack
    address internal alice = makeAddr("alice");

    function test_startsPristineThenDirtiesEverything_A() public {
        _assertPristine();
        _dirtyEverything(11);
    }

    function test_startsPristineThenDirtiesEverything_B() public {
        _assertPristine();
        _dirtyEverything(22);
    }

    function _assertPristine() private view {
        assertEq(euint32.unwrap(counter.getCount()), bytes32(0), "the dApp's state is as constructed");
        assertTrue(fhevm.useCleartextVerifier(), "fhevm's own storage is as constructed (no force flag)");
        assertEq(
            ForgeFhevmEventProcessor(fhevm.eventProcessor()).selectedExecutor(),
            FHEVM_EXECUTOR_ADDRESS,
            "the replay reads the local store, as constructed"
        );
    }

    /// Touches every layer: the dApp (an FHE op through the cleartext stack), the replay's store (the op's
    /// events), `fhevm`'s storage (the force flag), and the protocol (a re-declaration).
    function _dirtyEverything(uint32 value) private {
        (externalEuint32 v, bytes memory proof) = encryptUint32(value, address(counter), alice);
        vm.prank(alice);
        counter.increment(v, proof);
        assertEq(decryptPublic(counter.getCount()), value, "dirtied through the whole stack");

        fhevm.setForceProductionPath(true);
        assertFalse(fhevm.useCleartextVerifier(), "fhevm's storage dirtied");
    }
}
