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

  // FORCE_REPLACE_ALL_ADDRESSES = true
  // Enables Developer Mode for contract addresses. This flag forces all configured Ethereum/Sepolia
  // addresses returned by `ZamaConfig` functions to be replaced with local development addresses.
  // Purpose: Allows dApps to test smart contract logic that uses `ZamaConfig.getSepoliaConfig` or
  // `ZamaConfig.getEthereumConfig` functions within a local FHEVM setup.
  const FORCE_REPLACE_ALL_ADDRESSES = true;

  // Mandatory ZamaConfig Addresses:
  // These addresses must all be present in the target `ZamaConfig.sol` file.
  // An error is thrown if any of these expected addresses are missing,
  // indicating an invalid or unexpected `ZamaConfig.sol` file content
  const expectedACLAddress = constants.FHEVM_SOLIDITY_PACKAGE.SepoliaConfig.ACLAddress;
  const expectedFHEVMExecutorAddress = constants.FHEVM_SOLIDITY_PACKAGE.SepoliaConfig.CoprocessorAddress;
  const expectedKMSVerifierAddress = constants.FHEVM_SOLIDITY_PACKAGE.SepoliaConfig.KMSVerifierAddress;

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

  const expectedEthereumConfig = `contract EthereumConfig {
    constructor() {
        if (block.chainid == 1) {
            FHE.setCoprocessor(ZamaConfig.getEthereumConfig());
        } else if (block.chainid == 11155111) {
            FHE.setCoprocessor(ZamaConfig.getSepoliaConfig());
        }
    }

    function protocolId() public view returns (uint256) {
        if (block.chainid == 1) {
            return ZamaConfig.getEthereumProtocolId();
        } else if (block.chainid == 11155111) {
            return ZamaConfig.getSepoliaProtocolId();
        }
        return 0;
    }
}`;

  const newEthereumConfig = `contract EthereumConfig {
    constructor() {
        FHE.setCoprocessor(ZamaConfig.getChainConfig());
    }

    function protocolId() public view returns (uint256) {
        return ZamaConfig.getChainProtocolId();
    }
}`;

  const newChainConfigCode = `
    function getChainConfig() internal view returns (CoprocessorConfig memory config) {
        if (block.chainid == 1) {
            config = ZamaConfig.getEthereumConfig();
        } else if (block.chainid == 11155111) {
            config = ZamaConfig.getSepoliaConfig();
        } else if (block.chainid == 31337) {
            config = ZamaConfig.getDevConfig();
        } else {
            config = CoprocessorConfig({ACLAddress: address(0), CoprocessorAddress: address(0), KMSVerifierAddress: address(0)});
        }
    }

    function getChainProtocolId() internal view returns (uint256) {
        if (block.chainid == 1) {
            return ZamaConfig.getEthereumProtocolId();
        } else if (block.chainid == 11155111) {
            return ZamaConfig.getSepoliaProtocolId();
        } else if (block.chainid == 31337) {
            return ZamaConfig.getDevProtocolId();
        }
        return 0;
    }`;

  const newDevConfig = `library ZamaConfig {
    /**
     * @dev This protocolId is auto-generated by the FHEVM Hardhat Plugin
     */
    function getDevProtocolId() internal pure returns (uint256) {
        /// @note Development protocol id is '100000 + Zama Ethereum protocol id'
        return 100001;
    }

    /**
     * @dev This \`CoprocessorConfig\` is auto-generated by the FHEVM Hardhat Plugin
     */
    function getDevConfig() internal pure returns (CoprocessorConfig memory) {
        return
            CoprocessorConfig({
                ACLAddress: ${addresses.ACLAddress},
                CoprocessorAddress: ${addresses.CoprocessorAddress},
                KMSVerifierAddress: ${addresses.KMSVerifierAddress}
            });
    }
    ${newChainConfigCode}
`;

  if (origContent.indexOf(expectedEthereumConfig) < 0) {
    throw new HardhatFhevmError(
      `Unexpected ${filename} file. File located at '${origPath}' has changed and is not supported.`,
    );
  }

  let dstContent = origContent
    .replaceAll("../lib/FHE.sol", "@fhevm/solidity/lib/FHE.sol")
    .replaceAll("../lib/Impl.sol", "@fhevm/solidity/lib/Impl.sol")
    .replaceAll(expectedEthereumConfig, newEthereumConfig)
    .replaceAll("library ZamaConfig {", newDevConfig);

  if (FORCE_REPLACE_ALL_ADDRESSES) {
    dstContent = dstContent
      .replaceAll(expectedACLAddress, addresses.ACLAddress)
      .replaceAll(expectedFHEVMExecutorAddress, addresses.CoprocessorAddress)
      .replaceAll(expectedKMSVerifierAddress, addresses.KMSVerifierAddress);
  }

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
