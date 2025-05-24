import { FhevmHandle, FhevmType } from "@fhevm/mock-utils";
import { utils } from "@fhevm/mock-utils";
import { DecryptedResults, FhevmInstance, HandleContractPair } from "@zama-fhe/relayer-sdk/node";
import { ethers as EthersT } from "ethers";

import constants from "../constants";
import { HardhatFhevmError } from "../error";
import { FhevmKeypair, FhevmUserDecryptOptions } from "../types";
import { FhevmEnvironment } from "./FhevmEnvironment";
import { FhevmExternalAPI } from "./FhevmExternalAPI";

export async function userDecryptHandleBytes32(
  fhevmEnv: FhevmEnvironment,
  handleContractPairs: { handleBytes32: string; contractAddress: string; fhevmType?: FhevmType }[],
  user: EthersT.Signer,
  options?: FhevmUserDecryptOptions,
): Promise<DecryptedResults> {
  // Verify that contract addresses are well formed.
  _assertIsContractAddressesArray(handleContractPairs);

  // Resolve missing options (instance, keypair etc.)
  const userDecryptArgs = await _resolveUserDecryptOptions(fhevmEnv, options);

  // extract chainId from instance (FhevmInstance is missing getChainId function)
  const chainId = _getFhevmInstanceChainId(userDecryptArgs.instance);

  // Verify Fhevm handles
  _verifyFhevmHandleContractPairs(handleContractPairs, chainId);

  // Compute signature and list of contract addresses extracted and sorted from the handle/contract pairs
  const { signature, contractAddresses } = await _computeUserSignatureAndContractAddresses(
    handleContractPairs,
    user,
    userDecryptArgs,
  );

  // Prepare final arguments:
  // - user address
  // - array of CtHandleContractPair

  const userAddress = await user.getAddress();

  const handles: HandleContractPair[] = handleContractPairs.map((p) => {
    return { handle: p.handleBytes32, contractAddress: p.contractAddress };
  });

  // Call FhevmInstance userDecrypt
  const decryptedHandles: DecryptedResults = await userDecryptArgs.instance.userDecrypt(
    handles,
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
async function _resolveUserDecryptOptions(
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
    utils.verifyKeypair(keypair);
  } else {
    keypair = instance.generateKeypair();
  }

  const startTimestamp = options?.validity?.startTimestamp || utils.timestampNow();
  const durationDays = options?.validity?.durationDays || constants.DEFAULT_DURATION_DAYS;

  const startTimestampNumber = utils.toUIntNumber(startTimestamp, "startTimeStamp");
  const durationDaysNumber = utils.toUIntNumber(durationDays, "durationDays");

  return {
    instance,
    keypair,
    startTimestamp: startTimestampNumber,
    durationDays: durationDaysNumber,
  };
}

async function _computeUserSignatureAndContractAddresses(
  contractAddresses: ({ contractAddress: string } | string)[],
  user: EthersT.Signer,
  userDecryptArgs: FhevmUserDecryptArguments,
) {
  if (contractAddresses.length === 0) {
    throw new HardhatFhevmError("Empty list of contract addresses.");
  }

  // We use a deterministic method for convenience. (in case we need to rebuild the signature).
  const contractAddressesSortUnique = _buildDeterministicContractAddressesList(contractAddresses);

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

function _getFhevmInstanceChainId(instance: FhevmInstance): number {
  const dummyEIP712 = instance.createEIP712("", [EthersT.ZeroAddress], 0, 0);
  return dummyEIP712.message.contractsChainId;
}

function _buildDeterministicContractAddressesList(
  contractAddresses: ({ contractAddress: string } | string)[],
): string[] {
  const set = new Set<string>();

  // Build a list of unique allowed contact addresses.
  for (let i = 0; i < contractAddresses.length; ++i) {
    const ca = contractAddresses[i];
    let contractAddress: string;
    if (typeof ca === "string") {
      contractAddress = ca;
    } else {
      contractAddress = ca.contractAddress;
    }
    const add = EthersT.getAddress(contractAddress);
    if (!set.has(add)) {
      set.add(add);
    }
  }

  // Sort by alphabetical order, user lowercase comparison
  return [...set].sort((a, b) => {
    const addrA = a.toLowerCase(); // ignore upper and lowercase
    const addrB = b.toLowerCase(); // ignore upper and lowercase
    if (addrA < addrB) {
      return -1;
    }
    if (addrA > addrB) {
      return 1;
    }
    return 0;
  });
}

function _assertIsContractAddressesArray(contractAddresses: ({ contractAddress: string } | string)[]) {
  if (contractAddresses.length === 0) {
    throw new HardhatFhevmError("Empty list of contract addresses.");
  }

  for (let i = 0; i < contractAddresses.length; ++i) {
    const ca = contractAddresses[i];

    let contractAddress: string;
    if (typeof ca === "string") {
      contractAddress = ca;
    } else {
      contractAddress = ca.contractAddress;
    }
    utils.assertIsAddress(contractAddress, "contractAddress");
  }
}

function _verifyFhevmHandleContractPairs(
  handleContractPairs: { handleBytes32: string; contractAddress: string; fhevmType?: FhevmType }[],
  chainId?: number,
) {
  if (handleContractPairs.length === 0) {
    throw new HardhatFhevmError("Empty list of handle/contract pairs.");
  }

  for (let i = 0; i < handleContractPairs.length; ++i) {
    const pair = handleContractPairs[i];

    FhevmHandle.verify(pair.handleBytes32, {
      ...(pair.fhevmType !== undefined && { fhevmType: pair.fhevmType }),
      ...(chainId !== undefined && { chainId: chainId }),
    });

    utils.assertIsAddress(pair.contractAddress, "contractAddress");
  }
}
