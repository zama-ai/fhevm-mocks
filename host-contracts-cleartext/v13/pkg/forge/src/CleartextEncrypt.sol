// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {ACL_ADDRESS, INPUT_VERIFIER_ADDRESS} from "./_internal/LocalHostAddresses.sol";
import {LocalHostBootstrap} from "./_internal/LocalHostBootstrap.sol";
import {ICleartextInputVerifier} from "./_internal/interfaces/ICleartextInputVerifier.sol";
import {IForgeVm, FORGE_VM_ADDRESS} from "./IForgeVm.sol";

/**
 * @title CleartextEncrypt
 * @notice Builds the `(handles, inputProof)` pair a dApp's `FHE.fromExternal` expects, for a cleartext
 *         stack standing at the canonical localhost addresses.
 * @dev A `library`, so a forge user reaches it without inheriting anything:
 *
 * ```solidity
 * import {CleartextEncrypt} from "host-contracts-cleartext-forge/CleartextEncrypt.sol";
 *
 * uint8[] memory types = new uint8[](1);
 * uint256[] memory values = new uint256[](1);
 * types[0] = 5; // FheType.Uint64
 * values[0] = 42;
 *
 * (bytes32[] memory handles, bytes memory proof) =
 *     CleartextEncrypt.encrypt(types, values, address(dapp), alice);
 * dapp.submit(handles[0], proof);
 * ```
 *
 * ## This mirrors the js-sdk, not an approximation of it
 *
 * The handle derivation, the packed proof layout and the metadata blob below are ports of the SDK's
 * cleartext path — `buildWithProofPacked`, `_zkProofToInputHandles` and `InputProof`. A handle computed
 * any other way is rejected by `InputVerifier`, so the two must agree byte for byte.
 *
 * ## No ciphertext exists
 *
 * Nothing here encrypts. A cleartext stack reads the plaintexts straight out of the proof's trailing
 * `extraData`, which the real `InputVerifier` treats as opaque bytes folded into the signed EIP-712
 * digest. One region, two readers: the verifier authenticates it, `CleartextArithmetic` reads the values
 * out of it. The "ciphertext" blob is still built, because the handle hashes over it, but it carries the
 * plaintext in the clear.
 *
 * ## Types are `uint8`, not `FheType`
 *
 * A dApp under test imports the FHE library, not these host contracts, so `FheType` is not in its scope.
 * The type id is a single byte of the handle either way, so it is taken as `uint8`. The ids are the
 * ordinals of `FheType` in `pkg/src/contracts/shared/FheType.sol`.
 *
 * ## Handles differ every call
 *
 * The blob carries a random 8-byte nonce per value, drawn with the `randomUint` cheatcode exactly as the
 * SDK draws it with `crypto.getRandomValues`. The handle hashes over that blob, so encrypting the same
 * value twice yields two different handles, which is what the protocol expects.
 */
