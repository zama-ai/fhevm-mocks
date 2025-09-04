import { ethers as EthersT } from "ethers";

import { assertIsAddress } from "../../utils/address.js";
import { assertFhevm } from "../../utils/error.js";
import { FhevmDecryptionOracleContractWrapper } from "./FhevmContractWrapper.js";
import { KMSVerifierPartialInterface } from "./interfaces/KMSVerifier.itf.js";

// Shareable
export class ZamaFheDecryptionOracle extends FhevmDecryptionOracleContractWrapper {
  #zamaFheDecryptionOracleContract: EthersT.Contract | undefined;
  #zamaFheDecryptionOracleContractAddress: string | undefined;

  constructor() {
    super("DecryptionOracle");
  }

  public static async create(
    runner: EthersT.ContractRunner,
    zamaFheDecryptionOracleContractAddress: string,
    abi?: EthersT.Interface | EthersT.InterfaceAbi,
  ): Promise<ZamaFheDecryptionOracle> {
    assertIsAddress(zamaFheDecryptionOracleContractAddress, "zamaFheDecryptionOracleContractAddress");

    const decryptionOracle = new ZamaFheDecryptionOracle();
    decryptionOracle.#zamaFheDecryptionOracleContractAddress = zamaFheDecryptionOracleContractAddress;
    decryptionOracle.#zamaFheDecryptionOracleContract = new EthersT.Contract(
      zamaFheDecryptionOracleContractAddress,
      abi ?? KMSVerifierPartialInterface,
      runner,
    );
    await decryptionOracle._initialize();
    return decryptionOracle;
  }

  public override get readonlyContract(): EthersT.Contract {
    assertFhevm(
      this.#zamaFheDecryptionOracleContract !== undefined,
      `ZamaFheDecryptionOracle wrapper is not yet initialized`,
    );
    return this.#zamaFheDecryptionOracleContract;
  }

  public override get interface(): EthersT.Interface {
    assertFhevm(
      this.#zamaFheDecryptionOracleContract !== undefined,
      `ZamaFheDecryptionOracle wrapper is not yet initialized`,
    );
    return this.#zamaFheDecryptionOracleContract.interface;
  }

  private async _initialize() {
    assertFhevm(
      this.#zamaFheDecryptionOracleContract !== undefined,
      `ZamaFheDecryptionOracle wrapper is not initialized`,
    );
  }

  public get address(): string {
    assertFhevm(
      this.#zamaFheDecryptionOracleContractAddress !== undefined,
      `ZamaFheDecryptionOracle wrapper not initialized`,
    );
    return this.#zamaFheDecryptionOracleContractAddress;
  }
}
