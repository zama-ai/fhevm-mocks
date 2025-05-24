import { BytesLike, ethers as EthersT } from "ethers";
import { ProviderError } from "hardhat/internal/core/providers/errors";

import { assertHHFhevm } from "../error";

export async function assertSignersMatchAddresses(signers: EthersT.Signer[], addresses: string[]) {
  assertHHFhevm(Array.isArray(addresses));
  assertHHFhevm(Array.isArray(signers));
  assertHHFhevm(addresses.length === signers.length);

  for (let i = 0; i < addresses.length; ++i) {
    assertHHFhevm(addresses[i] === (await signers[i].getAddress()));
  }
}

export function extractEVMErrorData(e: unknown): { data: BytesLike; txHash: string } | undefined {
  /*

        If --network localhost
        ======================

        ProviderError.data = {
          message: "Error: VM Exception while processing transac…000bc6c18ca79490f36204c75cc6d6882bb9f335535)",
          txHash: "0x82e9cc197831a924d15e34b8f259dddace04fc0017f33bd28743776e0775ef45",
          data: "0x6475522d000000000000000000000000bc6c18ca79490f36204c75cc6d6882bb9f335535",
        }

        or: 

        If --network hardhat
        ====================

        Error = {
          message: "Error: VM Exception while processing transac…000bc6c18ca79490f36204c75cc6d6882bb9f335535)",
          txHash: "0x82e9cc197831a924d15e34b8f259dddace04fc0017f33bd28743776e0775ef45",
          data: "0x6475522d000000000000000000000000bc6c18ca79490f36204c75cc6d6882bb9f335535",
        }

  */

  let data: BytesLike | undefined;
  let txHash: string | undefined;

  if (ProviderError.isProviderError(e)) {
    if (!e.data || typeof e.data !== "object") {
      return undefined;
    }
    const providerErrorData: object = e.data;

    if ("data" in providerErrorData && EthersT.isBytesLike(providerErrorData.data)) {
      data = providerErrorData.data;
    }
    if ("txHash" in providerErrorData && EthersT.isHexString(providerErrorData.txHash)) {
      txHash = providerErrorData.txHash;
    }
  } else {
    if (e instanceof Error && "data" in e && EthersT.isBytesLike(e.data)) {
      data = e.data;
    }
    if (e instanceof Error && "transactionHash" in e && EthersT.isHexString(e.transactionHash)) {
      txHash = e.transactionHash;
    }
  }

  if (data !== undefined) {
    assertHHFhevm(txHash !== undefined);
    return { data, txHash };
  }

  return undefined;
}
