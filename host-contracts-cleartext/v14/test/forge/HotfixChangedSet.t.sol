// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {FhevmHotfixBase} from "../../create2-deploy/script/hotfix/FhevmHotfixBase.s.sol";

/**
 * Which proxies a hotfix re-points: those whose live implementation's CODE differs from this build's.
 *
 * Found on a Sepolia fork: compared by address, a hotfix of an upgraded stack also re-pointed InputVerifier,
 * whose code had not changed. The generation upgrade had left it on the previous generation's implementation,
 * whose CREATE2 address hashes the previous generation's salt: the same code, at another address.
 */
contract HotfixChangedSetTest is Test, FhevmHotfixBase {
    string private constant INPUT_VERIFIER = "pkg/src/cleartext/CleartextInputVerifier.sol:CleartextInputVerifier";
    string private constant CLEARTEXT_DB = "pkg/src/cleartext/CleartextDB.sol:CleartextDB";

    address private constant PROXY = address(0xA11CE);

    function setUp() public {
        existingInputVerifier = PROXY;
    }

    function _pointAt(address implementation) private {
        vm.store(PROXY, ERC1967_IMPL_SLOT, bytes32(uint256(uint160(implementation))));
    }

    /// The same code deployed twice — two addresses, two embedded self-addresses — is not a change.
    function test_theSameCodeAtAnotherAddressIsNotAChange() public {
        address first = deployCode(INPUT_VERIFIER);
        address second = deployCode(INPUT_VERIFIER);
        assertTrue(first != second, "two deployments");

        _pointAt(first);
        assertFalse(_keepRole(R_INPUT_VERIFIER, second), "this build's code, wherever it sits, is unchanged");
        _pointAt(second);
        assertFalse(_keepRole(R_INPUT_VERIFIER, first), "and the other way round");
    }

    /// Other code behind the proxy is a change.
    function test_otherCodeIsAChange() public {
        _pointAt(deployCode(CLEARTEXT_DB));
        assertTrue(_keepRole(R_INPUT_VERIFIER, address(0)), "another contract's code behind the proxy");
    }
}
