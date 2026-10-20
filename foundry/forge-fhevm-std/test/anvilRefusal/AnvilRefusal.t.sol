// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {TestFhevm} from "../../pkg/src/TestFhevm.sol";
import {fhevm} from "../../pkg/src/FhevmVm.sol";

/**
 * @notice A FIXTURE, not a suite. One test that does the only thing the refusal paths need: fork the node
 *         `ANVIL_RPC_URL` names and let the SDK try to put a stack on it.
 *
 * @dev WHY IT ASSERTS ALMOST NOTHING. What is under test is the MESSAGE the SDK produces when it cannot
 *      provision a node -- and a message is a thing you read, not EVM state a test can hold. The node is
 *      also the subject: each case wants it in a state forge will not let a forge test establish, because
 *      forge owns the fork and caches it per url. So the setup and the assertion both live outside, in
 *      `internal/cli/testAnvilRefusals.ts`, which stands up a node (or a proxy that sabotages one), runs
 *      this file, and reads what comes out.
 *
 * @dev NOT IN `test/anvil/`, deliberately: that directory is the anvil TIER, run by `npm run test:anvil`
 *      against a healthy node, and these cases deliberately break the node. Run it through
 *      `npm run test:anvil-refusals`; on its own, with no `ANVIL_RPC_URL`, it skips.
 */
contract AnvilRefusalTest is TestFhevm {
    FhevmChain internal anvil;
    bool internal hasNode;

    function setUp() public override {
        if (!fhevm.hasRpcUrlFor("anvil")) return;
        anvil = getFhevmChain("local", "anvil");
        hasNode = true;
    }

    /// Forks the node and lets the SDK provision it. Passes when that works; the harness is interested in
    /// the runs where it does not.
    function test_provisionTheNode() public {
        vm.skip(!hasNode);
        fhevm.createSelectFork(anvil);
    }
}
