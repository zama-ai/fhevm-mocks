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
  const origPath = path.join(paths.fhevmSolidityConfig, constants.FHEVM_CONFIG_SOLIDITY_FILE);

  if (!fs.existsSync(origPath)) {
    throw new HardhatFhevmError(
      `Unable to retrieve ${origPath}, make sure the package '@fhevm/solidity' is properly installed'`,
    );
  }

  //https://github.com/zama-ai/fhevm/blob/main/host-contracts/.env.example
  const expectedACLAddress = "0x687820221192C5B662b25367F70076A37bc79b6c";
  const expectedFHEVMExecutorAddress = "0x848B0066793BcC60346Da1F49049357399B8D595";
  const expectedKMSVerifierAddress = "0x1364cBBf2cDF5032C47d8226a6f6FBD2AFCDacAC";
  const expectedInputVerifierAddress = "0xbc91f3daD1A5F19F8390c400196e58073B6a0BC4";

  const origContent: string = fs.readFileSync(origPath, "utf8");
  assertHHFhevm(origContent.indexOf("../lib/FHE.sol") >= 0);
  assertHHFhevm(origContent.indexOf("../lib/Impl.sol") >= 0);
  assertHHFhevm(origContent.indexOf(`ACLAddress: ${expectedACLAddress}`) >= 0);
  assertHHFhevm(origContent.indexOf(`FHEVMExecutorAddress: ${expectedFHEVMExecutorAddress}`) >= 0);
  assertHHFhevm(origContent.indexOf(`KMSVerifierAddress: ${expectedKMSVerifierAddress}`) >= 0);
  assertHHFhevm(origContent.indexOf(`InputVerifierAddress: ${expectedInputVerifierAddress}`) >= 0);

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
