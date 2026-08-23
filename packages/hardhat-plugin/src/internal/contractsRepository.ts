import { ethers as EthersT } from "ethers";

import { HardhatFhevmError } from "../error";
import constants from "./constants";
import type { FhevmContractName } from "./migration/placeholders";

/**
 * The FHEVM host contracts, by ABI.
 *
 * Replaces `@fhevm/mock-utils`' `FhevmContractsRepository`, and is deliberately far smaller. The old
 * one also carried the KMS/coprocessor signer sets, gateway addresses and EIP-712 domains, because
 * the JavaScript mock engine needed them to forge relayer responses. Nothing does any more: the
 * cleartext stack runs on-chain and `@fhevm/sdk` owns the signing. What is left is exactly one job —
 * decoding a revert into the custom error that produced it, which needs nothing but ABIs.
 *
 * ABIs come from `@fhevm/host-contracts-cleartext`'s `./abi/*.json` export, so they track the
 * deployed contracts by construction rather than being vendored here.
 */

// `require` rather than `import`: these are JSON in a CommonJS build, and loading them lazily keeps
// them out of the module graph for consumers that never decode an error.
function __loadAbi(file: string): EthersT.InterfaceAbi {
  try {
    return require(`@fhevm/host-contracts-cleartext/abi/${file}.json`) as EthersT.InterfaceAbi;
  } catch (e) {
    throw new HardhatFhevmError(
      `Unable to load the '${file}' ABI from ${constants.FHEVM_HOST_CONTRACTS_CLEARTEXT_PACKAGE.name}. ${String(e)}`,
    );
  }
}

/** Maps a host contract to the ABI file that describes it in the cleartext package. */
const ABI_FILE: Readonly<Record<FhevmContractName, string>> = {
  ACL: "ACL",
  FHEVMExecutor: "CleartextFHEVMExecutor",
  InputVerifier: "CleartextInputVerifier",
  KMSVerifier: "CleartextKMSVerifier",
  HCULimit: "HCULimit",
  ProtocolConfig: "ProtocolConfig",
  KMSGeneration: "KMSGeneration",
};

export type FhevmContractWrapper = {
  readonly name: FhevmContractName;
  readonly address: string;
  readonly package: string;
  readonly interface: EthersT.Interface;
  readonly readonlyContract: EthersT.Contract;
  readonly properties: {
    contractName: FhevmContractName;
    address: string;
    contract: EthersT.Contract;
    package: string;
  };
};

function __wrap(name: FhevmContractName, address: string, provider: EthersT.Provider): FhevmContractWrapper {
  const abi = __loadAbi(ABI_FILE[name]);
  const contract = new EthersT.Contract(address, abi, provider);
  const pkg = constants.FHEVM_HOST_CONTRACTS_CLEARTEXT_PACKAGE.name;
  return {
    name,
    address,
    package: pkg,
    interface: contract.interface,
    readonlyContract: contract,
    properties: { contractName: name, address, contract, package: pkg },
  };
}

export class FhevmContractsRepository {
  readonly acl: FhevmContractWrapper;
  readonly fhevmExecutor: FhevmContractWrapper;
  readonly inputVerifier: FhevmContractWrapper;
  readonly kmsVerifier: FhevmContractWrapper;
  readonly hcuLimit: FhevmContractWrapper;

  readonly #byAddress: Record<string, FhevmContractWrapper>;
  readonly #byName: Map<FhevmContractName, FhevmContractWrapper>;

  constructor(
    provider: EthersT.Provider,
    addresses: {
      readonly aclAddress: string;
      readonly fhevmExecutorAddress: string;
      readonly inputVerifierAddress: string;
      readonly kmsVerifierAddress: string;
      readonly hcuLimitAddress: string;
    },
  ) {
    this.acl = __wrap("ACL", addresses.aclAddress, provider);
    this.fhevmExecutor = __wrap("FHEVMExecutor", addresses.fhevmExecutorAddress, provider);
    this.inputVerifier = __wrap("InputVerifier", addresses.inputVerifierAddress, provider);
    this.kmsVerifier = __wrap("KMSVerifier", addresses.kmsVerifierAddress, provider);
    this.hcuLimit = __wrap("HCULimit", addresses.hcuLimitAddress, provider);

    const all = [this.acl, this.fhevmExecutor, this.inputVerifier, this.kmsVerifier, this.hcuLimit];

    this.#byAddress = {};
    for (const w of all) {
      // Addresses are compared case-insensitively: a revert reports whatever casing the node used.
      this.#byAddress[w.address.toLowerCase()] = w;
    }
    this.#byName = new Map(all.map((w) => [w.name, w]));
  }

  public addressToContractMap(): Record<string, FhevmContractWrapper> {
    return { ...this.#byAddress };
  }

  public getContractFromAddress(address: string): FhevmContractWrapper | undefined {
    return this.#byAddress[address.toLowerCase()];
  }

  public getContractFromName(name: FhevmContractName): FhevmContractWrapper | undefined {
    return this.#byName.get(name);
  }
}
