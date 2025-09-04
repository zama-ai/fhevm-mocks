import {
  CoprocessorConfig,
  CoprocessorEvent,
  DecryptionRequestEvent,
  FhevmContractName,
  FhevmHandle,
  FhevmPublicDecryptOptions,
  FhevmType,
  FhevmTypeEuint,
  FhevmTypeName,
  FhevmUserDecryptOptions,
  getCoprocessorConfig,
  getFhevmTypeInfo,
} from "@fhevm/mock-utils";
import { parseCoprocessorEventsFromLogs, parseDecryptionRequestEventsFromLogs } from "@fhevm/mock-utils";
import { relayer } from "@fhevm/mock-utils";
import { userDecryptHandleBytes32 as mockUtilsUserDecryptHandleBytes32 } from "@fhevm/mock-utils";
import type { DecryptedResults } from "@zama-fhe/relayer-sdk/node";
import type { EIP712, FhevmInstance, HandleContractPair, RelayerEncryptedInput } from "@zama-fhe/relayer-sdk/node";
import { AddressLike, ethers as EthersT } from "ethers";

import { HardhatFhevmError } from "../error";
import { HardhatFhevmRuntimeDebugger, HardhatFhevmRuntimeEnvironment } from "../types";
import { FhevmEnvironment } from "./FhevmEnvironment";
import constants from "./constants";
import { FhevmContractError, parseFhevmError } from "./errors/FhevmContractError";
import { logBox } from "./utils/log";

/**
 * Public External API
 */
export class FhevmExternalAPI implements HardhatFhevmRuntimeEnvironment {
  private _fhevmEnv: FhevmEnvironment;

  constructor(fhevmEnv: FhevmEnvironment) {
    this._fhevmEnv = fhevmEnv;
  }

  public async initializeCLIApi(): Promise<void> {
    await this._fhevmEnv.initializeCLIApi();
  }

  public get isMock(): boolean {
    //minimalInit
    return this._fhevmEnv.mockProvider.isMock;
  }

  public get debugger(): HardhatFhevmRuntimeDebugger {
    return this._fhevmEnv.debugger;
  }

  public async createInstance(): Promise<FhevmInstance> {
    //_deployCore
    return await this._fhevmEnv.createInstance();
  }

  public typeof(handleBytes32: string): FhevmTypeName {
    return FhevmHandle.fromBytes32Hex(handleBytes32).fhevmTypeInfo.name;
  }

  public async tryParseFhevmError(
    e: unknown,
    options?: {
      encryptedInput?: RelayerEncryptedInput;
      out?: "stderr" | "stdout" | "console";
    },
  ): Promise<FhevmContractError | undefined> {
    const err = await parseFhevmError(this._fhevmEnv, e, options);
    if (err && options?.out !== undefined) {
      logBox(`${err.name} error`, err.longMessage, options);
    }
    return err;
  }

  public revertedWithCustomErrorArgs(
    contractName: FhevmContractName,
    customErrorName: string,
  ): [{ interface: EthersT.Interface }, string] {
    const itf = this._fhevmEnv.getContractsRepository().getContractFromName(contractName)?.interface;
    if (!itf) {
      throw new HardhatFhevmError(`Unable to retrieve FHEVM contrat interface for contract ${contractName}`);
    }
    return [{ interface: itf }, customErrorName];
  }

  public parseDecryptionRequestEvents(
    logs: (EthersT.EventLog | EthersT.Log)[] | null | undefined,
  ): DecryptionRequestEvent[] {
    return parseDecryptionRequestEventsFromLogs(logs);
  }

  public parseCoprocessorEvents(logs: (EthersT.EventLog | EthersT.Log)[] | null | undefined): CoprocessorEvent[] {
    return parseCoprocessorEventsFromLogs(logs);
  }

  public async getRelayerMetadata(): Promise<relayer.RelayerMetadata> {
    return await relayer.requestRelayerMetadata(this._fhevmEnv.relayerProvider);
  }

  public async awaitDecryptionOracle() {
    await relayer.requestFhevmAwaitDecryptionOracle(this._fhevmEnv.relayerProvider);
  }

