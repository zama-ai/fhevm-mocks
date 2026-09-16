// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {FHE} from "@fhevm/solidity/lib/FHE.sol";
import {euint64, externalEuint64} from "encrypted-types/EncryptedTypes.sol";

import {FhevmStd} from "../../pkg/src/FhevmStd.sol";
import {ACL_ADDRESS, FHEVM_EXECUTOR_ADDRESS, KMS_VERIFIER_ADDRESS} from "../../pkg/src/_host/FhevmCleartextDeploy.sol";

/**
 * A dApp as a user would write one: against the fhevm Solidity library, knowing nothing about the
 * cleartext stack underneath. It takes one encrypted input, adds one, and publishes the result.
 *
 * The constructor points it at the local stack. `setCoprocessor` is what `ZamaConfig` calls on a real
 * network, and the addresses are where `deployLocalFhevm` puts the contracts.
 */
contract AddOneDapp is ZamaEthereumConfig {
    euint64 private _result;

    constructor() {
        //
    }

    function addOne(externalEuint64 input, bytes calldata inputProof) external {
        euint64 value = FHE.fromExternal(input, inputProof);
        _result = FHE.add(value, 1);

        FHE.allowThis(_result);
        FHE.allow(_result, msg.sender);
        FHE.makePubliclyDecryptable(_result);
    }

    function result() external view returns (euint64) {
        return _result;
    }

    /**
     * @notice Checks that `cleartextResult` really is the decryption of this contract's result.
     * @dev The KMS signatures are over the handles AND the cleartexts, so the value is needed as well
     *      as the proof: the proof alone says nothing about which value it attests to. Both halves are
     *      built here rather than taken from the caller. The handle list is the contract's own, which
     *      stops a caller passing a proof for some other handle it can decrypt, and the signed blob is
     *      encoded from the typed argument, so a caller cannot hand over a mis-encoded one.
     * @return true if the signatures verify. Reverts on an empty, malformed or unsigned proof.
     */
    function verifyResult(uint64 cleartextResult, bytes calldata decryptionProof) external view returns (bool) {
        bytes32[] memory handles = new bytes32[](1);
        handles[0] = euint64.unwrap(_result);
        return FHE.isPublicDecryptionResultValid(handles, abi.encode(cleartextResult), decryptionProof);
    }
}

/**
 * The public-decryption round trip, end to end: encrypt an input with this library, let a real dApp
 * compute on it through the fhevm Solidity library, then read the result back in the clear.
 *
 * It is also what proves the encrypted types are shared rather than duplicated. `externalEuint64` is
 * produced here and consumed by the dApp, and `euint64` travels the other way. Two copies of
 * `encrypted-types` would be two incompatible types and none of this would compile.
 */
contract DecryptPublicTest is Test, FhevmStd {
    AddOneDapp internal dapp;
    address internal alice;

    function setUp() public {
        setUpFhevm();
        dapp = new AddOneDapp();
        alice = makeAddr("alice");
    }

    function test_publicDecryptReturnsTheDappResult() public {
        // The input proof is bound to both the contract and the caller, so it is built for alice and
        // must be sent by alice.
        (externalEuint64 handle, bytes memory inputProof) = encryptUint64(41, address(dapp), alice);

        vm.prank(alice);
        dapp.addOne(handle, inputProof);

        (uint64 clear, bytes memory decryptionProof) = decryptPublicWithProof(dapp.result());
        assertEq(clear, 42);

        // The dApp re-checks the KMS signatures itself, which is what a contract acting on a revealed
        // value must do.
        assertTrue(dapp.verifyResult(clear, decryptionProof), "proof did not verify");
    }

    function test_verifyResultRejectsAValueThatWasNotDecrypted() public {
        (externalEuint64 handle, bytes memory inputProof) = encryptUint64(41, address(dapp), alice);

        vm.prank(alice);
        dapp.addOne(handle, inputProof);

        (, bytes memory decryptionProof) = decryptPublicWithProof(dapp.result());

        // Same proof, a different claimed cleartext: the signatures are over the handles AND the
        // values, so they now recover to addresses that are not KMS signers. Only the selector is
        // pinned, because the recovered address differs every run: the handle carries a random nonce,
        // so the digest the signatures are checked against is never the same twice.
        vm.expectPartialRevert(FHE.KMSInvalidSigner.selector);
        dapp.verifyResult(43, decryptionProof);
    }
}
