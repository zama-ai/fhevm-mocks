import { ethers as EthersT } from "ethers";

import constants from "../constants.js";
import type { DecryptedResults, FhevmInstance, HandleContractPair } from "../relayer-sdk/types.js";
import { assertIsAddress } from "../utils/address.js";
import { FhevmError } from "../utils/error.js";
import { verifyKeypair } from "../utils/keypair.js";
import { toUIntNumber } from "../utils/math.js";
import { timestampNow } from "../utils/time.js";
import { FhevmHandle } from "./FhevmHandle.js";
import type { FhevmType } from "./FhevmType.js";

export type FhevmKeypair = {
  publicKey: string;
  privateKey: string;
};

/**
 * Represents a time-bound validity constraint for a user decryption request.
 *
 * This structure defines a window of time during which a user decryption
 * request is considered valid. It is typically used to ensure that the request
 * cannot be reused or replayed outside of the authorized interval.
 *
 * - `startTimestamp` defines the beginning of the validity window, as a Unix
 *   timestamp in seconds (POSIX time).
 * - `durationDays` defines how long the validity window remains open, measured
 *   in full calendar days.
 *
 * @example
 * const validity: FhevmUserDecryptValidity = {
 *   startTimestamp: Math.floor(Date.now() / 1000), // current time in seconds (POSIX time)
 *   durationDays: 7, // valid for one week
 * };
 */
export type FhevmUserDecryptValidity = {
  /** Start time in seconds since Unix epoch (POSIX time). */
  startTimestamp: EthersT.Numeric;

  /** Duration in days. */
  durationDays: EthersT.Numeric;
};

export type FhevmUserDecryptOptions = {
  instance?: FhevmInstance;
  keypair?: FhevmKeypair;
  validity?: FhevmUserDecryptValidity;
};

export type FhevmPublicDecryptOptions = {
  instance?: FhevmInstance;
};

export async function userDecryptHandleBytes32(
  instance: FhevmInstance,
  handleContractPairs: { handleBytes32: string; contractAddress: string; fhevmType?: FhevmType }[],
  user: EthersT.Signer,
  options?: Omit<FhevmUserDecryptOptions, "instance">,
): Promise<DecryptedResults> {
  // Verify that contract addresses are well formed.
  _assertIsContractAddressesArray(handleContractPairs);

  // Resolve missing options (instance, keypair etc.)
  const userDecryptArgs = await _resolveUserDecryptOptions(instance, options);

  // extract chainId from instance (FhevmInstance is missing getChainId function)
  const chainId = _getFhevmInstanceChainId(instance);

  // Verify Fhevm handles
  _verifyFhevmHandleContractPairs(handleContractPairs, chainId);

  // Compute signature and list of contract addresses extracted and sorted from the handle/contract pairs
  const { signature, contractAddresses } = await _computeUserSignatureAndContractAddresses(
    instance,
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
  const decryptedHandles: DecryptedResults = await instance.userDecrypt(
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
  instance: FhevmInstance,
  options?: FhevmUserDecryptOptions,
): Promise<FhevmUserDecryptArguments> {
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
    keypair,
    startTimestamp: startTimestampNumber,
    durationDays: durationDaysNumber,
  };
}

async function _computeUserSignatureAndContractAddresses(
  instance: FhevmInstance,
  contractAddresses: ({ contractAddress: string } | string)[],
  user: EthersT.Signer,
  userDecryptArgs: FhevmUserDecryptArguments,
) {
  if (contractAddresses.length === 0) {
    throw new FhevmError("Empty list of contract addresses.");
  }

  // We use a deterministic method for convenience. (in case we need to rebuild the signature).
  const contractAddressesSortUnique = _buildDeterministicContractAddressesList(contractAddresses);

  if (contractAddressesSortUnique.length === 0) {
    throw new FhevmError("Empty list of valid contract addresses.");
  }

  const eip712 = instance.createEIP712(
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
    throw new FhevmError("Empty list of contract addresses.");
  }

  for (let i = 0; i < contractAddresses.length; ++i) {
    const ca = contractAddresses[i];

    let contractAddress: string;
    if (typeof ca === "string") {
      contractAddress = ca;
    } else {
      contractAddress = ca.contractAddress;
    }
    assertIsAddress(contractAddress, "contractAddress");
  }
}

function _verifyFhevmHandleContractPairs(
  handleContractPairs: { handleBytes32: string; contractAddress: string; fhevmType?: FhevmType }[],
  chainId?: number,
) {
  if (handleContractPairs.length === 0) {
    throw new FhevmError("Empty list of handle/contract pairs.");
  }

  for (let i = 0; i < handleContractPairs.length; ++i) {
    const pair = handleContractPairs[i];

    FhevmHandle.verify(pair.handleBytes32, {
      ...(pair.fhevmType !== undefined && { fhevmType: pair.fhevmType }),
      ...(chainId !== undefined && { chainId: chainId }),
    });

    assertIsAddress(pair.contractAddress, "contractAddress");
  }
}
