// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {euint64, externalEuint64} from "encrypted-types/EncryptedTypes.sol";

import {TestFhevm} from "../../../pkg/src/TestFhevm.sol";

import {IConfidentialERC20} from "../ERC20/IConfidentialERC20.sol";
import {FHEErrors} from "../utils/FHEErrors.sol";
import {TestConfidentialERC20Mintable} from "../TestConfidentialERC20Mintable.sol";

/**
 * `ConfidentialERC20`, ported case for case from the hardhat v3 suite:
 *   hardhat/v3/e2e/test/confidentialERC20/ConfidentialERC20.test.ts
 *
 * The point is to put `forge-fhevm-std` through a real confidential token rather than a purpose-built
 * fixture — every encrypt, every user decryption and every ACL refusal in that suite, driven from
 * Solidity instead of TypeScript.
 *
 * How the two suites line up:
 *
 *   fhevm.helpers.encryptUint64({value, contractAddress, userAddress})  ->  encryptUint64(...)
 *   userDecryptBalance(account, token, addr)                           ->  decrypt(value, addr, key)
 *   expectRejectedWith(decryptValuesFromPairs(...), /not authorized/)  ->  vm.expectRevert()
 *   expect(tx).to.emit(...).withArgs(...)                              ->  vm.expectEmit
 *   revertedWithCustomError(c, 'X')                                    ->  vm.expectRevert(X.selector)
 */
