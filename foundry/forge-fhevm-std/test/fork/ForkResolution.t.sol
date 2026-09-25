// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {euint32} from "encrypted-types/EncryptedTypes.sol";

import {TestFhevm} from "../../pkg/src/TestFhevm.sol";
import {LibFhevmProtocol} from "../../pkg/src/LibFhevmProtocol.sol";
import {FhevmGeneration, LibFhevmVersion} from "../../pkg/src/LibFhevmVersion.sol";
import {fhevm, NO_FORK} from "../../pkg/src/FhevmVm.sol";
import {LibFhevmFail} from "../../pkg/src/LibFhevmFail.sol";
import {ForkBlocks} from "../shared/ForkBlocks.sol";

interface IFHETest {
    function getEuint32Of(address account) external view returns (euint32);
}

interface IVersioned {
    function getVersion() external view returns (string memory);
}

/// @dev The HCU limit is not in the chain table -- no deployment publishes it -- so it is asked of the
///      executor, which is where `FhevmVm` gets it too.
interface IHcuLimitSource {
    // The name is the executor's, not a choice.
    // forge-lint: disable-next-line(mixed-case-function)
    function getHCULimitAddress() external view returns (address);
}

/**
 * @notice A fork entered with a URL only: which FHEVM stack is it on? And a fork on a stack a generation
 *         behind this SDK: upgraded on the fork, rather than refused.
 *
 *         SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com \
 *         MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com forge test --match-contract ForkResolution
 */
