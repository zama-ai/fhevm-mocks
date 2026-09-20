// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {euint32, externalEuint32} from "encrypted-types/EncryptedTypes.sol";

import {TestFhevm} from "../../pkg/src/TestFhevm.sol";
import {LibFhevmProtocol} from "../../pkg/src/LibFhevmProtocol.sol";
import {LibFhevmFail} from "../../pkg/src/LibFhevmFail.sol";
import {fhevm} from "../../pkg/src/FhevmVm.sol";
import {DEPLOYER_ADDRESS} from "../../pkg/src/_host/_internal/LocalHostAddresses.sol";

interface IFHETest {
    function getEuint32Of(address account) external view returns (euint32);
    function addEuint32(externalEuint32 input, bytes calldata inputProof, uint32 clearValue, bool makePublic) external;
}

/**
 * @notice `forge test --fork-url <sepolia>`: forge starts EVERY test on a fork before any constructor runs,
 *         so `fhevm` is born on a fork nobody switched to. This suite runs ONLY in that mode.
 *
 *          SEPOLIA_RPC_URL=… npm run test:fork-url
 *          # = forge test --fork-url $SEPOLIA_RPC_URL --fork-block-number ${SEPOLIA_FORK_BLOCK:-11743572} \
 *          #              --match-path 'test/forkurl/*'
 *
 *      EXAMPLE:
 *      forge test --fork-url https://ethereum-sepolia-rpc.publicnode.com --match-path 'test/forkurl/*' --fork-block-number 11743572
 *
 *      PIN WITH `--fork-block-number`, not `--block-number`. The first forks at that block and caches every
 *      fetched slot under ~/.foundry/cache/rpc/<chain>/<block> (measured: 5.9 s, then 0.4 s from disk). The
 *      second forks at LATEST and only overrides the `block.number` the EVM reports: nothing reusable is
 *      cached, and the state is not the pinned block's.
 *
 * @dev What must hold: no drift refusal (the birth context is the baseline); no local cleartext stack
 *      deployed onto the real chain's fork; nothing pointed until an SDK entry names the dApp, which then
 *      resolves the stack exactly as after `fhevm.createSelectFork(url)`; and the five-line flow works. In a
 *      plain `forge test` every test here skips: there is no fork to be born on.
 */
contract ForkUrlTest is TestFhevm {
    IFHETest internal constant FHE_TEST = IFHETest(0x94B9d3aF050687D1F76251aD7D09a1F216a19845);
    address internal constant SENDER = 0x37AC010c1c566696326813b840319B58Bb5840E4;

    modifier onlyForkUrl() {
        vm.skip(!fhevm.isForked() || block.chainid != 11155111);
        _;
    }

    /// Born on a fork: the constructor deployed NOTHING and pointed NOTHING. Not asserted through the local
    /// addresses' code — on a real chain they may hold anything (Sepolia does: the same deployer account ran
    /// the same creation sequence there once) — but through what only the constructor's local branch would
    /// have produced: a pointed protocol and a processor for this context.
    function test_bornOnAForkDeploysNothingAndPointsNothing() public onlyForkUrl {
        assertEq(fhevm.currentForkId(), 0, "forge's --fork-url fork");
        assertFalse(LibFhevmProtocol.hasProtocol(), "nothing pointed: unknown until an entry resolves it");
        assertEq(fhevm.eventProcessor(), address(0), "no processor created: no stack was pointed here");
        assertTrue(vm.getNonce(DEPLOYER_ADDRESS) != 0, "a real chain with history at the deployer account");
    }

    /// The first entry names the dApp, the dApp's config picks Sepolia's testnet stack, and the whole flow
    /// works — with no `fhevm.createSelectFork` anywhere, and no drift refusal.
    function test_theDappResolvesTheStackAndTheFlowWorks() public onlyForkUrl {
        FhevmChain memory sepolia = getFhevmChain("testnet", "sepolia");
        euint32 unknownEuint32 = FHE_TEST.getEuint32Of(SENDER);

        // Encrypt 337 to compute FHETest.current(euint32) + 337
        (externalEuint32 input, bytes memory proof) = encryptUint32(337, address(FHE_TEST), SENDER);
        assertEq(LibFhevmProtocol.currentConfig().acl, sepolia.acl, "resolved from the dApp");

        // We cannot know the value if `unknownEuint32`
        // So we say "Ok, if you encounter this encrypted data, make as if it was 1000"
        uint32 knownEuint32 = 1000;
        forkUnknown(unknownEuint32, knownEuint32);

        // FHE.add(unknownEuint32 = 1000, 337)
        // `true` make it publicly decryptable
        vm.prank(SENDER);
        FHE_TEST.addEuint32(input, proof, 337, true);

        assertEq(decryptPublic(FHE_TEST.getEuint32Of(SENDER)), knownEuint32 + 337);
    }

    /// Without a dApp, Sepolia is ambiguous here exactly as after a URL-only `createSelectFork`.
    function test_RevertIf_NoDappOnATwoGroupChain() public onlyForkUrl {
        euint32 current = FHE_TEST.getEuint32Of(SENDER);
        string[] memory groups = new string[](2);
        groups[0] = "testnet";
        groups[1] = "devnet";
        vm.expectRevert(bytes(LibFhevmFail.ambiguousGroup(11155111, groups)));
        this.forkUnknownExternally(current);
    }

    /// `fhevm.createSelectFork` still works from a birth fork: a second Sepolia fork, and back.
    ///
    /// @dev The ONLY test here that opens a fork of its own, so the only one that needs a URL of its own:
    ///      `getFhevmChain` resolves it from `foundry.toml`, else `SEPOLIA_RPC_URL`, else forge-std's shared
    ///      default — an Infura key that answers 429 under load. The birth fork's URL is forge's and not
    ///      readable from a test, so this requires the variable (`npm run test:fork-url` sets it) and says so.
    function test_forkOperationsStillWorkFromTheBirthFork() public onlyForkUrl {
        vm.skip(!fhevm.hasRpcUrlFor("sepolia")); // needs a URL of its own: [rpc_endpoints] sepolia, or SEPOLIA_RPC_URL
        FhevmChain memory sepolia = getFhevmChain("testnet", "sepolia");
        uint256 birth = fhevm.currentForkId();
        fhevm.useStack(sepolia); // name the birth fork's stack explicitly
        uint256 other = fhevm.createSelectFork(sepolia, 11_743_572);
        assertTrue(other != birth);
        assertEq(LibFhevmProtocol.currentConfig().acl, sepolia.acl);
        fhevm.selectFork(birth);
        assertEq(fhevm.currentForkId(), birth);
        assertEq(LibFhevmProtocol.currentConfig().acl, sepolia.acl);
    }

    /// External so `vm.expectRevert` has a call frame to catch.
    function forkUnknownExternally(euint32 value) external {
        forkUnknown(value, 1);
    }
}
