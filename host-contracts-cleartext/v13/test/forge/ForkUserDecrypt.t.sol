// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {LibHostUpgradeCode} from "../../pkg/forge/src/LibHostUpgradeCode.sol";
import {
    ERC1967_PROXY_CREATION_CODE,
    FhevmAddressRole,
    FhevmHostContracts
} from "../../pkg/forge/src/_internal/LocalHostBytecode.sol";
import {IACL} from "../../pkg/forge/src/_internal/interfaces/IACL.sol";
import {ICleartextArithmetic} from "../../pkg/forge/src/_internal/interfaces/ICleartextArithmetic.sol";
import {ICleartextDB} from "../../pkg/forge/src/_internal/interfaces/ICleartextDB.sol";
import {IEmptyUUPSProxy} from "../../pkg/forge/src/_internal/interfaces/IEmptyUUPSProxy.sol";
import {
    HandleContractPair,
    LibKmsVerifier,
    SignerSignaturePair,
    UserDecryptRequestV1
} from "../../pkg/forge/src/shared/LibKmsVerifier.sol";

interface IUUPSProxy {
    function upgradeToAndCall(address newImplementation, bytes calldata data) external payable;
}

interface IFHETest {
    function setClearEuint64(uint64 value, bool makePublic) external returns (bytes32);
}

interface IEip712 {
    function eip712Domain()
        external
        view
        returns (bytes1, string memory, string memory, uint256, address, bytes32, uint256[] memory);
}

interface IAclPublicView {
    function isAllowedForDecryption(bytes32 handle) external view returns (bool);
}

interface IAclView {
    function persistAllowed(bytes32 handle, address account) external view returns (bool);
}

interface IPlaintextsView {
    function plaintexts(bytes32 handle) external view returns (uint256);
}

/**
 * @notice The whole fork story in one test: a value read back through a PRODUCTION KMS verifier that
 *         cannot read anything itself.
 *
 * @dev THE STACK ON THE FORK IS NOT TOUCHED. The real executor computes, the real ACL decides who may
 *      see the result, and `LibKmsVerifier.userDecryptV1OnForkStack` assembles the answer the cleartext
 *      verifier would have returned -- using the real verifier only for its domain, its context and its
 *      signer set.
 *
 * @dev WHERE THE CLEARTEXT COMES FROM, AND WHY IT IS STATED RATHER THAN DERIVED. `userDecryptV1OnForkStack`
 *      takes the plaintext source as a parameter, so this suite hands it a cleartext arithmetic of its
 *      own -- a store the fork's stack knows nothing about -- and TELLS it what a uint64 handle is worth
 *      through the unknown-handle policy. The mint above it is real: the real executor mints the handle
 *      and the real ACL grants it, which is what the permission walk below is about.
 *
 *      Deriving the cleartext from the chain instead would mean upgrading the forked stack, which is a
 *      subject of its own and has its own suites (`ForkCleartextUpgrade`, `ForkForgeVariantUpgrade`).
 *      Mixing it in here would make this file fail for two unrelated reasons. What is under test is the
 *      decrypt path: the domain, the permit, the ACL walk and the payload.
 *
 *          MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com forge test --match-contract ForkUserDecrypt
 */
