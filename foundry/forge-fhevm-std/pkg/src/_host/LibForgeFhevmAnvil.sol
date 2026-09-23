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

        // `eth_getCode` answers a hex string, which the cheat encodes as ABI `bytes`: decodable.
        (bool answered, bytes memory ret) =
            _rpcRaw("eth_getCode", string.concat("[\"", _hex(ACL_ADDRESS), "\",\"latest\"]"));
        return answered && ret.length >= 64 && abi.decode(ret, (bytes)).length != 0;
    }

    function _setCode(address account, bytes memory code) private {
        _rpc("anvil_setCode", string.concat("[\"", _hex(account), "\",\"", fvm.toString(code), "\"]"));
    }

    function _setNonce(address account, uint64 nonce) private {
        _rpc("anvil_setNonce", string.concat("[\"", _hex(account), "\",\"", _hex(bytes32(uint256(nonce))), "\"]"));
    }

    /// @dev A setter's success is the call succeeding; its JSON result is not looked at (see the file docs).
    function _rpc(string memory method, string memory params) private {
        _rpcRaw(method, params);
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
