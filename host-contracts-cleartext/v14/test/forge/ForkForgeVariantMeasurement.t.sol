// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {LibHostUpgradeCode} from "../../pkg/forge/src/LibHostUpgradeCode.sol";
import {
    ERC1967_PROXY_CREATION_CODE,
    FhevmAddressRole,
    FhevmHostContracts
} from "../../pkg/forge/src/_internal/LocalHostBytecode.sol";
import {IACL} from "../../pkg/forge/src/_internal/interfaces/IACL.sol";
import {ICleartextArithmetic} from "../../pkg/forge/src/_internal/interfaces/ICleartextArithmetic.sol";
import {ICleartextDB} from "../../pkg/forge/src/_internal/interfaces/ICleartextDB.sol";
import {ICleartextFHEVMExecutor} from "../../pkg/forge/src/_internal/interfaces/ICleartextFHEVMExecutor.sol";
import {IEmptyUUPSProxy} from "../../pkg/forge/src/_internal/interfaces/IEmptyUUPSProxy.sol";
import {FheType} from "../../pkg/forge/src/shared/LibFheType.sol";
import {FhevmChainsConfig} from "../utils/FhevmChainsConfig.sol";

interface IUUPSProxy {
    function upgradeToAndCall(address newImplementation, bytes calldata data) external payable;
}

/**
 * Two questions about putting the FORGE-only cleartext variants behind a
 * FORKED chain's proxy, both answered here rather than reasoned about.
 *
 *   1. EIP-170. `CleartextForgeFHEVMExecutor` is deliberately over 24,576 bytes. The local deploy gets
 *      away with it because forge does not enforce the limit on an in-test `create`. Does that still
 *      hold when the code then sits behind a proxy the FORK brought with it?
 *
 *   2. CHEAT ACCESS. The forge variants call `pauseGasMetering`. Forge grants cheatcodes per address, to
 *      what it created during the test -- and a forked chain's proxy is not that. The implementation runs
 *      by delegatecall, so the caller arriving at the cheat address is the PROXY. Does the call fail, and
 *      does `vm.allowCheatcodes(proxy)` fix it?
 *
 * Devnet Sepolia, because it is on this generation: nothing here is about upgrading a generation.
 *
 *          SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com \
 *          forge test --match-contract ForgeVariantOnAFork -vv
 */
