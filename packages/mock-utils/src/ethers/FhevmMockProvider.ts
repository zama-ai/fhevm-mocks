import { ethers as EthersT, JsonRpcProvider } from "ethers";

import constants from "../constants.js";
import { FhevmError, assertFhevm } from "../utils/error.js";
import { assertIsString } from "../utils/string.js";
import { isAnvilProvider } from "./anvil.js";
import { isHardhatProvider } from "./hardhat.js";
import { type MinimalProvider, connectedChainId, connectedWeb3Client, minimalProviderSend } from "./provider.js";

//const debug = setupDebug("@fhevm/hardhat:ethers-provider");

export enum FhevmMockProviderType {
  Unknown = 0,
  Hardhat = 1,
  HardhatNode = 2,
  Anvil = 3,
  SepoliaEthereum = 4,
}

function fhevmMockProviderTypeToString(value: FhevmMockProviderType) {
  switch (value) {
    case FhevmMockProviderType.Unknown:
      return "Unknown";
    case FhevmMockProviderType.Hardhat:
      return "Hardhat";
    case FhevmMockProviderType.HardhatNode:
      return "Hardhat Node";
    case FhevmMockProviderType.Anvil:
      return "Anvil";
    case FhevmMockProviderType.SepoliaEthereum:
      return "SepoliaEthereum";
  }
}

export type FhevmMockProviderMethods = {
  setCode?: string;
  impersonateAccount?: string;
  setBalance?: string;
};

export type FhevmMockProviderInfo = {
  web3ClientVersion: string;
  chainId: number;
  url: string | undefined;
  networkName: string;
  type: FhevmMockProviderType;
  methods: FhevmMockProviderMethods;
};

// WRONG name!!!
export class FhevmMockProvider {
  #minimalProvider: MinimalProvider | undefined;
  #readonlyEthersProvider: EthersT.Provider | undefined;
  #info: FhevmMockProviderInfo | undefined;
  #savedBlockGasLimit: bigint | undefined;
  #debugFunc: ((message: string) => void) | undefined;

  public static async fromReadonlyProvider(
    readonlyProvider: EthersT.Provider & MinimalProvider,
    networkName: string,
    defaultProviderType: FhevmMockProviderType | undefined,
    defaultChainId: number | undefined,
    url: string | undefined,
  ) {
    return FhevmMockProvider.create(
      readonlyProvider,
      readonlyProvider,
      networkName,
      defaultProviderType,
      defaultChainId,
      url,
    );
  }

  public static async create(
    minimalProvider: MinimalProvider,
    readonlyEthersProvider: EthersT.Provider | undefined,
    networkName: string,
    defaultProviderType: FhevmMockProviderType | undefined,
    defaultChainId: number | undefined,
    url: string | undefined,
  ) {
    const info = await _resolveProviderInfo(minimalProvider, networkName, defaultProviderType, defaultChainId, url);
    const p = new FhevmMockProvider();
    p.#minimalProvider = minimalProvider;
    p.#info = info;

    if (readonlyEthersProvider === undefined && info.url !== undefined) {
      // no need to change the polling interval since
      // readonlyEthersProvider is read-only and does not listen to events
      readonlyEthersProvider = new JsonRpcProvider(info.url);
    }

    p.#readonlyEthersProvider = readonlyEthersProvider;

    return p;
  }

  public setDebugFunc(debugFunc: (message: string) => void) {
    assertFhevm(typeof debugFunc === "function");
    this.#debugFunc = debugFunc;
  }

  // public async getTransaction(txHash: string): Promise<null | EthersT.TransactionResponse> {
  //   return await this.ethersProvider.getTransaction(txHash);
  // }

  public get readonlyEthersProvider(): EthersT.Provider {
    // Make sure it is properly initialize. Use another property since #ethersProvider can be undefined
    if (!this.#minimalProvider) {
      throw new FhevmError(`the FhevmMockProvider instance is not initialized.`);
    }
    if (!this.#readonlyEthersProvider) {
      throw new FhevmError(`the FhevmMockProvider instance is not able to provide a valid ethers.Provider instance.`);
    }
    return this.#readonlyEthersProvider;
  }

  public get minimalProvider(): MinimalProvider {
    if (!this.#minimalProvider) {
      throw new FhevmError(`the FhevmMockProvider instance is not initialized.`);
    }
    return this.#minimalProvider;
  }

