import { utils } from "@fhevm/mock-utils";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers as EthersT } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { HardhatFhevmError } from "../../error";
import constants from "../constants";
import { assertHHFhevm } from "../error";
import { getEnvString, getEnvUint, getOptionalEnvString, getOptionalEnvUint } from "../utils/env";

function __isHardhatSignerAddress(hhSigners: HardhatEthersSigner[], address: string) {
  return hhSigners.findIndex((s) => s.address === address) !== -1;
}

export async function loadRelayerSignerAddress(hre: HardhatRuntimeEnvironment, dotEnvFile?: string): Promise<string> {
  const s = await loadRelayerSigner(hre, dotEnvFile);
  const relayerAddress = await s.getAddress();
  return relayerAddress;
}

export async function loadRelayerSigner(hre: HardhatRuntimeEnvironment, dotEnvFile?: string): Promise<EthersT.Signer> {
  const index = __getRelayerSignerIndex(dotEnvFile);
  const signers: HardhatEthersSigner[] = await hre.ethers.getSigners();

  if (index >= signers.length) {
    throw new HardhatFhevmError(
      `Hardhat relayer signer index out of bounds (index=${index}). The total number of signers is ${signers.length}.`,
    );
  }

  return signers[index];
}

function __getRelayerSignerIndex(dotEnvFile?: string): number {
  try {
    const tStr = getEnvString({ name: "HARDHAT_RELAYER_SIGNER_INDEX", dotEnvFile });
    const t = parseInt(tStr);
    if (Number.isNaN(t)) {
      throw new HardhatFhevmError(`Invalid hardhat relayer signer index: ${tStr}`);
    }
    return t;
  } catch {
    // Default
    return constants["HARDHAT_RELAYER_SIGNER_INDEX"];
  }
}

export function getKMSThreshold(dotEnvFile?: string): number {
  return getEnvUint({ name: "KMS_THRESHOLD", defaultValue: constants["KMS_THRESHOLD"], dotEnvFile });
}

export function getInputVerifierThreshold(dotEnvFile?: string): number {
  return getEnvUint({
    name: "INPUT_VERIFIER_THRESHOLD",
    defaultValue: constants["INPUT_VERIFIER_THRESHOLD"],
    dotEnvFile,
  });
}

/**
 * Fhevm Gateway contracts
 * @returns Address of the deployed 'Decryption.sol' contract.
 */
export function getGatewayDecryptionAddress(dotEnvFile?: string): string {
  try {
    const addr = getEnvString({ name: "DECRYPTION_ADDRESS", dotEnvFile });
    if (!EthersT.isAddress(addr)) {
      throw new HardhatFhevmError(
        `Invalid Decryption contract address: ${addr} (KMS Verifying contract source address)`,
      );
    }
    return addr;
  } catch {
    // Default
    return constants["DECRYPTION_ADDRESS"];
  }
}

/**
 * Fhevm Gateway contracts
 * @returns Address of the deployed 'InputVerification.sol' contract.
 */
export function getGatewayInputVerificationAddress(dotEnvFile?: string): string {
  try {
    const addr = getEnvString({ name: "INPUT_VERIFICATION_ADDRESS", dotEnvFile: dotEnvFile });
    if (!EthersT.isAddress(addr)) {
      throw new HardhatFhevmError(`Invalid InputVerifier verifyingContractSource address: ${addr}`);
    }
    return addr;
  } catch {
    // Default
    return constants["INPUT_VERIFICATION_ADDRESS"];
  }
}

export async function loadCoprocessorSigners({
  hre,
  provider,
  dotEnvFile,
}: {
  hre: HardhatRuntimeEnvironment;
  provider?: EthersT.Provider;
  dotEnvFile?: string;
}): Promise<EthersT.Signer[]> {
  /*
    1. Try to build a list using:
      - env.NUM_COPROCESSORS
      - env.COPROCESSOR_SIGNER_ADDRESS_<index>
    2. Try to build a list with one element using:
      - address of env.PRIVATE_KEY_COPROCESSOR_SIGNER
    3. Try to build a list with one element using:
      - address of constant.PRIVATE_KEY_COPROCESSOR_SIGNER
  */
  try {
    const hhSigners = await hre.ethers.getSigners();
    const coprocessorSignersAddresses = __envGetHardhatSignersAddresses({
      numEnvVarName: "NUM_COPROCESSORS",
      listEnvVarNamePrefix: "COPROCESSOR_SIGNER_ADDRESS_",
      hhSigners,
      dotEnvFile,
    });

    const coprocessorSigners = [];
    for (let idx = 0; idx < coprocessorSignersAddresses.length; idx++) {
      const coprocessorSigner = await hre.ethers.getSigner(coprocessorSignersAddresses[idx]);
      coprocessorSigners.push(coprocessorSigner);
    }

    return coprocessorSigners;
  } catch {
    //
  }

  const coprocessorSignerKey = getEnvString({
    name: "PRIVATE_KEY_COPROCESSOR_SIGNER",
    defaultValue: constants["PRIVATE_KEY_COPROCESSOR_SIGNER"],
  });

  const signer = new EthersT.Wallet(coprocessorSignerKey).connect(provider ?? null);
  return [signer];
}

