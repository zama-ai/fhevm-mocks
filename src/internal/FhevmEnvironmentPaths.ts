import path from "path";

import { FhevmEnvironment } from "./FhevmEnvironment";

export class FhevmEnvironmentPaths {
  private _fhevmEnv: FhevmEnvironment;

  constructor(fhevmEnv: FhevmEnvironment) {
    this._fhevmEnv = fhevmEnv;
  }

  /**
   * Returns `/path/to/user-package/node_modules`
   */
  public get nodeModules(): string {
    return path.join(this._fhevmEnv.hre.config.paths.root, "node_modules");
  }

  /**
   * Returns `/path/to/user-package/fhevmTemp`
   */
  public get cache(): string {
    return path.join(this._fhevmEnv.hre.config.paths.root, "fhevmTemp");
  }

  /**
   * Returns `/path/to/user-package/fhevmTemp/precompiled-core-contracts-addresses.json`
   */
  public get cachePrecompiledCoreContractsAddressesJson(): string {
    return path.join(this.cache, "precompiled-core-contracts-addresses.json");
  }

  /**
   * Returns `/path/to/user-package/fhevmTemp/@fhevm/solidity/config`
   */
  public get cacheFhevmSolidityConfig(): string {
    return path.join(this.cache, "@fhevm/solidity/config");
  }

  /**
   * Returns `fhevmTemp/@fhevm/solidity/config`
   */
  public get relCacheFhevmSolidityConfig(): string {
    const abs = this.cacheFhevmSolidityConfig;
    return path.relative(this._fhevmEnv.hre.config.paths.root, abs);
  }

  /**
   * Returns `/path/to/user-package/fhevmTemp/@fhevm/solidity/config/FHEVMConfig.sol`
   */
  public get cacheFHEVMConfigSol(): string {
    return path.join(this.cacheFhevmSolidityConfig, "FHEVMConfig.sol");
  }

  /**
   * Returns `/path/to/user-package/node_modules/@fhevm/solidity`
   */
  public get fhevmSolidity(): string {
    return path.join(this.nodeModules, "@fhevm/solidity");
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
    return path.join(this.fhevmSolidity, "config");
  }

  /**
   * Returns `/path/to/user-package/node_modules/@zama-fhe`
   */
  public get zamaFhe(): string {
    return path.join(this.nodeModules, "@zama-fhe");
  }

  /**
   * Returns `/path/to/user-package/node_modules/@zama-fhe/oracle-solidity`
   */
  public get zamaFheOracleSolidity(): string {
    return path.join(this.zamaFhe, "oracle-solidity");
  }

  /**
   * Returns `/path/to/user-package/node_modules/@zama-fhe/oracle-solidity/address`
   */
  public get zamaFheOracleSolidityAddress(): string {
    return path.join(this.zamaFheOracleSolidity, "address");
  }

  /**
   * Returns `/path/to/user-package/fhevmTemp/@zama-fhe/oracle-solidity/address`
   */
  public get cacheZamaFheOracleSolidityAddress(): string {
    return path.join(this.cache, "@zama-fhe/oracle-solidity/address");
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
    return path.relative(this._fhevmEnv.hre.config.paths.root, abs);
  }
}
