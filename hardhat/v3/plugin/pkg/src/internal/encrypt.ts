// Encryption over the SDK client. `createEncryptedInput` is the batched builder — several values
// under ONE input proof, which a contract taking several `externalEuintXX` arguments requires and the
// singular helpers cannot express; `encryptOne` backs those helpers.

import { HardhatPluginError } from 'hardhat/plugins';
import { type Address, type Hex, isAddress } from 'viem';

import { type FhevmClient } from '../types.js';
import { FhevmType, type FhevmEncryptedInput } from '../types-p.js';
import { PLUGIN_ID } from './constants.js';
import { fhevmTypeToSdkType } from './fheType.js';
import { type ClearValue, assertValueFitsType } from './fhevmValue.js';

type TypedClearValue = { type: string; value: ClearValue };

function assertAddress(method: string, name: string, value: string): void {
  if (isAddress(value)) return;
  throw new HardhatPluginError(
    PLUGIN_ID,
    `${method}: the '${name}' argument is not a valid address. Got '${value}' instead.`,
  );
}

export function createEncryptedInput(
  getClient: () => FhevmClient,
  contractAddress: Address,
  userAddress: Address,
): FhevmEncryptedInput {
  assertAddress('createEncryptedInput', 'contractAddress', contractAddress);
  assertAddress('createEncryptedInput', 'userAddress', userAddress);

  const values: TypedClearValue[] = [];
  // `method` is the builder call the user actually wrote, so a bad value blames `.add8()` and not the
  // `.encrypt()` far below it, where the SDK would otherwise have raised it.
  const add = (method: string, fhevmType: FhevmType, value: ClearValue): FhevmEncryptedInput => {
    assertValueFitsType(`createEncryptedInput.${method}`, fhevmType, value);
    values.push({ type: fhevmTypeToSdkType(fhevmType), value });
    return builder;
  };

  const builder: FhevmEncryptedInput = {
    contractAddress,
    userAddress,
    addBool: (value) => add('addBool', FhevmType.ebool, value),
    add8: (value) => add('add8', FhevmType.euint8, value),
    add16: (value) => add('add16', FhevmType.euint16, value),
    add32: (value) => add('add32', FhevmType.euint32, value),
    add64: (value) => add('add64', FhevmType.euint64, value),
    add128: (value) => add('add128', FhevmType.euint128, value),
    add256: (value) => add('add256', FhevmType.euint256, value),
    addAddress: (value) => add('addAddress', FhevmType.eaddress, value),
    async encrypt(): Promise<{ handles: Hex[]; inputProof: Hex }> {
      if (values.length === 0) {
        throw new HardhatPluginError(PLUGIN_ID, `createEncryptedInput: nothing to encrypt — add at least one value.`);
      }
      const res = await getClient().encryptValues({ values, contractAddress, userAddress });
      return { handles: [...res.encryptedValues], inputProof: res.inputProof };
    },
  };
  return builder;
}

export async function encryptOne(
  client: FhevmClient,
  method: string,
  fhevmType: FhevmType,
  value: ClearValue,
  contractAddress: Address,
  userAddress: Address,
): Promise<{ handle: Hex; inputProof: Hex }> {
  assertAddress(method, 'contractAddress', contractAddress);
  assertAddress(method, 'userAddress', userAddress);
  assertValueFitsType(method, fhevmType, value);
  const res = await client.encryptValue({
    value: { type: fhevmTypeToSdkType(fhevmType), value },
    contractAddress,
    userAddress,
  });
  return { handle: res.encryptedValue, inputProof: res.inputProof };
}
