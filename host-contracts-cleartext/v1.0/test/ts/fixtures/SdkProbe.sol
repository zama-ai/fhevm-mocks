// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

// The executor and ACL calls the FHE library makes underneath, declared here because the fhevm Solidity library is
// not a dependency of this package. `inputType` is the FheType enum, which the ABI encodes as uint8.
interface IProbeExecutor {
    function verifyInput(bytes32 inputHandle, address userAddress, bytes memory inputProof, uint8 inputType)
        external
        returns (bytes32);
    function trivialEncrypt(uint256 pt, uint8 toType) external returns (bytes32);
}

interface IProbeACL {
    function allow(bytes32 handle, address account) external;
    function allowForDecryption(bytes32[] memory handlesList) external;
}

/**
 * The smallest dApp an sdk client needs on the other side: it takes one encrypted input from the caller and grants
 * the result to itself and to the caller, so the caller can user-decrypt it (or delegate that), and it can make the
 * result publicly decryptable. `trivial` makes a value with no sdk at all, for a test that must not touch the sdk
 * before a given moment. An EOA cannot hold these grants itself: an input is only allowed transiently, to the
 * contract that verifies it, for the duration of the transaction.
 */
contract SdkProbe {
    IProbeExecutor private immutable _EXECUTOR;
    IProbeACL private immutable _ACL;

    bytes32 public handle;

    constructor(address executor, address acl) {
        _EXECUTOR = IProbeExecutor(executor);
        _ACL = IProbeACL(acl);
    }

    function submit(bytes32 inputHandle, bytes calldata inputProof, uint8 inputType) external {
        bytes32 verified = _EXECUTOR.verifyInput(inputHandle, msg.sender, inputProof, inputType);
        _ACL.allow(verified, address(this));
        _ACL.allow(verified, msg.sender);
        handle = verified;
    }

    function trivial(uint256 value, uint8 fheType) external {
        bytes32 made = _EXECUTOR.trivialEncrypt(value, fheType);
        _ACL.allow(made, address(this));
        _ACL.allow(made, msg.sender);
        handle = made;
    }

    function makePubliclyDecryptable() external {
        bytes32[] memory handles = new bytes32[](1);
        handles[0] = handle;
        _ACL.allowForDecryption(handles);
    }
}
