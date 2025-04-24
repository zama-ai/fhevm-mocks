import assert from "assert";
import fs from "fs";
import path from "path";

import constants from "../constants";
import { HardhatFhevmError } from "../error";
import { FhevmEnvironment } from "./FhevmEnvironment";

export function generateZamaOracleAddressDotSol(fhevmEnv: FhevmEnvironment, sepoliaZamaOracleAddress: string): string {
  assert(fhevmEnv.hre.ethers.isAddress(sepoliaZamaOracleAddress));

  const dstPath = fhevmEnv.paths.cacheZamaOracleAddressSol;

  if (fs.existsSync(dstPath)) {
    return dstPath;
  }

  const dstDir = path.dirname(dstPath);
  const origPath = path.join(fhevmEnv.paths.zamaFheOracleSolidityAddress, "ZamaOracleAddress.sol");

  if (!fs.existsSync(origPath)) {
    throw new HardhatFhevmError(
      `Unable to retrieve ${origPath}, make sure the package ${constants.ZAMA_FHE_ORACLE_SOLIDITY_PACKAGE_NAME} is properly installed'`,
    );
  }

  const origContent: string = fs.readFileSync(origPath, "utf8");
  assert(origContent.indexOf("SepoliaZamaOracleAddress = 0x33347831500F1e73f0ccCBb95c9f86B94d7b1123;") >= 0);

  const dstContent = origContent.replaceAll("0x33347831500F1e73f0ccCBb95c9f86B94d7b1123", sepoliaZamaOracleAddress);

  if (!fs.existsSync(dstDir)) {
    fs.mkdirSync(dstDir, { recursive: true });
  }

  fs.writeFileSync(dstPath, dstContent, "utf8");

  return dstPath;
}
