import { utils } from "@fhevm/mock-utils";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import setupDebug from "debug";
import * as dotenv from "dotenv";
import { ethers as EthersT } from "ethers";
import * as fs from "fs";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import * as path from "path";
import * as picocolors from "picocolors";

import { HardhatFhevmError } from "../../error";
import constants from "../constants";
import { assertHHFhevm } from "../error";

const debug = setupDebug("@fhevm/hardhat:addresses");

function __isHardhatSignerAddress(hhSigners: HardhatEthersSigner[], address: string) {
  return hhSigners.findIndex((s) => s.address === address) !== -1;
}

function logDefaultValue(name: string, defaultValue: unknown) {
  debug(`Resolve ${picocolors.magentaBright(name)}=${defaultValue}, using default value.`);
}
function logEnvValue(name: string, value: string) {
  debug(`Resolve ${picocolors.yellowBright(name)}=${value}, using env variable ${name}.`);
}
function logDotEnvValue(name: string, value: string, dotenvRelPath: string) {
  debug(
    `Resolve ${picocolors.greenBright(name)}=${value}, using .env variable stored at ${path.resolve(dotenvRelPath)}`,
  );
}

function __getOptionalStringEnvVar(name: string): string | undefined {
  return process.env[name];
}

function __getOptionalUintEnvVar(name: string): number | undefined {
  let int: number = Number.NaN;

  try {
    const str = __getOptionalStringEnvVar(name)!;
    int = parseInt(str);
  } catch {
    int = Number.NaN;
  }

  if (!Number.isNaN(int)) {
    return int;
  }

  return undefined;
}

function __getUintConstant(name: keyof typeof constants, defaultValue?: number): number {
  let int: number = Number.NaN;

  try {
    const str = __getStringConstant(name);
    int = parseInt(str);
  } catch {
    int = Number.NaN;
  }

  if (!Number.isNaN(int)) {
    return int;
  }

  if (defaultValue !== undefined) {
    logDefaultValue(name, defaultValue);
    return defaultValue;
  }

  throw new HardhatFhevmError(`Unable to determine integer constant ${name}`);
}

function __getStringConstant(name: keyof typeof constants, defaultValue?: string, dotenvRelPath?: string): string {
  if (defaultValue) {
    assertHHFhevm(constants[name] === defaultValue, `Missing constant ${name} in constants module`);
  }

  if (dotenvRelPath !== undefined && fs.existsSync(dotenvRelPath)) {
    const parsedEnv = dotenv.parse(fs.readFileSync(dotenvRelPath));
    const addr = parsedEnv[name];
    if (addr) {
      logDotEnvValue(name, addr, dotenvRelPath);
      return addr;
    }
  }

  if (name in process.env && process.env[name] !== undefined) {
    const addr = process.env[name];
    logEnvValue(name, addr);
    return addr;
  }

  if (defaultValue) {
    logDefaultValue(name, defaultValue);
    return defaultValue;
  }

  throw new HardhatFhevmError(`Unable to determine string constant ${name}`);
}

export async function getRelayerSignerAddress(hre: HardhatRuntimeEnvironment): Promise<string> {
  const s = await getRelayerSigner(hre);
  const relayerAddress = await s.getAddress();
  return relayerAddress;
}

export async function getRelayerSigner(hre: HardhatRuntimeEnvironment): Promise<EthersT.Signer> {
  const index = __getRelayerSignerIndex();
  const signers: HardhatEthersSigner[] = await hre.ethers.getSigners();

  if (index >= signers.length) {
    throw new HardhatFhevmError(
      `Hardhat relayer signer index out of bounds (index=${index}). The total number of signers is ${signers.length}.`,
    );
  }

  return signers[index];
}

function __getRelayerSignerIndex(): number {
  try {
    const tStr = __getStringConstant("HARDHAT_RELAYER_SIGNER_INDEX");
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

export function getKMSThreshold(): number {
  return __getUintConstant("KMS_THRESHOLD", constants["KMS_THRESHOLD"]);
}

/**
 * Fhevm Gateway contracts
 * @returns Address of the deployed 'Decryption.sol' contract.
 */
export function getGatewayDecryptionAddress(): string {
  try {
    const addr = __getStringConstant("DECRYPTION_ADDRESS");
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
export function getGatewayInputVerificationAddress(): string {
  try {
    const addr = __getStringConstant("INPUT_VERIFICATION_ADDRESS");
    if (!EthersT.isAddress(addr)) {
      throw new HardhatFhevmError(`Invalid InputVerifier verifyingContractSource address: ${addr}`);
    }
    return addr;
  } catch {
    // Default
    return constants["INPUT_VERIFICATION_ADDRESS"];
  }
}

export async function loadCoprocessorSigners(
  hre: HardhatRuntimeEnvironment,
  provider?: EthersT.Provider,
): Promise<EthersT.Signer[]> {
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
    const coprocessorSignersAddresses = __envGetHardhatSignersAddresses(
      "NUM_COPROCESSORS",
      "COPROCESSOR_SIGNER_ADDRESS_",
      hhSigners,
    );

    const coprocessorSigners = [];
    for (let idx = 0; idx < coprocessorSignersAddresses.length; idx++) {
      const coprocessorSigner = await hre.ethers.getSigner(coprocessorSignersAddresses[idx]);
      coprocessorSigners.push(coprocessorSigner);
    }

    return coprocessorSigners;
  } catch {
    //
  }

  const coprocessorSignerKey = __getStringConstant(
    "PRIVATE_KEY_COPROCESSOR_SIGNER",
    constants["PRIVATE_KEY_COPROCESSOR_SIGNER"],
  );

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
export async function loadKMSSigners(
  hre: HardhatRuntimeEnvironment,
  provider?: EthersT.Provider,
): Promise<EthersT.Signer[]> {
  try {
    const hhSigners = await hre.ethers.getSigners();
    const kmsSignersAddresses = __envGetHardhatSignersAddresses("NUM_KMS_NODES", "KMS_SIGNER_ADDRESS_", hhSigners);

    const kmsSigners = [];
    for (let idx = 0; idx < kmsSignersAddresses.length; idx++) {
      const kmsSigner = await hre.ethers.getSigner(kmsSignersAddresses[idx]);
      kmsSigners.push(kmsSigner);
    }

    return kmsSigners;
  } catch {
    const kmsSignerKey = __getStringConstant("PRIVATE_KEY_KMS_SIGNER", constants["PRIVATE_KEY_KMS_SIGNER"]);

    const signer = new EthersT.Wallet(kmsSignerKey).connect(provider ?? null);
    return [signer];
  }
}

function envGetList(envVarNamePrefix: string): string[] {
  envVarNamePrefix = utils.ensureSuffix(envVarNamePrefix, "_");

  const list: string[] = [];
  for (let idx = 0; idx < 100; idx++) {
    const value = __getOptionalStringEnvVar(`${envVarNamePrefix}${idx}`);
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
function __envGetHardhatSignersAddresses(
  numEnvVarName: string,
  listEnvVarNamePrefix: string,
  hhSigners: HardhatEthersSigner[],
): string[] {
  const num = __getOptionalUintEnvVar(numEnvVarName);
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
