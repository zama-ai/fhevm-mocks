import setupDebug from "debug";
import * as fs from "fs";
import * as path from "path";
import * as picocolors from "picocolors";

import constants from "../../constants";
import { HardhatFhevmError } from "../../error";
import { FhevmEnvironmentPaths } from "../FhevmEnvironmentPaths";
import { assertHHFhevm } from "../error";

const debug = setupDebug("@fhevm/hardhat:addresses");

/**
 * This function parses `/path/to/user-package/node_modules/@zama-fhe/oracle-solidity/address/ZamaOracleAddress.sol` file
 * and replaces the address listed by the address used in the current mock FHEVM environment.
 * @returns The absolute path to the generated `ZamaOracleAddress.sol`
 */
export function generateZamaOracleAddressDotSol(
  paths: FhevmEnvironmentPaths,
  sepoliaZamaOracleAddress: string,
): string {
  const dstPath = paths.cacheZamaOracleAddressSol;

  if (fs.existsSync(dstPath)) {
    debug(`Skip ${picocolors.yellowBright("ZamaOracleAddress.sol")} generation. File ${dstPath} already exists.`);
    return dstPath;
  }

  const dstDir = path.dirname(dstPath);
  const origPath = path.join(paths.zamaFheOracleSolidityAddress, "ZamaOracleAddress.sol");

  if (!fs.existsSync(origPath)) {
    throw new HardhatFhevmError(
      `Unable to retrieve ${origPath}, make sure the package ${constants.ZAMA_FHE_ORACLE_SOLIDITY_PACKAGE_NAME} is properly installed'`,
    );
  }

  const origContent: string = fs.readFileSync(origPath, "utf8");
  // This will throw an error in case the new `ZamaOracleAddress.sol` has been modified
  assertHHFhevm(origContent.indexOf("SepoliaZamaOracleAddress = 0x33347831500F1e73f0ccCBb95c9f86B94d7b1123;") >= 0);

  const dstContent = origContent.replaceAll("0x33347831500F1e73f0ccCBb95c9f86B94d7b1123", sepoliaZamaOracleAddress);

  if (!fs.existsSync(dstDir)) {
    fs.mkdirSync(dstDir, { recursive: true });
  }

  fs.writeFileSync(dstPath, dstContent, "utf8");

  debug(`Generate ${picocolors.yellowBright("ZamaOracleAddress.sol")} at ${dstPath}. Source ${origPath}`);

  return dstPath;
}
