import type { CoprocessorConfig } from "@fhevm/mock-utils";
import setupDebug from "debug";
import * as fs from "fs";
import * as path from "path";
import * as picocolors from "picocolors";

import { HardhatFhevmError } from "../../error";
import { FhevmEnvironmentPaths } from "../FhevmEnvironmentPaths";
import constants from "../constants";
import { assertHHFhevm } from "../error";

const debug = setupDebug("@fhevm/hardhat:addresses");

/**
 * This function generates `/path/to/user-package/fhevmTemp/@fhevm/solidity/config/ZamaConfig.sol`.
 * It parses `/path/to/user-package/node_modules/@fhevm/solidity/config/ZamaConfig.sol` file
 * and replaces the addresses listed by the addresses used in the current mock FHEVM environment.
 * @returns The absolute path to the generated `ZamaConfig.sol`
 */
export function generateZamaConfigDotSol(paths: FhevmEnvironmentPaths, addresses: CoprocessorConfig): string {
  const origPath = paths.fhevmSolidityConfigFile;
  const filename = path.basename(origPath);

  if (!fs.existsSync(origPath)) {
    throw new HardhatFhevmError(
      `Unable to retrieve ${origPath}, make sure the package '${constants.FHEVM_SOLIDITY_PACKAGE.name}' is properly installed'`,
    );
  }

  const expectedACLAddress = constants.FHEVM_SOLIDITY_PACKAGE.SepoliaConfig.ACLAddress;
  const expectedFHEVMExecutorAddress = constants.FHEVM_SOLIDITY_PACKAGE.SepoliaConfig.CoprocessorAddress;
  const expectedKMSVerifierAddress = constants.FHEVM_SOLIDITY_PACKAGE.SepoliaConfig.KMSVerifierAddress;

  const origContent: string = fs.readFileSync(origPath, "utf8");
  assertHHFhevm(origContent.indexOf("../lib/FHE.sol") >= 0);
  assertHHFhevm(origContent.indexOf("../lib/Impl.sol") >= 0);

  if (origContent.indexOf(`ACLAddress: ${expectedACLAddress}`) < 0) {
    throw new HardhatFhevmError(
      `Unexpected ${filename} file. File located at '${origPath}' has changed and is not supported. Expected ACLAddress=${expectedACLAddress} (version=${constants.FHEVM_SOLIDITY_PACKAGE.version}).`,
    );
  }
  if (origContent.indexOf(`CoprocessorAddress: ${expectedFHEVMExecutorAddress}`) < 0) {
    throw new HardhatFhevmError(
      `Unexpected ${filename} file. File located at '${origPath}' has changed and is not supported. Expected FHEVMExecutorAddress=${expectedFHEVMExecutorAddress} (version=${constants.FHEVM_SOLIDITY_PACKAGE.version}).`,
    );
  }
  if (origContent.indexOf(`KMSVerifierAddress: ${expectedKMSVerifierAddress}`) < 0) {
    throw new HardhatFhevmError(
      `Unexpected ${filename} file. File located at '${origPath}' has changed and is not supported. Expected KMSVerifierAddress=${expectedKMSVerifierAddress} (version=${constants.FHEVM_SOLIDITY_PACKAGE.version}).`,
    );
  }

  const dstContent = origContent
    .replaceAll("../lib/FHE.sol", "@fhevm/solidity/lib/FHE.sol")
    .replaceAll("../lib/Impl.sol", "@fhevm/solidity/lib/Impl.sol")
    .replaceAll(expectedACLAddress, addresses.ACLAddress)
    .replaceAll(expectedFHEVMExecutorAddress, addresses.CoprocessorAddress)
    .replaceAll(expectedKMSVerifierAddress, addresses.KMSVerifierAddress);

  const dstPath = paths.cacheCoprocessorConfigSol;
  if (fs.existsSync(dstPath)) {
    const existingContent: string = fs.readFileSync(dstPath, "utf8");
    if (existingContent === dstContent) {
      debug(
        `Skip ${picocolors.yellowBright(filename)} generation. File ${dstPath} already exists with exact same content.`,
      );
      return dstPath;
    }
  }

  const dstDir = path.dirname(dstPath);
  if (!fs.existsSync(dstDir)) {
    fs.mkdirSync(dstDir, { recursive: true });
  }

  fs.writeFileSync(dstPath, dstContent, "utf8");

  debug(`Generate ${picocolors.yellowBright(filename)} at ${dstPath}. Source ${origPath}`);

  return dstPath;
}
