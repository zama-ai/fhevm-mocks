// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {IForgeVm, FORGE_VM_ADDRESS} from "./IForgeVm.sol";
import {LibForgeFhevmStack} from "./LibForgeFhevmStack.sol";
import {ACL_ADDRESS, DEPLOYER_ADDRESS, PAUSER_SET_ADDRESS} from "./_internal/LocalHostAddresses.sol";
import {PAUSER_SET_RUNTIME_CODE} from "./_internal/LocalHostBytecode.sol";

/**
 * @title  LibForgeFhevmAnvil
 * @notice Puts the cleartext stack on a running anvil: deploy it into the fork, then write it onto the NODE
 *         so it outlives the test.
 *
 * @dev WHY THE PAYLOAD OWNS THIS. Everything it touches is the payload's own: the canonical addresses, the
 *      `PauserSet` runtime blob, and `LibForgeFhevmStack`, whose sequence it replays. `v13/scripts/anvil.sh`
 *      does the same job from the outside, through `forge script --broadcast`; this is the in-process form,
 *      needing no key and no second process.
 *
 * @dev MECHANISM ONLY — it returns `false` where a caller would want to explain. Deciding WHEN to provision,
 *      whether the addresses are the canonical ones, whether the deployer's nonce allows a deploy, and what
 *      to tell the user when one of those fails, is the SDK's (forge-fhevm-std's `fhevm`, which renders those
 *      as boxed messages). Keeping the split here is what lets the payload stay free of the SDK's error
 *      renderer, which carries the SDK's own version.
 *
 * @dev WHY THE RPC CALLS ARE LOW-LEVEL. `vm.rpc` encodes the JSON result, and anvil's setters answer a bare
 *      `true` — one 32-byte word, which is not a valid ABI `bytes`. A typed call therefore REVERTS while
 *      decoding a result that meant success, and Solidity cannot `catch` a return-data decoding failure. So
 *      every call goes through `_rpcRaw` and the outcome is checked by reading the node back instead.
 */
