//import { RelayerEncryptedInput } from "@zama-fhe/relayer-sdk/lib";
import { FhevmContractName, MockRelayerEncryptedInput } from "@fhevm/mock-utils";
import { RelayerEncryptedInput } from "@zama-fhe/relayer-sdk/node";
import { BytesLike, ethers as EthersT } from "ethers";
import { ProviderError } from "hardhat/internal/core/providers/errors";
import { RequestArguments } from "hardhat/types";

import { FhevmContractRecordEntry, FhevmEnvironment } from "../FhevmEnvironment";
import { assertHHFhevm } from "../error";
import { extractEVMErrorData } from "../utils/ethers";
import { logBox } from "../utils/log";
import { ERRORS, applyErrorTemplate } from "./FhevmContractErrorList";

type FhevmErrorInfos = {
  tx: { from?: string; to?: string };
  errorDesc: EthersT.ErrorDescription;
  address: string;
  contract: EthersT.Contract;
  contractName: FhevmContractName;
};

export type FhevmInputVerifierError = {
  type: "InputVerifier";
  name: "InvalidSigner";
  txContractAddress?: string;
  txUserAddress?: string;
  inputContractAddress?: string;
  inputUserAddress?: string;
  shortMessage: string;
  longMessage: string;
};

// should be FhevmInputVerifierError | ... | ...
export type FhevmContractError = FhevmInputVerifierError;

type FhevmErrorMessages = {
  message: string;
  title?: string;
  shortMessage?: string;
  longMessage?: string;
};

function formatInputVerifierErrorMessages(error: FhevmInputVerifierError) {
  let shortMessage: string = "";
  let longMessage: string = "";

  if (!error.inputContractAddress || !error.txContractAddress || !error.inputUserAddress || !error.txUserAddress) {
    shortMessage = `The transaction's contract address or signer account differs from the ones originally used to create the encrypted input. Please ensure they match to avoid decryption errors.`;
    longMessage = `You created an encrypted input using createEncryptedInput() with a specific 
contract address and user address.

However, you're now attempting to use this encrypted input in a contract 
transaction involving a different contract address and/or signing account.

Encrypted inputs are bound to both the contract and the user they were 
created for. To ensure proper decryption and execution, the same contract 
address and user address must be used.

For example:
------------
  const input = hre.fhevm.createEncryptedInput(fooContract.target, barAccount);
  await fooContract.connect(barAccount).someFunc(<input arguments>);
`;
  } else {
    if (
      error.inputContractAddress !== error.txContractAddress &&
      error.inputContractAddress &&
      error.txContractAddress
    ) {
      shortMessage += `- contractAddress mismatch. 
  Calling contract ${error.txContractAddress} differs from 
  encrypted input contract address ${error.inputContractAddress}.\n`;
    }
    if (error.inputUserAddress !== error.txUserAddress && error.inputUserAddress && error.txUserAddress) {
      shortMessage += `- userAddress mismatch. 
  Calling account ${error.txContractAddress} differs from 
  encrypted input user address ${error.inputContractAddress}.\n`;
    }

    longMessage = `You created an encrypted input using createEncryptedInput() with contract
address ${error.inputContractAddress} and user address
${error.inputUserAddress}.

However, you are now trying to use this encrypted input in a contract
transaction with contract address ${error.txContractAddress}
and signing account ${error.txUserAddress}.

Please ensure that the encrypted input is used with the same contract and
user address it was created for.

Error:
${shortMessage}

For example:
------------
  const input = hre.fhevm.createEncryptedInput(fooContract.target, barAccount);
  await fooContract.connect(barAccount).someFunc(<input arguments>);
`;
  }

  error.shortMessage = shortMessage;
  error.longMessage = longMessage;

  return error;
}

