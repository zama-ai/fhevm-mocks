// @fhevm/sdk chain definitions. Public chains come from the SDK itself (it is the source of truth for
// them); the local cleartext chain is the one the SDK does not ship, so it is built here from the
// stack the connection actually deployed plus the gateway the cleartext package bootstraps against.

import {
  CLEARTEXT_DECRYPTION_ADDRESS,
  CLEARTEXT_GATEWAY_CHAIN_ID,
  CLEARTEXT_INPUT_VERIFICATION_ADDRESS,
  type Deployed,
} from '@fhevm/host-contracts-cleartext/ts';
import { type FhevmChain, defineFhevmChain } from '@fhevm/sdk/chains';
import { type Address, getAddress } from 'viem';

function contract(address: string): { address: Address } {
  return { address: getAddress(address) };
}

/** The cleartext chain a development connection runs on. `relayerUrl` is required by the type and unused in cleartext mode. */
export function cleartextChain(chainId: number, deployed: Deployed): FhevmChain {
  const { fhevmAddresses } = deployed;
  return defineFhevmChain({
    id: chainId,
    fhevm: {
      contracts: {
        acl: contract(fhevmAddresses.aclAddress),
        inputVerifier: contract(fhevmAddresses.inputVerifierAddress),
        kmsVerifier: contract(fhevmAddresses.kmsVerifierAddress),
        // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        // !!! TEMPORARY TRICK — REMOVE WHEN THE PATCHED @fhevm/sdk RELEASES ARE PINNED !!!
        // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        // `protocolConfig` is DELIBERATELY LEFT OUT of this chain definition. Without it, @fhevm/sdk 0.14 takes
        // its protocol-0.13 path and builds KMS extraData v1 (`0x01 | contextId`), exactly like sdk 0.13 —
        // instead of v2 (`0x02 | contextId | epochId`). The sdk's cleartext path does not pass the extraData it
        // verifies against to the host, so the host can only serve one version, and it serves v1.
        // This CONTRADICTS golden rule 5 ("sdk 14 always has the protocolConfig address"): it is a stopgap.
        // EXIT: once @fhevm/sdk 0.13.x and 0.14.x pass the extraData to the cleartext host, restore
        //   protocolConfig: contract(fhevmAddresses.protocolConfigAddress),
        // here AND in the other hardhat plugin, and set CleartextKMSVerifier's one-argument
        // publicDecrypt(handles) back to extraData v2.
        // Counterparts of this trick: hardhat/v2/plugin/pkg/src/internal/chains.ts (same omission) and
        // host-contracts-cleartext/v14/pkg/src/cleartext/CleartextKMSVerifier.sol, publicDecrypt(handles).
        // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
      },
      relayerUrl: 'http://localhost:8545',
      gateway: {
        id: Number(CLEARTEXT_GATEWAY_CHAIN_ID),
        contracts: {
          decryption: contract(CLEARTEXT_DECRYPTION_ADDRESS),
          inputVerification: contract(CLEARTEXT_INPUT_VERIFICATION_ADDRESS),
        },
      },
    },
  });
}
