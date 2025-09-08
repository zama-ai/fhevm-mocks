import { FhevmDecryptionOracleContractName } from "@fhevm/mock-utils";
import setupDebug from "debug";
import { ethers as EthersT } from "ethers";
import * as fs from "fs";
import * as picocolors from "picocolors";

import { HardhatFhevmError } from "../../error";
import { FhevmEnvironmentPaths } from "../FhevmEnvironmentPaths";

const debug = setupDebug("@fhevm/hardhat:addresses");

export async function getZamaFheOracleSolidityArtifact(
  paths: FhevmEnvironmentPaths,
  contractName: FhevmDecryptionOracleContractName,
) {
  const modulePath = paths.resolveZamaFheOracleSolidityArtifactPath(contractName);
  const artifact = await import(modulePath);
  return { artifact, path: modulePath };
}

export function parseSepoliaZamaOracleAddress(paths: FhevmEnvironmentPaths): { SepoliaZamaOracleAddress: string } {
  /*
// SPDX-License-Identifier: BSD-3-Clause-Clear

pragma solidity ^0.8.24;

address constant SepoliaZamaOracleAddress = 0x33347831500F1e73f0ccCBb95c9f86B94d7b1123;
  */
  const p = paths.zamaFheOracleSolidityAddressSol;
  if (!fs.existsSync(p)) {
    throw new HardhatFhevmError(
      `Unable to locate ${p}, please make sure that the @zama-fhe package is properly installed.`,
    );
  }

  const content = fs.readFileSync(p, "utf-8");
  const prefix = "address constant SepoliaZamaOracleAddress = ";
  const pos = content.indexOf(prefix);
  if (pos < 0) {
    throw new HardhatFhevmError(`Unable to parse SepoliaZamaOracleAddress at ${p}`);
  }
  const addr = content.substring(pos + prefix.length, pos + prefix.length + 42);

  debug(`Resolve ${picocolors.magentaBright("SepoliaZamaOracleAddress")}=${addr}, using solidity file at ${p}.`);

  return {
    SepoliaZamaOracleAddress: EthersT.getAddress(addr),
  };
}
