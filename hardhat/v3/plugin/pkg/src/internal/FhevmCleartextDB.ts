// `fhevm.cleartextDb` — reads a value straight out of the on-chain `CleartextDB`. NOT a decryption:
// no ACL check, no permit, no KMS, just one `eth_call` against `CleartextDB.get(handle)`. The
// test-only escape hatch — `helpers.decryptPublic*`/`decrypt*` enforce permissions, while an operator
// test wants to assert that `FheAdd(a, b)` produced the right number without arranging for anyone to
// be allowed to see it. The DB exists only on the cleartext stack, which is why every method here
// fails by name on any other network.

import { HardhatPluginError } from 'hardhat/plugins';
import { type Hex, getAddress, toHex } from 'viem';

import { type FhevmCleartextDB, type FhevmNetworkInfo } from '../types.js';
import { FhevmType } from '../types-p.js';
import { PLUGIN_ID } from './constants.js';
import { type FhevmContractsRepository, isCleartextContractsRepository } from './contracts.js';
import { assertDecryptedFitsType, decryptedToNumber } from './fhevmValue.js';
import { assertHandleChainId, assertHandleIsInitialized, parseFhevmHandle } from './fhevmHandle.js';

export class FhevmCleartextDBImpl implements FhevmCleartextDB {
  readonly #getRepository: () => FhevmContractsRepository | undefined;
  readonly #network: FhevmNetworkInfo;

  // The repository is fetched per call, never captured: on a network that has none, `fhevm.cleartextDb`
  // stays reachable and only the call throws, as `client` and `helpers` behave.
  constructor(getRepository: () => FhevmContractsRepository | undefined, network: FhevmNetworkInfo) {
    this.#getRepository = getRepository;
    this.#network = network;
  }

  // The raw uint256 behind `handle`, once the handle is known to be real and of the expected type.
  async #read(method: string, expected: FhevmType, handle: Hex): Promise<bigint> {
    // `CleartextDB` only exists on the cleartext stack; elsewhere values are really encrypted. Both
    // "no stack at all" and "a stack without a CleartextDB" answer the same way, and this method owns
    // the message: letting the connection's generic "contracts are not available" error escape here
    // would tell a caller nothing about WHY reading a cleartext is impossible, nor what to use instead.
    const repository = this.#getRepository();
    if (repository === undefined || !isCleartextContractsRepository(repository)) {
      throw new HardhatPluginError(
        PLUGIN_ID,
        `fhevm.cleartextDb.${method}: '${this.#network.networkName}' (chainId ${String(this.#network.chainId)}) is not a cleartext stack, so there is no CleartextDB to read — values there are really encrypted. Use fhevm.helpers.decrypt*() or fhevm.helpers.decryptPublic*() instead.`,
      );
    }

    // Uninitialized before type: the zero word's byte 30 is 0x00, which IS `FhevmType.ebool`, so a
    // type check placed first would report it as "a ebool" rather than as no handle at all.
    assertHandleIsInitialized(handle);
    const info = parseFhevmHandle(handle);
    assertHandleChainId(`fhevm.cleartextDb.${method}`, info, this.#network.chainId);
    if (info.fhevmType !== expected) {
      throw new HardhatPluginError(
        PLUGIN_ID,
        `fhevm.cleartextDb.${method}: handle '${handle}' is a ${info.typeName}, not a ${FhevmType[expected]}.`,
      );
    }

    const db = repository.cleartextDb;
    const value: unknown = await repository.client.readContract({
      address: db.address,
      abi: db.abi,
      functionName: 'get',
      args: [handle],
    });
    if (typeof value !== 'bigint') {
      throw new HardhatPluginError(
        PLUGIN_ID,
        `fhevm.cleartextDb.${method}: CleartextDB.get('${handle}') did not return a uint256.`,
      );
    }
    return value;
  }

  // euint4/8/16/32 are declared to return a `number`; the shared bound check makes that narrowing safe.
  async #readNumber(method: string, expected: FhevmType, handle: Hex): Promise<number> {
    return decryptedToNumber(
      `fhevm.cleartextDb.${method}`,
      expected,
      await this.#read(method, expected, handle),
      handle,
    );
  }

  async #readBigInt(method: string, expected: FhevmType, handle: Hex): Promise<bigint> {
    return assertDecryptedFitsType(
      `fhevm.cleartextDb.${method}`,
      expected,
      await this.#read(method, expected, handle),
      handle,
    );
  }

  async readBool(args: { ebool: Hex }): Promise<boolean> {
    const value = await this.#read('readBool', FhevmType.ebool, args.ebool);
    if (value !== 0n && value !== 1n) {
      throw new HardhatPluginError(
        PLUGIN_ID,
        `fhevm.cleartextDb.readBool: CleartextDB holds ${String(value)} for ebool handle '${args.ebool}', not 0 or 1.`,
      );
    }
    return value === 1n;
  }

  async readUint8(args: { euint8: Hex }): Promise<number> {
    return this.#readNumber('readUint8', FhevmType.euint8, args.euint8);
  }

  async readUint16(args: { euint16: Hex }): Promise<number> {
    return this.#readNumber('readUint16', FhevmType.euint16, args.euint16);
  }

  async readUint32(args: { euint32: Hex }): Promise<number> {
    return this.#readNumber('readUint32', FhevmType.euint32, args.euint32);
  }

  async readUint64(args: { euint64: Hex }): Promise<bigint> {
    return this.#readBigInt('readUint64', FhevmType.euint64, args.euint64);
  }

  async readUint128(args: { euint128: Hex }): Promise<bigint> {
    return this.#readBigInt('readUint128', FhevmType.euint128, args.euint128);
  }

  async readUint256(args: { euint256: Hex }): Promise<bigint> {
    return this.#readBigInt('readUint256', FhevmType.euint256, args.euint256);
  }

  async readAddress(args: { eaddress: Hex }): Promise<Hex> {
    const value = await this.#read('readAddress', FhevmType.eaddress, args.eaddress);
    return getAddress(toHex(value, { size: 20 }));
  }
}