contract ForkResolutionTest is TestFhevm {
    /// @dev A deployed `FHETest`, configured for Sepolia's `testnet` stack, and an account with a euint32 on it.
    IFHETest internal constant FHE_TEST = IFHETest(0x6Bc47f6A33c0E04235f79e1Fc9A3cCD6e7Bbb5fc);
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
        assertEq(LibFhevmProtocol.currentConfig().executor, sepolia.fhevmExecutor, "and the executor with it");
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

    /// THE VERSION GATE, on a chain that already meets it. Devnet Sepolia runs this SDK's own line, so it
    /// is taken as it is: nothing is deployed, no proxy moves, and the versions after the fork are the ones
    /// the chain itself reports.
    function test_aStackOnThisGenerationIsTakenAsItIs() public {
        vm.skip(!forked);
        (FhevmChain memory chain, bool found) = _sepoliaGroupOn(FhevmGeneration.Current);
        vm.skip(!found);

        vm.createSelectFork(chain.rpcUrl, blockA); // a plain forge fork: what the chain says, untouched
        string memory beforeAcl = IVersioned(chain.acl).getVersion();
        string memory beforeProtocolConfig = IVersioned(chain.protocolConfig).getVersion();

        fhevm.createSelectFork(chain, blockA);
        assertEq(IVersioned(chain.acl).getVersion(), beforeAcl, "the ACL was not touched");
        assertEq(IVersioned(chain.protocolConfig).getVersion(), beforeProtocolConfig, "nor the ProtocolConfig");
    }

    /**
     * ONE GENERATION BEHIND IS UPGRADED, NOT REFUSED. A chain still on the line below this SDK's is not
     * refused: `createSelectFork` runs the generation's own upgrade against the forked copy and the gate
     * then passes. Read here as the versions themselves: before the SDK touches it the chain answers the
     * older line's, and afterwards the same address answers this one's.
     *
     * ON THE FORK ONLY. Nothing is broadcast; the chain keeps answering the old version, which the second
     * plain fork below reads back from it after the upgraded fork has been left behind.
     *
     * SKIPPED WHERE NO SUCH CHAIN EXISTS. Which group is a generation behind is a fact about the chains,
     * not about this file -- and on a line with nothing below it in production, there is no subject at
     * all. Asked of the chain table rather than written down, so this reads the same on every line.
     */
    function test_aStackOneGenerationBehindIsUpgradedOnTheFork() public {
        vm.skip(!forked);
        (FhevmChain memory chain, bool found) = _sepoliaGroupOn(FhevmGeneration.Previous);
        vm.skip(!found);

        vm.createSelectFork(chain.rpcUrl, blockA);
        string memory before = IVersioned(chain.acl).getVersion();
        assertTrue(
            !LibFhevmVersion.accepts(before, LibFhevmVersion.ACL_FLOOR, LibFhevmVersion.aclCeiling()),
            "the chain is on the previous line"
        );

        fhevm.createSelectFork(chain, blockA);
        assertEq(IVersioned(chain.acl).getVersion(), LibFhevmVersion.aclCeiling(), "upgraded on the fork");
        assertEq(
            IVersioned(chain.protocolConfig).getVersion(),
            LibFhevmVersion.protocolConfigCeiling(),
            "and so was the ProtocolConfig, whose reinitializer reshapes the KMS context"
        );

        // and the upgraded stack is a working one, which is the whole point of not refusing it
        encryptUint32(1, address(FHE_TEST), SENDER);
        assertEq(LibFhevmProtocol.currentConfig().acl, chain.acl, "upgraded in place");

        vm.createSelectFork(chain.rpcUrl, blockA);
        assertEq(IVersioned(chain.acl).getVersion(), before, "the real chain never moved");
    }

    /**
     * @dev The first Sepolia group whose stack classifies as `wanted`, asked of the chains themselves.
     *
     *      WHY NOT NAME THE GROUP. Which group runs which protocol line changes with every release, and
     *      differs between the generations this one package serves: what is "one behind" on one line is
     *      "current" on the next, and may be ahead of the one before. A name written here is a premise
     *      that quietly inverts. The versions are read off the forked chain and classified by the same
     *      code the SDK's own gate uses.
     */
    function _sepoliaGroupOn(FhevmGeneration wanted) private returns (FhevmChain memory chain, bool found) {
        string[2] memory groups = ["devnet", "testnet"];
        for (uint256 i = 0; i < groups.length; i++) {
            FhevmChain memory candidate = getFhevmChain(groups[i], "sepolia");
            vm.createSelectFork(candidate.rpcUrl, blockA);
            if (
                LibFhevmVersion.classify(
                        LibFhevmVersion.read(
                            candidate.acl,
                            candidate.fhevmExecutor,
                            candidate.kmsVerifier,
                            candidate.inputVerifier,
                            IHcuLimitSource(candidate.fhevmExecutor).getHCULimitAddress(),
                            candidate.protocolConfig,
                            candidate.kmsGeneration
                        )
                    ) == wanted
            ) return (candidate, true);
        }
    }

    /// THE CURRENT STACK FOLLOWS EVERY FORK OPERATION. Local cleartext by default; the chain form points at
    /// the fork's stack the moment it returns; the URL form CLEARS it — unknown, never stale — until the
    /// first entry resolves it.
    function test_theCurrentStackFollowsTheForkOperations() public {
        vm.skip(!forked);
        assertTrue(LibFhevmProtocol.currentConfig().isCleartext, "the local stack, by default");

        fhevm.createSelectFork(sepolia, blockA);
        assertEq(LibFhevmProtocol.currentConfig().acl, sepolia.acl, "pointed, no SDK entry needed");
        // Cleartext NOW, where it was the real stack before: a fork is upgraded on first contact, so the
        // flag no longer distinguishes "forked" from "local" -- only `currentForkId` does.
        assertTrue(LibFhevmProtocol.currentConfig().isCleartext, "the fork's stack, upgraded");

        // `super.setUp()` on a fork is harmless: the in-memory deploy happened in the constructor, and once a
        // fork is selected the fork's stack stays current (forge-std semantics: the in-memory chain is no
        // longer where the test executes). A test that forks in `setUp` may call it or not.
        super.setUp();
        assertEq(LibFhevmProtocol.currentConfig().acl, sepolia.acl, "unchanged by super.setUp()");
        assertTrue(LibFhevmProtocol.currentConfig().isCleartext, "still the fork's stack");
        assertTrue(fhevm.currentForkId() != NO_FORK, "and still a fork, which is what tells them apart");

        fhevm.createSelectFork(sepolia.rpcUrl, blockA); // URL only
        assertFalse(LibFhevmProtocol.hasProtocol(), "unknown until resolved: not sepolia, not anything");
    }

    /// External so `vm.expectRevert` has a call frame to catch.
    function forkUnknownExternally(euint32 value) external {
        forkUnknown(value, 1);
    }
}
