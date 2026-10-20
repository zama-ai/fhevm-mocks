// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {ForgeFhevmDeploy} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {
    ACL_ADDRESS,
    CLEARTEXT_ARITHMETIC_ADDRESS,
    FHEVM_EXECUTOR_ADDRESS,
    HCU_LIMIT_ADDRESS
} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {ICleartextFHEVMExecutor} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {IACL} from "../../pkg/forge/src/_internal/interfaces/IACL.sol";
import {FheType as PayloadFheType} from "../../pkg/forge/src/shared/LibFheType.sol";
import {FheType} from "../../pkg/src/cleartext/shared/LibFheType.sol";
import {CleartextForgeArithmetic} from "../../pkg/src/cleartext/CleartextForgeArithmetic.sol";
import {CleartextForgeHCULimit} from "../../pkg/src/cleartext/CleartextForgeHCULimit.sol";

/// @dev The metering entry point the executor calls. Taken directly rather than through the generated
///      interface so the test can make the call the executor would.
interface IHCUMeterEntry {
    function checkHCUForTrivialEncrypt(FheType resultType, bytes32 result, address caller) external;
}

/**
 * A MISSED COMPUTATION IS NOT AN UNKNOWN HANDLE, and this stack must not confuse them.
 *
 * Both look identical to the store: a handle with no cleartext. Their causes are opposite. An unknown
 * handle was minted before the cleartext layer existed -- ordinary on a fork, and exactly what the
 * per-type policy is for. A missed computation is a handle THIS stack minted while the cleartext layer
 * failed to record it, which happens when upstream adds an operator the mirror does not override:
 * `super` runs, a handle is produced, nothing records it, and nothing fails to compile.
 *
 * WITHOUT THE DISTINCTION the second case is the more dangerous, because the policy HIDES it. Set
 * `FromHandle` for a type and a missing implementation returns `keccak(handle)` -- a well-formed number,
 * different every time, that a test will happily assert against. The HCU limit is what separates them:
 * every handle the executor computes is metered, so a reading there means this stack produced it.
 *
 * HOW THE BUG IS FABRICATED HERE. No unmirrored operator exists in this package -- by construction, and
 * `FhevmOperatorsEnum.t.sol` guards the list -- so the test produces the STATE one would leave behind:
 * it calls the HCU limit as the executor, metering a handle nobody ever recorded. That is precisely what
 * a missing `record*` leaves, without pretending to be a broken executor.
 */
contract CleartextForgeArithmeticUnrecordedResultTest is Test, ForgeFhevmDeploy {
    CleartextForgeArithmetic internal arithmetic;
    CleartextForgeHCULimit internal hcuLimit;
    address internal owner;

    uint256 private constant METADATA_MASK = (uint256(1) << 88) - 1;

    function setUp() public {
        deployLocalFhevm();
        arithmetic = CleartextForgeArithmetic(CLEARTEXT_ARITHMETIC_ADDRESS);
        hcuLimit = CleartextForgeHCULimit(HCU_LIMIT_ADDRESS);
        owner = IACL(ACL_ADDRESS).owner();
    }

    /// THE HEADLINE. A metered handle with no cleartext is refused BY ITS OWN NAME, not answered.
    function test_aMeteredHandleWithNoCleartextIsRefused() public {
        bytes32 handle = _meterWithoutRecording(FheType.Uint32, 1);

        vm.expectRevert(
            abi.encodeWithSelector(
                CleartextForgeArithmetic.CleartextErrorUnrecordedResult.selector, handle, FheType.Uint32
            )
        );
        arithmetic.plaintexts(handle);
    }

    /// AND NO POLICY COVERS IT. This is the whole reason the check runs before the policy does.
    function test_aFixedDefaultDoesNotHideIt() public {
        bytes32 handle = _meterWithoutRecording(FheType.Uint32, 2);

        vm.prank(owner);
        arithmetic.setUnknownHandleDefault(FheType.Uint32, 1000);

        vm.expectRevert(
            abi.encodeWithSelector(
                CleartextForgeArithmetic.CleartextErrorUnrecordedResult.selector, handle, FheType.Uint32
            )
        );
        arithmetic.plaintexts(handle);
    }

    /// The derivation hides it best of all -- a different plausible number every time -- so it is pinned too.
    function test_theDerivationDoesNotHideItEither() public {
        bytes32 handle = _meterWithoutRecording(FheType.Uint32, 3);

        vm.prank(owner);
        arithmetic.setUnknownHandleFromHandle(FheType.Uint32);

        vm.expectRevert(
            abi.encodeWithSelector(
                CleartextForgeArithmetic.CleartextErrorUnrecordedResult.selector, handle, FheType.Uint32
            )
        );
        arithmetic.plaintexts(handle);
    }

    /// THE OTHER SIDE OF THE LINE. A handle this stack never minted still takes the policy, as before.
    function test_anUnmeteredHandleStillTakesThePolicy() public {
        bytes32 foreign = _wellFormedHandle(FheType.Uint32, 4);
        assertFalse(hcuLimit.wasMintedHere(foreign), "this stack never minted it");

        vm.prank(owner);
        arithmetic.setUnknownHandleDefault(FheType.Uint32, 1000);

        assertEq(arithmetic.plaintexts(foreign), 1000, "answered from the policy, not refused");
    }

    /// And with no policy it is the unknown-handle refusal -- a different error, naming a different cause.
    function test_anUnmeteredHandleWithNoPolicyIsTheOtherError() public {
        bytes32 foreign = _wellFormedHandle(FheType.Uint32, 5);

        vm.expectRevert(
            abi.encodeWithSelector(
                CleartextForgeArithmetic.CleartextErrorUnknownHandle.selector, foreign, FheType.Uint32
            )
        );
        arithmetic.plaintexts(foreign);
    }

    /// An ordinary computed handle is unaffected: it is metered AND recorded, so nothing here applies.
    function test_aProperlyRecordedHandleIsUntouched() public {
        bytes32 handle = ICleartextFHEVMExecutor(FHEVM_EXECUTOR_ADDRESS).trivialEncrypt(7, PayloadFheType.Uint32);

        assertTrue(hcuLimit.wasMintedHere(handle), "metered");
        assertEq(arithmetic.plaintexts(handle), 7, "and recorded, so it simply answers");
    }

    // -- helpers ---------------------------------------------------------------------------------

    /// @dev The state a missing `record*` leaves: metered by the executor, absent from the store.
    function _meterWithoutRecording(FheType fheType, uint8 salt) private returns (bytes32 handle) {
        handle = _wellFormedHandle(fheType, salt);
        vm.prank(FHEVM_EXECUTOR_ADDRESS);
        IHCUMeterEntry(HCU_LIMIT_ADDRESS).checkHCUForTrivialEncrypt(fheType, handle, address(this));
        assertTrue(hcuLimit.wasMintedHere(handle), "the fabrication worked: this stack claims it");
    }

    /// @dev A handle of `fheType` this chain would accept -- real metadata, fresh entropy above it.
    function _wellFormedHandle(FheType fheType, uint8 salt) private returns (bytes32) {
        bytes32 minted =
            ICleartextFHEVMExecutor(FHEVM_EXECUTOR_ADDRESS).trivialEncrypt(0, PayloadFheType(uint8(fheType)));
        uint256 metadata = uint256(minted) & METADATA_MASK;
        uint256 entropy = uint256(keccak256(abi.encodePacked("unrecorded", fheType, salt))) & ~METADATA_MASK;
        return bytes32(entropy | metadata);
    }
}
