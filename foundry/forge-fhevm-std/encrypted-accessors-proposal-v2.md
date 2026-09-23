# Proposal v2: typed accessors modeled on forge-std's `LibVariable`

Package: `foundry/forge-fhevm-std`
File: `pkg/src/FhevmStd.sol`
Status: draft
Supersedes: `encrypted-accessors-proposal.md` §"Mechanics" (read side only — construction, naming and the
usage examples are unchanged)

## Source of the technique

[`src/LibVariable.sol`](https://github.com/foundry-rs/forge-std/blob/8e40513d678f392f398620b3ef2b418648b33e89/src/LibVariable.sol),
forge-std `v1.11.0` (commit `8e40513d678f392f398620b3ef2b418648b33e89`) — already vendored in this repo at
`dependencies/forge-std-1.11.0/src/LibVariable.sol`. It backs `StdConfig`'s typed TOML/JSON coercion:

```solidity
struct Variable { Type ty; bytes data; }
struct Type { TypeKind kind; bool isArray; }

using LibVariable for Variable global;

modifier check(Variable memory self, Type memory expected) {
    assertExists(self);
    assertEq(self.ty, expected);          // reverts TypeMismatch(expected, actual)
    _;
}

function toUint256(Variable memory self) internal pure check(self, Type(TypeKind.Uint256, false))
    returns (uint256) { return abi.decode(self.data, (uint256)); }
```

The shape: an erased payload (`bytes data`) carries an **explicit, stored type tag** (`Type ty`) alongside
it, not recovered from the payload's own bytes. One accessor per type, each declaring the type it expects
and reverting a dedicated, structured error when the stored tag disagrees.

## Why this differs from proposal v1

v1's `EncryptedLib.u8/u32/...` recover the FHE type from **inside the handle itself** — `FheType(uint8(h[30]))`,
byte 30 of the `bytes32` handle. That works only because `externalEuintN` handles happen to encode their
type id at a fixed byte offset; the accessor is coupled to that internal layout.

v2 instead stores the tag **next to** the handle, exactly like `Variable.ty` sits next to `Variable.data`:

```solidity
struct Encrypted {
    FheType[] tags;      // one tag per handle, positional — this repo's FheType stands in for TypeKind
    bytes32[] handles;
    bytes inputProof;
}
```

`tags[i]` is written once, when the batch is built, straight from the `TypedValue.t` the caller already
passed to `u8(...)`/`u32(...)`/etc. — the accessor never has to parse a handle to know what it is. This
removes the dependency on the coprocessor's byte-30 convention and mirrors forge-std's own accepted
pattern for exactly this problem (erased value + tag-checked typed reader) in a test-tooling context,
rather than inventing a new one.

## Proposal

```solidity
struct Encrypted {
    FheType[] tags;
    bytes32[] handles;
    bytes inputProof;
}

library EncryptedLib {
    error FheTypeMismatch(FheType expected, FheType actual);

    /// @dev The `check` modifier in LibVariable, specialized to FheType and to reading handle `i`.
    modifier check(Encrypted memory self, uint256 i, FheType expected) {
        FheType actual = self.tags[i];
        if (actual != expected) revert FheTypeMismatch(expected, actual);
        _;
    }

    function boolean(Encrypted memory self, uint256 i)
        internal pure check(self, i, FheType.Bool) returns (externalEbool)
    {
        return externalEbool.wrap(self.handles[i]);
    }

    function u8(Encrypted memory self, uint256 i)
        internal pure check(self, i, FheType.Uint8) returns (externalEuint8)
    {
        return externalEuint8.wrap(self.handles[i]);
    }

    function u16(Encrypted memory self, uint256 i)
        internal pure check(self, i, FheType.Uint16) returns (externalEuint16)
    {
        return externalEuint16.wrap(self.handles[i]);
    }

    function u32(Encrypted memory self, uint256 i)
        internal pure check(self, i, FheType.Uint32) returns (externalEuint32)
    {
        return externalEuint32.wrap(self.handles[i]);
    }

    function u64(Encrypted memory self, uint256 i)
        internal pure check(self, i, FheType.Uint64) returns (externalEuint64)
    {
        return externalEuint64.wrap(self.handles[i]);
    }

    function u128(Encrypted memory self, uint256 i)
        internal pure check(self, i, FheType.Uint128) returns (externalEuint128)
    {
        return externalEuint128.wrap(self.handles[i]);
    }

    function u256(Encrypted memory self, uint256 i)
        internal pure check(self, i, FheType.Uint256) returns (externalEuint256)
    {
        return externalEuint256.wrap(self.handles[i]);
    }

    /// @dev u160 for an address, as in v1: that is the FHE type an `address` encrypts to.
    function u160(Encrypted memory self, uint256 i)
        internal pure check(self, i, FheType.Uint160) returns (externalEaddress)
    {
        return externalEaddress.wrap(self.handles[i]);
    }
}

using EncryptedLib for Encrypted global;
```

Construction is unchanged from v1 — `boolean(bool)`, `u8(uint8)`, ..., `u160(address)` build a
`TypedValue{FheType t; uint256 v}`, and the fixed-arity `encrypt(TypedValue memory a, ..., address, address)`
overloads (1–4 values) plus the `TypedValue[]`/raw-`bytes` escape hatches build the batch. The only change
is that building `Encrypted` now also fills `tags[i] = values[i].t` — one extra array write per value,
already known at that point, no extra work for the caller:

```solidity
function _toEncrypted(TypedValue[] memory values, bytes32[] memory handles, bytes memory inputProof)
    private
    pure
    returns (Encrypted memory e)
{
    FheType[] memory tags = new FheType[](values.length);
    for (uint256 i = 0; i < values.length; i++) {
        tags[i] = values[i].t;
    }
    e = Encrypted({tags: tags, handles: handles, inputProof: inputProof});
}
```

## Usage examples

Identical call sites to v1 — this proposal only changes what happens *inside* `e.u8(0)`, not how it's
spelled:

```solidity
Encrypted memory e = encrypt(asUint8(3), asUint32(70_000), addr(dapp), alice);
externalUint8 ee = encryptUint8(3, alice);
dapp.deposit(e.externalUint8At(0), e.u32(1), e.inputProof);
```

### Mismatch is caught at the accessor, with structured data instead of a string

```solidity
Encrypted memory e = encrypt(u8(3), u32(7), address(dapp), alice);
vm.expectRevert(abi.encodeWithSelector(EncryptedLib.FheTypeMismatch.selector, FheType.Uint32, FheType.Uint8));
this.exposed_u32(e, 0);   // slot 0 holds a Uint8 handle, tags[0] == FheType.Uint8
```

`vm.expectRevert` can now match on the mismatch's expected/actual types directly (`FheTypeMismatch.selector`
+ the two `FheType` values), the way `LibVariable`'s callers assert on `TypeMismatch(string,string)` — a
strictly more testable failure than v1's `require(..., "FhevmStd: handle type mismatch")` string.

