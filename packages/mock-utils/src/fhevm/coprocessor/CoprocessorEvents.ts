export type CoprocessorEventName =
  | "VerifyCiphertext"
  | "TrivialEncrypt"
  | "TrivialEncryptBytes"
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
  | "FheEqBytes"
  | "FheNe"
  | "FheNeBytes"
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

/**
 * Coprocessor Solidity event emitted by a
 * [`FHEVMExecutor.sol`](https://github.com/zama-ai/fhevm-backend/blob/main/contracts/contracts/FHEVMExecutor.sol)
 * contract from `@fhevm/core-contracts`.
 */
export type CoprocessorEvent = {
  eventName: CoprocessorEventName;
  args: object;
  index: number;
  blockNumber: number;
  transactionHash: string;
  transactionIndex: number;
};

export function isCoprocessorEventName(value: unknown): value is CoprocessorEventName {
  return (
    value === "VerifyCiphertext" ||
    value === "TrivialEncrypt" ||
    value === "TrivialEncryptBytes" ||
    value === "FheAdd" ||
    value === "FheSub" ||
    value === "FheMul" ||
    value === "FheDiv" ||
    value === "FheRem" ||
    value === "FheBitAnd" ||
    value === "FheBitOr" ||
    value === "FheBitXor" ||
    value === "FheShl" ||
    value === "FheShr" ||
    value === "FheRotl" ||
    value === "FheRotr" ||
    value === "FheEq" ||
    value === "FheEqBytes" ||
    value === "FheNe" ||
    value === "FheNeBytes" ||
    value === "FheGe" ||
    value === "FheGt" ||
    value === "FheLe" ||
    value === "FheLt" ||
    value === "FheMin" ||
    value === "FheMax" ||
    value === "FheRand" ||
    value === "FheRandBounded" ||
    value === "FheNot" ||
    value === "FheNeg" ||
    value === "Cast" ||
    value === "FheIfThenElse"
  );
}
