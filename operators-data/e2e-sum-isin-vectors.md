# sum, isIn: vectors extracted from the fhevm e2e suite

Every numeric case the upstream end-to-end suite runs for `FHE.sum` and `FHE.isIn`, with its inputs and
expected result, taken as written. These are raw data for the vector generator
(`scripts/gen-op-cases.py`), not vector files yet.

## Source

| | |
|---|---|
| Repository | `zama-ai/fhevm`, `main` at `eb6178821` (2026-09-25) |
| Test file | `test-suite/e2e/test/fhevmOperations/manual.ts`, last changed `8f1806550` (2026-08-27) |
| Contract | `test-suite/e2e/contracts/operations/FHEVMManualTestSuite.sol`, last changed `075ad5e80` (2026-08-12) |

No other file under `test-suite/e2e` calls these two operators. The numbered `fhevmOperations*.ts` files and the
`operatorEdgeCases*.ts` files do not cover them.

Some operands come from the TypeScript side (encrypted inputs) and some are hardcoded in the contract
(`FHE.asEuintN(...)` trivial encryptions). The tables below merge both. The **Source** column says where each case
reads its data: `ts` means all inputs are in `manual.ts`, `sol` means all are in the contract, `ts+sol` means the value
comes from TypeScript and the set from Solidity.

"Uninitialized" means a Solidity variable of type `euintN` that was never assigned, which is the zero handle. Upstream
asserts that the coprocessor reads it as the value 0.

## sum

Signature: `FHE.sum(euintN[] values) -> euintN`, N in {8, 16, 32, 64, 128}. The result wraps at N bits.

| # | Width | Values | Expected | Source | Contract function | Note |
|---|---|---|---|---|---|---|
| S1 | 16 | [1000, 2000] | 3000 | ts | `test_sum_euint16` | |
| S2 | 32 | [100000, 200000] | 300000 | ts | `test_sum_euint32` | |
| S3 | 8 | [10, 20, 30] | 60 | ts | `test_sum_euint8` | |
| S4 | 64 | [1000000, 2000000] | 3000000 | ts | `test_sum_euint64` | |
| S5 | 128 | [100000000000000000000, 200000000000000000000] | 300000000000000000000 | ts | `test_sum_euint128` | 1e20 + 2e20 |
| S6 | 8 | [7, 7] | 14 | ts+sol | `test_sum_euint8_duplicate` | the same handle twice, counted twice |
| S7 | 8 | [5, uninitialized] | 5 | sol | `test_sum_euint8_uninitialized` | zero handle read as 0 |
| S8 | 8 | [] | 0 | sol | `test_sum_euint8_empty` | empty array |
| S9 | 8 | [42] | 42 | ts | `test_sum_euint8_single` | also asserts the result handle differs from the input handle |
| S10 | 8 | 100 × [1] | 100 | sol | `test_sum_euint8_max_array` | 100 is the narrow-type collection maximum |

## isIn

Signature: `FHE.isIn(T value, T[] set) -> ebool`, T in {euint8, euint16, euint32, euint64, euint128, eaddress,
euint256}.

