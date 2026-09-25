# Proposal: typed accessors on the `encrypt` batch return

Package: `foundry/forge-fhevm-std`
File: `pkg/src/FhevmStd.sol`
Status: draft

## Problem

`encrypt(TypedValue…, contract, user)` takes a typed, fixed-arity list of cleartexts
but can only return an erased value. Today that is `bytes` plus a separate proof:

```solidity
(bytes memory enc, bytes memory proof) = encrypt(u8(3), u32(70_000), address(dapp), alice);
(externalEuint8 eA, externalEuint32 eB) = abi.decode(enc, (externalEuint8, externalEuint32));
dapp.deposit(eA, eB, proof);
```

Two costs:

1. **Redundant type list.** The widths are already stated in `u8(3), u32(70_000)`;
   `abi.decode` makes the caller restate them.
2. **Silent mismatch.** Every `externalEuintN` is a `bytes32` underneath, so decoding a
   `Uint8` handle as `externalEuint32` succeeds and fails later, deep in the coprocessor
   mock, with an unrelated message.

A fully typed return is not achievable: Solidity has no generics or tuple values, and one
overload per ordered type combination is 9<sup>k</sup> functions.

## Proposal

Keep `bytes` as the low-level primitive. Add a struct return plus **one accessor per FHE
type** (O(N), not O(N<sup>k</sup>)) that recovers the handle's type from the handle itself.

```solidity
struct Encrypted {
    bytes32[] handles;
    bytes inputProof;
}

library EncryptedLib {
    function boolean(Encrypted memory e, uint256 i) internal pure returns (externalEbool)    { … }
    function u8     (Encrypted memory e, uint256 i) internal pure returns (externalEuint8)   { … }
    function u16    (Encrypted memory e, uint256 i) internal pure returns (externalEuint16)  { … }
    function u32    (Encrypted memory e, uint256 i) internal pure returns (externalEuint32)  { … }
    function u64    (Encrypted memory e, uint256 i) internal pure returns (externalEuint64)  { … }
    function u128   (Encrypted memory e, uint256 i) internal pure returns (externalEuint128) { … }
    function u160   (Encrypted memory e, uint256 i) internal pure returns (externalEaddress) { … }
    function u256   (Encrypted memory e, uint256 i) internal pure returns (externalEuint256) { … }

    function _typed(Encrypted memory e, uint256 i, FheType t) private pure returns (bytes32 h) {
        h = e.handles[i];
        require(FheType(uint8(h[30])) == t, "FhevmStd: handle type mismatch");
    }
}

using EncryptedLib for Encrypted global;
```

Result:

```solidity
Encrypted memory e = encrypt(u8(3), u32(70_000), address(dapp), alice);
dapp.deposit(e.u8(0), e.u32(1), e.inputProof);
```

### Naming

Accessors reuse the constructor names: `u8(a)` puts a `uint8` in slot 0, `e.u8(0)` takes
the `externalEuint8` back out of slot 0. The same width token appears on both lines.

- `uint8` / `uint32` / `bool` / `address` are reserved keywords and cannot be function names.
- `euint8` / `externalEuint8` collide with the imported user-defined value types.
- `u160` → `externalEaddress` keeps the family keyed by width, matching the constructor
  side (`u160(address)`). Document it in the struct's `@dev`.

### Mechanics

- `struct Encrypted` is declared at **file level**, required for `using … for … global`.
- Accessors live in a library so they do not shadow the contract-level `u8(uint8)`
  constructor helper. `u8(a)` resolves to `FhevmStd.u8`; `e.u8(0)` resolves via the
  attachment. Arities differ, so there is no overload ambiguity.
- The type check reads byte 30 of the handle, where the FHE type id is encoded.
- The existing fixed-arity `encrypt(TypedValue…)` overloads change only their return type.
  `encrypt(bytes, …)` keeps returning `Encrypted` too, so the raw-pairs escape hatch composes.

## Usage examples

### Single value

```solidity
Encrypted memory e = encrypt(u64(1_000_000), address(vault), alice);
vault.deposit(e.u64(0), e.inputProof);
```

### Two values, different widths, one proof

```solidity
Encrypted memory e = encrypt(u8(3), u32(70_000), address(dapp), alice);
dapp.deposit(e.u8(0), e.u32(1), e.inputProof);
```

