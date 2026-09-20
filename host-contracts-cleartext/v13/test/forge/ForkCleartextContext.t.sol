// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {LibForgeFhevmContexts} from "../../pkg/forge/src/LibForgeFhevmContexts.sol";
import {LibForgeFhevmSigners} from "../../pkg/forge/src/LibForgeFhevmSigners.sol";
import {IInputVerifier} from "../../pkg/forge/src/_internal/interfaces/IInputVerifier.sol";
import {LibCleartextProbe} from "../../pkg/forge/src/shared/LibCleartextProbe.sol";
import {IKMSVerifier} from "../../pkg/forge/src/_internal/interfaces/IKMSVerifier.sol";
import {IProtocolConfig} from "../../pkg/forge/src/_internal/interfaces/IProtocolConfig.sol";
import {LocalHostBootstrap} from "../../pkg/forge/src/_internal/LocalHostBootstrap.sol";

/**
 * @notice Running cleartext tooling against a forked production host: make the fork register the
 *         signer sets this project can actually sign as — coprocessors on `InputVerifier`, KMS nodes
 *         on `ProtocolConfig`.
 *
 * @dev The suite is about the WIRING, not about any one chain, so it forks whichever of mainnet or
 *      Sepolia has an RPC configured and runs the same assertions against it. Both deployments are the
 *      contracts vendored in `pkg/src/contracts`, so the helper must work on either without knowing
 *      which one it got.
 *
 *          MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com forge test --match-contract ForkCleartext
 */
