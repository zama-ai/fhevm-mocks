import { HardhatFhevmError } from "../../error";
import { FhevmType } from "../fheType";

/**
 * The protocol's own type names, as used by the HCU price table (`operatorsPrices.json`).
 *
 * Distinct from the plugin's `FhevmTypeName` (`"euint32"`): this is the `FheType` spelling
 * (`"Uint32"`) the pricing data is keyed by. Only the widths the price table actually mentions are
 * listed — `@fhevm/mock-utils` declared the full protocol enum up to `Uint2048`, but the plugin has
 * no use for names it can never price.
 */
export type FheTypeName =
  | "Bool"
  | "Uint8"
  | "Uint16"
  | "Uint32"
  | "Uint64"
  | "Uint128"
  | "Uint160"
  | "Uint256"
  | "Uint512"
  | "Uint1024"
  | "Uint2048";

/** `eaddress` is priced as `Uint160`, which is how an address is represented on-chain. */
const FHEVM_TYPE_TO_FHE_TYPE_NAME: Readonly<Record<FhevmType, FheTypeName | undefined>> = {
  [FhevmType.ebool]: "Bool",
  [FhevmType.euint4]: undefined,
  [FhevmType.euint8]: "Uint8",
  [FhevmType.euint16]: "Uint16",
  [FhevmType.euint32]: "Uint32",
  [FhevmType.euint64]: "Uint64",
  [FhevmType.euint128]: "Uint128",
  [FhevmType.eaddress]: "Uint160",
  [FhevmType.euint256]: "Uint256",
};

export function getFheTypeName(fhevmType: FhevmType | number): FheTypeName {
  const name = FHEVM_TYPE_TO_FHE_TYPE_NAME[fhevmType as FhevmType];
  if (name === undefined) {
    throw new HardhatFhevmError(`No HCU price data for FHE type '${String(fhevmType)}'.`);
  }
  return name;
}
