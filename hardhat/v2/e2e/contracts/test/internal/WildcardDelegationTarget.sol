// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, externalEuint64, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @notice Minimal app contract for the wildcard-delegation tests: it seeds an encrypted handle whose
///         ACL access belongs to a delegator, so a second app contract address is available without
///         standing up a whole confidential token.
/// @dev The deposit grants the handle to this contract AND to `delegator`, which is exactly what
///      `ACL.isHandleDelegatedForUserDecryption` requires of both parties before it even looks at the
///      delegation table. A test that wants the opposite — an owner the delegator is not — deposits
///      under a different address.
contract WildcardDelegationTarget is ZamaEthereumConfig {
    mapping(address => euint64) private _values;

    /// @notice Store an encrypted input under `delegator`, granting ACL access to this contract and to
    ///         `delegator`.
    function deposit(address delegator, externalEuint64 inputHandle, bytes calldata inputProof) external {
        euint64 v = FHE.fromExternal(inputHandle, inputProof);
        FHE.allowThis(v);
        FHE.allow(v, delegator);
        _values[delegator] = v;
    }

    /// @notice Returns the handle stored for `delegator`, or the zero handle when nothing was deposited.
    function euint64Of(address delegator) external view returns (bytes32) {
        return euint64.unwrap(_values[delegator]);
    }
}
