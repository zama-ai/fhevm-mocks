// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {LibForgeFhevmUpgrade} from "../../pkg/forge/src/LibForgeFhevmUpgrade.sol";
import {LibHostUpgradeCode} from "../../pkg/forge/src/LibHostUpgradeCode.sol";
import {
    ERC1967_PROXY_CREATION_CODE,
    FhevmAddressRole,
    FhevmHostContracts
} from "../../pkg/forge/src/_internal/LocalHostBytecode.sol";
import {IACL} from "../../pkg/forge/src/_internal/interfaces/IACL.sol";
import {ICleartextDB} from "../../pkg/forge/src/_internal/interfaces/ICleartextDB.sol";
import {ICleartextFHEVMExecutor} from "../../pkg/forge/src/_internal/interfaces/ICleartextFHEVMExecutor.sol";
import {ICleartextArithmetic} from "../../pkg/forge/src/_internal/interfaces/ICleartextArithmetic.sol";
import {IEmptyUUPSProxy} from "../../pkg/forge/src/_internal/interfaces/IEmptyUUPSProxy.sol";
import {LibCleartextProbe} from "../../pkg/forge/src/shared/LibCleartextProbe.sol";
import {FheType} from "../../pkg/forge/src/shared/LibFheType.sol";

interface IUUPSProxy {
    function upgradeToAndCall(address newImplementation, bytes calldata data) external payable;
}

/**
 * `CleartextImplementationSwap` showed a proxy can carry the production executor and
 * the cleartext one interchangeably, on a LOCAL stack where every sibling address is the one the blobs
 * bake in. This asks the remaining question: does it still work when the addresses are a real chain's?
 *
 * TWO CHAINS, ONE RECIPE, and the difference between them is the point. Devnet Sepolia runs this SDK's own
 * protocol line, so the cleartext swap is the ONLY thing under test there -- a failure has one possible
 * cause. Testnet Sepolia is a generation behind, so the same swap runs on top of the v13 -> v14 upgrade,
 * which is what a real user forking a lagging chain would get. Devnet proves the mechanism; testnet proves
 * it composes.
 *
 * NOTHING IS COMPILED AGAINST THESE ADDRESSES. Every implementation comes out of `LocalHostUpgrade` and is
 * rewritten for the fork by `LibHostUpgradeCode` -- the executor's arithmetic, the arithmetic's DB, and
 * each contract's ACL. That is the whole point of the exercise: the deploy path here is the patch path.
 *
 *          SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com \
 *          forge test --match-contract DevnetCleartextUpgrade -vv
 */
