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
export function generateZamaConfigDotSol({
  paths,
  localAddresses,
  sepoliaAddresses,
  mainnetAddresses,
}: {
  paths: FhevmEnvironmentPaths;
  localAddresses?: CoprocessorConfig;
  sepoliaAddresses?: CoprocessorConfig;
  mainnetAddresses?: CoprocessorConfig;
}): string {
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

  const expectedSepoliaACLAddress = constants.FHEVM_SOLIDITY_PACKAGE.SepoliaConfig.ACLAddress;
  const expectedSepoliaFHEVMExecutorAddress = constants.FHEVM_SOLIDITY_PACKAGE.SepoliaConfig.CoprocessorAddress;
  const expectedSepoliaKMSVerifierAddress = constants.FHEVM_SOLIDITY_PACKAGE.SepoliaConfig.KMSVerifierAddress;

  const expectedEthereumACLAddress = constants.FHEVM_SOLIDITY_PACKAGE.EthereumConfig.ACLAddress;
  const expectedEthereumFHEVMExecutorAddress = constants.FHEVM_SOLIDITY_PACKAGE.EthereumConfig.CoprocessorAddress;
  const expectedEthereumKMSVerifierAddress = constants.FHEVM_SOLIDITY_PACKAGE.EthereumConfig.KMSVerifierAddress;

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

  const expectedAddresses = [
    { key: "ACLAddress", value: expectedLocalACLAddress, network: "local" },
    { key: "ACLAddress", value: expectedSepoliaACLAddress, network: "sepolia" },
    { key: "ACLAddress", value: expectedEthereumACLAddress, network: "ethereum" },
    { key: "CoprocessorAddress", value: expectedLocalFHEVMExecutorAddress, network: "local" },
    { key: "CoprocessorAddress", value: expectedSepoliaFHEVMExecutorAddress, network: "sepolia" },
    { key: "CoprocessorAddress", value: expectedEthereumFHEVMExecutorAddress, network: "ethereum" },
    { key: "KMSVerifierAddress", value: expectedLocalKMSVerifierAddress, network: "local" },
    { key: "KMSVerifierAddress", value: expectedSepoliaKMSVerifierAddress, network: "sepolia" },
    { key: "KMSVerifierAddress", value: expectedEthereumKMSVerifierAddress, network: "ethereum" },
  ];

  for (const { key, value, network } of expectedAddresses) {
    if (origContent.indexOf(`${key}: ${value}`) < 0) {
      throw new HardhatFhevmError(
        `Unexpected ${filename} file. File located at '${origPath}' has changed and is not supported. Expected ${network} ${key}=${value} (version=${constants.FHEVM_SOLIDITY_PACKAGE.version}).`,
      );
    }
  }

  const expectedLocalConfig = `function _getLocalConfig() private pure returns (CoprocessorConfig memory) {
        return
            CoprocessorConfig({
                ACLAddress: ${expectedLocalACLAddress},
                CoprocessorAddress: ${expectedLocalFHEVMExecutorAddress},
                KMSVerifierAddress: ${expectedLocalKMSVerifierAddress}
            });
    }`;

  const expectedSepoliaConfig = `function _getSepoliaConfig() private pure returns (CoprocessorConfig memory) {
        return
            CoprocessorConfig({
                ACLAddress: ${expectedSepoliaACLAddress},
                CoprocessorAddress: ${expectedSepoliaFHEVMExecutorAddress},
                KMSVerifierAddress: ${expectedSepoliaKMSVerifierAddress}
            });
    }`;

  const expectedEthereumConfig = `function _getEthereumConfig() private pure returns (CoprocessorConfig memory) {
        // The addresses below are placeholders and should be replaced with actual addresses
        // once deployed on the Ethereum mainnet.
        return
            CoprocessorConfig({
                ACLAddress: ${expectedEthereumACLAddress},
                CoprocessorAddress: ${expectedEthereumFHEVMExecutorAddress},
                KMSVerifierAddress: ${expectedEthereumKMSVerifierAddress}
            });
    }`;

  const newLocalConfig = localAddresses
    ? `function _getLocalConfig() private pure returns (CoprocessorConfig memory) {
        return
            CoprocessorConfig({
                ACLAddress: ${localAddresses.ACLAddress},
                CoprocessorAddress: ${localAddresses.CoprocessorAddress},
                KMSVerifierAddress: ${localAddresses.KMSVerifierAddress}
            });
    }`
    : expectedLocalConfig;

  const newSepoliaConfig = sepoliaAddresses
    ? `function _getSepoliaConfig() private pure returns (CoprocessorConfig memory) {
        return
            CoprocessorConfig({
                ACLAddress: ${sepoliaAddresses.ACLAddress},
                CoprocessorAddress: ${sepoliaAddresses.CoprocessorAddress},
                KMSVerifierAddress: ${sepoliaAddresses.KMSVerifierAddress}
            });
    }`
    : expectedSepoliaConfig;

  const newEthereumConfig = mainnetAddresses
    ? `function _getEthereumConfig() private pure returns (CoprocessorConfig memory) {
        return
            CoprocessorConfig({
                ACLAddress: ${mainnetAddresses.ACLAddress},
                CoprocessorAddress: ${mainnetAddresses.CoprocessorAddress},
                KMSVerifierAddress: ${mainnetAddresses.KMSVerifierAddress}
            });
    }`
    : expectedEthereumConfig;

  if (origContent.indexOf(expectedLocalConfig) < 0) {
    throw new HardhatFhevmError(
      `Unexpected ${filename} file. File located at '${origPath}' has changed and is not supported (local).`,
    );
  }

  if (origContent.indexOf(expectedSepoliaConfig) < 0) {
    throw new HardhatFhevmError(
      `Unexpected ${filename} file. File located at '${origPath}' has changed and is not supported (sepolia).`,
    );
  }

  if (origContent.indexOf(expectedEthereumConfig) < 0) {
    throw new HardhatFhevmError(
      `Unexpected ${filename} file. File located at '${origPath}' has changed and is not supported (ethereum).`,
    );
  }

  let dstContent = origContent
    .replaceAll("../lib/FHE.sol", "@fhevm/solidity/lib/FHE.sol")
    .replaceAll("../lib/Impl.sol", "@fhevm/solidity/lib/Impl.sol")
    .replaceAll(expectedLocalConfig, newLocalConfig)
    .replaceAll(expectedSepoliaConfig, newSepoliaConfig)
    .replaceAll(expectedEthereumConfig, newEthereumConfig);

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
