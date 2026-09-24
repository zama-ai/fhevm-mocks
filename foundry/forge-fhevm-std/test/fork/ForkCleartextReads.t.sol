// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {euint32, externalEuint32} from "encrypted-types/EncryptedTypes.sol";

import {TestFhevm} from "../../pkg/src/TestFhevm.sol";
import {LibCleartextProbe} from "../../pkg/src/_host/shared/LibCleartextProbe.sol";
import {LibFhevmProtocol} from "../../pkg/src/LibFhevmProtocol.sol";
import {fhevm} from "../../pkg/src/FhevmVm.sol";
import {ForkBlocks} from "../shared/ForkBlocks.sol";

interface IFHETest {
    function getEuint32Of(address account) external view returns (euint32);
    function addEuint32(externalEuint32 input, bytes calldata inputProof, uint32 clearValue, bool makePublic) external;
}

/**
 * A FORK COMPUTES AND DECRYPTS WITH NO REPLAY ANYWHERE, which is the whole of what replaced the event
 * processor.
 *
 * WHAT USED TO HAPPEN. A production executor announces handles and keeps no values, so the SDK rebuilt
 * them by replaying its events -- a second implementation of every operator, living in the test process,
 * which had to see every event or lose track of a value.
 *
 * WHAT HAPPENS NOW. `createSelectFork` upgrades the forked stack to this package's cleartext
 * implementations on first contact, so the chain holds the plaintexts of everything it computes and the
 * SDK simply asks it. Nothing in this test arranges that; it is what forking does.
 *
 * TESTNET, deliberately, for two reasons: a dApp is deployed there and configured for that stack, and it
 * is a generation behind -- so the SDK's own generation upgrade runs first and the cleartext pass lands on
 * top of it. Both upgrades, in one ordinary fork call.
 *
 *          SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com \
 *          forge test --match-contract ForkCleartextSdk -vv
 */
contract ForkCleartextReadsTest is TestFhevm {
    IFHETest internal constant FHE_TEST = IFHETest(0x6Bc47f6A33c0E04235f79e1Fc9A3cCD6e7Bbb5fc);

    /// @dev An account already holding a euint32 on the real chain, minted long before any cleartext layer.
    address internal constant SENDER = 0x37AC010c1c566696326813b840319B58Bb5840E4;

    FhevmChain internal sepolia;
    uint256 internal blockA;
    bool internal forked;

    function setUp() public override {
        if (!ForkBlocks.enabled("sepolia")) return;
        sepolia = getFhevmChain("testnet", "sepolia");
        blockA = ForkBlocks.recent(sepolia.rpcUrl);
        forked = true;
    }

    function test_aForkComputesAndDecryptsWithNoReplay() public {
        vm.skip(!forked);

        // -- 1. an ordinary fork. The real chain runs the production executor, and does not after this.
        fhevm.createSelectFork(sepolia, blockA);
        assertTrue(LibCleartextProbe.isCleartext(sepolia.fhevmExecutor), "the forked stack is cleartext now");
        assertEq(LibFhevmProtocol.currentConfig().plaintexts, sepolia.fhevmExecutor, "and is its own plaintext source");

        // -- 2. the value this account already held cannot be known, so the test states it -------------
        forkUnknown(FHE_TEST.getEuint32Of(SENDER), 1000);

        // -- 3. what a user's test looks like ----------------------------------------------------------
        (externalEuint32 input, bytes memory proof) = encryptUint32(5, address(FHE_TEST), SENDER);
        vm.prank(SENDER);
        FHE_TEST.addEuint32(input, proof, 5, true);

        assertEq(decryptPublic(FHE_TEST.getEuint32Of(SENDER)), 1005, "the stated base plus what was encrypted");
    }
}