library LibForgeFhevmAnvil {
    IForgeVm private constant fvm = IForgeVm(FORGE_VM_ADDRESS);

    /// @notice Whether the node behind the active fork answers anvil's own RPC namespace.
    /// @dev The test, rather than `block.chainid == 31337`: anvil can run any chain id, and a fork of a real
    ///      chain at chain id 31337 is not anvil.
    function isAnvilNode() internal returns (bool ok) {
        (ok,) = _rpcRaw("anvil_nodeInfo", "[]");
    }

    /**
     * @notice Deploys the cleartext stack into the active fork and, unless `mirror` is false, onto the node
     *         behind it. Returns whether the node ended up holding it — always true when `mirror` is false.
     *
     * @dev The fork deploy is the local run's own, verbatim: same deployer, same nonce sequence, same
     *      addresses. Mirroring then replays what it produced through anvil's setters, so the node receives
     *      byte-identical state with no key, no gas and no second process.
     *
     * @dev A FRESH ANVIL IS AT BLOCK 0, and the executor derives every handle from `blockhash(block.number - 1)`:
     *      the first FHE operation would panic with an arithmetic underflow, far from here. Forge's in-memory
     *      chain starts at block 1 for the same reason, which is why no local test ever meets this. Both the
     *      fork and the node are moved off block 0.
     */
    function provision(bool mirror) internal returns (bool ok) {
        fvm.startStateDiffRecording();
        LibForgeFhevmStack.deployLocalFhevm();
        IForgeVm.AccountAccess[] memory diff = fvm.stopAndReturnStateDiff();

        ok = true;
        if (mirror) ok = _mirrorOntoNode(diff);
        if (block.number == 0) fvm.roll(1);
    }

    /**
     * @dev Everything the deploy created or wrote, pushed onto the node. Storage writes are replayed in
     *      order, so the last write to a slot wins as it did in the fork. `PauserSet` was ETCHED, not
     *      created, so the diff does not list it and it is set explicitly. The deployer's nonce is set last,
     *      to what it is in the fork, so a later deploy against this node is refused the same way a reused
     *      local EVM is. Then the node is read back: the setters' own answers are not trusted.
     */
    function _mirrorOntoNode(IForgeVm.AccountAccess[] memory diff) private returns (bool) {
        for (uint256 i = 0; i < diff.length; i++) {
            IForgeVm.AccountAccess memory access = diff[i];
            if (access.reverted) continue;
            if (access.kind == IForgeVm.AccountAccessKind.Create && access.deployedCode.length != 0) {
                _setCode(access.account, access.deployedCode);
                _setNonce(access.account, 1);
            }
            for (uint256 j = 0; j < access.storageAccesses.length; j++) {
                IForgeVm.StorageAccess memory write = access.storageAccesses[j];
                if (!write.isWrite || write.reverted) continue;
                _rpc(
                    "anvil_setStorageAt",
                    string.concat(
                        "[\"", _hex(write.account), "\",\"", _hex(write.slot), "\",\"", _hex(write.newValue), "\"]"
                    )
                );
            }
        }
        _setCode(PAUSER_SET_ADDRESS, PAUSER_SET_RUNTIME_CODE);
        _setNonce(DEPLOYER_ADDRESS, fvm.getNonce(DEPLOYER_ADDRESS));
        if (block.number == 0) _rpc("anvil_mine", "[\"0x1\"]");

        _checkDeployer();
        _checkCodeLanded(diff);

        // `eth_getCode` answers a hex string, which the cheat encodes as ABI `bytes`: decodable.
        (bool answered, bytes memory ret) =
            _rpcRaw("eth_getCode", string.concat("[\"", _hex(ACL_ADDRESS), "\",\"latest\"]"));
        return answered && ret.length >= 64 && abi.decode(ret, (bytes)).length != 0;
    }

    /**
     * @dev THE DEPLOYER IS THE FIRST THING TO SUSPECT, so it is the first thing named. A mirror writes the
     *      deployer's nonce last, to whatever the fork reached; if the node disagrees afterwards, the node
     *      refused the write or something else is moving that account, and every later deploy against this
     *      node lands at addresses nothing expects. The balance goes in the message because it is the other
     *      half of "the deployer is wrong" and costs one call to find out.
     */
    function _checkDeployer() private {
        uint64 want = fvm.getNonce(DEPLOYER_ADDRESS);
        uint64 got = _nodeNonce(DEPLOYER_ADDRESS);
        if (got == want) return;

        revert(
            string.concat(
                "forge-fhevm anvil mirror FAILED: the node's deployer is not where the fork left it.\n",
                "  deployer      ",
                _hex(DEPLOYER_ADDRESS),
                "\n  nonce wanted  ",
                fvm.toString(uint256(want)),
                "\n  nonce on node ",
                fvm.toString(uint256(got)),
                "\n  balance       ",
                fvm.toString(_nodeBalance(DEPLOYER_ADDRESS)),
                " wei\n",
                "  A deploy against this node would land at addresses the stack does not use."
            )
        );
    }

    /**
     * @dev EVERY ACCOUNT THE DEPLOY CREATED, not just the ACL. The readback at the end of `_mirrorOntoNode`
     *      asks about one address, so a mirror that placed nine contracts out of ten answered true. Naming
     *      the account that has no code is the difference between "the mirror failed" and a fix.
     */
    function _checkCodeLanded(IForgeVm.AccountAccess[] memory diff) private {
        for (uint256 i = 0; i < diff.length; i++) {
            IForgeVm.AccountAccess memory access = diff[i];
            if (access.reverted) continue;
            if (access.kind != IForgeVm.AccountAccessKind.Create || access.deployedCode.length == 0) continue;
            if (_nodeCodeLength(access.account) != 0) continue;

            revert(
                string.concat(
                    "forge-fhevm anvil mirror FAILED: a contract the deploy created is not on the node.\n",
                    "  account   ",
                    _hex(access.account),
                    "\n  code size ",
                    fvm.toString(access.deployedCode.length),
                    " bytes in the fork, 0 on the node\n",
                    "  `anvil_setCode` was accepted and did not take effect."
                )
            );
        }
    }

    function _nodeNonce(address account) private returns (uint64) {
        return uint64(_quantity("eth_getTransactionCount", string.concat("[\"", _hex(account), "\",\"latest\"]")));
    }

    function _nodeBalance(address account) private returns (uint256) {
        return _quantity("eth_getBalance", string.concat("[\"", _hex(account), "\",\"latest\"]"));
    }

    function _nodeCodeLength(address account) private returns (uint256) {
        (bool ok, bytes memory ret) = _rpcRaw("eth_getCode", string.concat("[\"", _hex(account), "\",\"latest\"]"));
        if (!ok || ret.length < 64) return 0;
        return abi.decode(ret, (bytes)).length;
    }

    /**
     * @dev `vm.rpc` hands a JSON quantity back as its big-endian bytes, minimally encoded -- but
     *      `_rpcRaw` returns the CHEATCODE's returndata, which wraps those bytes in an ABI `bytes`.
     *      Folding the envelope instead of the value is how this first read a live account as nonce 0,
     *      balance 0, and accused a node that was fine.
     */
    function _quantity(string memory method, string memory params) private returns (uint256 value) {
        (bool ok, bytes memory ret) = _rpcRaw(method, params);
        if (!ok || ret.length < 64) return 0;

        bytes memory raw = abi.decode(ret, (bytes));
        for (uint256 i = 0; i < raw.length; i++) {
            value = (value << 8) | uint8(raw[i]);
        }
    }

    function _setCode(address account, bytes memory code) private {
        _rpc("anvil_setCode", string.concat("[\"", _hex(account), "\",\"", fvm.toString(code), "\"]"));
    }

    function _setNonce(address account, uint64 nonce) private {
        _rpc("anvil_setNonce", string.concat("[\"", _hex(account), "\",\"", _hex(bytes32(uint256(nonce))), "\"]"));
    }

    /**
     * @dev A SETTER THAT IS REFUSED SAYS SO, HERE. Its JSON result is still not looked at -- anvil answers
     *      `null` on success and the cheat cannot decode that -- but the CALL failing is a different thing
     *      entirely: the node rejected the method, or there is no node. Swallowing it turned every such
     *      failure into one silent `false` several frames later, naming nothing.
     */
    function _rpc(string memory method, string memory params) private {
        (bool ok, bytes memory ret) = _rpcRaw(method, params);
        if (ok) return;

        revert(
            string.concat(
                "forge-fhevm anvil mirror FAILED: the node refused ",
                method,
                ".\n  params ",
                params,
                "\n  node   ",
                _revertText(ret),
                "\n  The stack was deployed into the fork; only the copy onto the node failed."
            )
        );
    }

    /// @dev Whatever the cheat came back with, as text -- a revert string when it is one, hex when it is not.
    function _revertText(bytes memory ret) private pure returns (string memory) {
        if (ret.length == 0) return "(no reason given)";
        if (ret.length > 68 && bytes4(ret) == bytes4(0x08c379a0)) {
            bytes memory body = new bytes(ret.length - 68);
            for (uint256 i = 0; i < body.length; i++) {
                body[i] = ret[i + 68];
            }
            return string(body);
        }
        return fvm.toString(ret);
    }

    function _rpcRaw(string memory method, string memory params) private returns (bool ok, bytes memory ret) {
        (ok, ret) = FORGE_VM_ADDRESS.call(abi.encodeWithSignature("rpc(string,string)", method, params));
    }

    function _hex(address a) private pure returns (string memory) {
        return fvm.toString(a);
    }

    function _hex(bytes32 b) private pure returns (string memory) {
        return fvm.toString(b);
    }
}
