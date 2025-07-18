/*
    WARNING : Never import the "hardhat" package!
*/
import { ethers as EthersT } from "ethers";

import constants from "../constants.js";
import { isThresholdReached } from "../ethers/eip712.js";
import type { MinimalProvider } from "../ethers/provider.js";
import { checkEncryptedBits } from "../relayer-sdk/relayer/decryptUtils.js";
import { deserializeDecryptedResult } from "../relayer-sdk/relayer/publicDecrypt.js";
import {
  buildUserDecryptedResult,
  checkDeadlineValidity,
  checkMaxContractAddresses,
} from "../relayer-sdk/relayer/userDecrypt.js";
import {
  createEIP712 as fhevmSdkCreateEIP712ForDecryption,
  generateKeypair as fhevmSdkGenerateKeypair,
} from "../relayer-sdk/types.js";
import type {
  DecryptedResults,
  EIP712,
  EIP712Type,
  FhevmInstance,
  HandleContractPair,
  PublicParams,
} from "../relayer-sdk/types.js";
import { assertIsAddress, assertIsAddressArray } from "../utils/address.js";
import { FhevmError, assertFhevm } from "../utils/error.js";
import { fromHexString, toHexString } from "../utils/hex.js";
import { assertIsNumber } from "../utils/math.js";
import { ensure0x, remove0x } from "../utils/string.js";
import { MockRelayerEncryptedInput } from "./MockRelayerEncryptedInput.js";
import { InputVerifier } from "./contracts/InputVerifier.js";
import { KMSVerifier } from "./contracts/KMSVerifier.js";
import * as relayer from "./relayer/MockRelayer.js";
import type {
  RelayerV1PublicDecryptPayload,
  RelayerV1UserDecryptHandleContractPair,
  RelayerV1UserDecryptPayload,
} from "./relayer/payloads.js";

export type MockFhevmInstanceConfigExtra = {
  relayerProvider: MinimalProvider;
  readonlyEthersProvider: EthersT.Provider;
  inputVerifier: InputVerifier;
  kmsVerifier: KMSVerifier;
};

export type MockFhevmInstanceConfig = {
  verifyingContractAddressDecryption: string;
  verifyingContractAddressInputVerification: string;
  kmsContractAddress: string;
  inputVerifierContractAddress: string;
  aclContractAddress: string;
  chainId: number;
  gatewayChainId: number;
};

/*
  Only one instance is created for the whole HH session (including tests)
*/
export class MockFhevmInstance implements FhevmInstance {
  #relayerProvider: MinimalProvider;
  #readonlyEthersProvider: EthersT.Provider;
  #chainId: number; //provider's chainId
  #gatewayChainId: number;
  #verifyingContractAddressInputVerification: string;
  #verifyingContractAddressDecryption: string;
  #contractsChainId: number;
  #aclContractAddress: string;
  #kmsVerifier: KMSVerifier;
  #inputVerifier: InputVerifier;

