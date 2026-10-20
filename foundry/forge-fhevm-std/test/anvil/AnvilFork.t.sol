// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {externalEuint32} from "encrypted-types/EncryptedTypes.sol";

import {TestFhevm} from "../../pkg/src/TestFhevm.sol";
import {LibFhevmProtocol} from "../../pkg/src/LibFhevmProtocol.sol";
import {fhevm} from "../../pkg/src/FhevmVm.sol";
import {ACL_ADDRESS, DEPLOYER_ADDRESS} from "../../pkg/src/_host/_internal/LocalHostAddresses.sol";

import {FHECounterPublicDecrypt} from "../examples/contracts/FHECounterPublicDecrypt.sol";

/**
 * @notice forge-fhevm-std against a RUNNING ANVIL: fork it, and the cleartext stack is there — deployed
 *         by the SDK on first contact if the node did not have it, and written onto the node so it stays.
 *
 * @dev The dApp is the example counter, compiled against the FHE library's own config, which routes chain
 *      31337 to the canonical local addresses: the same five lines as on Sepolia, no wiring.
 *
 *          anvil --port 8546 &
 *          ANVIL_RPC_URL=http://127.0.0.1:8546 forge test --match-contract AnvilFork
 *
 * @dev THE NODE IS SHARED, MUTABLE STATE, AND THE TESTS RUN IN PARALLEL. Forge restores the fork's state
 *      before each test, but the NODE keeps whatever a test mirrored onto it, and forge runs the tests of
 *      one contract concurrently — so no test here asserts that the node is empty, only that whatever it
 *      holds is consistent with what the fork sees, and the mirror-off case is asserted in the fork alone.
 */
contract AnvilForkTest is TestFhevm {
    FhevmChain internal anvil;
    address internal alice;
    bool internal hasNode;

    function setUp() public override {
        if (!fhevm.hasRpcUrlFor("anvil")) return; // opt in: [rpc_endpoints] anvil, or ANVIL_RPC_URL
        anvil = getFhevmChain("local", "anvil"); // ANVIL_RPC_URL resolves through the alias
        alice = makeAddr("alice");
        hasNode = true;
    }

    /// Fork anvil, and the stack is there: found, or deployed and mirrored. Then the counter just works.
    function test_forkAnvilAndTheStackIsThere() public {
        vm.skip(!hasNode);

        fhevm.createSelectFork(anvil);

        assertEq(block.chainid, 31337);
        assertGt(ACL_ADDRESS.code.length, 0, "the stack is in the fork");
        assertTrue(LibFhevmProtocol.currentConfig().isCleartext, "and it is the cleartext one");
        assertEq(LibFhevmProtocol.currentConfig().acl, ACL_ADDRESS);
        assertGt(_nodeCodeSize(ACL_ADDRESS), 0, "and on the NODE, not just in the fork");

        FHECounterPublicDecrypt counter = new FHECounterPublicDecrypt();
        (externalEuint32 v, bytes memory proof) = encryptUint32(5, address(counter), alice);
        vm.prank(alice);
        counter.increment(v, proof);
        assertEq(decryptPublic(counter.getCount()), 5, "encrypt, call, decrypt: on anvil");
    }

    /// A second fork of the same node FINDS the stack the first one mirrored: nothing is deployed again,
    /// the deployer's nonce on the node does not move, and the stack works on the second fork too.
    function test_aSecondForkFindsTheStack() public {
        vm.skip(!hasNode);

        fhevm.createSelectFork(anvil);
        uint256 nonceAfterFirst = _nodeNonce(DEPLOYER_ADDRESS);
        assertGt(nonceAfterFirst, 0, "the deployer deployed (in the fork, and mirrored)");

        uint256 second = fhevm.createSelectFork(anvil);
        assertEq(fhevm.activeFork(), second);
        assertEq(_nodeNonce(DEPLOYER_ADDRESS), nonceAfterFirst, "found, not deployed again");
        assertGt(ACL_ADDRESS.code.length, 0);

        FHECounterPublicDecrypt counter = new FHECounterPublicDecrypt();
        (externalEuint32 v, bytes memory proof) = encryptUint32(7, address(counter), alice);
        vm.prank(alice);
        counter.increment(v, proof);
        assertEq(decryptPublic(counter.getCount()), 7);
    }

    /// With the mirror off the stack exists in the fork only: the SDK deploys it there and touches the node
    /// with no setter. Asserted on the FORK and on the switch, not on the node's code: forge runs the tests
    /// of one contract in parallel, so the node's state at any instant belongs to whichever test got there
    /// first, and an assertion on it races (it did).
    function test_mirrorOffLeavesTheNodeUntouched() public {
        vm.skip(!hasNode);
        fhevm.setAnvilMirror(false);
        assertFalse(fhevm.anvilMirror());

        fhevm.createSelectFork(anvil);

        assertGt(ACL_ADDRESS.code.length, 0, "in the fork");
        assertTrue(LibFhevmProtocol.currentConfig().isCleartext, "and it is the cleartext one");
        assertEq(fvm.getNonce(DEPLOYER_ADDRESS), 13, "deployed in the fork by the canonical sequence");
    }

    /// @dev Read from the NODE, not the fork: the rpc cheat is a raw request to the endpoint behind the
    ///      active fork. Called low-level, because the cheat encodes a JSON quantity as one 32-byte word
    ///      and a hex string as ABI `bytes`, and a typed `vm.rpc` call reverts on the former.
    function _nodeCodeSize(address account) private returns (uint256) {
        bytes memory ret = _rpc("eth_getCode", string.concat("[\"", vm.toString(account), "\",\"latest\"]"));
        return abi.decode(ret, (bytes)).length;
    }

    function _nodeNonce(address account) private returns (uint256 nonce) {
        // A quantity comes back as the hex string's bytes, big-endian, encoded as ABI `bytes`.
        bytes memory ret = _rpc("eth_getTransactionCount", string.concat("[\"", vm.toString(account), "\",\"latest\"]"));
        bytes memory raw = abi.decode(ret, (bytes));
        for (uint256 k = 0; k < raw.length; k++) {
            nonce = (nonce << 8) | uint8(raw[k]);
        }
    }

    function _rpc(string memory method, string memory params) private returns (bytes memory ret) {
        bool ok;
        (ok, ret) = address(vm).call(abi.encodeWithSignature("rpc(string,string)", method, params));
        require(ok, "rpc failed");
    }
}
