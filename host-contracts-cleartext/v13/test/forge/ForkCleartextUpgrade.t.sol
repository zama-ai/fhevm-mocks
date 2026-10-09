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

        // NO GENERATION STEP HERE. The line above carries one, for chains that lag it; this line has
        // nothing below it in production, so a forked stack is either on this line or refused.

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
        address executorImpl =
            _create(LibHostUpgradeCode.creationCodeFor(FhevmHostContracts.CleartextFHEVMExecutor, addresses));
        vm.prank(owner);
        IUUPSProxy(EXECUTOR).upgradeToAndCall(executorImpl, "");

        assertTrue(LibCleartextProbe.isCleartext(EXECUTOR), "the forked stack is now a cleartext one");

        // -- 4. and it records what it computes, with no event in sight -------------------------------
        bytes32 handle = ICleartextFHEVMExecutor(EXECUTOR).trivialEncrypt(7, FheType.Uint32);
        assertEq(ICleartextDB(dbProxy).get(handle), 7, "the DB holds the plaintext");
        assertEq(ICleartextFHEVMExecutor(EXECUTOR).plaintexts(handle), 7, "and the executor answers for it");

        // NO GENERATION PROBE HERE. The line above ends this test with an operation only IT has
        // (`fheMulDiv`), because there the upgrade is two steps and `trivialEncrypt` alone cannot tell
        // whether the generation step really ran. Here there is only the cleartext swap, and step 4 is
        // exactly the question that swap answers.
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

    function _create(bytes memory creationCode) internal returns (address deployed) {
        assembly {
            deployed := create(0, add(creationCode, 0x20), mload(creationCode))
        }
        require(deployed != address(0), "deploy failed");
    }
}

/// TESTNET IS THIS LINE. Devnet runs the generation above and is refused by the version gate, so the
/// one chain this suite can fork is the one still on 0.13 -- which is also what a user forking a real
/// chain gets today.
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
}