  #fhevmSdkCreateEIP712ForDecryptionFunc: (
    publicKey: string,
    contractAddresses: string[],
    startTimestamp: string | number,
    durationDays: string | number,
  ) => EIP712;

  private constructor(config: MockFhevmInstanceConfig, extra: MockFhevmInstanceConfigExtra) {
    assertIsAddress(
      config.verifyingContractAddressInputVerification,
      "config.verifyingContractAddressInputVerification",
    );
    assertIsAddress(config.verifyingContractAddressDecryption, "config.verifyingContractAddressDecryption");
    assertIsNumber(config.gatewayChainId, "config.gatewayChainId");

    this.#relayerProvider = extra.relayerProvider;
    this.#readonlyEthersProvider = extra.readonlyEthersProvider;
    this.#chainId = config.chainId;
    this.#gatewayChainId = config.gatewayChainId;
    this.#verifyingContractAddressInputVerification = config.verifyingContractAddressInputVerification;
    this.#verifyingContractAddressDecryption = config.verifyingContractAddressDecryption;
    this.#contractsChainId = config.chainId;
    this.#aclContractAddress = config.aclContractAddress;
    this.#kmsVerifier = extra.kmsVerifier;
    this.#inputVerifier = extra.inputVerifier;
    this.#fhevmSdkCreateEIP712ForDecryptionFunc = fhevmSdkCreateEIP712ForDecryption(
      this.#verifyingContractAddressDecryption,
      this.#contractsChainId,
    );
  }

  public get chainId(): number {
    return this.#chainId;
  }

  public static async create(
    relayerProvider: MinimalProvider,
    readonlyEthersProvider: EthersT.Provider,
    config: MockFhevmInstanceConfig,
  ): Promise<MockFhevmInstance> {
    const kmsVerifier = await KMSVerifier.create(readonlyEthersProvider, config.kmsContractAddress);
    const inputVerifier = await InputVerifier.create(readonlyEthersProvider, config.inputVerifierContractAddress);

    const instance = new MockFhevmInstance(config, {
      relayerProvider,
      readonlyEthersProvider,
      inputVerifier,
      kmsVerifier,
    });

    return instance;
  }

  public static createEIP712(
    publicKey: string,
    contractAddresses: string[],
    startTimestamp: string | number,
    durationDays: string | number,
    verifyingContractAddressDecryption: string,
    contractsChainId: number,
  ): EIP712 {
    assertIsAddressArray(contractAddresses, "contractAddresses");

    const eip712Func = fhevmSdkCreateEIP712ForDecryption(verifyingContractAddressDecryption, contractsChainId);
    const eip712 = eip712Func(publicKey, contractAddresses, startTimestamp, durationDays);

    //Debug Make sure we are in sync with @fhevm/sdk
    assertFhevm(eip712.domain.version === constants.DECRYPTION_EIP712_DOMAIN.version.toString());
    assertFhevm(eip712.domain.name === constants.DECRYPTION_EIP712_DOMAIN.name);

    return eip712;
  }

  // Create EIP712 for decryption
  public createEIP712(
    publicKey: string,
    contractAddresses: string[],
    startTimestamp: string | number,
    durationDays: string | number,
  ): EIP712 {
    assertIsAddressArray(contractAddresses, "contractAddresses");

    const eip712 = this.#fhevmSdkCreateEIP712ForDecryptionFunc(
      publicKey,
      contractAddresses,
      startTimestamp,
      durationDays,
    );

    //Debug Make sure we are in sync with @fhevm/sdk
    assertFhevm(eip712.domain.version === constants.DECRYPTION_EIP712_DOMAIN.version.toString());
    assertFhevm(eip712.domain.name === constants.DECRYPTION_EIP712_DOMAIN.name);

    //Debug Make sure we are in sync with KMSVerifier.sol
    assertFhevm(eip712.domain.verifyingContract === this.#kmsVerifier.eip712Domain.verifyingContract);
    assertFhevm(eip712.domain.version === this.#kmsVerifier.eip712Domain.version);
    assertFhevm(eip712.domain.name === this.#kmsVerifier.eip712Domain.name);
    assertFhevm(BigInt(eip712.domain.chainId) === BigInt(this.#contractsChainId));
    assertFhevm(this.#kmsVerifier.eip712Domain.chainId === BigInt(this.#gatewayChainId));

    return eip712;
  }

  public createEncryptedInput(contractAddress: string, userAddress: string): MockRelayerEncryptedInput {
    assertFhevm(constants.INPUT_VERIFICATION_EIP712_DOMAIN.name === this.#inputVerifier.eip712Domain.name);
    assertFhevm(constants.INPUT_VERIFICATION_EIP712_DOMAIN.version === this.#inputVerifier.eip712Domain.version);
    assertFhevm(this.#verifyingContractAddressInputVerification === this.#inputVerifier.eip712Domain.verifyingContract);
    assertFhevm(BigInt(this.#gatewayChainId) === this.#inputVerifier.eip712Domain.chainId);

    return new MockRelayerEncryptedInput(
      this.#relayerProvider,
      this.#chainId,
      contractAddress,
      userAddress,
      this.#aclContractAddress,
      this.#inputVerifier,
    );
  }

  public generateKeypair(): { publicKey: string; privateKey: string } {
    return fhevmSdkGenerateKeypair();
  }

  public getPublicKey(): {
    publicKeyId: string;
    publicKey: Uint8Array;
  } | null {
    throw new FhevmError("Not supported in mock mode");
  }

  public getPublicParams(_bits: keyof PublicParams): {
    publicParams: Uint8Array;
    publicParamsId: string;
  } | null {
    throw new FhevmError("Not supported in mock mode");
  }

  public async publicDecrypt(handles: (string | Uint8Array)[]): Promise<DecryptedResults> {
    // Intercept future type change...
    for (let i = 0; i < handles.length; ++i) {
      assertFhevm(
        typeof handles[i] === "string" || handles[i] instanceof Uint8Array,
        "handle is not a string or a Uint8Array",
      );
    }

    // Casting handles if string
    const relayerHandles: string[] = handles.map((h) =>
      typeof h === "string" ? toHexString(fromHexString(h), true) : toHexString(h, true),
    );

    // relayer-sdk
    checkEncryptedBits(relayerHandles);

    await MockFhevmInstance.verifyPublicACLPermissions(
      this.#readonlyEthersProvider,
      this.#aclContractAddress,
      relayerHandles,
    );

    // relayer-sdk
    const payloadForRequest: RelayerV1PublicDecryptPayload = {
      ciphertextHandles: relayerHandles,
    };

    const json = await relayer.requestRelayerV1PublicDecrypt(this.#relayerProvider, payloadForRequest);

    // verify signatures on decryption:
    const domain = {
      name: "Decryption",
      version: "1",
      chainId: this.#gatewayChainId,
      verifyingContract: this.#verifyingContractAddressDecryption,
    };
    const types = {
      PublicDecryptVerification: [
        { name: "ctHandles", type: "bytes32[]" },
        { name: "decryptedResult", type: "bytes" },
      ],
    };
    const result = json.response[0];
    const decryptedResult = result.decrypted_value.startsWith("0x")
      ? result.decrypted_value
      : `0x${result.decrypted_value}`;
    const signatures = result.signatures;

    const recoveredAddresses = signatures.map((signature: string) => {
      const sig = signature.startsWith("0x") ? signature : `0x${signature}`;
      const recoveredAddress = EthersT.verifyTypedData(domain, types, { ctHandles: handles, decryptedResult }, sig);
      return recoveredAddress;
    });

    const thresholdReached = isThresholdReached(
      this.#kmsVerifier.getKmsSignersAddresses(),
      recoveredAddresses,
      this.#kmsVerifier.getThreshold(),
      "KMS",
    );

    if (!thresholdReached) {
      throw Error("KMS signers threshold is not reached");
    }

    const results = deserializeDecryptedResult(relayerHandles, decryptedResult);

    return results;
  }

  public async userDecrypt(
    handles: HandleContractPair[],
    _privateKey: string,
    publicKey: string,
    signature: string,
    contractAddresses: string[],
    userAddress: string,
    startTimestamp: string | number,
    durationDays: string | number,
  ): Promise<DecryptedResults> {
    // Intercept future type change...
    for (let i = 0; i < handles.length; ++i) {
      assertFhevm(
        typeof handles[i].handle === "string" || handles[i].handle instanceof Uint8Array,
        "handle is not a string or a Uint8Array",
      );
    }

    // Casting handles if string
    const relayerHandles: RelayerV1UserDecryptHandleContractPair[] = handles.map((h) => ({
      handle: typeof h.handle === "string" ? toHexString(fromHexString(h.handle), true) : toHexString(h.handle, true),
      contractAddress: h.contractAddress,
    }));

    // relayer-sdk
    checkEncryptedBits(relayerHandles.map((h) => h.handle));

    // relayer-sdk
    checkDeadlineValidity(BigInt(startTimestamp), BigInt(durationDays));

    await MockFhevmInstance.verifyUserACLPermissions(
      this.#readonlyEthersProvider,
      this.#aclContractAddress,
      relayerHandles,
      userAddress,
    );

    // relayer-sdk
    checkMaxContractAddresses(contractAddresses);

    MockFhevmInstance.verifyHandleContractAddresses(relayerHandles, contractAddresses);

    // relayer-sdk
    const payloadForRequest: RelayerV1UserDecryptPayload = {
      handleContractPairs: relayerHandles,
      requestValidity: {
        startTimestamp: startTimestamp.toString(), // Convert to string
        durationDays: durationDays.toString(), // Convert to string
      },
      contractsChainId: this.#chainId.toString(), // Convert to string
      contractAddresses: contractAddresses.map((c) => EthersT.getAddress(c)),
      userAddress: EthersT.getAddress(userAddress),
      signature: remove0x(signature),
      publicKey: remove0x(publicKey),
    };

    // TODO
    // Check json.response content: https://github.com/zama-ai/relayer-sdk/blob/main/src/relayer/userDecrypt.ts#L255
    const clearTextHexList: string[] = await relayer.requestRelayerV1UserDecrypt(
      this.#relayerProvider,
      payloadForRequest,
    );

    await this._verifySignature(publicKey, signature, contractAddresses, userAddress, startTimestamp, durationDays);

    const listBigIntDecryptions = clearTextHexList.map(EthersT.toBigInt);

    const results = buildUserDecryptedResult(
      relayerHandles.map((h) => h.handle),
      listBigIntDecryptions,
    );

    return results;
  }

  public static async verifySignature(
    publicKey: string,
    signature: string,
    contractAddresses: string[],
    userAddress: string,
    startTimestamp: string | number,
    durationDays: string | number,
    verifyingContractAddressDecryption: string,
    contractsChainId: number,
  ) {
    publicKey = ensure0x(publicKey);
    signature = ensure0x(signature);

    const eip712: EIP712 = MockFhevmInstance.createEIP712(
      publicKey,
      contractAddresses,
      startTimestamp,
      durationDays,
      verifyingContractAddressDecryption,
      contractsChainId,
    );

    const types: Record<string, EIP712Type[]> = {};
    types[eip712.primaryType] = eip712.types[eip712.primaryType];

    const signerAddress = EthersT.verifyTypedData(eip712.domain, types, eip712.message, signature);

    const normalizedSignerAddress = EthersT.getAddress(signerAddress);
    const normalizedUserAddress = EthersT.getAddress(userAddress);

    if (normalizedSignerAddress !== normalizedUserAddress) {
      throw new FhevmError("Invalid EIP-712 signature!");
    }
  }

  private async _verifySignature(
    publicKey: string,
    signature: string,
    contractAddresses: string[],
    userAddress: string,
    startTimestamp: string | number,
    durationDays: string | number,
  ) {
    await MockFhevmInstance.verifySignature(
      publicKey,
      signature,
      contractAddresses,
      userAddress,
      startTimestamp,
      durationDays,
      this.#verifyingContractAddressDecryption,
      this.#contractsChainId,
    );
  }

  public static async verifyPublicACLPermissions(
    readonlyEthersProvider: EthersT.Provider,
    aclContractAddress: string,
    handles: string[],
  ) {
    const aclABI = ["function isAllowedForDecryption(bytes32 handle) view returns (bool)"];
    const acl = new EthersT.Contract(aclContractAddress, aclABI, readonlyEthersProvider);

    const verifications = handles.map(async (h) => {
      const ctHandleHex = EthersT.toBeHex(EthersT.toBigInt(h), 32);

      const allowed = await acl.isAllowedForDecryption(ctHandleHex);
      if (!allowed) {
        throw new FhevmError(`Handle ${h} is not allowed for public decryption!`);
      }
    });

    return Promise.all(verifications).catch((e) => {
      throw e;
    });
  }

  // (Duplicated code) Should be imported from @fhevm/sdk
  public static async verifyUserACLPermissions(
    readonlyEthersProvider: EthersT.Provider,
    aclContractAddress: string,
    handles: HandleContractPair[],
    userAddress: string,
  ) {
    const aclABI = ["function persistAllowed(bytes32 handle, address account) view returns (bool)"];
    const acl = new EthersT.Contract(aclContractAddress, aclABI, readonlyEthersProvider);

    const verifications = handles.map(async ({ handle, contractAddress }) => {
      const ctHandleHex = EthersT.toBeHex(EthersT.toBigInt(handle), 32);

      const userAllowed = await acl.persistAllowed(ctHandleHex, userAddress);
      const contractAllowed = await acl.persistAllowed(ctHandleHex, contractAddress);
      if (!userAllowed) {
        throw new FhevmError(`User ${userAddress} is not authorized to user decrypt handle ${handle}!`);
      }
      if (!contractAllowed) {
        throw new FhevmError(`dapp contract ${contractAddress} is not authorized to user decrypt handle ${handle}!`);
      }
      if (userAddress === contractAddress) {
        throw new FhevmError(
          `userAddress ${userAddress} should not be equal to contractAddress when requesting decryption!`,
        );
      }
    });

    return Promise.all(verifications).catch((e) => {
      throw e;
    });
  }

  public static verifyHandleContractAddresses(handles: HandleContractPair[], contractAddresses: string[]) {
    const set = new Set<string>();
    // Build a list of unique allowed contact addresses.
    for (let i = 0; i < contractAddresses.length; ++i) {
      const add = contractAddresses[i].toLowerCase();
      if (!set.has(add)) {
        set.add(add);
      }
    }
    // Check that every handle contract (in HandleContractPair) is actually listed in the contractAddresses argument.
    for (let i = 0; i < handles.length; ++i) {
      if (!set.has(handles[i].contractAddress.toLowerCase())) {
        throw new FhevmError(
          `Contract address ${handles[i].contractAddress} associated to handle ${handles[i].handle} is not listed in the contractAddresses array argument.`,
        );
      }
    }
  }
}
