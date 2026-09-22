// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {euint32, euint64, externalEuint32} from "encrypted-types/EncryptedTypes.sol";
import {FHE} from "@fhevm/solidity/lib/FHE.sol";
// Under the default profile this is upstream's config; under `fhevm-debug` the remapping makes it this
// package's `DebugZamaConfig.sol`. Aliased, so the debug file can also be named directly below.
import {ZamaConfig as ProfileConfig, ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {
    ZamaConfig as DebugConfig,
    ZamaEthereumConfig as DebugEthereumConfig
} from "../../pkg/src/config/DebugZamaConfig.sol";
// Upstream through a prefix the debug remapping does not touch (`@fhevm/solidity-upstream/`, remappings.txt),
// so both builds are in hand under either profile.
import {ZamaEthereumConfig as UpstreamEthereumConfig} from "@fhevm/solidity-upstream/config/ZamaConfig.sol";

import {TestFhevm} from "../../pkg/src/TestFhevm.sol";
import {LibFhevmFail} from "../../pkg/src/LibFhevmFail.sol";
import {LibFhevmProtocol} from "../../pkg/src/LibFhevmProtocol.sol";
import {fhevm} from "../../pkg/src/FhevmVm.sol";
import {ACL_ADDRESS, DEPLOYER_ADDRESS} from "../../pkg/src/_host/_internal/LocalHostAddresses.sol";
import {FHECounterPublicDecrypt} from "../examples/contracts/FHECounterPublicDecrypt.sol";

/// A dApp that does FHE work IN ITS CONSTRUCTOR: the case the debug config exists for, since the chain id
/// stays real throughout and the handle it mints carries it.
contract MintsInConstructor is ZamaEthereumConfig {
    euint64 public seed;

    constructor() {
        seed = FHE.asEuint64(7);
        FHE.allowThis(seed);
    }
}

/// The two builds side by side, whatever the profile: one compiled against the debug config by direct import,
/// one against upstream by path.
contract AlwaysDebugDApp is DebugEthereumConfig {}

contract AlwaysUpstreamDApp is UpstreamEthereumConfig {}

/**
 * @notice A cleartext stack on a fork of a chain that has NO FHEVM protocol (plan-cleartext-on-fork.md §1, §2):
 *         Arbitrum One here, straight from its RPC, no anvil. The SDK provisions the stack on first contact;
 *         under the `fhevm-debug` profile a production dApp then deploys with plain `new`.
 *
 * @dev Opt in with `ARBITRUM_RPC_URL` (or `[rpc_endpoints] arbitrum`), like the Sepolia suites:
 *
 *          ARBITRUM_RPC_URL=https://arbitrum-one-rpc.publicnode.com forge test --match-path test/fork/CleartextOnForeignChain.t.sol
 *          ARBITRUM_RPC_URL=https://arbitrum-one-rpc.publicnode.com FOUNDRY_PROFILE=fhevm-debug forge test --match-path test/fork/CleartextOnForeignChain.t.sol
 *          ARBITRUM_RPC_URL=... FOUNDRY_PROFILE=fhevm-debug forge test --match-path test/fork/CleartextOnForeignChain.t.sol
 *
 *      Tests that need one profile skip under the other. The mainnet ones also want `MAINNET_RPC_URL`.
 */
contract CleartextOnForeignChainTest is TestFhevm {
    address internal alice;
    bool internal forked;
    bool internal mainnetToo;
    bool internal debugBuild;

    function setUp() public override {
        alice = makeAddr("alice");
        debugBuild = keccak256(bytes(vm.envOr("FOUNDRY_PROFILE", string("default")))) == keccak256("fhevm-debug");
        if (!fhevm.hasRpcUrlFor("arbitrum")) return; // opt in: [rpc_endpoints] arbitrum, or ARBITRUM_RPC_URL
        forked = true;
        mainnetToo = fhevm.hasRpcUrlFor("mainnet");
    }

    // -- §1: the stack appears on first contact -----------------------------------------------------------

    /// One line names the chain; the fork keeps its real chain id; the stack is there, cleartext, at the
    /// canonical addresses, deployed by the bootstrap deployer.
    function test_theCleartextStackIsProvisionedOnFirstContact() public {
        vm.skip(!forked);
        fhevm.createSelectFork(cleartextChain("arbitrum"));

        assertEq(block.chainid, 42161, "Arbitrum's chain id, untouched");
        assertGt(ACL_ADDRESS.code.length, 0, "provisioned in the fork, no anvil anywhere");
        assertTrue(LibFhevmProtocol.currentConfig().isCleartext, "and it is the cleartext one");
        assertEq(fhevm.protocol().acl, ACL_ADDRESS);
        assertGt(vm.getNonce(DEPLOYER_ADDRESS), 0, "the bootstrap deployer deployed it");
    }

    /// A second fork of the same alias is a fresh fork with nothing mirrored, so it is provisioned again.
    function test_aSecondForkIsProvisionedAgain() public {
        vm.skip(!forked);
        fhevm.createSelectFork(cleartextChain("arbitrum"));
        uint256 second = fhevm.createSelectFork(cleartextChain("arbitrum"));

        assertEq(fhevm.activeFork(), second);
        assertGt(ACL_ADDRESS.code.length, 0, "fresh fork, fresh stack");
        assertTrue(LibFhevmProtocol.currentConfig().isCleartext);
    }

    /// DEBUG profile, Arbitrum only: the production counter with plain `new`, then everything a test does on
    /// the stack, under the real chain id — and the handles say so.
    function test_debug_encryptComputeAndDecryptUnderTheRealChainId() public {
        vm.skip(!forked || !debugBuild);
        fhevm.createSelectFork(cleartextChain("arbitrum"));
        FHECounterPublicDecrypt counter = new FHECounterPublicDecrypt();

        (externalEuint32 v, bytes memory proof) = encryptUint32(5, address(counter), alice);
        vm.prank(alice);
        counter.increment(v, proof);

        assertEq(decryptPublic(counter.getCount()), 5, "encrypt, compute, public decrypt");
        assertEq(uint64(uint256(euint32.unwrap(counter.getCount())) >> 16), 42161, "handle chain-id bytes");
    }

    // -- §1.2: the guards, broken on purpose (rules.md 7.1) -------------------------------------------------

    /// The mock never shadows a live stack: the canonical entry pointed at mainnet, whose executor slot is
    /// empty at the LOCAL address, must be refused by name, not deployed.
    function test_aChainWithALiveStackRefusesTheMock() public {
        vm.skip(!forked || !mainnetToo);
        FhevmChain memory mainnet = getFhevmChain("mainnet", "mainnet");
        FhevmChain memory pretender = cleartextChain("arbitrum");
        pretender.rpcUrl = mainnet.rpcUrl;

        vm.expectRevert(bytes(LibFhevmFail.liveStackExists(1, "mainnet", "mainnet")));
        this.forkExternally(pretender);
    }

    /// The direct form of the same mistake: naming mainnet AS a cleartext chain. The alias resolves — mainnet
    /// has a URL — and the fork is created, but the stack is refused by name before anything is deployed.
    function test_namingMainnetAsACleartextChainIsRefused() public {
        vm.skip(!mainnetToo);
        FhevmChain memory pretender = cleartextChain("mainnet");
        assertEq(pretender.fhevmGroup, "local", "what the helper claims");

        vm.expectRevert(bytes(LibFhevmFail.liveStackExists(1, "mainnet", "mainnet")));
        this.forkExternally(pretender);
    }

    /// The deployer's nonce must be fresh: the stack's addresses come from its sequence.
    function test_aUsedDeployerAccountRefusesTheDeploy() public {
        vm.skip(!forked);
        FhevmChain memory arbitrum = cleartextChain("arbitrum");
        fhevm.createSelectFork(arbitrum.rpcUrl); // URL only: no stack named, nothing prepared yet
        vm.setNonce(DEPLOYER_ADDRESS, 1);

        vm.expectRevert(bytes(LibFhevmFail.localStackCannotDeploy(DEPLOYER_ADDRESS, 0, 1)));
        this.useStackExternally(arbitrum);
    }

    // -- §2: the production dApp, under each profile ---------------------------------------------------------

    /// DEFAULT profile: upstream's config has no entry for 42161, so the production dApp refuses the chain.
    /// This is the existing behaviour, kept asserted; it is why the debug profile exists.
    function test_default_theProductionConfigRefusesTheChain() public {
        vm.skip(!forked || debugBuild);
        fhevm.createSelectFork(cleartextChain("arbitrum"));

        vm.expectRevert(ProfileConfig.ZamaProtocolUnsupported.selector);
        this.deployCounterExternally();
    }

    /// DEBUG profile: the same source, compiled against `DebugZamaConfig.sol`, deploys with plain `new` and
    /// resolves the stack the SDK provisioned.
    function test_debug_theProductionDappDeploysWithPlainNew() public {
        vm.skip(!forked || !debugBuild);
        fhevm.createSelectFork(cleartextChain("arbitrum"));

        FHECounterPublicDecrypt counter = new FHECounterPublicDecrypt();
        assertEq(getCoprocessorConfig(address(counter)).ACLAddress, ACL_ADDRESS, "the local stack");
        assertEq(counter.confidentialProtocolId(), type(uint256).max, "the local protocol id");
    }

    /// DEBUG profile: a constructor that MINTS works, and its handle carries the real chain id — what a
    /// chain-id flip around `new` could never have given.
    function test_debug_aConstructorThatMintsWorksUnderTheRealChainId() public {
        vm.skip(!forked || !debugBuild);
        fhevm.createSelectFork(cleartextChain("arbitrum"));

        MintsInConstructor dapp = new MintsInConstructor();
        assertEq(plaintextOf(dapp.seed()), 7);
        assertEq(uint64(uint256(euint64.unwrap(dapp.seed())) >> 16), 42161, "minted under 42161");
    }

    /// BOTH profiles: on a chain that HAS the protocol, the debug build resolves exactly what upstream
    /// resolves. The divergence is confined to chains upstream refuses.
    function test_onMainnetBothBuildsResolveTheRealAddresses() public {
        vm.skip(!mainnetToo);
        FhevmChain memory mainnet = getFhevmChain("mainnet", "mainnet");
        fhevm.createSelectFork(mainnet);

        FHECounterPublicDecrypt counter = new FHECounterPublicDecrypt();
        assertEq(getCoprocessorConfig(address(counter)).ACLAddress, mainnet.acl, "mainnet's ACL, from either build");
        assertEq(counter.confidentialProtocolId(), 1);
    }

    /// DEFAULT profile, the guard broken on purpose (rules.md 7.1): a debug-built dApp reached by direct import
    /// from a build that is NOT the debug profile reverts by name — forge is present, the profile is wrong.
    function test_default_aDebugBuiltDappRefusesAnyOtherProfile() public {
        vm.skip(debugBuild);
        vm.expectRevert(
            abi.encodeWithSelector(
                DebugConfig.DebugConfigOutsideDebugProfile.selector,
                vm.envOr("FOUNDRY_PROFILE", string("")),
                DebugConfig.FHEVM_DEBUG_CONFIG
            )
        );
        this.deployAlwaysDebugExternally();
    }

    /// BOTH profiles, both directions in every run: the marker is in a dApp's bytecode IF the debug config
    /// compiled it (always, by direct import), and ONLY IF (never, compiled against upstream by path); the
    /// profile-built counter then lands on whichever side the profile put it. What a CI step greps for.
    function test_theMarkerIsInTheBytecodeIffDebugBuild() public view {
        bytes memory marker = bytes(DebugConfig.FHEVM_DEBUG_CONFIG);
        assertTrue(_contains(type(AlwaysDebugDApp).creationCode, marker), "if: the debug config marks");
        assertFalse(_contains(type(AlwaysUpstreamDApp).creationCode, marker), "only if: upstream never does");
        bool present = _contains(type(FHECounterPublicDecrypt).creationCode, marker);
        assertEq(present, debugBuild, "and the profile decides which one the dApp under test got");
    }

    // -- helpers -----------------------------------------------------------------------------------------

    function deployCounterExternally() external returns (FHECounterPublicDecrypt c) {
        c = new FHECounterPublicDecrypt();
    }

    function deployAlwaysDebugExternally() external returns (AlwaysDebugDApp d) {
        d = new AlwaysDebugDApp();
    }

    function forkExternally(FhevmChain memory chain) external {
        fhevm.createSelectFork(chain);
    }

    function useStackExternally(FhevmChain memory chain) external {
        fhevm.useStack(chain);
    }

    function _contains(bytes memory hay, bytes memory needle) private pure returns (bool) {
        if (needle.length == 0 || hay.length < needle.length) return false;
        for (uint256 i = 0; i + needle.length <= hay.length; i++) {
            uint256 j;
            while (j < needle.length && hay[i + j] == needle[j]) j++;
            if (j == needle.length) return true;
        }
        return false;
    }
}
