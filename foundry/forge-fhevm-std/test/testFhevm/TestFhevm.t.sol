// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

// ONE import: `TestFhevm` brings forge-std's `Test`, `StdFhevm` and a deployed local FHEVM.
import {TestFhevm, EncryptedInput} from "../../pkg/src/TestFhevm.sol";

import {externalEuint32} from "encrypted-types/EncryptedTypes.sol";

import {Vault} from "../encrypt/Vault.sol";

/// No `setUp` at all: the inherited one already booted the host.
contract TestFhevmDefaultSetUpTest is TestFhevm {
    function test_theHostIsAlreadyDeployed() public {
        address alice = makeAddr("alice");
        Vault vault = new Vault();

        (externalEuint32 handle, bytes memory proof) = encryptUint32(7, address(vault), alice);
        vm.prank(alice);
        vault.setEUint32(handle, proof);

        assertEq(decryptPublic(vault.eUint32()), 7);
    }
}

/// The override path: own fixtures, chained onto the inherited `setUp`.
contract TestFhevmOverriddenSetUpTest is TestFhevm {
    Vault internal vault;
    address internal alice;

    function setUp() public override {
        super.setUp();
        vault = new Vault();
        alice = makeAddr("alice");
    }

    function test_fixturesAndHostAreBothReady() public {
        EncryptedInput memory e = encryptValues(asUint32(7), asUint64(9), address(vault), alice);

        vm.startPrank(alice);
        vault.setEUint32(e.externalEuint32At(0), e.inputProof);
        vault.setEUint64(e.externalEuint64At(1), e.inputProof);
        vm.stopPrank();

        assertEq(decryptPublic(vault.eUint32()), 7);
        assertEq(decryptPublic(vault.eUint64()), 9);
    }
}