library CleartextEncrypt {
    IForgeVm private constant fvm = IForgeVm(FORGE_VM_ADDRESS);

    /// @dev Domain separator over the raw "ciphertext" blob. `FHEVM_HANDLE_RAW_CT_HASH_DOMAIN_SEPARATOR`.
    bytes8 private constant RAW_CT_HASH_DOMAIN = "ZK-w_rct";
    /// @dev Domain separator over the per-index handle hash. `FHEVM_HANDLE_HASH_DOMAIN_SEPARATOR`.
    bytes8 private constant HANDLE_HASH_DOMAIN = "ZK-w_hdl";
    /// @dev The caller's extraData, whose FIRST byte is a format version. `EXTRA_DATA_V0` in the SDK's
    ///      `kms/kmsExtraData-p.ts`: v0 is the version byte alone, v1 adds a 32-byte KMS context id (33
    ///      bytes), v2 adds an epoch id too (65 bytes). `coprocessor/encrypt.ts` hard-codes v0 rather than
    ///      importing the constant, so this mirrors the literal. Covered by the signed digest, which is
    ///      why it is reproduced rather than dropped.
    bytes1 private constant EXTRA_DATA_V0 = 0x00;

    /// @dev Trailing byte of every handle. `FHEVM_HANDLE_CURRENT_CIPHERTEXT_VERSION`.
    uint8 private constant HANDLE_VERSION = 0;

    /// @dev The signer pools sit on their own mnemonic and HD path, NOT the deployer's. Mirrors
    ///      `CLEARTEXT_COPROCESSORS_MNEMONIC*` in the vendored cleartext config; `_coprocessorKeyFor`
    ///      re-derives each address and reverts rather than signing with a key the stack never registered.
    string private constant SIGNER_MNEMONIC = "test test test test test test test future home engine virtual motion";
    string private constant COPROCESSOR_PATH = "m/44'/60'/0'/2/";

    error InputLengthMismatch(uint256 typeIds, uint256 values);
    error TooManyInputs(uint256 count);
    error ThresholdExceedsSigners(uint256 threshold, uint256 signers);
    error UnknownCoprocessorSigner(address signer);
    error CoprocessorKeyMismatch(uint256 index, address derived, address registered);

    /**
     * @notice Bundles `values` into external handles plus the proof that authenticates them.
     * @param typeIds One `FheType` ordinal per value.
     * @param values The plaintexts, each already fitting its type's width.
     * @param contractAddress The dApp that will call `FHE.fromExternal`.
     * @param userAddress The account that will call that dApp.
     * @dev Both addresses are bound into the metadata the handle hashes over AND into the signed digest,
     *      so a bundle cannot be replayed by another caller or against another contract.
     */
    function encrypt(uint8[] memory typeIds, uint256[] memory values, address contractAddress, address userAddress)
        internal
        view
        returns (bytes32[] memory handles, bytes memory inputProof)
    {
        if (typeIds.length != values.length) revert InputLengthMismatch(typeIds.length, values.length);
        // The index occupies one byte of the handle and `InputVerifier` rejects anything above 254.
        if (values.length == 0 || values.length > 254) revert TooManyInputs(values.length);

        uint256 n = values.length;

        bytes32 blobHash = _blobHash(values, contractAddress, userAddress);

        bytes memory cleartextExtraData = _cleartextExtraData(values);

        handles = new bytes32[](n);
        for (uint256 i = 0; i < n; i++) {
            handles[i] = _inputHandle(blobHash, i, typeIds[i]);
        }

        // The stack says what to sign and who may sign it, so the EIP-712 domain is never rebuilt here.
        (bytes32 digest, address[] memory signers, uint256 threshold) =
            ICleartextInputVerifier(INPUT_VERIFIER_ADDRESS).inputProof(handles, userAddress, contractAddress, cleartextExtraData);

        // A random threshold-sized subset of the signers the stack named, exactly as the SDK chooses one.
        uint256[] memory chosen = _randomUniqueIndices(signers.length, threshold);
        bytes memory signatures;
        for (uint256 j = 0; j < threshold; j++) {
            (uint8 v, bytes32 r, bytes32 s) = fvm.sign(_coprocessorKeyFor(signers[chosen[j]]), digest);
            signatures = abi.encodePacked(signatures, r, s, v);
        }

        // <len(handles)><len(signatures)><handles: 32 each><signatures: 65 each><cleartextExtraData>
        inputProof = abi.encodePacked(uint8(n), uint8(threshold), _packHandles(handles), signatures, cleartextExtraData);
    }

    // ---------------------------------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------------------------------

    /**
     * @dev The hash every handle in a bundle is derived from, over the "ciphertext" blob the SDK builds
     *      in `buildWithProofPacked`: per value `nonce(8) || metaData(92) || value(32)`, where the
     *      metadata is `contract || user || ACL || chainId` and is identical for every value.
     *
     *      Nothing is encrypted. The blob carries the plaintext, and exists only because the handle has
     *      to hash over something the protocol would have made a ciphertext.
     *
     *      The nonce is drawn per value with `randomUint`, mirroring the SDK's `crypto.getRandomValues`.
     *      It is the only varying input, so it alone is what makes the same values yield fresh handles.
     */
    function _blobHash(uint256[] memory values, address contractAddress, address userAddress)
        private
        view
        returns (bytes32)
    {
        bytes memory metaData = abi.encodePacked(contractAddress, userAddress, ACL_ADDRESS, block.chainid);
        bytes memory ciphertext;
        for (uint256 i = 0; i < values.length; i++) {
            ciphertext = abi.encodePacked(ciphertext, bytes8(bytes32(fvm.randomUint())), metaData, bytes32(values[i]));
        }
        return keccak256(abi.encodePacked(RAW_CT_HASH_DOMAIN, ciphertext));
    }

    /**
     * @dev NOT real extraData. A production bundle carries opaque caller data in this field; a cleartext
     *      bundle smuggles the PLAINTEXTS through it, which is the whole trick of this stack.
     *
     *      One region, two readers. `InputVerifier` folds all of it into the signed EIP-712 digest as
     *      opaque bytes and never looks inside, while `CleartextArithmetic._tryReadCleartextFromProof`
     *      reads the leading 32-byte words straight back out as the values.
     *
     *      The real caller extraData follows the words: a single `0x00`, the v0 format version, which the
     *      SDK hard-codes. It is covered by the digest, so it is reproduced rather than dropped. The
     *      reader locates values by offset, so the trailing byte is invisible to it. A stack using KMS
     *      context ids would send v1 or v2 here instead, and this is the line that would have to change.
     *
     *      Named after the SDK's own `cleartextExtraData` in `buildWithProofPacked`.
     */
    function _cleartextExtraData(uint256[] memory values) private pure returns (bytes memory out) {
        for (uint256 i = 0; i < values.length; i++) {
            out = abi.encodePacked(out, bytes32(values[i]));
        }
        out = abi.encodePacked(out, EXTRA_DATA_V0);
    }

    /**
     * @dev The handle `InputVerifier` expects:
     *      hash21[0:20] || index[21] || chainId[22:29] || fheTypeId[30] || version[31]
     *
     *      where hash21 is the first 21 bytes of
     *      `keccak256("ZK-w_hdl" || blobHash || index || ACL || chainId)`.
     */
    function _inputHandle(bytes32 blobHash, uint256 index, uint8 typeId) private view returns (bytes32) {
        bytes21 hash21 =
            bytes21(keccak256(abi.encodePacked(HANDLE_HASH_DOMAIN, blobHash, uint8(index), ACL_ADDRESS, block.chainid)));

        // bytes21 -> bytes32 left-aligns, so bytes 21..31 arrive zeroed and are filled in below.
        uint256 h = uint256(bytes32(hash21));
        h |= index << 80;
        h |= uint256(uint64(block.chainid)) << 16;
        h |= uint256(typeId) << 8;
        h |= uint256(HANDLE_VERSION);
        return bytes32(h);
    }

    /**
     * @dev `count` distinct indices drawn uniformly from `[0, n)`, mirroring the SDK's
     *      `randomUniqueUints`: a partial Fisher-Yates shuffle of the index pool, first `count` taken.
     *
     *      Signing with the first `threshold` signers would also verify, because `InputVerifier` only
     *      counts distinct valid signers against the threshold. Choosing at random is what makes a forge
     *      test exercise the same signer-set variability a real client produces, instead of pinning one
     *      subset forever and never noticing a bug the others would surface.
     */
    function _randomUniqueIndices(uint256 n, uint256 count) private view returns (uint256[] memory pool) {
        if (count > n) revert ThresholdExceedsSigners(count, n);
        pool = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            pool[i] = i;
        }
        for (uint256 i = 0; i < count; i++) {
            uint256 j = i + (fvm.randomUint() % (n - i));
            (pool[i], pool[j]) = (pool[j], pool[i]);
        }
    }

    /// @dev The key for a signer the stack actually registered, or a revert. Never signs with a key the
    ///      verifier does not know, which would otherwise surface as an opaque proof rejection.
    function _coprocessorKeyFor(address signer) private pure returns (uint256 privateKey) {
        address[] memory registered = LocalHostBootstrap.coprocessorSigners();
        for (uint256 i = 0; i < registered.length; i++) {
            if (registered[i] != signer) continue;
            privateKey = fvm.deriveKey(SIGNER_MNEMONIC, COPROCESSOR_PATH, uint32(i));
            address derived = fvm.addr(privateKey);
            if (derived != signer) revert CoprocessorKeyMismatch(i, derived, signer);
            return privateKey;
        }
        revert UnknownCoprocessorSigner(signer);
    }

    /// @dev `abi.encodePacked` on a bytes32[] concatenates with no length prefix — the proof's handle
    ///      section exactly.
    function _packHandles(bytes32[] memory handles) private pure returns (bytes memory out) {
        for (uint256 i = 0; i < handles.length; i++) {
            out = abi.encodePacked(out, handles[i]);
        }
    }
}
