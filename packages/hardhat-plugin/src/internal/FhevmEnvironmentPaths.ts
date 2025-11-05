import { FhevmHostContractName, version as bundledMockUtilsVersion } from "@fhevm/mock-utils";
import * as fs from "fs";
import * as path from "path";
import * as resolve from "resolve";

import { HardhatFhevmError } from "../error";
import constants from "./constants";
import { toUnixRelPath } from "./utils/path";

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
  public get rootDir(): string {
    return this._root;
  }

  /**
   * Returns `/path/to/user-package/node_modules`
   */
  public get nodeModulesDir(): string {
    return path.join(this.rootDir, "node_modules");
  }

  /**
   * Returns `/path/to/user-package/fhevmTemp`
   */
  public get cacheDir(): string {
    return path.join(this.rootDir, "fhevmTemp");
  }

  /**
   * Returns `/path/to/user-package/fhevmTemp/precompiled-fhevm-host-contracts-addresses.json`
   */
  public get cachePrecompiledFhevmHostContractsAddressesJson(): string {
    return path.join(this.cacheDir, "precompiled-fhevm-host-contracts-addresses.json");
  }

  /**
   * Returns `/path/to/user-package/fhevmTemp/@fhevm/solidity/config`
   */
  public get cacheFhevmSolidityConfigDir(): string {
    return path.join(
      this.cacheDir,
      path.join(constants.FHEVM_SOLIDITY_PACKAGE.name, path.dirname(constants.FHEVM_SOLIDITY_PACKAGE.configFile)),
    );
  }

  /**
   * Returns:
   * - Unix: `fhevmTemp/@fhevm/solidity/config`
   * - Windows: `fhevmTemp\@fhevm\solidity\config`
   */
  public get relCacheFhevmSolidityConfigDir(): string {
    const abs = this.cacheFhevmSolidityConfigDir;
    return path.relative(this.rootDir, abs);
  }

  /**
   * Returns `fhevmTemp/@fhevm/solidity/config` (in Unix format)
   */
  public get relCacheFhevmSolidityConfigDirUnix(): string {
    const abs = this.cacheFhevmSolidityConfigDir;
    return toUnixRelPath(path.relative(this.rootDir, abs));
  }

  /**
   * Returns `/path/to/user-package/fhevmTemp/@fhevm/solidity/config/ZamaConfig.sol`
   */
  public get cacheCoprocessorConfigSol(): string {
    return path.join(this.cacheFhevmSolidityConfigDir, path.basename(constants.FHEVM_SOLIDITY_PACKAGE.configFile));
  }

  /**
   * Returns `/path/to/user-package/node_modules/@fhevm/solidity`
   * This is legit since the user-package must have @fhevm/solidity in its dependencies.
   */
  public get fhevmSolidityDir(): string {
    return path.dirname(this._resolveFromConsumer(path.join(constants.FHEVM_SOLIDITY_PACKAGE.name, "package.json")));
  }

  /**
   * Returns `/path/to/user-package/node_modules/solidity-coverage`
   */
  public get solidityCoverageDir(): string | undefined {
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
  public get mockUtilsDir(): string | undefined {
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
  public get fhevmSolidityConfigDir(): string {
    return path.join(this.fhevmSolidityDir, path.dirname(constants.FHEVM_SOLIDITY_PACKAGE.configFile));
  }

  /**
   * Returns `/path/to/user-package/node_modules/@fhevm/solidity/config/ZamaConfig.sol`
   */
  public get fhevmSolidityConfigFile(): string {
    return path.join(this.fhevmSolidityDir, constants.FHEVM_SOLIDITY_PACKAGE.configFile);
  }

  /**
   * Returns `/path/to/user-package/node_modules/@fhevm/solidity/lib`
   */
  public get fhevmSolidityLibDir(): string {
    return path.join(this.fhevmSolidityDir, "lib");
  }

  /**
   * If using npm:
   * - Returns `/path/to/user-package/node_modules/@zama-fhe/relayer-sdk`
   * If using pnpm (strict no hoist):
   * - Returns `/path/to/user-package/node_modules/.pnpm/@zama-fhe+relayer-sdk@...@...@.../node_modules/@zama-fhe/relayer-sdk`
   * If using any other package manager: path to the installed module
   */
  public get zamaFheRelayerSdkDir(): string {
    return path.dirname(
      this._resolveFromConsumer(path.join(constants.ZAMA_FHE_RELAYER_SDK_PACKAGE.name, "package.json")),
    );
  }

  /**
   * The returned path can be one of the following:
   *   - `/path/to/user-package/artifacts/@fhevm/host-contracts`
   *   - `@fhevm/host-contracts/artifacts`
   */
  public resolveFhevmHostContractsArtifactRootDir() {
    let modulePath = path.resolve(path.join("artifacts", constants.FHEVM_HOST_CONTRACTS_PACKAGE.name));
    if (!fs.existsSync(modulePath)) {
      modulePath = path.join(constants.FHEVM_HOST_CONTRACTS_PACKAGE.name, "artifacts");
    }
    return modulePath;
  }

  /**
   * The returned path can be one of the following:
   *   - `/path/to/user-package/artifacts/@fhevm/host-contracts/<contractName>.sol/<contractName>.json`
   *   - `@fhevm/host-contracts/artifacts/contracts/<contractName>.sol/<contractName>.json`
   */
  public resolveFhevmHostContractsArtifactPath(contractName: FhevmHostContractName) {
    const root = this.resolveFhevmHostContractsArtifactRootDir();
    return path.join(root, `contracts/${contractName}.sol/${contractName}.json`);
  }

  public async getFhevmHostContractsArtifact(contractName: FhevmHostContractName) {
    const modulePath = this.resolveFhevmHostContractsArtifactPath(contractName);
    const artifact = await import(modulePath);
    return { artifact, path: modulePath };
  }

  public getMockUtilsVersion(): string | undefined {
    try {
      const dir = this.mockUtilsDir;
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
        `Version mismatch detected for ${constants.FHEVM_MOCK_UTILS_PACKAGE_NAME}.\n` +
          `> Installed in your project: ${constants.FHEVM_MOCK_UTILS_PACKAGE_NAME}:${projectVersion}\n` +
          `> Expected (plugin): ${constants.FHEVM_MOCK_UTILS_PACKAGE_NAME}:${bundledVersion}\n\n` +
          `Please ensure that your project is using the same version of ${constants.FHEVM_MOCK_UTILS_PACKAGE_NAME}.\n` +
          `You can either:\n` +
          `- Align the versions by updating your dependencies\n` +
          `- Rely solely on the version provided by ${constants.HARDHAT_PLUGIN_NAME} (no direct install)\n\n` +
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