  public get info(): FhevmMockProviderInfo {
    if (!this.#info) {
      throw new FhevmError(`the FhevmMockProvider instance is not initialized.`);
    }
    return this.#info;
  }

  public get isMock(): boolean {
    if (!this.#info) {
      throw new FhevmError(`the FhevmMockProvider instance is not initialized.`);
    }
    return (
      this.#info.type === FhevmMockProviderType.Hardhat ||
      this.#info.type === FhevmMockProviderType.HardhatNode ||
      this.#info.type === FhevmMockProviderType.Anvil
    );
  }

  public get isSepoliaEthereum(): boolean {
    if (!this.#info) {
      throw new FhevmError(`the FhevmMockProvider instance is not initialized.`);
    }
    return this.#info.type === FhevmMockProviderType.SepoliaEthereum;
  }

  public get isHardhatWeb3Client(): boolean {
    if (!this.#info) {
      throw new FhevmError(`the FhevmMockProvider instance is not initialized.`);
    }
    return this.#info.type === FhevmMockProviderType.Hardhat || this.#info.type === FhevmMockProviderType.HardhatNode;
  }

  public get chainId(): number {
    return this.info.chainId;
  }

  public async impersonateAddressAndSetBalance(address: string, balance: bigint): Promise<EthersT.Signer | undefined> {
    if (!this.info.methods.impersonateAccount) {
      throw new FhevmError(`Network ${this.info.networkName} does not support account impersonation`);
    }
    if (!this.info.methods.setBalance) {
      throw new FhevmError(`Network ${this.info.networkName} does not support account setBalance`);
    }
    if (this.info.type === FhevmMockProviderType.Anvil) {
      if (!this.info.url) {
        throw new FhevmError(`Unable to impersonate account. Missing Anvil url.`);
      }
    }

    // for mocked mode
    // await provider.request({
    //   method: "hardhat_impersonateAccount",
    //   params: [address],
    // });
    await this.send(this.info.methods.impersonateAccount, [address]);
    await this.send(this.info.methods.setBalance, [address, EthersT.toBeHex(balance)]);

    if (this.info.type === FhevmMockProviderType.Anvil) {
      const jsonRpcProvider = new EthersT.JsonRpcProvider(this.info.url);
      // In dev mode, speedup anvil tx processing by increasing polling frequency.
      // There is a difference between anvil and HH node. HH node process a tx instantly and tx.wait()
      // returns instantly. However anvil process the tx slighly later, therefore the first poll fails and
      // we have to wait for the next poll (4s later by default) to get the tx confirmation.
      jsonRpcProvider.pollingInterval = 100;
      return await jsonRpcProvider.getSigner(address);
    } else if (this.isHardhatWeb3Client) {
      // HH runtime is in charge to call getSigner with the impersonated `address` as argument
      // to retreive the signer object.
      // Example: await hre.ethers.getSigner(impersonated_address);
      return undefined;
    } else {
      throw new FhevmError(`Network ${this.info.networkName} does not support account impersonation`);
    }
  }

  public async setCodeAt(address: string, byteCode: string) {
    const methodName = this.info.methods.setCode;
    if (!methodName) {
      throw new FhevmError(`Network ${this.info.networkName} does not support 'setCode' method.`);
    }
    if (typeof byteCode !== "string") {
      throw new FhevmError(`Invalid contract bytecode.`);
    }

    await this.send(methodName, [address, byteCode]);
  }

  public send(method: string, params?: any[]): Promise<any> {
    return minimalProviderSend(this.minimalProvider, method, params ?? []);
  }

  public async getCodeAt(address: string): Promise<string> {
    const byteCode = await this.send("eth_getCode", [address, "latest"]);

    if (typeof byteCode !== "string") {
      throw new FhevmError(`Unexpected 'eth_getCode' RPC response type.`);
    }

    return byteCode;
  }

  public async getBlockNumber(): Promise<number> {
    const blockNumber = await this.send("eth_blockNumber");
    return Number(blockNumber);
  }

