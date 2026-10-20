// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {euint32, externalEuint32} from "encrypted-types/EncryptedTypes.sol";

import {TestFhevm} from "../../pkg/src/TestFhevm.sol";
import {FHECounterPublicDecrypt} from "../examples/contracts/FHECounterPublicDecrypt.sol";
import {FHECounterUserDecrypt} from "../examples/contracts/FHECounterUserDecrypt.sol";

/**
 * @notice The SDK stand-in must not land in a test's gas figure.
 *
 * @dev Every public entry of `StdFhevmEncrypt`, `StdFhevmDecrypt` and `StdFhevmDecryptPublic` carries
 *      `ForgeVmBase.unmetered`, and nothing below them touches metering. What a test measures is its
 *      dApp's call and nothing else.
 */
contract UnmeteredApiTest is TestFhevm {
    FHECounterPublicDecrypt internal counter;
    /// @dev A user decryption needs a dApp that GRANTS the caller; the public-decrypt counter only
    ///      calls `allowThis`, so asking it to be read by alice is refused by the ACL, rightly.
    FHECounterUserDecrypt internal userCounter;
    address internal alice;

    /// @dev Generous: the point is orders of magnitude, not a pinned number. A metered encrypt or
    ///      decrypt costs hundreds of thousands.
    uint256 private constant NEGLIGIBLE = 20_000;

    function setUp() public override {
        super.setUp();
        counter = new FHECounterPublicDecrypt();
        userCounter = new FHECounterUserDecrypt();
        alice = makeAddr("alice");
    }

    function test_encryptIsNotChargedToTheTest() public {
        uint256 before = gasleft();
        encryptUint32(7, address(counter), alice);
        assertLt(before - gasleft(), NEGLIGIBLE, "encrypt was metered");
    }

    function test_userDecryptIsNotChargedToTheTest() public {
        (externalEuint32 v, bytes memory proof) = encryptUint32(7, address(userCounter), alice);
        vm.prank(alice);
        userCounter.increment(v, proof);
        euint32 count = userCounter.getCount();

        uint256 before = gasleft();
        uint32 clear = decrypt(count, address(userCounter), "alice");
        uint256 used = before - gasleft();

        assertEq(clear, 7, "and it still decrypts");
        assertLt(used, NEGLIGIBLE, "user decrypt was metered");
    }

    function test_publicDecryptIsNotChargedToTheTest() public {
        (externalEuint32 v, bytes memory proof) = encryptUint32(7, address(counter), alice);
        vm.prank(alice);
        counter.increment(v, proof);
        euint32 count = counter.getCount();

        uint256 before = gasleft();
        uint32 clear = decryptPublic(count);
        uint256 used = before - gasleft();

        assertEq(clear, 7);
        assertLt(used, NEGLIGIBLE, "public decrypt was metered");
    }

    /// The dApp's own call IS still measured — pausing must not swallow what the test is there for.
    function test_theDappsOwnCallIsStillMeasured() public {
        (externalEuint32 v, bytes memory proof) = encryptUint32(7, address(counter), alice);

        vm.prank(alice);
        uint256 before = gasleft();
        counter.increment(v, proof);
        assertGt(before - gasleft(), NEGLIGIBLE, "the dApp call must still cost");
    }

    // -- The counter is one, and nested scopes do not resume early -------------------------------------

    mapping(uint256 => uint256) private _sink;

    /// A nested `unmetered` scope — the shape every entry point has, since they call each other — must
    /// leave the OUTER scope paused when it exits. The work after the inner scope is 20 cold `SSTORE`s
    /// to 20 DISTINCT slots (a single slot would be warm and dirty after the first write, 100 gas each,
    /// and prove nothing): ~440k gas if metered; it must cost the test nothing.
    function test_aNestedScopeDoesNotResumeMeteringInTheOuterOne() public {
        uint256 before = gasleft();
        _outerScope();
        assertLt(before - gasleft(), NEGLIGIBLE, "the outer scope was resumed by the inner exit");
    }

    function _outerScope() private unmetered {
        _innerScope();
        for (uint256 i = 1; i <= 20; i++) {
            _sink[i] = i; // after the inner scope closed: still inside the outer one
        }
    }

    function _innerScope() private unmetered {
        _sink[0] = 1;
    }
}