### Bool, address and a wide integer

```solidity
Encrypted memory e = encrypt(boolean(true), u160(bob), u128(1e30), address(dapp), alice);
dapp.transferIf(e.boolean(0), e.u160(1), e.u128(2), e.inputProof);
//              externalEbool  externalEaddress  externalEuint128
```

### Four values — largest fixed-arity overload

```solidity
Encrypted memory e = encrypt(u8(1), u16(2), u32(3), u64(4), address(dapp), alice);
dapp.setAll(e.u8(0), e.u16(1), e.u32(2), e.u64(3), e.inputProof);
```

### One proof, several calls

```solidity
Encrypted memory e = encrypt(u32(10), u32(20), address(dapp), alice);
dapp.setA(e.u32(0), e.inputProof);
dapp.setB(e.u32(1), e.inputProof);
```

### Mismatch is caught at the accessor

```solidity
Encrypted memory e = encrypt(u8(3), u32(7), address(dapp), alice);
vm.expectRevert(bytes("FhevmStd: handle type mismatch"));
this.exposed_u32(e, 0);   // slot 0 holds a Uint8 handle
```

`expectRevert` only observes external calls, so the test needs a small `exposed_*` wrapper.

### Widths are compiler-checked

```solidity
encrypt(u8(300), address(dapp), alice);   // compile error: 300 does not fit uint8
encrypt(u8(255), address(dapp), alice);   // ok
```

### Round trip through `decryptPublic`

```solidity
Encrypted memory e = encrypt(u32(7), u64(1234567890123), address(dapp), alice);
dapp.store(e.u32(0), e.u64(1), e.inputProof);

(euint32 a, euint64 b) = dapp.stored();
assertEq(decryptPublic(a), 7);
assertEq(decryptPublic(b), 1234567890123);
```

### Escape hatch — more than four values

```solidity
bytes memory pairs = abi.encode(
    uint8(FheType.Uint8), 1,
    uint8(FheType.Uint8), 2,
    uint8(FheType.Uint8), 3,
    uint8(FheType.Uint8), 4,
    uint8(FheType.Uint8), 5
);
Encrypted memory e = encrypt(pairs, address(dapp), alice);
for (uint256 i = 0; i < 5; i++) dapp.push(e.u8(i), e.inputProof);
```

## Before / after

```solidity
// before
(bytes memory enc, bytes memory proof) = encrypt(u8(3), u32(70_000), address(dapp), alice);
(externalEuint8 eA, externalEuint32 eB) = abi.decode(enc, (externalEuint8, externalEuint32));
dapp.deposit(eA, eB, proof);

// after
Encrypted memory e = encrypt(u8(3), u32(70_000), address(dapp), alice);
dapp.deposit(e.u8(0), e.u32(1), e.inputProof);
```

Two lines fewer, no duplicated type list, and a type mismatch reverts at the accessor with
a clear message — the property `abi.decode` cannot provide.

## Alternatives considered

| Option | Verdict |
|---|---|
| Keep `bytes` + `abi.decode` only | Fine as primitive; keeps the redundancy and the silent mismatch |
| Return `bytes32[]`, callers `externalEuint8.wrap(h[0])` | Same verbosity as `abi.decode`, still no type check |
| One `encrypt` overload per type combination | 9<sup>k</sup> functions; not viable |
| `typed(...)` overloads on input type | Untyped literals are ambiguous (`typed(7)`), forcing `typed(uint32(7))` — back to the `abi.encode` verbosity |
| Builder (`in.add(u8(a)); in.encrypt();`) | More calls for no extra safety |

## Open questions

- Should `encrypt(bytes, …)` also return `Encrypted`, or stay `(bytes, bytes)` for
  compatibility with callers that feed the result straight into `decryptPublic(bytes)`?
- Is `e.u160(i)` acceptable for an address handle, or is `e.addr(i)` worth the asymmetry?

## Industry survey: how OpenZeppelin builds heterogeneous `(type, value)` lists

Surveyed checkouts: `openzeppelin-contracts`, `openzeppelin-confidential-contracts`,
`openzeppelin-community-contracts`, `uniswap-hooks` (local clones under `~/src/openzeppelin`).
Line numbers refer to those clones; links below are pinned to `openzeppelin-contracts@1f2665e` and
`openzeppelin-confidential-contracts@23ba154`.