contract ConfidentialERC20Test is TestFhevm {
    /// @dev The transfer id the implementation emits when it has no error handling: type(uint256).max.
    uint256 internal constant PLACEHOLDER = type(uint256).max;

    TestConfidentialERC20Mintable internal token;
    address internal tokenAddress;

    address internal alice;
    uint256 internal aliceKey;
    address internal bob;
    uint256 internal bobKey;
    address internal carol;
    uint256 internal carolKey;

    function setUp() public override {
        super.setUp();

        (alice, aliceKey) = makeAddrAndKey("alice");
        (bob, bobKey) = makeAddrAndKey("bob");
        (carol, carolKey) = makeAddrAndKey("carol");

        vm.prank(alice);
        token = new TestConfidentialERC20Mintable("Naraggara", "NARA", alice);
        tokenAddress = address(token);
    }

    // -- Helpers, mirroring ConfidentialERC20.fixture.ts -----------------------

    function _encrypt64(address user, uint64 value) private returns (externalEuint64 handle, bytes memory proof) {
        return encryptUint64(value, tokenAddress, user);
    }

    function _balanceOf(address account, uint256 accountKey) private returns (uint64) {
        return decrypt(token.balanceOf(account), tokenAddress, accountKey);
    }

    function _allowance(address owner, uint256 ownerKey, address spender) private returns (uint64) {
        return decrypt(token.allowance(owner, spender), tokenAddress, ownerKey);
    }

    // -- The ported cases ------------------------------------------------------

    /// hardhat: 'post-deployment state'
    function test_postDeploymentState() public view {
        assertEq(token.totalSupply(), 0);
        assertEq(token.name(), "Naraggara");
        assertEq(token.symbol(), "NARA");
        assertEq(token.decimals(), 6);
    }

    /// hardhat: 'should mint the contract'
    function test_shouldMintTheContract() public {
        uint64 mintAmount = 1000;

        vm.prank(alice);
        token.mint(alice, mintAmount);

        assertEq(_balanceOf(alice, aliceKey), mintAmount);
        assertEq(token.totalSupply(), mintAmount);
    }

    /// hardhat: 'should transfer tokens between two users'
    function test_shouldTransferTokensBetweenTwoUsers() public {
        uint64 mintAmount = 10_000;
        uint64 transferAmount = 1337;

        vm.prank(alice);
        token.mint(alice, mintAmount);
        assertEq(_balanceOf(alice, aliceKey), mintAmount);

        (externalEuint64 handle, bytes memory proof) = _encrypt64(alice, transferAmount);

        vm.expectEmit(true, true, false, true, tokenAddress);
        emit IConfidentialERC20.Transfer(alice, bob, PLACEHOLDER);

        vm.prank(alice);
        token.transfer(bob, handle, proof);

        assertEq(_balanceOf(alice, aliceKey), mintAmount - transferAmount);
        assertEq(_balanceOf(bob, bobKey), transferAmount);
    }

    /// hardhat: 'should not transfer tokens between two users if transfer amount is higher than balance'
    /// @dev There is no error handling in this version, so the transfer is a no-op that still emits.
    function test_shouldNotTransferMoreThanTheBalance() public {
        uint64 mintAmount = 1000;
        uint64 transferAmount = 1337;

        vm.prank(alice);
        token.mint(alice, mintAmount);

        (externalEuint64 handle, bytes memory proof) = _encrypt64(alice, transferAmount);

        vm.expectEmit(true, true, false, true, tokenAddress);
        emit IConfidentialERC20.Transfer(alice, bob, PLACEHOLDER);

        vm.prank(alice);
        token.transfer(bob, handle, proof);

        assertEq(_balanceOf(alice, aliceKey), mintAmount, "no tokens left alice");
        assertEq(_balanceOf(bob, bobKey), 0, "no tokens reached bob");
    }

    /// hardhat: 'should be able to transferFrom only if allowance is sufficient'
    function test_transferFromOnlyIfAllowanceIsSufficient() public {
        uint64 mintAmount = 10_000;
        uint64 transferAmount = 1337;

        vm.prank(alice);
        token.mint(alice, mintAmount);

        (externalEuint64 allowanceHandle, bytes memory allowanceProof) = _encrypt64(alice, transferAmount);

        vm.expectEmit(true, true, false, true, tokenAddress);
        emit IConfidentialERC20.Approval(alice, bob, PLACEHOLDER);

        vm.prank(alice);
        token.approve(bob, allowanceHandle, allowanceProof);

        assertEq(_allowance(alice, aliceKey, bob), transferAmount, "allowance equals the transfer amount");

        // Above the allowance, so nothing moves.
        (externalEuint64 tooMuch, bytes memory tooMuchProof) = _encrypt64(bob, transferAmount + 1);

        vm.expectEmit(true, true, false, true, tokenAddress);
        emit IConfidentialERC20.Transfer(alice, bob, PLACEHOLDER);

        vm.prank(bob);
        token.transferFrom(alice, bob, tooMuch, tooMuchProof);

        assertEq(_balanceOf(alice, aliceKey), mintAmount, "transfer did not happen");
        assertEq(_balanceOf(bob, bobKey), 0, "transfer did not happen");

        // Within the allowance, so it moves.
        (externalEuint64 justRight, bytes memory justRightProof) = _encrypt64(bob, transferAmount);

        vm.prank(bob);
        token.transferFrom(alice, bob, justRight, justRightProof);

        assertEq(_balanceOf(alice, aliceKey), mintAmount - transferAmount, "transfer happened");
        assertEq(_balanceOf(bob, bobKey), transferAmount, "transfer happened");
        assertEq(_allowance(alice, aliceKey, bob), 0, "allowance is spent");
    }

    /// hardhat: 'should not be able to read the allowance if not spender/owner after initialization'
    function test_onlyOwnerOrSpenderCanReadTheAllowance() public {
        uint64 amount = 10_000;

        (externalEuint64 handle, bytes memory proof) = _encrypt64(alice, amount);
        vm.prank(alice);
        token.approve(bob, handle, proof);

        euint64 allowanceHandle = token.allowance(alice, bob);

        // carol is neither owner nor spender.
        vm.expectRevert();
        this.decryptAs(allowanceHandle, carolKey);
    }

    /// hardhat: 'should not be able to read the balance if not user after initialization'
    function test_onlyTheUserCanReadTheirBalance() public {
        vm.prank(alice);
        token.mint(alice, 10_000);

        euint64 balanceHandle = token.balanceOf(alice);

        vm.expectRevert();
        this.decryptAs(balanceHandle, bobKey);
    }

    /// hardhat: 'receiver cannot be null address'
    function test_receiverCannotBeTheNullAddress() public {
        vm.prank(alice);
        token.mint(alice, 100_000);

        (externalEuint64 handle, bytes memory proof) = _encrypt64(alice, 50_000);

        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InvalidReceiver.selector, address(0)));
        vm.prank(alice);
        token.transfer(address(0), handle, proof);
    }

    /// hardhat: 'sender who is not allowed cannot transfer using a handle from another account'
    function test_aSenderCannotTransferAnotherAccountsHandle() public {
        vm.prank(alice);
        token.mint(alice, 100_000);

        (externalEuint64 handle, bytes memory proof) = _encrypt64(alice, 50_000);
        vm.prank(alice);
        token.transfer(carol, handle, proof);

        euint64 aliceBalance = token.balanceOf(alice);

        vm.expectRevert(FHEErrors.FHESenderNotAllowed.selector);
        vm.prank(bob);
        token.transfer(carol, aliceBalance);
    }

    /// hardhat: 'sender who is not allowed cannot transferFrom using a handle from another account'
    function test_aSenderCannotTransferFromAnotherAccountsHandle() public {
        uint64 mintAmount = 100_000;

        vm.prank(alice);
        token.mint(alice, mintAmount);

        (externalEuint64 allowanceHandle, bytes memory allowanceProof) = _encrypt64(alice, mintAmount);
        vm.prank(alice);
        token.approve(carol, allowanceHandle, allowanceProof);

        (externalEuint64 transferHandle, bytes memory transferProof) = _encrypt64(carol, 50_000);
        vm.prank(carol);
        token.transferFrom(alice, carol, transferHandle, transferProof);

        euint64 aliceAllowance = token.allowance(alice, carol);

        vm.expectRevert(FHEErrors.FHESenderNotAllowed.selector);
        vm.prank(bob);
        token.transferFrom(alice, bob, aliceAllowance);
    }

    /// hardhat: 'sender who is not allowed cannot approve using a handle from another account'
    function test_aSenderCannotApproveWithAnotherAccountsHandle() public {
        (externalEuint64 handle, bytes memory proof) = _encrypt64(alice, 100_000);
        vm.prank(alice);
        token.approve(carol, handle, proof);

        euint64 aliceAllowance = token.allowance(alice, carol);

        vm.expectRevert(FHEErrors.FHESenderNotAllowed.selector);
        vm.prank(bob);
        token.approve(carol, aliceAllowance);
    }

    /// hardhat: 'ConfidentialERC20Mintable - only owner can mint'
    function test_onlyTheOwnerCanMint() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, bob));
        vm.prank(bob);
        token.mint(bob, 1);
    }

    /// External so that `vm.expectRevert` has a call frame to catch.
    function decryptAs(euint64 value, uint256 privateKey) external returns (uint64) {
        return decrypt(value, tokenAddress, privateKey);
    }
}