export async function parseFhevmError(
  fhevmEnv: FhevmEnvironment,
  e: unknown,
  options?: { encryptedInput?: RelayerEncryptedInput },
): Promise<FhevmContractError | undefined> {
  const errData = extractEVMErrorData(e);
  if (!errData) {
    return undefined;
  }

  const tx = await fhevmEnv.ethersProvider.provider.getTransaction(errData.txHash);
  const txFrom = tx ? tx.from : undefined;
  const txContract = tx && tx.to ? tx.to : undefined;

  const kmsVerifierError = fhevmEnv.getKMSVerifierReadOnly().interface.parseError(errData.data);
  if (kmsVerifierError) {
    return undefined;
  }
  const aclError = fhevmEnv.getACLReadOnly().interface.parseError(errData.data);
  if (aclError) {
    return undefined;
  }
  const execError = fhevmEnv.getFHEVMExecutorReadOnly().interface.parseError(errData.data);
  if (execError) {
    return undefined;
  }
  const inputVerifierError = fhevmEnv.getInputVerifierReadOnly().interface.parseError(errData.data);

  if (inputVerifierError) {
    if (inputVerifierError.name === "InvalidSigner") {
      const err: FhevmInputVerifierError = {
        type: "InputVerifier",
        name: "InvalidSigner",
        ...(txContract && { txContractAddress: txContract }),
        ...(txFrom && { txUserAddress: txFrom }),
        shortMessage: "",
        longMessage: "",
      };

      if (options?.encryptedInput instanceof MockRelayerEncryptedInput) {
        err.inputContractAddress = options.encryptedInput.contractAddress;
        err.inputUserAddress = options.encryptedInput.userAddress;
      }

      return formatInputVerifierErrorMessages(err);
    }
  }

  return undefined;
}

function _hasBytesLikeData(e: any): e is Error & { data: BytesLike } {
  return e instanceof Error && "data" in e && typeof e.data === "string" && EthersT.isBytesLike(e.data);
}

function _hasStackString(e: any): e is Error & { stack: string } {
  return e instanceof Error && "stack" in e && typeof e.stack === "string";
}

function _parseEdrError(
  fhevmEnv: FhevmEnvironment,
  e: Error,
):
  | {
      e: Error & { data: BytesLike } & { stack: string };
      fhevmContractEntry: FhevmContractRecordEntry;
      errorDesc: EthersT.ErrorDescription;
      dataBytesLike: BytesLike;
    }
  | undefined {
  if (!(e instanceof Error)) {
    return undefined;
  }

  if (!_hasBytesLikeData(e)) {
    return undefined;
  }

  if (!_hasStackString(e)) {
    return undefined;
  }

  /*
  
      tx = args.params[0]
      ===================
  
      {
          gas: "0x1c9c380",
          from: "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
          to: "0x5fbdb2315678afecb367f032d93f642f64180aa3",
          data: "0x093d38275102265ca4f005daeaf2fe6d71da59790b3ab1de54000000000000007a6905000000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000006301015102265ca4f005daeaf2fe6d71da59790b3ab1de54000000000000007a6905000ed3f5876d46a314ab47fc39834240fb25c61269f83724a7c392fb17e7152461770dc6e6824af92e3d7a215c20500e34b64e5c673eab155f895dd461d778c4871b0000000000000000000000000000000000000000000000000000000000",
          maxFeePerGas: "0x18391632",
          maxPriorityFeePerGas: "0x59f80c8",
      }
  
    */

  const dataBytesLike: BytesLike = e.data;

  if (!("stackTrace" in e)) {
    return undefined;
  }

  const stackTrace = e.stackTrace;
  if (!(stackTrace && Array.isArray(stackTrace) && stackTrace.length > 0)) {
    return undefined;
  }

  const lastCall = stackTrace[stackTrace.length - 1];
  if (!("address" in lastCall)) {
    return undefined;
  }

  const addr = lastCall.address;
  if (!EthersT.isBytesLike(addr)) {
    return undefined;
  }

  const lastCallContractAddress = EthersT.toBeHex(EthersT.toBigInt(addr));
  if (!EthersT.isAddress(lastCallContractAddress)) {
    return undefined;
  }

  const fhevmContractEntry = fhevmEnv.readonlyContractFromAddress(lastCallContractAddress);
  if (!fhevmContractEntry) {
    return undefined;
  }

  const errorDesc: EthersT.ErrorDescription | null = fhevmContractEntry.contract.interface.parseError(dataBytesLike);
  if (!errorDesc) {
    // Is it working with proxies ?
    // Try other contracts ???
    return undefined;
  }

  const expectedMessage = `VM Exception while processing transaction: reverted with an unrecognized custom error (return data: ${e.data})`;

  if (e.message !== expectedMessage) {
    return undefined;
  }

  if (!e.stack.startsWith("Error: " + expectedMessage)) {
    return undefined;
  }

  return { e, fhevmContractEntry, errorDesc, dataBytesLike };
}