contract ForkForgeVariantMeasurementTest is Test {
    /// @dev Devnet Sepolia's host contracts, read from fhevm-chains.config.json by `setUp`.
    address internal ACL;
    address internal EXECUTOR;
    address internal KMS_VERIFIER;
    address internal INPUT_VERIFIER;
    address internal HCU_LIMIT;
    address internal PROTOCOL_CONFIG;
    address internal KMS_GENERATION;
    address internal PAUSER_SET;

    uint256 internal constant EIP_170 = 24_576;

    bool internal forked;
    address internal owner;
    address internal arithmeticProxy;
    address internal dbProxy;

    function setUp() public {
        ACL = FhevmChainsConfig.hostContract("devnet", "ethereum_sepolia", "acl");
        EXECUTOR = FhevmChainsConfig.hostContract("devnet", "ethereum_sepolia", "fhevmExecutor");
        KMS_VERIFIER = FhevmChainsConfig.hostContract("devnet", "ethereum_sepolia", "kmsVerifier");
        INPUT_VERIFIER = FhevmChainsConfig.hostContract("devnet", "ethereum_sepolia", "inputVerifier");
        HCU_LIMIT = FhevmChainsConfig.hostContract("devnet", "ethereum_sepolia", "hcuLimit");
        PROTOCOL_CONFIG = FhevmChainsConfig.hostContract("devnet", "ethereum_sepolia", "protocolConfig");
        KMS_GENERATION = FhevmChainsConfig.hostContract("devnet", "ethereum_sepolia", "kmsGeneration");
        PAUSER_SET = FhevmChainsConfig.hostContract("devnet", "ethereum_sepolia", "pauserSet");

        string memory rpc = vm.envOr("SEPOLIA_RPC_URL", string(""));
        if (bytes(rpc).length == 0) return;
        vm.createSelectFork(rpc);
        forked = true;
        owner = IACL(ACL).owner();
        _installCleartextStore();
    }

    /// QUESTION 1: is the over-limit implementation deployable on a fork at all?
    function test_theForgeExecutorIsOverTheLimitAndStillDeploys() public {
        vm.skip(!forked);

        address implementation =
            _create(LibHostUpgradeCode.creationCodeFor(FhevmHostContracts.CleartextForgeFHEVMExecutor, _roles()));

        assertGt(implementation.code.length, EIP_170, "the forge variant really is over EIP-170");
        emit log_named_uint("forge executor runtime size", implementation.code.length);
        emit log_named_uint("EIP-170", EIP_170);
    }

    /// QUESTION 2a: behind a forked proxy, with no grant, does a cheatcode-calling variant work?
    function test_withoutAllowCheatcodes() public {
        vm.skip(!forked);
        _pointExecutorAtTheForgeVariant();

        try ICleartextFHEVMExecutor(EXECUTOR).trivialEncrypt(7, FheType.Uint32) returns (bytes32 handle) {
            emit log_named_uint("WITHOUT the grant: it worked, plaintext =", ICleartextDB(dbProxy).get(handle));
        } catch {
            emit log("WITHOUT the grant: REVERTED");
        }
    }

    /// QUESTION 2b: and with the grant on the PROXY?
    function test_withAllowCheatcodes() public {
        vm.skip(!forked);
        _pointExecutorAtTheForgeVariant();
        vm.allowCheatcodes(EXECUTOR);

        try ICleartextFHEVMExecutor(EXECUTOR).trivialEncrypt(7, FheType.Uint32) returns (bytes32 handle) {
            emit log_named_uint("WITH the grant: it worked, plaintext =", ICleartextDB(dbProxy).get(handle));
        } catch {
            emit log("WITH the grant: REVERTED");
        }
    }

    // -- fixture ------------------------------------------------------------------------------------

    function _pointExecutorAtTheForgeVariant() private {
        address implementation =
            _create(LibHostUpgradeCode.creationCodeFor(FhevmHostContracts.CleartextForgeFHEVMExecutor, _roles()));
        vm.prank(owner);
        IUUPSProxy(EXECUTOR).upgradeToAndCall(implementation, "");
    }

    /// @dev A CleartextDB and a (forge) CleartextArithmetic beside the forked stack, as the real thing would.
    function _installCleartextStore() private {
        address emptyImpl = _create(LibHostUpgradeCode.creationCodeFor(FhevmHostContracts.EmptyUUPSProxy, _roles()));
        bytes memory initEmpty = abi.encodeCall(IEmptyUUPSProxy.initialize, ());
        dbProxy = _create(abi.encodePacked(ERC1967_PROXY_CREATION_CODE, abi.encode(emptyImpl, initEmpty)));
        arithmeticProxy = _create(abi.encodePacked(ERC1967_PROXY_CREATION_CODE, abi.encode(emptyImpl, initEmpty)));

        address dbImpl = _create(LibHostUpgradeCode.creationCodeFor(FhevmHostContracts.CleartextDB, _roles()));
        vm.prank(owner);
        IUUPSProxy(dbProxy)
            .upgradeToAndCall(dbImpl, abi.encodeCall(ICleartextDB.initializeFromEmptyProxy, (arithmeticProxy)));

        address arithmeticImpl =
            _create(LibHostUpgradeCode.creationCodeFor(FhevmHostContracts.CleartextForgeArithmetic, _roles()));
        vm.prank(owner);
        IUUPSProxy(arithmeticProxy)
            .upgradeToAndCall(arithmeticImpl, abi.encodeCall(ICleartextArithmetic.initializeFromEmptyProxy, ()));
    }

    function _roles() private view returns (address[10] memory addresses) {
        addresses[uint8(FhevmAddressRole.ACL)] = ACL;
        addresses[uint8(FhevmAddressRole.FHEVMExecutor)] = EXECUTOR;
        addresses[uint8(FhevmAddressRole.KMSVerifier)] = KMS_VERIFIER;
        addresses[uint8(FhevmAddressRole.InputVerifier)] = INPUT_VERIFIER;
        addresses[uint8(FhevmAddressRole.HCULimit)] = HCU_LIMIT;
        addresses[uint8(FhevmAddressRole.ProtocolConfig)] = PROTOCOL_CONFIG;
        addresses[uint8(FhevmAddressRole.KMSGeneration)] = KMS_GENERATION;
        addresses[uint8(FhevmAddressRole.PauserSet)] = PAUSER_SET;
        addresses[uint8(FhevmAddressRole.CleartextArithmetic)] = arithmeticProxy;
        addresses[uint8(FhevmAddressRole.CleartextDB)] = dbProxy;
    }

    function _create(bytes memory creationCode) private returns (address deployed) {
        assembly {
            deployed := create(0, add(creationCode, 0x20), mload(creationCode))
        }
        require(deployed != address(0), "deploy failed");
    }
}
