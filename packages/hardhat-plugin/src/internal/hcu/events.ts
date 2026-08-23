/**
 * The `FHEVMExecutor` operator events HCU is priced from.
 *
 * Ported from `@fhevm/mock-utils`. Unchanged in v13: the cleartext executor emits the same set (plus
 * `FheIsIn` and `FheSum`, which have no entry in `operatorsPrices.json` yet — see the migration plan).
 */
export type CoprocessorOperatorEventName =
  | "TrivialEncrypt"
  | "FheAdd"
  | "FheSub"
  | "FheMul"
  | "FheDiv"
  | "FheRem"
  | "FheBitAnd"
  | "FheBitOr"
  | "FheBitXor"
  | "FheShl"
  | "FheShr"
  | "FheRotl"
  | "FheRotr"
  | "FheEq"
  | "FheNe"
  | "FheGe"
  | "FheGt"
  | "FheLe"
  | "FheLt"
  | "FheMin"
  | "FheMax"
  | "FheRand"
  | "FheRandBounded"
  | "FheNot"
  | "FheNeg"
  | "Cast"
  | "FheIfThenElse";

export type CoprocessorEventName = CoprocessorOperatorEventName | "VerifyInput";

const OPERATOR_EVENT_NAMES: ReadonlySet<string> = new Set<CoprocessorEventName>([
  "TrivialEncrypt", "FheAdd", "FheSub", "FheMul", "FheDiv", "FheRem",
  "FheBitAnd", "FheBitOr", "FheBitXor", "FheShl", "FheShr", "FheRotl", "FheRotr",
  "FheEq", "FheNe", "FheGe", "FheGt", "FheLe", "FheLt", "FheMin", "FheMax",
  "FheRand", "FheRandBounded", "FheNot", "FheNeg", "Cast", "FheIfThenElse", "VerifyInput",
]);

export function isCoprocessorEventName(value: unknown): value is CoprocessorEventName {
  return typeof value === "string" && OPERATOR_EVENT_NAMES.has(value);
}