contract ForkUserDecryptTest is Test {
    address internal constant MAINNET_ACL = 0xcA2E8f1F656CD25C01F05d0b243Ab1ecd4a8ffb6;
    address internal constant MAINNET_KMS_VERIFIER = 0x77627828a55156b04Ac0DC0eb30467f1a552BB03;
    address internal constant MAINNET_EXECUTOR = 0xD82385dADa1ae3E969447f20A3164F6213100e75;
    address internal constant FHE_TEST = 0xba4d707745689eD409d4Afac8722224f5FD78C63;

    uint256 internal constant ALICE_PK = uint256(keccak256("fork alice"));

    address internal arithmetic;
    address internal dbProxy;
    address internal alice;
    bytes internal publicKey;
    bool internal forked;

    function setUp() public {
        string memory rpc = vm.envOr("MAINNET_RPC_URL", string(""));
        if (bytes(rpc).length == 0) return;

        vm.createSelectFork(rpc);
        forked = true;
        alice = vm.addr(ALICE_PK);
        publicKey = abi.encodePacked(keccak256("transport key"));
        _installPlaintextSource();
    }

    /// @dev A cleartext store and arithmetic of this suite's own, behind the proxies they expect, wired
    ///      to nothing on the fork. `allowCheatcodes` on the proxy because the forge variant calls them
    ///      and forge did not create the code behind it.
    function _installPlaintextSource() private {
        address owner = IACL(MAINNET_ACL).owner();

        address emptyImpl = _create(LibHostUpgradeCode.creationCodeFor(FhevmHostContracts.EmptyUUPSProxy, _roles()));
        bytes memory initEmpty = abi.encodeCall(IEmptyUUPSProxy.initialize, ());
        dbProxy = _create(abi.encodePacked(ERC1967_PROXY_CREATION_CODE, abi.encode(emptyImpl, initEmpty)));
        arithmetic = _create(abi.encodePacked(ERC1967_PROXY_CREATION_CODE, abi.encode(emptyImpl, initEmpty)));

        address dbImpl = _create(LibHostUpgradeCode.creationCodeFor(FhevmHostContracts.CleartextDB, _roles()));
        vm.prank(owner);
        IUUPSProxy(dbProxy)
            .upgradeToAndCall(dbImpl, abi.encodeCall(ICleartextDB.initializeFromEmptyProxy, (arithmetic)));

        address arithmeticImpl =
            _create(LibHostUpgradeCode.creationCodeFor(FhevmHostContracts.CleartextArithmetic, _roles()));
        vm.prank(owner);
        IUUPSProxy(arithmetic)
            .upgradeToAndCall(arithmeticImpl, abi.encodeCall(ICleartextArithmetic.initializeFromEmptyProxy, ()));
    }

    /// @dev EVERY role, although this suite installs only two contracts: the patcher refuses a role it
    ///      has no address for, whichever contract happens to reference it. From the chain table.
    function _roles() private view returns (address[10] memory addresses) {
        addresses[uint8(FhevmAddressRole.ACL)] = MAINNET_ACL;
        addresses[uint8(FhevmAddressRole.FHEVMExecutor)] = MAINNET_EXECUTOR;
        addresses[uint8(FhevmAddressRole.KMSVerifier)] = MAINNET_KMS_VERIFIER;
        addresses[uint8(FhevmAddressRole.InputVerifier)] = 0xCe0FC2e05CFff1B719EFF7169f7D80Af770c8EA2;
        addresses[uint8(FhevmAddressRole.HCULimit)] = 0x3b4da65e45Fda2CAa0285A735ab4361a44F171E2;
        addresses[uint8(FhevmAddressRole.ProtocolConfig)] = 0xD8236B57394f90726b26aB25D38CeAC776E1a7C4;
        addresses[uint8(FhevmAddressRole.KMSGeneration)] = 0xf102cC9A9D2174630c394f5b7B7D63104E348daa;
        addresses[uint8(FhevmAddressRole.PauserSet)] = 0xbBfE1680b4a63ED05f7F80CE330BED7C992A586C;
        addresses[uint8(FhevmAddressRole.CleartextDB)] = dbProxy;
        addresses[uint8(FhevmAddressRole.CleartextArithmetic)] = arithmetic;
    }

    function _create(bytes memory creationCode) private returns (address deployed) {
        assembly {
            deployed := create(0, add(creationCode, 0x20), mload(creationCode))
        }
        require(deployed != address(0), "deploy failed");
    }

    modifier onlyForked() {
        vm.skip(!forked);
        _;
    }

    /// @dev A REAL mint on the real executor -- which is what grants alice on the real ACL -- and then
    ///      the value said out loud to a store that could not have derived it.
    function _mint(uint64 value) private returns (bytes32 handle) {
        vm.prank(alice);
        handle = IFHETest(FHE_TEST).setClearEuint64(value, false);

        _declare(handle, value);
        assertEq(IPlaintextsView(arithmetic).plaintexts(handle), value, "the source answers for it");
    }

    /// @dev What a handle is worth, as far as this suite's plaintext source is concerned. Written
    ///      straight into the store, as the arithmetic -- the only account the store takes writes from --
    ///      because nothing here could have computed it.
    function _declare(bytes32 handle, uint256 value) private {
        vm.prank(arithmetic);
        ICleartextDB(dbProxy).set(handle, value);
    }

    function _request() private view returns (UserDecryptRequestV1 memory) {
        address[] memory contracts = new address[](1);
        contracts[0] = FHE_TEST;
        return UserDecryptRequestV1({
            transportPublicKey: publicKey,
            contractAddresses: contracts,
            startTimestamp: block.timestamp,
            durationDays: 1
        });
    }

    /// @dev Signed under the HOST chain id, which is what the request domain uses.
    function _permit(UserDecryptRequestV1 memory request, uint256 pk) private view returns (bytes memory) {
        bytes32 digest = LibKmsVerifier.userDecryptionDigestV1(
            LibKmsVerifier.hostDomainSeparator(MAINNET_KMS_VERIFIER),
            request,
            LibKmsVerifier.currentExtraData(MAINNET_KMS_VERIFIER)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    /// @dev External so `pairs` arrives as calldata, which the library takes.
    function userDecrypt(HandleContractPair[] calldata pairs, UserDecryptRequestV1 memory request, bytes memory sig)
        external
        view
        returns (bytes memory payload, address[] memory signers, uint256 threshold, bytes memory extraData)
    {
        return LibKmsVerifier.userDecryptV1OnForkStack(
            MAINNET_KMS_VERIFIER, MAINNET_ACL, arithmetic, pairs, request, SignerSignaturePair(msg.sender, sig)
        );
    }

    function _pairs(bytes32 handle) private pure returns (HandleContractPair[] memory pairs) {
        pairs = new HandleContractPair[](1);
        pairs[0] = HandleContractPair({handle: handle, contractAddress: FHE_TEST});
    }

    /// The request domain is NOT the verifier's own: same name, version and verifying contract, but
    /// the HOST chain id rather than the gateway one it reports.
    ///
    /// @dev Computed here from `eip712Domain()` directly, because `_permit` signs with the same library
    ///      function this checks — a wrong chain id would cancel out and every other test would still
    ///      pass. This is the only assertion in the file that can see it.
    function test_theRequestDomainUsesTheHostChainId() public onlyForked {
        (, string memory name, string memory version, uint256 gatewayChainId, address verifyingContract,,) =
            IEip712(MAINNET_KMS_VERIFIER).eip712Domain();

        bytes32 expected = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(name)),
                keccak256(bytes(version)),
                block.chainid,
                verifyingContract
            )
        );

        assertEq(LibKmsVerifier.hostDomainSeparator(MAINNET_KMS_VERIFIER), expected, "host chain id");
        assertTrue(gatewayChainId != block.chainid, "the two chain ids really do differ");
        assertTrue(
            LibKmsVerifier.domainSeparator(MAINNET_KMS_VERIFIER) != expected,
            "and the verifier's own separator is a different one"
        );
    }

    /// The premise: the real ACL really did grant alice, so the permission walk is not a formality.
    function test_theRealAclGrantedTheMinter() public onlyForked {
        bytes32 handle = _mint(1337);

        assertTrue(IAclView(MAINNET_ACL).persistAllowed(handle, alice), "alice");
        assertTrue(IAclView(MAINNET_ACL).persistAllowed(handle, FHE_TEST), "the dApp");
    }

    /// THE WHOLE THING. A production verifier, a real ACL, a real mint, and 1337 comes back.
    function test_aValueIsReadBackThroughAProductionVerifier() public onlyForked {
        bytes32 handle = _mint(1337);
        UserDecryptRequestV1 memory request = _request();

        // Hoisted: `_permit` and `_pairs` make external calls, and an external call in argument
        // position consumes the prank before `userDecrypt` ever sees it.
        HandleContractPair[] memory pairs = _pairs(handle);
        bytes memory permit = _permit(request, ALICE_PK);

        vm.prank(alice);
        (bytes memory payload, address[] memory signers, uint256 threshold,) = this.userDecrypt(pairs, request, permit);

        (uint256[] memory masked,) = abi.decode(payload, (uint256[], bytes));
        assertEq(masked[0] ^ uint256(bytes32(publicKey)), 1337, "unmasked to the value the source holds");

        // The KMS metadata is the forked verifier's own, not the cleartext stack's.
        assertEq(signers.length, 13, "mainnet's KMS signer set");
        assertEq(threshold, 7);
    }

    /// The signature is really checked — a permit signed by somebody else is refused.
    function test_aPermitSignedBySomeoneElseIsRefused() public onlyForked {
        bytes32 handle = _mint(1337);
        UserDecryptRequestV1 memory request = _request();
        HandleContractPair[] memory pairs = _pairs(handle);
        bytes memory wrong = _permit(request, uint256(keccak256("mallory")));

        vm.prank(alice);
        vm.expectRevert(LibKmsVerifier.CleartextErrorInvalidUserDecryptSignature.selector);
        this.userDecrypt(pairs, request, wrong);
    }

    /// And the REAL ACL is really consulted — a handle alice was never granted is refused, by the
    /// forked chain's own state rather than by anything this test set up.
    function test_aHandleTheAclNeverGrantedIsRefused() public onlyForked {
        _mint(1337);

        // Someone else's handle, minted in a call alice had nothing to do with.
        vm.prank(makeAddr("bob"));
        bytes32 bobs = IFHETest(FHE_TEST).setClearEuint64(999, false);

        UserDecryptRequestV1 memory request = _request();
        HandleContractPair[] memory pairs = _pairs(bobs);
        bytes memory permit = _permit(request, ALICE_PK);

        vm.prank(alice);
        vm.expectRevert();
        this.userDecrypt(pairs, request, permit);
    }

    // -- Public decryption, same story ----------------------------------------------

    /// A publicly decryptable handle, read back through the production verifier: the value from this
    /// suite's own source, the permission from mainnet's own ACL, and the digest from the real verifier.
    function test_aPublicValueIsReadBackThroughAProductionVerifier() public onlyForked {
        vm.prank(alice);
        bytes32 handle = IFHETest(FHE_TEST).setClearEuint64(4711, true);
        _declare(handle, 4711);

        assertTrue(IAclPublicView(MAINNET_ACL).isAllowedForDecryption(handle), "made public on chain");

        bytes32[] memory handles = new bytes32[](1);
        handles[0] = handle;

        (bytes memory values, bytes32 digest, address[] memory signers,) =
            LibKmsVerifier.publicDecryptV1OnForkStack(MAINNET_KMS_VERIFIER, MAINNET_ACL, arithmetic, handles);

        assertEq(abi.decode(values, (uint64)), 4711, "decoded from the value the source holds");
        assertEq(signers.length, 13, "mainnet's KMS signer set");

        // The digest must be the one the values-supplied path produces for the same values — a
        // different function, proven on its own in `LibKmsVerifier.t.sol`. Without this the test would
        // accept a digest built under the wrong EIP-712 domain, which is exactly the easy mistake here:
        // a decryption RESULT is signed under the gateway chain id, a REQUEST under the host one.
        (bytes32 expected,,,) = LibKmsVerifier.publicDecryptProofDigest(MAINNET_KMS_VERIFIER, handles, values);
        assertEq(digest, expected, "same digest as the values-supplied path");
    }

    /// And a handle nobody made public is refused — by mainnet's ACL, not by this test.
    function test_aPrivateHandleIsRefusedForPublicDecryption() public onlyForked {
        vm.prank(alice);
        bytes32 handle = IFHETest(FHE_TEST).setClearEuint64(4711, false);
        _declare(handle, 4711);

        assertFalse(IAclPublicView(MAINNET_ACL).isAllowedForDecryption(handle), "never made public");

        bytes32[] memory handles = new bytes32[](1);
        handles[0] = handle;

        vm.expectRevert();
        this.publicDecryptExternally(handles);
    }

    /// External so `vm.expectRevert` has a call frame to catch.
    function publicDecryptExternally(bytes32[] memory handles) external view returns (bytes memory) {
        (bytes memory values,,,) =
            LibKmsVerifier.publicDecryptV1OnForkStack(MAINNET_KMS_VERIFIER, MAINNET_ACL, arithmetic, handles);
        return values;
    }
}
