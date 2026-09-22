// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {FhevmCleartextDeploy} from "../../pkg/forge/src/FhevmCleartextDeploy.sol";
import {
    ACL_ADDRESS,
    CLEARTEXT_ARITHMETIC_ADDRESS,
    CLEARTEXT_DB_ADDRESS,
    DEPLOYER_ADDRESS,
    DEPLOYER_START_NONCE,
    FHEVM_EXECUTOR_ADDRESS,
    HCU_LIMIT_ADDRESS,
    INPUT_VERIFIER_ADDRESS,
    KMS_VERIFIER_ADDRESS,
    PAUSER_SET_ADDRESS
} from "../../pkg/forge/src/FhevmCleartextDeploy.sol";
import {ICleartextACL} from "../../pkg/forge/src/FhevmCleartextDeploy.sol";
import {ICleartextArithmetic} from "../../pkg/forge/src/FhevmCleartextDeploy.sol";
import {ICleartextDB} from "../../pkg/forge/src/FhevmCleartextDeploy.sol";
import {ICleartextFHEVMExecutor} from "../../pkg/forge/src/FhevmCleartextDeploy.sol";
import {ICleartextInputVerifier} from "../../pkg/forge/src/FhevmCleartextDeploy.sol";
import {ICleartextKMSVerifier} from "../../pkg/forge/src/FhevmCleartextDeploy.sol";
import {ICleartextHCULimit} from "../../pkg/forge/src/FhevmCleartextDeploy.sol";
import {IPauserSet} from "../../pkg/forge/src/FhevmCleartextDeploy.sol";
import {LocalHostBootstrap} from "../../pkg/forge/src/_internal/LocalHostBootstrap.sol";
import {LocalHostVersions} from "../../pkg/forge/src/_internal/LocalHostVersions.sol";
import {CleartextHandle} from "../../pkg/src/cleartext/CleartextHandle.sol";
import {FheType} from "../../pkg/src/contracts/shared/FheType.sol";
import {FHEVMExecutor as HostExecutor} from "../../pkg/src/contracts/FHEVMExecutor.sol";
import {FHEVMExecutor as OperatorsLib} from "../../pkg/forge/src/_internal/interfaces/ICleartextArithmetic.sol";

/**
 * The Foundry half of the suite: `FhevmCleartextDeploy` is the one artifact a TS test cannot exercise, because it
 * only runs inside forge. What it proves that `test/templates.test.ts` cannot is that the generated
 * `pkg/forge/` files actually stand up a working stack — the TS tests check those files are internally
 * consistent, not that they function.
 */