/**
 * Mutates an Error object strictly formated as
 * {
 *    data: BytesLike
 *    stackTrace: [{...}, {...}, {...}, { address: Uint8Array }]
 *    message: string
 *    stack: string
 * }
 */
export async function mutateErrorInPlace(fhevmEnv: FhevmEnvironment, e: Error, args: RequestArguments) {
  const parsedErr = _parseEdrError(fhevmEnv, e);
  if (!parsedErr) {
    return;
  }
  // workaround
  assertHHFhevm(e === parsedErr.e);
  // err === e (but typesafe at compile time)
  const err = parsedErr.e;

  if (!(args.params && Array.isArray(args.params) && args.params.length === 1)) {
    return;
  }

  /*

    tx = args.params[0]
    ===================

    {
        gas: "0x1c9c380",
        from: "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
        to: "0x5fbdb2315678afecb367f032d93f642f64180aa3",
        data: "0x093d38275102265ca4f005daeaf2fe6d71da59790b3ab1de54000000000000007a6905000000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000006301015102265ca4f005daeaf2fe6d71da59790b3ab1de54000000000000007a6905000ed3f5876d46a314ab47fc39834240fb25c61269f83724a7c392fb17e7152461770dc6e6824af92e3d7a215c20500e34b64e5c673eab155f895dd461d778c4871b0000000000000000000000000000000000000000000000000000000000",
        maxFeePerGas: "0x18391632",
        maxPriorityFeePerGas: "0x59f80c8",
    }

  */

  const tx = args.params[0];
  if (!("from" in tx && typeof tx.from === "string" && EthersT.isAddress(tx.from))) {
    return;
  }
  if (!("to" in tx && typeof tx.to === "string" && EthersT.isAddress(tx.to))) {
    return;
  }

  // Set the default message
  err.message = `VM Exception while processing transaction: reverted with FHEVM ${parsedErr.fhevmContractEntry.contractName} custom error '${parsedErr.errorDesc.name}'`;

  await __mutateFhevmErrorAndPrintBox(fhevmEnv, err, parsedErr.dataBytesLike, undefined, tx);

  // Patch the "stack" property. This is the one displayed on screen
  const i = err.stack.indexOf("\n");
  err.stack = "Error: " + err.message + err.stack.substring(i);

  const map = fhevmEnv.getFHEVMContractsMap();

  Object.keys(map).forEach((key) => {
    err.stack = err.stack?.replaceAll(
      `at <UnrecognizedContract>.<unknown> (${key})`,
      `at ${map[key].contractName}.<unknown> (${key}, ${map[key].package}/contracts/${map[key].contractName}.sol:0:0)`,
    );
  });
}

/**
 * Mutates a HH ProviderError object strictly formated as
 * {
 *    data: {
 *      data: BytesLike,
 *      message: string,
 *      txHash: string,
 *    }
 *    message: string,
 * }
 *
 * or
 *
 * {
 *    data: string
 * }
 */
