// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";

import {ForgeFhevmDeploy} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {ACL_ADDRESS, FHEVM_EXECUTOR_ADDRESS, KMS_VERIFIER_ADDRESS} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {ICleartextACL, ICleartextFHEVMExecutor} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {LibForgeFhevmEncrypt} from "../../pkg/forge/src/LibForgeFhevmEncrypt.sol";
import {
    HandleContractPair,
    ICleartextKmsVerifierCall,
    LibKmsVerifier,
    SignerSignaturePair,
    UserDecryptRequestV1
} from "../../pkg/forge/src/shared/LibKmsVerifier.sol";
import {FheType} from "../../pkg/forge/src/shared/LibFheType.sol";

/**
 * The smallest dApp that takes two encrypted inputs, adds them and keeps the sum, written against the
 * executor and the ACL directly because the fhevm Solidity library is not a dependency of this package. Each line
 * is what the FHE library does underneath:
 *
 *   FHE.fromExternal(input, proof)  ->  executor.verifyInput(handle, msg.sender, proof, type) + allowTransient
 *   FHE.add(a, b)                   ->  executor.fheAdd(a, b, 0x00)
 *   FHE.allowThis(x) / FHE.allow    ->  ACL.allow(x, address(this)) / ACL.allow(x, user)
 *
 * `msg.sender` matters twice: the input proof is bound to the user who calls this contract, and the
 * result is granted to that same user so they can decrypt it afterwards.
 */
contract AddDapp {
    bytes32 private _sum;

    function submit(bytes32 a, bytes32 b, bytes calldata inputProof) external {
        ICleartextFHEVMExecutor executor = ICleartextFHEVMExecutor(FHEVM_EXECUTOR_ADDRESS);
        bytes32 ea = executor.verifyInput(a, msg.sender, inputProof, FheType.Uint8);
        bytes32 eb = executor.verifyInput(b, msg.sender, inputProof, FheType.Uint8);

        _sum = executor.fheAdd(ea, eb, 0x00);

        ICleartextACL(ACL_ADDRESS).allow(_sum, address(this));
        ICleartextACL(ACL_ADDRESS).allow(_sum, msg.sender);
    }

    function sum() external view returns (bytes32) {
        return _sum;
    }
}

/**
 * The whole round trip a dApp user goes through, end to end against the cleartext stack: encrypt inputs
 * for a contract, have the contract compute on them, then decrypt the result with a signed permit.
 *
 * `LibForgeFhevmEncrypt.t.sol` and `LibForgeFhevmPublicDecrypt.t.sol` each prove one library against
 * the stack. This one proves they compose, with a real contract in the middle, which is the shape every
 * consumer test will have.
 */