abstract contract ForkCleartextUpgrade is Test {
    address internal ACL;
    address internal EXECUTOR;
    address internal KMS_VERIFIER;
    address internal INPUT_VERIFIER;
    address internal HCU_LIMIT;
    address internal PROTOCOL_CONFIG;
    address internal KMS_GENERATION;
    address internal PAUSER_SET;

    /// @dev `fheMulDiv`'s bitmask: bit 0 (the divisor) is always set, bit 1 marks factor2 as scalar.
    bytes1 internal constant SCALAR_FACTOR_AND_DIVISOR = 0x03;

    bool internal forked;
    address internal owner;

    /// @dev The stack this case forks, and whether it needs bringing forward a generation first.
    function _chain() internal virtual;
    function _isAGenerationBehind() internal pure virtual returns (bool);

    /// @dev ROUTE. A: the generation upgrade lands on the production implementations and the executor is
    ///      swapped to cleartext afterwards, so its proxy moves twice. B: one pass, where the executor's
    ///      op re-points straight to `CleartextFHEVMExecutor` and its `reinitializeV6` runs on that.
    function _singlePass() internal pure virtual returns (bool) {
        return false;
    }

    function setUp() public {
        string memory rpc = vm.envOr("SEPOLIA_RPC_URL", string(""));
        if (bytes(rpc).length == 0) {
            try vm.rpcUrl("sepolia") returns (string memory configured) {
                rpc = configured;
            } catch {}
        }
        if (bytes(rpc).length == 0) return;

        _chain();
        vm.createSelectFork(rpc);
        forked = true;
        owner = IACL(ACL).owner();
    }

    function test_aForkedProductionStackBecomesCleartext() public {
        vm.skip(!forked);

        // -- 0. it really is a production stack ------------------------------------------------------
        assertFalse(LibCleartextProbe.isCleartext(EXECUTOR), "the chain runs the real executor");

        // -- 0b. a chain that lags gets brought forward FIRST, exactly as `FhevmVm` does it -----------
        if (_isAGenerationBehind() && !_singlePass()) {
            LibForgeFhevmUpgrade.upgradeFromPreviousGeneration(_roles(address(0), address(0)));
            assertFalse(LibCleartextProbe.isCleartext(EXECUTOR), "still production, just a newer one");
        }

        // -- 1. the two contracts a real chain has never heard of, behind bootstrap proxies -----------
        address[10] memory addresses = _roles(address(0), address(0));
        address emptyImpl = _create(LibHostUpgradeCode.creationCodeFor(FhevmHostContracts.EmptyUUPSProxy, addresses));
        bytes memory initEmpty = abi.encodeCall(IEmptyUUPSProxy.initialize, ());
        address dbProxy = _create(abi.encodePacked(ERC1967_PROXY_CREATION_CODE, abi.encode(emptyImpl, initEmpty)));
        address arithmeticProxy =
            _create(abi.encodePacked(ERC1967_PROXY_CREATION_CODE, abi.encode(emptyImpl, initEmpty)));

        // now every role has an address, including the two just created
        addresses = _roles(arithmeticProxy, dbProxy);

        // -- 2. materialize them, each patched for THIS chain -----------------------------------------
        address dbImpl = _create(LibHostUpgradeCode.creationCodeFor(FhevmHostContracts.CleartextDB, addresses));
        vm.prank(owner);
        IUUPSProxy(dbProxy)
            .upgradeToAndCall(dbImpl, abi.encodeCall(ICleartextDB.initializeFromEmptyProxy, (arithmeticProxy)));

        address arithmeticImpl =
            _create(LibHostUpgradeCode.creationCodeFor(FhevmHostContracts.CleartextArithmetic, addresses));
        vm.prank(owner);
        IUUPSProxy(arithmeticProxy)
            .upgradeToAndCall(arithmeticImpl, abi.encodeCall(ICleartextArithmetic.initializeFromEmptyProxy, ()));

        // -- 3. THE MOVE: the chain's own executor proxy, pointed at the cleartext implementation ------
        if (_isAGenerationBehind() && _singlePass()) {
            _upgradeGenerationStraightToCleartext(addresses);
        } else {
            address executorImpl =
                _create(LibHostUpgradeCode.creationCodeFor(FhevmHostContracts.CleartextFHEVMExecutor, addresses));
            vm.prank(owner);
            IUUPSProxy(EXECUTOR).upgradeToAndCall(executorImpl, "");
        }

        assertTrue(LibCleartextProbe.isCleartext(EXECUTOR), "the forked stack is now a cleartext one");
        if (_isAGenerationBehind() && _singlePass()) {
            assertTrue(LibCleartextProbe.isCleartext(ACL), "and so is the ACL");
            assertTrue(LibCleartextProbe.isCleartext(KMS_VERIFIER), "and the KMS verifier");
            assertTrue(LibCleartextProbe.isCleartext(INPUT_VERIFIER), "and the input verifier");
            assertTrue(LibCleartextProbe.isCleartext(HCU_LIMIT), "and the HCU limit");
        }

        // -- 4. and it records what it computes, with no event in sight -------------------------------
        bytes32 handle = ICleartextFHEVMExecutor(EXECUTOR).trivialEncrypt(7, FheType.Uint32);
        assertEq(ICleartextDB(dbProxy).get(handle), 7, "the DB holds the plaintext");
        assertEq(ICleartextFHEVMExecutor(EXECUTOR).plaintexts(handle), 7, "and the executor answers for it");

        // -- 5. AN OPERATION ONLY v14 HAS, which is what makes this test able to fail ------------------
        //
        // `trivialEncrypt` above cannot tell the two generations apart -- both implement it the same way,
        // so step 4 passes whether or not the upgrade that was supposed to run did. `fheMulDiv` is what
        // v14 ADDED: the executor routes it to `HCULimit.checkHCUForFheMulDiv`, a function a v13 HCULimit
        // does not have. Reaching a correct answer here means every contract the call touches really is
        // this generation's, not just the executor.
        bytes32 factor = ICleartextFHEVMExecutor(EXECUTOR).trivialEncrypt(10, FheType.Uint32);
        bytes32 product = ICleartextFHEVMExecutor(EXECUTOR)
            .fheMulDiv(factor, bytes32(uint256(3)), bytes32(uint256(2)), SCALAR_FACTOR_AND_DIVISOR);
        assertEq(ICleartextFHEVMExecutor(EXECUTOR).plaintexts(product), 15, "10 * 3 / 2, computed by the stack");
    }

    /// @dev One address per `FhevmAddressRole`: this chain's, not this package's.
    function _roles(address arithmetic, address db) internal view returns (address[10] memory addresses) {
        addresses[uint8(FhevmAddressRole.ACL)] = ACL;
        addresses[uint8(FhevmAddressRole.FHEVMExecutor)] = EXECUTOR;
        addresses[uint8(FhevmAddressRole.KMSVerifier)] = KMS_VERIFIER;
        addresses[uint8(FhevmAddressRole.InputVerifier)] = INPUT_VERIFIER;
        addresses[uint8(FhevmAddressRole.HCULimit)] = HCU_LIMIT;
        addresses[uint8(FhevmAddressRole.ProtocolConfig)] = PROTOCOL_CONFIG;
        addresses[uint8(FhevmAddressRole.KMSGeneration)] = KMS_GENERATION;
        addresses[uint8(FhevmAddressRole.PauserSet)] = PAUSER_SET;
        addresses[uint8(FhevmAddressRole.CleartextArithmetic)] = arithmetic;
        addresses[uint8(FhevmAddressRole.CleartextDB)] = db;
    }

    /**
     * @dev ROUTE B: the generation's own op list, with ONE substitution -- the executor's implementation is
     *      the cleartext subclass rather than the production one. `reinitializeV6` is inherited, so the
     *      same init data runs on it, and the proxy moves once instead of twice.
     */
    function _upgradeGenerationStraightToCleartext(address[10] memory addresses) private {
        for (uint256 index = 0; index < LibForgeFhevmUpgrade.OP_COUNT; index++) {
            FhevmHostContracts implementation = _cleartextCounterpart(LibForgeFhevmUpgrade.opImplementation(index));
            address deployed = _create(LibHostUpgradeCode.creationCodeFor(implementation, addresses));
            vm.prank(owner);
            IUUPSProxy(addresses[uint8(LibForgeFhevmUpgrade.opProxyRole(index))])
                .upgradeToAndCall(deployed, LibForgeFhevmUpgrade.opInitData(index));
        }

        // AND THE ONE THE OP LIST CANNOT REACH. `InputVerifier` is absent from the generation upgrade on
        // purpose -- its bytecode is the same in both generations -- but it has a cleartext subclass all
        // the same, so the cleartext pass has to visit it separately. No init data: nothing new to
        // initialize, and the generation did not move under it.
        address cleartextInputVerifier =
            _create(LibHostUpgradeCode.creationCodeFor(FhevmHostContracts.CleartextInputVerifier, addresses));
        vm.prank(owner);
        IUUPSProxy(INPUT_VERIFIER).upgradeToAndCall(cleartextInputVerifier, "");
    }

    /**
     * @dev THE SUBSTITUTION THE WHOLE DESIGN TURNS ON. Five of the seven host contracts have a cleartext
     *      subclass -- `CleartextACL is ACL`, and so on -- which adds behaviour over an identical storage
     *      layout and inherits the same reinitializers. So the generation's op list can name the subclass
     *      wherever one exists and arrive at a cleartext stack in the one pass it would have taken to
     *      arrive at a production one. `ProtocolConfig` and `KMSGeneration` have no cleartext variant and
     *      need none: nothing about them differs between a mock stack and a real one.
     */
    function _cleartextCounterpart(FhevmHostContracts implementation) private pure returns (FhevmHostContracts) {
        if (implementation == FhevmHostContracts.FHEVMExecutor) return FhevmHostContracts.CleartextFHEVMExecutor;
        if (implementation == FhevmHostContracts.ACL) return FhevmHostContracts.CleartextACL;
        if (implementation == FhevmHostContracts.KMSVerifier) return FhevmHostContracts.CleartextKMSVerifier;
        if (implementation == FhevmHostContracts.InputVerifier) return FhevmHostContracts.CleartextInputVerifier;
        if (implementation == FhevmHostContracts.HCULimit) return FhevmHostContracts.CleartextHCULimit;
        return implementation;
    }

    function _create(bytes memory creationCode) internal returns (address deployed) {
        assembly {
            deployed := create(0, add(creationCode, 0x20), mload(creationCode))
        }
        require(deployed != address(0), "deploy failed");
    }
}

