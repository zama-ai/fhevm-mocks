/*
    WARNING : Never import the "hardhat" package!
*/
import type {
  BytesHex,
  BytesHexNo0x,
  ChecksummedAddress,
  FhevmConfigType,
  KeypairType,
  KmsDelegatedUserDecryptEIP712Type,
  KmsUserDecryptEIP712Type,
} from "@zama-fhe/relayer-sdk/node";
import { KmsEIP712, TKMSPkeKeypair } from "@zama-fhe/relayer-sdk/node";
import { ethers as EthersT } from "ethers";

import constants from "../constants.js";
import { isThresholdReached } from "../ethers/eip712.js";
import type { MinimalProvider } from "../ethers/provider.js";
import { checkEncryptedBits } from "../relayer-sdk/relayer/decryptUtils.js";
import { deserializeClearValues } from "../relayer-sdk/relayer/publicDecrypt.js";
import {
  buildUserDecryptResults,
  checkDeadlineValidity,
  checkMaxContractAddresses,
} from "../relayer-sdk/relayer/userDecrypt.js";
import type {
  ClearValues,
  FhevmInstance,
  HandleContractPair,
  PublicDecryptResults,
  PublicParams,
  RelayerInputProofOptionsType,
  UserDecryptResults,
  ZKProofLike,
} from "../relayer-sdk/types.js";
import { assertIsAddress, assertIsAddressArray } from "../utils/address.js";
import { FhevmError, assertFhevm } from "../utils/error.js";
import { fromHexString, toHexString } from "../utils/hex.js";
import { assertIsNumber } from "../utils/math.js";
import { ensure0x, remove0x } from "../utils/string.js";
import { FhevmHandle } from "./FhevmHandle.js";
import { MockRelayerEncryptedInput } from "./MockRelayerEncryptedInput.js";
import { InputVerifier, type InputVerifierProperties } from "./contracts/InputVerifier.js";
import { KMSVerifier, type KMSVerifierProperties } from "./contracts/KMSVerifier.js";
import * as relayer from "./relayer/MockRelayer.js";
import type {
  RelayerV1DelegatedUserDecryptPayload,
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
  verifyingContractAddressDecryption: `0x${string}`;
  verifyingContractAddressInputVerification: `0x${string}`;
  kmsContractAddress: `0x${string}`;
  inputVerifierContractAddress: `0x${string}`;
  aclContractAddress: `0x${string}`;
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
  #verifyingContractAddressInputVerification: ChecksummedAddress;
  #verifyingContractAddressDecryption: ChecksummedAddress;
  #contractsChainId: number;
  #aclContractAddress: ChecksummedAddress;
  #kmsVerifier: KMSVerifier;
  #inputVerifier: InputVerifier;

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
  }

  public get config(): FhevmConfigType {
    return {
      chainId: BigInt(this.#chainId),
      aclContractAddress: this.#aclContractAddress,
      coprocessorSignerThreshold: this.#inputVerifier.getThreshold(),
      kmsContractAddress: this.#kmsVerifier.address,
      verifyingContractAddressDecryption: this.#kmsVerifier.gatewayDecryptionAddress,
      verifyingContractAddressInputVerification: this.#inputVerifier.gatewayInputVerificationAddress,
      inputVerifierContractAddress: this.#inputVerifier.address,
      gatewayChainId: BigInt(this.#gatewayChainId),
      coprocessorSigners: this.#inputVerifier.getCoprocessorSignersAddresses(),
      kmsSigners: this.#kmsVerifier.getKmsSignersAddresses(),
      kmsSignerThreshold: this.#kmsVerifier.getThreshold(),
    };
  }

  public get chainId(): number {
    return this.#chainId;
  }

  public static async create(
    relayerProvider: MinimalProvider,
    readonlyEthersProvider: EthersT.Provider,
    config: MockFhevmInstanceConfig,
    properties: {
      inputVerifierProperties: InputVerifierProperties;
      kmsVerifierProperties: KMSVerifierProperties;
    },
  ): Promise<MockFhevmInstance> {
    const kmsVerifier = await KMSVerifier.create(
      readonlyEthersProvider,
      config.kmsContractAddress,
      undefined,
      properties.kmsVerifierProperties,
    );
    const inputVerifier = await InputVerifier.create(
      readonlyEthersProvider,
      config.inputVerifierContractAddress,
      undefined,
      properties.inputVerifierProperties,
    );

    const instance = new MockFhevmInstance(config, {
      relayerProvider,
      readonlyEthersProvider,
      inputVerifier,
      kmsVerifier,
    });

    return instance;
  }

  public static createEIP712({
    publicKey,
    contractAddresses,
    startTimestamp,
    durationDays,
    verifyingContractAddressDecryption,
    contractsChainId,
    extraData,
  }: {
    publicKey: string;
    contractAddresses: string[];
    startTimestamp: number;
    durationDays: number;
    verifyingContractAddressDecryption: string;
    contractsChainId: number;
    extraData: BytesHex;
  }): KmsUserDecryptEIP712Type {
    assertIsAddressArray(contractAddresses, "contractAddresses");

    const k = new KmsEIP712({ chainId: BigInt(contractsChainId), verifyingContractAddressDecryption });

    const eip712 = k.createUserDecryptEIP712({
      publicKey,
      contractAddresses,
      startTimestamp,
      durationDays,
      extraData,
    });

    //Debug Make sure we are in sync with KMSVerifier.sol
    assertFhevm(eip712.domain.version === constants.PUBLIC_DECRYPT_EIP712.domain.version.toString());
    assertFhevm(eip712.domain.name === constants.PUBLIC_DECRYPT_EIP712.domain.name);

    return eip712;
  }

  public static createDelegatedUserDecryptEIP712({
    publicKey,
    contractAddresses,
    delegatorAddress,
    startTimestamp,
    durationDays,
    verifyingContractAddressDecryption,
    contractsChainId,
    extraData,
  }: {
    publicKey: string;
    contractAddresses: string[];
    delegatorAddress: string;
    startTimestamp: number;
    durationDays: number;
    verifyingContractAddressDecryption: string;
    contractsChainId: number;
    extraData: BytesHex;
  }): KmsDelegatedUserDecryptEIP712Type {
    assertIsAddressArray(contractAddresses, "contractAddresses");

    const k = new KmsEIP712({ chainId: BigInt(contractsChainId), verifyingContractAddressDecryption });

    const eip712 = k.createDelegatedUserDecryptEIP712({
      publicKey,
      contractAddresses,
      startTimestamp,
      durationDays,
      extraData,
      delegatorAddress,
    });

    //Debug Make sure we are in sync with KMSVerifier.sol
    assertFhevm(eip712.domain.version === constants.PUBLIC_DECRYPT_EIP712.domain.version.toString());
    assertFhevm(eip712.domain.name === constants.PUBLIC_DECRYPT_EIP712.domain.name);

    return eip712;
  }

  // Create EIP712 for decryption
  public createEIP712(
    publicKey: string,
    contractAddresses: string[],
    startTimestamp: number,
    durationDays: number,
  ): KmsUserDecryptEIP712Type {
    assertIsAddressArray(contractAddresses, "contractAddresses");

    const eip712 = MockFhevmInstance.createEIP712({
      publicKey,
      contractAddresses,
      startTimestamp,
      durationDays,
      contractsChainId: this.#contractsChainId,
      verifyingContractAddressDecryption: this.#verifyingContractAddressDecryption,
      extraData: "0x00",
    });

    //Debug Make sure we are in sync with KMSVerifier.sol
    assertFhevm(BigInt(this.#gatewayChainId) === this.#kmsVerifier.eip712Domain.chainId);
    assertFhevm(eip712.domain.verifyingContract === this.#kmsVerifier.eip712Domain.verifyingContract);
    assertFhevm(eip712.domain.version === this.#kmsVerifier.eip712Domain.version);
    assertFhevm(eip712.domain.name === this.#kmsVerifier.eip712Domain.name);
    assertFhevm(BigInt(eip712.domain.chainId) === BigInt(this.#contractsChainId));

    return eip712;
  }

  public createDelegatedUserDecryptEIP712(
    publicKey: string,
    contractAddresses: string[],
    delegatorAddress: string,
    startTimestamp: number,
    durationDays: number,
  ): KmsDelegatedUserDecryptEIP712Type {
    assertIsAddressArray(contractAddresses, "contractAddresses");

    const eip712 = MockFhevmInstance.createDelegatedUserDecryptEIP712({
      publicKey,
      contractAddresses,
      delegatorAddress,
      startTimestamp,
      durationDays,
      contractsChainId: this.#contractsChainId,
      verifyingContractAddressDecryption: this.#verifyingContractAddressDecryption,
      extraData: "0x00",
    });

    //Debug Make sure we are in sync with KMSVerifier.sol
    assertFhevm(BigInt(this.#gatewayChainId) === this.#kmsVerifier.eip712Domain.chainId);
    assertFhevm(eip712.domain.verifyingContract === this.#kmsVerifier.eip712Domain.verifyingContract);
    assertFhevm(eip712.domain.version === this.#kmsVerifier.eip712Domain.version);
    assertFhevm(eip712.domain.name === this.#kmsVerifier.eip712Domain.name);
    assertFhevm(BigInt(eip712.domain.chainId) === BigInt(this.#contractsChainId));

    return eip712;
  }

  public async requestZKProofVerification(
    _zkProof: ZKProofLike,
    _options?: RelayerInputProofOptionsType,
  ): Promise<{
    handles: Uint8Array[];
    inputProof: Uint8Array;
  }> {
    throw new FhevmError("Not Implemented in Mock mode");
  }

  public createEncryptedInput(contractAddress: string, userAddress: string): MockRelayerEncryptedInput {
    //Debug Make sure we are in sync with InputVerifier.sol
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

  public generateKeypair(): KeypairType<BytesHexNo0x> {
    return TKMSPkeKeypair.generate().toBytesHexNo0x();
  }

  public getPublicKey(): {
    publicKeyId: string;
    publicKey: Uint8Array;
  } | null {
    throw new FhevmError("Not supported in mock mode");
  }

  public getPublicParams(_bits: keyof PublicParams<Uint8Array>): {
    publicParams: Uint8Array;
    publicParamsId: string;
  } | null {
    throw new FhevmError("Not supported in mock mode");
  }

  public async publicDecrypt(handles: (string | Uint8Array)[]): Promise<PublicDecryptResults> {
    const extraData: `0x${string}` = "0x00";

    // Intercept future type change...
    for (let i = 0; i < handles.length; ++i) {
      assertFhevm(
        typeof handles[i] === "string" || handles[i] instanceof Uint8Array,
        "handle is not a string or a Uint8Array",
      );
    }

    // Casting handles if string
    const handlesBytes32Hex: `0x${string}`[] = handles.map((h) =>
      typeof h === "string" ? toHexString(fromHexString(h)) : toHexString(h),
    );
    const fhevmHandles = handlesBytes32Hex.map((h) => FhevmHandle.fromBytes32Hex(h));

    // relayer-sdk
    checkEncryptedBits(handlesBytes32Hex);

    await MockFhevmInstance.verifyPublicACLPermissions(
      this.#readonlyEthersProvider,
      this.#aclContractAddress,
      handlesBytes32Hex,
    );

    // relayer-sdk
    const payloadForRequest: RelayerV1PublicDecryptPayload = {
      ciphertextHandles: handlesBytes32Hex,
      extraData,
    };

    // Return a json object basically following the @zama-fhe/relayer-sdk format
    const json = await relayer.requestRelayerV1PublicDecrypt(this.#relayerProvider, payloadForRequest);
    const result = json.response[0];

    // Add "0x" prefix if needed
    const decryptedResult = ensure0x(result.decrypted_value);
    const kmsSignatures = result.signatures.map(ensure0x);

    // verify signatures on decryption:
    const domain = {
      name: constants.PUBLIC_DECRYPT_EIP712.domain.name,
      version: constants.PUBLIC_DECRYPT_EIP712.domain.version,
      chainId: this.#gatewayChainId,
      verifyingContract: this.#verifyingContractAddressDecryption,
    };
    const types = constants.PUBLIC_DECRYPT_EIP712.types;

    // The `signedExtraData` variable is following the @zama-fhe/relayer-sdk implementation
    // TODO: in relayer-sdk, signedExtraData === "0x". However, here, we use "0x00".
    const signedExtraData = "0x00";

    const recoveredAddresses = kmsSignatures.map((signature: `0x${string}`) => {
      assertFhevm(signature.startsWith("0x"));
      const recoveredAddress = EthersT.verifyTypedData(
        domain,
        types,
        { ctHandles: handles, decryptedResult, extraData: signedExtraData },
        signature,
      );
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

    const clearValues: ClearValues = deserializeClearValues(fhevmHandles, decryptedResult);

    const abiEnc = KMSVerifier.abiEncodeClearValues(clearValues);
    const decryptionProof = KMSVerifier.buildDecryptionProof(kmsSignatures, signedExtraData);

    return { clearValues, abiEncodedClearValues: abiEnc.abiEncodedClearValues, decryptionProof };
  }

  //////////////////////////////////////////////////////////////////////////////

  public async userDecrypt(
    handles: HandleContractPair[],
    _privateKey: string,
    publicKey: string,
    signature: string,
    contractAddresses: string[],
    userAddress: string,
    startTimestamp: number,
    durationDays: number,
  ): Promise<UserDecryptResults> {
    const extraData: `0x${string}` = "0x00";

    // Intercept future type change...
    for (let i = 0; i < handles.length; ++i) {
      assertFhevm(
        typeof handles[i].handle === "string" || handles[i].handle instanceof Uint8Array,
        "handle is not a string or a Uint8Array",
      );
    }

    // Casting handles if string
    const relayerHandles: RelayerV1UserDecryptHandleContractPair[] = handles.map((h) => ({
      handle: typeof h.handle === "string" ? toHexString(fromHexString(h.handle)) : toHexString(h.handle),
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

    // Redundant: the mock relayer already performs this check, so it could be removed
    await MockFhevmInstance.verifyUserDecryptSignature(
      publicKey,
      signature,
      contractAddresses,
      userAddress,
      startTimestamp,
      durationDays,
      this.#verifyingContractAddressDecryption,
      this.#contractsChainId,
    );

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
      extraData,
    };

    // Return a json object basically following the @zama-fhe/relayer-sdk format
    const json = await relayer.requestRelayerV1UserDecrypt(this.#relayerProvider, payloadForRequest);
    const result = json.response[0];
    // The `decrypted_values` field is specific to the mock relayer.
    const clearTextHexList = result.payload.decrypted_values;

    const listBigIntDecryptions = clearTextHexList.map(EthersT.toBigInt);

    const results: UserDecryptResults = buildUserDecryptResults(
      relayerHandles.map((h: RelayerV1UserDecryptHandleContractPair) => h.handle as `0x${string}`),
      listBigIntDecryptions,
    );

    return results;
  }

  public async delegatedUserDecrypt(
    handleContractPairs: HandleContractPair[],
    _privateKey: string,
    publicKey: string,
    signature: string,
    contractAddresses: string[],
    delegatorAddress: string,
    delegateAddress: string,
    startTimestamp: number,
    durationDays: number,
  ): Promise<UserDecryptResults> {
    const extraData: `0x${string}` = "0x00";

    // Intercept future type change...
    for (let i = 0; i < handleContractPairs.length; ++i) {
      assertFhevm(
        typeof handleContractPairs[i].handle === "string" || handleContractPairs[i].handle instanceof Uint8Array,
        "handle is not a string or a Uint8Array",
      );
    }

    // Casting handles if string
    const relayerHandles: RelayerV1UserDecryptHandleContractPair[] = handleContractPairs.map((h) => ({
      handle: typeof h.handle === "string" ? toHexString(fromHexString(h.handle)) : toHexString(h.handle),
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
      delegatorAddress,
    );

    // relayer-sdk
    checkMaxContractAddresses(contractAddresses);

    // relayer-sdk
    const payloadForRequest: RelayerV1DelegatedUserDecryptPayload = {
      handleContractPairs: relayerHandles,
      contractsChainId: this.#chainId.toString(), // Convert to string
      contractAddresses: contractAddresses.map((c) => EthersT.getAddress(c)),
      delegatorAddress: EthersT.getAddress(delegatorAddress),
      delegateAddress: EthersT.getAddress(delegateAddress),
      requestValidity: {
        startTimestamp: startTimestamp.toString(),
        durationDays: durationDays.toString(),
      },
      signature: remove0x(signature),
      publicKey: remove0x(publicKey),
      extraData,
    };

    // Return a json object basically following the @zama-fhe/relayer-sdk format
    const json = await relayer.requestRelayerV1DelegatedUserDecrypt(this.#relayerProvider, payloadForRequest);
    const result = json.response[0];
    // The `decrypted_values` field is specific to the mock relayer.
    const clearTextHexList = result.payload.decrypted_values;

    const listBigIntDecryptions = clearTextHexList.map(EthersT.toBigInt);

    const results: UserDecryptResults = buildUserDecryptResults(
      relayerHandles.map((h: RelayerV1UserDecryptHandleContractPair) => h.handle as `0x${string}`),
      listBigIntDecryptions,
    );

    return results;
  }

  //////////////////////////////////////////////////////////////////////////////

  // Static function called by:
  // - MockFhevmInstance.userDecrypt()
  // - packages/hardhat-plugin/src/internal/provider/FhevmProviderExtender._handleFhevmRelayerV1UserDecrypt()
  public static async verifyUserDecryptSignature(
    publicKey: string,
    signature: string,
    contractAddresses: string[],
    userAddress: string,
    startTimestamp: number,
    durationDays: number,
    verifyingContractAddressDecryption: string,
    contractsChainId: number,
  ) {
    publicKey = ensure0x(publicKey);
    signature = ensure0x(signature);

    const eip712: KmsUserDecryptEIP712Type = MockFhevmInstance.createEIP712({
      publicKey,
      contractAddresses,
      startTimestamp,
      durationDays,
      verifyingContractAddressDecryption,
      contractsChainId,
      extraData: "0x00",
    });

    const types: Record<string, Array<EthersT.TypedDataField>> = {
      [eip712.primaryType]: eip712.types[eip712.primaryType] as unknown as Array<EthersT.TypedDataField>,
    };

    const signerAddress = EthersT.verifyTypedData(
      eip712.domain,
      types,
      eip712.message as Record<string, any>,
      signature,
    );

    const normalizedSignerAddress = EthersT.getAddress(signerAddress);
    const normalizedUserAddress = EthersT.getAddress(userAddress);

    if (normalizedSignerAddress !== normalizedUserAddress) {
      throw new FhevmError("Invalid EIP-712 signature!");
    }
  }

  public static async verifyDelegatedUserDecryptSignature({
    publicKey,
    signature,
    contractAddresses,
    delegatorAddress,
    delegateAddress,
    startTimestamp,
    durationDays,
    verifyingContractAddressDecryption,
    contractsChainId,
  }: {
    publicKey: string;
    signature: string;
    contractAddresses: string[];
    delegatorAddress: string;
    delegateAddress: string;
    startTimestamp: number;
    durationDays: number;
    verifyingContractAddressDecryption: string;
    contractsChainId: number;
  }) {
    publicKey = ensure0x(publicKey);
    signature = ensure0x(signature);

    const eip712: KmsDelegatedUserDecryptEIP712Type = MockFhevmInstance.createDelegatedUserDecryptEIP712({
      publicKey,
      contractAddresses,
      delegatorAddress,
      startTimestamp,
      durationDays,
      verifyingContractAddressDecryption,
      contractsChainId,
      extraData: "0x00",
    });

    const types: Record<string, Array<EthersT.TypedDataField>> = {
      [eip712.primaryType]: eip712.types[eip712.primaryType] as unknown as Array<EthersT.TypedDataField>,
    };

    const signerAddress = EthersT.verifyTypedData(
      eip712.domain,
      types,
      eip712.message as Record<string, any>,
      signature,
    );

    const normalizedSignerAddress = EthersT.getAddress(signerAddress);
    const normalizedDelegateAddress = EthersT.getAddress(delegateAddress);

    if (normalizedSignerAddress !== normalizedDelegateAddress) {
      throw new FhevmError("Invalid EIP-712 signature!");
    }
  }

  //////////////////////////////////////////////////////////////////////////////

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

  //////////////////////////////////////////////////////////////////////////////

  // (Duplicated code) Should be imported from @zama-fhe/relayer-sdk
  public static async verifyUserACLPermissions(
    readonlyEthersProvider: EthersT.Provider,
    aclContractAddress: string,
    handles: HandleContractPair[],
    userAddress: string,
  ): Promise<void[]> {
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

  //////////////////////////////////////////////////////////////////////////////

  public static async verifyUserDecryptionDelegation(
    readonlyEthersProvider: EthersT.Provider,
    aclContractAddress: string,
    delegatorAddress: string,
    delegateAddress: string,
    handles: HandleContractPair[],
  ): Promise<void[]> {
    const aclABI = [
      "function isHandleDelegatedForUserDecryption(address delegator, address delegate, address contractAddress, bytes32 handle) view returns (bool)",
    ];
    const acl = new EthersT.Contract(aclContractAddress, aclABI, readonlyEthersProvider);
    const verifications = handles.map(async ({ handle, contractAddress }) => {
      const ctHandleHex = EthersT.toBeHex(EthersT.toBigInt(handle), 32);

      const isDelegated = await acl.isHandleDelegatedForUserDecryption(
        delegatorAddress,
        delegateAddress,
        contractAddress,
        ctHandleHex,
      );
      if (!isDelegated) {
        throw new FhevmError(
          `Delegate ${delegateAddress} is not authorized to user decrypt handle ${handle} on behalf of ${delegatorAddress}!`,
        );
      }
    });

    return Promise.all(verifications).catch((e) => {
      throw e;
    });
  }

  //////////////////////////////////////////////////////////////////////////////

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