export async function mutateProviderErrorInPlace(
  fhevmEnv: FhevmEnvironment,
  e: ProviderError,
  txFromTo?: { from: string; to: string | null },
) {
  if (!ProviderError.isProviderError(e)) {
    return;
  }
  if (!("data" in e)) {
    return;
  }

  if (e.data === undefined || e.data === null) {
    return;
  }

  let dataBytesLike: string;
  let txHash: string | undefined = undefined;

  if (typeof e.data === "string") {
    dataBytesLike = e.data;
  } else {
    if (typeof e.data !== "object") {
      return;
    }
    const providerErrorData = e.data;
    if (!("message" in providerErrorData && "txHash" in providerErrorData && "data" in providerErrorData)) {
      return;
    }
    if (
      typeof providerErrorData.data !== "string" ||
      typeof providerErrorData.message !== "string" ||
      typeof providerErrorData.txHash !== "string"
    ) {
      return;
    }
    dataBytesLike = providerErrorData.data;

    if (!(EthersT.isBytesLike(dataBytesLike) && EthersT.isHexString(providerErrorData.txHash))) {
      return;
    }

    if (
      providerErrorData.message !==
      `Error: VM Exception while processing transaction: reverted with an unrecognized custom error (return data: ${providerErrorData.data})`
    ) {
      return;
    }

    txHash = providerErrorData.txHash;
  }
  await __mutateFhevmErrorAndPrintBox(fhevmEnv, e, dataBytesLike, txHash, txFromTo);
}

async function __mutateFhevmErrorAndPrintBox(
  fhevmEnv: FhevmEnvironment,
  e: { message: string },
  dataBytesLike: BytesLike,
  txHash?: string,
  txFromTo?: { from: string; to: string | null },
) {
  const msgs = await __formatFhevmErrorMessages(fhevmEnv, dataBytesLike, txHash, txFromTo);
  if (!msgs) {
    return;
  }

  // Mutate error message
  e.message = msgs.message;

  const showErrorBox = fhevmEnv.hre.hardhatArguments.verbose;

  if (msgs && showErrorBox && msgs.title && msgs.longMessage) {
    logBox(msgs.title, msgs.longMessage, { titleColor: "yellow", textColor: "red", out: "stderr" });
  }
}

async function __formatFhevmErrorMessages(
  fhevmEnv: FhevmEnvironment,
  dataBytesLike: BytesLike,
  txHash?: string,
  txFromTo?: { from: string; to: string | null },
): Promise<FhevmErrorMessages | undefined> {
  const map = fhevmEnv.getFHEVMContractsMap();
  const res: {
    errorDesc: EthersT.ErrorDescription;
    contractName: FhevmContractName;
    address: string;
    contract: EthersT.Contract;
  }[] = [];

  Object.keys(map).forEach((key) => {
    try {
      const errorDesc = map[key].contract.interface.parseError(dataBytesLike);
      if (errorDesc) {
        res.push({
          ...map[key],
          errorDesc,
        });
      }
    } catch {
      console.log("PROBLEMOS!");
    }
  });

  if (res.length !== 1) {
    return undefined;
  }

  const resolvedTx: {
    from?: string;
    to?: string;
  } = {};

  if (txHash) {
    //VM Exception while processing transaction: reverted with an unrecognized custom error
    const _tx = await fhevmEnv.ethersProvider.provider.getTransaction(txHash);
    if (_tx?.from) {
      resolvedTx.from = _tx.from;
    }
    if (_tx?.to) {
      resolvedTx.to = _tx.to;
    }
  } else {
    if (txFromTo?.from) {
      resolvedTx.from = txFromTo.from;
    }
    if (txFromTo?.to) {
      resolvedTx.to = txFromTo.to;
    }
  }

  if (resolvedTx.from) {
    resolvedTx.from = EthersT.getAddress(resolvedTx.from);
  }
  if (resolvedTx.to) {
    resolvedTx.to = EthersT.getAddress(resolvedTx.to);
  }

  let msgs: FhevmErrorMessages | undefined = undefined;

  const info = res[0];
  switch (info.contractName) {
    case "ACL": {
      msgs = _formatACLErrorMessages({ ...info, tx: resolvedTx });
      break;
    }
    case "FHEVMExecutor": {
      msgs = _formatFHEVMExecutorErrorMessages({ ...info, tx: resolvedTx });
      break;
    }
    case "InputVerifier": {
      msgs = _formatInputVerifierErrorMessages({ ...info, tx: resolvedTx });
      break;
    }
    case "KMSVerifier": {
      msgs = _formatKMSVerifierErrorMessages({ ...info, tx: resolvedTx });
      break;
    }
    case "FHEGasLimit": {
      msgs = _formatFHEGasLimitErrorMessages({ ...info, tx: resolvedTx });
      break;
    }
    case "DecryptionOracle": {
      msgs = _formatDecryptionOracleErrorMessages({ ...info, tx: resolvedTx });
      break;
    }
    default: {
      break;
    }
  }

  return msgs;
}