contract FhevmDeployTest is Test, FhevmCleartextDeploy {
    function setUp() public {
        deployLocalFhevm();
    }

    /// The address set is the product; a stack anywhere else is useless to a ZamaConfig consumer.
    function test_everyContractIsAtItsCanonicalAddress() public view {
        address[9] memory expected = [
            ACL_ADDRESS,
            FHEVM_EXECUTOR_ADDRESS,
            KMS_VERIFIER_ADDRESS,
            INPUT_VERIFIER_ADDRESS,
            HCU_LIMIT_ADDRESS,
            CLEARTEXT_ARITHMETIC_ADDRESS,
            CLEARTEXT_DB_ADDRESS,
            PAUSER_SET_ADDRESS,
            fhevmACLOwner()
        ];
        for (uint256 i = 0; i < expected.length; i++) {
            assertGt(expected[i].code.length, 0, "no code at a canonical address");
        }
    }

    /**
     * `getVersion()` is the only external evidence that the *real* implementation sits behind each proxy
     * rather than the empty one it was created over — phase 5 either ran or it did not.
     */
    function test_proxiesResolveToTheRealImplementations() public pure {
        assertEq(ICleartextACL(ACL_ADDRESS).getVersion(), LocalHostVersions.ACL);
        assertEq(ICleartextFHEVMExecutor(FHEVM_EXECUTOR_ADDRESS).getVersion(), LocalHostVersions.FHEVM_EXECUTOR);
        assertEq(ICleartextKMSVerifier(KMS_VERIFIER_ADDRESS).getVersion(), LocalHostVersions.KMS_VERIFIER);
        assertEq(ICleartextInputVerifier(INPUT_VERIFIER_ADDRESS).getVersion(), LocalHostVersions.INPUT_VERIFIER);
        assertEq(ICleartextHCULimit(HCU_LIMIT_ADDRESS).getVersion(), LocalHostVersions.HCU_LIMIT);
        assertEq(
            ICleartextArithmetic(CLEARTEXT_ARITHMETIC_ADDRESS).getVersion(), LocalHostVersions.CLEARTEXT_ARITHMETIC
        );
        assertEq(IPauserSet(PAUSER_SET_ADDRESS).getVersion(), LocalHostVersions.PAUSER_SET);
    }

    /**
     * Slots 0, 1 and 5 must be the Forge variants, not the plain contracts: `getVersion()` cannot tell them
     * apart, so `IS_FORGE` is the only evidence the in-process stack took the CLEARTEXT_FORGE_* blobs
     * rather than the ones `DeployLocalStack.s.sol` broadcasts.
     */
    function test_forgeVariantsSitBehindTheirProxies() public pure {
        assertTrue(IForgeMarker(ACL_ADDRESS).IS_FORGE(), "ACL proxy must sit over CleartextForgeACL");
        assertTrue(IForgeMarker(FHEVM_EXECUTOR_ADDRESS).IS_FORGE(), "executor proxy must sit over the Forge variant");
        assertTrue(
            IForgeMarker(CLEARTEXT_ARITHMETIC_ADDRESS).IS_FORGE(), "arithmetic proxy must sit over the Forge variant"
        );
        // Without this the in-process stack could fall back to `CleartextHCULimit` and silently lose the
        // meter, which is the only reason the Forge variant exists.
        assertTrue(IForgeMarker(HCU_LIMIT_ADDRESS).IS_FORGE(), "HCU limit proxy must sit over the Forge variant");
    }

    /**
     * Every cleartext substitution advertises itself, so a consumer can tell this stack from a real one —
     * and the list is EXHAUSTIVE on purpose. A per-contract list of assertions cannot notice a proxy that
     * was added later and never marked; this walks every proxy the stack materializes and demands the
     * marker from each. A new role must be added here, and a role that loses its cleartext implementation
     * fails at the address that lost it.
     *
     * This generation has no exemptions: every proxy it materializes has a cleartext variant. (V13 adds
     * `ProtocolConfig` and `KMSGeneration`, vendored contracts with none, and carries a named exemption
     * list for them.) `PauserSet` and `ACLOwner` are not proxies, so they are outside this sweep.
     */
    function test_everyProxyAdvertisesTheCleartextMarker() public view {
        address[7] memory proxies = [
            ACL_ADDRESS,
            FHEVM_EXECUTOR_ADDRESS,
            KMS_VERIFIER_ADDRESS,
            INPUT_VERIFIER_ADDRESS,
            HCU_LIMIT_ADDRESS,
            CLEARTEXT_ARITHMETIC_ADDRESS,
            CLEARTEXT_DB_ADDRESS
        ];

        for (uint256 i = 0; i < proxies.length; i++) {
            (bool answered, bytes memory ret) =
                proxies[i].staticcall(abi.encodeWithSelector(IForgeMarker.IS_CLEARTEXT.selector));
            bool marked = answered && ret.length == 32 && abi.decode(ret, (bool));
            assertTrue(marked, string.concat("proxy is not a cleartext implementation: ", vm.toString(proxies[i])));
        }
    }

    /// The generation, where a consumer looks for it: the ACL every `ZamaConfig` already holds. It is the one
    /// contract that carries it — the other substitutions answer `IS_CLEARTEXT` and nothing more.
    function test_theCleartextGenerationIsTwelve() public pure {
        assertEq(IForgeMarker(ACL_ADDRESS).CLEARTEXT_PROTOCOL_VERSION(), 12, "acl");
    }

    /**
     * The forge ACL rejects a handle minted on another chain before the base ACL gets to see it. The
     * fixture handles are otherwise unallowed, so the plain `SenderNotAllowed` on the matching one is
     * the proof that the chain id check let it through and only the base logic stopped it.
     */
    function test_forgeAclRejectsHandlesFromAnotherChain() public {
        uint64 here = uint64(block.chainid);
        bytes32 foreign = _handleWithChainId(here + 1);
        bytes32 local = _handleWithChainId(here);

        vm.expectRevert(
            abi.encodeWithSelector(
                CleartextHandle.CleartextErrorHandleChainIdMismatch.selector, foreign, here + 1, here
            )
        );
        ICleartextACL(ACL_ADDRESS).allow(foreign, address(this));

        vm.expectRevert(abi.encodeWithSelector(ICleartextACL.SenderNotAllowed.selector, address(this)));
        ICleartextACL(ACL_ADDRESS).allow(local, address(this));

        vm.expectRevert(
            abi.encodeWithSelector(
                CleartextHandle.CleartextErrorHandleChainIdMismatch.selector, foreign, here + 1, here
            )
        );
        ICleartextACL(ACL_ADDRESS).allowTransient(foreign, address(this));

        bytes32[] memory list = new bytes32[](2);
        list[0] = local;
        list[1] = foreign;
        vm.expectRevert(
            abi.encodeWithSelector(
                CleartextHandle.CleartextErrorHandleChainIdMismatch.selector, foreign, here + 1, here
            )
        );
        ICleartextACL(ACL_ADDRESS).allowForDecryption(list);

        // Read paths reject the foreign handle too, and answer normally for the local one.
        bytes memory mismatch = abi.encodeWithSelector(
            CleartextHandle.CleartextErrorHandleChainIdMismatch.selector, foreign, here + 1, here
        );
        vm.expectRevert(mismatch);
        ICleartextACL(ACL_ADDRESS).isAllowed(foreign, address(this));
        vm.expectRevert(mismatch);
        ICleartextACL(ACL_ADDRESS).allowedTransient(foreign, address(this));
        vm.expectRevert(mismatch);
        ICleartextACL(ACL_ADDRESS).persistAllowed(foreign, address(this));
        vm.expectRevert(mismatch);
        ICleartextACL(ACL_ADDRESS).isAllowedForDecryption(foreign);
        vm.expectRevert(mismatch);
        ICleartextACL(ACL_ADDRESS).isHandleDelegatedForUserDecryption(address(this), address(1), address(2), foreign);
        assertFalse(ICleartextACL(ACL_ADDRESS).isAllowed(local, address(this)));
        assertFalse(ICleartextACL(ACL_ADDRESS).isAllowedForDecryption(local));
    }

    /// The arithmetic mirror refuses to record under a handle from another chain, on every entry point.
    function test_cleartextArithmeticRejectsHandlesFromAnotherChain() public {
        uint64 here = uint64(block.chainid);
        bytes32 foreign = _handleWithChainId(here + 1);
        bytes32 local = _handleWithChainId(here);
        bytes memory mismatch = abi.encodeWithSelector(
            CleartextHandle.CleartextErrorHandleChainIdMismatch.selector, foreign, here + 1, here
        );
        ICleartextArithmetic arithmetic = ICleartextArithmetic(CLEARTEXT_ARITHMETIC_ADDRESS);

        vm.expectRevert(mismatch);
        arithmetic.recordTrivialEncrypt(foreign, 1, FheType.Uint8);
        vm.expectRevert(mismatch);
        arithmetic.recordCast(local, foreign, FheType.Uint8);
        vm.expectRevert(mismatch);
        arithmetic.recordUnaryOp(_op(HostExecutor.Operators.fheNeg), local, foreign, FheType.Uint8);
        vm.expectRevert(mismatch);
        arithmetic.recordTernaryOp(_op(HostExecutor.Operators.fheIfThenElse), local, local, local, foreign);
        // A scalar rhs is a plaintext and must not be mistaken for a foreign handle.
        vm.expectRevert(mismatch);
        arithmetic.recordBinaryOp(_op(HostExecutor.Operators.fheAdd), local, foreign, foreign, 0x01, FheType.Uint8);
        vm.expectRevert(mismatch);
        arithmetic.recordBinaryOp(_op(HostExecutor.Operators.fheAdd), local, local, foreign, 0x00, FheType.Uint8);
    }

    /// The generated interface types operators as a bare `uint8` wrapper; bridge from the real enum.
    function _op(HostExecutor.Operators op) private pure returns (OperatorsLib.Operators) {
        return OperatorsLib.Operators.wrap(uint8(op));
    }

    /// A handle shaped like `FHEVMExecutor._appendMetadataToPrehandle` output, with the given chain id.
    function _handleWithChainId(uint64 chainId) private pure returns (bytes32 result) {
        result = keccak256("fixture") & 0xffffffffffffffffffffffffffffffffffffffffff0000000000000000000000;
        result = result | (bytes32(uint256(0xff)) << 80);
        result = result | (bytes32(uint256(chainId)) << 16);
        result = result | (bytes32(uint256(2)) << 8); // type byte 30: any FheType will do
        // version byte 31 stays 0
    }

    /**
     * The addresses compiled into the bytecode must match the addresses the stack was deployed at. They
     * are baked in, so a mismatch is unfixable at runtime and invisible without reading them back.
     */
    function test_bakedInWiringMatchesTheDeployedStack() public view {
        assertEq(ICleartextACL(ACL_ADDRESS).getFHEVMExecutorAddress(), FHEVM_EXECUTOR_ADDRESS);
        assertEq(ICleartextACL(ACL_ADDRESS).getPauserSetAddress(), PAUSER_SET_ADDRESS);
        assertEq(ICleartextFHEVMExecutor(FHEVM_EXECUTOR_ADDRESS).getACLAddress(), ACL_ADDRESS);
        assertEq(ICleartextFHEVMExecutor(FHEVM_EXECUTOR_ADDRESS).getHCULimitAddress(), HCU_LIMIT_ADDRESS);
        assertEq(ICleartextFHEVMExecutor(FHEVM_EXECUTOR_ADDRESS).getInputVerifierAddress(), INPUT_VERIFIER_ADDRESS);
        assertEq(ICleartextHCULimit(HCU_LIMIT_ADDRESS).getFHEVMExecutorAddress(), FHEVM_EXECUTOR_ADDRESS);
    }

    /// Phase 3: ACLOwner holds ACL ownership and is a registered pauser, in that order.
    function test_aclOwnerHoldsOwnershipAndCanPause() public {
        assertEq(ICleartextACL(ACL_ADDRESS).owner(), fhevmACLOwner(), "ACLOwner must own ACL");
        assertTrue(IPauserSet(PAUSER_SET_ADDRESS).isPauser(fhevmACLOwner()), "ACLOwner must be a pauser");

        assertFalse(ICleartextACL(ACL_ADDRESS).paused());
        vm.prank(DEPLOYER_ADDRESS);
        IACLOwnerPause(fhevmACLOwner()).pause();
        assertTrue(ICleartextACL(ACL_ADDRESS).paused(), "pausing through ACLOwner must reach ACL");
    }

    /// Phase 5 pointed CleartextDB at the arithmetic contract.
    function test_initializersRanWithTheirArguments() public view {
        assertTrue(ICleartextDB(CLEARTEXT_DB_ADDRESS).isWriter(CLEARTEXT_ARITHMETIC_ADDRESS), "DB writer");
        assertFalse(ICleartextDB(CLEARTEXT_DB_ADDRESS).isWriter(FHEVM_EXECUTOR_ADDRESS), "executor is not a writer");
    }

    /**
     * The signer sets are the contract between this deploy and the js-sdk cleartext relayer: the relayer
     * derives its keys from FHEVM_MNEMONIC at fixed HD paths and looks them up by the address the chain
     * reports. Register anything else and it holds no key for the signer it is asked to be, so decrypt
     * fails at signing time rather than at deploy time.
     */
    function test_registeredSignersAreTheOnesTheSdkCanSignFor() public view {
        address[] memory expectedCoprocessors = LocalHostBootstrap.coprocessorSigners();
        address[] memory onChainCoprocessors = ICleartextInputVerifier(INPUT_VERIFIER_ADDRESS).getCoprocessorSigners();
        assertEq(onChainCoprocessors.length, expectedCoprocessors.length, "coprocessor signer count");
        for (uint256 i = 0; i < expectedCoprocessors.length; i++) {
            assertEq(onChainCoprocessors[i], expectedCoprocessors[i], "coprocessor signer");
        }
        assertEq(
            ICleartextInputVerifier(INPUT_VERIFIER_ADDRESS).getThreshold(),
            LocalHostBootstrap.COPROCESSOR_THRESHOLD,
            "coprocessor threshold"
        );

        address[] memory expectedKms = LocalHostBootstrap.kmsSigners();
        address[] memory onChainKms = ICleartextKMSVerifier(KMS_VERIFIER_ADDRESS).getKmsSigners();
        assertEq(onChainKms.length, expectedKms.length, "kms signer count");
        for (uint256 i = 0; i < expectedKms.length; i++) {
            assertEq(onChainKms[i], expectedKms[i], "kms signer");
        }
    }

    /**
     * The EIP-712 domain each proof is signed against. Bound at initialization and unreadable from the
     * initializer arguments afterwards, so `eip712Domain()` is the only way to confirm the deploy used the
     * values the SDK builds its typed data from — a mismatch makes every signature verify against the
     * wrong domain and fail for reasons that look nothing like a config error.
     */
    function test_eip712DomainsMatchTheBootstrapSources() public view {
        (,,, uint256 kmsChainId, address kmsVerifyingContract,,) =
            ICleartextKMSVerifier(KMS_VERIFIER_ADDRESS).eip712Domain();
        assertEq(kmsChainId, LocalHostBootstrap.GATEWAY_CHAIN_ID, "kms verifier chain id");
        assertEq(kmsVerifyingContract, LocalHostBootstrap.DECRYPTION_ADDRESS, "kms verifier verifyingContract");

        (,,, uint256 inputChainId, address inputVerifyingContract,,) =
            ICleartextInputVerifier(INPUT_VERIFIER_ADDRESS).eip712Domain();
        assertEq(inputChainId, LocalHostBootstrap.GATEWAY_CHAIN_ID, "input verifier chain id");
        assertEq(
            inputVerifyingContract, LocalHostBootstrap.INPUT_VERIFICATION_ADDRESS, "input verifier verifyingContract"
        );
    }

    /// No KMS *context* test in this generation: the KMSVerifier stores only the signer set and one
    /// threshold, so there is no on-chain node metadata (tx-sender/ip/storage) to check. 0.13 introduces
    /// ProtocolConfig and records all of it, which is why the v12->v13 migration has to be told the node
    /// details rather than reading them off the running stack.

    /// One KMS threshold, on the verifier itself. 0.13 splits it into four on ProtocolConfig.
    function test_kmsThresholdMatchesTheNodeCount() public view {
        assertEq(
            ICleartextKMSVerifier(KMS_VERIFIER_ADDRESS).getThreshold(),
            LocalHostBootstrap.KMS_NODE_COUNT,
            "kms threshold"
        );
    }

    /// The HCU limits. There is no override path: the bootstrap values are the only ones.
    function test_defaultHcuLimitsAreTheBootstrapValues() public view {
        ICleartextHCULimit limit = ICleartextHCULimit(HCU_LIMIT_ADDRESS);
        assertEq(limit.getGlobalHCUCapPerBlock(), LocalHostBootstrap.HCU_CAP_PER_BLOCK, "cap per block");
        assertEq(limit.getMaxHCUDepthPerTx(), LocalHostBootstrap.MAX_HCU_DEPTH_PER_TX, "max depth per tx");
        assertEq(limit.getMaxHCUPerTx(), LocalHostBootstrap.MAX_HCU_PER_TX, "max HCU per tx");
    }

    /// Callable from several `setUp()` bodies without redeploying.
    function test_deployIsIdempotent() public {
        address ownerBefore = fhevmACLOwner();
        deployLocalFhevm();
        assertEq(fhevmACLOwner(), ownerBefore, "a second call must not redeploy");
    }
}

