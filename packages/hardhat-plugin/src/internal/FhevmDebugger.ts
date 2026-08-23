import { ethers as EthersT } from "ethers";

import { HardhatFhevmError } from "../error";
import type { HardhatFhevmRuntimeDebugger } from "../types";
import type { FhevmEnvironment } from "./FhevmEnvironment";
import constants from "./constants";
import { FhevmType, type FhevmTypeEuint, isFhevmEuint } from "./fheType";
import { assertHandleIsInitialized, parseFhevmHandle } from "./fhevmHandle";
import type { FhevmHandleCoder } from "./migration/placeholders";

/**
 * `fhevm.debugger` — reads cleartexts straight out of the chain, with no ACL check.
 *
 * This is the test-only escape hatch: `userDecrypt`/`publicDecrypt` deliberately enforce permissions,
 * but an operator test wants to assert that `FheAdd(a, b)` produced the right number without first
 * arranging for anyone to be allowed to see it.
 *
 * Under the old JavaScript mock engine that meant asking the in-process coprocessor over a custom
 * `fhevm_get_clear_text` RPC. The cleartext stack keeps the same values on-chain in `CleartextDB`, so
 * the debugger now just reads them — same capability, one `eth_call` instead of a fake relayer.
 */
const CLEARTEXT_DB_ABI = [
  {
    type: "function",
    name: "get",
    stateMutability: "view",
    inputs: [{ name: "handle", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export class FhevmDebugger implements HardhatFhevmRuntimeDebugger {
  readonly #fhevmEnv: FhevmEnvironment;
  #cleartextDb: EthersT.Contract | undefined;

  constructor(fhevmEnv: FhevmEnvironment) {
    this.#fhevmEnv = fhevmEnv;
  }

  /**
   * `CleartextDB` only exists on the local cleartext stack. On a public network the values are
   * genuinely encrypted, so there is nothing for the debugger to read and saying so plainly beats
   * failing later inside an `eth_call`.
   */
  #db(): EthersT.Contract {
    if (!this.#fhevmEnv.mockProvider.isMock) {
      throw new HardhatFhevmError(
        `fhevm.debugger is only available on a local cleartext network — on '${this.#fhevmEnv.mockProvider.info.networkName}' values are really encrypted. Use fhevm.userDecryptE*() or fhevm.publicDecryptE*() instead.`,
      );
    }
    if (this.#cleartextDb === undefined) {
      this.#cleartextDb = new EthersT.Contract(
        constants.FHEVM_HOST_CONTRACTS_CLEARTEXT_PACKAGE.cleartextAddresses.cleartextDbAddress,
        CLEARTEXT_DB_ABI,
        this.#fhevmEnv.readonlyEthersProvider,
      );
    }
    return this.#cleartextDb;
  }

  /** The raw cleartext behind a handle, after checking the handle really is of the expected type. */
  async #read(handleBytes32: EthersT.BigNumberish, expected: FhevmType, method: string): Promise<bigint> {
    const handle = EthersT.toBeHex(handleBytes32, 32);
    assertHandleIsInitialized(handle);

    const info = parseFhevmHandle(handle);
    if (info.fhevmType !== expected) {
      throw new HardhatFhevmError(
        `fhevm.debugger.${method}: handle '${handle}' is a ${info.typeName}, not a ${FhevmType[expected]}.`,
      );
    }

    return (await this.#db().get(handle)) as bigint;
  }

  public async decryptEbool(handleBytes32: EthersT.BigNumberish): Promise<boolean> {
    return (await this.#read(handleBytes32, FhevmType.ebool, "decryptEbool")) === 1n;
  }

  public async decryptEuint(fhevmType: FhevmTypeEuint, handleBytes32: EthersT.BigNumberish): Promise<bigint> {
    if (!isFhevmEuint(fhevmType)) {
      throw new HardhatFhevmError(`fhevm.debugger.decryptEuint: expected an euint type.`);
    }
    return await this.#read(handleBytes32, fhevmType, "decryptEuint");
  }

  public async decryptEaddress(handleBytes32: EthersT.BigNumberish): Promise<`0x${string}`> {
    const value = await this.#read(handleBytes32, FhevmType.eaddress, "decryptEaddress");
    return EthersT.getAddress(EthersT.toBeHex(value, 20)) as `0x${string}`;
  }

  public createHandleCoder(): FhevmHandleCoder {
    throw new HardhatFhevmError(
      `fhevm.debugger.createHandleCoder() is not implemented yet. See plans/MIGRATION_TO_FHEVM_SDK_CLEARTEXT.md.`,
    );
  }

  public async createDecryptionSignatures(
    _handlesBytes32Hex: string[],
    _clearTextValues: (bigint | string | boolean)[],
  ): Promise<string[]> {
    throw new HardhatFhevmError(
      `fhevm.debugger.createDecryptionSignatures() is not implemented yet: it forged KMS signatures through the JavaScript mock engine. See plans/MIGRATION_TO_FHEVM_SDK_CLEARTEXT.md.`,
    );
  }
}