function _formatACLErrorMessages(infos: FhevmErrorInfos): FhevmErrorMessages {
  /*

    /// @notice Returned if the delegatee contract is already delegatee for sender & delegator addresses.
    /// @param delegatee   delegatee address.
    /// @param contractAddress   contract address.
    error AlreadyDelegated(address delegatee, address contractAddress);

    /// @notice Returned if the sender is the delegatee address.
    error SenderCannotBeContractAddress(address contractAddress);

    /// @notice Returned if the contractAddresses array is empty.
    error ContractAddressesIsEmpty();

    /// @notice Maximum length of contractAddresses array exceeded.
    error ContractAddressesMaxLengthExceeded();

    /// @notice Returned if the handlesList array is empty.
    error HandlesListIsEmpty();

    /// @notice Returned if the the delegatee contract is not already delegatee for sender & delegator addresses.
    /// @param delegatee   delegatee address.
    /// @param contractAddress   contract address.
    error NotDelegatedYet(address delegatee, address contractAddress);

    /// @notice         Returned if the sender address is not allowed for allow operations.
    /// @param sender   Sender address.
    error SenderNotAllowed(address sender);

 */

  let values: { [templateVar: string]: any } | undefined = undefined;
  switch (infos.errorDesc.name) {
    case "SenderNotAllowed": {
      values = {
        address: infos.errorDesc.args[0],
      };
      break;
    }
  }
  return _applyErrorTemplates(infos, values);
}

function _formatFHEVMExecutorErrorMessages(infos: FhevmErrorInfos): FhevmErrorMessages {
  /*

    error ACLNotAllowed(bytes32 handle, address account);

    /// @notice Returned when the FHE operator attempts to divide by zero.
    error DivisionByZero();

    /// @notice Returned if two types are not compatible for this operation.
    error IncompatibleTypes();

    /// @notice Returned if the length of the bytes is not as expected.
    error InvalidByteLength(FheType typeOf, uint256 length);

    /// @notice Returned if the type is not the expected one.
    error InvalidType();

    /// @notice Returned if it uses the wrong overloaded function (for functions fheEq/fheNe),
    ///         which does not handle scalar.
    error IsScalar();

    /// @notice Returned if operation is supported only for a scalar (functions fheDiv/fheRem).
    error IsNotScalar();

    /// @notice Returned if the upper bound for generating randomness is not a power of two.
    error NotPowerOfTwo();

    /// @notice Returned if the second operand is not a scalar (for functions fheEq/fheNe).
    error SecondOperandIsNotScalar();

    /// @notice Returned if the type is not supported for this operation.
    error UnsupportedType();

  */

  // const fhevmExecutor = fhevmEnv.getFHEVMExecutorReadOnly();
  // const e = fhevmExecutor.interface.getError(infos.errorDesc.name);
  // e?.inputs[0].name

  const abiError = infos.contract.interface.getError(infos.errorDesc.name);

  let values: { [templateVar: string]: any } | undefined = undefined;
  if (abiError) {
    const inputs = abiError.inputs;
    assertHHFhevm(inputs.length === infos.errorDesc.args.length);
    if (inputs.length > 0) {
      values = {};
      for (let i = 0; i < inputs.length; ++i) {
        values[inputs[i].name] = infos.errorDesc.args[i];
      }
    }
  }

  return _applyErrorTemplates(infos, values);
}

