// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Vm} from "forge-std/Vm.sol";
import {euint64, externalEuint64} from "encrypted-types/EncryptedTypes.sol";
import {ZamaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

import {TestFhevm} from "../../pkg/src/TestFhevm.sol";

import {SimpleMultiSig} from "./contracts/SimpleMultiSig.sol";
import {MultiSigHelper} from "./contracts/MultiSigHelper.sol";
import {EncryptedSetter} from "./contracts/EncryptedSetter.sol";

/// The ACL, reached the way the hardhat test reaches it: by address, with a hand-written interface.
/// The address comes from the fhevm-solidity package config rather than from a deployment artifact.
interface IACL {
    function allow(bytes32 handle, address account) external;
    function multicall(bytes[] calldata data) external;
}

/// Port of fhevm4/library-solidity/test/multiSig/MultiSig.ts.
///
///   instance.createEncryptedInput(c, u) + input.add64(v)  -> encryptUint64(v, c, u)
///   userDecryptSingleHandle(h, c, instance, signer, ...)  -> decrypt(h, c, walletLabel)
///   instance.generateKeypair()                            -> handled inside decrypt(...)
///   signers.bob / contract.connect(signers.bob)           -> vm.createWallet("bob") + vm.prank
///   dotenv .env.host ACL_CONTRACT_ADDRESS                 -> ZamaConfig.getEthereumCoprocessorConfig()
///
/// The point of the suite is the handle changing hands: an input minted for the helper is made
/// readable by the multisig and its owners, then handed to a third contract WITHOUT a proof, on the
/// strength of the ACL alone.
contract MultiSigTest is TestFhevm {
    SimpleMultiSig internal multiSig;
    MultiSigHelper internal helper;
    EncryptedSetter internal setter;

    Vm.Wallet internal alice;
    Vm.Wallet internal bob;
    Vm.Wallet internal carol;
    address internal acl;

    uint64 internal constant CLEAR_VALUE = 133_799;

    function setUp() public override {
        super.setUp();

        alice = vm.createWallet("alice");
        bob = vm.createWallet("bob");
        carol = vm.createWallet("carol");

        address[] memory owners = new address[](3);
        owners[0] = alice.addr;
        owners[1] = bob.addr;
        owners[2] = carol.addr;

        multiSig = new SimpleMultiSig(owners);
        helper = new MultiSigHelper(address(multiSig));
        setter = new EncryptedSetter();
        acl = ZamaConfig.getEthereumCoprocessorConfig().ACLAddress;
    }

    /// hardhat: 'should deploy SimpleMultiSig contract'
    function test_deploySimpleMultiSig() public view {
        address[] memory owners = multiSig.getOwners();

        assertEq(owners.length, 3);
        assertEq(owners[0], alice.addr);
        assertEq(owners[1], bob.addr);
        assertEq(owners[2], carol.addr);
    }

    /// hardhat: 'should use helper to make input readable by owners, then allow setter, then use handle
    ///           in setter via multisig, then allow result to owners to make it readable by owners'
    function test_handleTravelsFromHelperToSetterViaTheMultiSig() public {
        (externalEuint64 input, bytes memory proof) = encryptUint64(CLEAR_VALUE, address(helper), alice.addr);
        vm.prank(alice.addr);
        helper.allowForMultiSig(input, proof);

        // The helper allowed the multisig AND every owner, so all three can read the input.
        bytes32 handle = externalEuint64.unwrap(input);
        _assertAllOwnersRead(handle, address(multiSig), CLEAR_VALUE);

        // Any one allowed owner can pass it on to the setter; going through a proposal would also work.
        vm.prank(alice.addr);
        IACL(acl).allow(handle, address(setter));

        // The multisig can now hand the handle over with an EMPTY proof: it is already verified and
        // allowed, which is the whole point of the pattern.
        _runTx(
            1, address(setter), abi.encodeCall(EncryptedSetter.setEncryptedValue, (externalEuint64.wrap(handle), hex""))
        );

        // The result is readable only by the setter's caller, so the multisig allows the owners too.
        bytes32 result = euint64.unwrap(setter.encryptedResult());
        _runTx(2, acl, _allowAllOwners(result));

        _assertAllOwnersRead(result, address(setter), CLEAR_VALUE + 42);
    }

    /// hardhat: 'should be able to use an uninitialized handle in the setter'
    function test_anUninitializedHandleCanBeUsedInTheSetter() public {
        EncryptedSetter setter2 = new EncryptedSetter();
        multiSig.executeSpecialTx(address(setter2));

        bytes32 result = euint64.unwrap(setter2.encryptedResult());
        _runTx(1, acl, _allowAllOwners(result));

        // 42, because the setter adds 42 to the uninitialized input, which reads as 0.
        _assertAllOwnersRead(result, address(setter2), 42);
    }

    // -- Helpers -------------------------------------------------------------------

    /// Alice proposes (and so approves), bob and carol approve, then anyone executes.
    function _runTx(uint256 txId, address target, bytes memory data) private {
        vm.prank(alice.addr);
        multiSig.proposeTx(target, data);
        vm.prank(bob.addr);
        multiSig.approveTx(txId);
        vm.prank(carol.addr);
        multiSig.approveTx(txId);

        multiSig.executeTx(txId);
    }

    /// One ACL `multicall` granting `handle` to each of the three owners.
    function _allowAllOwners(bytes32 handle) private view returns (bytes memory) {
        bytes[] memory calls = new bytes[](3);
        calls[0] = abi.encodeCall(IACL.allow, (handle, alice.addr));
        calls[1] = abi.encodeCall(IACL.allow, (handle, bob.addr));
        calls[2] = abi.encodeCall(IACL.allow, (handle, carol.addr));
        return abi.encodeCall(IACL.multicall, (calls));
    }

    function _assertAllOwnersRead(bytes32 handle, address contractAddress, uint64 expected) private {
        euint64 value = euint64.wrap(handle);

        assertEq(decrypt(value, contractAddress, "alice"), expected, "alice");
        assertEq(decrypt(value, contractAddress, "bob"), expected, "bob");
        assertEq(decrypt(value, contractAddress, "carol"), expected, "carol");
    }
}
