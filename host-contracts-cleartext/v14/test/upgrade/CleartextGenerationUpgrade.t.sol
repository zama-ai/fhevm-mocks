// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {
    ForgeFhevmDeploy as V13Deploy
} from "@fhevm/host-contracts-cleartext-v13-dev/pkg/forge/src/ForgeFhevmDeploy.sol";

import {LibForgeFhevmUpgrade} from "../../pkg/forge/src/LibForgeFhevmUpgrade.sol";
import {FhevmAddressRole} from "../../pkg/forge/src/_internal/LocalHostBytecode.sol";
import {
    ACL_ADDRESS,
    FHEVM_EXECUTOR_ADDRESS,
    HCU_LIMIT_ADDRESS,
    INPUT_VERIFIER_ADDRESS,
    KMS_GENERATION_ADDRESS,
    KMS_VERIFIER_ADDRESS,
    PAUSER_SET_ADDRESS,
    PROTOCOL_CONFIG_ADDRESS
} from "../../pkg/forge/src/_internal/LocalHostAddresses.sol";
import {LocalHostVersions} from "../../pkg/forge/src/_internal/LocalHostVersions.sol";
import {ICleartextArithmetic} from "../../pkg/forge/src/_internal/interfaces/ICleartextArithmetic.sol";
import {ICleartextDB} from "../../pkg/forge/src/_internal/interfaces/ICleartextDB.sol";
import {ICleartextFHEVMExecutor} from "../../pkg/forge/src/_internal/interfaces/ICleartextFHEVMExecutor.sol";
import {LibCleartextProbe} from "../../pkg/forge/src/shared/LibCleartextProbe.sol";
import {FheType} from "../../pkg/forge/src/shared/LibFheType.sol";

/**
 * A DEPLOYED CLEARTEXT STACK, ONE GENERATION BEHIND, BROUGHT FORWARD — AND ITS VALUES COME WITH IT.
 *
 * THIS IS THE CASE WITH NO UNKNOWN HANDLES, which is what makes it different from every other fork. A
 * production fork is full of handles nothing ever recorded a cleartext for, so a test has to state them
 * (`forkUnknown`) or set a policy. Here the stack HAS been recording all along, into a `CleartextDB` that
 * the upgrade does not touch: re-pointing a proxy changes code, never storage. So a value minted before
 * the upgrade reads back afterwards with nothing said about it.
 *
 * WHY IT IS FUZZED. "The store survived" is a claim about EVERY value in it, and a single handcrafted
 * value would prove almost nothing — a bug that dropped the store, or re-created it, or shifted a slot,
 * would show up on any one value, but a bug that mangled SOME values (a width, a type, a collision)
 * would not. The fuzzer varies the value and the type; the loop varies how many are in flight at once.
 *
 * THE FIXTURE IS THE PREVIOUS GENERATION'S OWN PAYLOAD, imported as the workspace package it is. Both
 * generations compute the same canonical addresses from the same deployer and nonces, so a v13 stack
 * lands exactly where this package's implementations expect one.
 */
