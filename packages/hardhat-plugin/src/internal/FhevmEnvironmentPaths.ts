import {
  FhevmCoprocessorContractName,
  FhevmDecryptionOracleContractName,
  version as bundledMockUtilsVersion,
} from "@fhevm/mock-utils";
import * as fs from "fs";
import * as path from "path";
import * as resolve from "resolve";

import constants from "../constants";
import { HardhatFhevmError } from "../error";

export class FhevmEnvironmentPaths {
  private _root: string;

  constructor(root: string) {
    this._root = root;

    // Make sure we are using the same mock-utils versions between the project and the HH plugin.
    this._checkMockUtilsVersions();
  }

  /**
   * Returns `/path/to/user-package` (eq: hre.config.paths.root)
   */
  public get root(): string {
    return this._root;
  }

  /**
   * Returns `/path/to/user-package/node_modules`
   */
  public get nodeModules(): string {
    return path.join(this.root, "node_modules");
  }

  /**
   * Returns `/path/to/user-package/fhevmTemp`
   */
  public get cache(): string {
    return path.join(this.root, "fhevmTemp");
  }

  /**
   * Returns `/path/to/user-package/fhevmTemp/precompiled-fhevm-core-contracts-addresses.json`
   */
  public get cachePrecompiledFhevmCoreContractsAddressesJson(): string {
    return path.join(this.cache, "precompiled-fhevm-core-contracts-addresses.json");
  }

  /**
   * Returns `/path/to/user-package/fhevmTemp/@fhevm/solidity/config`
   */
  public get cacheFhevmSolidityConfig(): string {
    return path.join(this.cache, path.join(constants.FHEVM_SOLIDITY_PACKAGE_NAME, "config"));
  }

  /**
   * Returns `fhevmTemp/@fhevm/solidity/config`
   */
  public get relCacheFhevmSolidityConfig(): string {
    const abs = this.cacheFhevmSolidityConfig;
    return path.relative(this.root, abs);
  }

  /**
   * Returns `/path/to/user-package/fhevmTemp/@fhevm/solidity/config/FHEVMConfig.sol`
   */
  public get cacheFHEVMConfigSol(): string {
    return path.join(this.cacheFhevmSolidityConfig, "FHEVMConfig.sol");
  }

  /**
   * Returns `/path/to/user-package/node_modules/@fhevm/solidity`
   * This is legit since the user-package must have @fhevm/solidity in its dependencies.
   */
  public get fhevmSolidity(): string {
    return path.dirname(this._resolveFromConsumer(path.join(constants.FHEVM_SOLIDITY_PACKAGE_NAME, "package.json")));
  }

  /**
   * Returns `/path/to/user-package/node_modules/solidity-coverage`
   */
  public get solidityCoverage(): string | undefined {
    try {
      return path.dirname(
        this._resolveFromConsumer(path.join(constants.SOLIDITY_COVERAGE_PACKAGE_NAME, "package.json")),
      );
    } catch {
      return undefined;
    }
  }

  /**
   * Returns `/path/to/user-package/node_modules/mock-utils`
   */
  public get mockUtils(): string | undefined {
    try {
      return path.dirname(
        this._resolveFromConsumer(path.join(constants.FHEVM_MOCK_UTILS_PACKAGE_NAME, "package.json")),
      );
    } catch {
      return undefined;
    }
  }

  /**
   * Returns `/path/to/user-package/node_modules/@fhevm/solidity/config`
   */
  public get fhevmSolidityConfig(): string {
    return path.join(this.fhevmSolidity, "config");
  }

  /**
   * Returns `/path/to/user-package/node_modules/@fhevm/solidity/lib`
   */
  public get fhevmSolidityLib(): string {
    return path.join(this.fhevmSolidity, "lib");
  }

  /**
   * If using npm:
   * - Returns `/path/to/user-package/node_modules/@zama-fhe/oracle-solidity`
   * If using pnpm (strict no hoist):
   * - Returns `/path/to/user-package/node_modules/.pnpm/@zama-fhe+oracle-solidity@...@...@.../node_modules/@zama-fhe/oracle-solidity`
   * If using any other package manager: path to the installed module
   */
  public get zamaFheOracleSolidity(): string {
    return path.dirname(
      this._resolveFromConsumer(path.join(constants.ZAMA_FHE_ORACLE_SOLIDITY_PACKAGE_NAME, "package.json")),
    );
  }

  /**
   * If using npm:
   * - Returns `/path/to/user-package/node_modules/@zama-fhe/oracle-solidity/address`
   * If using pnpm (strict no hoist):
   * - Returns `/path/to/user-package/node_modules/.pnpm/@zama-fhe+oracle-solidity@...@...@.../node_modules/@zama-fhe/oracle-solidity/address`
   * If using any other package manager: path to the installed module
   */
  public get zamaFheOracleSolidityAddress(): string {
    return path.join(this.zamaFheOracleSolidity, "address");
  }

  /**
   * Returns `/path/to/user-package/fhevmTemp/@zama-fhe/oracle-solidity`
   */
  public get cacheZamaFheOracleSolidity(): string {
    return path.join(this.cache, constants.ZAMA_FHE_ORACLE_SOLIDITY_PACKAGE_NAME);
  }

  /**
   * Returns `/path/to/user-package/fhevmTemp/@zama-fhe/oracle-solidity/address`
   */
  public get cacheZamaFheOracleSolidityAddress(): string {
    return path.join(this.cacheZamaFheOracleSolidity, "address");
  }

