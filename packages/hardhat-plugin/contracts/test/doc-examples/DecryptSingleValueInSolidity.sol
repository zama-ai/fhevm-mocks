// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import { FHE, euint32 } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract DecryptSingleValueInSolidity is SepoliaConfig {
    euint32 private _encryptedUint32; // = 0 (uninitizalized)
    uint32 private _clearUint32; // = 0 (uninitizalized)

    // solhint-disable-next-line no-empty-blocks
    constructor() {}

    function initializeUint32(uint32 value) external {
        // Compute a trivial FHE formula _trivialEuint32 = value + 1
        _encryptedUint32 = FHE.add(FHE.asEuint32(value), FHE.asEuint32(1));

        // Grant FHE permissions to:
        // ✅ The contract itself (`address(this)`): allows it to request async decryption to the FHEVM backend
        //
        // Note: If you forget to call `FHE.allowThis(_trivialEuint32)`,
        //       any async decryption request of `_trivialEuint32`
        //       by the contract itself (`address(this)`) will fail!
        FHE.allowThis(_encryptedUint32);
    }

    function initializeUint32Wrong(uint32 value) external {
        // Compute a trivial FHE formula _trivialEuint32 = value + 1
        _encryptedUint32 = FHE.add(FHE.asEuint32(value), FHE.asEuint32(1));
    }

    function requestDecryptSingleUint32() external {
        bytes32[] memory cypherTexts = new bytes32[](1);
        cypherTexts[0] = FHE.toBytes32(_encryptedUint32);

        // Two possible outcomes:
        // ✅ If `initializeUint32` was called, the decryption request will succeed.
        // ❌ If `initializeUint32Wrong` was called, the decryption request will fail 💥
        //
        // Explanation:
        // The request succeeds only if the contract itself (`address(this)`) was granted
        // the necessary FHE permissions. Missing `FHE.allowThis(...)` will cause failure.
        FHE.requestDecryption(
            // the list of encrypte values we want to decrypt
            cypherTexts,
            // the function selector the FHEVM backend will callback with the clear values as arguments
            this.callbackDecryptSingleUint32.selector
        );
    }

    /// @notice Callback function for 32-bit unsigned integer decryption
    /// @param requestID The ID of the decryption request
    /// @param cleartexts The decrypted 32-bit unsigned integer ABI encoded in bytes
    /// @param decryptionProof The decryption proof containing KMS signatures and extra data
    function callbackDecryptSingleUint32(
        uint256 requestID,
        bytes memory cleartexts,
        bytes memory decryptionProof
    ) external {
        //
        // ===============================
        //    ☠️🔒 SECURITY WARNING! 🔒☠️
        // ===============================
        //
        // Must call `FHE.checkSignatures(...)` here!
        //            ------------------------
        //
        // This callback must only be called by the authorized FHEVM backend.
        // To enforce this, the contract author MUST verify the authenticity of the caller
        // by using the `FHE.checkSignatures` helper. This ensures that the provided signatures
        // match the expected FHEVM backend and prevents unauthorized or malicious calls.
        //
        // Failing to perform this verification allows anyone to invoke this function with
        // forged values, potentially compromising contract integrity.
        //
        // The responsibility for signature validation lies entirely with the contract author.
        //
        FHE.checkSignatures(requestID, cleartexts, decryptionProof);
        uint32 decryptedInput = abi.decode(cleartexts, (uint32));
        _clearUint32 = decryptedInput;
    }

    function clearUint32() public view returns (uint32) {
        return _clearUint32;
    }
}