| # | Width | Value | Set | Expected | Source | Contract function | Note |
|---|---|---|---|---|---|---|---|
| I1 | 8 | 20 | [10, 20, 30] | true | ts+sol | `test_isIn_euint8_found` | |
| I2 | 8 | 99 | [10, 20, 30] | false | ts+sol | `test_isIn_euint8_not_found` | |
| I3 | 16 | 1000 | [1000, 2000] | true | ts+sol | `test_isIn_euint16` | |
| I4 | 32 | 100000 | [100000, 200000] | true | ts+sol | `test_isIn_euint32` | |
| I5 | 64 | 1000000000 | [1000000000, 2000000000] | true | ts+sol | `test_isIn_euint64` | |
| I6 | 128 | 10000000000000000000 | [10000000000000000000, 20000000000000000000] | true | ts+sol | `test_isIn_euint128` | 1e19, 2e19 |
| I7 | 8 | uninitialized | [0, 1] | true | sol | `test_isIn_euint8_uninitialized` | zero handle read as 0 |
| I8 | 8 | 42 | [42] | true | ts+sol | `test_isIn_euint8_single_element` | |
| I9 | 8 | 50 | [0, 1, 2, …, 99] | true | sol | `test_isIn_euint8_max_array` | set[i] = i for i in 0..99; 100 is the narrow-type maximum |
| I10 | 8 | 42 | [] | false | sol | `test_isIn_euint8_empty_set` | empty set |
| I11 | 8 | 0 | [0, 0, 0] | true | sol | `test_isIn_euint8_zero_initialized_set` | all elements equal to the value |
| I12 | 8 | 255 | [0, 128, 255] | true | sol | `test_isIn_euint8_max_value_found` | type maximum, last position |
| I13 | 8 | 99 | [42] | false | sol | `test_isIn_euint8_single_element_not_found` | |
| I14 | 160 | 0x2222222222222222222222222222222222222222 | [0x1111…1111, 0x2222…2222, 0x3333…3333] | true | ts+sol | `test_isIn_eaddress_found` | eaddress; each set entry is that digit repeated 40 times |
| I15 | 160 | 0x4444444444444444444444444444444444444444 | [0x1111…1111, 0x2222…2222] | false | ts+sol | `test_isIn_eaddress_not_found` | eaddress |
| I16 | 256 | 42 | [1, 42, 100] | true | ts+sol | `test_isIn_euint256_found` | |
| I17 | 256 | 99 | [1, 2] | false | ts+sol | `test_isIn_euint256_not_found` | |

## What upstream does not cover

These gaps matter when turning the cases above into a generated vector set:

- **No wrapping for sum.** Every expected sum fits in its type. Nothing checks that a sum overflowing N bits wraps.
- **No wide collections.** The only maximum-size sets are 8-bit (S10, I9). The 60-element cap for 64-bit and wider
  types is never exercised.
- **Values stay small.** Apart from I12, no case uses a type maximum, and none for widths above 8.
- **No 160-bit or 256-bit sum.** This matches the executor, which rejects those types.
- **The uninitialized cases (S7, I7) are a handle property, not a value.** In a vector file they reduce to the value 0,
  which is already covered elsewhere.

## sum: coprocessor operand-validation unit tests

Source: `coprocessor/fhevm-engine/fhevm-engine-common/src/tfhe_ops.rs`, module `fhe_sum_tests`, at `eb6178821`.

These tests exercise `check_fhe_operand_types` for the `FheSum` opcode (28) only. They never encrypt or sum
anything, so they yield no numeric vectors: each case is an operand-shape check that either passes or fails
validation. Handles are 32 zero bytes with the FHE type byte at index 30. Every operand is non-scalar unless the
**Scalar flags** column says otherwise.

| Test | Operand count | Type byte(s) | Scalar flags | Expected |
|---|---|---|---|---|
| `fhe_sum_op_type_is_other` | n/a | n/a | n/a | op_type is `Other` |
| `fhe_sum_try_from_i16_roundtrip` | n/a | n/a | n/a | 28 converts to `FheSum` and back to 28 |
| `fhe_sum_check_operand_types_empty_is_ok` | 0 | none | none | ok |
| `fhe_sum_check_operand_types_single_input` | 1 | 2 (Uint8) | false | ok |
| `fhe_sum_check_operand_types_single_input` | 1 | 5 (Uint64) | false | ok |
| `fhe_sum_check_operand_types_too_many_inputs` | 101 | 2 (Uint8) | all false | error |
| `fhe_sum_check_operand_types_too_many_inputs` | 61 | 5 (Uint64) | all false | error |
| `fhe_sum_check_operand_types_too_many_inputs` | 61 | 6 (Uint128) | all false | error |
| `fhe_sum_check_operand_types_valid_bounds` | 2 | 2 (Uint8) | all false | ok |
| `fhe_sum_check_operand_types_valid_bounds` | 100 | 2 (Uint8) | all false | ok |
| `fhe_sum_check_operand_types_valid_bounds` | 60 | 5 (Uint64) | all false | ok |
| `fhe_sum_check_operand_types_valid_bounds` | 60 | 6 (Uint128) | all false | ok |
| `fhe_sum_rejects_scalar_input` | 3 | 0, 0, 0 (all-zero handles) | false, true, false | error |
| `fhe_sum_scalar_not_supported` | n/a | n/a | n/a | scalar unsupported, no multi-scalar |
| `fhe_sum_check_operand_types_mismatched_types` | 2 | 2 (Uint8), 3 (Uint16) | false, false | error |

