// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import { FHE, ebool, euint32, euint64 } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract DecryptMultipleValuesInSolidity is SepoliaConfig {
    ebool private _encryptedBool; // = 0 (uninitizalized)
    euint32 private _encryptedUint32; // = 0 (uninitizalized)
    euint64 private _encryptedUint64; // = 0 (uninitizalized)

    bool private _clearBool; // = 0 (uninitizalized)
    uint32 private _clearUint32; // = 0 (uninitizalized)
    uint64 private _clearUint64; // = 0 (uninitizalized)

    // solhint-disable-next-line no-empty-blocks
    constructor() {}

    function initialize(bool a, uint32 b, uint64 c) external {
        // Compute 3 trivial FHE formulas

        // _encryptedBool = a ^ false
        _encryptedBool = FHE.xor(FHE.asEbool(a), FHE.asEbool(false));

        // _encryptedUint32 = b + 1
        _encryptedUint32 = FHE.add(FHE.asEuint32(b), FHE.asEuint32(1));

        // _encryptedUint64 = c + 1
        _encryptedUint64 = FHE.add(FHE.asEuint64(c), FHE.asEuint64(1));

        // see `DecryptSingleValueInSolidity.sol` for more detailed explanations
        // about FHE permissions and asynchronous decryption requests.
        FHE.allowThis(_encryptedBool);
        FHE.allowThis(_encryptedUint32);
        FHE.allowThis(_encryptedUint64);
    }

    function requestDecryptMultipleValues() external {
        // To decrypt multiple values, we must construct an array of the encrypted values
        // we want to decrypt.
        //
        // ⚠️ Warning: The order of values in the array is critical!
        // The FHEVM backend will pass the decrypted values to the callback function
        // in the exact same order they appear in this array.
        // Therefore, the order must match the parameter declaration in the callback.
        bytes32[] memory cypherTexts = new bytes32[](3);
        cypherTexts[0] = FHE.toBytes32(_encryptedBool);
        cypherTexts[1] = FHE.toBytes32(_encryptedUint32);
        cypherTexts[2] = FHE.toBytes32(_encryptedUint64);

        FHE.requestDecryption(
            // the list of encrypte values we want to decrypt
            cypherTexts,
            // Selector of the Solidity callback function that the FHEVM backend will call with
            // the decrypted (clear) values as arguments
            this.callbackDecryptMultipleValues.selector
        );
    }

    /// @notice Callback function for multiple values decryption
    /// @param requestID The ID of the decryption request
    /// @param cleartexts The decrypted values ABI encoded in bytes
    /// @param decryptionProof The decryption proof containing KMS signatures and extra data
    function callbackDecryptMultipleValues(
        uint256 requestID,
        bytes memory cleartexts,
        bytes memory decryptionProof
    ) external {
        // ⚠️ Don't forget the signature checks! (see `DecryptSingleValueInSolidity.sol` for detailed explanations)
        FHE.checkSignatures(requestID, cleartexts, decryptionProof);
        (bool decryptedBool, uint32 decryptedUint32, uint64 decryptedUint64) = abi.decode(cleartexts, (bool, uint32, uint64));
        _clearBool = decryptedBool;
        _clearUint32 = decryptedUint32;
        _clearUint64 = decryptedUint64;
    }

    function clearBool() public view returns (bool) {
        return _clearBool;
    }

    function clearUint32() public view returns (uint32) {
        return _clearUint32;
    }

    function clearUint64() public view returns (uint64) {
        return _clearUint64;
    }
}
