// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {SignedDecryptionPermit} from "../../pkg/src/StdFhevmDecrypt.sol";

/// The pure half of a permit: its window and its contract set.
contract LibSignedDecryptionPermitTest is Test {
    function _permit(uint256 start, uint256 durationSeconds, address[] memory contracts)
        private
        pure
        returns (SignedDecryptionPermit memory p)
    {
        p.transportPublicKey = hex"00";
        p.contractAddresses = contracts;
        p.startTimestamp = start;
        p.durationSeconds = durationSeconds;
        p.signature = hex"00";
    }

    function _one(address a) private pure returns (address[] memory set) {
        set = new address[](1);
        set[0] = a;
    }

    function test_expiresAtIsStartPlusTheDuration() public pure {
        SignedDecryptionPermit memory p = _permit(1000, 2 days, _one(address(1)));
        assertEq(p.expiresAt(), 1000 + 2 days);
    }

    /// Half-open: valid at the start instant, NOT at the expiry instant.
    function test_theWindowIsHalfOpen() public pure {
        SignedDecryptionPermit memory p = _permit(1000, 1 days, _one(address(1)));

        assertFalse(p.isValidAt(999));
        assertTrue(p.isValidAt(1000));
        assertTrue(p.isValidAt(1000 + 1 days - 1));
        assertFalse(p.isValidAt(1000 + 1 days));
    }

    /// A zero-day permit is never valid, not valid forever.
    function test_aZeroDurationPermitIsAlreadyExpired() public pure {
        SignedDecryptionPermit memory p = _permit(1000, 0, _one(address(1)));
        assertFalse(p.isValidAt(1000));
    }

    function test_coversOnlyTheNamedContracts() public pure {
        address[] memory set = new address[](2);
        set[0] = address(1);
        set[1] = address(2);
        SignedDecryptionPermit memory p = _permit(1000, 1 days, set);

        assertTrue(p.covers(address(1)));
        assertTrue(p.covers(address(2)));
        assertFalse(p.covers(address(3)));
    }

    function test_anEmptyContractSetCoversNothing() public pure {
        SignedDecryptionPermit memory p = _permit(1000, 1 days, new address[](0));
        assertFalse(p.covers(address(0)));
        assertFalse(p.covers(address(1)));
    }
}