contract CleartextGenerationUpgradeTest is Test, V13Deploy {
    ICleartextFHEVMExecutor internal executor;
    ICleartextDB internal db;
    address internal arithmetic;

    function setUp() public {
        deployLocalFhevm(); // the PREVIOUS generation's stack, cleartext, with a store of its own
        executor = ICleartextFHEVMExecutor(FHEVM_EXECUTOR_ADDRESS);
        arithmetic = executor.getCleartextArithmeticAddress();
        db = ICleartextDB(ICleartextArithmetic(arithmetic).getCleartextDBAddress());
    }

    // -- What the upgrade is ------------------------------------------------------------------------

    /// It really was the previous generation, and really is this one afterwards -- still cleartext.
    function test_theGenerationMovesAndTheStackStaysCleartext() public {
        assertTrue(LibCleartextProbe.isCleartext(FHEVM_EXECUTOR_ADDRESS), "starts cleartext");
        assertTrue(
            keccak256(bytes(executor.getVersion())) != keccak256(bytes(LocalHostVersions.FHEVM_EXECUTOR)),
            "and a generation behind"
        );

        _upgrade();

        assertEq(executor.getVersion(), LocalHostVersions.FHEVM_EXECUTOR, "this generation now");
        assertTrue(LibCleartextProbe.isCleartext(FHEVM_EXECUTOR_ADDRESS), "and still cleartext");
    }

    /// THE STORE IS THE SAME CONTRACT, not a replacement: the upgrade finds it, it does not build one.
    function test_theStoreIsTheOneTheStackAlreadyHad() public {
        address before = address(db);

        _upgrade();

        address after_ = ICleartextArithmetic(executor.getCleartextArithmeticAddress()).getCleartextDBAddress();
        assertEq(after_, before, "same store, same address");
    }

    // -- What survives ------------------------------------------------------------------------------

    /**
     * EVERY VALUE COMES THROUGH, for any value of any width. Minted before the upgrade, read after it,
     * with nothing stated in between -- which is the whole claim this cell rests on.
     */
    function testFuzz_aValueMintedBeforeSurvives(uint8 raw8, uint32 raw32, uint64 raw64) public {
        bytes32 h8 = executor.trivialEncrypt(raw8, FheType.Uint8);
        bytes32 h32 = executor.trivialEncrypt(raw32, FheType.Uint32);
        bytes32 h64 = executor.trivialEncrypt(raw64, FheType.Uint64);

        _upgrade();

        assertEq(db.get(h8), raw8, "uint8 survived");
        assertEq(db.get(h32), raw32, "uint32 survived");
        assertEq(db.get(h64), raw64, "uint64 survived");
        assertEq(executor.plaintexts(h32), raw32, "and the stack answers for it, not just the store");
    }

    /// A COMPUTED value survives too, not only trivially encrypted ones -- the operands are gone from
    /// nowhere, so the result must still be there.
    function testFuzz_aComputedValueSurvives(uint32 a, uint32 b) public {
        bytes32 lhs = executor.trivialEncrypt(a, FheType.Uint32);
        bytes32 rhs = executor.trivialEncrypt(b, FheType.Uint32);
        bytes32 sum = executor.fheAdd(lhs, rhs, 0x00);
        uint256 expected = db.get(sum);

        _upgrade();

        assertEq(db.get(sum), expected, "the sum is the sum it was");
        assertEq(db.get(sum), uint256(a) + uint256(b) & type(uint32).max, "and it is still right");
    }

    /**
     * MANY AT ONCE, because a store that survives one value might still lose most of them -- a re-created
     * mapping answers for whatever was written last, and a shifted slot answers for its neighbour.
     */
    function testFuzz_awholeBatchSurvives(uint32 seed) public {
        bytes32[16] memory handles;
        uint256[16] memory values;
        for (uint256 i = 0; i < 16; i++) {
            values[i] = uint32(uint256(keccak256(abi.encodePacked(seed, i))));
            handles[i] = executor.trivialEncrypt(values[i], FheType.Uint32);
        }

        _upgrade();

        for (uint256 i = 0; i < 16; i++) {
            assertEq(db.get(handles[i]), values[i], "every one of them, in place");
        }
    }

    /// AND THE STACK STILL COMPUTES, on top of values from before -- the new arithmetic reads the old
    /// store as its own, which is the part a fresh store would break silently.
    function testFuzz_theUpgradedStackComputesOnOldValues(uint32 before_, uint32 addend) public {
        bytes32 old = executor.trivialEncrypt(before_, FheType.Uint32);

        _upgrade();

        bytes32 fresh = executor.trivialEncrypt(addend, FheType.Uint32);
        bytes32 sum = executor.fheAdd(old, fresh, 0x00);

        assertEq(db.get(sum), (uint256(before_) + uint256(addend)) & type(uint32).max, "old + new");
    }

    /// The operator this generation added works afterwards -- proof the upgrade reached the arithmetic,
    /// whose `reinitializeV3` exists for exactly it.
    function test_theNewOperatorWorksAfterwards() public {
        _upgrade();

        bytes32 factor = executor.trivialEncrypt(10, FheType.Uint32);
        bytes32 product = executor.fheMulDiv(factor, bytes32(uint256(3)), bytes32(uint256(2)), 0x03);

        assertEq(db.get(product), 15, "10 * 3 / 2");
    }

    // -- the upgrade under test ---------------------------------------------------------------------

    function _upgrade() private {
        address[10] memory addresses;
        addresses[uint8(FhevmAddressRole.ACL)] = ACL_ADDRESS;
        addresses[uint8(FhevmAddressRole.FHEVMExecutor)] = FHEVM_EXECUTOR_ADDRESS;
        addresses[uint8(FhevmAddressRole.KMSVerifier)] = KMS_VERIFIER_ADDRESS;
        addresses[uint8(FhevmAddressRole.InputVerifier)] = INPUT_VERIFIER_ADDRESS;
        addresses[uint8(FhevmAddressRole.HCULimit)] = HCU_LIMIT_ADDRESS;
        addresses[uint8(FhevmAddressRole.ProtocolConfig)] = PROTOCOL_CONFIG_ADDRESS;
        addresses[uint8(FhevmAddressRole.KMSGeneration)] = KMS_GENERATION_ADDRESS;
        addresses[uint8(FhevmAddressRole.PauserSet)] = PAUSER_SET_ADDRESS;

        LibForgeFhevmUpgrade.upgradeCleartextFromPreviousGeneration(addresses);
    }
}
