import { FhevmHandle, relayer, utils } from "@fhevm/mock-utils";
import { ethers as EthersT } from "ethers";
import { ProviderError } from "hardhat/internal/core/providers/errors";
import { ProviderWrapper } from "hardhat/plugins";
import type { EIP1193Provider, HardhatConfig, RequestArguments } from "hardhat/types";
import * as picocolors from "picocolors";

import constants from "../../constants";
import { HardhatFhevmError } from "../../error";
import { fhevmContext } from "../EnvironmentExtender";
import { assertHHFhevm } from "../error";
import { mutateErrorInPlace, mutateProviderErrorInPlace } from "../errors/FhevmContractError";

// Always instanciated at "test" startup
export class FhevmProviderExtender extends ProviderWrapper {
  protected readonly _config: HardhatConfig;
  protected readonly _networkName: string;

  // override estimated gasLimit by 120%, to avoid some edge case with ethermint gas estimation
  private static readonly ESTIMATEGAS_PERCENTAGE: bigint = 120n;

  constructor(_wrappedProvider: EIP1193Provider, _config: HardhatConfig, _network: string, _blockNumber: bigint) {
    super(_wrappedProvider);
    this._config = _config;
    this._networkName = _network;
  }

  public async request(args: RequestArguments) {
    switch (args.method) {
      case "eth_estimateGas":
        return this._handleEthEstimateGas(args);
      case "eth_sendTransaction":
        return this._handleEthSendTransaction(args);
      case "evm_revert":
        return this._handleEvmRevert(args);
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
      case relayer.FHEVM_GET_CLEAR_TEXT:
        return this._handleFhevmGetClearText(args);
      default:
        return this._wrappedProvider.request(args);
    }
  }

  private async _handleFhevmRelayerMetadata(args: RequestArguments) {
    const fhevmEnv = fhevmContext.get();

    // forward if we are not running the mock engine
    if (!fhevmEnv.useEmbeddedMockEngine) {
      return this._wrappedProvider.request(args);
    }

    const metadata: relayer.RelayerMetadata = {
      ACLAddress: fhevmEnv.getACLAddress(),
      FHEVMExecutorAddress: fhevmEnv.getFHEVMExecutorAddress(),
      InputVerifierAddress: fhevmEnv.getInputVerifierAddress(),
      KMSVerifierAddress: fhevmEnv.getKMSVerifierAddress(),
    };

    return metadata;
  }

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

  private _handleFhevmRelayerV1PublicDecrypt(args: RequestArguments) {
    const fhevmEnv = fhevmContext.get();

    if (!fhevmEnv.useEmbeddedMockEngine) {
      return this._wrappedProvider.request(args);
    }

    const payload = _getRequestSingleParam(args);

    relayer.assertIsRelayerV1PublicDecryptPayload(payload);

    // TODO
    throw new HardhatFhevmError(`Fhevm Public Decrypt is not yet supported.`);
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

    //
    // Should verify signature !!!
    //
    _assertSingleParamArray(args);

    const payload = args.params[0];
    relayer.assertIsRelayerV1UserDecryptPayload(payload);

    const handleBytes32HexList: string[] = payload.handleContractPairs.map((h) => {
      return fhevmEnv.hre.ethers.toBeHex(fhevmEnv.hre.ethers.toBigInt(h.handle), 32);
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

    return clearTextHexList;
  }

  private async _handleFhevmGetClearText(args: RequestArguments) {
    const fhevmEnv = fhevmContext.get();

    if (!fhevmEnv.useEmbeddedMockEngine) {
      return this._wrappedProvider.request(args);
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

    // Retreive the new current block number
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
