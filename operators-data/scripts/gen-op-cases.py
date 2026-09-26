#!/usr/bin/env python3
"""Generate language-agnostic numeric test vectors for FHE operators.

    scripts/gen-op-cases.py add                    # -> data/add/{index,128.normal,128.edge,...}.json
    scripts/gen-op-cases.py shl:amount-mod-width   # -> data/shl.amount-mod-width/
    scripts/gen-op-cases.py sum                    # -> data/sum/  (also isin, muldiv: see NARY_OPS)
    scripts/gen-op-cases.py add /tmp/scratch/add   # -> anywhere, when given a second argument

The default output directory is resolved against this repository, not the caller's working
directory, so the operator's real data is rewritten from wherever the script is invoked.

One file per (widest-operand width, normal|edge), plus index.json listing the parts.
"verified" lists the tfhe-rs versions that confirmed a part (written by tfhe-vectors-check);
it is preserved across regeneration while the part's cases are unchanged.

Every value is a 0x-prefixed hex string: 128-bit integers do not fit in a JSON number.
"""
import json
import os
import sys

BITS = [8, 16, 32, 64, 128]

SMALL_A, SMALL_B = 100, 23
NARROW = 7


def mask(bits):
    return (1 << bits) - 1


def add_scenarios(lb, rb):
    w = max(lb, rb)
    m = mask(w)
    rows = [
        ("plain", SMALL_A, SMALL_B),
        ("zero_zero", 0, 0),
        ("plus_zero", SMALL_A, 0),
        ("zero_plus", 0, SMALL_A),
        ("max_plus_zero", m, 0),
        ("max_minus_1_plus_zero", m - 1, 0),
        ("max", m - NARROW, NARROW),
        ("max_minus_1", m - NARROW - 1, NARROW),
        ("both_max", m, mask(min(lb, rb))),
        ("carry_top_bit", (1 << (w - 1)) - 1, 1),
        ("wrap_to_0", m, 1),
        ("wrap_past_0", m, NARROW),
    ]
    # The big value goes on the wider operand, whichever side it is.
    return [(n, big, small) if lb >= rb else (n, small, big) for n, big, small in rows]


def sub_scenarios(lb, rb):
    ml, mr = mask(lb), mask(rb)
    shared_max_minus_1 = mask(min(lb, rb)) - 1
    return [
        ("plain", SMALL_A, SMALL_B),
        ("zero_zero", 0, 0),
        ("minus_zero", SMALL_A, 0),
        ("zero", NARROW, NARROW),
        ("lhs_max", ml, NARROW),
        ("lhs_max_minus_zero", ml, 0),
        ("lhs_max_minus_1_minus_zero", ml - 1, 0),
        ("rhs_max", NARROW, mr),
        ("zero_minus_rhs_max", 0, mr),
        ("both_max", ml, mr),
        ("both_max_minus_1", shared_max_minus_1, shared_max_minus_1),
        ("lhs_max_minus_1", ml, 1),
        ("lhs_top_bit", 1 << (lb - 1), 1),
        ("to_max", 0, 1),
        ("to_max_minus_1", 0, 2),
        ("wrap_past_max", 0, NARROW),
    ]


# Shift/rotate: the value is euint8..euint256, the amount is always 8 bits.
SHIFT_BITS = [8, 16, 32, 64, 128, 256]
AMOUNT_BITS = 8


