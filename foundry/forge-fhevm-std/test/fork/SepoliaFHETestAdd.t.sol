// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {euint32, externalEuint32} from "encrypted-types/EncryptedTypes.sol";

import {TestFhevm} from "../../pkg/src/TestFhevm.sol";
import {fhevm} from "../../pkg/src/FhevmVm.sol";
import {ForkBlocks} from "../shared/ForkBlocks.sol";

/// The slice of Sepolia's deployed `FHETest` (fhevm/sdk/js-sdk/contracts/src/FHETest.sol) this test drives.
interface IFHETest {
    function getEuint32Of(address account) external view returns (euint32);
    function addEuint32(externalEuint32 input, bytes calldata inputProof, uint32 clearValue, bool makePublic) external;
}

/**
 * @notice Fork Sepolia, add an encrypted value to one `FHETest` already holds, decrypt the sum.
 *
 *          SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com forge test --match-contract SepoliaFHETestAdd
 */
contract SepoliaFHETestAddTest is TestFhevm {
    /// @dev A deployed `FHETest`, and an address that set a euint32 on it long before any block this test forks at.
    IFHETest internal constant FHE_TEST = IFHETest(0x94B9d3aF050687D1F76251aD7D09a1F216a19845);
    address internal constant SENDER = 0x37AC010c1c566696326813b840319B58Bb5840E4;

    bool internal forked;

    function setUp() public override {
        // Opt in, not the URL: `getFhevmChain` always resolves one (an override, `foundry.toml`, this
        // variable, or its default), so the variable's presence is the only signal that a run wants the
        // network. Offline the test skips, per rules.md §7.3.
        if (!ForkBlocks.enabled("sepolia")) return; // opt in: [rpc_endpoints] sepolia, or SEPOLIA_RPC_URL

        // One line: fork, and name the stack the fork is on. The SDK prepares it (signers, replay,
        // protocol) at the first call below; nothing else to set up.
        FhevmChain memory sepolia = getFhevmChain("testnet", "sepolia");
        fhevm.createSelectFork(sepolia, ForkBlocks.recent(sepolia.rpcUrl));
        forked = true;
    }

    function test_addToAnExistingValueAndDecrypt() public {
        vm.skip(!forked);

        // 1. The value `FHETest` already holds. Minted before the fork, so nothing can know it...
        euint32 current = FHE_TEST.getEuint32Of(SENDER);
        // 2. ...and the test states what it is worth.
        forkUnknown(current, 1000);

        // 3. Encrypt a new value, as SENDER would through the SDK.
        (externalEuint32 input, bytes memory proof) = encryptUint32(337, address(FHE_TEST), SENDER);

        // 4. Add on Sepolia, publicly decryptable.
        vm.prank(SENDER);
        FHE_TEST.addEuint32(input, proof, 337, true);

        // 5. Decrypt the sum.
        assertEq(decryptPublic(FHE_TEST.getEuint32Of(SENDER)), 1337);
    }
}