### T1 — Parallel arrays

Separate arrays per field, lengths checked at runtime.

- `Governor.propose(address[] targets, uint256[] values, bytes[] calldatas, string description)`
  — `contracts/governance/Governor.sol:274`
- `TimelockController.scheduleBatch(...)` with `TimelockInvalidOperationLength`
  — `contracts/governance/TimelockController.sol:289-298`

Kept for Compound-era ABI compatibility. Not used for any new OZ API. Constructing it in a
Solidity test needs one `new X[](n)` per field plus index assignments; a length mismatch is a
runtime revert.

### T2 — Array of structs

One struct carries the type/meta with its value; the list is `Struct[]`, erased with `abi.encode`.

- `struct Execution { address target; uint256 value; bytes callData; }`
  — `contracts/interfaces/draft-IERC7579.sol:105`
- `ERC7579Utils.encodeBatch(Execution[])` / `decodeBatch(bytes) → Execution[]` with layout
  validation (`ERC7579DecodingError`) — `contracts/account/utils/draft-ERC7579Utils.sol:171-178`
- Test-side construction: `Execution[] memory calls = new Execution[](2);`
  — `test/account/utils/draft-ERC7579Utils.t.sol:147`

This is the shape of `TypedValue[]`.

### T3 — Builder / accumulator

A memory struct with typed `push` overloads that return `self` for chaining, and one terminal
`encode()`. O(1) per push, one allocation at the end.

- `RLP.Encoder`, `RLP.encoder()`, `push(Encoder, bool|address|uint256|bytes32|bytes|string|bytes[]|Encoder)`,
  `encode(Encoder)` — `contracts/utils/RLP.sol:77-135, 229`
- Backing structure: `Accumulators.push` / `flatten` — `contracts/utils/structs/Accumulators.sol:57, 100`

RLP's overloads are on distinct Solidity types, so literals resolve. All FHE widths are `uintN`,
so a single `push(7)` would be ambiguous; adders must carry the width in their name.

### T4 — Erased list + one typed reader per type

Positional list of erased items; the type is chosen at the read site, one reader per type, not
one per combination.

- `RLP.decodeList(bytes) → Memory.Slice[]` — `contracts/utils/RLP.sol:427`
- `RLP.readBool / readAddress / readUint256 / readBytes32(Memory.Slice)`
  — `contracts/utils/RLP.sol:271, 289, 313`

Direct precedent for the `e.u8(i)` / `e.u32(i)` accessors in this proposal.

### T5 — Generated fixed-arity overload families

Combinatorial overload sets are rendered from a template and diff-checked in CI, never
hand-written.

- `Packing.pack_1_1 … pack_N_M` (56 functions) — `contracts/utils/Packing.sol:36-…`
- Templates: `scripts/generate/templates/{Packing,Checkpoints,EnumerableMap,Arrays,SlotDerivation}.sol.eta`
- CI gate: `"generate"` and `"test:generation"` scripts — `package.json:27, 31`

(forge-std's `console.sol` is the well-known extreme of this technique; it is not vendored in
these checkouts, so it is cited from memory only.)

### T6 — Erase to `bytes32`, wrap per type

One real implementation over `bytes32`; every typed variant is a thin generated wrapper that
casts in and out.

- `EnumerableMap.Bytes32ToBytes32Map` (the implementation) — `contracts/utils/structs/EnumerableMap.sol:68`
- `EnumerableMap.UintToAddressMap` + `set(UintToAddressMap, uint256, address)` (a wrapper)
  — `contracts/utils/structs/EnumerableMap.sol:398-409`

Same structure as the `externalEuintN` family: all handles are `bytes32`; safety lives in the
typed wrapper.

### T7 — Opaque `bytes` with `abi.encode` / `abi.decode` at the boundary

The caller is expected to know the layout; no runtime type check is possible.

- `Multicall.multicall(bytes[] data)` — `contracts/utils/Multicall.sol:26`
- `ERC7579Utils.encodeSingle` / `decodeSingle` (`abi.encodePacked` + manual slicing)
  — `contracts/account/utils/draft-ERC7579Utils.sol:137-146`

This is the current `(bytes, bytes)` return of `encrypt`.