/*
  1. Try to build a list using:
      - env.NUM_KMS_NODES
      - env.KMS_SIGNER_ADDRESS_<index>
  2. Try to build a list with one element using:
      - address of env.PRIVATE_KEY_KMS_SIGNER
  3. Try to build a list with one element using:
      - address of constant.PRIVATE_KEY_KMS_SIGNER
*/
export async function loadKMSSigners({
  hre,
  provider,
  dotEnvFile,
}: {
  hre: HardhatRuntimeEnvironment;
  provider?: EthersT.Provider;
  dotEnvFile?: string;
}): Promise<EthersT.Signer[]> {
  try {
    const hhSigners = await hre.ethers.getSigners();
    const kmsSignersAddresses = __envGetHardhatSignersAddresses({
      numEnvVarName: "NUM_KMS_NODES",
      listEnvVarNamePrefix: "KMS_SIGNER_ADDRESS_",
      hhSigners,
      dotEnvFile,
    });

    const kmsSigners = [];
    for (let idx = 0; idx < kmsSignersAddresses.length; idx++) {
      const kmsSigner = await hre.ethers.getSigner(kmsSignersAddresses[idx]);
      kmsSigners.push(kmsSigner);
    }

    return kmsSigners;
  } catch {
    const kmsSignerKey = getEnvString({
      name: "PRIVATE_KEY_KMS_SIGNER",
      defaultValue: constants["PRIVATE_KEY_KMS_SIGNER"],
    });

    const signer = new EthersT.Wallet(kmsSignerKey).connect(provider ?? null);
    return [signer];
  }
}

function envGetList(envVarNamePrefix: string, dotEnvFile?: string): string[] {
  envVarNamePrefix = utils.ensureSuffix(envVarNamePrefix, "_");

  const list: string[] = [];
  for (let idx = 0; idx < 100; idx++) {
    const value = getOptionalEnvString({ name: `${envVarNamePrefix}${idx}`, dotEnvFile });
    if (!value) {
      break;
    }
    list.push(value);
  }
  return list;
}

function removeNonHardhatSignerAddresses(
  addresses: string[],
  hhSigners: HardhatEthersSigner[],
  envVarNamePrefix: string,
): string[] {
  envVarNamePrefix = utils.ensureSuffix(envVarNamePrefix, "_");

  const hardhatAddresses: string[] = [];
  for (let i = 0; i < addresses.length; i++) {
    const addr = addresses[i];
    if (!__isHardhatSignerAddress(hhSigners, addr)) {
      console.error(`Ingnoring ${envVarNamePrefix}${i}, not an Hardhat signer address.`);
      break;
    }
    hardhatAddresses.push(addr);
  }

  return hardhatAddresses;
}

/*
  For example:
    NUM_COPROCESSORS="1" (or "2" or "3")
    COPROCESSOR_SIGNER_ADDRESS_0="0x..."
    COPROCESSOR_SIGNER_ADDRESS_1="0x..."
    COPROCESSOR_SIGNER_ADDRESS_2="0x..."
*/
function __envGetHardhatSignersAddresses({
  numEnvVarName,
  listEnvVarNamePrefix,
  hhSigners,
  dotEnvFile,
}: {
  numEnvVarName: string;
  listEnvVarNamePrefix: string;
  hhSigners: HardhatEthersSigner[];
  dotEnvFile?: string | undefined;
}): string[] {
  const num = getOptionalEnvUint({ name: numEnvVarName, dotEnvFile });
  if (num === undefined) {
    throw new HardhatFhevmError(`Undefined env var name '${numEnvVarName}'`);
  }
  const envList = envGetList(listEnvVarNamePrefix);
  const addresses: string[] = removeNonHardhatSignerAddresses(envList, hhSigners, listEnvVarNamePrefix);
  if (addresses.length < num) {
    throw new HardhatFhevmError(`Unexpected number of addresses. Got '${addresses.length}', expecting at least ${num}`);
  }
  const res = addresses.slice(0, num - 1);
  assertHHFhevm(res.length === num);
  return res;
}
