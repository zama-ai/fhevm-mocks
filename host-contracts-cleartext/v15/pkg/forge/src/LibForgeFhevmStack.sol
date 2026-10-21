// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {IForgeVm, FORGE_VM_ADDRESS} from "./IForgeVm.sol";
import {FheType} from "./shared/LibFheType.sol";

import {
    ACL_ADDRESS,
    CLEARTEXT_ARITHMETIC_ADDRESS,
    CLEARTEXT_DB_ADDRESS,
    DEPLOYER_ADDRESS,
    DEPLOYER_START_NONCE,
    PROXY_COUNT,
    FHEVM_EXECUTOR_ADDRESS,
    HCU_LIMIT_ADDRESS,
    INPUT_VERIFIER_ADDRESS,
    KMS_GENERATION_ADDRESS,
    KMS_VERIFIER_ADDRESS,
    MNEMONIC,
    PAUSER_SET_ADDRESS,
    PROTOCOL_CONFIG_ADDRESS
} from "./_internal/LocalHostAddresses.sol";

import {
    ACL_OWNER_CREATION_CODE,
    CLEARTEXT_DB_CREATION_CODE,
    CLEARTEXT_FORGE_ACL_CREATION_CODE,
    CLEARTEXT_FORGE_ARITHMETIC_CREATION_CODE,
    CLEARTEXT_FORGE_FHEVM_EXECUTOR_CREATION_CODE,
    CLEARTEXT_INPUT_VERIFIER_CREATION_CODE,
    CLEARTEXT_KMS_VERIFIER_CREATION_CODE,
    EMPTY_UUPS_PROXY_ACL_CREATION_CODE,
    EMPTY_UUPS_PROXY_CREATION_CODE,
    ERC1967_PROXY_CREATION_CODE,
    CLEARTEXT_FORGE_HCU_LIMIT_CREATION_CODE,
    KMS_GENERATION_CREATION_CODE,
    PAUSER_SET_RUNTIME_CODE,
    PROTOCOL_CONFIG_CREATION_CODE
} from "./_internal/LocalHostBytecode.sol";

import {LocalHostBootstrap} from "./_internal/LocalHostBootstrap.sol";

import {ICleartextACL} from "./_internal/interfaces/ICleartextACL.sol";
import {ACLOwner, IACLOwner} from "./_internal/interfaces/IACLOwner.sol";
import {ICleartextArithmetic} from "./_internal/interfaces/ICleartextArithmetic.sol";
import {ICleartextDB} from "./_internal/interfaces/ICleartextDB.sol";
import {ICleartextFHEVMExecutor} from "./_internal/interfaces/ICleartextFHEVMExecutor.sol";
import {ICleartextInputVerifier} from "./_internal/interfaces/ICleartextInputVerifier.sol";
import {ICleartextKMSVerifier} from "./_internal/interfaces/ICleartextKMSVerifier.sol";
import {IEmptyUUPSProxy} from "./_internal/interfaces/IEmptyUUPSProxy.sol";
import {IEmptyUUPSProxyACL} from "./_internal/interfaces/IEmptyUUPSProxyACL.sol";
import {ICleartextHCULimit} from "./_internal/interfaces/ICleartextHCULimit.sol";
import {IKMSGeneration} from "./_internal/interfaces/IKMSGeneration.sol";
import {IPauserSet} from "./_internal/interfaces/IPauserSet.sol";
import {IACL} from "./_internal/interfaces/IACL.sol";
import {IInputVerifier} from "./_internal/interfaces/IInputVerifier.sol";
import {IKMSVerifier} from "./_internal/interfaces/IKMSVerifier.sol";
import {
    IProtocolConfig,
    IKMSGeneration as IProtocolConfigKMSGeneration
} from "./_internal/interfaces/IProtocolConfig.sol";
import {LibForgeFhevmSigners} from "./LibForgeFhevmSigners.sol";

/**
 * @title  LibForgeFhevmStack
 * @notice THE ONE STACK this package can produce, and the signer sets that make it ours: deploy it at the
 *         canonical localhost addresses, or register the same signers on a stack someone else deployed.
 *
 * @dev WHY BOTH HALVES ARE ONE LIBRARY. They are the same values applied two ways. `LocalHostBootstrap`
 *      derives the coprocessor and KMS signer sets from the mnemonic; the deploy installs them when it
 *      creates the stack, and `defineCleartextContexts` re-registers them on a FORKED production stack so
 *      the proofs this package builds are accepted there too. Split across two files they each rebuilt the
 *      KMS node list from the same four bootstrap arrays, which is the drift rule 2.6 was written after.
 *
 * @dev WHY A LIBRARY AND A CONTRACT. `ForgeFhevmDeploy` is the same deploy for a caller that can INHERIT:
 *      a test writes `is ForgeFhevmDeploy` and calls `deployLocalFhevm()`, and that stays the shape a
 *      consumer is shown. But inheritance is not always available — `FhevmVm` is etched at a fixed address
 *      and cannot take the deploy's storage, a library cannot inherit at all, and neither can a script that
 *      already extends something else. This file is the logic; the contract is a thin face over it that
 *      adds one thing a library cannot have: a cached `fhevmACLOwner()`.
 *
 *      Everything here is `internal`, so it inlines into the caller and the whole sequence runs in the
 *      caller's own context — which matters: forge grants cheatcodes to the test and to what it CREATES,
 *      and the stack's forge variants call cheatcodes, so they must be created by a frame that has them.
 *
 * ## Why the sequence looks the way it does
 *
 * This is a transcription of the TypeScript `deploy()` in `ts/deploy.ts`, not a shortcut around it. Every
 * address is `CREATE(deployer, nonce)`, so the stack only lands on the addresses in
 * `LocalHostAddresses.sol` — the ones `ZamaConfig.sol` compiles into consumers — if these transactions
 * happen in exactly this order from exactly that account starting at exactly that nonce. Deploying
 * "equivalently" in a different order produces a stack whose bytecode points at the wrong places, and the
 * bytecode here is pre-compiled against those addresses so it cannot adapt.
 *
 * Every creation is therefore checked against its expected address rather than trusted, and every member
 * except `deployLocalFhevm()`, `aclOwner()` and `mnemonic()` is `private` — including the bootstrap
 * arguments. That is deliberate rather than restrictive: the signer sets in particular are the contract
 * with the js-sdk cleartext relayer, which derives its keys from FHEVM_MNEMONIC at fixed HD paths and looks
 * them up by the address the chain reports. A configurable stack is a stack that can be configured into one
 * the SDK holds no key for, so there is exactly one stack this library can produce, and it is the one
 * everything else expects.
 *
 * To deploy something else, change `LocalHostBootstrap` (generated) and regenerate — not this file.
 *
 * @dev THE REVERT STRINGS SAY `ForgeFhevmDeploy:` on purpose: they name the API a user called, which is
 *      the contract, not the file the code happens to live in.
 *
 * The five phases, mirroring `ts/deploy.ts`:
 *   1. the empty proxies (nonces 0-10), each an ERC-1967 proxy over an empty UUPS implementation
 *   2. PauserSet (nonce 11)
 *   3. ACLOwner, registered as a pauser and handed ACL ownership two-step
 *   4. the real implementations, deployed permissionlessly
 *   5. one atomic `ACLOwner.upgrade` swapping every proxy empty -> real and running its initializer
 */