### T8 — Width-named builder returning `{handles[], inputProof}` (fhevm hardhat plugin)

The reference every fhevm user already knows, as consumed by OZ's confidential contracts:

```ts
fhevm.createEncryptedInput(token, holder).add64(amount).encrypt();
// → { handles: bytes32[], inputProof: bytes }
```

- `openzeppelin-confidential-contracts/test/token/ERC7984/ERC7984.behavior.ts:24-26`

Builder with width-named adders (`add64`, …), positional `handles[i]`, one proof.

### Not found

- **Two separate arrays** (`uint8[] typeIds, uint256[] values`) for a heterogeneous value list.
  Where OZ has the choice it uses T2.
- **One overload per type combination** for a variadic return. OZ either erases (T4/T7) or
  generates (T5).

## Each technique applied to `FhevmStd`

The same test — encrypt a `uint8` and a `uint32` for `dapp` on behalf of `alice`, then call
`dapp.deposit(externalEuint8, externalEuint32, bytes)` — written once per technique.

### T1 — Parallel arrays

OZ reference: [`Governor.propose`](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/1f2665e8d52677fd61f8daedc41ca77e1c64259d/contracts/governance/Governor.sol#L274) ·
[`TimelockController.scheduleBatch`](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/1f2665e8d52677fd61f8daedc41ca77e1c64259d/contracts/governance/TimelockController.sol#L289-L298)

```solidity
uint8[] memory types = new uint8[](2);
uint256[] memory values = new uint256[](2);
types[0] = uint8(FheType.Uint8);   values[0] = 3;
types[1] = uint8(FheType.Uint32);  values[1] = 70_000;

(bytes32[] memory h, bytes memory proof) = encrypt(types, values, address(dapp), alice);
dapp.deposit(externalEuint8.wrap(h[0]), externalEuint32.wrap(h[1]), proof);
```

Six setup lines, no compile-time width check (`values[1] = 5e9` compiles), length mismatch is
a runtime revert. Ruled out.

### T2 — Array of structs

OZ reference: [`struct Execution`](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/1f2665e8d52677fd61f8daedc41ca77e1c64259d/contracts/interfaces/draft-IERC7579.sol#L105) ·
[`ERC7579Utils.encodeBatch/decodeBatch`](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/1f2665e8d52677fd61f8daedc41ca77e1c64259d/contracts/account/utils/draft-ERC7579Utils.sol#L171-L178) ·
[test construction](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/1f2665e8d52677fd61f8daedc41ca77e1c64259d/test/account/utils/draft-ERC7579Utils.t.sol#L147)

```solidity
TypedValue[] memory batch = new TypedValue[](2);
batch[0] = u8(3);
batch[1] = u32(70_000);

Encrypted memory e = encrypt(batch, address(dapp), alice);
dapp.deposit(e.u8(0), e.u32(1), e.inputProof);
```

Widths are compiler-checked through `u8`/`u32`. Useful as the dynamic-length primitive the
fixed-arity overloads delegate to.

### T3 — Builder

OZ reference: [`RLP.Encoder` / `push` / `encode`](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/1f2665e8d52677fd61f8daedc41ca77e1c64259d/contracts/utils/RLP.sol#L77-L135) ·
[`Accumulators.push/flatten`](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/1f2665e8d52677fd61f8daedc41ca77e1c64259d/contracts/utils/structs/Accumulators.sol#L57)

```solidity
Encrypted memory e = input(address(dapp), alice).u8(3).u32(70_000).encrypt();
dapp.deposit(e.u8(0), e.u32(1), e.inputProof);
```

`input()` returns an `EncryptedInput` memory struct; `.u8(x)` appends a `TypedValue` and
returns `self`; `.encrypt()` runs the batch. Width-named adders avoid the literal ambiguity
RLP does not have to deal with. Mirrors T8 one-to-one.

### T4 — Erased list + typed readers

OZ reference: [`RLP.decodeList`](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/1f2665e8d52677fd61f8daedc41ca77e1c64259d/contracts/utils/RLP.sol#L427) ·
[`RLP.readBool/readAddress/readUint256`](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/1f2665e8d52677fd61f8daedc41ca77e1c64259d/contracts/utils/RLP.sol#L271-L313)

```solidity
Encrypted memory e = encrypt(u8(3), u32(70_000), address(dapp), alice);

externalEuint8 a = e.u8(0);      // reverts "FhevmStd: handle type mismatch" if slot 0 is not Uint8
externalEuint32 b = e.u32(1);
dapp.deposit(a, b, e.inputProof);
```

The read side of this proposal. The type check reads the FHE type id from byte 30 of the
handle.

### T5 — Generated fixed-arity overloads

OZ reference: [`Packing.pack_N_M`](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/1f2665e8d52677fd61f8daedc41ca77e1c64259d/contracts/utils/Packing.sol#L36) ·
[`Packing.sol.eta` template](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/1f2665e8d52677fd61f8daedc41ca77e1c64259d/scripts/generate/templates/Packing.sol.eta) ·
[`generation.sh` CI gate](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/1f2665e8d52677fd61f8daedc41ca77e1c64259d/scripts/checks/generation.sh)

```solidity
// Hand-written today, up to 4 slots:
Encrypted memory e = encrypt(u8(3), u32(70_000), address(dapp), alice);

// If the family grows, render it instead:
//   scripts/generate/templates/FhevmStdEncrypt.sol.eta  →  encrypt(a) … encrypt(a,b,c,d,e,f)
//   and a `check:generation` script that fails when the rendered file drifts.
```

No change at the call site; only where the overloads come from.

### T6 — Erase to `bytes32`, wrap per type

OZ reference: [`EnumerableMap.Bytes32ToBytes32Map`](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/1f2665e8d52677fd61f8daedc41ca77e1c64259d/contracts/utils/structs/EnumerableMap.sol#L68) ·
[`UintToAddressMap` wrapper](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/1f2665e8d52677fd61f8daedc41ca77e1c64259d/contracts/utils/structs/EnumerableMap.sol#L398-L409)

```solidity
Encrypted memory e = encrypt(u8(3), u32(70_000), address(dapp), alice);

// Without the typed readers, the caller wraps by hand:
dapp.deposit(externalEuint8.wrap(e.handles[0]), externalEuint32.wrap(e.handles[1]), e.inputProof);
```

Compiles for any pairing; a wrong width is only discovered inside the coprocessor mock. The
T4 readers are these wraps plus the check.

### T7 — Opaque `bytes` (current API)

OZ reference: [`Multicall.multicall`](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/1f2665e8d52677fd61f8daedc41ca77e1c64259d/contracts/utils/Multicall.sol#L26) ·
[`ERC7579Utils.encodeSingle/decodeSingle`](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/1f2665e8d52677fd61f8daedc41ca77e1c64259d/contracts/account/utils/draft-ERC7579Utils.sol#L137-L146)

```solidity
(bytes memory enc, bytes memory proof) = encrypt(u8(3), u32(70_000), address(dapp), alice);
(externalEuint8 a, externalEuint32 b) = abi.decode(enc, (externalEuint8, externalEuint32));
dapp.deposit(a, b, proof);
```

Kept as the low-level primitive and as the input shape for `decryptPublic(bytes)`. The type
list is restated and never verified.

### T8 — Hardhat-plugin mirror

OZ reference: [`ERC7984.behavior.ts` — `createEncryptedInput(...).add64(...).encrypt()`](https://github.com/OpenZeppelin/openzeppelin-confidential-contracts/blob/23ba15402346027f2416667acbb1e741179f8485/test/token/ERC7984/ERC7984.behavior.ts#L24-L26)

```solidity
Encrypted memory e = createEncryptedInput(address(dapp), alice).add8(3).add32(70_000).encrypt();
dapp.deposit(e.u8(0), e.u32(1), e.inputProof);
```

Identical mechanics to T3; only the names follow `@fhevm/hardhat-plugin` (`createEncryptedInput`,
`addN`) so a test ported from Hardhat reads the same. Choosing between T3 and T8 is a naming
decision, not a design one.

### Recommendation

- **Primitive:** T2 (`TypedValue[]`) under the hood, T7 (`bytes`) kept for `decryptPublic`.
- **Ergonomic entry:** fixed-arity `encrypt(u8(a), u32(b), …)` for 1–4 values (T5 if it grows),
  plus a T3/T8 builder for longer or data-driven batches.
- **Read side:** T4 typed readers on `Encrypted` (T6 wraps + the handle type check).
- **Ruled out:** T1.
