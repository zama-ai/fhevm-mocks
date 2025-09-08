import { FhevmHandle, MockFhevmInstance, relayer, utils, version } from "@fhevm/mock-utils";
import { ethers as EthersT } from "ethers";
import { ProviderError } from "hardhat/internal/core/providers/errors";
import { ProviderWrapper } from "hardhat/plugins";
import type { EIP1193Provider, HardhatConfig, RequestArguments } from "hardhat/types";
import * as picocolors from "picocolors";

import { HardhatFhevmError } from "../../error";
import { fhevmContext } from "../EnvironmentExtender";
import constants from "../constants";
import { assertHHFhevm } from "../error";
import { mutateErrorInPlace, mutateProviderErrorInPlace } from "../errors/FhevmContractError";

// Always instanciated at "test" startup
export class FhevmProviderExtender extends ProviderWrapper {
  protected readonly _config: HardhatConfig;
  protected readonly _networkName: string;

  // override estimated gasLimit by 120%, to avoid some edge case with ethermint gas estimation
  private static readonly ESTIMATEGAS_PERCENTAGE: bigint = 120n;

  /*
    Should be initialized with:
    - chainId
    - few addresses like ACL etc.
    - trace: isRunningInHHNode 
    - useEmbeddedMockEngine
    - coprocessor
    - decryptionOracle
  */
  constructor(_wrappedProvider: EIP1193Provider, _config: HardhatConfig, _network: string, _blockNumber: bigint) {
    super(_wrappedProvider);
    this._config = _config;
    this._networkName = _network;
  }

  public async request(args: RequestArguments) {
    // test init
    // if not init forward!
    switch (args.method) {
      // window.ethereum
      case "eth_estimateGas":
        return this._handleEthEstimateGas(args);
      // window.ethereum
      case "eth_sendTransaction":
        return this._handleEthSendTransaction(args);
      // Dev
      case "evm_revert":
        return this._handleEvmRevert(args);
      // Relayer
      case relayer.RELAYER_METADATA:
        return this._handleFhevmRelayerMetadata(args);
      case relayer.RELAYER_V1_USER_DECRYPT:
        return this._handleFhevmRelayerV1UserDecrypt(args);
      case relayer.RELAYER_V1_PUBLIC_DECRYPT:
        return this._handleFhevmRelayerV1PublicDecrypt(args);
      case relayer.RELAYER_V1_INPUT_PROOF:
        return this._handleFhevmRelayerV1InputProof(args);
      case relayer.FHEVM_AWAIT_DECRYPTION_ORACLE:
        return this._handleFhevmAwaitDecryptionOracle(args);
      case relayer.FHEVM_CREATE_DECRYPTION_SIGNATURES:
        return this._handleFhevmCreateDecryptionSignatures(args);
      case relayer.FHEVM_GET_CLEAR_TEXT:
        return this._handleFhevmGetClearText(args);
      default:
        return this._wrappedProvider.request(args);
    }
  }

  // curl -s -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"fhevm_relayer_metadata","params":[],"id":1}' http://127.0.0.1:8545
  //
  private async _handleFhevmRelayerMetadata(args: RequestArguments) {
    const fhevmEnv = fhevmContext.get();

    // forward if we are not running the mock engine
    if (!fhevmEnv.useEmbeddedMockEngine) {
      return this._wrappedProvider.request(args);
    }

    if (fhevmEnv.isRunningInHHNode) {
      console.log(picocolors.greenBright(`${args.method}`));
    }

    const metadata: relayer.RelayerMetadata = {
      version,
      chainId: fhevmEnv.chainId,
      gatewayChainId: fhevmEnv.getGatewayChainId(),
      ACLAddress: fhevmEnv.getACLAddress(),
      CoprocessorAddress: fhevmEnv.getFHEVMExecutorAddress(),
      DecryptionOracleAddress: fhevmEnv.getDecryptionOracleAddress(),
      KMSVerifierAddress: fhevmEnv.getKMSVerifierAddress(),
      InputVerifierAddress: fhevmEnv.getInputVerifierAddress(),
      relayerSignerAddress: fhevmEnv.getRelayerSignerAddress(),
    };

    return metadata;
  }

  // Try to show a human readable error message
  // Forward to ethers.Signer or window.ethereum
  private async _handleEthSendTransaction(args: RequestArguments) {
    // Do not perform any action if we are running in HH node.
    // We could, but we prefer to keep it centralized.
    if (this._networkName === "hardhat") {
      const fhevmEnv = fhevmContext.get();
      if (fhevmEnv.isRunningInHHNode) {
        return this._wrappedProvider.request(args);
      }
    }

    try {
      return await this._wrappedProvider.request(args);
    } catch (e) {
      if (e instanceof ProviderError || ProviderError.isProviderError(e)) {
        // Debug
        assertHHFhevm(this._networkName !== "hardhat");
        await mutateProviderErrorInPlace(fhevmContext.get(), e);
      } else if (e instanceof Error) {
        // Debug
        assertHHFhevm(this._networkName === "hardhat");
        await mutateErrorInPlace(fhevmContext.get(), e, args);
      }

      throw e;
    }
  }

