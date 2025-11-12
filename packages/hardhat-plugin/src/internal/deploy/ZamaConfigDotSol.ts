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

  // Mandatory ZamaConfig Addresses:
  // These addresses must all be present in the target `ZamaConfig.sol` file.
  // An error is thrown if any of these expected addresses are missing,
  // indicating an invalid or unexpected `ZamaConfig.sol` file content
  const expectedLocalACLAddress = constants.FHEVM_SOLIDITY_PACKAGE.LocalConfig.ACLAddress;
  const expectedLocalFHEVMExecutorAddress = constants.FHEVM_SOLIDITY_PACKAGE.LocalConfig.CoprocessorAddress;
  const expectedLocalKMSVerifierAddress = constants.FHEVM_SOLIDITY_PACKAGE.LocalConfig.KMSVerifierAddress;

  const origContent: string = fs.readFileSync(origPath, "utf8");
  try {
    assertHHFhevm(origContent.indexOf("../lib/FHE.sol") >= 0);
    assertHHFhevm(origContent.indexOf("../lib/Impl.sol") >= 0);
    assertHHFhevm(origContent.indexOf("library ZamaConfig {") >= 0);
  } catch {
    throw new HardhatFhevmError(
      `Unexpected '${filename}' file content. File located at '${origPath}' is not supported. (version=${constants.FHEVM_SOLIDITY_PACKAGE.version}).`,
    );
  }

  if (origContent.indexOf(`ACLAddress: ${expectedLocalACLAddress}`) < 0) {
    throw new HardhatFhevmError(
      `Unexpected ${filename} file. File located at '${origPath}' has changed and is not supported. Expected local ACLAddress=${expectedLocalACLAddress} (version=${constants.FHEVM_SOLIDITY_PACKAGE.version}).`,
    );
  }
  if (origContent.indexOf(`CoprocessorAddress: ${expectedLocalFHEVMExecutorAddress}`) < 0) {
    throw new HardhatFhevmError(
      `Unexpected ${filename} file. File located at '${origPath}' has changed and is not supported. Expected local FHEVMExecutorAddress=${expectedLocalFHEVMExecutorAddress} (version=${constants.FHEVM_SOLIDITY_PACKAGE.version}).`,
    );
  }
  if (origContent.indexOf(`KMSVerifierAddress: ${expectedLocalKMSVerifierAddress}`) < 0) {
    throw new HardhatFhevmError(
      `Unexpected ${filename} file. File located at '${origPath}' has changed and is not supported. Expected local KMSVerifierAddress=${expectedLocalKMSVerifierAddress} (version=${constants.FHEVM_SOLIDITY_PACKAGE.version}).`,
    );
  }

  const expectedLocalConfig = `function _getLocalConfig() private pure returns (CoprocessorConfig memory) {
        return
            CoprocessorConfig({
                ACLAddress: ${expectedLocalACLAddress},
                CoprocessorAddress: ${expectedLocalFHEVMExecutorAddress},
                KMSVerifierAddress: ${expectedLocalKMSVerifierAddress}
            });
    }`;

  const newLocalConfig = `function _getLocalConfig() private pure returns (CoprocessorConfig memory) {
        return
            CoprocessorConfig({
                ACLAddress: ${addresses.ACLAddress},
                CoprocessorAddress: ${addresses.CoprocessorAddress},
                KMSVerifierAddress: ${addresses.KMSVerifierAddress}
            });
    }`;

  if (origContent.indexOf(expectedLocalConfig) < 0) {
    throw new HardhatFhevmError(
      `Unexpected ${filename} file. File located at '${origPath}' has changed and is not supported.`,
    );
  }

  let dstContent = origContent
    .replaceAll("../lib/FHE.sol", "@fhevm/solidity/lib/FHE.sol")
    .replaceAll("../lib/Impl.sol", "@fhevm/solidity/lib/Impl.sol")
    .replaceAll(expectedLocalConfig, newLocalConfig);

  // dstContent = dstContent
  //   .replaceAll(expectedLocalACLAddress, addresses.ACLAddress)
  //   .replaceAll(expectedLocalFHEVMExecutorAddress, addresses.CoprocessorAddress)
  //   .replaceAll(expectedLocalKMSVerifierAddress, addresses.KMSVerifierAddress);

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
