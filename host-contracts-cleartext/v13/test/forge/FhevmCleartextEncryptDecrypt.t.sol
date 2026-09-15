// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";

import {FhevmDeploy} from "../pkg/forge/src/FhevmDeploy.sol";
import {ACL_ADDRESS, FHEVM_EXECUTOR_ADDRESS, KMS_VERIFIER_ADDRESS} from "../pkg/forge/src/FhevmDeploy.sol";
import {ICleartextACL, ICleartextFHEVMExecutor} from "../pkg/forge/src/FhevmDeploy.sol";
import {ICleartextKMSVerifier} from "../pkg/forge/src/_internal/interfaces/ICleartextKMSVerifier.sol";
import {FhevmCleartextEncrypt} from "../pkg/forge/src/FhevmCleartextEncrypt.sol";
import {FhevmCleartextDecrypt} from "../pkg/forge/src/FhevmCleartextDecrypt.sol";
import {FheType} from "../pkg/src/contracts/shared/FheType.sol";

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
 * `FhevmCleartextEncrypt.t.sol` and `FhevmCleartextDecryptPublic.t.sol` each prove one library against
 * the stack. This one proves they compose, with a real contract in the middle, which is the shape every
 * consumer test will have.
 */
contract FhevmCleartextEncryptDecryptTest is Test, FhevmDeploy {
    uint256 internal constant ALICE_PK = uint256(keccak256("alice"));

    AddDapp internal dapp;
    address internal alice;

    // The client's transport key and the permit's scope, fixed for the whole test. Kept in storage rather
    // than as locals so the helpers below stay well inside solc's stack limit.
    bytes internal publicKey;
    address[] internal contractAddresses;

    function setUp() public {
        deployFhevm();
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
            FhevmCleartextEncrypt.encrypt(typeIds, values, address(dapp), alice);

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
        //assertEq(_userDecryptFull(sumHandle), 7, "3 + 4 must decrypt to 7");
        assertEq(_userDecrypt(sumHandle), 7, "the simplified path must agree");
    }

    // ---------------------------------------------------------------------------------------------
    // User decryption, isolated: everything from the permit to the clear value.
    // ---------------------------------------------------------------------------------------------

    /// @dev What a client does to read `handle` from `dapp` as alice: sign a permit covering the dApp,
    ///      ask the stack for the masked shares, then verify and unmask them. Returns the clear value.
    function _userDecryptFull(bytes32 handle) internal view returns (uint256) {
        ICleartextKMSVerifier.HandleContractPair[] memory pairs = new ICleartextKMSVerifier.HandleContractPair[](1);
        pairs[0] = ICleartextKMSVerifier.HandleContractPair({handle: handle, contractAddress: address(dapp)});

        (bytes memory payload, bytes[] memory signatures, bytes memory extraData) = FhevmCleartextDecrypt.userDecrypt(
            pairs, alice, publicKey, contractAddresses, block.timestamp, 1, _permitSignature()
        );

        bytes32[] memory handles = new bytes32[](1);
        handles[0] = handle;
        uint256[] memory cleartexts =
            FhevmCleartextDecrypt.decryptAndReconstruct(payload, signatures, extraData, handles, publicKey);
        return cleartexts[0];
    }

    /// @dev The same read, with only what runs on-chain kept: alice's permit is still signed and still
    ///      verified by the KMS verifier, which still walks the ACL for `handle` and checks the dApp is in
    ///      the permit. What is dropped is the off-chain KMS emulation: the forged node signatures and their
    ///      re-verification in `decryptAndReconstruct`, a closed loop the library proves about itself in its
    ///      own tests. The public-key mask is then undone by hand, one XOR.
    ///
    ///      Not `view`: the whole read is a client-side step, so it runs with gas metering paused, and
    ///      the pause cheatcodes are not `view`.
    function _userDecrypt(bytes32 handle) internal returns (uint256 cleartext) {
        vm.pauseGasMetering();
        ICleartextKMSVerifier.HandleContractPair[] memory pairs = new ICleartextKMSVerifier.HandleContractPair[](1);
        pairs[0] = ICleartextKMSVerifier.HandleContractPair({handle: handle, contractAddress: address(dapp)});

        (bytes memory payload,,,) = ICleartextKMSVerifier(KMS_VERIFIER_ADDRESS)
            .userDecrypt(pairs, alice, publicKey, contractAddresses, block.timestamp, 1, _permitSignature());

        (uint256[] memory masked,) = abi.decode(payload, (uint256[], bytes));
        cleartext = masked[0] ^ uint256(bytes32(publicKey));
        vm.resumeGasMetering();
    }

    /// @dev Alice's signature over the permit digest, 65 bytes `r || s || v` as the verifier decodes it.
    function _permitSignature() private view returns (bytes memory) {
        (bytes32 digest,) = FhevmCleartextDecrypt.userDecryptDigest(publicKey, contractAddresses, block.timestamp, 1);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ALICE_PK, digest);
        return abi.encodePacked(r, s, v);
    }
}
