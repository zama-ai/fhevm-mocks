// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {externalEuint32} from "encrypted-types/EncryptedTypes.sol";

import {TestFhevm} from "../../pkg/src/TestFhevm.sol";
import {fhevm} from "../../pkg/src/FhevmVm.sol";
import {ACL_ADDRESS, DEPLOYER_ADDRESS} from "../../pkg/src/_host/_internal/LocalHostAddresses.sol";

import {FHECounterPublicDecrypt} from "../examples/contracts/FHECounterPublicDecrypt.sol";

/**
 * @notice The MIRROR itself: writing the stack onto a node that may already be holding one, and what is
 *         said when that goes wrong.
 *
 * @dev SEPARATE FROM `AnvilFork.t.sol`, which asks whether a test can use anvil at all. This asks the two
 *      questions that file cannot: does a SECOND mirror onto the same node survive the first, and when a
 *      mirror fails, does the failure name a cause a person can act on?
 *
 * @dev THIS SUITE OWNS ITS NODE, on a port of its own, and that is why it is not in `test/anvil/`. It
 *      RESETS the node to genesis mid-test, which is the only way to make the SDK mirror a second time --
 *      and doing that to a shared node wipes state the suite beside it is relying on. That is not a
 *      hypothetical: it is what happened when this file lived there.
 *
 *          npm run test:anvil-mirror
 */
contract AnvilMirrorTest is TestFhevm {
    FhevmChain internal anvil;
    address internal alice;
    bool internal hasNode;

    function setUp() public override {
        if (!fhevm.hasRpcUrlFor("anvil")) return; // opt in: [rpc_endpoints] anvil, or ANVIL_RPC_URL
        anvil = getFhevmChain("local", "anvil");
        alice = makeAddr("alice");
        hasNode = true;
    }

    /**
     * A SECOND MIRROR, ONTO A NODE THAT HAS BEEN RESET. `anvil_reset` returns the node to genesis, so the
     * next fork finds no stack and mirrors again -- the second mirror of the session, from a deployer at
     * nonce zero, which is the only way the addresses can come out the same.
     */
    function test_aSecondMirrorAfterTheNodeIsResetSurvives() public {
        vm.skip(!hasNode);

        fhevm.createSelectFork(anvil);
        assertGt(_nodeCodeSize(ACL_ADDRESS), 0, "the first mirror put the stack on the node");

        vm.rpc(anvil.rpcUrl, "anvil_reset", "[]");
        assertEq(_nodeCodeSize(ACL_ADDRESS), 0, "the node is back at genesis");
        assertEq(_nodeNonce(DEPLOYER_ADDRESS), 0, "and so is the deployer");

        fhevm.createSelectFork(anvil);
        assertGt(_nodeCodeSize(ACL_ADDRESS), 0, "the second mirror put it back");

        FHECounterPublicDecrypt counter = new FHECounterPublicDecrypt();
        (externalEuint32 v, bytes memory proof) = encryptUint32(5, address(counter), alice);
        vm.prank(alice);
        counter.increment(v, proof);
        assertEq(decryptPublic(counter.getCount()), 5, "the twice-mirrored stack computes");
    }

    // NOT TESTED HERE, AND DELIBERATELY NOT LEFT AS A RED TEST: a node that kept its deployer's advanced
    // nonce but lost its stack. The refusal for it exists -- `localStackCannotDeploy` in `FhevmVm`, and
    // `_checkDeployer` in `LibForgeFhevmAnvil` -- but this suite could not make either fire through
    // `createSelectFork`: after `anvil_reset` plus `anvil_setNonce`, the fork the SDK creates still reads
    // the deployer at zero and deploys happily. Whether that is forge reusing a cached fork for the same
    // url, or the nonce write not surviving the reset, is unresolved. Left written down rather than
    // asserted, because a test that passes for a reason nobody has established is worse than none.

    // -- the node, asked directly ---------------------------------------------------------------------

    /// @dev `vm.rpc(url, …)` hands back the DECODED value -- unlike the library's low-level call to the
    ///      two-argument form, whose returndata still wraps it in an ABI `bytes`.
    function _nodeCodeSize(address account) private returns (uint256) {
        return vm.rpc(anvil.rpcUrl, "eth_getCode", string.concat('["', vm.toString(account), '","latest"]')).length;
    }

    function _nodeNonce(address account) private returns (uint256 value) {
        bytes memory raw =
            vm.rpc(anvil.rpcUrl, "eth_getTransactionCount", string.concat('["', vm.toString(account), '","latest"]'));
        for (uint256 i = 0; i < raw.length; i++) {
            value = (value << 8) | uint8(raw[i]);
        }
    }

    function _setCode(address account, string memory code) private {
        vm.rpc(anvil.rpcUrl, "anvil_setCode", string.concat('["', vm.toString(account), '","', code, '"]'));
    }
}
