// THE SHORT VERSION
//
// solc puts an address either INLINE in the code, or once in a shared table at the end of it.
// Table entries are laid out BY VALUE, so different addresses can come out in a different ORDER.
// Patching overwrites values where they already are and never reorders — so a table holding two or
// more patched addresses can end up with them in each other's slots.
//
//
// PICTURES
//
// INLINE — the address is an operand, sitting in the instruction stream:
//
//       ...  73  50157cff .... 755d   5b  60 40  ...
//            ^^  ^^^^^^^^^^^^^^^^^^
//            |   the 20 address bytes
//            PUSH20
//
//   Patching overwrites those 20 bytes. Nothing moves, nothing else refers to them. Always exact.
//
// POOLED — the address is stored ONCE in a table at the end, and the code reaches it by offset:
//
//       code                                    table (end of the runtime code)
//       ...  61 5cf3  83 39  ...                ┌────────┬────────────────────────┐
//            ^^ ^^^^                     ┌─────▶│ 0x5cf3 │ 233ff88a … 32d9        │
//            |  offset  ─────────────────┘      ├────────┼────────────────────────┤
//            PUSH2                              │ 0x5d13 │ 50157cff … 755d        │
//                                               └────────┴────────────────────────┘
//
//   Patching still overwrites the 20 bytes in a slot. But WHICH slot a given address gets is decided
//   by the compiler from the values, and the offsets in the code are baked to match that decision.
//
// THE FAILURE, AS IT ACTUALLY HAPPENED
//
//   markers:  ACL 0x4493…  vs  HCU 0xffBB…        table order:  [ HCU ][ ACL ]
//   real:     ACL 0x5015…  vs  HCU 0x233f…        table order:  [ ACL ][ HCU ]   <-- flipped
//                                                                  ^^^^^^^^^^
//   The relative order of the two values reverses, so the compiler emits the slots the other way
//   round. Patching keeps the marker build's layout and writes ACL's real value into the slot the
//   code reads as HCU. Every PUSH2 offset pointing past that pair is then 32 bytes off — one slot.
//
//
// THE LONGER EXPLANATION
//
// This package compiles each contract ONCE against placeholder addresses ("markers"), commits that as
// a template, and patches the real addresses in at deploy time. That works because substitution is
// length-preserving: 20 bytes become 20 bytes, no code moves, every jump destination and offset in the
// artifact stays valid. The EVM checks nothing about code layout, so a patched artifact runs correctly.
//
// What patching cannot do is reproduce, byte for byte, what solc emits when compiling with those
// addresses directly — because the layout is not invariant under substitution. Inline operands are
// invariant: an address is just an operand, and where it sits does not depend on what it is. Pooled
// constants are not: they live in a table whose ORDER is a function of the values, and a patcher
// rewriting values in place has no way to also reorder a table and fix the offsets that point into it.
//
// The precise rule, and it is a sharp one:
//
//   - a contract whose patched addresses are ALL inline          -> patching == compiling, always
//   - a contract with exactly ONE pooled patched address         -> patching == compiling
//     (a one-entry table has only one possible order)
//   - a contract with TWO OR MORE pooled patched addresses       -> the table CAN be reordered, and
//     patching then differs from compiling
//
// The last case is not a correctness bug. The patched artifact is internally consistent: its own
// offsets point at the slots its own patcher filled, so it deploys and runs correctly. It is only not
// byte-identical to a direct compile — which matters for anything defined over exact bytes, such as a
// CREATE2 address or a source-verification match.
//
// WHY THIS APPEARED IN v14 AND NOT BEFORE
//
// In v13, `CleartextFHEVMExecutor` referenced ACL and HCULimit as inline operands at 60 sites each.
// v14 restructured those reads, and solc moved both into the pool — the patch-site counts fell from 60
// to 2, which is the visible trace of exactly this change. That is why `internal/placeholders/
// patch-sites.json` is worth keeping: a large count collapsing is the signal that an address changed
// how it is stored.
//
// HOW A SITE IS CLASSIFIED
//
// An inline site is preceded by the PUSH20 opcode, 0x73 — that is what makes the following 20 bytes an
// operand. A pooled site is raw table data with no opcode in front of it. Reading the byte before the
// site therefore separates the two exactly, with no need to model anything else about solc's output.

import type { AddressName } from './constants.ts';

////////////////////////////////////////////////////////////////////////////////

/** The `PUSH20` opcode. An address operand is exactly these 20 bytes preceded by it. */
const PUSH20_OPCODE = '73';

/** How many of a contract's sites for one address are inline operands, and how many are table data. */
export type SiteClassification = {
  readonly immediate: number;
  readonly pooled: number;
};

/**
 * Split one address's patch sites into inline operands and pooled table entries.
 *
 * `bytecode` is hex WITHOUT the `0x` prefix; `byteOffsets` are the template's recorded sites for one
 * address in that same field. A site at offset 0 cannot be an operand — there is no preceding byte to
 * be the opcode — so it counts as pooled, which is also the safe way to be wrong.
 */
export function classifyAddressSites(bytecode: string, byteOffsets: readonly number[]): SiteClassification {
  let immediate = 0;
  let pooled = 0;

  for (const offset of byteOffsets) {
    const previous = offset === 0 ? '' : bytecode.slice((offset - 1) * 2, offset * 2).toLowerCase();
    if (previous === PUSH20_OPCODE) immediate++;
    else pooled++;
  }

  return { immediate, pooled };
}

/**
 * Whether a contract's pool can be reordered by substitution, from its per-address pooled counts.
 *
 * Two or more pooled addresses is the whole condition: a table with one patched entry has only one
 * possible order, so nothing can permute.
 */
export function canPoolReorder(pooledCountsByAddress: Readonly<Partial<Record<AddressName, number>>>): boolean {
  const pooled = Object.values(pooledCountsByAddress).filter((count) => count > 0);
  return pooled.length >= 2;
}

/**
 * Every pooled patch site in the stack, as measured. The committed expectation.
 *
 * Deliberately spelled out here rather than kept as a generated JSON blob: this table is small, it
 * changes only when the compiler changes how an address is stored, and when it does change the reader
 * needs the explanation above — which is right here. A diff to these three numbers is a review event.
 *
 * Anything not listed has no pooled sites at all: its addresses are inline operands, and patching it
 * reproduces a direct compile exactly.
 */
export const EXPECTED_POOLED_SITES: Readonly<Record<string, Readonly<Partial<Record<AddressName, number>>>>> = {
  // Two pooled addresses — the one contract in the stack whose table can be reordered.
  CleartextFHEVMExecutor: { ACL_ADDRESS: 1, HCU_LIMIT_ADDRESS: 1 },
  // One pooled address, so its table has nothing to permute.
  HCULimit: { FHEVM_EXECUTOR_ADDRESS: 1 },
};

/**
 * Contracts whose patched bytecode is NOT expected to equal a direct compile, with the reason.
 *
 * Derived from the rule rather than asserted independently: a test checks this list is exactly the set
 * of contracts with two or more pooled addresses, so it cannot quietly grow to hide a new failure.
 */
export const POOL_REORDER_EXEMPT: Readonly<Record<string, string>> = {
  CleartextFHEVMExecutor:
    'Pools ACL_ADDRESS and HCU_LIMIT_ADDRESS. Their relative order under the markers is the reverse of ' +
    'their relative order under the real localhost addresses, so the compiler emits the two table slots ' +
    'swapped and patching cannot reorder them.',
};