function _formatInputVerifierErrorMessages(infos: FhevmErrorInfos): FhevmErrorMessages {
  switch (infos.errorDesc.name) {
    case "InvalidSigner": {
      const msgs = formatInputVerifierInvalidSignerErrorMessages(infos);
      return { ...msgs, message: `${msgs.title}: ${msgs.shortMessage}` };
    }
    default: {
      return {
        message: `VM Exception while processing transaction: reverted with FHEVM ${infos.contractName} custom error '${infos.errorDesc.name}'`,
      };
    }
  }
}

function _formatKMSVerifierErrorMessages(infos: FhevmErrorInfos): FhevmErrorMessages | undefined {
  return _applyErrorTemplates(infos);
}

function _formatFHEGasLimitErrorMessages(infos: FhevmErrorInfos): FhevmErrorMessages {
  return _applyErrorTemplates(infos);
}

function _formatDecryptionOracleErrorMessages(infos: FhevmErrorInfos): FhevmErrorMessages {
  return _applyErrorTemplates(infos);
}

function formatInputVerifierInvalidSignerErrorMessages(infos: FhevmErrorInfos) {
  let shortMessage: string = "";
  let longMessage: string = "";

  const txContractAddress = infos.tx?.to;
  const txUserAddress = infos.tx?.from;

  if (txContractAddress && txUserAddress) {
    shortMessage = applyErrorTemplate(ERRORS.InputVerifier.InvalidSigner.shortMessage, {
      txContractAddress,
      txUserAddress,
    });
    longMessage = applyErrorTemplate(ERRORS.InputVerifier.InvalidSigner.longMessage, {
      txContractAddress,
      txUserAddress,
    });
  }

  return { title: ERRORS.InputVerifier.InvalidSigner.title, shortMessage, longMessage };
}

function _applyErrorTemplates(infos: FhevmErrorInfos, values?: { [templateVar: string]: any }): FhevmErrorMessages {
  let shortMessage: string | undefined = undefined;
  let longMessage: string | undefined = undefined;
  let title: string | undefined = undefined;
  let message = applyErrorTemplate(ERRORS.CustomError.default, { customError: `${infos.errorDesc.name}()` });

  if (infos.contractName in ERRORS) {
    const error = (ERRORS as Record<string, any>)[infos.contractName];
    if (infos.errorDesc.name in error) {
      const templates = (error as Record<string, any>)[infos.errorDesc.name];
      if ("shortMessage" in templates && typeof templates.shortMessage === "string") {
        shortMessage = applyErrorTemplate(templates.shortMessage, values);
      }
      if ("longMessage" in templates && typeof templates.longMessage === "string") {
        longMessage = applyErrorTemplate(templates.longMessage, values);
      }
      if ("title" in templates && typeof templates.title === "string") {
        title = applyErrorTemplate(templates.title, values);
      }
      if ("message" in templates && typeof templates.message === "string") {
        message = applyErrorTemplate(templates.message, values);
      } else if (title && shortMessage) {
        message = `${title}: ${shortMessage}`;
      }
    }
  }

  return {
    message,
    ...(title && { title }),
    ...(shortMessage && { shortMessage }),
    ...(longMessage && { longMessage }),
  };
}