/// @notice The forge-only arithmetic's answer for handles its store never saw.
/// @dev Declared here rather than in `_internal/interfaces/`: those are generated from the DEPLOYED
///      contracts, and the plain `CleartextArithmetic` has none of these.
interface ICleartextForgeArithmeticPolicy {
    function setUnknownHandleDefault(uint8 fheType, uint256 value) external;
    function setUnknownHandleFromHandle(uint8 fheType) external;
    function clearUnknownHandlePolicy(uint8 fheType) external;
    function getCleartextDBAddress() external view returns (address);
}

library LibForgeFhevmStack {
    /// @dev The cheatcode address, bound here because a library cannot inherit `ForgeVmBase`.
    IForgeVm private constant fvm = IForgeVm(FORGE_VM_ADDRESS);

    /// @dev ERC-1967 implementation slot: keccak256("eip1967.proxy.implementation") - 1.
    bytes32 private constant _ERC1967_IMPL_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    /// @dev Account that owns the ACLOwner and may therefore upgrade the stack.
    function _fhevmAdmin() private pure returns (address) {
        return DEPLOYER_ADDRESS;
    }

    /**
     * @dev Bootstrap arguments for the initializers that take them, mirroring
     *      `DEFAULT_BOOTSTRAP_CONFIG` via the generated `LocalHostBootstrap`.
     */
    function _fhevmKmsVerifierConfig() private pure returns (address verifyingContract, uint64 chainId) {
        return (LocalHostBootstrap.DECRYPTION_ADDRESS, LocalHostBootstrap.GATEWAY_CHAIN_ID);
    }

    function _fhevmInputVerifierConfig()
        private
        pure
        returns (address verifyingContract, uint64 chainId, address[] memory signers, uint256 threshold)
    {
        return (
            LocalHostBootstrap.INPUT_VERIFICATION_ADDRESS,
            LocalHostBootstrap.GATEWAY_CHAIN_ID,
            cleartextCoprocessorSigners(),
            cleartextCoprocessorThreshold()
        );
    }

    function _fhevmHcuLimitConfig() private pure returns (uint48 capPerBlock, uint48 maxDepthPerTx, uint48 maxPerTx) {
        return (
            LocalHostBootstrap.HCU_CAP_PER_BLOCK,
            LocalHostBootstrap.MAX_HCU_DEPTH_PER_TX,
            LocalHostBootstrap.MAX_HCU_PER_TX
        );
    }

    /// @dev The initial KMS context seeded into ProtocolConfig: `KmsNodeParams`, the wider struct v14's
    ///      initializers take, not the `KmsNode` its getters return.
    function _fhevmProtocolConfig()
        private
        pure
        returns (IProtocolConfig.KmsNodeParams[] memory nodes, IProtocolConfig.KmsThresholds memory thresholds)
    {
        return (cleartextKmsNodes(), cleartextKmsThresholds());
    }

    ////////////////////////////////////////////////////////////////////////////
    // Entry point
    ////////////////////////////////////////////////////////////////////////////

    /**
     * @notice The mnemonic the stack is **deployed** from — the deployer and admin accounts.
     * @dev Not the signer mnemonic. The KMS and coprocessor signing keys the js-sdk relayer uses come
     *      from FHEVM_MNEMONIC ("test test test ...") at m/44'/60'/0'/{2,3,4}/i; this one only funds and
     *      signs the deploy. Two mnemonics, two jobs — swapping them gives a stack whose addresses look
     *      right and whose signatures never verify.
     */
    function mnemonic() internal pure returns (string memory) {
        return MNEMONIC;
    }

    /**
     * @notice The standing ACLOwner: owner of ACL, and the only account that can upgrade the stack.
     *
     * @dev READ FROM THE CHAIN, because a library holds no state. `ACL.owner()` is the ACLOwner phase 3
     *      installed, and stays so across an upgrade — `updateV13ToV14` takes the standing one as a
     *      parameter and deploys none — which is exactly why this was never a generated constant. It is
     *      also the only answer that can be right on a FORK the caller did not deploy, and the one
     *      `generateGenesis.ts` uses. A caller that moves ACL ownership afterwards is asking a different
     *      question and gets the honest answer.
     *
     *      Reverts rather than returning zero before the stack exists — a zero here would otherwise
     *      surface much later as a call into an empty address.
     */
    function aclOwner() internal view returns (address) {
        require(ACL_ADDRESS.code.length != 0, "ForgeFhevmDeploy: call deployLocalFhevm() before fhevmACLOwner()");
        return ICleartextACL(ACL_ADDRESS).owner();
    }

    /// @notice Deploys the stack if it is absent, and returns the standing ACLOwner either way.
    function deployLocalFhevm() internal returns (address aclOwner_) {
        // Idempotent by PRESENCE, not by a flag: the same caller may have to deploy on several forks
        // (a fresh anvil behind each), and a flag set by the first deploy would refuse every later one.
        if (ACL_ADDRESS.code.length != 0) return aclOwner();

        require(
            fvm.getNonce(DEPLOYER_ADDRESS) == DEPLOYER_START_NONCE,
            "ForgeFhevmDeploy: deployer nonce must be DEPLOYER_START_NONCE; every address derives from it"
        );

        fvm.startPrank(DEPLOYER_ADDRESS);
        _deployEmptyProxies();
        _deployPauserSet();
        fvm.stopPrank();

        aclOwner_ = _setupACLOwner();
        address[] memory implementations = _deployImplementations();
        _materialize(implementations, aclOwner_);
    }

    ////////////////////////////////////////////////////////////////////////////
    // Phase 1 — the empty proxies (nonces 0-10)
    ////////////////////////////////////////////////////////////////////////////

    /**
     * @dev Sealed: these eleven creations are what place the stack at the canonical addresses, so there is
     *      no override of this that keeps the guarantee. Change the address set instead, by regenerating
     *      LocalHostAddresses.sol and LocalHostBytecode.sol together.
     *
     *      ACL is special: its proxy sits over `EmptyUUPSProxyACL`, whose `initialize` takes the initial
     *      owner. Every other proxy shares one `EmptyUUPSProxy` implementation, deployed once at nonce 2.
     */
    function _deployEmptyProxies() private {
        address emptyACLImpl = _create(EMPTY_UUPS_PROXY_ACL_CREATION_CODE, "EmptyUUPSProxyACL");
        _createProxy(
            emptyACLImpl, abi.encodeCall(IEmptyUUPSProxyACL.initialize, (DEPLOYER_ADDRESS)), ACL_ADDRESS, "ACL proxy"
        );

        address emptyImpl = _create(EMPTY_UUPS_PROXY_CREATION_CODE, "EmptyUUPSProxy");
        bytes memory initEmpty = abi.encodeCall(IEmptyUUPSProxy.initialize, ());

        _createProxy(emptyImpl, initEmpty, FHEVM_EXECUTOR_ADDRESS, "FHEVMExecutor proxy");
        _createProxy(emptyImpl, initEmpty, KMS_VERIFIER_ADDRESS, "KMSVerifier proxy");
        _createProxy(emptyImpl, initEmpty, INPUT_VERIFIER_ADDRESS, "InputVerifier proxy");
        _createProxy(emptyImpl, initEmpty, HCU_LIMIT_ADDRESS, "HCULimit proxy");
        _createProxy(emptyImpl, initEmpty, PROTOCOL_CONFIG_ADDRESS, "ProtocolConfig proxy");
        _createProxy(emptyImpl, initEmpty, KMS_GENERATION_ADDRESS, "KMSGeneration proxy");
        _createProxy(emptyImpl, initEmpty, CLEARTEXT_ARITHMETIC_ADDRESS, "CleartextArithmetic proxy");
        _createProxy(emptyImpl, initEmpty, CLEARTEXT_DB_ADDRESS, "CleartextDB proxy");
    }

    ////////////////////////////////////////////////////////////////////////////
    // Phase 2 — PauserSet (nonce 11)
    ////////////////////////////////////////////////////////////////////////////

    /**
     * @dev PauserSet has no constructor and no immutables, so its runtime blob is complete and etching it
     *      is equivalent to constructing it. The nonce is still consumed so the address matches: `fvm.etch`
     *      does not advance it, hence the explicit bump.
     */
    function _deployPauserSet() private {
        fvm.etch(PAUSER_SET_ADDRESS, PAUSER_SET_RUNTIME_CODE);
        fvm.setNonce(DEPLOYER_ADDRESS, uint64(fvm.getNonce(DEPLOYER_ADDRESS) + 1));
    }

    ////////////////////////////////////////////////////////////////////////////
    // Phase 3 — ACLOwner takes ownership of ACL
    ////////////////////////////////////////////////////////////////////////////

    /**
     * @dev Order is load-bearing: `PauserSet.addPauser` is `onlyACLOwner`, so ACLOwner must be registered
     *      as a pauser while the deployer still owns ACL. Ownership then moves two-step — the deployer
     *      offers, and the admin accepts through ACLOwner.
     */
    function _setupACLOwner() private returns (address aclOwner_) {
        fvm.startPrank(DEPLOYER_ADDRESS);
        aclOwner_ =
            _create(abi.encodePacked(ACL_OWNER_CREATION_CODE, abi.encode(_fhevmAdmin(), ACL_ADDRESS)), "ACLOwner");
        IPauserSet(PAUSER_SET_ADDRESS).addPauser(aclOwner_);
        ICleartextACL(ACL_ADDRESS).transferOwnership(aclOwner_);
        fvm.stopPrank();

        fvm.prank(_fhevmAdmin());
        IACLOwner(aclOwner_).acceptACLOwnership();
    }

    ////////////////////////////////////////////////////////////////////////////
    // Phase 4 — the real implementations
    ////////////////////////////////////////////////////////////////////////////

    /**
     * @dev Permissionless, and their addresses are never referenced, so no determinism is required here.
     *
     *      Slots 0, 1 and 7 take the CLEARTEXT_FORGE_* blobs, which `DeployLocalStack.s.sol` deliberately
     *      does NOT — the two files are otherwise twins, so the divergence is the point rather than an
     *      oversight. The executor and arithmetic variants call cheatcodes (pauseGasMetering, randomUint),
     *      and forge grants cheatcodes only to contracts it created during the test. This contract runs
     *      in-process and creates the whole stack, so its contracts qualify; DeployLocalStack broadcasts
     *      to a node, where 0x7109...dD12D has no code and every FHE operation would revert instead.
     *      The ACL variant is the hook for forge-only checks and follows the same rule.
     *
     *      Bytecode only: `CREATE(deployer, nonce)` puts these at the same addresses either way, so
     *      the layout RULES.md rules 15 and 17 pin is untouched.
     */
    function _deployImplementations() private returns (address[] memory implementations) {
        implementations = new address[](PROXY_COUNT);
        implementations[0] = _create(CLEARTEXT_FORGE_ACL_CREATION_CODE, "ACL impl (forge)");
        implementations[1] = _create(CLEARTEXT_FORGE_FHEVM_EXECUTOR_CREATION_CODE, "FHEVMExecutor impl (forge)");
        implementations[2] = _create(CLEARTEXT_KMS_VERIFIER_CREATION_CODE, "KMSVerifier impl");
        implementations[3] = _create(CLEARTEXT_INPUT_VERIFIER_CREATION_CODE, "InputVerifier impl");
        implementations[4] = _create(CLEARTEXT_FORGE_HCU_LIMIT_CREATION_CODE, "HCULimit impl (forge)");
        implementations[5] = _create(PROTOCOL_CONFIG_CREATION_CODE, "ProtocolConfig impl");
        implementations[6] = _create(KMS_GENERATION_CREATION_CODE, "KMSGeneration impl");
        implementations[7] = _create(CLEARTEXT_FORGE_ARITHMETIC_CREATION_CODE, "CleartextArithmetic impl (forge)");
        implementations[8] = _create(CLEARTEXT_DB_CREATION_CODE, "CleartextDB impl");
    }

    ////////////////////////////////////////////////////////////////////////////
    // Phase 5 — one atomic upgrade
    ////////////////////////////////////////////////////////////////////////////

    /**
     * @dev A single `ACLOwner.upgrade` so the stack is never half-materialized: each op swaps a proxy from
     *      the empty implementation to the real one and runs its initializer in the same call.
     */
    function _materialize(address[] memory implementations, address aclOwner_) private {
        (address kmsVerifyingContract, uint64 kmsChainId) = _fhevmKmsVerifierConfig();
        (address inputVerifyingContract, uint64 inputChainId, address[] memory signers, uint256 threshold) =
            _fhevmInputVerifierConfig();
        (uint48 capPerBlock, uint48 maxDepthPerTx, uint48 maxPerTx) = _fhevmHcuLimitConfig();

        ACLOwner.Op[] memory ops = new ACLOwner.Op[](PROXY_COUNT);
        ops[0] =
            ACLOwner.Op(ACL_ADDRESS, implementations[0], abi.encodeCall(ICleartextACL.initializeFromEmptyProxy, ()));
        ops[1] = ACLOwner.Op(
            FHEVM_EXECUTOR_ADDRESS,
            implementations[1],
            abi.encodeCall(ICleartextFHEVMExecutor.initializeFromEmptyProxy, ())
        );
        ops[2] = ACLOwner.Op(
            KMS_VERIFIER_ADDRESS,
            implementations[2],
            abi.encodeCall(ICleartextKMSVerifier.initializeFromEmptyProxy, (kmsVerifyingContract, kmsChainId))
        );
        ops[3] = ACLOwner.Op(
            INPUT_VERIFIER_ADDRESS,
            implementations[3],
            abi.encodeCall(
                ICleartextInputVerifier.initializeFromEmptyProxy,
                (inputVerifyingContract, inputChainId, signers, threshold)
            )
        );
        ops[4] = ACLOwner.Op(
            HCU_LIMIT_ADDRESS,
            implementations[4],
            abi.encodeCall(ICleartextHCULimit.initializeFromEmptyProxy, (capPerBlock, maxDepthPerTx, maxPerTx))
        );
        ops[5] = ACLOwner.Op(PROTOCOL_CONFIG_ADDRESS, implementations[5], _protocolConfigInitData());
        ops[6] = ACLOwner.Op(
            KMS_GENERATION_ADDRESS, implementations[6], abi.encodeCall(IKMSGeneration.initializeFromEmptyProxy, ())
        );
        ops[7] = ACLOwner.Op(
            CLEARTEXT_ARITHMETIC_ADDRESS,
            implementations[7],
            abi.encodeCall(ICleartextArithmetic.initializeFromEmptyProxy, ())
        );
        ops[8] = ACLOwner.Op(
            CLEARTEXT_DB_ADDRESS,
            implementations[8],
            abi.encodeCall(ICleartextDB.initializeFromEmptyProxy, (CLEARTEXT_ARITHMETIC_ADDRESS))
        );

        fvm.prank(_fhevmAdmin());
        IACLOwner(aclOwner_).upgrade(ops);
    }

    /// @dev Encodes whatever `_fhevmProtocolConfig()` returns; the seed itself is the override point.
    function _protocolConfigInitData() private pure returns (bytes memory) {
        (IProtocolConfig.KmsNodeParams[] memory nodes, IProtocolConfig.KmsThresholds memory thresholds) =
            _fhevmProtocolConfig();
        return abi.encodeCall(
            IProtocolConfig.initializeFromEmptyProxy,
            (nodes, thresholds, LocalHostBootstrap.KMS_SOFTWARE_VERSION, new IProtocolConfig.PcrValues[](0))
        );
    }

    ////////////////////////////////////////////////////////////////////////////
    // Primitives
    ////////////////////////////////////////////////////////////////////////////

    /// @dev Raw CREATE, because the bytecode arrives as bytes rather than as a compiled contract type.
    function _create(bytes memory creationCode, string memory what) private returns (address addr) {
        assembly {
            addr := create(0, add(creationCode, 0x20), mload(creationCode))
        }
        require(addr != address(0), string.concat("ForgeFhevmDeploy: failed to deploy ", what));
    }

    /**
     * @dev An ERC-1967 proxy over `implementation`, checked against the address the pre-compiled bytecode
     *      expects. A mismatch means the nonce sequence diverged, and every later address is wrong too —
     *      so fail here rather than let a subtly broken stack look deployed.
     */
    function _createProxy(address implementation, bytes memory initData, address expected, string memory what)
        private
        returns (address addr)
    {
        addr = _create(abi.encodePacked(ERC1967_PROXY_CREATION_CODE, abi.encode(implementation, initData)), what);
        require(addr == expected, string.concat("ForgeFhevmDeploy: ", what, " landed at the wrong address"));
        require(
            fvm.load(addr, _ERC1967_IMPL_SLOT) == bytes32(uint256(uint160(implementation))),
            string.concat("ForgeFhevmDeploy: ", what, " implementation slot not set")
        );
    }

    ////////////////////////////////////////////////////////////////////////////
    // The same signer sets, applied to a stack this package did NOT deploy
    ////////////////////////////////////////////////////////////////////////////
    //
    // A production host registers coprocessor and KMS signers nobody here holds a key for. Re-registering
    // the cleartext ones is what makes a forked stack usable: the proofs this package builds are signed by
    // the very keys `LocalHostBootstrap` derives, which is why this belongs beside the deploy that installs
    // them in the first place rather than in a library of its own. They were two files, and each built the
    // KMS node list from the same four bootstrap arrays — the duplication rule 2.6 exists to prevent.

    // ---------------------------------------------------------------------------------------------
    // The cleartext side: what this project can sign as
    // ---------------------------------------------------------------------------------------------

    /// @notice The coprocessor signers a cleartext deployment registers.
    /// @dev Exposed so a caller never has to reach into `_internal` to learn what it is comparing
    ///      against. Same source as `ForgeFhevmDeploy`, so the two cannot drift.
    function cleartextCoprocessorSigners() internal pure returns (address[] memory) {
        return LocalHostBootstrap.coprocessorSigners();
    }

    /// @notice The threshold a cleartext deployment registers alongside them.
    function cleartextCoprocessorThreshold() internal pure returns (uint256) {
        return LocalHostBootstrap.COPROCESSOR_THRESHOLD;
    }

    // ---------------------------------------------------------------------------------------------
    // The forked side: reading and rewriting it
    // ---------------------------------------------------------------------------------------------

    /// @notice The address `onlyACLOwner` compares `msg.sender` against.
    function aclOwner(address acl) internal view returns (address) {
        return IACL(acl).owner();
    }

    /**
     * @notice Registers the cleartext coprocessor signers on a forked `InputVerifier`.
     *
     * @dev Replaces the set wholesale — `defineNewContext` is not additive — so afterwards the ONLY
     *      accepted signers are the cleartext ones. That is deliberate: a set mixing real and derived
     *      signers would let a proof pass for reasons the test did not intend.
     */
    function defineCleartextCoprocessorContext(address inputVerifier, address acl) internal {
        address[] memory signers = cleartextCoprocessorSigners();
        uint256 threshold = cleartextCoprocessorThreshold();

        fvm.prank(aclOwner(acl));
        IInputVerifier(inputVerifier).defineNewContext(signers, threshold);
    }

    // ---------------------------------------------------------------------------------------------
    // The KMS half
    // ---------------------------------------------------------------------------------------------

    /// @notice The KMS nodes a cleartext deployment registers.
    /// @dev The same four lists `ForgeFhevmDeploy` seeds `ProtocolConfig` with at genesis, so a
    ///      forked host ends up carrying the context a local one is born with.
    function cleartextKmsNodes() internal pure returns (IProtocolConfig.KmsNodeParams[] memory nodes) {
        address[] memory signers = LocalHostBootstrap.kmsSigners();
        address[] memory txSenders = LocalHostBootstrap.kmsTxSenders();
        string[] memory ips = LocalHostBootstrap.kmsIpAddresses();
        string[] memory urls = LocalHostBootstrap.kmsStorageUrls();

        string[] memory identities = LocalHostBootstrap.kmsMpcIdentities();
        string[] memory prefixes = LocalHostBootstrap.kmsStoragePrefixes();
        int32[] memory partyIds = LocalHostBootstrap.kmsPartyIds();

        nodes = new IProtocolConfig.KmsNodeParams[](LocalHostBootstrap.KMS_NODE_COUNT);
        for (uint256 i = 0; i < nodes.length; i++) {
            nodes[i] = IProtocolConfig.KmsNodeParams({
                txSenderAddress: txSenders[i],
                signerAddress: signers[i],
                ipAddress: ips[i],
                storageUrl: urls[i],
                partyId: partyIds[i],
                mpcIdentity: identities[i],
                caCert: LocalHostBootstrap.KMS_NODE_CA_CERT,
                storagePrefix: prefixes[i]
            });
        }
    }

    /// @notice The thresholds that go with them: every one is the node count.
    function cleartextKmsThresholds() internal pure returns (IProtocolConfig.KmsThresholds memory) {
        uint256 count = LocalHostBootstrap.KMS_NODE_COUNT;
        return
            IProtocolConfig.KmsThresholds({publicDecryption: count, userDecryption: count, kmsGen: count, mpc: count});
    }

    /**
     * @notice Registers the cleartext KMS nodes on a forked `ProtocolConfig`, and puts them in charge.
     *
     * @dev THREE PHASES, NOT ONE. v13's `defineNewKmsContext` activated what it created; v14's
     *      `defineNewKmsContextAndEpoch` only PROPOSES, and the verifier's `getKmsSigners`,
     *      `getThreshold` and `getCurrentKmsContextId` keep answering for the old committee until
     *        1. the proposal is made by the ACL owner,
     *        2. every incoming tx sender and `n - t` outgoing ones confirm its creation, which opens
     *           the context's first epoch, and
     *        3. every incoming signer attests to that epoch's key and CRS results, over identical values.
     *      This is `pkg/ts/kmsLifecycle/rotate.ts`, in Solidity, with the forge VM standing in for every
     *      account: the outgoing committee is read off the chain and pranked, the incoming one is the
     *      cleartext pool whose keys `LibForgeFhevmSigners` holds. The attestation is a fixture — a
     *      cleartext stack runs no keygen, and activation needs one key and one CRS result.
     *
     * @dev THE ADDRESS IS A PARAMETER, unlike the local `protocolConfigAdd` constant: each deployment
     *      has its own `ProtocolConfig`, and mainnet's is not Sepolia's.
     */
    function defineCleartextKmsContext(address protocolConfig, address acl) internal {
        IProtocolConfig pc = IProtocolConfig(protocolConfig);
        uint256 previousContextId = pc.getCurrentKmsContextId();
        uint256 epochsBefore = epochCounter(protocolConfig);

        // 1. Propose.
        fvm.prank(aclOwner(acl));
        pc.defineNewKmsContextAndEpoch(
            cleartextKmsNodes(),
            cleartextKmsThresholds(),
            LocalHostBootstrap.KMS_SOFTWARE_VERSION,
            new IProtocolConfig.PcrValues[](0)
        );
        // The proposal took the next id off the counter; that is the context the committees now confirm.
        uint256 contextId = pc.getCurrentKmsContextIdCounter();

        // 2. Creation quorum: every incoming tx sender, then the `n - t` outgoing ones the contract asks for.
        //    A sender in both committees counts for both with its one vote, so those are not asked twice.
        address[] memory incoming = LocalHostBootstrap.kmsTxSenders();
        for (uint256 i = 0; i < incoming.length; i++) {
            fvm.prank(incoming[i]);
            pc.confirmKmsContextCreation(contextId);
        }
        uint256 previousRequired = pc.getContextCreationPreviousTxSenderThreshold(contextId);
        IProtocolConfig.KmsNode[] memory outgoing = pc.getKmsNodesForContext(previousContextId);
        uint256 previousConfirmed = 0;
        for (uint256 i = 0; i < outgoing.length; i++) {
            if (pc.isKmsTxSenderForContext(contextId, outgoing[i].txSenderAddress)) previousConfirmed++;
        }
        for (uint256 i = 0; i < outgoing.length && previousConfirmed < previousRequired; i++) {
            if (pc.isKmsTxSenderForContext(contextId, outgoing[i].txSenderAddress)) continue;
            fvm.prank(outgoing[i].txSenderAddress);
            pc.confirmKmsContextCreation(contextId);
            previousConfirmed++;
        }

        // 3. Epoch activation. The quorum above opened the context's first epoch, and its id is whatever
        //    the contract's counter had reached — NOT the active epoch plus one. Those two coincide only
        //    on a chain that has never abandoned an epoch, which is every freshly deployed one and no
        //    long-lived one: a fork of devnet Sepolia failed here with `InvalidKmsEpoch` because an
        //    epoch had been created and superseded, leaving the counter ahead of what was active.
        uint256 epochId = epochCounter(protocolConfig);
        require(epochId > epochsBefore, "LibForgeFhevmStack: the creation quorum opened no epoch");
        (bytes32 keygenDigest, bytes32 crsgenDigest) = _epochActivationDigests(protocolConfig, contextId, epochId);
        address[] memory signers = LocalHostBootstrap.kmsSigners();
        for (uint256 i = 0; i < signers.length; i++) {
            uint256 key = LibForgeFhevmSigners.kmsNodeKeyFor(signers[i]);
            IProtocolConfig.EpochKeyResult[] memory keys = new IProtocolConfig.EpochKeyResult[](1);
            keys[0] = IProtocolConfig.EpochKeyResult({
                prepKeygenId: FIXTURE_PREP_KEYGEN_ID,
                keyId: FIXTURE_KEY_ID,
                keyDigests: _fixtureKeyDigests(),
                signature: _sign(key, keygenDigest)
            });
            IProtocolConfig.EpochCrsResult[] memory crsList = new IProtocolConfig.EpochCrsResult[](1);
            crsList[0] = IProtocolConfig.EpochCrsResult({
                crsId: FIXTURE_CRS_ID,
                maxBitLength: FIXTURE_CRS_MAX_BIT_LENGTH,
                crsDigest: FIXTURE_DIGEST,
                signature: _sign(key, crsgenDigest)
            });
            fvm.prank(incoming[i]);
            pc.confirmEpochActivation(epochId, keys, crsList);
        }
        require(
            pc.getCurrentKmsContextId() == contextId, "LibForgeFhevmStack: the cleartext KMS context did not activate"
        );
    }

    // -- Reading the epoch counter ---------------------------------------------------------------
    //
    // WHY STORAGE AND NOT A GETTER. `confirmKmsContextCreation` mints the new epoch id from a counter of
    // its own (`epochId = ++$.epochCounter`) and announces it only in the `NewKmsEpoch` event.
    // `ProtocolConfig` exposes no getter for a PENDING epoch — `isValidEpochForContext` answers for
    // Active ones only — and the recorded-log buffer has an owner (rule 2.3): draining it here would
    // starve the FHE replay and break the next decryption. So the counter is read where it lives.
    //
    // WHAT MAKES THAT SAFE. The root is `ProtocolConfig`'s own ERC-7201 constant and the offset is the
    // field's position in `ProtocolConfigStorage`, both copied from the vendored source beside this file.
    // Neither can drift silently: `ProtocolConfigEpochCounter.t.sol` reads the slot on a freshly deployed
    // stack and fails if it is not the epoch the contract reports as current.

    /// @dev `keccak256(abi.encode(uint256(keccak256("fhevm.storage.ProtocolConfig")) - 1)) & ~bytes32(uint256(0xff))`,
    ///      as `PROTOCOL_CONFIG_STORAGE_LOCATION` in `src/contracts/ProtocolConfig.sol`.
    bytes32 private constant PROTOCOL_CONFIG_STORAGE_ROOT =
        0x80f3585af86806c5774303b06c1ee640aa83b6ef3e45df49bb26c8524500c200;

    /// @dev `epochCounter` is the thirteenth field of `ProtocolConfigStorage`, so twelve slots past the
    ///      root. Every field before it is a `uint256` or a mapping, and each takes one whole slot.
    uint256 internal constant PROTOCOL_CONFIG_EPOCH_COUNTER_SLOT = 12;

    /// @notice The last epoch id `protocolConfig` handed out, pending or active.
    function epochCounter(address protocolConfig) internal view returns (uint256) {
        bytes32 slot = bytes32(uint256(PROTOCOL_CONFIG_STORAGE_ROOT) + PROTOCOL_CONFIG_EPOCH_COUNTER_SLOT);
        return uint256(fvm.load(protocolConfig, slot));
    }

    // -- The fixture attestation, `FIXTURE_ATTESTATION` in test/ts/utils/kmsEpochActivators.ts ----------

    uint256 private constant FIXTURE_PREP_KEYGEN_ID = 1;
    uint256 private constant FIXTURE_KEY_ID = 1;
    uint256 private constant FIXTURE_CRS_ID = 1;
    uint256 private constant FIXTURE_CRS_MAX_BIT_LENGTH = 2048;
    bytes private constant FIXTURE_DIGEST = hex"00";

    /// @dev `EXTRA_DATA_V2` in the contracts' shared/Constants.sol.
    uint8 private constant EXTRA_DATA_V2 = 0x02;

    bytes32 private constant EIP712_DOMAIN_TYPE_HASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant EIP712_KEY_DIGEST_TYPE_HASH = keccak256("KeyDigest(uint8 keyType,bytes digest)");
    bytes32 private constant EIP712_KEYGEN_TYPE_HASH = keccak256(
        "KeygenVerification(uint256 prepKeygenId,uint256 keyId,KeyDigest[] keyDigests,bytes extraData)KeyDigest(uint8 keyType,bytes digest)"
    );
    bytes32 private constant EIP712_CRSGEN_TYPE_HASH =
        keccak256("CrsgenVerification(uint256 crsId,uint256 maxBitLength,bytes crsDigest,bytes extraData)");

    function _fixtureKeyDigests() private pure returns (IProtocolConfigKMSGeneration.KeyDigest[] memory keyDigests) {
        keyDigests = new IProtocolConfigKMSGeneration.KeyDigest[](1);
        // keyType 0 is Server.
        keyDigests[0] = IProtocolConfigKMSGeneration.KeyDigest({
            keyType: IProtocolConfigKMSGeneration.KeyType.wrap(0), digest: FIXTURE_DIGEST
        });
    }

    /**
     * @dev The two EIP-712 digests each incoming signer signs to activate `epochId`, rebuilt exactly as
     *      `ProtocolConfig._hashKeygenVerification` / `_hashCrsgenVerification` hash them: the domain is
     *      the contract's own name, version "1", this chain and its address.
     */
    function _epochActivationDigests(address protocolConfig, uint256 contextId, uint256 epochId)
        private
        view
        returns (bytes32 keygen, bytes32 crsgen)
    {
        bytes32 domainSeparator = keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPE_HASH,
                keccak256(bytes("ProtocolConfig")),
                keccak256(bytes("1")),
                block.chainid,
                protocolConfig
            )
        );
        bytes32 extraDataHash = keccak256(abi.encodePacked(EXTRA_DATA_V2, contextId, epochId));

        IProtocolConfigKMSGeneration.KeyDigest[] memory keyDigests = _fixtureKeyDigests();
        bytes32[] memory keyDigestHashes = new bytes32[](keyDigests.length);
        for (uint256 i = 0; i < keyDigests.length; i++) {
            keyDigestHashes[i] = keccak256(
                abi.encode(
                    EIP712_KEY_DIGEST_TYPE_HASH,
                    IProtocolConfigKMSGeneration.KeyType.unwrap(keyDigests[i].keyType),
                    keccak256(keyDigests[i].digest)
                )
            );
        }
        bytes32 keygenStruct = keccak256(
            abi.encode(
                EIP712_KEYGEN_TYPE_HASH,
                FIXTURE_PREP_KEYGEN_ID,
                FIXTURE_KEY_ID,
                keccak256(abi.encodePacked(keyDigestHashes)),
                extraDataHash
            )
        );
        bytes32 crsgenStruct = keccak256(
            abi.encode(
                EIP712_CRSGEN_TYPE_HASH,
                FIXTURE_CRS_ID,
                FIXTURE_CRS_MAX_BIT_LENGTH,
                keccak256(abi.encodePacked(FIXTURE_DIGEST)),
                extraDataHash
            )
        );
        keygen = keccak256(abi.encodePacked("\x19\x01", domainSeparator, keygenStruct));
        crsgen = keccak256(abi.encodePacked("\x19\x01", domainSeparator, crsgenStruct));
    }

    /// @dev One 65-byte `r || s || v` signature over `digest`, the shape `_requireExpectedSigner` recovers.
    function _sign(uint256 privateKey, bytes32 digest) private pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = fvm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }

    /**
     * @notice Whether `kmsVerifier` now answers with exactly the cleartext KMS context.
     *
     * @dev Asked of the VERIFIER rather than of `ProtocolConfig`, because the verifier is what a
     *      prover reads — and the forwarding is precisely what could be wrong.
     */
    function hasCleartextKmsContext(address kmsVerifier) internal view returns (bool) {
        if (IKMSVerifier(kmsVerifier).getThreshold() != cleartextKmsThresholds().publicDecryption) return false;

        address[] memory expected = LocalHostBootstrap.kmsSigners();
        address[] memory actual = IKMSVerifier(kmsVerifier).getKmsSigners();
        if (actual.length != expected.length) return false;

        for (uint256 i = 0; i < expected.length; i++) {
            if (actual[i] != expected[i]) return false;
        }
        return true;
    }

    // ---------------------------------------------------------------------------------------------
    // Both at once
    // ---------------------------------------------------------------------------------------------

    /// @notice Rewrites both signer sets, which is what a fork needs before any proof can be built.
    /// @dev Both or neither: a host with only one half swapped accepts inputs it cannot decrypt, or
    ///      the reverse, and the failure surfaces far from the cause.
    function defineCleartextContexts(address inputVerifier, address protocolConfig, address acl) internal {
        defineCleartextCoprocessorContext(inputVerifier, acl);
        defineCleartextKmsContext(protocolConfig, acl);
    }

    /**
     * @notice Whether `inputVerifier` currently registers exactly the cleartext context.
     *
     * @dev Order matters and is checked: `defineNewContext` stores the array as given, and a set that
     *      merely contains the same addresses is not the same context — `randomCoprocessorSignatures`
     *      picks by index.
     */
    function hasCleartextCoprocessorContext(address inputVerifier) internal view returns (bool) {
        if (IInputVerifier(inputVerifier).getThreshold() != cleartextCoprocessorThreshold()) return false;

        address[] memory expected = cleartextCoprocessorSigners();
        address[] memory actual = IInputVerifier(inputVerifier).getCoprocessorSigners();
        if (actual.length != expected.length) return false;

        for (uint256 i = 0; i < expected.length; i++) {
            if (actual[i] != expected[i]) return false;
        }
        return true;
    }

    ////////////////////////////////////////////////////////////////////////////
    // Stating what a cleartext stack cannot know
    ////////////////////////////////////////////////////////////////////////////
    //
    // A fork is full of handles minted before this package's implementations were installed on it, and
    // their cleartexts exist nowhere. A test says what they are -- per handle here, or by type through the
    // policy below. On the local stack the question never arises, which is why these are refused there.

    /// @notice The store a cleartext `executor` reads its operands from.
    /// @dev Asked of the stack rather than configured: the executor names its arithmetic, and the
    ///      arithmetic names the store, so a fork's own pair is found the same way the local one's is.
    function cleartextStoreOf(address executor) internal view returns (address arithmetic, address db) {
        arithmetic = ICleartextFHEVMExecutor(executor).getCleartextArithmeticAddress();
        db = ICleartextForgeArithmeticPolicy(arithmetic).getCleartextDBAddress();
    }

    /**
     * @notice States the cleartext of one handle on a cleartext stack.
     * @dev PRANKED AS THE ARITHMETIC, which is the store's registered writer. Granting this contract a
     *      writer slot would work too and would leave the forked stack permanently changed; a prank
     *      leaves nothing behind.
     * @dev A stated value WINS over any policy, and over the derivation, because the store is consulted
     *      first. That is what makes a seeded fuzz input reliable.
     */
    function seedCleartext(address executor, bytes32 handle, uint256 value) internal {
        (address arithmetic, address db) = cleartextStoreOf(executor);
        fvm.prank(arithmetic);
        ICleartextDB(db).set(handle, value);
    }

    /**
     * @notice Makes one handle unknown again: the store forgets it, and the type's policy answers for it.
     *
     * @dev A STORAGE WRITE, BECAUSE THERE IS NO FUNCTION. `CleartextDB.set` marks a handle written and
     *      nothing clears it; `set(handle, 0)` would mean WORTH ZERO, which is the opposite of unknown
     *      and silently so. The deployable store has no business being able to forget -- a chain's store
     *      never should -- so the ability lives here, in the forge payload, where test-only powers belong.
     *
     * @dev WHAT IT DOES NOT UNDO. `_operand` consults the store first, then asks the HCU meter whether
     *      THIS stack minted the handle. So forgetting a handle this stack computed does not send it to
     *      the policy: it reports `CleartextErrorUnrecordedResult`, which is right -- the stack made that
     *      value and losing it is a fault, not a question. The cheat is meaningful for the handles
     *      `forkUnknown` exists for: the ones a fork inherited.
     */
    function unsetCleartext(address executor, bytes32 handle) internal {
        (, address db) = cleartextStoreOf(executor);
        fvm.store(db, _cleartextDbSlot(handle, DB_FIELD_PLAINTEXTS), bytes32(0));
        fvm.store(db, _cleartextDbSlot(handle, DB_FIELD_HAS), bytes32(0));
    }

    /**
     * @dev DERIVED FROM THE NAMESPACE, not copied as a hash. `CleartextDB` declares
     *      `erc7201:fhevm.storage.CleartextDB`; the name is what the contract states and the root is a
     *      consequence of it, so deriving keeps one statement of the truth rather than two. The formula
     *      is ERC-7201's own.
     */
    bytes32 private constant CLEARTEXT_DB_STORAGE_ROOT =
        keccak256(abi.encode(uint256(keccak256("fhevm.storage.CleartextDB")) - 1)) & ~bytes32(uint256(0xff));

    /**
     * @dev THE FIELD ORDER IS PART OF THE CONTRACT HERE, and it is the one thing this approach couples
     *      to: `CleartextDBStorage` is `plaintexts`, then `writers`, then `has`. Field 1 is why that
     *      matters -- a shift would make an unset zero a WRITER flag instead, and the arithmetic would
     *      quietly lose its access. `LibForgeFhevmStackUnset.t.sol` pins both the derivation and the
     *      order against the store's own behaviour, so a layout change fails there rather than here.
     */
    uint256 private constant DB_FIELD_PLAINTEXTS = 0;
    uint256 private constant DB_FIELD_HAS = 2;

    /// @dev A mapping entry's slot, by ERC-7201's layout: `keccak256(key . (root + field))`.
    function _cleartextDbSlot(bytes32 handle, uint256 field) private pure returns (bytes32) {
        return keccak256(abi.encode(handle, uint256(CLEARTEXT_DB_STORAGE_ROOT) + field));
    }

    /**
     * @notice Every unknown handle OF ONE TYPE answers `value`.
     *
     * @dev ONE TYPE, NOT ALL OF THEM, and the distinction is the whole point. This once set the default
     *      for every type the value happened to fit and silently skipped the rest: `1000` reached
     *      `euint16` upward and left `ebool`, `euint4` and `euint8` still refusing, so a test that had
     *      "set a default" met `CleartextErrorUnknownHandle` several lines later, on a type it never
     *      mentioned. A width is a property of the type, so the caller names the type.
     *
     * @dev THE VALUE IS REFUSED, NEVER NARROWED, and the arithmetic is what refuses it: upstream's rule
     *      is that a plaintext out of range for its type is an error, so clamping here would invent a
     *      number nobody wrote. Out of range now reverts where the caller can see it, rather than being
     *      skipped in a loop nobody watched.
     */
    function useFixedUnknownHandle(address executor, uint8 fheType, uint256 value) internal {
        (address arithmetic,) = cleartextStoreOf(executor);
        // THE FORK'S OWNER, asked of the executor. `ACL_ADDRESS` is this package's localhost constant and
        // is nobody on a forked chain -- pranking as its owner is refused by the fork's own ACL.
        address owner = aclOwner(ICleartextFHEVMExecutor(executor).getACLAddress());
        fvm.prank(owner);
        ICleartextForgeArithmeticPolicy(arithmetic).setUnknownHandleDefault(fheType, value);
    }

    /**
     * @notice Back to refusing: an unknown handle of `fheType` reverts again.
     *
     * @dev THE THIRD POLICY, and the only way back. `Revert` is where every type starts, and until this
     *      existed a test could leave that state but never return to it -- so a test that seeded a
     *      default in order to read pre-fork handles could no longer prove that a MISSING computation
     *      still fails. Per type, because that is the shape of the need: refuse one while another
     *      answers.
     *
     * @dev IT CLEARS THE POLICY, NOT THE VALUES. Anything stated with `seedCleartext` still wins -- the
     *      store is consulted before any policy -- and `CleartextErrorUnrecordedResult` is unreachable
     *      from here, being checked before the policy too.
     */
    function clearUnknownHandlePolicy(address executor, uint8 fheType) internal {
        (address arithmetic,) = cleartextStoreOf(executor);
        address owner = aclOwner(ICleartextFHEVMExecutor(executor).getACLAddress());
        fvm.prank(owner);
        ICleartextForgeArithmeticPolicy(arithmetic).clearUnknownHandlePolicy(fheType);
    }

    /**
     * @notice Back to refusing, for every type at once.
     *
     * @dev ALL TYPES IS HONEST HERE, where it was not for a fixed value. Refusing has no width to fit,
     *      so every type can take it and none is silently skipped -- the same property that lets
     *      `useDeterministicUnknownHandles` apply to all of them.
     */
    function clearAllUnknownHandlePolicies(address executor) internal {
        (address arithmetic,) = cleartextStoreOf(executor);
        address owner = aclOwner(ICleartextFHEVMExecutor(executor).getACLAddress());
        for (uint8 fheType = 0; fheType <= uint8(type(FheType).max); fheType++) {
            if (_bitWidthOrZero(FheType(fheType)) == 0) continue;
            fvm.prank(owner);
            ICleartextForgeArithmeticPolicy(arithmetic).clearUnknownHandlePolicy(fheType);
        }
    }

    /// @notice Derives every unknown handle's value from the handle itself, for every type.
    /// @dev Always applicable, unlike a fixed value: the derivation is cut to each type as it is made.
    function useDeterministicUnknownHandles(address executor) internal {
        (address arithmetic,) = cleartextStoreOf(executor);
        address owner = aclOwner(ICleartextFHEVMExecutor(executor).getACLAddress());
        for (uint8 fheType = 0; fheType <= uint8(type(FheType).max); fheType++) {
            if (_bitWidthOrZero(FheType(fheType)) == 0) continue;
            fvm.prank(owner);
            ICleartextForgeArithmeticPolicy(arithmetic).setUnknownHandleFromHandle(fheType);
        }
    }

    /// @dev The type's width, or zero for a member the cleartext layer carries no values for.
    ///      `LibFheType.bitWidthForType` REVERTS on those rather than answering, which is right where a
    ///      value is being computed and wrong here: this walks every enum member on purpose, so an
    ///      unsupported one is a member to skip, not a failure.
    function _bitWidthOrZero(FheType fheType) private pure returns (uint256) {
        if (fheType == FheType.Bool) return 1;
        if (fheType == FheType.Uint8) return 8;
        if (fheType == FheType.Uint16) return 16;
        if (fheType == FheType.Uint32) return 32;
        if (fheType == FheType.Uint64) return 64;
        if (fheType == FheType.Uint128) return 128;
        if (fheType == FheType.Uint160) return 160;
        if (fheType == FheType.Uint256) return 256;
        return 0;
    }
}