  private async _handleEthEstimateGas(args: RequestArguments): Promise<unknown> {
    try {
      // Call the chained provider first.
      const estimatedGasLimit = BigInt((await this._wrappedProvider.request(args)) as bigint);

      // increase by an estimated percentage.
      const increasedGasLimit = EthersT.toBeHex(
        (estimatedGasLimit * FhevmProviderExtender.ESTIMATEGAS_PERCENTAGE) / 100n,
      );

      return increasedGasLimit;
    } catch (e) {
      const fhevmEnv = fhevmContext.get();

      let tx: { from: string; to: string } | undefined = undefined;
      if (args.params !== undefined && Array.isArray(args.params) && args.params.length > 0) {
        const p = args.params[0];
        if (typeof p.from === "string" && typeof p.to === "string") {
          tx = { from: p.from, to: p.to };
        }
      }

      // This is happening when using Metamask + Hardhat node
      // TODO: should display a human readable error
      await mutateProviderErrorInPlace(fhevmEnv, e as unknown as ProviderError, tx);
      throw e;
    }
  }

  private async _handleFhevmRelayerV1PublicDecrypt(args: RequestArguments) {
    const fhevmEnv = fhevmContext.get();

    if (!fhevmEnv.useEmbeddedMockEngine) {
      return this._wrappedProvider.request(args);
    }

    if (fhevmEnv.isRunningInHHNode) {
      console.log(picocolors.greenBright(`${args.method}`));
    }

    const payload = _getRequestSingleParam(args);

    relayer.assertIsRelayerV1PublicDecryptPayload(payload);

    const clearTextHexList: string[] = await fhevmEnv.coprocessor.queryHandlesBytes32AsHex(payload.ciphertextHandles);

    const { decryptedResult, signatures } = await fhevmEnv.decryptionOracle.createDecryptionSignatures(
      payload.ciphertextHandles,
      clearTextHexList,
      payload.extraData,
    );

    const response: relayer.RelayerV1PublicDecryptResponse = {
      decrypted_value: decryptedResult,
      signatures: signatures,
    };

    return response;
  }

  private async _handleFhevmCreateDecryptionSignatures(args: RequestArguments) {
    const fhevmEnv = fhevmContext.get();

    // forward if we are not running the mock engine
    if (!fhevmEnv.useEmbeddedMockEngine) {
      return this._wrappedProvider.request(args);
    }

    if (fhevmEnv.isRunningInHHNode) {
      console.log(picocolors.greenBright(`${args.method}`));
    }

    const payload = _getRequestSingleParam(args) as {
      handlesBytes32Hex: string[];
      clearTextValuesHex: string[];
      extraData: string;
    };

    const res = await fhevmEnv.decryptionOracle.createDecryptionSignatures(
      payload.handlesBytes32Hex,
      payload.clearTextValuesHex,
      payload.extraData,
    );

    return res;
  }

  private async _handleFhevmAwaitDecryptionOracle(args: RequestArguments) {
    const fhevmEnv = fhevmContext.get();

    // forward if we are not running the mock engine
    if (!fhevmEnv.useEmbeddedMockEngine) {
      return this._wrappedProvider.request(args);
    }

    if (fhevmEnv.isRunningInHHNode) {
      console.log(picocolors.greenBright(`${args.method}`));
    }

    await fhevmEnv.decryptionOracle.awaitDecryptionOracle();

    return 0;
  }

  private async _handleFhevmRelayerV1UserDecrypt(args: RequestArguments) {
    const fhevmEnv = fhevmContext.get();

    if (!fhevmEnv.useEmbeddedMockEngine) {
      return this._wrappedProvider.request(args);
    }

    if (fhevmEnv.isRunningInHHNode) {
      console.log(picocolors.greenBright(`${args.method}`));
    }

    _assertSingleParamArray(args);

    const payload = args.params[0];
    relayer.assertIsRelayerV1UserDecryptPayload(payload);

    // Verify signature
    await MockFhevmInstance.verifyUserDecryptSignature(
      payload.publicKey,
      payload.signature,
      payload.contractAddresses,
      payload.userAddress,
      payload.requestValidity.startTimestamp,
      payload.requestValidity.durationDays,
      fhevmEnv.getGatewayDecryptionAddress(),
      Number(payload.contractsChainId),
    );

    const handleBytes32HexList: string[] = payload.handleContractPairs.map((h) => {
      return EthersT.toBeHex(EthersT.toBigInt(h.handle), 32);
    });

    const clearTextHexList: string[] = await fhevmEnv.coprocessor.queryHandlesBytes32AsHex(handleBytes32HexList);

    if (fhevmEnv.isRunningInHHNode) {
      console.log(picocolors.greenBright(`${args.method}`));
      for (let i = 0; i < clearTextHexList.length; ++i) {
        const msg = clearTextHexList[i] === "0x" ? "<EmptyValue>" : clearTextHexList[i];

        console.log(`  Query handle: ${handleBytes32HexList[i]}`);
        console.log(`  Clear text  : ${msg}`);
      }
    }

    const response: relayer.RelayerV1UserDecryptResponse = {
      payload: { decrypted_values: clearTextHexList },
      signature: EthersT.ZeroHash,
    };

    return response;
  }

