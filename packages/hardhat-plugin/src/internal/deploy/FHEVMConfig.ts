import { FHEVMConfig } from "@fhevm/mock-utils";
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
 * This function parses `/path/to/user-package/node_modules/@fhevm/solidity/config/ZamaConfig.sol` file
 * and replaces the addresses listed by the addresses used in the current mock FHEVM environment.
 * @returns The absolute path to the generated `ZamaConfig.sol`
 */
export function generateFHEVMConfigDotSol(paths: FhevmEnvironmentPaths, addresses: FHEVMConfig): string {
  const origPath = paths.fhevmSolidityConfigFile;

  if (!fs.existsSync(origPath)) {
    throw new HardhatFhevmError(
      `Unable to retrieve ${origPath}, make sure the package '${constants.FHEVM_SOLIDITY_PACKAGE.name}' is properly installed'`,
    );
  }

  const expectedACLAddress = constants.FHEVM_SOLIDITY_PACKAGE.SepoliaConfig.ACLAddress;
  const expectedFHEVMExecutorAddress = constants.FHEVM_SOLIDITY_PACKAGE.SepoliaConfig.FHEVMExecutorAddress;
  const expectedKMSVerifierAddress = constants.FHEVM_SOLIDITY_PACKAGE.SepoliaConfig.KMSVerifierAddress;
  const expectedInputVerifierAddress = constants.FHEVM_SOLIDITY_PACKAGE.SepoliaConfig.InputVerifierAddress;

  const origContent: string = fs.readFileSync(origPath, "utf8");
  assertHHFhevm(origContent.indexOf("../lib/FHE.sol") >= 0);
  assertHHFhevm(origContent.indexOf("../lib/Impl.sol") >= 0);

  if (origContent.indexOf(`ACLAddress: ${expectedACLAddress}`) < 0) {
    throw new HardhatFhevmError(
      `Unexpected ${path.basename(origPath)} file. File located at '${origPath}' has changed and is not supported. Expected ACLAddress=${expectedACLAddress} (version=${constants.FHEVM_SOLIDITY_PACKAGE.version}).`,
    );
  }
  if (origContent.indexOf(`FHEVMExecutorAddress: ${expectedFHEVMExecutorAddress}`) < 0) {
    throw new HardhatFhevmError(
      `Unexpected ${path.basename(origPath)} file. File located at '${origPath}' has changed and is not supported. Expected FHEVMExecutorAddress=${expectedFHEVMExecutorAddress} (version=${constants.FHEVM_SOLIDITY_PACKAGE.version}).`,
    );
  }
  if (origContent.indexOf(`KMSVerifierAddress: ${expectedKMSVerifierAddress}`) < 0) {
    throw new HardhatFhevmError(
      `Unexpected ${path.basename(origPath)} file. File located at '${origPath}' has changed and is not supported. Expected KMSVerifierAddress=${expectedKMSVerifierAddress} (version=${constants.FHEVM_SOLIDITY_PACKAGE.version}).`,
    );
  }
  if (origContent.indexOf(`InputVerifierAddress: ${expectedInputVerifierAddress}`) < 0) {
    throw new HardhatFhevmError(
      `Unexpected ${path.basename(origPath)} file. File located at '${origPath}' has changed and is not supported. Expected InputVerifierAddress=${expectedInputVerifierAddress} (version=${constants.FHEVM_SOLIDITY_PACKAGE.version}).`,
    );
  }

  const dstContent = origContent
    .replaceAll("../lib/FHE.sol", "@fhevm/solidity/lib/FHE.sol")
    .replaceAll("../lib/Impl.sol", "@fhevm/solidity/lib/Impl.sol")
    .replaceAll(expectedACLAddress, addresses.ACLAddress)
    .replaceAll(expectedFHEVMExecutorAddress, addresses.FHEVMExecutorAddress)
    .replaceAll(expectedKMSVerifierAddress, addresses.KMSVerifierAddress)
    .replaceAll(expectedInputVerifierAddress, addresses.InputVerifierAddress);

  const dstPath = paths.cacheFHEVMConfigSol;
  if (fs.existsSync(dstPath)) {
    const existingContent: string = fs.readFileSync(dstPath, "utf8");
    if (existingContent === dstContent) {
      debug(
        `Skip ${picocolors.yellowBright(constants.FHEVM_CONFIG_SOLIDITY_FILE)} generation. File ${dstPath} already exists with exact same content.`,
      );
      return dstPath;
    }
  }

  const dstDir = path.dirname(dstPath);
  if (!fs.existsSync(dstDir)) {
    fs.mkdirSync(dstDir, { recursive: true });
  }

  fs.writeFileSync(dstPath, dstContent, "utf8");

  debug(`Generate ${picocolors.yellowBright(constants.FHEVM_CONFIG_SOLIDITY_FILE)} at ${dstPath}. Source ${origPath}`);

  return dstPath;
}
