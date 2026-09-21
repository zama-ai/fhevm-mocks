// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint32} from "@fhevm/solidity/lib/FHE.sol";

import {TestFhevm} from "../../pkg/src/TestFhevm.sol";
import {ForgeFhevmEventProcessor} from "../../pkg/src/_host/ForgeFhevmEventProcessor.sol";
import {fhevm} from "../../pkg/src/FhevmVm.sol";
import {LibFhevmProtocol} from "../../pkg/src/LibFhevmProtocol.sol";
import {ACL_ADDRESS, FHEVM_EXECUTOR_ADDRESS, KMS_VERIFIER_ADDRESS} from "../../pkg/src/_host/ForgeFhevmDeploy.sol";
import {CLEARTEXT_ARITHMETIC_ADDRESS, CLEARTEXT_DB_ADDRESS} from "../../pkg/src/_host/ForgeFhevmDeploy.sol";

/// Which stack the harness is pointed at, and — just as important — what the harness is NOT.
contract LibFhevmProtocolTest is TestFhevm {
    /// @dev `keccak256(abi.encode(uint256(keccak256("confidential.storage.config")) - 1)) & ~bytes32(uint256(0xff))`
    ///      The slot `ZamaConfig` writes and `FHE.*` reads. Restated here rather than imported, so this
    ///      test still fails if the package ever starts writing it.
    bytes32 internal constant FHEVM_CONFIG_SLOT = 0x9e7b61f58c47dc699ac88507c4f5bb9f121c03808c5676a8078fe583e4649700;

    /// THE POINT OF THE SEPARATE NAMESPACE. Configuring the harness must not make the harness an FHE
    /// contract: filling the fhevm slot would let `FHE.add(...)` called straight from a test succeed,
    /// and a test that reaches for `FHE` directly has made a mistake that should surface as one.
    function test_setUpDoesNotMakeTheTestContractAnFheCaller() public view {
        for (uint256 i = 0; i < 3; i++) {
            assertEq(
                vm.load(address(this), bytes32(uint256(FHEVM_CONFIG_SLOT) + i)),
                bytes32(0),
                "the fhevm coprocessor config slot must stay empty"
            );
        }
    }

    /// And the consequence, demonstrated: FHE really does not work here.
    function test_fheCalledDirectlyFromTheTestFails() public {
        vm.expectRevert();
        this.trivialEncryptFromTheHarness(7);
    }

    /// External so `vm.expectRevert` has a frame to catch.
    function trivialEncryptFromTheHarness(uint32 value) external returns (euint32) {
        return FHE.asEuint32(value);
    }

    /// Meanwhile the harness knows exactly which stack it is driving.
    function test_setUpDeclaresTheLocalStack() public view {
        assertTrue(LibFhevmProtocol.hasProtocol());

        assertEq(LibFhevmProtocol.currentConfig().acl, ACL_ADDRESS);
        assertEq(LibFhevmProtocol.currentConfig().executor, FHEVM_EXECUTOR_ADDRESS);
        assertEq(LibFhevmProtocol.currentConfig().kmsVerifier, KMS_VERIFIER_ADDRESS);
    }

    /// The plaintext source is RESOLVED: a cleartext executor answers for itself, even though the constructor
    /// created an event processor that could have been named instead. Only a non-cleartext stack reads
    /// the replay.
    function test_aCleartextStackIsItsOwnPlaintextSource() public view {
        assertTrue(address(ForgeFhevmEventProcessor(fhevm.eventProcessor())) != address(0), "the processor exists");
        assertEq(LibFhevmProtocol.currentConfig().plaintexts, FHEVM_EXECUTOR_ADDRESS, "and is not read here");
    }

    /// The cleartext layer is discovered from the executor, not named by a constant — which is what
    /// lets the same code work against a stack deployed anywhere.
    function test_theCleartextLayerIsDiscovered() public view {
        assertTrue(LibFhevmProtocol.currentConfig().isCleartext, "the local stack is a mock");

        assertEq(LibFhevmProtocol.currentConfig().arithmetic, CLEARTEXT_ARITHMETIC_ADDRESS, "walked from the executor");
        assertEq(LibFhevmProtocol.currentConfig().cleartextDb, CLEARTEXT_DB_ADDRESS, "and on to its store");
    }

    /// Pointing the harness elsewhere is a declaration, and a non-cleartext stack resolves no store.
    function test_theStackCanBeRedeclared() public {
        fhevm.setProtocol(makeAddr("acl"), makeAddr("executor"), makeAddr("kms"));

        assertEq(LibFhevmProtocol.currentConfig().executor, makeAddr("executor"));
        assertFalse(LibFhevmProtocol.currentConfig().isCleartext, "an address with no IS_CLEARTEXT");
        assertEq(LibFhevmProtocol.currentConfig().cleartextDb, address(0), "so nothing to discover");
    }
}