  private async _handleFhevmGetClearText(args: RequestArguments) {
    const fhevmEnv = fhevmContext.get();

    if (!fhevmEnv.useEmbeddedMockEngine) {
      return this._wrappedProvider.request(args);
    }

    if (fhevmEnv.isRunningInHHNode) {
      console.log(picocolors.greenBright(`${args.method}`));
    }

    const payload = _getRequestSingleStringArrayParam(args);

    const handleBytes32HexList: string[] = [];
    const fhevmHandles: FhevmHandle[] = [];

    for (let i = 0; i < payload.length; ++i) {
      const handleBytes32Hex = utils.ensurePrefix(payload[i], "0x");
      const fhevmHandle = FhevmHandle.verify(handleBytes32Hex, { chainId: fhevmEnv.chainId });
      handleBytes32HexList.push(handleBytes32Hex);
      fhevmHandles.push(fhevmHandle);
    }

    const clearTextHexList: string[] = await fhevmEnv.coprocessor.queryHandlesBytes32AsHex(handleBytes32HexList);

    // Trace
    if (fhevmEnv.isRunningInHHNode) {
      console.log(picocolors.greenBright(`${args.method}`));
      for (let i = 0; i < clearTextHexList.length; ++i) {
        const h = fhevmHandles[i];

        const typeInfo = h.fhevmTypeInfo;
        const msg =
          clearTextHexList[i] === "0x"
            ? "<EmptyValue>"
            : `${clearTextHexList[i]} (${typeInfo.name}, ${h.computed ? "computed" : "input"})`;

        console.log("  Query handle: ${handleBytes32HexList[i]}");
        console.log(`  Clear text  : ${msg}`);
      }
    }

    return clearTextHexList;
  }

  private async _handleFhevmRelayerV1InputProof(args: RequestArguments): Promise<any> {
    const fhevmEnv = fhevmContext.get();

    if (!fhevmEnv.useEmbeddedMockEngine) {
      return this._wrappedProvider.request(args);
    }

    if (fhevmEnv.isRunningInHHNode) {
      console.log(picocolors.greenBright(`${args.method}`));
    }

    const payload = _getRequestSingleParam(args);
    relayer.assertIsMockRelayerV1InputProofPayload(payload);

    const contractChainId: number = utils.toUIntNumber(
      payload.contractChainId,
      "MockRelayerV1InputProofPayload.contractChainId",
    );

    if (fhevmEnv.getACLAddress() !== payload.mockData.aclContractAddress) {
      throw new HardhatFhevmError(
        `ACL address mismatch. Expecting ${fhevmEnv.getACLAddress()}, got ${payload.mockData.aclContractAddress} instead.`,
      );
    }

    const handlesBytes32List: Uint8Array[] = FhevmHandle.computeHandles(
      EthersT.getBytes(payload.ciphertextWithInputVerification),
      payload.mockData.fhevmTypes,
      payload.mockData.aclContractAddress,
      contractChainId,
      constants.FHEVM_HANDLE_VERSION,
    );

    const response: relayer.RelayerV1InputProofResponse = await fhevmEnv.coprocessor.computeCoprocessorSignatures(
      handlesBytes32List,
      contractChainId,
      payload.contractAddress,
      payload.userAddress,
      payload.extraData,
    );

    // Add values to Mock DB
    for (let i = 0; i < response.handles.length; ++i) {
      await fhevmEnv.coprocessor.insertHandleBytes32(
        // handles have no prefix
        utils.ensurePrefix(response.handles[i], "0x"),
        payload.mockData.clearTextValuesBigIntHex[i],
        payload.mockData.metadatas[i],
      );
    }

    return response;
  }

  private async _handleEvmRevert(args: RequestArguments): Promise<unknown> {
    // TODO: call coproc directly to handle reverts!

    // Execute the revert method
    const result = await this._wrappedProvider.request(args);

    // Retrieve the new current block number
    const blockNumberHex = (await this._wrappedProvider.request({ method: "eth_blockNumber" })) as string;

    const fhevmEnv = fhevmContext.get();

    if (fhevmEnv.useEmbeddedMockEngine) {
      await fhevmEnv.coprocessor.handleEvmRevert(parseInt(blockNumberHex));
    }

    return result;
  }
}

function _getRequestSingleParam(args: RequestArguments): unknown {
  assertHHFhevm(args.params !== undefined);
  assertHHFhevm(Array.isArray(args.params));
  assertHHFhevm(args.params.length === 1);
  return args.params[0];
}

function _getRequestSingleStringArrayParam(args: RequestArguments): string[] {
  const p = _getRequestSingleParam(args);
  assertHHFhevm(Array.isArray(p));
  for (let i = 0; i < p.length; ++i) {
    assertHHFhevm(typeof p[i] === "string");
  }
  return p;
}

function _assertSingleParamArray(args: any): asserts args is { params: [any] } {
  assertHHFhevm(args);
  assertHHFhevm(Array.isArray(args.params));
  assertHHFhevm(args.params.length === 1);
}
