import { ethers as EthersT } from "ethers";

import { HardhatFhevmError } from "../error";
import constants from "./constants";

/**
 * Which kind of node the plugin is talking to.
 *
 * Replaces `@fhevm/mock-utils`' `FhevmMockProvider`. The name drops "mock": nothing is mocked any
 * more — the local networks run a real cleartext FHEVM stack. What this still has to decide is which
 * *kind* of node is on the other end, because that selects the client factory (`cleartext` vs real)
 * and whether the plugin may deploy the stack itself.
 *
 * The detection is deliberately thinner than the version it replaces: the old one probed
 * `web3_clientVersion` and negotiated which `setCode`/`setBalance`/`impersonateAccount` spelling the
 * node accepted, all of which existed to drive the JS mock engine. That engine is gone, so the
 * network name and chain id are enough.
 */
export enum FhevmNetworkType {
  Unknown = 0,
  /** In-process `hardhat` network. */
  Hardhat = 1,
  /** A `hardhat node` server, reached over `--network localhost`. */
  HardhatNode = 2,
  Anvil = 3,
  SepoliaEthereumTestnet = 4,
  EthereumMainnet = 5,
}

const SEPOLIA_CHAIN_ID = 11155111;
const MAINNET_CHAIN_ID = 1;

export type FhevmNetworkInfo = {
  readonly networkName: string;
  readonly chainId: number;
  readonly type: FhevmNetworkType;
  readonly url: string | undefined;
};

export class FhevmNetworkProvider {
  readonly #info: FhevmNetworkInfo;
  readonly #readonlyEthersProvider: EthersT.Provider;

  private constructor(info: FhevmNetworkInfo, readonlyEthersProvider: EthersT.Provider) {
    this.#info = info;
    this.#readonlyEthersProvider = readonlyEthersProvider;
  }

  /**
   * Resolves the node kind from the Hardhat network name plus the live chain id.
   *
   * The chain id is read from the node rather than from the Hardhat config, because for
   * `--network localhost` the config value is ignored (a `hardhat node` is always 31337), and for
   * public networks it may simply be absent.
   */
  public static async resolve(parameters: {
    readonly readonlyEthersProvider: EthersT.Provider;
    readonly networkName: string;
    readonly configChainId: number | undefined;
    readonly url: string | undefined;
  }): Promise<FhevmNetworkProvider> {
    const { networkName, url, configChainId, readonlyEthersProvider } = parameters;

    const chainId = Number((await readonlyEthersProvider.getNetwork()).chainId);
    if (configChainId !== undefined && configChainId !== chainId && networkName !== "localhost") {
      throw new HardhatFhevmError(
        `Network '${networkName}' is configured with chainId ${configChainId}, but the node reports ${chainId}.`,
      );
    }

    return new FhevmNetworkProvider({ networkName, chainId, url, type: __resolveType(networkName, chainId) }, readonlyEthersProvider);
  }

  public get info(): FhevmNetworkInfo {
    return this.#info;
  }

  public get chainId(): number {
    return this.#info.chainId;
  }

  public get readonlyEthersProvider(): EthersT.Provider {
    return this.#readonlyEthersProvider;
  }

  /**
   * A development node the plugin may deploy the cleartext stack onto, and which the SDK talks to in
   * cleartext mode. (Named `isMock` for API compatibility; see migration step 7 on renaming.)
   */
  public get isMock(): boolean {
    return (
      this.#info.type === FhevmNetworkType.Hardhat ||
      this.#info.type === FhevmNetworkType.HardhatNode ||
      this.#info.type === FhevmNetworkType.Anvil
    );
  }

  /** A public network, served by the real relayer. */
  public get isEthereum(): boolean {
    return this.isEthereumMainnet || this.isSepoliaEthereumTestnet;
  }

  public get isSepoliaEthereumTestnet(): boolean {
    return this.#info.type === FhevmNetworkType.SepoliaEthereumTestnet;
  }

  /** Kept as an alias of `isSepoliaEthereumTestnet` for existing call sites. */
  public get isSepoliaEthereum(): boolean {
    return this.isSepoliaEthereumTestnet;
  }

  public get isEthereumMainnet(): boolean {
    return this.#info.type === FhevmNetworkType.EthereumMainnet;
  }

  public async getCodeAt(address: string): Promise<string> {
    return await this.#readonlyEthersProvider.getCode(address);
  }
}

function __resolveType(networkName: string, chainId: number): FhevmNetworkType {
  if (networkName === "hardhat") {
    return FhevmNetworkType.Hardhat;
  }
  if (networkName === "localhost") {
    return FhevmNetworkType.HardhatNode;
  }
  if (networkName === "anvil") {
    return FhevmNetworkType.Anvil;
  }
  if (chainId === MAINNET_CHAIN_ID) {
    return FhevmNetworkType.EthereumMainnet;
  }
  if (chainId === SEPOLIA_CHAIN_ID) {
    return FhevmNetworkType.SepoliaEthereumTestnet;
  }
  // A named network on 31337 (the `devnet` .env flow) is still a local development node.
  if (chainId === constants.DEVELOPMENT_NETWORK_CHAINID) {
    return FhevmNetworkType.Anvil;
  }
  return FhevmNetworkType.Unknown;
}
