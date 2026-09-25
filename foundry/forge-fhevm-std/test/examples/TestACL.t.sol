// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {euint32, externalEuint32} from "encrypted-types/EncryptedTypes.sol";

import {TestFhevm} from "../../pkg/src/TestFhevm.sol";

import {TestACL} from "./contracts/TestACL.sol";

/// Port of hardhat/v3/e2e/test/internal/TestACL.ts.
///
/// `InvalidSigner` is declared by the stack's InputVerifier, never imported here (golden rule); the
/// selector is computed from the signature the hardhat suite spells out for chai.
contract TestACLTest is TestFhevm {
    bytes4 internal constant INVALID_SIGNER = bytes4(keccak256("InvalidSigner(address)"));

    TestACL internal acl;
    address internal alice;
    uint256 internal aliceKey;
    address internal bob;
    uint256 internal bobKey;

    function setUp() public override {
        super.setUp();
        (alice, aliceKey) = makeAddrAndKey("alice");
        (bob, bobKey) = makeAddrAndKey("bob");
        acl = new TestACL();
    }

    function _encryptOneForAlice(uint32 value) private returns (externalEuint32, bytes memory) {
        return encryptUint32(value, address(acl), alice);
    }

    /// hardhat: 'encrypted count should be uninitialized after deployment'
    function test_countIsUninitializedAfterDeployment() public view {
        assertEq(euint32.unwrap(acl.getCount()), bytes32(0));
    }

    /// hardhat: 'Alice increment the counter by 1 using Alice encrypted input'
    function test_aliceIncrementsWithHerOwnInput() public {
        assertEq(euint32.unwrap(acl.getCount()), bytes32(0));

        (externalEuint32 one, bytes memory proof) = _encryptOneForAlice(1);
        vm.prank(alice);
        acl.increment1(one, proof);

        assertEq(decrypt(acl.getCount(), address(acl), aliceKey), 1);
    }

    /// hardhat: 'Bob cannot increment the counter by 1 using Alice encrypted input'
    function test_bobCannotUseAlicesInput() public {
        assertEq(euint32.unwrap(acl.getCount()), bytes32(0));

        (externalEuint32 one, bytes memory proof) = _encryptOneForAlice(1);

        vm.expectPartialRevert(INVALID_SIGNER);
        vm.prank(bob);
        acl.increment1(one, proof);
    }

    /// hardhat: 'Bob successfully increments the counter by 1 using Alice encrypted input'
    function test_bobIncrementsOnAlicesBehalf() public {
        assertEq(euint32.unwrap(acl.getCount()), bytes32(0));

        (externalEuint32 one, bytes memory proof) = _encryptOneForAlice(1);
        vm.prank(bob);
        acl.increment2(alice, one, proof);

        euint32 count = acl.getCount();
        assertEq(decrypt(count, address(acl), aliceKey), 1);
        assertEq(decrypt(count, address(acl), bobKey), 1);
    }
}
