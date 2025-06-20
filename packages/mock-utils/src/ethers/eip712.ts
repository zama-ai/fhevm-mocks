import { ethers as EthersT } from "ethers";

import { FhevmError, assertFhevm } from "../utils/error.js";
import { removePrefix } from "../utils/string.js";

export type EthersEIP712 = {
  domain: EthersT.TypedDataDomain;
  message: Record<string, unknown>;
  types: Record<string, Array<EthersT.TypedDataField>>;
};

export type EIP712Domain = {
  fields: number;
  name: string;
  version: string;
  chainId: bigint;
  verifyingContract: string;
  salt: EthersT.BytesLike;
};

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
    const signature = await signEIP712(signer!, domain, types, message);
    signatures.push(signature);
  }
  return signatures;
}

export function assertIsEIP712Domain(
  eip712Domain: unknown[],
  name: string,
  expectedDomain: { name: string; version: string; chainId: bigint; verifyingContract: string },
): asserts eip712Domain is [unknown, string, string, bigint, string] {
  assertFhevm(Array.isArray(eip712Domain), `Invalid ${name} EIP712 domain`);
  assertFhevm(eip712Domain.length >= 5, `Invalid ${name} EIP712 domain`);
  assertFhevm(
    eip712Domain[1] === expectedDomain.name,
    `Invalid ${name} EIP712 domain name. Got ${eip712Domain[1]}, expected ${expectedDomain.name}`,
  );
  assertFhevm(
    eip712Domain[2] === expectedDomain.version,
    `Invalid ${name} EIP712 domain name. Got ${eip712Domain[2]}, expected ${expectedDomain.version}`,
  );
  assertFhevm(
    eip712Domain[3] === expectedDomain.chainId,
    `Invalid ${name} EIP712 domain name. Got ${eip712Domain[3]}, expected ${expectedDomain.chainId}`,
  );
  assertFhevm(
    eip712Domain[4] === expectedDomain.verifyingContract,
    `Invalid ${name} EIP712 domain name. Got ${eip712Domain[4]}, expected ${expectedDomain.verifyingContract}`,
  );
}

export function isThresholdReached(
  signersAddress: string[],
  recoveredAddresses: string[],
  threshold: number,
  signerType: string,
): boolean {
  const addressMap = new Map<string, number>();
  recoveredAddresses.forEach((address, index) => {
    if (addressMap.has(address)) {
      const duplicateValue = address;
      throw new FhevmError(
        `Duplicate ${signerType} signer address found: ${duplicateValue} appears multiple times in recovered addresses`,
      );
    }
    addressMap.set(address, index);
  });

  for (const address of recoveredAddresses) {
    if (!signersAddress.includes(address)) {
      throw new FhevmError(`Invalid address found: ${address} is not in the list of ${signerType} signers`);
    }
  }

  return recoveredAddresses.length >= threshold;
}
