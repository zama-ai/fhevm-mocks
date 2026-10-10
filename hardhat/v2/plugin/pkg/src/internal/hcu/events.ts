/**
 * Every event `FHEVMExecutor` emits.
 *
 * Mirrors the declarations in the host contracts' `FHEEvents.sol` — verified against
 * `<host-contracts-cleartext>/pkg/src/contracts/FHEEvents.sol` and the shipped
 * `abi/CleartextFHEVMExecutor.json`. `FheMulDiv` is emitted from the 0.14 protocol line on; an
 * executor without it simply never produces one.
 *
 * This is the *event* vocabulary, used to recognize coprocessor logs. It is deliberately NOT the
 * same thing as the set of operators HCU can price: `HCUOperatorName` is derived from
 * `HCUByOperator`'s own keys, and three of these events (`VerifyInput`, `FheSum`, `FheIsIn`) have no
 * price entry.
 */
export type CoprocessorOperatorEventName =
  | 'TrivialEncrypt'
  | 'FheAdd'
  | 'FheSub'
  | 'FheMul'
  | 'FheDiv'
  | 'FheRem'
  | 'FheBitAnd'
  | 'FheBitOr'
  | 'FheBitXor'
  | 'FheShl'
  | 'FheShr'
  | 'FheRotl'
  | 'FheRotr'
  | 'FheEq'
  | 'FheNe'
  | 'FheGe'
  | 'FheGt'
  | 'FheLe'
  | 'FheLt'
  | 'FheMin'
  | 'FheMax'
  | 'FheRand'
  | 'FheRandBounded'
  | 'FheNot'
  | 'FheNeg'
  | 'Cast'
  | 'FheIfThenElse'
  | 'FheSum'
  | 'FheIsIn'
  | 'FheMulDiv';

export type CoprocessorEventName = CoprocessorOperatorEventName | 'VerifyInput';

const OPERATOR_EVENT_NAMES: ReadonlySet<string> = new Set<CoprocessorEventName>([
  'TrivialEncrypt',
  'FheAdd',
  'FheSub',
  'FheMul',
  'FheDiv',
  'FheRem',
  'FheBitAnd',
  'FheBitOr',
  'FheBitXor',
  'FheShl',
  'FheShr',
  'FheRotl',
  'FheRotr',
  'FheEq',
  'FheNe',
  'FheGe',
  'FheGt',
  'FheLe',
  'FheLt',
  'FheMin',
  'FheMax',
  'FheRand',
  'FheRandBounded',
  'FheNot',
  'FheNeg',
  'Cast',
  'FheIfThenElse',
  'VerifyInput',
  'FheSum',
  'FheIsIn',
  'FheMulDiv',
]);

export function isCoprocessorEventName(value: unknown): value is CoprocessorEventName {
  return typeof value === 'string' && OPERATOR_EVENT_NAMES.has(value);
}
