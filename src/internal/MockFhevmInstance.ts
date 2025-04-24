/*
    WARNING : Never import the "hardhat" package!
*/
import { EIP712Type } from "@fhevm/sdk/lib/sdk/keypair";
import {
  EIP712,
  FhevmInstance,
  HandleContractPair,
  PublicParams,
  createEIP712 as fhevmSdkCreateEIP712,
  generateKeypair as fhevmSdkGenerateKeypair,
} from "@fhevm/sdk/node";
import assert from "assert";
import { ethers as EthersT } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import constants from "../constants";
import { HardhatFhevmError } from "../error";
import { FhevmEnvironment } from "./FhevmEnvironment";
import { MockRelayerEncryptedInput } from "./MockRelayerEncryptedInput";

export class MockFhevmInstance implements FhevmInstance {
  #fhevmEnv: FhevmEnvironment;
  #hostChainId: number;
  #gatewayChainId: number;
  #verifyingContractAddress: string;
  #contractsChainId: number;
  #coprocessorSigners: EthersT.Signer[];

  #fhevmSdkCreateEIP712Func: (
    publicKey: string,
    contractAddresses: string[],
    startTimestamp: string | number,
    durationDays: string | number,
  ) => EIP712;

  constructor(
    fhevmEnv: FhevmEnvironment,
    params: {
      gatewayChainId: number;
      verifyingContractAddress: string;
      coprocessorSigners: EthersT.Signer[];
    },
  ) {
    this.#fhevmEnv = fhevmEnv;
    const hre: HardhatRuntimeEnvironment = this.#fhevmEnv.hre;
    const currentNetwork = hre.network;
    if (currentNetwork.config.chainId === undefined) {
      throw new HardhatFhevmError(`Unable to determine current network chainId (network name: ${currentNetwork.name})`);
    }
    this.#hostChainId = currentNetwork.config.chainId;
    this.#gatewayChainId = params.gatewayChainId;
    this.#verifyingContractAddress = params.verifyingContractAddress;
    this.#contractsChainId = currentNetwork.config.chainId;
    this.#coprocessorSigners = params.coprocessorSigners;

    this.#fhevmSdkCreateEIP712Func = fhevmSdkCreateEIP712(
      this.#gatewayChainId,
      this.#verifyingContractAddress,
      this.#contractsChainId,
    );
  }

  public get chainId(): number {
    return this.#hostChainId;
  }

  private get hre(): HardhatRuntimeEnvironment {
    return this.#fhevmEnv.hre;
  }

  public static async create(fhevmEnv: FhevmEnvironment): Promise<MockFhevmInstance> {
    const gatewayVerifyingContractAddress = fhevmEnv.getGatewayInputVerificationAddress();
    const coprocessorSigners = fhevmEnv.getCoprocessorSigners();
    return new MockFhevmInstance(fhevmEnv, {
      gatewayChainId: fhevmEnv.getGatewayChainId(),
      verifyingContractAddress: gatewayVerifyingContractAddress,
      coprocessorSigners,
    });
  }

  public createEIP712(
    publicKey: string,
    contractAddresses: string[],
    startTimestamp: string | number,
    durationDays: string | number,
  ): EIP712 {
    assert(Array.isArray(contractAddresses), "contractAddresses is not an array");
    const eip712 = this.#fhevmSdkCreateEIP712Func(publicKey, contractAddresses, startTimestamp, durationDays);

    //Debug Make sure we are in sync with @fhevm/sdk
    assert(eip712.domain.version === constants.DECRYPTION_EIP712_DOMAIN.version.toString());
    assert(eip712.domain.name === constants.DECRYPTION_EIP712_DOMAIN.name);

    return eip712;
  }

  public createEncryptedInput(contractAddress: string, userAddress: string): MockRelayerEncryptedInput {
    const aclAddress = this.#fhevmEnv.getACLAddress();
    return new MockRelayerEncryptedInput(
      this.#fhevmEnv,
      this.#hostChainId,
      contractAddress,
      userAddress,
      aclAddress,
      {
        chainId: this.#gatewayChainId,
        name: constants.INPUT_VERIFICATION_EIP712_DOMAIN.name,
        version: constants.INPUT_VERIFICATION_EIP712_DOMAIN.version,
        verifyingContract: this.#verifyingContractAddress,
      },
      this.#coprocessorSigners,
    );
  }

  public generateKeypair(): { publicKey: string; privateKey: string } {
    return fhevmSdkGenerateKeypair();
  }

  public getPublicKey(): {
    publicKeyId: string;
    publicKey: Uint8Array;
  } | null {
    throw new Error("Not supported in mock mode");
  }

  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  public getPublicParams(bits: keyof PublicParams): {
    publicParams: Uint8Array;
    publicParamsId: string;
  } | null {
    throw new Error("Not supported in mock mode");
  }

  public async publicDecrypt(handle: string | Uint8Array): Promise<bigint> {
    const handleBytes32Hex = this.hre.ethers.toBeHex(this.hre.ethers.toBigInt(handle), 32);
    throw new Error(`Not supported in mock mode handle=${handleBytes32Hex}`);
  }

  public async userDecrypt(
    handles: HandleContractPair[],
    privateKey: string,
    publicKey: string,
    signature: string,
    contractAddresses: string[],
    userAddress: string,
    startTimestamp: string | number,
    durationDays: string | number,
  ): Promise<bigint[]> {
    // Intercept future type change...
    for (let i = 0; i < handles.length; ++i) {
      assert(
        typeof handles[i].ctHandle === "string" || handles[i].ctHandle instanceof Uint8Array,
        "ctHandle is not a string or a Uint8Array",
      );
    }

    await this._verifyACLPermissions(handles, userAddress);
    this._verifyHandleContractAddresses(handles, contractAddresses);
    await this._verifySignature(publicKey, signature, contractAddresses, userAddress, startTimestamp, durationDays);

    await this.#fhevmEnv.coproc.awaitCoprocessor();

    const clearTexts: bigint[] = [];

    for (let i = 0; i < handles.length; ++i) {
      const handleBytes32Hex = this.hre.ethers.toBeHex(this.hre.ethers.toBigInt(handles[i].ctHandle), 32);
      const clearTextBigInt = await this.#fhevmEnv.db.sqlQueryHandleBytes32AsBigInt(handleBytes32Hex);
      clearTexts.push(clearTextBigInt);
    }

    return clearTexts;
  }

  private async _verifySignature(
    publicKey: string,
    signature: string,
    contractAddresses: string[],
    userAddress: string,
    startTimestamp: string | number,
    durationDays: string | number,
  ) {
    const eip712: EIP712 = this.createEIP712(publicKey, contractAddresses, startTimestamp, durationDays);

    if (!signature.startsWith("0x")) {
      signature = "0x" + signature;
    }

    const types: Record<string, EIP712Type[]> = {};
    types[eip712.primaryType] = eip712.types[eip712.primaryType];

    const signerAddress = EthersT.verifyTypedData(eip712.domain, types, eip712.message, signature);

    const normalizedSignerAddress = EthersT.getAddress(signerAddress);
    const normalizedUserAddress = EthersT.getAddress(userAddress);

    if (normalizedSignerAddress !== normalizedUserAddress) {
      throw new Error("Invalid EIP-712 signature!");
    }
  }

  // (Duplicated code) Should be imported from @fhevm/sdk
  private async _verifyACLPermissions(handles: HandleContractPair[], userAddress: string) {
    const acl = this.#fhevmEnv.getACLReadOnly();

    const verifications = handles.map(async ({ ctHandle, contractAddress }) => {
      const ctHandleHex = this.hre.ethers.toBeHex(this.hre.ethers.toBigInt(ctHandle), 32);

      const userAllowed = await acl.persistAllowed(ctHandleHex, userAddress);
      const contractAllowed = await acl.persistAllowed(ctHandleHex, contractAddress);
      if (!userAllowed) {
        throw new Error("User is not authorized to reencrypt this handle!");
      }
      if (!contractAllowed) {
        throw new Error("dApp contract is not authorized to reencrypt this handle!");
      }
      if (userAddress === contractAddress) {
        throw new Error("userAddress should not be equal to contractAddress when requesting reencryption!");
      }
    });

    return Promise.all(verifications).catch((e) => {
      throw e;
    });
  }

  private _verifyHandleContractAddresses(handles: HandleContractPair[], contractAddresses: string[]) {
    const set = new Set<string>();
    // Build a list of unique allowed contact addresses.
    for (let i = 0; i < contractAddresses.length; ++i) {
      const add = contractAddresses[i].toLowerCase();
      if (!set.has(add)) {
        set.add(add);
      }
    }
    // Check that every handle contract (in CtHandleContractPair) is actually listed in the contractAddresses argument.
    for (let i = 0; i < handles.length; ++i) {
      if (!set.has(handles[i].contractAddress.toLowerCase())) {
        throw new Error(
          `Contract address ${handles[i].contractAddress} associated to handle ${handles[i].ctHandle} is not listed in the contractAddresses array argument.`,
        );
      }
    }
  }
}
