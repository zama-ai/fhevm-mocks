import { EIP712, FhevmInstance, HandleContractPair, RelayerEncryptedInput } from "@fhevm/sdk/node";
import { AddressLike, ethers as EthersT } from "ethers";

import { HardhatFhevmError } from "../error";
import {
  FHEVMConfig,
  FhevmUserDecryptOptions,
  HardhatFhevmRuntimeDebugger,
  HardhatFhevmRuntimeEnvironment,
} from "../types";
import { FhevmEnvironment } from "./FhevmEnvironment";
import { MockFhevmInstance } from "./MockFhevmInstance";
import { FhevmType, FhevmTypeEbytes, FhevmTypeEuint, FhevmTypeName, allFhevmTypeInfos } from "./handle/FhevmType";
import { parseFhevmHandle } from "./handle/handle";
import { userDecryptHandleBytes32 } from "./userDecrypt";
import { getDecryptionOracleAddress, getFHEVMConfig } from "./utils/hh";

/**
 * Public External API
 */
export class FhevmExternalAPI implements HardhatFhevmRuntimeEnvironment {
  private _fhevmEnv: FhevmEnvironment;

  constructor(fhevmEnv: FhevmEnvironment) {
    this._fhevmEnv = fhevmEnv;
  }

  public async createInstance(): Promise<FhevmInstance> {
    return await MockFhevmInstance.create(this._fhevmEnv);
  }

  public typeof(handleBytes32: string): FhevmTypeName {
    return allFhevmTypeInfos[parseFhevmHandle(handleBytes32).fhevmType].name;
  }

  public get debugger(): HardhatFhevmRuntimeDebugger {
    return this._fhevmEnv.debugger;
  }

  public get relayerSignerAddress(): string {
    return this._fhevmEnv.getRelayerSignerAddress();
  }

  public async awaitAllDecryptionResults() {
    await this._fhevmEnv.gatewayDecryptor.awaitAllDecryptionResults();
  }

