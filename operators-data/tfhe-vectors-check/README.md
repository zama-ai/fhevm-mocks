# tfhe-vectors-check

Validates the numeric test vectors in `operators-data/data/` against tfhe-rs.
Each operator has a directory with one part file per (widest-operand width, normal|edge)
and an `index.json` listing the parts. Pass the data root, one operator directory, or a
single part file. With the root, sets written for the other tfhe-rs semantics are
skipped (reported, not failed) and keys are generated once for everything.

## Collection and three-operand operators

`sum`, `isin` and `muldiv` do not fit `lhs`/`rhs`. Their headers carry `"operands"`, the fields every
case holds, and all operands of a case share one width:

| op | operands | result | widths | tfhe-rs call |
|---|---|---|---|---|
| `sum` | `values` | wraps at the width | 8–128 | `Iterator::sum` |
| `isin` | `lhs`, `values` | 1 bit | 8–256, 160 = eaddress | `FheUint::contains` |
| `muldiv` | `lhs`, `rhs`, `divisor` | truncated to the width | 8–64 | `fused_mul_scalar_div`, `fused_scalar_mul_scalar_div` |

These are the calls the coprocessor makes. A `muldiv` case is checked with `rhs` encrypted and with
`rhs` clear, the two `FHE.mulDiv` overloads. The checker also enforces the executor's rules:
collections of at most 100 elements up to 32 bits and 60 above, and a non-zero divisor. Empty
collections are real cases. tfhe-rs returns 0 for an empty sum and false for an empty `contains`.

Cases whose id contains `e2e_` are the upstream end-to-end tests, listed in
`../e2e-sum-isin-muldiv-vectors.md`. Generate with `scripts/gen-op-cases.py sum` (or `isin`,
`muldiv`).

## tfhe-rs 1.7.x (default)

```sh
cargo build
cargo run -- ../data                      # every operator
cargo run -- ../data/add                  # one operator
cargo run -- ../data/add/128.edge.json    # one part
```

## tfhe-rs 1.6.x

A sibling package pins `tfhe = "~1.6"` and shares `src/main.rs`; Cargo cannot hold two
semver-compatible versions of one crate in a single package.

```sh
cargo build --manifest-path tfhe16/Cargo.toml
cargo run   --manifest-path tfhe16/Cargo.toml -- ../data/shl.amount-mod-width
```

## Options

- `--no-fhe`: parse, check widths, and compare against a clear-integer reference only.
  No key generation, runs in well under a second.
- `--no-record`: do not write verification records.
- `--force`: re-check parts already verified by this build's tfhe-rs release. Without it an
  FHE run skips them, so re-running the root after an interruption only does what is left.
- `--log=FILE`: where the progress log goes. An FHE run always writes one, by default to
  `./tfhe-vectors-check.log` (gitignored). A `--no-fhe` run writes one only with this option.

## Progress log

An FHE run can take a long time: one 64-bit `muldiv` case or one 60-element 256-bit `isin` case
can take minutes. The log is appended to, never truncated, and every line is stamped with the time
since the run started. The shape looks like this; the timings are illustrative, not measured:

```text
[0m00s] ==== 2026-09-26 tfhe-vectors-check ../data/muldiv
[0m00s] generating keys... (148 cases to check)
[0m04s] part  ../data/muldiv/64.normal.json  (9 cases)
[0m34s]       still on muldiv_64_e2e_m8 (0m30s)
[0m51s] ok    muldiv_64_e2e_m8  (47.2s)
[0m51s] [  0.7%] 1/148  elapsed 0m51s  eta 124m48s
[2m16s] recorded tfhe-rs 1.7.1 in ../data/muldiv/64.normal.json
```

A `part` line marks the start of each part file, and `recorded` marks it verified. Each case line
carries its duration. A `still on` line appears every 30 s while one case is running.

Follow it from another terminal:

```sh
tail -f tfhe-vectors-check.log
```

An interrupted run loses only the part it was in. Parts already recorded are skipped on the next run.

## Verification records

After a full FHE run in which every case of a part passes, the checker appends
`{"tfhe-rs": "<version>", "date": "<YYYY-MM-DD>"}` to that part's `"verified"` header
and mirrors it into `index.json` (one entry per tfhe-rs version, refreshed in place).
`--no-fhe` runs never record. The generator keeps a part's record as long as its cases
are unchanged and clears it otherwise, so `"verified": []` always means "not yet
confirmed against this exact content".

Each binary prints which tfhe-rs semantics it was built with and refuses a vector set
whose `semantics` header does not match (`shl`/`shr` changed from `amount-mod-width` to
`overshift-zero` in tfhe-rs 1.7). Progress with an ETA is printed on stderr every 5 s;
per-case `ok`/`FAIL` lines go to stdout.
