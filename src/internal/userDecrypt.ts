import { HandleContractPair } from "@fhevm/sdk/node";
import { FhevmInstance } from "@fhevm/sdk/node";
import { ethers as EthersT } from "ethers";

import constants from "../constants";
import { HardhatFhevmError } from "../error";
import { FhevmKeypair, FhevmUserDecryptOptions } from "../types";
import { FhevmEnvironment } from "./FhevmEnvironment";
import { FhevmExternalAPI } from "./FhevmExternalAPI";
import { FhevmType } from "./handle/FhevmType";
import {
  buildDeterministicContractAddressesList,
  verifyContractAddresses,
  verifyFhevmHandleContractPairs,
} from "./handle/handle";
import { verifyKeypair } from "./keypair";
import { toUIntNumber } from "./utils/math";
import { timestampNow } from "./utils/time";

type FhevmUserDecryptArguments = {
  instance: FhevmInstance;
  keypair: FhevmKeypair;
  startTimestamp: number;
  durationDays: number;
};

/**
 * - Creates a new FhevmInstance if needed.
 * - Generates a new FhevmKeypair or checks a given FhevmKeypair passed as argument.
 * - Generates a new FhevmUserDecryptValidity object or checks a given FhevmUserDecryptValidity passed as argument.
 */
async function resolveUserDecryptOptions(
  fhevmEnv: FhevmEnvironment,
  options?: FhevmUserDecryptOptions,
): Promise<FhevmUserDecryptArguments> {
  let instance: FhevmInstance;
  if (options?.instance) {
    instance = options.instance;
  } else if (fhevmEnv.getInstanceOrUndefined()) {
    instance = fhevmEnv.instance;
  } else {
    instance = await (fhevmEnv.externalFhevmAPI as FhevmExternalAPI).createInstance();
  }

  let keypair: FhevmKeypair;

  if (options?.keypair !== undefined) {
    keypair = { ...options.keypair };
    verifyKeypair(keypair);
  } else {
    keypair = instance.generateKeypair();
  }

  const startTimestamp = options?.validity?.startTimestamp || timestampNow();
  const durationDays = options?.validity?.durationDays || constants.DEFAULT_DURATION_DAYS;

  const startTimestampNumber = toUIntNumber(startTimestamp, "startTimeStamp");
  const durationDaysNumber = toUIntNumber(durationDays, "durationDays");

  return {
    instance,
    keypair,
    startTimestamp: startTimestampNumber,
    durationDays: durationDaysNumber,
  };
}

async function computeUserSignatureAndContractAddresses(
  contractAddresses: ({ contractAddress: string } | string)[],
  user: EthersT.Signer,
  userDecryptArgs: FhevmUserDecryptArguments,
) {
  if (contractAddresses.length === 0) {
    throw new HardhatFhevmError("Empty list of contract addresses.");
  }

  // We use a deterministic method for convenience. (in case we need to rebuild the signature).
  const contractAddressesSortUnique = buildDeterministicContractAddressesList(contractAddresses);

  if (contractAddressesSortUnique.length === 0) {
    throw new HardhatFhevmError("Empty list of valid contract addresses.");
  }

  const eip712 = userDecryptArgs.instance.createEIP712(
    userDecryptArgs.keypair.publicKey,
    contractAddressesSortUnique,
    userDecryptArgs.startTimestamp,
    userDecryptArgs.durationDays,
  );

  const signature = await user.signTypedData(
    eip712.domain,
    { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
    eip712.message,
  );

  return {
    signature,
    contractAddresses: contractAddressesSortUnique,
  };
}

function getFhevmInstanceChainId(instance: FhevmInstance): number {
  const dummyEIP712 = instance.createEIP712("", [EthersT.ZeroAddress], 0, 0);
  return dummyEIP712.message.contractsChainId;
}

export async function userDecryptHandleBytes32(
  fhevmEnv: FhevmEnvironment,
  handleContractPairs: { handleBytes32: string; contractAddress: string; fhevmType?: FhevmType }[],
  user: EthersT.Signer,
  options?: FhevmUserDecryptOptions,
): Promise<bigint[]> {
  // Verify that contract addresses are well formed.
  verifyContractAddresses(handleContractPairs);

  // Resolve missing options (instance, keypair etc.)
  const userDecryptArgs = await resolveUserDecryptOptions(fhevmEnv, options);

  // extract chainId from instance (FhevmInstance is missing getChainId function)
  const chainId = getFhevmInstanceChainId(userDecryptArgs.instance);

  // Verify Fhevm handles
  verifyFhevmHandleContractPairs(handleContractPairs, chainId);

  // Compute signature and list of contract addresses extracted and sorted from the handle/contract pairs
  const { signature, contractAddresses } = await computeUserSignatureAndContractAddresses(
    handleContractPairs,
    user,
    userDecryptArgs,
  );

  // Prepare final arguments:
  // - user address
  // - array of CtHandleContractPair

  const userAddress = await user.getAddress();

  const ctHandles: HandleContractPair[] = handleContractPairs.map((p) => {
    return { ctHandle: p.handleBytes32, contractAddress: p.contractAddress };
  });

  // Call FhevmInstance userDecrypt
  const decryptedHandles: bigint[] = await userDecryptArgs.instance.userDecrypt(
    ctHandles,
    userDecryptArgs.keypair.privateKey,
    userDecryptArgs.keypair.publicKey,
    signature,
    contractAddresses,
    userAddress,
    userDecryptArgs.startTimestamp,
    userDecryptArgs.durationDays,
  );

  return decryptedHandles;
}