contract ForkCleartextContextTest is Test {
    address internal constant MAINNET_ACL = 0xcA2E8f1F656CD25C01F05d0b243Ab1ecd4a8ffb6;
    address internal constant MAINNET_INPUT_VERIFIER = 0xCe0FC2e05CFff1B719EFF7169f7D80Af770c8EA2;
    address internal constant MAINNET_KMS_VERIFIER = 0x77627828a55156b04Ac0DC0eb30467f1a552BB03;
    address internal constant MAINNET_PROTOCOL_CONFIG = 0xD8236B57394f90726b26aB25D38CeAC776E1a7C4;

    address internal constant SEPOLIA_ACL = 0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D;
    address internal constant SEPOLIA_INPUT_VERIFIER = 0xBBC1fFCdc7C316aAAd72E807D9b0272BE8F84DA0;
    address internal constant SEPOLIA_KMS_VERIFIER = 0xbE0E383937d564D7FF0BC3b46c51f0bF8d5C311A;

    /// @dev NOT mainnet's: the deployments are independent, which is why the helper takes it as an
    ///      argument instead of reading the local `protocolConfigAdd` constant.
    address internal constant SEPOLIA_PROTOCOL_CONFIG = 0x51f9AFBc89Ea792e1a21a12AB802ab58D4dbee83;

    address internal acl;
    address internal inputVerifier;
    address internal kmsVerifier;
    address internal protocolConfig;
    bool internal forked;

    function setUp() public {
        string memory mainnetRpc = vm.envOr("MAINNET_RPC_URL", string(""));
        string memory sepoliaRpc = vm.envOr("SEPOLIA_RPC_URL", string(""));

        if (bytes(mainnetRpc).length > 0) {
            vm.createSelectFork(mainnetRpc);
            (acl, inputVerifier) = (MAINNET_ACL, MAINNET_INPUT_VERIFIER);
            (kmsVerifier, protocolConfig) = (MAINNET_KMS_VERIFIER, MAINNET_PROTOCOL_CONFIG);
        } else if (bytes(sepoliaRpc).length > 0) {
            vm.createSelectFork(sepoliaRpc);
            (acl, inputVerifier) = (SEPOLIA_ACL, SEPOLIA_INPUT_VERIFIER);
            (kmsVerifier, protocolConfig) = (SEPOLIA_KMS_VERIFIER, SEPOLIA_PROTOCOL_CONFIG);
        } else {
            return;
        }
        forked = true;
    }

    modifier onlyForked() {
        vm.skip(!forked);
        _;
    }

    /// The premise. A production host registers signers nobody here holds a key for, so signing as
    /// them is impossible until the set is changed — which is the whole reason the helper exists.
    function test_theForkStartsWithSignersWeCannotSignAs() public onlyForked {
        assertFalse(
            LibForgeFhevmContexts.hasCleartextCoprocessorContext(inputVerifier),
            "a production host does not register the cleartext signers"
        );

        address[] memory real = IInputVerifier(inputVerifier).getCoprocessorSigners();
        vm.expectRevert(abi.encodeWithSelector(LibForgeFhevmSigners.UnknownCoprocessorSigner.selector, real[0]));
        this.coprocessorKeyForExternally(real[0]);
    }

    /// External so `vm.expectRevert` has a call frame to catch.
    function coprocessorKeyForExternally(address signer) external pure returns (uint256) {
        return LibForgeFhevmSigners.coprocessorKeyFor(signer);
    }

    /// THE WIRING. One call, pranking the ACL owner, and the forked verifier's registered context is
    /// the cleartext one — read back through the contract's own getters, which is what a prover asks.
    function test_theContextBecomesTheCleartextOne() public onlyForked {
        LibForgeFhevmContexts.defineCleartextCoprocessorContext(inputVerifier, acl);

        address[] memory expected = LocalHostBootstrap.coprocessorSigners();
        address[] memory actual = IInputVerifier(inputVerifier).getCoprocessorSigners();

        assertEq(actual.length, expected.length, "signer count");
        for (uint256 i = 0; i < expected.length; i++) {
            assertEq(actual[i], expected[i], "signer, in order");
        }
        assertEq(IInputVerifier(inputVerifier).getThreshold(), LocalHostBootstrap.COPROCESSOR_THRESHOLD, "threshold");

        assertTrue(LibForgeFhevmContexts.hasCleartextCoprocessorContext(inputVerifier), "and the helper agrees");
    }

    /// And the point of it: every registered signer is now one this project holds the key for, so a
    /// proof can be signed. That is the property the whole fork story rests on.
    function test_everyRegisteredSignerIsNowOneWeCanSignAs() public onlyForked {
        LibForgeFhevmContexts.defineCleartextCoprocessorContext(inputVerifier, acl);

        address[] memory signers = IInputVerifier(inputVerifier).getCoprocessorSigners();
        for (uint256 i = 0; i < signers.length; i++) {
            // Reverts unless the derived key really is this signer's — the guard inside is the check.
            uint256 key = LibForgeFhevmSigners.coprocessorKeyFor(signers[i]);
            assertEq(vm.addr(key), signers[i], "derived key matches the registered signer");
        }
    }

    /// The replacement is wholesale, not additive: no real signer survives it. A mixed set would let a
    /// proof pass for a reason the test did not intend.
    function test_theRealSignersAreGone() public onlyForked {
        address[] memory before = IInputVerifier(inputVerifier).getCoprocessorSigners();

        LibForgeFhevmContexts.defineCleartextCoprocessorContext(inputVerifier, acl);

        address[] memory after_ = IInputVerifier(inputVerifier).getCoprocessorSigners();
        for (uint256 i = 0; i < before.length; i++) {
            for (uint256 j = 0; j < after_.length; j++) {
                assertTrue(before[i] != after_[j], "no production signer is still registered");
            }
        }
    }

    /// It is the owner gate doing the work — the helper pranks it, and nothing else may.
    function test_withoutTheAclOwnerTheContextCannotBeDefined() public onlyForked {
        address[] memory signers = LibForgeFhevmContexts.cleartextCoprocessorSigners();
        uint256 threshold = LibForgeFhevmContexts.cleartextCoprocessorThreshold();

        vm.prank(makeAddr("not the owner"));
        vm.expectRevert();
        IInputVerifier(inputVerifier).defineNewContext(signers, threshold);

        assertFalse(LibForgeFhevmContexts.hasCleartextCoprocessorContext(inputVerifier), "unchanged");
    }

    /// The helper reads the owner off the chain rather than hardcoding it, so an ownership transfer
    /// upstream does not silently turn the wiring into a no-op.
    function test_theOwnerIsReadFromTheForkedAcl() public onlyForked {
        address owner = LibForgeFhevmContexts.aclOwner(acl);
        assertTrue(owner != address(0), "the ACL names an owner");

        vm.prank(owner);
        IInputVerifier(inputVerifier)
            .defineNewContext(
                LibForgeFhevmContexts.cleartextCoprocessorSigners(),
                LibForgeFhevmContexts.cleartextCoprocessorThreshold()
            );
        assertTrue(LibForgeFhevmContexts.hasCleartextCoprocessorContext(inputVerifier));
    }

    // ---------------------------------------------------------------------------------------------
    // The KMS half — a different contract, the same owner gate
    // ---------------------------------------------------------------------------------------------

    /// External so `vm.expectRevert` has a call frame to catch.
    function kmsNodeKeyForExternally(address signer) external pure returns (uint256) {
        return LibForgeFhevmSigners.kmsNodeKeyFor(signer);
    }

    /// The same premise on the KMS side: production KMS signers are signers we hold no key for.
    function test_theForkStartsWithKmsSignersWeCannotSignAs() public onlyForked {
        assertFalse(LibForgeFhevmContexts.hasCleartextKmsContext(kmsVerifier));

        address[] memory real = IKMSVerifier(kmsVerifier).getKmsSigners();
        vm.expectRevert(abi.encodeWithSelector(LibForgeFhevmSigners.UnknownKmsSigner.selector, real[0]));
        this.kmsNodeKeyForExternally(real[0]);
    }

    /// The wiring, read back through the VERIFIER — which forwards to `ProtocolConfig`, and that
    /// forwarding is exactly what could be wrong.
    function test_theKmsContextBecomesTheCleartextOne() public onlyForked {
        LibForgeFhevmContexts.defineCleartextKmsContext(protocolConfig, acl);

        address[] memory expected = LocalHostBootstrap.kmsSigners();
        address[] memory actual = IKMSVerifier(kmsVerifier).getKmsSigners();

        assertEq(actual.length, expected.length, "signer count");
        for (uint256 i = 0; i < expected.length; i++) {
            assertEq(actual[i], expected[i], "signer, in order");
        }
        assertEq(IKMSVerifier(kmsVerifier).getThreshold(), LocalHostBootstrap.KMS_NODE_COUNT, "threshold");
        assertTrue(LibForgeFhevmContexts.hasCleartextKmsContext(kmsVerifier), "and the helper agrees");
    }

    /// The node list the helper builds is the bootstrap's, field by field.
    function test_theKmsNodesAreTheBootstrapOnes() public onlyForked {
        IProtocolConfig.KmsNode[] memory nodes = LibForgeFhevmContexts.cleartextKmsNodes();

        assertEq(nodes.length, LocalHostBootstrap.KMS_NODE_COUNT);
        for (uint256 i = 0; i < nodes.length; i++) {
            assertEq(nodes[i].signerAddress, LocalHostBootstrap.kmsSigners()[i], "signer");
            assertEq(nodes[i].txSenderAddress, LocalHostBootstrap.kmsTxSenders()[i], "tx sender");
            assertTrue(nodes[i].txSenderAddress != nodes[i].signerAddress, "the two must differ");
        }
    }

    /// One call is enough because the new context is the current one.
    function test_theKmsContextIdAdvances() public onlyForked {
        uint256 before = IProtocolConfig(protocolConfig).getCurrentKmsContextId();

        LibForgeFhevmContexts.defineCleartextKmsContext(protocolConfig, acl);

        uint256 after_ = IProtocolConfig(protocolConfig).getCurrentKmsContextId();
        assertTrue(after_ != before, "a new context");
        assertEq(IKMSVerifier(kmsVerifier).getCurrentKmsContextId(), after_, "and the verifier sees it");
    }

    /// The consequence: a decryption proof can now be signed.
    function test_everyRegisteredKmsSignerIsNowOneWeCanSignAs() public onlyForked {
        LibForgeFhevmContexts.defineCleartextKmsContext(protocolConfig, acl);

        address[] memory signers = IKMSVerifier(kmsVerifier).getKmsSigners();
        for (uint256 i = 0; i < signers.length; i++) {
            uint256 key = LibForgeFhevmSigners.kmsNodeKey(i);
            assertEq(vm.addr(key), signers[i], "derived key matches the registered signer");
        }
    }

    /// The owner gate again, on the other contract.
    function test_withoutTheAclOwnerTheKmsContextCannotBeDefined() public onlyForked {
        vm.prank(makeAddr("not the owner"));
        vm.expectRevert();
        IProtocolConfig(protocolConfig)
            .defineNewKmsContext(
                LibForgeFhevmContexts.cleartextKmsNodes(), LibForgeFhevmContexts.cleartextKmsThresholds()
            );

        assertFalse(LibForgeFhevmContexts.hasCleartextKmsContext(kmsVerifier), "unchanged");
    }

    /// Both halves in one call, which is how a fork bootstrap would use it.
    function test_bothContextsAreSwappedTogether() public onlyForked {
        LibForgeFhevmContexts.defineCleartextContexts(inputVerifier, protocolConfig, acl);

        assertTrue(LibForgeFhevmContexts.hasCleartextCoprocessorContext(inputVerifier), "inputs");
        assertTrue(LibForgeFhevmContexts.hasCleartextKmsContext(kmsVerifier), "decryptions");
    }
}
