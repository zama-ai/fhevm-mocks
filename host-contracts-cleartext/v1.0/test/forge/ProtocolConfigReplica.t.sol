// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {ForgeFhevmDeploy} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {ProtocolConfig} from "../../pkg/src/contracts/ProtocolConfig.sol";
import {ProtocolConfigReplica} from "../../pkg/src/contracts/ProtocolConfigReplica.sol";
import {EmptyUUPSProxy} from "../../pkg/src/contracts/emptyProxy/EmptyUUPSProxy.sol";
import {ERC1967Proxy} from "../../pkg/src/erc1967/ERC1967Proxy.sol";
import {KmsNodeParams, KmsThresholds, PcrValues} from "../../pkg/src/contracts/shared/Structs.sol";
import {aclAdd} from "../../pkg/src/addresses/FHEVMHostAddresses.sol";

interface IUUPSProxy {
    function upgradeToAndCall(address newImplementation, bytes calldata data) external payable;
}

/// `owner()` getter over a single storage slot, matching the selector `ACLOwnable.onlyACLOwner` calls.
contract OwnerStub {
    address public owner;
}

/**
 * ProtocolConfig was split upstream into ProtocolConfigBase (shared storage/reads) + ProtocolConfig
 * (canonical, quorum-driven) + ProtocolConfigReplica (read-replica, advanced only via owner-only mirror
 * calls). This repo's single-chain local stack has no second chain to run a replica on, but production
 * deploys both ProtocolConfig and ProtocolConfigReplica on every host chain regardless (only one of the
 * pair is "significant" per chain — see the design discussion this test follows up on).
 *
 * This suite deploys both FRESH (forge-compiled from current pkg/src, NOT the baked LocalHostBytecode.sol
 * blob the default local stack's PROTOCOL_CONFIG_ADDRESS still uses — regenerating that blob requires
 * `npm run generate:local-host-bytecode`, unavailable in this environment) at their own proxy addresses,
 * seeds the replica with the canonical instance's own live context/epoch/thresholds (read back, not
 * duplicated by hand, so the two cannot drift apart in this fixture), and checks they agree.
 *
 * `pkg/src/contracts/*` compiles here against `internal/placeholders/addresses.sol` (this package's own
 * `fhevm-config-<major>.<minor>.0/addresses.sol` remapping), not the real local stack's addresses from
 * `deployLocalFhevm()` — a fresh `new ProtocolConfig()` therefore bakes in a placeholder `aclAdd` with no
 * code at it. `OwnerStub` is etched at that placeholder address so `onlyACLOwner` has something to call,
 * entirely independent of the real stack's own ACL (deployed separately, at its own real address, for the
 * baked-bytecode contracts this suite otherwise leaves untouched).
 */
contract ProtocolConfigReplicaTest is Test, ForgeFhevmDeploy {
    ProtocolConfig internal canonical;
    ProtocolConfigReplica internal replica;
    address internal owner;

    function setUp() public {
        deployLocalFhevm();
        owner = makeAddr("protocolConfigOwner");
        vm.etch(aclAdd, type(OwnerStub).runtimeCode);
        vm.store(aclAdd, bytes32(0), bytes32(uint256(uint160(owner))));

        canonical = ProtocolConfig(_deployEmptyProxy());
        address canonicalImpl = address(new ProtocolConfig());
        vm.prank(owner);
        IUUPSProxy(address(canonical))
            .upgradeToAndCall(
                canonicalImpl,
                abi.encodeCall(
                    ProtocolConfig.initializeFromEmptyProxy,
                    (_kmsNodeParams(), _kmsThresholds(), "v0.0.0-test", new PcrValues[](0))
                )
            );

        replica = ProtocolConfigReplica(_deployEmptyProxy());
        address replicaImpl = address(new ProtocolConfigReplica());
        (uint256 contextId, uint256 epochId) = canonical.getCurrentKmsContextAndEpoch();
        vm.prank(owner);
        IUUPSProxy(address(replica))
            .upgradeToAndCall(
                replicaImpl,
                abi.encodeCall(
                    ProtocolConfigReplica.initializeFromCanonical,
                    (contextId, epochId, _kmsNodeParams(), _kmsThresholds())
                )
            );
    }

    function test_bothDeployIndependentlyAtTheirOwnAddresses() public view {
        assertTrue(address(canonical) != address(0));
        assertTrue(address(replica) != address(0));
        assertTrue(address(canonical) != address(replica));
        assertGt(address(canonical).code.length, 0);
        assertGt(address(replica).code.length, 0);
    }

    /// The replica mirrors exactly the context/epoch it was seeded with from the live canonical instance.
    function test_replicaAgreesWithCanonicalAfterSeeding() public view {
        (uint256 canonicalContextId, uint256 canonicalEpochId) = canonical.getCurrentKmsContextAndEpoch();
        (uint256 replicaContextId, uint256 replicaEpochId) = replica.getCurrentKmsContextAndEpoch();
        assertEq(replicaContextId, canonicalContextId, "context id");
        assertEq(replicaEpochId, canonicalEpochId, "epoch id");
        assertEq(
            replica.getPublicDecryptionThresholdForContext(replicaContextId),
            canonical.getPublicDecryptionThresholdForContext(canonicalContextId),
            "public decryption threshold"
        );
    }

    /// Mirroring a new context is owner-only and must strictly increase both ids.
    function test_mirrorKmsContextAndEpochAdvancesTheReplica() public {
        (uint256 contextId, uint256 epochId) = replica.getCurrentKmsContextAndEpoch();

        vm.prank(owner);
        replica.mirrorKmsContextAndEpoch(
            contextId + 1, epochId + 1, _kmsNodeParams(), _kmsThresholds(), "v0.0.1-test", new PcrValues[](0)
        );

        (uint256 newContextId, uint256 newEpochId) = replica.getCurrentKmsContextAndEpoch();
        assertEq(newContextId, contextId + 1);
        assertEq(newEpochId, epochId + 1);
    }

    function test_mirrorKmsContextAndEpochRefusesNonOwner() public {
        (uint256 contextId, uint256 epochId) = replica.getCurrentKmsContextAndEpoch();
        vm.expectRevert();
        replica.mirrorKmsContextAndEpoch(
            contextId + 1, epochId + 1, _kmsNodeParams(), _kmsThresholds(), "v0.0.1-test", new PcrValues[](0)
        );
    }

    // --- helpers --------------------------------------------------------------------------------

    /// A bare EmptyUUPSProxy, forge-compiled fresh, not the baked blob: no address is reserved for this
    /// in the generated layer, so this is a dynamic, test-local address, upgraded by the caller next.
    function _deployEmptyProxy() private returns (address proxy) {
        address emptyImpl = address(new EmptyUUPSProxy());
        proxy = address(new ERC1967Proxy(emptyImpl, abi.encodeWithSignature("initialize()")));
    }

    function _kmsNodeParams() private pure returns (KmsNodeParams[] memory nodes) {
        nodes = new KmsNodeParams[](1);
        nodes[0] = KmsNodeParams({
            txSenderAddress: address(0x1111),
            signerAddress: address(0x2222),
            ipAddress: "127.0.0.1",
            storageUrl: "http://localhost",
            partyId: 1,
            mpcIdentity: "test-node",
            caCert: "",
            storagePrefix: "test"
        });
    }

    function _kmsThresholds() private pure returns (KmsThresholds memory) {
        return KmsThresholds({publicDecryption: 1, userDecryption: 1, kmsGen: 1, mpc: 1});
    }
}
