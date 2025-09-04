import setupDebug from "debug";
import * as fs from "fs";
import * as path from "path";
import * as picocolors from "picocolors";

import { HardhatFhevmError } from "../../error";
import { FhevmEnvironmentPaths } from "../FhevmEnvironmentPaths";
import constants from "../constants";

const debug = setupDebug("@fhevm/hardhat:addresses");

/**
 * This function generates `/path/to/user-package/node_modules/@zama-fhe/oracle-solidity/address/ZamaOracleAddress.sol`.
 * It parses `/path/to/user-package/node_modules/@zama-fhe/oracle-solidity/address/ZamaOracleAddress.sol` file
 * and replaces the addresses listed by the addresses used in the current mock FHEVM environment.
 * @returns The absolute path to the generated `ZamaOracleAddress.sol`
 */
export function generateZamaOracleAddressDotSol(
  paths: FhevmEnvironmentPaths,
  sepoliaZamaOracleAddress: string,
): string {
  const zamaOracleAddressDotSol = paths.zamaOracleAddressSolFilename;

  const origPath = path.join(paths.zamaFheOracleSolidityAddressDir, zamaOracleAddressDotSol);

  if (!fs.existsSync(origPath)) {
    throw new HardhatFhevmError(
      `Unable to retrieve ${origPath}, make sure the package ${constants.ZAMA_FHE_ORACLE_SOLIDITY_PACKAGE.name} is properly installed'`,
    );
  }

  const expectedAddr = constants.ZAMA_FHE_ORACLE_SOLIDITY_PACKAGE.SepoliaZamaOracleAddress;

  const origContent: string = fs.readFileSync(origPath, "utf8");
  // This will throw an error in case the new `ZamaOracleAddress.sol` has been modified
  if (origContent.indexOf(`SepoliaZamaOracleAddress = ${expectedAddr};`) < 0) {
    throw new HardhatFhevmError(
      `Unexpected ${zamaOracleAddressDotSol} file. File located at '${origPath}' has changed and is not supported. 'SepoliaZamaOracleAddress' as changed.`,
    );
  }

  const dstContent = origContent.replaceAll(expectedAddr, sepoliaZamaOracleAddress);

  const dstPath = paths.cacheZamaOracleAddressSol;
  if (fs.existsSync(dstPath)) {
    const existingContent: string = fs.readFileSync(dstPath, "utf8");
    if (existingContent === dstContent) {
      debug(
        `Skip ${picocolors.yellowBright(zamaOracleAddressDotSol)} generation. File ${dstPath} already exists with exact same content.`,
      );
      return dstPath;
    }
  }

  const dstDir = path.dirname(dstPath);
  if (!fs.existsSync(dstDir)) {
    fs.mkdirSync(dstDir, { recursive: true });
  }

  fs.writeFileSync(dstPath, dstContent, "utf8");

  debug(`Generate ${picocolors.yellowBright(zamaOracleAddressDotSol)} at ${dstPath}. Source ${origPath}`);

  return dstPath;
}
