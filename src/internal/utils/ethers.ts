import { ethers as EthersT } from "ethers";

import { HardhatFhevmError } from "../../error";
import { removePrefix } from "./hex";

export function assertEventArgUint256(value: unknown, eventName: string, argIndex: number): asserts value is bigint {
  assertEventArgUintXX(
    value,
    eventName,
    argIndex,
    "uint8",
    BigInt(0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn),
  );
}

export function assertEventArgUint8(value: unknown, eventName: string, argIndex: number): asserts value is bigint {
  assertEventArgUintXX(value, eventName, argIndex, "uint8", BigInt(0xff));
}

function assertEventArgUintXX(
  value: unknown,
  eventName: string,
  argIndex: number,
  typeName: string,
  max: bigint,
): asserts value is bigint {
  if (typeof value !== "bigint") {
    throw new HardhatFhevmError(
      `${eventName} event arg #${argIndex} is not of type bigint, got ${typeof value} instead`,
    );
  }
  if (value < 0 || value > max) {
    throw new HardhatFhevmError(
      `${eventName} event arg #${argIndex} is larger that ${typeName} maximum value, got ${value} > ${max}`,
    );
  }
}

// function assertUintXX(value: unknown, typeName: string, max: bigint, valueName: string): asserts value is bigint {
//   if (typeof value !== "bigint") {
//     throw new HardhatFhevmError(`${valueName} is not of type bigint, got ${typeof value} instead`);
//   }
//   if (value < 0 || value > max) {
//     throw new HardhatFhevmError(`${valueName} is larger that ${typeName} maximum value, got ${value} > ${max}`);
//   }
// }

export function assertEventArgBytes(value: unknown, eventName: string, argIndex: number): asserts value is string {
  if (typeof value !== "string") {
    throw new HardhatFhevmError(
      `${eventName} event arg #${argIndex} is not of type string, got ${typeof value} instead`,
    );
  }
  if (!EthersT.isBytesLike(value)) {
    throw new HardhatFhevmError(`${eventName} event arg #${argIndex} = ${value} is an invalid bytes string.`);
  }
}

export function assertEventArgAddress(value: unknown, eventName: string, argIndex: number): asserts value is string {
  if (typeof value !== "string") {
    throw new HardhatFhevmError(
      `${eventName} event arg #${argIndex} is not of type string, got ${typeof value} instead`,
    );
  }
  if (!EthersT.isAddress(value)) {
    throw new HardhatFhevmError(`${eventName} event arg #${argIndex} = ${value} is an invalid address string.`);
  }
}

export function assertEventArgBytes1(value: unknown, eventName: string, argIndex: number): asserts value is string {
  assertEventArgBytesXX(value, eventName, argIndex, 1);
}
export function assertEventArgBytes4(value: unknown, eventName: string, argIndex: number): asserts value is string {
  assertEventArgBytesXX(value, eventName, argIndex, 4);
}
export function assertEventArgBytes8(value: unknown, eventName: string, argIndex: number): asserts value is string {
  assertEventArgBytesXX(value, eventName, argIndex, 8);
}
export function assertEventArgBytes16(value: unknown, eventName: string, argIndex: number): asserts value is string {
  assertEventArgBytesXX(value, eventName, argIndex, 16);
}
export function assertEventArgBytes32(value: unknown, eventName: string, argIndex: number): asserts value is string {
  assertEventArgBytesXX(value, eventName, argIndex, 32);
}

function assertEventArgBytesXX(
  value: unknown,
  eventName: string,
  argIndex: number,
  width: number,
): asserts value is string {
  if (typeof value !== "string") {
    throw new HardhatFhevmError(
      `${eventName} event arg #${argIndex} is not of type string, got ${typeof value} instead`,
    );
  }
  if (value !== EthersT.toBeHex(value, width)) {
    throw new HardhatFhevmError(`${eventName} event arg #${argIndex} = ${value} is an invalid bytes${width} string.`);
  }
}

export function assertAddress(value: unknown, valueName: string): asserts value is string {
  if (typeof value !== "string") {
    throw new HardhatFhevmError(`${valueName} is not of type string, got ${typeof value} instead`);
  }
  if (!EthersT.isAddress(value)) {
    throw new HardhatFhevmError(`${valueName} = ${value} is an invalid address string.`);
  }
}

export function assertBytes32(value: unknown, valueName: string): asserts value is string {
  assertBytesXX(value, valueName, 32);
}

function assertBytesXX(value: unknown, valueName: string, width: number): asserts value is string {
  if (typeof value !== "string") {
    throw new HardhatFhevmError(`${valueName} is not of type string, got ${typeof value} instead`);
  }
  if (value !== EthersT.toBeHex(value, width)) {
    throw new HardhatFhevmError(`${valueName} = ${value} is an invalid bytes${width} string.`);
  }
}

export async function getChainId(signer: EthersT.Signer): Promise<number> {
  const provider = signer.provider;
  if (!provider) {
    throw new HardhatFhevmError("Unable to determine signer provider");
  }

  const network = await provider.getNetwork();

  return Number(network.chainId);
}

export function walletFromMnemonic(
  index: number,
  phrase: string,
  path: string,
  provider: EthersT.Provider | null,
): EthersT.HDNodeWallet {
  const mnemonic = EthersT.Mnemonic.fromPhrase(phrase);
  if (!mnemonic) {
    throw new Error(`Invalid mnemonic phrase: ${phrase}`);
  }
  const rootWallet = EthersT.HDNodeWallet.fromMnemonic(mnemonic, path);
  return rootWallet.deriveChild(index).connect(provider);
}

export async function signEIP712(
  signer: EthersT.Signer,
  domain: EthersT.TypedDataDomain,
  types: Record<string, Array<EthersT.TypedDataField>>,
  message: Record<string, unknown>,
): Promise<string> {
  const signature = await signer.signTypedData(domain, types, message);
  const sigRSV = EthersT.Signature.from(signature);
  const v = 27 + sigRSV.yParity;
  const r = sigRSV.r;
  const s = sigRSV.s;

  const result = r + removePrefix(s, "0x") + v.toString(16);
  return result;
}

export async function multiSignEIP712(
  signers: EthersT.Signer[],
  domain: EthersT.TypedDataDomain,
  types: Record<string, Array<EthersT.TypedDataField>>,
  message: Record<string, unknown>,
): Promise<string[]> {
  const signatures: string[] = [];
  for (let idx = 0; idx < signers.length; idx++) {
    const signer = signers[idx];
    const signature = await signEIP712(signer, domain, types, message);
    signatures.push(signature);
  }
  return signatures;
}