  public async unsetTemporaryMinimumBlockGasLimit() {
    if (!this.#savedBlockGasLimit) {
      return;
    }

    try {
      await this.setBlockGasLimit(this.#savedBlockGasLimit);
    } finally {
      this.#savedBlockGasLimit = undefined;
    }
  }

  public async setTemporaryMinimumBlockGasLimit(minBlockGasLimit: bigint) {
    if (this.#savedBlockGasLimit) {
      throw new FhevmError(`The minimum block gas limit has already been set.`);
    }

    const currentBlockGasLimit = await this.getBlockGasLimit();

    if (!currentBlockGasLimit) {
      this._debug(`Unable to setup minimum block gas limit.`);
      return undefined;
    }

    if (minBlockGasLimit <= currentBlockGasLimit) {
      return undefined;
    }

    this._debug(
      `Adjust block gas limit to: ${minBlockGasLimit}. Current block gas limit is too low: ${currentBlockGasLimit}`,
    );

    await this.setBlockGasLimit(minBlockGasLimit);

    this.#savedBlockGasLimit = currentBlockGasLimit;
  }

  public async setBlockGasLimit(blockGasLimit: bigint) {
    const blockGasLimitHex = "0x" + blockGasLimit.toString(16);

    await this.send("evm_setBlockGasLimit", [blockGasLimitHex]);

    this._debug(`Call evm_setBlockGasLimit ${blockGasLimit}`);
  }

  public async getBlockGasLimit(): Promise<bigint | undefined> {
    const res = await this.send("eth_getBlockByNumber", ["latest", false]);
    if (!res) {
      return undefined;
    }
    if (!("gasLimit" in res)) {
      return undefined;
    }

    try {
      return BigInt(res.gasLimit);
    } catch {
      return undefined;
    }
  }

  private _debug(message: string) {
    if (this.#debugFunc) {
      this.#debugFunc(message);
    }
  }
}

async function _resolveProviderInfo(
  minimalProvider: MinimalProvider,
  networkName: string,
  defaultProviderType: FhevmMockProviderType | undefined,
  defaultChainId: number | undefined,
  url?: string,
): Promise<FhevmMockProviderInfo> {
  assertIsString(networkName, "networkName");

  if (
    networkName !== "hardhat" &&
    networkName !== "localhost" &&
    defaultChainId === constants.SEPOLIA_ETHEREUM_TESTNET_CHAINID
  ) {
    assertFhevm(url !== undefined, "Missing sepolia url");
    return {
      type: FhevmMockProviderType.SepoliaEthereum,
      chainId: constants.SEPOLIA_ETHEREUM_TESTNET_CHAINID,
      methods: {},
      url,
      networkName,
      web3ClientVersion: "",
    };
  }

  const p = await _resolveProvider(minimalProvider, defaultProviderType, defaultChainId, url);
  switch (p.type) {
    case FhevmMockProviderType.Unknown: {
      return {
        type: p.type,
        chainId: p.chainId,
        methods: {},
        url,
        networkName,
        web3ClientVersion: p.web3ClientVersion,
      };
    }
    case FhevmMockProviderType.Hardhat:
    case FhevmMockProviderType.HardhatNode: {
      return {
        type: p.type,
        chainId: p.chainId,
        methods: {
          setBalance: "hardhat_setBalance",
          setCode: "hardhat_setCode",
          impersonateAccount: "hardhat_impersonateAccount",
        },
        url,
        networkName,
        web3ClientVersion: p.web3ClientVersion,
      };
    }
    case FhevmMockProviderType.Anvil: {
      return {
        type: p.type,
        chainId: p.chainId,
        methods: {
          setBalance: "anvil_setBalance",
          setCode: "anvil_setCode",
          impersonateAccount: "anvil_impersonateAccount",
        },
        url,
        networkName,
        web3ClientVersion: p.web3ClientVersion,
      };
    }
    default: {
      throw new FhevmError(`Unsuppored FhevmMockProviderType enum value '${p.type}'`);
    }
  }
}

async function _resolveProvider(
  minimalProvider: MinimalProvider,
  defaultProviderType: FhevmMockProviderType | undefined,
  defaultChainId: number | undefined,
  url?: string,
): Promise<{ type: FhevmMockProviderType; chainId: number; web3ClientVersion: any }> {
  if (!url) {
    if (defaultProviderType !== FhevmMockProviderType.Hardhat) {
      throw new FhevmError(`Missing provider url`);
    } else {
      if (defaultChainId !== 31337) {
        throw new FhevmError(`Unexpected default chainId. Expecting '31337', got '${defaultChainId}' instead.`);
      }
    }
  } else {
    if (!URL.canParse(url)) {
      throw new FhevmError(`Invalid provider url '${url}'`);
    }
  }

  const clientRes = await connectedWeb3Client(minimalProvider);

  // Test Anvil first, because Anvil also supports hardhat RPC methods.
  const anvilRes = await isAnvilProvider(minimalProvider);
  if (!anvilRes.couldNotConnect) {
    if (anvilRes.isAnvil) {
      if (defaultProviderType !== undefined && defaultProviderType !== FhevmMockProviderType.Anvil) {
        throw new FhevmError(
          `Provider type mismatch. Expecting ${fhevmMockProviderTypeToString(defaultProviderType)}, got ${fhevmMockProviderTypeToString(FhevmMockProviderType.Anvil)} instead`,
        );
      }

      if (defaultChainId !== undefined && defaultChainId !== anvilRes.chainId) {
        throw new FhevmError(
          `Anvil chainId mismatch. Expecting chainId=${defaultChainId}, got ${anvilRes.chainId} instead`,
        );
      }

      if (!clientRes.client) {
        throw new FhevmError(`Unable to retreive Anvil web3 client version.`);
      }

      return {
        type: FhevmMockProviderType.Anvil,
        chainId: anvilRes.chainId,
        web3ClientVersion: clientRes.client,
      };
    }
    // could connect, but was not identified as an Anvil provider
  }

  // Test Hardhat last, to avoid misdetecting the client.
  const hhRes = await isHardhatProvider(minimalProvider);
  if (!hhRes.couldNotConnect) {
    if (hhRes.isHardhat) {
      const providerType = url !== undefined ? FhevmMockProviderType.HardhatNode : FhevmMockProviderType.Hardhat;

      if (defaultProviderType !== undefined && defaultProviderType !== providerType) {
        throw new FhevmError(
          `Provider type mismatch. Expecting ${fhevmMockProviderTypeToString(defaultProviderType)}, got ${fhevmMockProviderTypeToString(providerType)} instead`,
        );
      }

      if (defaultChainId !== undefined && defaultChainId !== hhRes.chainId) {
        throw new FhevmError(
          `Hardhat chainId mismatch. Expecting chainId=${defaultChainId}, got ${hhRes.chainId} instead`,
        );
      }

      if (!clientRes.client) {
        throw new FhevmError(`Unable to retreive Hardhat web3 client version.`);
      }

      return {
        type: providerType,
        chainId: hhRes.chainId,
        web3ClientVersion: clientRes.client,
      };
    }
    // could connect, but was not identified as an Hardhat provider
  }

  // 3 possibilities:
  // 1- could not connect
  // 2- could connect, but was not identified as an Anvil provider
  // 3- could connect, but was not identified as an Hardhat provider

  if (!clientRes.couldNotConnect) {
    const chainId = await connectedChainId(minimalProvider);
    if (chainId === undefined) {
      throw new FhevmError(`Unable to query provider chaindId`);
    }

    if (defaultProviderType !== undefined && defaultProviderType !== FhevmMockProviderType.Unknown) {
      throw new FhevmError(
        `Provider type mismatch. Expecting ${fhevmMockProviderTypeToString(defaultProviderType)}, got ${fhevmMockProviderTypeToString(FhevmMockProviderType.Unknown)} instead`,
      );
    }

    if (defaultChainId !== undefined && defaultChainId !== chainId) {
      throw new FhevmError(`Provider chainId mismatch. Expecting chainId=${defaultChainId}, got ${chainId} instead`);
    }

    if (!clientRes.client) {
      throw new FhevmError(`Unable to retreive provider web3 client version.`);
    }

    return { type: FhevmMockProviderType.Unknown, chainId, web3ClientVersion: clientRes.client };
  }

  if (defaultProviderType === undefined) {
    throw new FhevmError(`Resolve provider failed. Missing default provider type.`);
  }

  if (defaultChainId === undefined) {
    throw new FhevmError(`Resolve provider failed. Missing default provider chainId.`);
  }

  return { type: defaultProviderType, chainId: defaultChainId, web3ClientVersion: undefined };
}

// export class FhevMockProvider {
//   #provider: MinimalProvider;
//   #info: FhevmMockProviderInfo;
//   #savedBlockGasLimit: bigint | undefined;

//   public static async create(  minimalProvider: MinimalProvider,
//   networkName: string,
//   defaultProviderType: FhevmMockProviderType | undefined,
//   defaultChainId: number | undefined,
//   url?: string,
// ) {
//     const url: string | undefined = "url" in hre.network.config ? hre.network.config.url : undefined;
//     const defaults = FhevmEthersProvider._guessDefault(hre, url);
//     return FhevmEthersProvider.create2(hre.ethers.provider, hre.network.name, defaults.type, defaults.chainId, url);
//   }

//   public static async create2(
//     minimalProvider: HardhatEthersProvider,
//     networkName: string,
//     defaultProviderType: FhevmEthersProviderType,
//     defaultChainId: number | undefined,
//     url?: string,
//   ) {
//     const provider = new FhevmEthersProvider();

//     provider.#provider = minimalProvider;

//     const web3ClientVersion = await getWeb3ClientVersion(minimalProvider);

//     let _isAnvil = false;
//     let _isHardhatNode = false;
//     let _chainId: number | undefined = undefined;

//     if (url) {
//       let res = await isHardhatProvider(minimalProvider);
//       if (res.couldNotConnect) {
//         _isHardhatNode = defaultProviderType === FhevmEthersProviderType.HardhatNode;
//         _chainId = defaultProviderType === FhevmEthersProviderType.HardhatNode ? defaultChainId : undefined;
//       } else {
//         _isHardhatNode = res.isHardhat;
//         if (res.isHardhat) {
//           _chainId = res.chainId;
//         }
//       }

//       res = await isAnvilProvider(minimalProvider);
//       if (res.couldNotConnect) {
//         _isAnvil = defaultProviderType === FhevmEthersProviderType.Anvil;
//       } else {
//         _isAnvil = res.isAnvil;
//         if (res.isAnvil) {
//           _chainId = res.chainId;
//         }
//       }
//     }
//     const isAnvil = networkName === "hardhat" ? false : await isAnvilProvider(provider.#provider);

//     assert(!isAnvil);

//     const isNetworkHardhatNode = await isHardhatNode(networkName, hre.network.config.chainId, provider.#provider);
//     const chainId = await resolveNetworkConfigChainId(hre, true);

//     //let url: string | undefined = undefined;

//     let type: FhevmEthersProviderType = FhevmEthersProviderType.Unknown;
//     let methods: FhevmEthersProviderMethods = {};

//     if (isAnvil) {
//       type = FhevmEthersProviderType.Anvil;
//       methods = {
//         setBalance: "anvil_setBalance",
//         setCode: "anvil_setCode",
//         impersonateAccount: "anvil_impersonateAccount",
//       };
//     } else if (isNetworkHardhatNode) {
//       type = FhevmEthersProviderType.HardhatNode;
//       methods = {
//         setBalance: "hardhat_setBalance",
//         setCode: "hardhat_setCode",
//         impersonateAccount: "hardhat_impersonateAccount",
//       };
//     } else if (networkName === "hardhat") {
//       type = FhevmEthersProviderType.Hardhat;
//       methods = {
//         setBalance: "hardhat_setBalance",
//         setCode: "hardhat_setCode",
//         impersonateAccount: "hardhat_impersonateAccount",
//       };
//     }

//     if (isAnvil || isNetworkHardhatNode) {
//       url = (hre.network.config as HttpNetworkConfig).url;
//       if (!url) {
//         throw new HardhatFhevmError(`Unable to determine the url of network ${networkName}`);
//       }
//     }

//     provider.#info = {
//       web3ClientVersion,
//       type,
//       methods,
//       ...(url !== undefined && { url }),
//       chainId,
//       networkName,
//     };

//     return provider;
//   }

//   public get provider(): EthersT.Provider & { send(method: string, params?: any[]): Promise<any> } {
//     if (!this.#provider) {
//       throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
//     }
//     return this.#provider;
//   }

//   public get info(): FhevmEthersProviderInfo {
//     if (!this.#info) {
//       throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
//     }
//     return this.#info;
//   }

//   public get isMock(): boolean {
//     if (!this.#info) {
//       throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
//     }
//     return this.#info.type !== FhevmEthersProviderType.Unknown;
//   }

//   public get isHardhatWeb3Client(): boolean {
//     if (!this.#info) {
//       throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
//     }
//     return (
//       this.#info.type === FhevmEthersProviderType.Hardhat || this.#info.type === FhevmEthersProviderType.HardhatNode
//     );
//   }

//   public get chainId(): number {
//     return this.info.chainId;
//   }

//   public send(method: string, params?: any[]): Promise<any> {
//     return this.provider.send(method, params);
//   }

//   public async impersonateAddressAndSetBalance(hre: HardhatRuntimeEnvironment, address: string, balance: bigint) {
//     if (!this.info.methods.impersonateAccount) {
//       throw new HardhatFhevmError(`Network ${this.info.networkName} does not support account impersonation`);
//     }
//     if (!this.info.methods.setBalance) {
//       throw new HardhatFhevmError(`Network ${this.info.networkName} does not support account setBalance`);
//     }

//     // for mocked mode
//     // await provider.request({
//     //   method: "hardhat_impersonateAccount",
//     //   params: [address],
//     // });
//     await this.provider.send(this.info.methods.impersonateAccount, [address]);
//     await this.provider.send(this.info.methods.setBalance, [address, EthersT.toBeHex(balance)]);

//     if (this.info.type === FhevmEthersProviderType.Anvil) {
//       const jsonRpcProvider = new EthersT.JsonRpcProvider(this.info.url);
//       // In dev mode, speedup anvil tx processing by increasing polling frequency.
//       // There is a difference between anvil and HH node. HH node process a tx instantly and tx.wait()
//       // returns instantly. However anvil process the tx slighly later, therefore the first poll fails and
//       // we have to wait for the next poll (4s later by default) to get the tx confirmation.
//       jsonRpcProvider.pollingInterval = 100;
//       return await jsonRpcProvider.getSigner(address);
//     } else if (this.isHardhatWeb3Client) {
//       return await hre.ethers.getSigner(address);
//     } else {
//       throw new HardhatFhevmError(`Network ${this.info.networkName} does not support account impersonation`);
//     }
//   }

//   public async setCodeAt(address: string, byteCode: string) {
//     const methodName = this.info.methods.setCode;
//     if (!methodName) {
//       throw new HardhatFhevmError(`Network ${this.info.networkName} does not support 'setCode' method.`);
//     }
//     if (typeof byteCode !== "string") {
//       throw new HardhatFhevmError(`Invalid contract bytecode.`);
//     }

//     await this.provider.send(methodName, [address, byteCode]);
//   }

//   public async getCodeAt(address: string): Promise<string> {
//     const byteCode = await this.provider.send("eth_getCode", [address, "latest"]);

//     if (typeof byteCode !== "string") {
//       throw new HardhatFhevmError(`Invalid contract bytecode.`);
//     }

//     return byteCode;
//   }

//   public async getBlockNumber(): Promise<number> {
//     return await this.provider.getBlockNumber();
//   }

//   public async unsetTemporaryMinimumBlockGasLimit() {
//     if (!this.#savedBlockGasLimit) {
//       return;
//     }

//     try {
//       await this.setBlockGasLimit(this.#savedBlockGasLimit);
//     } finally {
//       this.#savedBlockGasLimit = undefined;
//     }
//   }

//   public async setTemporaryMinimumBlockGasLimit(minBlockGasLimit: bigint) {
//     if (this.#savedBlockGasLimit) {
//       throw new HardhatFhevmError(`The minimum block gas limit has already been set.`);
//     }

//     const currentBlockGasLimit = await this.getBlockGasLimit();

//     if (!currentBlockGasLimit) {
//       debug(`Unable to setup minimum block gas limit.`);
//       return undefined;
//     }

//     if (minBlockGasLimit <= currentBlockGasLimit) {
//       return undefined;
//     }

//     debug(
//       `Adjust block gas limit to: ${minBlockGasLimit}. Current block gas limit is too low: ${currentBlockGasLimit}`,
//     );

//     await this.setBlockGasLimit(minBlockGasLimit);

//     this.#savedBlockGasLimit = currentBlockGasLimit;
//   }

//   public async setBlockGasLimit(blockGasLimit: bigint) {
//     const blockGasLimitHex = "0x" + blockGasLimit.toString(16);

//     await this.provider.send("evm_setBlockGasLimit", [blockGasLimitHex]);

//     debug(`Call evm_setBlockGasLimit ${blockGasLimit}`);
//   }

//   public async getBlockGasLimit(): Promise<bigint | undefined> {
//     return (await this.provider.getBlock("latest"))?.gasLimit;
//   }
// }