/// THE MECHANISM ALONE: devnet is on this SDK's line, so only the cleartext swap runs.
contract DevnetCleartextUpgradeTest is ForkCleartextUpgrade {
    function _chain() internal override {
        ACL = 0x1aC3073813148992aA928C9903681fA7Ec202b13;
        EXECUTOR = 0x356cc81A08aa782C96F00dC30b60d4f33f1a4e43;
        KMS_VERIFIER = 0xDe8893C04e118431aeC076A39F6aFa951669F720;
        INPUT_VERIFIER = 0x160AaB6199FAEAEA1B27E62999c597E530a3abA9;
        HCU_LIMIT = 0xaa13C49f14C1a2EdA302e008AB314755Cac6E19F;
        PROTOCOL_CONFIG = 0x257950EbB65A1D2b697f03D08E7D3Dc26CbDB304;
        KMS_GENERATION = 0x55bdE339a01DA46d2d3504b8d9A9F5412C85e5e7;
        PAUSER_SET = 0x0E3668AA0faFF49B54126Febd59C8654f2d5Ff87;
    }

    function _isAGenerationBehind() internal pure override returns (bool) {
        return false;
    }
}

/// IT COMPOSES: testnet is a generation behind, so the swap runs on top of the v13 -> v14 upgrade. This is
/// what a user forking a chain that has not upgraded yet would actually get.
contract TestnetCleartextUpgradeTest is ForkCleartextUpgrade {
    function _chain() internal override {
        ACL = 0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D;
        EXECUTOR = 0x92C920834Ec8941d2C77D188936E1f7A6f49c127;
        KMS_VERIFIER = 0xbE0E383937d564D7FF0BC3b46c51f0bF8d5C311A;
        INPUT_VERIFIER = 0xBBC1fFCdc7C316aAAd72E807D9b0272BE8F84DA0;
        HCU_LIMIT = 0xa10998783c8CF88D886Bc30307e631D6686F0A22;
        PROTOCOL_CONFIG = 0x51f9AFBc89Ea792e1a21a12AB802ab58D4dbee83;
        KMS_GENERATION = 0x77389113d7000EcBCfc2bDed57202f5f46109934;
        PAUSER_SET = 0xc62392B4100a1bD45AbDBf91E70f1E4349402b46;
    }

    function _isAGenerationBehind() internal pure override returns (bool) {
        return true;
    }
}

/// ROUTE B: the same generation upgrade, but the executor goes straight to cleartext in the one pass.
contract TestnetSinglePassCleartextUpgradeTest is TestnetCleartextUpgradeTest {
    function _singlePass() internal pure override returns (bool) {
        return true;
    }
}