  public async encryptUint(
    fhevmType: FhevmTypeEuint,
    value: number | bigint,
    contractAddress: string,
    userAddress: string,
  ) {
    /*
    How to use:
    ===========

    const encryptedOne = await fhevm
      .encryptUint(fheCounterContractAddress, signers.alice.address, FhevmType.euint32, clearOne);

    const tx = await fheCounterContract
      .connect(signers.alice)
      .increment(encryptedOne.externalEUint, encryptedOne.inputProof);
    await tx.wait();
    
    */
    const input = this.createEncryptedInput(contractAddress, userAddress);
    switch (fhevmType) {
      case FhevmType.euint8:
        input.add8(value);
        break;
      case FhevmType.euint16:
        input.add16(value);
        break;
      case FhevmType.euint32:
        input.add32(value);
        break;
      case FhevmType.euint64:
        input.add64(value);
        break;
      case FhevmType.euint128:
        input.add128(value);
        break;
      case FhevmType.euint256:
        input.add256(value);
        break;
      default: {
        throw new HardhatFhevmError(
          `encryptUint: the fhevmType argument: '${fhevmType}' is not a valid FhevmTypeEuint.`,
        );
      }
    }

    const res = await input.encrypt();

    return { externalEuint: res.handles[0], inputProof: res.inputProof };
  }

  public async encryptBool(value: boolean, contractAddress: string, userAddress: string) {
    const input = this.createEncryptedInput(contractAddress, userAddress);
    input.addBool(value);
    const res = await input.encrypt();
    return { externalEbool: res.handles[0], inputProof: res.inputProof };
  }

  public async encryptAddress(value: string, contractAddress: string, userAddress: string) {
    const input = this.createEncryptedInput(contractAddress, userAddress);
    input.addAddress(value);
    const res = await input.encrypt();
    return { externalEaddress: res.handles[0], inputProof: res.inputProof };
  }

  public createEncryptedInput(contractAddress: string, userAddress: string): RelayerEncryptedInput {
    if (!EthersT.isAddress(contractAddress)) {
      throw new HardhatFhevmError(
        `createEncryptedInput: the 'contractAddress' argument is not a valid address. Expecting a valid string address. Got '${contractAddress}' instead.`,
      );
    }
    if (!EthersT.isAddress(userAddress)) {
      throw new HardhatFhevmError(
        `createEncryptedInput: the 'userAddress' argument is not a valid address. Expecting a valid string address. Got '${userAddress}' instead.`,
      );
    }
    return this._fhevmEnv.instance.createEncryptedInput(contractAddress, userAddress);
  }

  public createEIP712(
    publicKey: string,
    contractAddresses: string[],
    startTimestamp: string | number,
    durationDays: string | number,
  ): EIP712 {
    return this._fhevmEnv.instance.createEIP712(publicKey, contractAddresses, startTimestamp, durationDays);
  }

  generateKeypair(): { publicKey: string; privateKey: string } {
    return this._fhevmEnv.instance.generateKeypair();
  }

  async userDecrypt(
    handles: HandleContractPair[],
    privateKey: string,
    publicKey: string,
    signature: string,
    contractAddresses: string[],
    userAddress: string,
    startTimestamp: string | number,
    durationDays: string | number,
  ): Promise<DecryptedResults> {
    if (this._fhevmEnv.isRunningInHHNode) {
      // Cannot be called from the server process
      throw new HardhatFhevmError(`Cannot call userDecrypt from a 'hardhat node' server.`);
    }
    return await this._fhevmEnv.instance.userDecrypt(
      handles,
      privateKey,
      publicKey,
      signature,
      contractAddresses,
      userAddress,
      startTimestamp,
      durationDays,
    );
  }

  async publicDecrypt(handles: (string | Uint8Array)[]): Promise<DecryptedResults> {
    if (this._fhevmEnv.isRunningInHHNode) {
      // Cannot be called from the server process
      throw new HardhatFhevmError(`Cannot call publicDecrypt from a 'hardhat node' server.`);
    }
    return await this._fhevmEnv.instance.publicDecrypt(handles);
  }

  public async userDecryptEbool(
    handleBytes32: string,
    contractAddress: EthersT.AddressLike,
    user: EthersT.Signer,
    options?: FhevmUserDecryptOptions,
  ): Promise<boolean> {
    const addr = await EthersT.resolveAddress(contractAddress);
    const decryptedResults = await mockUtilsUserDecryptHandleBytes32(
      this._fhevmEnv.instance,
      [{ handleBytes32, contractAddress: addr, fhevmType: FhevmType.ebool }],
      user,
      options,
    );

    if (!(handleBytes32 in decryptedResults)) {
      throw new HardhatFhevmError(
        `Failed to retrieve decrypted value for ebool handle '${handleBytes32}' from the DecryptedResults response.`,
      );
    }
    if (typeof decryptedResults[handleBytes32] !== "boolean") {
      throw new HardhatFhevmError(
        `Unexpected type for decrypted value of ebool handle '${handleBytes32}': expected a boolean, but got '${typeof decryptedResults[handleBytes32]}' instead.`,
      );
    }

    return decryptedResults[handleBytes32];
  }