def pattern(w):
    return int("a5" * max(w // 8, 1), 16) & mask(w)


def shift_scenarios(lb, rb):
    w = lb
    m, top, p = mask(w), 1 << (w - 1), pattern(w)
    rows = [
        ("zero_by_zero", 0, 0),
        ("by_zero", SMALL_A, 0),
        ("max_by_zero", m, 0),
        ("one_by_one", 1, 1),
        ("two_by_one", 2, 1),
        ("max_by_one", m, 1),
        ("top_bit_by_one", top, 1),
        ("one_by_w_minus_1", 1, w - 1),
        ("top_bit_by_w_minus_1", top, w - 1),
        ("max_by_w_minus_1", m, w - 1),
        ("pattern_by_3", p, 3),
        ("pattern_by_4", p, 4),
        ("pattern_by_half", p, w // 2),
        ("one_by_w", 1, w),
        ("top_bit_by_w", top, w),
        ("max_by_w", m, w),
        ("max_by_w_plus_1", m, w + 1),
        ("max_by_255", m, 255),
        ("pattern_by_255", p, 255),
    ]
    return [(n, a, b) for n, a, b in rows if b <= mask(rb)]


# tfhe-rs >= 1.7: amount >= width gives 0. tfhe-rs <= 1.6: amount is reduced mod width.
def shl(a, b, m):
    w = m.bit_length()
    return 0 if b >= w else (a << b) & m


def shr(a, b, m):
    w = m.bit_length()
    return 0 if b >= w else a >> b


def shl_mod(a, b, m):
    return (a << (b % m.bit_length())) & m


def shr_mod(a, b, m):
    return a >> (b % m.bit_length())


def rotl(a, b, m):
    w = m.bit_length()
    b %= w
    return ((a << b) | (a >> (w - b))) & m


def rotr(a, b, m):
    w = m.bit_length()
    b %= w
    return ((a >> b) | (a << (w - b))) & m


# "Normal" values sized to a given width: every byte set, well inside the range.
def mid_hi(w):
    return int("6b" * (w // 8), 16)


def mid_lo(w):
    return int("2d" * (w // 8), 16)


def minmax_scenarios(lb, rb):
    ml, mr = mask(lb), mask(rb)
    n = min(lb, rb)
    mn, tn = mask(n), 1 << (n - 1)
    rows = [
        ("equal", NARROW, NARROW),
        ("zero_zero", 0, 0),
        ("zero_vs_small", 0, SMALL_A),
        ("small_vs_zero", SMALL_A, 0),
        ("small_vs_smaller", SMALL_A, SMALL_B),
        ("smaller_vs_small", SMALL_B, SMALL_A),
        # Each operand holds a value sized to its own width.
        ("mid_vs_mid", mid_hi(lb), mid_lo(rb)),
        ("mid_vs_mid_reversed", mid_lo(lb), mid_hi(rb)),
        ("lhs_max_vs_rhs_max", ml, mr),
        ("zero_vs_rhs_max", 0, mr),
        ("lhs_max_vs_zero", ml, 0),
        ("narrow_max_vs_off_by_one", mn, mn - 1),
        ("off_by_one_vs_narrow_max", mn - 1, mn),
        ("top_bit_vs_top_bit_minus_1", tn, tn - 1),
        ("top_bit_minus_1_vs_top_bit", tn - 1, tn),
    ]
    if lb != rb:
        # Same low bits, the wider operand has one more bit set above them.
        wide = mn | (1 << n)
        rows.append(("same_low_bits", mn, wide) if lb < rb else ("same_low_bits", wide, mn))
        # The wide operand holds an ordinary narrow-range value, above and below the narrow one.
        gt, lt = (mid_lo(n), mid_hi(n)), (mid_hi(n), mid_lo(n))
        rows.append(("wide_in_narrow_range_gt", *gt) if lb < rb else ("wide_in_narrow_range_gt", *lt))
        rows.append(("wide_in_narrow_range_lt", *lt) if lb < rb else ("wide_in_narrow_range_lt", *gt))
    # Each operand holds a value from any rung of the size ladder up to its own width.
    # Equal rungs are already covered by mid_vs_mid / mid_vs_mid_reversed.
    for wa in BITS:
        for wb in BITS:
            if wa <= lb and wb <= rb and wa != wb:
                rows.append((f"sized_{wa}_vs_sized_{wb}", mid_hi(wa), mid_lo(wb)))
    return rows


# eq: euint pairs in every width combination, plus ebool x ebool and eaddress x eaddress.
EQ_BITS = [8, 16, 32, 64, 128, 256]
BOOL_BITS, ADDRESS_BITS = 1, 160


def eq_scenarios(lb, rb):
    ml, mr = mask(lb), mask(rb)
    n = min(lb, rb)
    mn, tn = mask(n), 1 << (n - 1)
    rows = [
        ("zero_zero", 0, 0),
        ("one_one", 1, 1),
        ("one_zero", 1, 0),
        ("zero_one", 0, 1),
        ("equal_small", SMALL_A, SMALL_A),
        ("not_equal_small", SMALL_A, SMALL_B),
        ("equal_narrow_max", mn, mn),
        ("lhs_max_vs_rhs_max", ml, mr),
        ("narrow_max_vs_off_by_one", mn, mn - 1),
        ("equal_top_bit", tn, tn),
        ("top_bit_vs_top_bit_minus_1", tn, tn - 1),
    ]
    if lb != rb:
        wide = mn | (1 << n)
        rows.append(("same_low_bits", mn, wide) if lb < rb else ("same_low_bits", wide, mn))
    seen, out = set(), []
    for name, a, b in rows:
        if a <= ml and b <= mr and (a, b) not in seen:
            seen.add((a, b))
            out.append((name, a, b))
    return out


# and/or/xor: euint pairs in every width combination, plus ebool x ebool.
def bitwise_scenarios(lb, rb):
    ml, mr = mask(lb), mask(rb)
    n = min(lb, rb)
    mn, tn, pn = mask(n), 1 << (n - 1), pattern(n)
    rows = [
        ("zero_zero", 0, 0),
        ("one_one", 1, 1),
        ("one_zero", 1, 0),
        ("zero_one", 0, 1),
        ("small_small", SMALL_A, SMALL_B),
        ("zero_vs_rhs_max", 0, mr),
        ("lhs_max_vs_zero", ml, 0),
        ("lhs_max_vs_rhs_max", ml, mr),
        ("narrow_max_vs_narrow_max", mn, mn),
        ("pattern_pattern", pn, pn),
        ("pattern_vs_inverse", pn, pn ^ mn),
        ("pattern_vs_zero", pn, 0),
        ("pattern_vs_narrow_max", pn, mn),
        ("top_bit_top_bit", tn, tn),
        ("top_bit_vs_one", tn, 1),
        ("top_bit_vs_narrow_max", tn, mn),
    ]
    if lb != rb:
        # Same low bits, the wider operand has one more bit set above them.
        wide = mn | (1 << n)
        rows.append(("same_low_bits", mn, wide) if lb < rb else ("same_low_bits", wide, mn))
        rows.append(("narrow_max_vs_wide_max", mn, mr) if lb < rb else ("narrow_max_vs_wide_max", ml, mn))
    seen, out = set(), []
    for name, a, b in rows:
        if a <= ml and b <= mr and (a, b) not in seen:
            seen.add((a, b))
            out.append((name, a, b))
    return out


# div/rem: euintN by a plaintext uintN, 8..128. tfhe-rs panics on a zero divisor and the
# protocol rejects it, so zero never appears as rhs.
DIV_PAIRS = [(w, w) for w in BITS]


def divrem_scenarios(lb, rb):
    w = lb
    m, top, p = mask(w), 1 << (w - 1), pattern(w)
    rows = [
        ("zero_by_one", 0, 1),
        ("zero_by_small", 0, SMALL_B),
        ("small_by_one", SMALL_A, 1),
        ("small_by_small", SMALL_A, SMALL_B),
        ("small_by_larger", SMALL_B, SMALL_A),
        ("equal", NARROW, NARROW),
        ("one_by_max", 1, m),
        ("max_by_one", m, 1),
        ("max_by_two", m, 2),
        ("max_by_small", m, SMALL_B),
        ("max_by_top_bit", m, top),
        ("max_by_max_minus_1", m, m - 1),
        ("max_by_max", m, m),
        ("max_minus_1_by_max", m - 1, m),
        ("top_bit_by_two", top, 2),
        ("top_bit_by_three", top, 3),
        ("top_bit_by_top_bit", top, top),
        ("mid_by_top_bit", mid_lo(w), top),
        ("pattern_by_small", p, SMALL_B),
        ("pattern_by_255", p, 255),
        ("pattern_by_mid_lo", p, mid_lo(w)),
        ("mid_hi_by_mid_lo", mid_hi(w), mid_lo(w)),
        ("max_by_half_power_of_two", m, 1 << (w // 2)),
        ("pattern_by_half_power_of_two", p, 1 << (w // 2)),
    ]
    seen, out = set(), []
    for name, a, b in rows:
        if a <= m and 0 < b <= mask(rb) and (a, b) not in seen:
            seen.add((a, b))
            out.append((name, a, b))
    return out


# not: unary over ebool and euint8..euint256.
NOT_BITS = [1, 8, 16, 32, 64, 128, 256]


def not_scenarios(lb, _rb):
    m = mask(lb)
    rows = [
        ("zero", 0),
        ("one", 1),
        ("small", SMALL_A),
        ("max", m),
        ("max_minus_1", m - 1),
        ("top_bit", 1 << (lb - 1)),
        ("pattern", pattern(lb)),
    ]
    seen, out = set(), []
    for name, a in rows:
        if a <= m and a not in seen:
            seen.add(a)
            out.append((name, a, None))
    return out


# neg: unary two's-complement negation over euint8..euint256 (no ebool).
NEG_BITS = [8, 16, 32, 64, 128, 256]


def neg_scenarios(lb, _rb):
    m, top, half = mask(lb), 1 << (lb - 1), lb // 2
    rows = [
        ("zero", 0),
        ("one", 1),
        ("two", 2),
        ("small", SMALL_A),
        ("max", m),
        ("max_minus_1", m - 1),
        ("max_minus_small", m - SMALL_A),
        ("top_bit", top),
        ("top_bit_minus_1", top - 1),
        ("top_bit_plus_1", top + 1),
        ("low_half_max", mask(half)),
        ("low_half_carry", 1 << half),
        ("pattern", pattern(lb)),
        ("inverse_pattern", pattern(lb) ^ m),
        ("low_byte_zero", m ^ 0xff),
        ("only_low_byte", 0xff),
    ]
    seen, out = set(), []
    for name, a in rows:
        if a <= m and a not in seen:
            seen.add(a)
            out.append((name, a, None))
    return out


ARITH_PAIRS = [(lb, rb) for lb in BITS for rb in BITS]
SHIFT_PAIRS = [(w, AMOUNT_BITS) for w in SHIFT_BITS]
EQ_PAIRS = [(lb, rb) for lb in EQ_BITS for rb in EQ_BITS] + [(BOOL_BITS, BOOL_BITS), (ADDRESS_BITS, ADDRESS_BITS)]
NOT_PAIRS = [(w, None) for w in NOT_BITS]
NEG_PAIRS = [(w, None) for w in NEG_BITS]
BITWISE_PAIRS = [(lb, rb) for lb in EQ_BITS for rb in EQ_BITS] + [(BOOL_BITS, BOOL_BITS)]

WIDEST = lambda lb, rb: max(lb, rb)
LHS_WIDTH = lambda lb, rb: lb
BOOL = lambda lb, rb: BOOL_BITS

# op -> (formula(lhs, rhs, operand_mask), scenarios(lb, rb), semantics, (lb, rb) pairs, result_bits(lb, rb))
OPS = {
    "add": (lambda a, b, m: (a + b) & m, add_scenarios, "wrapping", ARITH_PAIRS, WIDEST),
    "sub": (lambda a, b, m: (a - b) & m, sub_scenarios, "wrapping", ARITH_PAIRS, WIDEST),
    "min": (lambda a, b, m: min(a, b), minmax_scenarios, "unsigned", ARITH_PAIRS, WIDEST),
    "div": (lambda a, b, m: a // b, divrem_scenarios, "unsigned-divisor-nonzero", DIV_PAIRS, WIDEST),
    "rem": (lambda a, b, m: a % b, divrem_scenarios, "unsigned-divisor-nonzero", DIV_PAIRS, WIDEST),
    "max": (lambda a, b, m: max(a, b), minmax_scenarios, "unsigned", ARITH_PAIRS, WIDEST),
    "eq": (lambda a, b, m: int(a == b), eq_scenarios, "boolean", EQ_PAIRS, BOOL),
    "ne": (lambda a, b, m: int(a != b), eq_scenarios, "boolean", EQ_PAIRS, BOOL),
    "lt": (lambda a, b, m: int(a < b), minmax_scenarios, "boolean", ARITH_PAIRS, BOOL),
    "le": (lambda a, b, m: int(a <= b), minmax_scenarios, "boolean", ARITH_PAIRS, BOOL),
    "gt": (lambda a, b, m: int(a > b), minmax_scenarios, "boolean", ARITH_PAIRS, BOOL),
    "ge": (lambda a, b, m: int(a >= b), minmax_scenarios, "boolean", ARITH_PAIRS, BOOL),
    "not": (lambda a, b, m: a ^ m, not_scenarios, "bitwise-complement", NOT_PAIRS, LHS_WIDTH),
    "neg": (lambda a, b, m: (-a) & m, neg_scenarios, "wrapping", NEG_PAIRS, LHS_WIDTH),
    "and": (lambda a, b, m: a & b, bitwise_scenarios, "bitwise", BITWISE_PAIRS, WIDEST),
    "or": (lambda a, b, m: a | b, bitwise_scenarios, "bitwise", BITWISE_PAIRS, WIDEST),
    "xor": (lambda a, b, m: a ^ b, bitwise_scenarios, "bitwise", BITWISE_PAIRS, WIDEST),
    "shl": (shl, shift_scenarios, "overshift-zero", SHIFT_PAIRS, WIDEST),
    "shr": (shr, shift_scenarios, "overshift-zero", SHIFT_PAIRS, WIDEST),
    "shl:amount-mod-width": (shl_mod, shift_scenarios, "amount-mod-width", SHIFT_PAIRS, WIDEST),
    "shr:amount-mod-width": (shr_mod, shift_scenarios, "amount-mod-width", SHIFT_PAIRS, WIDEST),
    "rotl": (rotl, shift_scenarios, "amount-mod-width", SHIFT_PAIRS, WIDEST),
    "rotr": (rotr, shift_scenarios, "amount-mod-width", SHIFT_PAIRS, WIDEST),
}


# Scenarios with ordinary or patterned values. Everything else (zero, one, max, top bit,
# equality, off-by-one, wrap, shift >= width, ...) is an edge case.
NORMAL_SCENARIOS = {
    "plain", "small", "two", "small_small", "small_by_small", "small_by_larger", "pattern_by_small",
    "pattern_by_mid_lo", "mid_hi_by_mid_lo", "top_bit_by_three", "small_vs_smaller", "smaller_vs_small", "not_equal_small",
    "mid_vs_mid", "mid_vs_mid_reversed", "wide_in_narrow_range_gt", "wide_in_narrow_range_lt",
    "pattern", "inverse_pattern", "pattern_pattern", "pattern_vs_inverse",
    "pattern_by_3", "pattern_by_4", "pattern_by_half",
}


def kind_of(case_id, op, lb, rb):
    prefix = f"{op}_{lb}_" if rb is None else f"{op}_{lb}_{rb}_"
    name = case_id[len(prefix):]
    return "normal" if name in NORMAL_SCENARIOS or name.startswith("sized_") else "edge"


def header_line(k, v):
    if isinstance(v, bool) or isinstance(v, int):
        return f'  "{k}": {json.dumps(v)},'
    if isinstance(v, list):
        return f'  "{k}": {json.dumps(v, separators=(", ", ": "))},'
    return f'  "{k}": "{v}",'


def operand_line(o):
    return f'{{ "bits": {o["bits"]}, "value": "{o["value"]}" }}'


def render(header, cases):
    lines = ["{"]
    for k, v in header.items():
        lines.append(header_line(k, v))
    lines.append('  "cases": [')
    for i, c in enumerate(cases):
        sep = "," if i < len(cases) - 1 else ""
        lines.append("    {")
        lines.append(f'      "id": "{c["id"]}",')
        keys = [k for k in ("lhs", "rhs", "divisor", "values", "result") if k in c]
        for k in keys:
            end = "," if k != "result" else ""
            if k == "values":
                # A collection operand: one element per line, `[]` when empty.
                if not c[k]:
                    lines.append(f'      "values": []{end}')
                    continue
                lines.append('      "values": [')
                for j, o in enumerate(c[k]):
                    lines.append(f"        {operand_line(o)}{',' if j < len(c[k]) - 1 else ''}")
                lines.append(f"      ]{end}")
            else:
                lines.append(f'      "{k}": {operand_line(c[k])}{end}')
        lines.append(f"    }}{sep}")
    lines.append("  ]\n}")
    return "\n".join(lines) + "\n"


def main(key, out_dir):
    if key in NARY_OPS:
        return main_nary(key, out_dir)
    f, scenarios, semantics, pairs, result_bits = OPS[key]
    op = key.split(":")[0]
    arity = 1 if all(rb is None for _, rb in pairs) else 2
    header = {"op": op, "arity": arity, "semantics": semantics, "encoding": "hex-string"}
    by_width = {}
    for lb, rb in pairs:
        width = max(lb, rb or 0)
        m = mask(width)
        for name, lhs, rhs in scenarios(lb, rb):
            case = {"id": f"{op}_{lb}_{name}" if rb is None else f"{op}_{lb}_{rb}_{name}"}
            case["lhs"] = {"bits": lb, "value": hex(lhs)}
            if rb is not None:
                case["rhs"] = {"bits": rb, "value": hex(rhs)}
            case["result"] = {"bits": result_bits(lb, rb), "value": hex(f(lhs, rhs, m))}
            kind = kind_of(case["id"], op, lb, rb)
            by_width.setdefault((width, kind), []).append(case)
    write_parts(out_dir, header, by_width, sort_cases=True)


def write_parts(out_dir, header, by_width, sort_cases):
    os.makedirs(out_dir, exist_ok=True)
    # A part keeps its tfhe-rs verification record as long as its cases are unchanged.
    previous = {}
    for stale in os.listdir(out_dir):
        path = os.path.join(out_dir, stale)
        if stale != "index.json":
            with open(path) as fh:
                old = json.load(fh)
            previous[stale] = (old["cases"], old.get("verified", []))
        os.remove(path)
    parts = []
    for width, kind in sorted(by_width, key=lambda k: (-k[0], k[1] != "normal")):
        cases = by_width[(width, kind)]
        if sort_cases:
            cases.sort(key=lambda c: (-c["lhs"]["bits"], -c.get("rhs", c["lhs"])["bits"]))
        name = f"{width}.{kind}.json"
        old_cases, verified = previous.get(name, (None, []))
        if old_cases != cases:
            verified = []
        with open(os.path.join(out_dir, name), "w") as fh:
            fh.write(render({**header, "width": width, "kind": kind, "verified": verified}, cases))
        v = json.dumps(verified, separators=(", ", ": "))
        parts.append(f'    {{ "width": {width}, "kind": "{kind}", "file": "{name}", "cases": {len(cases)}, "verified": {v} }}')
    with open(os.path.join(out_dir, "index.json"), "w") as fh:
        fh.write("{\n")
        for k, v in header.items():
            fh.write(header_line(k, v) + "\n")
        fh.write('  "parts": [\n' + ",\n".join(parts) + "\n  ]\n}\n")


########################################################################################################
# sum, isin, muldiv: operators with a collection or three operands.
#
# A case names its operands by field instead of lhs/rhs alone, and the header's "operands" lists
# which fields every case carries:
#   sum     ["values"]                 FHE.sum(euintN[])                -> euintN, wraps at N bits
#   isin    ["lhs", "values"]          FHE.isIn(T value, T[] set)       -> ebool
#   muldiv  ["lhs", "rhs", "divisor"]  FHE.mulDiv(euintN a, b, uintN d) -> euintN
# Every operand of a case has the same width: the executor rejects mixed types for all three.
# For muldiv, `rhs` is checked both encrypted and as a clear scalar, the two FHE.sol overloads, the
# same way a binary operator's case covers (enc, enc), (enc, clear) and (clear, enc).
#
# Scenario kinds are explicit here rather than looked up by name. Every scenario carries the value
# families the older operators use (zero, one, small, max, max - 1, top bit and its neighbours, the
# a5 pattern and its inverse, mid values, sized rungs, low-half and low-byte carries), plus what only a
# collection has: empty, single, duplicates, position of a match, and the executor's size caps.
#
# The upstream e2e cases (fhevm test-suite/e2e/test/fhevmOperations/manual.ts, see
# ../e2e-sum-isin-muldiv-vectors.md) are included verbatim under `e2e_*` ids. They come first, so a
# generated scenario with the same inputs is the one dropped and the upstream id survives.
########################################################################################################

# FHEVMExecutor: FHE_COLLECTION_NARROW_MAX_SIZE for 8..32 bits, FHE_COLLECTION_WIDE_MAX_SIZE above.
NARROW_COLLECTION_MAX, WIDE_COLLECTION_MAX = 100, 60


def collection_max(w):
    return NARROW_COLLECTION_MAX if w <= 32 else WIDE_COLLECTION_MAX


def spread_bits(w, n):
    """n distinct bit positions spread evenly over 0..w-1, always including both ends."""
    n = min(n, w)
    if n == 1:
        return [0]
    return sorted({round(i * (w - 1) / (n - 1)) for i in range(n)})


SUM_BITS = [8, 16, 32, 64, 128]
ISIN_BITS = [8, 16, 32, 64, 128, 160, 256]
MULDIV_BITS = [8, 16, 32, 64]

ADDR = lambda digit: int(digit * 40, 16)

# (id suffix, width, values, kind)
SUM_E2E = [
    ("e2e_s1", 16, [1000, 2000], "normal"),
    ("e2e_s2", 32, [100000, 200000], "normal"),
    ("e2e_s3", 8, [10, 20, 30], "normal"),
    ("e2e_s4", 64, [1000000, 2000000], "normal"),
    ("e2e_s5", 128, [10**20, 2 * 10**20], "normal"),
    ("e2e_s6_duplicate", 8, [7, 7], "edge"),
    # Upstream sums an uninitialized euint8 (the zero handle); as a value that is 0.
    ("e2e_s7_uninitialized_as_zero", 8, [5, 0], "edge"),
    ("e2e_s8_empty", 8, [], "edge"),
    ("e2e_s9_single", 8, [42], "edge"),
    ("e2e_s10_max_array", 8, [1] * 100, "edge"),
]

# (id suffix, width, value, set, kind)
ISIN_E2E = [
    ("e2e_i1", 8, 20, [10, 20, 30], "normal"),
    ("e2e_i2", 8, 99, [10, 20, 30], "normal"),
    ("e2e_i3", 16, 1000, [1000, 2000], "normal"),
    ("e2e_i4", 32, 100000, [100000, 200000], "normal"),
    ("e2e_i5", 64, 1000000000, [1000000000, 2000000000], "normal"),
    ("e2e_i6", 128, 10**19, [10**19, 2 * 10**19], "normal"),
    ("e2e_i7_uninitialized_as_zero", 8, 0, [0, 1], "edge"),
    ("e2e_i8_single_found", 8, 42, [42], "edge"),
    ("e2e_i9_max_array", 8, 50, list(range(100)), "edge"),
    ("e2e_i10_empty", 8, 42, [], "edge"),
    ("e2e_i11_zero_set", 8, 0, [0, 0, 0], "edge"),
    ("e2e_i12_max_found_last", 8, 255, [0, 128, 255], "edge"),
    ("e2e_i13_single_not_found", 8, 99, [42], "edge"),
    ("e2e_i14_eaddress_found", 160, ADDR("2"), [ADDR("1"), ADDR("2"), ADDR("3")], "normal"),
    ("e2e_i15_eaddress_not_found", 160, ADDR("4"), [ADDR("1"), ADDR("2")], "normal"),
    ("e2e_i16", 256, 42, [1, 42, 100], "normal"),
    ("e2e_i17", 256, 99, [1, 2], "normal"),
]

# (id suffix, width, a, b, divisor, kind). Upstream M9 (divisor 0) reverts and has no result;
# M11 and M12 share inputs and differ only in the overload, which every case here covers both of.
MULDIV_E2E = [
    ("e2e_m1_product_overflows", 8, 200, 200, 200, "edge"),
    ("e2e_m2", 8, 50, 3, 5, "normal"),
    ("e2e_m3_product_overflows", 16, 60000, 60000, 60000, "edge"),
    ("e2e_m4", 16, 1000, 3, 5, "normal"),
    ("e2e_m5_product_overflows", 32, 300000, 300000, 300000, "edge"),
    ("e2e_m6", 32, 1000000, 3, 5, "normal"),
    ("e2e_m7_product_overflows", 64, 10**10, 10**10, 10**10, "edge"),
    ("e2e_m8", 64, 10**9, 3, 5, "normal"),
    ("e2e_m10_zero_factor1", 8, 0, 100, 50, "edge"),
    ("e2e_m11_m12_zero_factor2", 8, 100, 0, 50, "edge"),
    ("e2e_m13_truncating", 8, 7, 3, 4, "normal"),
    ("e2e_m14_truncates_to_zero", 8, 1, 1, 2, "edge"),
]


def sum_scenarios(w):
    m, top, p, half, cap = mask(w), 1 << (w - 1), pattern(w), w // 2, collection_max(w)
    rows = [
        ("plain", "normal", [SMALL_A, SMALL_B]),
        ("small_three", "normal", [NARROW, SMALL_B, SMALL_A]),
        ("small_run", "normal", list(range(1, 11))),
        ("mid_pair", "normal", [mid_hi(w), mid_lo(w)]),
        ("pattern_vs_inverse", "normal", [p, p ^ m]),
        ("empty", "edge", []),
        ("single_zero", "edge", [0]),
        ("single_one", "edge", [1]),
        ("single_max", "edge", [m]),
        ("single_top_bit", "edge", [top]),
        ("zero_zero", "edge", [0, 0]),
        ("one_one", "edge", [1, 1]),
        ("duplicate", "edge", [NARROW, NARROW]),
        ("max_plus_zero", "edge", [m, 0]),
        ("zero_plus_max", "edge", [0, m]),
        ("max_minus_1_plus_1", "edge", [m - 1, 1]),
        ("wrap_to_0", "edge", [m, 1]),
        ("one_plus_max", "edge", [1, m]),
        ("wrap_past_0", "edge", [m, NARROW]),
        ("both_max", "edge", [m, m]),
        ("three_max", "edge", [m, m, m]),
        ("carry_top_bit", "edge", [top - 1, 1]),
        ("top_bit_top_bit", "edge", [top, top]),
        ("top_bit_plus_top_bit_minus_1", "edge", [top, top - 1]),
        ("low_half_carry", "edge", [mask(half), 1]),
        ("only_low_byte_carry", "edge", [0xFF, 1]),
        ("zeros_at_max_size", "edge", [0] * cap),
        ("ones_at_max_size", "edge", [1] * cap),
        ("max_at_max_size", "edge", [m] * cap),
        ("top_bit_at_max_size", "edge", [top] * cap),
        ("ascending_at_max_size", "edge", list(range(cap))),
        ("pattern_alternating_at_max_size", "edge", [p, p ^ m] * (cap // 2)),
        ("max_then_ones_at_max_size", "edge", [m] + [1] * (cap - 1)),
    ]
    rows += [(f"sized_{k}", "normal", [mid_hi(k), mid_lo(k)]) for k in BITS if k < w]
    return rows


def isin_scenarios(w):
    m, top, p, half, cap = mask(w), 1 << (w - 1), pattern(w), w // 2, collection_max(w)
    one_bit_off = lambda base, n: [base ^ (1 << b) for b in spread_bits(w, n)]
    ascending, descending = list(range(cap)), [m - i for i in range(cap)]
    rows = [
        ("found_middle", "normal", SMALL_A, [SMALL_B, SMALL_A, NARROW]),
        ("not_found", "normal", NARROW + SMALL_B, [SMALL_B, SMALL_A, NARROW]),
        ("mid_found", "normal", mid_hi(w), [mid_lo(w), mid_hi(w)]),
        ("mid_not_found", "normal", mid_hi(w), [mid_lo(w), p]),
        ("pattern_found", "normal", p, [p ^ m, p]),
        ("pattern_vs_inverse", "normal", p, [p ^ m]),
        ("empty_zero", "edge", 0, []),
        ("empty_max", "edge", m, []),
        ("single_found", "edge", NARROW, [NARROW]),
        ("single_not_found", "edge", NARROW, [SMALL_A]),
        ("zero_single", "edge", 0, [0]),
        ("zero_set", "edge", 0, [0, 0, 0]),
        ("zero_not_in_nonzero", "edge", 0, [1, m]),
        ("zero_found_last", "edge", 0, [m, 1, 0]),
        ("one_found", "edge", 1, [0, 1]),
        ("one_between_neighbours", "edge", 1, [0, 2]),
        ("max_single", "edge", m, [m]),
        ("max_found_last", "edge", m, [0, top, m]),
        ("max_vs_max_minus_1", "edge", m, [m - 1]),
        ("max_minus_1_vs_max", "edge", m - 1, [m]),
        ("top_bit_found", "edge", top, [top - 1, top, top + 1]),
        ("top_bit_between_neighbours", "edge", top, [top - 1, top + 1]),
        ("low_bit_differs", "edge", p, [p ^ 1]),
        ("top_bit_differs", "edge", p, [p ^ top]),
        ("only_low_half_matches", "edge", m, [mask(half)]),
        ("only_high_half_matches", "edge", m, [m ^ mask(half)]),
        ("only_low_byte_matches", "edge", m, [0xFF]),
        ("found_first", "edge", NARROW, [NARROW, SMALL_A, SMALL_B]),
        ("found_last", "edge", NARROW, [SMALL_A, SMALL_B, NARROW]),
        ("duplicates_found", "edge", SMALL_A, [SMALL_A, SMALL_A, SMALL_A]),
        ("duplicates_not_found", "edge", SMALL_A, [SMALL_B, SMALL_B, SMALL_B]),
        # Every element differs from the value in exactly one bit, spread across the whole width.
        ("max_vs_all_one_bit_off", "edge", m, one_bit_off(m, cap)),
        ("zero_vs_all_one_bit_off", "edge", 0, one_bit_off(0, cap)),
        ("max_found_after_one_bit_off", "edge", m, one_bit_off(m, cap - 1) + [m]),
        ("ascending_at_max_size_found_first", "edge", 0, ascending),
        ("ascending_at_max_size_found_last", "edge", cap - 1, ascending),
        ("ascending_at_max_size_not_found", "edge", cap, ascending),
        ("descending_at_max_size_found_last", "edge", m - (cap - 1), descending),
        ("descending_at_max_size_not_found", "edge", m - cap, descending),
        ("zeros_at_max_size_found", "edge", 0, [0] * cap),
        ("zeros_at_max_size_not_found", "edge", 1, [0] * cap),
    ]
    for k in BITS:
        if k < w:
            rows.append((f"sized_{k}_found", "normal", mid_hi(k), [mid_lo(w), mid_hi(k)]))
            # Equal in the low k bits, different above them.
            rows.append((f"sized_{k}_same_low_bits", "edge", mid_hi(k), [mid_hi(w)]))
    return rows


def muldiv_scenarios(w):
    m, top, p, half = mask(w), 1 << (w - 1), pattern(w), w // 2
    return [
        ("plain", "normal", SMALL_A, 3, 5),
        ("truncating", "normal", NARROW, 3, 4),
        ("percent", "normal", SMALL_A, 30, 100),
        ("mid", "normal", mid_lo(w), mid_lo(w), mid_hi(w)),
        ("pattern_by_mid", "normal", p, mid_lo(w), mid_hi(w)),
        ("zero_factor1", "edge", 0, SMALL_A, NARROW),
        ("zero_factor2", "edge", SMALL_A, 0, NARROW),
        ("zero_zero", "edge", 0, 0, 1),
        ("one_one_by_one", "edge", 1, 1, 1),
        ("truncates_to_zero", "edge", 1, 1, 2),
        ("one_one_by_max", "edge", 1, 1, m),
        ("product_equals_divisor", "edge", SMALL_B, NARROW, SMALL_B * NARROW),
        ("divisor_above_product", "edge", 2, 3, NARROW),
        ("max_by_one_by_one", "edge", m, 1, 1),
        ("one_by_max_by_one", "edge", 1, m, 1),
        ("max_by_one_by_max", "edge", m, 1, m),
        ("max_by_small_by_max", "edge", m, SMALL_A, m),
        # The product overflows N bits and the quotient fits again: widening is what makes these right.
        ("max_max_by_max", "edge", m, m, m),
        ("max_by_max_minus_1_by_max", "edge", m, m - 1, m),
        ("max_by_two_by_two", "edge", m, 2, 2),
        ("max_by_small_by_small", "edge", m, SMALL_B, SMALL_B),
        ("max_by_half_power_by_half_power", "edge", m, 1 << half, 1 << half),
        ("top_bit_by_two_by_two", "edge", top, 2, 2),
        ("top_bit_squared_by_top_bit", "edge", top, top, top),
        ("pattern_squared_by_pattern", "edge", p, p, p),
        # The quotient itself does not fit in N bits and is truncated back to them.
        ("max_max_by_one", "edge", m, m, 1),
        ("max_max_by_two", "edge", m, m, 2),
        ("max_max_by_small", "edge", m, m, SMALL_B),
        ("max_max_by_top_bit", "edge", m, m, top),
        ("max_max_by_max_minus_1", "edge", m, m, m - 1),
        ("top_bit_by_two_by_one", "edge", top, 2, 1),
        ("pattern_by_inverse_by_one", "edge", p, p ^ m, 1),
        ("inverse_pattern_by_max_by_pattern", "edge", p ^ m, m, p),
    ] + [(f"sized_{k}", "normal", mid_hi(k), mid_lo(k), mid_hi(k)) for k in BITS if k < w]


def sum_rows(w):
    e2e = [(n, kind, vals) for n, bits, vals, kind in SUM_E2E if bits == w]
    for name, kind, vals in e2e + sum_scenarios(w):
        if len(vals) > collection_max(w) or any(v > mask(w) for v in vals):
            continue
        yield name, kind, (tuple(vals),), {
            "values": [{"bits": w, "value": hex(v)} for v in vals],
            "result": {"bits": w, "value": hex(sum(vals) & mask(w))},
        }


def isin_rows(w):
    e2e = [(n, kind, v, s) for n, bits, v, s, kind in ISIN_E2E if bits == w]
    for name, kind, v, s in e2e + isin_scenarios(w):
        if len(s) > collection_max(w) or v > mask(w) or any(x > mask(w) for x in s):
            continue
        yield name, kind, (v, tuple(s)), {
            "lhs": {"bits": w, "value": hex(v)},
            "values": [{"bits": w, "value": hex(x)} for x in s],
            "result": {"bits": BOOL_BITS, "value": hex(int(v in s))},
        }


def muldiv_rows(w):
    m = mask(w)
    e2e = [(n, kind, a, b, d) for n, bits, a, b, d, kind in MULDIV_E2E if bits == w]
    for name, kind, a, b, d in e2e + muldiv_scenarios(w):
        # A zero divisor reverts in the executor; the coprocessor reads the divisor at the operand width.
        if a > m or b > m or not 0 < d <= m:
            continue
        yield name, kind, (a, b, d), {
            "lhs": {"bits": w, "value": hex(a)},
            "rhs": {"bits": w, "value": hex(b)},
            "divisor": {"bits": w, "value": hex(d)},
            "result": {"bits": w, "value": hex((a * b // d) & m)},
        }


# op -> (rows(width), widths, semantics, operands)
NARY_OPS = {
    "sum": (sum_rows, SUM_BITS, "wrapping", ["values"]),
    "isin": (isin_rows, ISIN_BITS, "membership", ["lhs", "values"]),
    "muldiv": (muldiv_rows, MULDIV_BITS, "wide-product-divisor-nonzero", ["lhs", "rhs", "divisor"]),
}


def main_nary(op, out_dir):
    rows, widths, semantics, operands = NARY_OPS[op]
    header = {"op": op, "arity": len(operands), "operands": operands, "semantics": semantics, "encoding": "hex-string"}
    by_width = {}
    for w in widths:
        seen = set()
        for name, kind, inputs, fields in rows(w):
            # Same inputs, same case: keep the first, which is the upstream one when there is one.
            if inputs in seen:
                continue
            seen.add(inputs)
            by_width.setdefault((w, kind), []).append({"id": f"{op}_{w}_{name}", **fields})
    write_parts(out_dir, header, by_width, sort_cases=False)


if __name__ == "__main__":
    key = sys.argv[1]
    # Relative to the repository root, NOT the caller's cwd: the default used to be resolved against cwd,
    # so running from anywhere but the root silently created a second tree instead of touching data/.
    default_root = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
    out_dir = sys.argv[2] if len(sys.argv) > 2 else os.path.join(default_root, key.replace(":", "."))
    main(key, out_dir)