  // Much simpler, get rid of instance
  public createEncryptedInput(contractAddress: string, userAddress: string): RelayerEncryptedInput {
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
  ): Promise<bigint[]> {
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

  public async userDecryptEbool(
    handleBytes32: string,
    contractAddress: EthersT.AddressLike,
    user: EthersT.Signer,
    options?: FhevmUserDecryptOptions,
  ): Promise<boolean> {
    const addr = await EthersT.resolveAddress(contractAddress);
    const clearValues = await userDecryptHandleBytes32(
      this._fhevmEnv,
      [{ handleBytes32, contractAddress: addr, fhevmType: FhevmType.ebool }],
      user,
      options,
    );
    return clearValues[0] === 1n;
  }

  public async userDecryptEuint(
    fhevmType: FhevmTypeEuint,
    handleBytes32: string,
    contractAddress: EthersT.AddressLike,
    user: EthersT.Signer,
    options?: FhevmUserDecryptOptions,
  ): Promise<bigint> {
    const addr = await EthersT.resolveAddress(contractAddress);
    const clearValues = await userDecryptHandleBytes32(
      this._fhevmEnv,
      [{ handleBytes32, contractAddress: addr, fhevmType }],
      user,
      options,
    );
    return clearValues[0];
  }

  public async userDecryptEbytes(
    fhevmType: FhevmTypeEbytes,
    handleBytes32: string,
    contractAddress: EthersT.AddressLike,
    user: EthersT.Signer,
    options?: FhevmUserDecryptOptions,
  ): Promise<bigint> {
    const addr = await EthersT.resolveAddress(contractAddress);
    const clearValues = await userDecryptHandleBytes32(
      this._fhevmEnv,
      [{ handleBytes32, contractAddress: addr, fhevmType }],
      user,
      options,
    );
    return clearValues[0];
  }

  public async userDecryptEaddress(
    handleBytes32: string,
    contractAddress: EthersT.AddressLike,
    user: EthersT.Signer,
    options?: FhevmUserDecryptOptions,
  ): Promise<string> {
    const addr = await EthersT.resolveAddress(contractAddress);
    const clearValues = await userDecryptHandleBytes32(
      this._fhevmEnv,
      [{ handleBytes32, contractAddress: addr, fhevmType: FhevmType.eaddress }],
      user,
      options,
    );

    const addressAsUint160 = clearValues[0];
    const addressAsHex = "0x" + addressAsUint160.toString(16).padStart(40, "0");
    if (!EthersT.isAddress(addressAsHex)) {
      throw new HardhatFhevmError(
        `userDecryptEAddress failed. Decrypted value is not a valid address. Got ${addressAsHex}.`,
      );
    }

    return addressAsHex;
  }

  public async getFHEVMConfig(contractAddress: string): Promise<FHEVMConfig> {
    return getFHEVMConfig(this._fhevmEnv.hre, contractAddress);
  }

  public async getDecryptionOracleAddress(contractAddress: string): Promise<string> {
    return getDecryptionOracleAddress(this._fhevmEnv.hre, contractAddress);
  }

  public async assertFHEInitialized(contract: AddressLike, contractName?: string): Promise<void> {
    const contractAddress = await this._fhevmEnv.hre.ethers.resolveAddress(contract);
    const addresses = await this.getFHEVMConfig(contractAddress);

    const errorMsgPrefix =
      contractName === undefined ? `Contract at ${contractAddress}` : `Contract ${contractName} at ${contractAddress}`;

    if (
      addresses.ACLAddress === EthersT.ZeroAddress ||
      addresses.FHEVMExecutorAddress === EthersT.ZeroAddress ||
      addresses.InputVerifierAddress === EthersT.ZeroAddress ||
      addresses.KMSVerifierAddress === EthersT.ZeroAddress
    ) {
      const errorMsg = `${errorMsgPrefix} is not initialized for FHE operations. Make sure it either inherits from @fhevm/solidity/config/FHEVMConfig.sol:SepoliaFHEVMConfig or explicitly calls FHE.setCoprocessor() in its constructor.`;
      throw new HardhatFhevmError(errorMsg);
    }

    const expectedACLAddress = this._fhevmEnv.getACLAddress();
    const expectedFHEVMExecutorAddress = this._fhevmEnv.getFHEVMExecutorAddress();
    const expectedInputVerifierAddress = this._fhevmEnv.getInputVerifierAddress();
    const expectedKMSVerifierAddress = this._fhevmEnv.getKMSVerifierAddress();

    const addrMismatchErrorMsg = `${errorMsgPrefix} was initialized with FHEVM contract addresses that do not match the currently deployed FHEVM contracts. This is likely due to incorrect addresses in the file @fhevm/solidity/config/FHEVMConfig.sol`;
    if (addresses.ACLAddress !== expectedACLAddress) {
      const errorMsg = `Coprocessor ACL address mismatch. ${addrMismatchErrorMsg}. ACL address: ${addresses.ACLAddress}, expected ACL address: ${expectedACLAddress}`;
      throw new HardhatFhevmError(errorMsg);
    }
    if (addresses.FHEVMExecutorAddress !== expectedFHEVMExecutorAddress) {
      const errorMsg = `Coprocessor FHEVMExecutor address mismatch. ${addrMismatchErrorMsg}. FHEVMExecutor address: ${addresses.FHEVMExecutorAddress}, expected FHEVMExecutor address: ${expectedFHEVMExecutorAddress}`;
      throw new HardhatFhevmError(errorMsg);
    }
    if (addresses.InputVerifierAddress !== expectedInputVerifierAddress) {
      const errorMsg = `Coprocessor InputVerifier address mismatch. ${addrMismatchErrorMsg}. InputVerifier address: ${addresses.InputVerifierAddress}, expected InputVerifier address: ${expectedInputVerifierAddress}`;
      throw new HardhatFhevmError(errorMsg);
    }
    if (addresses.KMSVerifierAddress !== expectedKMSVerifierAddress) {
      const errorMsg = `Coprocessor KMSVerifier address mismatch. ${addrMismatchErrorMsg}. KMSVerifier address: ${addresses.KMSVerifierAddress}, expected KMSVerifier address: ${expectedKMSVerifierAddress}`;
      throw new HardhatFhevmError(errorMsg);
    }
  }
}