Gaps in this module: type bytes 3 and 4 (Uint16, Uint32) never appear at their 100-operand cap, and the
unsupported types 7 and 8 (Uint160, Uint256) are never checked, although the validator rejects them explicitly.

The only end-to-end sum test in the coprocessor is `test_fhe_sum_events` in
`coprocessor/fhevm-engine/tfhe-worker/src/tests/operators_from_events.rs`: for each type 2 to 6 it sums trivial
encryptions of 5 and 7 and expects 12. That single case is already subsumed by the e2e `sum` table above.

## isIn: coprocessor operand-validation unit tests

Source: `coprocessor/fhevm-engine/fhevm-engine-common/src/tfhe_ops.rs`, module `fhe_is_in_tests`, at `eb6178821`.

These tests exercise `check_fhe_operand_types` for the `FheIsIn` opcode (29) only, so they yield no numeric
vectors. Operands are `[value, set elements...]`, all expected to be ciphertext handles of the same type; the
operator has no scalar form. Handles are 32 zero bytes with the FHE type byte at index 30. The set-size caps are
the same as for sum: 100 elements for Uint8 to Uint32, 60 for Uint64 and wider.

| Test | Value type | Set elements | Scalar flags | Expected |
|---|---|---|---|---|
| `fhe_is_in_op_type_is_other` | n/a | n/a | n/a | op_type is `Other` |
| `fhe_is_in_try_from_i16_roundtrip` | n/a | n/a | n/a | 29 converts to `FheIsIn` |
| `fhe_is_in_does_not_have_more_than_one_scalar` | n/a | n/a | n/a | no multi-scalar |
| `fhe_is_in_scalar_not_directly_supported` | n/a | n/a | n/a | scalar unsupported |
| `fhe_is_in_valid_single_element_set` | 2 (Uint8) | 1 × type 2 | false, false | ok |
| `fhe_is_in_valid_multi_element_set` | 5 (Uint64) | 10 × type 5 | all false | ok |
| `fhe_is_in_rejects_empty_inputs` | none | none | none | error |
| `fhe_is_in_accepts_single_ciphertext_empty_set` | 2 (Uint8) | 0 | false | ok (execution returns trivial false) |
| `fhe_is_in_rejects_first_operand_as_scalar` | scalar 5 (8-byte BE) | 1 × type 2 | true, false | error |
| `fhe_is_in_rejects_any_operand_as_scalar` | 2 (Uint8) | scalar 42 (8-byte BE) | false, true | error |
| `fhe_is_in_rejects_unsupported_type_ebytes128` | 9 (EBytes128) | 1 × type 9 | false, false | error |
| `fhe_is_in_rejects_too_many_set_elements_narrow` | 2 (Uint8) | 101 × type 2 | all false | error |
| `fhe_is_in_rejects_too_many_set_elements_wide` | 5 (Uint64) | 61 × type 5 | all false | error |
| `fhe_is_in_accepts_max_set_size_narrow` | 2 (Uint8) | 100 × type 2 | all false | ok |
| `fhe_is_in_accepts_max_set_size_wide` | 5 (Uint64) | 60 × type 5 | all false | ok |
| `fhe_is_in_supported_types_uint8_through_uint256` | 2 to 8, one case each | 1 × same type | false, false | ok |
| `fhe_is_in_rejects_mixed_type_set_elements` | 2 (Uint8) | 1 × type 4 (Uint32) | false, false | error |

Gaps in this module: types 0 and 1 (Bool, Uint4) are never checked for rejection, the 60-element cap is only
exercised for Uint64 and not for Uint128 to Uint256, and a mixed set where the second element differs from the
first is never tried, only a mismatch between the value and the single element.

The only end-to-end isIn test in the coprocessor is `test_fhe_is_in_events` in
`coprocessor/fhevm-engine/tfhe-worker/src/tests/operators_from_events.rs`. Its cases are not extracted here.
