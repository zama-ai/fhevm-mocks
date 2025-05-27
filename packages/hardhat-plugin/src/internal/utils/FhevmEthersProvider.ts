// TODO
// Rename and put in mock-utils
import setupDebug from "debug";
import { ethers as EthersT } from "ethers";
import { HardhatRuntimeEnvironment, HttpNetworkConfig } from "hardhat/types";

import { HardhatFhevmError } from "../../error";
import { isAnvilProvider } from "./anvil";
import { getWeb3ClientVersion, isHardhatNode, resolveNetworkConfigChainId } from "./hh";

const debug = setupDebug("@fhevm/hardhat:ethers-provider");

export enum FhevmEthersProviderType {
  Unknown = 0,
  Hardhat = 1,
  HardhatNode = 2,
  Anvil = 3,
}

export type FhevmEthersProviderMethods = {
  setCode?: string;
  impersonateAccount?: string;
  setBalance?: string;
};

export type FhevmEthersProviderInfo = {
  web3ClientVersion: string;
  chainId: number;
  url?: string;
  networkName: string;
  type: FhevmEthersProviderType;
  methods: FhevmEthersProviderMethods;
};

export class FhevmEthersProvider {
  #provider?: EthersT.Provider & {
    send(method: string, params?: any[]): Promise<any>;
  };
  #info?: FhevmEthersProviderInfo;
  #savedBlockGasLimit: bigint | undefined;

  private constructor() {}

  public static async create(hre: HardhatRuntimeEnvironment) {
    const provider = new FhevmEthersProvider();

    provider.#provider = hre.ethers.provider;

    const web3ClientVersion = await getWeb3ClientVersion(provider.#provider);
    const networkName = hre.network.name;
    const isAnvil = await isAnvilProvider(networkName, provider.#provider);
    const isNetworkHardhatNode = await isHardhatNode(networkName, hre.network.config.chainId, hre.ethers.provider);
    const chainId = await resolveNetworkConfigChainId(hre, true);

    let url: string | undefined = undefined;

    let type: FhevmEthersProviderType = FhevmEthersProviderType.Unknown;
    let methods: FhevmEthersProviderMethods = {};

    if (isAnvil) {
      type = FhevmEthersProviderType.Anvil;
      methods = {
        setBalance: "anvil_setBalance",
        setCode: "anvil_setCode",
        impersonateAccount: "anvil_impersonateAccount",
      };
    } else if (isNetworkHardhatNode) {
      type = FhevmEthersProviderType.HardhatNode;
      methods = {
        setBalance: "hardhat_setBalance",
        setCode: "hardhat_setCode",
        impersonateAccount: "hardhat_impersonateAccount",
      };
    } else if (networkName === "hardhat") {
      type = FhevmEthersProviderType.Hardhat;
      methods = {
        setBalance: "hardhat_setBalance",
        setCode: "hardhat_setCode",
        impersonateAccount: "hardhat_impersonateAccount",
      };
    }

    if (isAnvil || isNetworkHardhatNode) {
      url = (hre.network.config as HttpNetworkConfig).url;
      if (!url) {
        throw new HardhatFhevmError(`Unable to determine the url of network ${networkName}`);
      }
    }

    provider.#info = {
      web3ClientVersion,
      type,
      methods,
      ...(url !== undefined && { url }),
      chainId,
      networkName,
    };

    return provider;
  }

  public get provider(): EthersT.Provider & { send(method: string, params?: any[]): Promise<any> } {
    if (!this.#provider) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    return this.#provider;
  }

  public get info(): FhevmEthersProviderInfo {
    if (!this.#info) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    return this.#info;
  }

  public get isMock(): boolean {
    if (!this.#info) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    return this.#info.type !== FhevmEthersProviderType.Unknown;
  }

  public get isHardhatWeb3Client(): boolean {
    if (!this.#info) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    return (
      this.#info.type === FhevmEthersProviderType.Hardhat || this.#info.type === FhevmEthersProviderType.HardhatNode
    );
  }

  public get chainId(): number {
    return this.info.chainId;
  }

  public send(method: string, params?: any[]): Promise<any> {
    return this.provider.send(method, params);
  }

  public async impersonateAddressAndSetBalance(hre: HardhatRuntimeEnvironment, address: string, balance: bigint) {
    if (!this.info.methods.impersonateAccount) {
      throw new HardhatFhevmError(`Network ${this.info.networkName} does not support account impersonation`);
    }
    if (!this.info.methods.setBalance) {
      throw new HardhatFhevmError(`Network ${this.info.networkName} does not support account setBalance`);
    }

    // for mocked mode
    // await provider.request({
    //   method: "hardhat_impersonateAccount",
    //   params: [address],
    // });
    await this.provider.send(this.info.methods.impersonateAccount, [address]);
    await this.provider.send(this.info.methods.setBalance, [address, EthersT.toBeHex(balance)]);

    if (this.info.type === FhevmEthersProviderType.Anvil) {
      const jsonRpcProvider = new EthersT.JsonRpcProvider(this.info.url);
      // In dev mode, speedup anvil tx processing by increasing polling frequency.
      // There is a difference between anvil and HH node. HH node process a tx instantly and tx.wait()
      // returns instantly. However anvil process the tx slighly later, therefore the first poll fails and
      // we have to wait for the next poll (4s later by default) to get the tx confirmation.
      jsonRpcProvider.pollingInterval = 100;
      return await jsonRpcProvider.getSigner(address);
    } else if (this.isHardhatWeb3Client) {
      return await hre.ethers.getSigner(address);
    } else {
      throw new HardhatFhevmError(`Network ${this.info.networkName} does not support account impersonation`);
    }
  }

  public async setCodeAt(address: string, byteCode: string) {
    const methodName = this.info.methods.setCode;
    if (!methodName) {
      throw new HardhatFhevmError(`Network ${this.info.networkName} does not support 'setCode' method.`);
    }
    if (typeof byteCode !== "string") {
      throw new HardhatFhevmError(`Invalid contract bytecode.`);
    }

    await this.provider.send(methodName, [address, byteCode]);
  }

  public async getCodeAt(address: string): Promise<string> {
    const byteCode = await this.provider.send("eth_getCode", [address, "latest"]);

    if (typeof byteCode !== "string") {
      throw new HardhatFhevmError(`Invalid contract bytecode.`);
    }

    return byteCode;
  }

  public async getBlockNumber(): Promise<number> {
    return await this.provider.getBlockNumber();
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
      throw new HardhatFhevmError(`The minimum block gas limit has already been set.`);
    }

    const currentBlockGasLimit = await this.getBlockGasLimit();

    if (!currentBlockGasLimit) {
      debug(`Unable to setup minimum block gas limit.`);
      return undefined;
    }

    if (minBlockGasLimit <= currentBlockGasLimit) {
      return undefined;
    }

    debug(
      `Adjust block gas limit to: ${minBlockGasLimit}. Current block gas limit is too low: ${currentBlockGasLimit}`,
    );

    await this.setBlockGasLimit(minBlockGasLimit);

    this.#savedBlockGasLimit = currentBlockGasLimit;
  }

  public async setBlockGasLimit(blockGasLimit: bigint) {
    const blockGasLimitHex = "0x" + blockGasLimit.toString(16);

    await this.provider.send("evm_setBlockGasLimit", [blockGasLimitHex]);

    debug(`Call evm_setBlockGasLimit ${blockGasLimit}`);
  }

  public async getBlockGasLimit(): Promise<bigint | undefined> {
    return (await this.provider.getBlock("latest"))?.gasLimit;
  }
}
