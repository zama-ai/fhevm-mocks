import { ethers as EthersT } from "ethers";
import fs from "fs";
import path from "path";

import { HardhatFhevmError } from "../error";
import { FhevmEnvironment } from "./FhevmEnvironment";

export function parseSepoliaZamaOracleAddress(fhevmEnv: FhevmEnvironment): { SepoliaZamaOracleAddress: string } {
  /*
// SPDX-License-Identifier: BSD-3-Clause-Clear

pragma solidity ^0.8.24;

address constant SepoliaZamaOracleAddress = 0x33347831500F1e73f0ccCBb95c9f86B94d7b1123;
    */
  const p = path.join(fhevmEnv.paths.zamaFheOracleSolidityAddress, "ZamaOracleAddress.sol");
  if (!fs.existsSync(p)) {
    throw new HardhatFhevmError(
      `Unable to locate ${p}, please make sure that the @zama-fhe package is properly installed.`,
    );
  }

  const content = fs.readFileSync(p, "utf-8");
  const prefix = "address constant SepoliaZamaOracleAddress = ";
  const pos = content.indexOf(prefix);
  if (pos < 0) {
    throw new HardhatFhevmError(`Unable to parse ZamaOracleAddress at ${p}`);
  }
  const addr = content.substring(pos + prefix.length, pos + prefix.length + 42);
  return {
    SepoliaZamaOracleAddress: EthersT.getAddress(addr),
  };
}