/**
 * There is deliberately no "configured" variant. Every bootstrap argument is `private`, so this contract
 * produces exactly one stack — see the note in FhevmCleartextDeploy about why a configurable one would be a
 * liability rather than a feature.
 */

/// The determinism guard: every address derives from the deployer's nonce, so a dirty one must abort.
contract FhevmDeployGuardTest is Test, FhevmCleartextDeploy {
    function test_refusesToDeployFromADirtyNonce() public {
        vm.setNonce(DEPLOYER_ADDRESS, uint64(DEPLOYER_START_NONCE + 3));
        vm.expectRevert(
            bytes("FhevmCleartextDeploy: deployer nonce must be DEPLOYER_START_NONCE; every address derives from it")
        );
        this.callDeployFhevm();
    }

    /// External so `vm.expectRevert` sees a call boundary.
    function callDeployFhevm() external {
        deployLocalFhevm();
    }
}

/// `ACLOwner.pause()` is not on the generated interface (it is inherited); declare the one selector used.
interface IACLOwnerPause {
    function pause() external;
}

/// `IS_FORGE()` is not on any generated interface (those come from the plain contracts); declare it here.
/// Likewise `IS_CLEARTEXT()` for the ACL, whose generated `ICleartextACL` comes from the plain contract.
interface IForgeMarker {
    function IS_FORGE() external pure returns (bool);
    function IS_CLEARTEXT() external pure returns (bool);
    function CLEARTEXT_PROTOCOL_VERSION() external pure returns (uint256);
}
