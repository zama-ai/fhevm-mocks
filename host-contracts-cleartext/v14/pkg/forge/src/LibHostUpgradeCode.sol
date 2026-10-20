// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FhevmAddressRole, FhevmHostContracts, LocalHostUpgrade} from "./_internal/LocalHostBytecode.sol";

/**
 * @title LibHostUpgradeCode
 * @notice Creation code for a production host implementation, pointing wherever you say.
 *
 * @dev WHAT THIS IS FOR. Upgrading a stack that is already deployed somewhere else. The implementations
 *      in `LocalHostBytecode.sol` name their siblings as compile-time constants, so the blob that ships
 *      points at the localhost address set and nothing else. A remote stack lives at the chain's own
 *      addresses, which no build of ours can know, so the blob is rewritten in memory before it is
 *      deployed. `LocalHostUpgrade`'s generated tables say where each address sits; this turns them
 *      into bytecode.
 *
 * @dev WHY ONLY THESE FIVE. It is the exception rule 4.1 allows and nothing wider. Every other blob in
 *      the payload is deployed beside the addresses it was compiled against, so it is never patched —
 *      and must not be, because those blobs come from a different compile whose constant table can be
 *      ordered differently (`internal/pooledAddressSites.ts`). Only the five here carry a table
 *      measured in their own bytes, which is what makes rewriting them safe.
 *
 * @dev IT VERIFIES BEFORE IT WRITES. Every site is checked to hold the address the table claims before
 *      that address is replaced. A table that drifted from its bytecode would otherwise splice into the
 *      middle of an opcode and yield a contract that deploys, runs, and is wrong — the failure this
 *      library exists to make impossible. See rule 2.11: it fails by name, not by producing rubbish.
 *
 * @dev NO CHEATCODES. Pure, so it obeys rule 2.1 and can be called from anywhere, including a script
 *      that broadcasts.
 */
library LibHostUpgradeCode {
    /// @notice The address for each role, indexed by `FhevmAddressRole`'s position.
    /// @dev An array rather than a struct: the packed table names its role by number, so indexing is
    ///      what the data already speaks. A role no site references may be left zero.
    uint256 internal constant ROLE_COUNT = 10;

    /// @notice A patch-site table whose length is not a whole number of records.
    error MalformedSiteTable(uint256 length);

    /// @notice A site points past the end of the bytecode it describes.
    error SiteOutOfRange(uint256 offset, uint256 codeLength);

    /// @notice The bytecode does not hold the address the table says is there.
    /// @dev The one that matters. It means the table and the blob are not describing each other, so
    ///      every other offset is suspect too.
    error UnexpectedAddressAtSite(uint256 offset, address found, address expected);

    /// @notice A role that a site references was given no address.
    error NoAddressForRole(FhevmAddressRole role);

    /**
     * @notice `contractId`'s creation code, with every address it names replaced by `addresses`.
     * @param contractId Which host implementation.
     * @param addresses One address per `FhevmAddressRole`, by position. Roles no site references are
     *                  ignored and may be zero.
     * @return code Deployable creation code, freshly allocated. Nothing the caller owns is written.
     */
    function creationCodeFor(FhevmHostContracts contractId, address[ROLE_COUNT] memory addresses)
        internal
        pure
        returns (bytes memory code)
    {
        address[ROLE_COUNT] memory canonical;
        for (uint256 role = 0; role < ROLE_COUNT; role++) {
            canonical[role] = LocalHostUpgrade.canonicalAddress(FhevmAddressRole(uint8(role)));
        }
        return
            patch(
                LocalHostUpgrade.creationCode(contractId), LocalHostUpgrade.patchSites(contractId), canonical, addresses
            );
    }

    /**
     * @notice `code` with each site in `sites` rewritten from `expected` to `replacement`.
     * @param expected What each role's address must currently be. Checked before anything is written.
     * @param replacement What to write instead.
     *
     * @dev THE EXPECTED SET IS A PARAMETER, not the localhost one, because this has to run in both
     *      directions. `creationCodeFor` goes localhost to remote and passes the generated table's
     *      addresses; a caller undoing that, or moving an already-patched blob somewhere else, passes
     *      what is actually in the bytes. Hardcoding the localhost set here made the function silently
     *      one-way, which its own round-trip test caught.
     *
     * @dev Separate from `creationCodeFor` so the checks above can be exercised against inputs the
     *      generated tables can never produce. A caller with a real contract wants the other one.
     */
    function patch(
        bytes memory code,
        bytes memory sites,
        address[ROLE_COUNT] memory expected,
        address[ROLE_COUNT] memory replacement
    ) internal pure returns (bytes memory patched) {
        if (sites.length % LocalHostUpgrade.SITE_RECORD_BYTES != 0) {
            revert MalformedSiteTable(sites.length);
        }

        // A COPY, not `patched = code`, which aliases: the caller's array would be rewritten under it
        // and the "unchanged" half of a round trip would compare a value with itself. Its own test
        // caught that.
        patched = bytes.concat(code);

        for (uint256 at = 0; at < sites.length; at += LocalHostUpgrade.SITE_RECORD_BYTES) {
            (FhevmAddressRole role, uint256 offset) = _record(sites, at);

            // Checked before the read below, which would otherwise index past the end and revert with
            // a panic rather than a name.
            if (offset + 20 > patched.length) revert SiteOutOfRange(offset, patched.length);

            address wanted = expected[uint8(role)];
            address found = _addressAt(patched, offset);
            if (found != wanted) revert UnexpectedAddressAtSite(offset, found, wanted);

            address next = replacement[uint8(role)];
            // A referenced role left at zero would produce an implementation pointing nowhere, which
            // deploys happily and fails at the first call. Refused here, where the cause is still visible.
            if (next == address(0)) revert NoAddressForRole(role);

            _writeAddress(patched, offset, next);
        }
    }

    // ---------------------------------------------------------------------------------------------
    // Record and word handling
    //
    // Byte at a time, deliberately. This runs in a test VM or a deploy script, never in a transaction
    // anyone pays for, and twenty single-byte writes are unmistakably correct where a masked `mstore`
    // is a place to get an off-by-one wrong. Rule 2.7: say what is not true — this is not fast.
    // ---------------------------------------------------------------------------------------------

    /// @dev One packed record: `uint8 role`, then a big-endian `uint32` offset.
    function _record(bytes memory sites, uint256 at) private pure returns (FhevmAddressRole role, uint256 offset) {
        role = FhevmAddressRole(uint8(sites[at]));
        offset = (uint256(uint8(sites[at + 1])) << 24) | (uint256(uint8(sites[at + 2])) << 16)
            | (uint256(uint8(sites[at + 3])) << 8) | uint256(uint8(sites[at + 4]));
    }

    function _addressAt(bytes memory code, uint256 offset) private pure returns (address value) {
        uint256 word;
        for (uint256 i = 0; i < 20; i++) {
            word = (word << 8) | uint256(uint8(code[offset + i]));
        }
        value = address(uint160(word));
    }

    function _writeAddress(bytes memory code, uint256 offset, address value) private pure {
        uint160 word = uint160(value);
        for (uint256 i = 0; i < 20; i++) {
            // Most significant byte first, matching how `_addressAt` reads it back.
            code[offset + i] = bytes1(uint8(word >> (8 * (19 - i))));
        }
    }
}