  public async publicDecryptEbool(handleBytes32: string, options?: FhevmPublicDecryptOptions): Promise<boolean> {
    const instance = options?.instance ?? this._fhevmEnv.instance;
    const decryptedResults = await instance.publicDecrypt([handleBytes32]);

    if (!(handleBytes32 in decryptedResults)) {
      throw new HardhatFhevmError(
        `Failed to retrieve decrypted value for ebool handle '${handleBytes32}' from the DecryptedResults response.`,
      );
    }
    if (typeof decryptedResults[handleBytes32] !== "boolean") {
      throw new HardhatFhevmError(
        `Unexpected type for decrypted value of ebool handle '${handleBytes32}': expected a boolean, but got '${typeof decryptedResults[handleBytes32]}' instead.`,
      );
    }

    return decryptedResults[handleBytes32];
  }

  public async userDecryptEuint(
    fhevmType: FhevmTypeEuint,
    handleBytes32: string,
    contractAddress: EthersT.AddressLike,
    user: EthersT.Signer,
    options?: FhevmUserDecryptOptions,
  ): Promise<bigint> {
    const addr = await EthersT.resolveAddress(contractAddress);
    const decryptedResults: DecryptedResults = await mockUtilsUserDecryptHandleBytes32(
      options?.instance ?? this._fhevmEnv.instance,
      [{ handleBytes32, contractAddress: addr, fhevmType }],
      user,
      options,
    );

    const fhevmTypeInfo = getFhevmTypeInfo(fhevmType);

    if (!(handleBytes32 in decryptedResults)) {
      throw new HardhatFhevmError(
        `Failed to retrieve decrypted value for ${fhevmTypeInfo.name} handle '${handleBytes32}' from the DecryptedResults response.`,
      );
    }
    if (typeof decryptedResults[handleBytes32] !== "bigint") {
      throw new HardhatFhevmError(
        `Unexpected type for decrypted value of ${fhevmTypeInfo.name} handle '${handleBytes32}': expected a bigint, but got '${typeof decryptedResults[handleBytes32]}' instead.`,
      );
    }

    return decryptedResults[handleBytes32];
  }

  public async publicDecryptEuint(
    fhevmType: FhevmTypeEuint,
    handleBytes32: string,
    options?: FhevmPublicDecryptOptions,
  ): Promise<bigint> {
    const instance = options?.instance ?? this._fhevmEnv.instance;
    const decryptedResults = await instance.publicDecrypt([handleBytes32]);

    const fhevmTypeInfo = getFhevmTypeInfo(fhevmType);

    if (!(handleBytes32 in decryptedResults)) {
      throw new HardhatFhevmError(
        `Failed to retrieve decrypted value for ${fhevmTypeInfo.name} handle '${handleBytes32}' from the DecryptedResults response.`,
      );
    }
    if (typeof decryptedResults[handleBytes32] !== "bigint") {
      throw new HardhatFhevmError(
        `Unexpected type for decrypted value of ${fhevmTypeInfo.name} handle '${handleBytes32}': expected a bigint, but got '${typeof decryptedResults[handleBytes32]}' instead.`,
      );
    }

    return decryptedResults[handleBytes32];
  }

  public async userDecryptEaddress(
    handleBytes32: string,
    contractAddress: EthersT.AddressLike,
    user: EthersT.Signer,
    options?: FhevmUserDecryptOptions,
  ): Promise<string> {
    const addr = await EthersT.resolveAddress(contractAddress);
    const decryptedResults: DecryptedResults = await mockUtilsUserDecryptHandleBytes32(
      options?.instance ?? this._fhevmEnv.instance,
      [{ handleBytes32, contractAddress: addr, fhevmType: FhevmType.eaddress }],
      user,
      options,
    );

    if (!(handleBytes32 in decryptedResults)) {
      throw new HardhatFhevmError(
        `Failed to retrieve decrypted value for eaddress handle '${handleBytes32}' from the DecryptedResults response.`,
      );
    }
    if (typeof decryptedResults[handleBytes32] !== "string") {
      throw new HardhatFhevmError(
        `Unexpected type for decrypted value of eaddress handle '${handleBytes32}': expected a hex string, but got '${typeof decryptedResults[handleBytes32]}' instead.`,
      );
    }

    if (!EthersT.isAddress(decryptedResults[handleBytes32])) {
      throw new HardhatFhevmError(
        `userDecryptEAddress failed. Decrypted value is not a valid address. Got ${decryptedResults[handleBytes32]}.`,
      );
    }

    return decryptedResults[handleBytes32];
  }