  /**
   * Returns `/path/to/user-package/fhevmTemp/@zama-fhe/oracle-solidity/address/ZamaOracleAddress.sol`
   */
  public get cacheZamaOracleAddressSol(): string {
    return path.join(this.cacheZamaFheOracleSolidityAddress, "ZamaOracleAddress.sol");
  }

  /**
   * Returns `fhevmTemp/@zama-fhe/oracle-solidity/address`
   */
  public get relCacheZamaFheOracleSolidityAddress(): string {
    const abs = this.cacheZamaFheOracleSolidityAddress;
    return path.relative(this.root, abs);
  }

  /**
   * The returned path can be one of the following:
   *   - `/path/to/user-package/artifacts/@fhevm/core-contracts`
   *   - `@fhevm/core-contracts/artifacts`
   */
  public resolveFhevmCoreContractsArtifactRootDir() {
    let modulePath = path.resolve(path.join("artifacts", constants.FHEVM_CORE_CONTRACTS_PACKAGE_NAME));
    if (!fs.existsSync(modulePath)) {
      modulePath = path.join(constants.FHEVM_CORE_CONTRACTS_PACKAGE_NAME, "artifacts");
    }
    return modulePath;
  }

  /**
   * The returned path can be one of the following:
   *   - `/path/to/user-package/artifacts/@zama-fhe/oracle-solidity`
   *   - `@zama-fhe/oracle-solidity/artifacts`
   */
  public resolveZamaFheOracleSolidityArtifactRootDir() {
    let modulePath = path.resolve(path.join("artifacts", constants.ZAMA_FHE_ORACLE_SOLIDITY_PACKAGE_NAME));
    if (!fs.existsSync(modulePath)) {
      modulePath = path.join(constants.ZAMA_FHE_ORACLE_SOLIDITY_PACKAGE_NAME, "artifacts");
    }
    return modulePath;
  }

  /**
   * The returned path can be one of the following:
   *   - `/path/to/user-package/artifacts/@fhevm/core-contracts/<contractName>.sol/<contractName>.json`
   *   - `@fhevm/core-contracts/artifacts/contracts/<contractName>.sol/<contractName>.json`
   */
  public resolveFhevmCoreContractsArtifactPath(contractName: FhevmCoprocessorContractName) {
    const root = this.resolveFhevmCoreContractsArtifactRootDir();
    return path.join(root, `contracts/${contractName}.sol/${contractName}.json`);
  }

  /**
   * The returned path can be one of the following:
   *   - `/path/to/user-package/artifacts/@zama-fhe/oracle-solidity/<contractName>.sol/<contractName>.json`
   *   - `@zama-fhe/oracle-solidity/artifacts/contracts/<contractName>.sol/<contractName>.json`
   */
  public resolveZamaFheOracleSolidityArtifactPath(contractName: FhevmDecryptionOracleContractName) {
    const root = this.resolveZamaFheOracleSolidityArtifactRootDir();
    return path.join(root, `contracts/${contractName}.sol/${contractName}.json`);
  }

  public async getFhevmCoreContractsArtifact(contractName: FhevmCoprocessorContractName) {
    const modulePath = this.resolveFhevmCoreContractsArtifactPath(contractName);
    const artifact = await import(modulePath);
    return { artifact, path: modulePath };
  }

  public async getZamaFheOracleSolidityArtifact(contractName: FhevmDecryptionOracleContractName) {
    const modulePath = this.resolveZamaFheOracleSolidityArtifactPath(contractName);
    const artifact = await import(modulePath);
    return { artifact, path: modulePath };
  }

  public getMockUtilsVersion(): string | undefined {
    try {
      const dir = this.mockUtils;
      if (!dir) {
        return undefined;
      }
      const pkgJson = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
      return pkgJson.version;
    } catch {
      return undefined;
    }
  }

  public getBundledMockUtilsVersion(): string | undefined {
    return bundledMockUtilsVersion;
  }

  private _checkMockUtilsVersions() {
    const projectVersion = this.getMockUtilsVersion();
    if (!projectVersion) {
      return;
    }
    const bundledVersion = this.getBundledMockUtilsVersion();
    if (bundledVersion !== projectVersion) {
      throw new HardhatFhevmError(
        `Version mismatch detected for @fhevm/mock-utils.\n` +
          `> Installed in your project: @fhevm/mock-utils:${projectVersion}\n` +
          `> Expected (plugin): @fhevm/mock-utils:${bundledVersion}\n\n` +
          `Please ensure that your project is using the same version of @fhevm/mock-utils.\n` +
          `You can either:\n` +
          `- Align the versions by updating your dependencies\n` +
          `- Rely solely on the version provided by @fhevm/hardhat-plugin (no direct install)\n\n` +
          `This mismatch may lead to subtle runtime issues due to type incompatibilities or conflicting behavior.`,
      );
    }
  }

  private _resolveFromConsumer(modulePathId: string): string {
    return resolveFromConsumer(modulePathId, this._root);
  }
}

export function resolveFromConsumer(modulePathId: string, basedir: string): string {
  try {
    const resolved = resolve.sync(modulePathId, {
      basedir,
    });
    return resolved;
  } catch {
    throw new HardhatFhevmError(`Unable to resolve ${modulePathId} from project at ${basedir}`);
  }
}
