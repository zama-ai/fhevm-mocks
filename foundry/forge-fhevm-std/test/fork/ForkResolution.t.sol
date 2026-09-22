// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {euint32} from "encrypted-types/EncryptedTypes.sol";

import {TestFhevm} from "../../pkg/src/TestFhevm.sol";
import {ForgeFhevmEventProcessor} from "../../pkg/src/_host/ForgeFhevmEventProcessor.sol";
import {LibFhevmProtocol} from "../../pkg/src/LibFhevmProtocol.sol";
import {LibFhevmVersion} from "../../pkg/src/LibFhevmVersion.sol";
import {fhevm} from "../../pkg/src/FhevmVm.sol";
import {LibFhevmFail} from "../../pkg/src/LibFhevmFail.sol";
import {ForkBlocks} from "../shared/ForkBlocks.sol";

interface IFHETest {
    function getEuint32Of(address account) external view returns (euint32);
}

/**
 * @notice A fork entered with a URL only: which FHEVM stack is it on? And a fork on a stack this SDK
 *         does not vendor: refused by name, before anything touches it.
 *
 *          SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com \
 *          MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com forge test --match-contract ForkResolution
 */
contract ForkResolutionTest is TestFhevm {
    /// @dev A deployed `FHETest`, configured for Sepolia's `testnet` stack, and an account with a euint32 on it.
    IFHETest internal constant FHE_TEST = IFHETest(0x94B9d3aF050687D1F76251aD7D09a1F216a19845);
    address internal constant SENDER = 0x37AC010c1c566696326813b840319B58Bb5840E4;

    FhevmChain internal sepolia;
    FhevmChain internal mainnet;
    uint256 internal blockA;
    bool internal forked;
    bool internal mainnetToo;

    function setUp() public override {
        if (!ForkBlocks.enabled("sepolia")) return; // opt in: [rpc_endpoints] sepolia, or SEPOLIA_RPC_URL
        sepolia = getFhevmChain("testnet", "sepolia");
        blockA = ForkBlocks.recent(sepolia.rpcUrl);
        forked = true;
        if (!ForkBlocks.enabled("mainnet")) return;
        mainnet = getFhevmChain("mainnet", "mainnet");
        mainnetToo = true;
    }

    /// THE DAPP DECIDES. Sepolia carries two stacks; the first entry names a dApp, and that dApp's own
    /// coprocessor config says which one — the same address it calls itself, so it cannot be wrong.
    function test_theDappNamedByTheFirstEntryPicksTheStack() public {
        vm.skip(!forked);
        fhevm.createSelectFork(sepolia.rpcUrl, blockA); // URL only

        encryptUint32(1, address(FHE_TEST), SENDER); // first entry, names the dApp

        assertEq(LibFhevmProtocol.currentConfig().acl, sepolia.acl, "testnet, from the dApp's config");
        assertEq(ForgeFhevmEventProcessor(fhevm.eventProcessor()).selectedExecutor(), sepolia.fhevmExecutor);
    }

    /// WITHOUT A DAPP, SEPOLIA IS AMBIGUOUS, and the SDK says so rather than picking one.
    function test_RevertIf_TwoGroupsAndNoDapp() public {
        vm.skip(!forked);
        fhevm.createSelectFork(sepolia.rpcUrl, blockA);
        euint32 current = FHE_TEST.getEuint32Of(SENDER);

        string[] memory groups = new string[](2);
        groups[0] = "testnet";
        groups[1] = "devnet";
        vm.expectRevert(bytes(LibFhevmFail.ambiguousGroup(11155111, groups)));
        this.forkUnknownExternally(current);
    }

    /// ONE GROUP, NO DAPP NEEDED: mainnet resolves by chain id alone.
    function test_aChainInOneGroupResolvesByChainId() public {
        vm.skip(!mainnetToo);
        fhevm.createSelectFork(mainnet.rpcUrl); // URL only

        forkUnknown(euint32.wrap(bytes32(uint256(1))), 1); // any entry, no dApp

        assertEq(LibFhevmProtocol.currentConfig().acl, mainnet.acl, "mainnet, from the table");
    }

    /// THE VERSION GATE. Devnet Sepolia runs `ACL v0.5.0`, the NEXT line; this SDK accepts the 0.13 line,
    /// `ACL v0.4.0` from its first release to the vendored one. Refused by name by `createSelectFork`
    /// itself — not by an empty revert inside the signer swap, which is what happened before.
    function test_RevertIf_TheStackRunsAnotherProtocolVersion() public {
        vm.skip(!forked);
        FhevmChain memory devnet = getFhevmChain("devnet", "sepolia");

        vm.expectRevert(
            bytes(
                LibFhevmFail.versionMismatch(
                    "devnet", "sepolia", "ACL", LibFhevmVersion.ACL_FLOOR, LibFhevmVersion.aclCeiling(), "ACL v0.5.0"
                )
            )
        );
        fhevm.createSelectFork(devnet, blockA);
    }

    /// THE CURRENT STACK FOLLOWS EVERY FORK OPERATION. Local cleartext by default; the chain form points at
    /// the fork's stack the moment it returns; the URL form CLEARS it — unknown, never stale — until the
    /// first entry resolves it.
    function test_theCurrentStackFollowsTheForkOperations() public {
        vm.skip(!forked);
        assertTrue(LibFhevmProtocol.currentConfig().isCleartext, "the local stack, by default");

        fhevm.createSelectFork(sepolia, blockA);
        assertEq(LibFhevmProtocol.currentConfig().acl, sepolia.acl, "pointed, no SDK entry needed");
        assertFalse(LibFhevmProtocol.currentConfig().isCleartext);

        // `super.setUp()` on a fork is harmless: the in-memory deploy happened in the constructor, and once a
        // fork is selected the fork's stack stays current (forge-std semantics: the in-memory chain is no
        // longer where the test executes). A test that forks in `setUp` may call it or not.
        super.setUp();
        assertEq(LibFhevmProtocol.currentConfig().acl, sepolia.acl, "unchanged by super.setUp()");
        assertFalse(LibFhevmProtocol.currentConfig().isCleartext, "still the fork's stack");

        fhevm.createSelectFork(sepolia.rpcUrl, blockA); // URL only
        assertFalse(LibFhevmProtocol.hasProtocol(), "unknown until resolved: not sepolia, not anything");
    }

    /// External so `vm.expectRevert` has a call frame to catch.
    function forkUnknownExternally(euint32 value) external {
        forkUnknown(value, 1);
    }
}