  public async publicDecryptEaddress(handleBytes32: string, options?: FhevmPublicDecryptOptions): Promise<string> {
    const instance = options?.instance ?? this._fhevmEnv.instance;
    const decryptedResults = await instance.publicDecrypt([handleBytes32]);

    if (!(handleBytes32 in decryptedResults)) {
      throw new HardhatFhevmError(
        `Failed to retrieve decrypted value for eaddress handle '${handleBytes32}' from the DecryptedResults response.`,
      );
    }
    if (typeof decryptedResults[handleBytes32] !== "string") {
      throw new HardhatFhevmError(
        `Unexpected type for decrypted value of eaddress handle '${handleBytes32}': expected a hex string, but got '${typeof decryptedResults[handleBytes32]}' instead.`,
      );
    }

    if (!EthersT.isAddress(decryptedResults[handleBytes32])) {
      throw new HardhatFhevmError(
        `publicDecryptEaddress failed. Decrypted value is not a valid address. Got ${decryptedResults[handleBytes32]}.`,
      );
    }

    return decryptedResults[handleBytes32];
  }

  public async getCoprocessorConfig(contractAddress: string): Promise<CoprocessorConfig> {
    return getCoprocessorConfig(this._fhevmEnv.readonlyEip1193Provider, contractAddress);
  }

  public async assertCoprocessorInitialized(contract: AddressLike, contractName?: string): Promise<void> {
    const contractAddress = await this._fhevmEnv.hre.ethers.resolveAddress(contract);

    const expectedACLAddress = this._fhevmEnv.getACLAddress();
    const expectedFHEVMExecutorAddress = this._fhevmEnv.getFHEVMExecutorAddress();
    const expectedDecryptionOracleAddress = this._fhevmEnv.getDecryptionOracleAddress();
    const expectedKMSVerifierAddress = this._fhevmEnv.getKMSVerifierAddress();

    const errorMsgPrefix =
      contractName === undefined ? `Contract at ${contractAddress}` : `Contract ${contractName} at ${contractAddress}`;

    const coprocessorConfig = await this.getCoprocessorConfig(contractAddress);
    const configFile = `${constants.FHEVM_SOLIDITY_PACKAGE.name}/${constants.FHEVM_SOLIDITY_PACKAGE.configFile}`;

    if (
      coprocessorConfig.ACLAddress === EthersT.ZeroAddress ||
      coprocessorConfig.CoprocessorAddress === EthersT.ZeroAddress ||
      coprocessorConfig.DecryptionOracleAddress === EthersT.ZeroAddress ||
      coprocessorConfig.KMSVerifierAddress === EthersT.ZeroAddress
    ) {
      const errorMsg = `${errorMsgPrefix} is not initialized for FHE operations. Make sure it either inherits from ${configFile}:${constants.FHEVM_SOLIDITY_PACKAGE.configContractName} or explicitly calls FHE.setCoprocessor() in its constructor.`;
      throw new HardhatFhevmError(errorMsg);
    }

    const addrMismatchErrorMsg = `${errorMsgPrefix} was initialized with FHEVM contract addresses that do not match the currently deployed FHEVM contracts. This is likely due to incorrect addresses in the file ${configFile}`;
    if (coprocessorConfig.ACLAddress !== expectedACLAddress) {
      const errorMsg = `Coprocessor ACL address mismatch. ${addrMismatchErrorMsg}. ACL address: ${coprocessorConfig.ACLAddress}, expected ACL address: ${expectedACLAddress}`;
      throw new HardhatFhevmError(errorMsg);
    }
    if (coprocessorConfig.CoprocessorAddress !== expectedFHEVMExecutorAddress) {
      const errorMsg = `Coprocessor FHEVMExecutor address mismatch. ${addrMismatchErrorMsg}. FHEVMExecutor address: ${coprocessorConfig.CoprocessorAddress}, expected FHEVMExecutor address: ${expectedFHEVMExecutorAddress}`;
      throw new HardhatFhevmError(errorMsg);
    }
    if (coprocessorConfig.DecryptionOracleAddress !== expectedDecryptionOracleAddress) {
      const errorMsg = `Coprocessor DecryptionOracle address mismatch. ${addrMismatchErrorMsg}. DecryptionOracle address: ${coprocessorConfig.DecryptionOracleAddress}, expected DecryptionOracle address: ${expectedDecryptionOracleAddress}`;
      throw new HardhatFhevmError(errorMsg);
    }
    if (coprocessorConfig.KMSVerifierAddress !== expectedKMSVerifierAddress) {
      const errorMsg = `Coprocessor KMSVerifier address mismatch. ${addrMismatchErrorMsg}. KMSVerifier address: ${coprocessorConfig.KMSVerifierAddress}, expected KMSVerifier address: ${expectedKMSVerifierAddress}`;
      throw new HardhatFhevmError(errorMsg);
    }
  }
}