contract LibForgeEncryptDecryptTest is Test, ForgeFhevmDeploy {
    uint256 internal constant ALICE_PK = uint256(keccak256("alice"));

    AddDapp internal dapp;
    address internal alice;

    // The client's transport key and the permit's scope, fixed for the whole test. Kept in storage rather
    // than as locals so the helpers below stay well inside solc's stack limit.
    bytes internal publicKey;
    address[] internal contractAddresses;

    function setUp() public {
        deployLocalFhevm();
        dapp = new AddDapp();
        alice = vm.addr(ALICE_PK);
        publicKey = abi.encodePacked(keccak256("transport-key-x"), keccak256("transport-key-y"));
        contractAddresses.push(address(dapp));
    }

    function test_twoUint8InputsAddedByADappDecryptToTheirSum() public {
        // Everything but the dApp call is a client-side step, so it runs unmetered: the test's own gas
        // figure is then `submit` plus the few hundred gas of the cheatcode calls around it.
        vm.pauseGasMetering();

        // 1. Encrypt two uint8 for the dApp, on alice's behalf.
        uint8[] memory typeIds = new uint8[](2);
        uint256[] memory values = new uint256[](2);
        typeIds[0] = uint8(FheType.Uint8);
        values[0] = 3;
        typeIds[1] = uint8(FheType.Uint8);
        values[1] = 4;
        (bytes32[] memory handles, bytes memory proof) =
            LibForgeFhevmEncrypt.encrypt(typeIds, values, address(dapp), alice);

        // 2. Send them to the dApp as alice, since the proof is bound to her. This is the one metered
        //    call: `snapshotGasLastCall` records exactly the gas the `submit` frame consumed, excluding
        //    the CALL itself and the prank, and keeps it in `snapshots/` so a change shows up in a diff.
        vm.prank(alice);
        vm.resumeGasMetering();
        // 390,165 gas
        dapp.submit(handles[0], handles[1], proof);
        vm.pauseGasMetering();
        uint256 submitGas = vm.snapshotGasLastCall("AddDapp", "submit");
        console.log("AddDapp.submit gas:", submitGas);

        // 3. Get the stored result back, and decrypt it as alice.
        bytes32 sumHandle = dapp.sum();
        assertEq(_userDecrypt(sumHandle), 7, "the simplified path must agree");
    }

    // ---------------------------------------------------------------------------------------------
    // User decryption, isolated: everything from the permit to the clear value.
    // ---------------------------------------------------------------------------------------------

    /// @dev The same read, with only what runs on-chain kept: alice's permit is still signed and still
    ///      verified by the KMS verifier, which still walks the ACL for `handle` and checks the dApp is in
    ///      the permit. The public-key mask is undone by hand, one XOR — which is all a client
    ///      does with the payload.
    ///
    ///      Not `view`: the whole read is a client-side step, so it runs with gas metering paused, and
    ///      the pause cheatcodes are not `view`.
    function _userDecrypt(bytes32 handle) internal returns (uint256 cleartext) {
        vm.pauseGasMetering();
        HandleContractPair[] memory pairs = new HandleContractPair[](1);
        pairs[0] = HandleContractPair({handle: handle, contractAddress: address(dapp)});

        (bytes memory payload,,,) = ICleartextKmsVerifierCall(KMS_VERIFIER_ADDRESS)
            .userDecrypt(pairs, alice, publicKey, contractAddresses, block.timestamp, 1, _permitSignature());

        (uint256[] memory masked,) = abi.decode(payload, (uint256[], bytes));
        cleartext = masked[0] ^ uint256(bytes32(publicKey));
        vm.resumeGasMetering();
    }

    /// A permit signed by somebody other than the user is refused.
    ///
    /// @dev Until this existed, DISABLING SIGNATURE VERIFICATION ENTIRELY passed the whole suite — the
    ///      happy path signs correctly, so nothing noticed when the check was gone. A verification step
    ///      is only tested by a request that should fail.
    function test_userDecryptRejectsAPermitSignedBySomeoneElse() public {
        bytes32 handle = _storeSumAsAlice();

        HandleContractPair[] memory pairs = new HandleContractPair[](1);
        pairs[0] = HandleContractPair({handle: handle, contractAddress: address(dapp)});

        // BOB signs the permit; ALICE is named as the user.
        (bytes32 digest,) = LibKmsVerifier.userDecryptDigestV1OnStack(KMS_VERIFIER_ADDRESS, _request());
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(BOB_PK, digest);
        bytes memory wrongSignature = abi.encodePacked(r, s, v);

        vm.expectRevert(LibKmsVerifier.CleartextErrorInvalidUserDecryptSignature.selector);
        ICleartextKmsVerifierCall(KMS_VERIFIER_ADDRESS)
            .userDecrypt(pairs, alice, publicKey, contractAddresses, block.timestamp, 1, wrongSignature);
    }

    /// @dev The permit every call here uses. Built once so the digest that gets signed and the request
    ///      that gets sent can never drift apart.
    function _request() private view returns (UserDecryptRequestV1 memory) {
        return UserDecryptRequestV1({
            transportPublicKey: publicKey,
            contractAddresses: contractAddresses,
            startTimestamp: block.timestamp,
            durationDays: 1
        });
    }

    /// @dev Alice's signature over the permit digest, 65 bytes `r || s || v` as the verifier decodes it.
    function _permitSignature() private view returns (bytes memory) {
        (bytes32 digest,) = LibKmsVerifier.userDecryptDigestV1OnStack(KMS_VERIFIER_ADDRESS, _request());
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ALICE_PK, digest);
        return abi.encodePacked(r, s, v);
    }

    // ---------------------------------------------------------------------------------------------
    // Delegated user decryption: BOB signs the permit, ALICE's access is what is exercised.
    // ---------------------------------------------------------------------------------------------

    uint256 private constant BOB_PK = 0xB0B;

    /// @dev The same 3 + 4 the main test stores, without the gas bookkeeping. Returns the sum handle.
    function _storeSumAsAlice() private returns (bytes32) {
        uint8[] memory typeIds = new uint8[](2);
        uint256[] memory values = new uint256[](2);
        typeIds[0] = uint8(FheType.Uint8);
        values[0] = 3;
        typeIds[1] = uint8(FheType.Uint8);
        values[1] = 4;
        (bytes32[] memory handles, bytes memory proof) =
            LibForgeFhevmEncrypt.encrypt(typeIds, values, address(dapp), alice);

        vm.prank(alice);
        dapp.submit(handles[0], handles[1], proof);
        return dapp.sum();
    }

    /// Alice delegates her read of the dApp to bob, and bob reads her value with his own permit.
    function test_aDelegateReadsTheDelegatorsValue() public {
        bytes32 sumHandle = _storeSumAsAlice();
        address bob = vm.addr(BOB_PK);

        vm.prank(alice);
        ICleartextACL(ACL_ADDRESS).delegateForUserDecryption(bob, address(dapp), uint64(block.timestamp + 1 days));

        assertEq(_delegatedUserDecrypt(sumHandle, bob), 7, "bob must read alice's sum");
    }

    /// Without the delegation the same request is refused: signing a permit is not authorisation.
    function test_withoutADelegationTheDelegateIsRefused() public {
        bytes32 sumHandle = _storeSumAsAlice();
        address bob = vm.addr(BOB_PK);

        vm.expectRevert();
        this.delegatedUserDecrypt(sumHandle, bob);
    }

    /// External so that `vm.expectRevert` has a call frame to catch.
    function delegatedUserDecrypt(bytes32 handle, address delegate) external view returns (uint256) {
        return _delegatedUserDecrypt(handle, delegate);
    }

    function _delegatedUserDecrypt(bytes32 handle, address delegate) private view returns (uint256) {
        HandleContractPair[] memory pairs = new HandleContractPair[](1);
        pairs[0] = HandleContractPair({handle: handle, contractAddress: address(dapp)});

        (bytes memory payload,,,) = LibKmsVerifier.delegatedUserDecryptV1OnForkStack(
            KMS_VERIFIER_ADDRESS,
            ACL_ADDRESS,
            FHEVM_EXECUTOR_ADDRESS,
            pairs,
            _request(),
            alice,
            SignerSignaturePair(delegate, _delegatedPermitSignature())
        );

        (uint256[] memory masked,) = abi.decode(payload, (uint256[], bytes));
        return masked[0] ^ uint256(bytes32(publicKey));
    }

    /// @dev The DELEGATE signs, over the digest carrying the delegator's address.
    function _delegatedPermitSignature() private view returns (bytes memory) {
        (bytes32 digest,) = LibKmsVerifier.delegatedUserDecryptDigestV1OnStack(KMS_VERIFIER_ADDRESS, _request(), alice);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(BOB_PK, digest);
        return abi.encodePacked(r, s, v);
    }
}