## What changes vs. v1

| | v1 (`_typed`, byte 30) | v2 (`LibVariable`-style, stored tag) |
|---|---|---|
| Type source at read time | Parsed out of the handle's own bytes | Read from `Encrypted.tags[i]`, written at construction |
| Coupling | Depends on the coprocessor's handle layout (type id at byte 30) | Depends only on `TypedValue.t`, already known to the constructor |
| Mismatch error | `require(..., "FhevmStd: handle type mismatch")` (plain string) | `error FheTypeMismatch(FheType expected, FheType actual)` (structured, matches `LibVariable.TypeMismatch`) |
| Extra storage | None — `Encrypted{handles, inputProof}` | One `FheType[]` parallel to `handles` |
| Precedent | None found outside this proposal | [`LibVariable.sol`](https://github.com/foundry-rs/forge-std/blob/8e40513d678f392f398620b3ef2b418648b33e89/src/LibVariable.sol), already a project dependency |

The cost is one `FheType[]` array (32 bytes × N in memory) that v1 does not need. The benefit is that the
check no longer depends on knowing which byte of a `bytes32` handle carries the type id — if the mock's
handle format ever changes, v2's accessors are unaffected, whereas v1's `_typed` would need updating in
lockstep. It also gives `vm.expectRevert` something structured to match on, exactly as `LibVariable`'s
`TypeMismatch(string,string)` does for `StdConfig` callers.

## Open questions

- Is a second `FheType[]` array worth it for a mock/test library where handles are already known to encode
  their type at byte 30 (i.e., is v1's coupling actually a real risk, or is it stable enough that v2's extra
  bookkeeping isn't earning its keep)?
- Should `FheTypeMismatch` carry the index `i` as a third field, the way `LibVariable.TypeMismatch` doesn't
  need to (a `Variable` is always a single value, an `Encrypted` is a batch)? Without `i`, a failing
  `e.u32(3)` in a five-value batch reports *what* was wrong but not *where*.
- `LibVariable` also ships range-checked narrowing (`toUint128`/`toUint64`/... via `toUint256` + a
  `type(uintN).max` check + `UnsafeCast`). `FheType` widths are disjoint variants of one enum, not a single
  wide integer narrowed down, so there is no equivalent narrowing step here — noted so the analogy isn't
  overextended.
