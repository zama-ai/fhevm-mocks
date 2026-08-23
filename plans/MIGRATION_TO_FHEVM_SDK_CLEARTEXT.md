# Plan — finish the migration: drop `@fhevm/mock-utils` + `@zama-fhe/relayer-sdk`, stand on `@fhevm/sdk` + `@fhevm/host-contracts-cleartext`

## The mission in one line

The plugin stops *simulating* FHEVM in JavaScript and starts *running* a real cleartext FHEVM stack:
deployment moves to `@fhevm/host-contracts-cleartext/ts`, and the client moves to `@fhevm/sdk` in
cleartext mode. `@fhevm/mock-utils` and `@zama-fhe/relayer-sdk` both disappear.

## Governing principle

> **`@fhevm/sdk` is always the source of truth.**

Chain definitions, contract addresses, gateway ids, relayer URLs, the FHE type taxonomy, encrypted-value
and decrypted-value shapes: where the SDK defines it, the plugin **imports it and does not restate it**.
Every table of addresses currently living in `internal/constants.ts` is a copy that can go stale — and
one already has (see step 3b: the plugin's Sepolia gateway addresses no longer match the SDK's).

The one deliberate exception is `FHEVM_HOST_CONTRACTS_CLEARTEXT_PACKAGE`, the canonical *local* stack.
Those addresses are owned by `@fhevm/host-contracts-cleartext` (`LocalHostAddresses.sol`), which the SDK
does not re-export, and the plugin needs them before any client exists in order to deploy. They are
verified against the package by the deploy test. If the SDK ever ships a `localcleartext` chain
definition, that copy should go too.

---

## Where we are

**Done.**

| | |
| - | - |
| `packages/hardhat-plugin/package.json` | `@fhevm/host-contracts` and `@zama-fhe/relayer-sdk` removed; `@fhevm/host-contracts-cleartext` (dep) and `@fhevm/sdk@^0.13.3` (peer) in place |
| `internal/deploy/setup.ts` | 628 → 181 lines, one `deploy()` call; verified end-to-end on anvil (10/10 canonical addresses, `ACL.owner()` == `ACLOwner`, ~2.1 s cold / ~21 ms idempotent) |
| `internal/deploy/ethersEthereumLib.ts` | vendored verbatim from upstream's reference adapter, `.prettierignore`d |
| `internal/constants.ts` | `FHEVM_HOST_CONTRACTS_CLEARTEXT_PACKAGE` — the canonical local address set + gateway triple |
| `scripts/install-dev-host-contracts-cleartext.sh` | integrity-based re-install of a rebuilt dev tarball |

**Current state of the tree.** It does not typecheck, and has not since `@fhevm/mock-utils` and
`@zama-fhe/relayer-sdk` were uninstalled. That is expected mid-migration. The baseline every step below
reduces is **47 `error TS` from `tsc --project tsconfig.build.cjs.json --noEmit`**. Thirteen files still
import one or both (a fourteenth, `constants.ts`, only mentions `@fhevm/mock-utils` as a string):

```
types.ts                                mock-utils + relayer-sdk   ← public API surface
internal/FhevmEnvironment.ts            mock-utils + relayer-sdk
internal/FhevmExternalAPI.ts            mock-utils + relayer-sdk
internal/provider/FhevmProviderExtender.ts  mock-utils
internal/errors/FhevmContractError.ts   mock-utils + relayer-sdk
internal/FhevmDebugger.ts               mock-utils
internal/FhevmEnvironmentPaths.ts       mock-utils
internal/types.ts                       mock-utils
internal/utils/hh.ts                    mock-utils
internal/deploy/addresses.ts            mock-utils
internal/deploy/ZamaConfigDotSol.ts     mock-utils
internal/deploy/PrecompiledFhevmHostContracts.ts  mock-utils      ← already logically dead
tasks/fhevm.ts                          mock-utils
```

---

## The decision that shapes everything else

`@fhevm/sdk@0.13.3` is **not** a drop-in for `FhevmInstance`. It is a different model, and this is the
single largest piece of work in the migration:

| `@zama-fhe/relayer-sdk` (`FhevmInstance`) | `@fhevm/sdk@0.13.3` (`FhevmClient`) |
| ----------------------------------------- | ----------------------------------- |
| `createInstance(config)` | `createFhevmCleartextClient({ provider, chain })` (local) / `createFhevmClient({ provider, chain })` (Sepolia, mainnet) — identical signatures, same return type |
| `createEncryptedInput(c, u).add32(v).encrypt()` | `encryptValue({ value: { type, value }, contractAddress, userAddress })` |
| `generateKeypair()` | `generateTransportKeyPair()` |
| `createEIP712(...)` + caller signs | `signDecryptionPermit(...)` / `createUnsignedUnifiedDecryptionPermitEip712` |
| `userDecrypt(handles, privKey, pubKey, sig, ...)` | `decryptValue({ encryptedValue, contractAddress, transportKeyPair, signedPermit })` |
| `publicDecrypt(handles)` | `decryptPublicValue(s)({ encryptedValues })` → `TypedValue[]` |
| handles as `bytes32` hex strings | `EncryptedValue` / `EncryptedValueLike` |
| `FhevmType` enum (mock-utils) | `FheType` string literals — `'ebool' \| 'euint8' \| … \| 'eaddress'` |
| results as `bigint \| boolean \| string` | `TypedValue` = `{ type: 'uint32', value: bigint }` |

**Recommendation: keep the plugin's ergonomic surface, reimplement its body.** `fhevm.userDecryptEuint`,
`fhevm.publicDecryptEbool`, `fhevm.encryptUint` and friends are what **52** test files under
`test/hardhat-mock-engine/` and every downstream user call. Preserving those signatures and rewriting them on top of `FhevmClient` confines the churn to
`FhevmExternalAPI.ts` and keeps the test suite as the regression net. Exposing `FhevmClient` raw would
be a clean break that invalidates the suite at the exact moment it is most needed.

Where the surface *must* change, change it deliberately and once:
- `createInstance(): FhevmInstance` → `createInstance(): FhevmClient` (no way around it)
- `createEIP712` + `userDecrypt(privateKey, publicKey, signature, …)` → permit + transport-key-pair.
  Consider keeping a `userDecryptEuint(type, handle, contract, signer)` convenience that does the
  permit dance internally — most tests only ever use that form.

---

## Steps

Ordered so the tree's error count falls monotonically and each step is independently verifiable.

### Step 0 — stub `FhevmExternalAPI` so the tree compiles again

Do this **first**, before any deletion. It is the step that converts "the package does not build" into
"the package builds and every unimplemented method says so", which is what makes steps 1–6 incremental
instead of one long red build.

Rewrite `internal/FhevmExternalAPI.ts` as a skeleton:

- **Keep every method signature**, so `types.ts` and the 52 test files still typecheck against it.
- **Every body becomes** `throw new HardhatFhevmError(\`fhevm.<name>() is not implemented yet (migration to @fhevm/sdk in progress).\`)`.
- **Drop all `@fhevm/mock-utils` / `@zama-fhe/relayer-sdk` imports from this file.** Parameter and return
  types that came from those packages get local placeholder aliases in one clearly-marked block — to be
  replaced with the real SDK types as each method lands.
- Mark the deprecated entries (below) with `@deprecated` in the same pass, so the intended end-state is
  visible from the file itself.

Then implement one method at a time, deleting its throw. Suggested order — it follows the test suite's
own dependency order: `getCoprocessorConfig` / `assertCoprocessorInitialized` → `encryptUint` /
`encryptBool` / `encryptAddress` → `publicDecryptE*` → `userDecryptE*` → the debug/HCU surface.

**Deprecated on arrival** — these expose the relayer-sdk model directly and have no clean `@fhevm/sdk`
equivalent. Keep them as `@deprecated` throwing stubs for one release, then delete:

| Entry | Why | Replacement |
| ----- | --- | ----------- |
| `createEIP712` | permit model replaced the raw EIP-712 handshake | `signDecryptionPermit` / `createUnsignedUnifiedDecryptionPermitEip712` |
| `createDelegatedUserDecryptEIP712` | same | delegated permit options on `decryptValue` |
| `generateKeypair` | keypair replaced by transport key pair | `generateTransportKeyPair()` |
| `createEncryptedInput` | returns `RelayerEncryptedInput`, a relayer-sdk builder type | `encryptValue` / `encryptValues` |
| `userDecrypt` / `delegatedUserDecrypt` (raw 8-arg forms) | take `privateKey`/`publicKey`/`signature` positionally | `decryptValue(s)` + permit; keep the `userDecryptE*` conveniences |
| `getRelayerMetadata` | pure mock-engine RPC (`fhevm_relayer_metadata`) — nothing serves it once the JS engine is gone | none; delete |

**DONE.** `tsc --project tsconfig.build.cjs.json --noEmit`: **47 → 32 errors**. Delivered:

- `internal/migration/placeholders.ts` — new; every type formerly imported from the two doomed
  packages, each tagged `OWN` / `SDK` / `DELETE` with its intended fate
- `internal/FhevmExternalAPI.ts` — fully stubbed; 19 methods throw `__notImplemented`, 7 throw
  `__deprecated`, signatures unchanged
- `types.ts` — rewired to the placeholders; deprecated members marked `@deprecated`
- `FhevmEnvironmentPaths.ts` — mock-utils version-consistency check removed (it was self-contained)
- `utils/hh.ts`, `deploy/addresses.ts` — local replacements for `connectedChainId`,
  `isHardhatProvider`, `utils.ensureSuffix`
- `internal/types.ts`, `deploy/ZamaConfigDotSol.ts` — import swaps

The remaining 32 sit entirely in files that steps 1–3 delete or rewrite — `FhevmProviderExtender`
(19, the JS mock engine), `FhevmEnvironment` (7), `tasks/fhevm.ts` (2), `errors/FhevmContractError.ts`
(2), `PrecompiledFhevmHostContracts.ts` (1), `FhevmDebugger.ts` (1). Stubbing those would be throwaway
work, so the build goes green at the end of step 3, not here.

### Step 1 — delete the address-discovery machinery

Nothing here has a purpose once addresses are constants.

- Replace `FhevmEnvironment._initializeAddressesMock` with the constants from
  `FHEVM_HOST_CONTRACTS_CLEARTEXT_PACKAGE`.
- Delete `internal/deploy/PrecompiledFhevmHostContracts.ts` and, with it (all verified zero-caller):
  `computeDummyAddress` (`utils/hh.ts`), `cachePrecompiledFhevmHostContractsAddressesJson` and
  `getFhevmHostContractsArtifact` / `resolveFhevmHostContractsArtifactRootDir`
  (`FhevmEnvironmentPaths.ts`), `PrecompiledHostContractsAddresses` (`internal/types.ts`),
  `FHEVM_HOST_CONTRACTS_PACKAGE` (`constants.ts`).
- Delete the `install-solidity` subtask (`tasks/fhevm.ts`) and its recursion guards
  `setRunningInHHFHEVMInstallSolidity` / `unsetRunningInHHFHEVMInstallSolidity`.

**Decide separately:** `ZamaConfigDotSol.ts` has four callers and only the mock one dies here. The
Sepolia/mainnet calls pass no addresses at all — they exist purely to rewrite `../lib/FHE.sol` for the
`@fhevm/solidity/config` remapping. Drop the remapping (`FhevmEnvironment.getRemappings`) and all four
go; the `.env`-override path at `_initializeAddressesEnv` is the only one doing real substitution and
is the only thing to weigh.

**DONE.** `tsc --project tsconfig.build.cjs.json --noEmit`: **32 → 28 errors**. Deleted:

- `internal/deploy/PrecompiledFhevmHostContracts.ts` (whole file)
- `FhevmEnvironment._initializeAddressesMock` now reads `FHEVM_HOST_CONTRACTS_CLEARTEXT_PACKAGE`
  directly — no discovery, no JSON cache, no child process
- the `install-solidity` subtask, `SCOPE_FHEVM_TASK_INSTALL_SOLIDITY`, and the
  `set/unset/isRunningInHHFHEVMInstallSolidity` re-entry guards
- `FhevmEnvironmentPaths`: `cachePrecompiledFhevmHostContractsAddressesJson`,
  `resolveFhevmHostContractsArtifactRootDir`, `resolveFhevmHostContractsArtifactPath`,
  `getFhevmHostContractsArtifact`
- `constants.FHEVM_HOST_CONTRACTS_PACKAGE`, `internal/types.ts`'s
  `PrecompiledHostContractsAddresses`, `utils/hh.ts`'s `computeDummyAddress`
- the whole `ignoreCache` / `ignoreAddressesCache` plumbing, which only existed to invalidate the
  discovery cache

Added `assertIsAddress` to `internal/utils/ethers.ts` (replacing `@fhevm/mock-utils/utils`), which is
what lets `.env`-sourced addresses narrow to `0x${string}` without a cast.

*Verified:* `deployFhevmCleartextHostContracts` still lands the canonical stack on anvil (ACL at
`0x50157CFf…`, `ACL.owner()` == the standing `ACLOwner`). Of the 28 remaining errors, 27 are missing
`@fhevm/mock-utils` / `@zama-fhe/relayer-sdk` imports and the 28th is the dangling
`setupMockUsingHostContractsArtifacts` reference — all step 2/3 work.

**Still open from this step:** `ZamaConfigDotSol.ts` survives — `_initializeAddressesMock` still calls
`generateZamaConfigDotSol`, as do the env/Sepolia/mainnet paths. Removing it means dropping the
`@fhevm/solidity/config` remapping, which is a step 3b decision.

### Step 2 — delete the JS mock engine

This is pure deletion; the cleartext stack does this work on-chain.

- `FhevmProviderExtender`: remove all seven `fhevm_relayer_*` / `FHEVM_GET_CLEAR_TEXT` handlers and the
  `evm_revert` hook. What remains is the genuinely useful part: `eth_estimateGas` inflation and the
  `eth_sendTransaction` error decoration.
- `FhevmEnvironment`: remove `_mockCoprocessor`, `FhevmDBMap`, `_relayerSignerAddress`,
  `useEmbeddedMockEngine`, `coprocessor`, `_createSigners`, `loadKMSSigners` / `loadCoprocessorSigners`
  (`internal/deploy/addresses.ts`), `HARDHAT_RELAYER_SIGNER_INDEX`, `PRIVATE_KEY_KMS_SIGNER`,
  `PRIVATE_KEY_COPROCESSOR_SIGNER`, `KMS_THRESHOLD`, `INPUT_VERIFIER_THRESHOLD`.
- `getRelayerMetadata` leaves the public API with them.

Signers are `@fhevm/sdk`'s business now: its cleartext relayer derives KMS/coprocessor keys from
`FHEVM_MNEMONIC` at fixed HD paths and looks them up by the address the chain reports. Note the two keys
currently in `constants.ts` are the ones the SDK special-cases as "forge-fhevm v1" — a compat path, not
the v13 default (4 nodes each, threshold 4).

**DONE.** `tsc --project tsconfig.build.cjs.json --noEmit`: **28 → 8 errors**, and all 8 remaining are
missing-package imports (`TS2307`) — there is not a single logic error left in the tree.

- `FhevmProviderExtender` — all seven `fhevm_relayer_*` / `fhevm_get_clear_text` handlers and the
  `evm_revert` hook deleted; the file is now **clean** (0 errors, down from 19). What survives is the
  two behaviours that were never about mocking FHE: `eth_estimateGas` inflation and
  `eth_sendTransaction` error decoration.
- `ProviderExtender.ts` — the startup `eth_blockNumber` round-trip is gone; it only existed to seed the
  in-memory DB's block number, so plugin init is now one RPC call lighter.
- `FhevmEnvironment` — `_mockCoprocessor`, `_relayerSignerAddress`, `useEmbeddedMockEngine`,
  `coprocessor`, `getRelayerSignerAddress`, `_createSigners` all deleted, plus the `_id`/`_idCount`
  instance counter that existed only for a mock-engine error message.
- `internal/deploy/addresses.ts` — **entire 256-line file deleted**; every export
  (`loadKMSSigners`, `loadCoprocessorSigners`, `loadRelayerSignerAddress`, `loadRelayerSigner`,
  `getKMSThreshold`, `getInputVerifierThreshold`, `getGatewayDecryptionAddress`,
  `getGatewayInputVerificationAddress`) became unreachable at once.
- `constants.ts` — `PRIVATE_KEY_KMS_SIGNER`, `PRIVATE_KEY_COPROCESSOR_SIGNER`,
  `HARDHAT_RELAYER_SIGNER_INDEX`, `KMS_THRESHOLD`, `INPUT_VERIFIER_THRESHOLD`,
  `FHEVM_MOCK_UTILS_PACKAGE_NAME` removed.

`_deployCore`'s local branch now calls `deployFhevmCleartextHostContracts(hre.ethers.provider)` —
the dangling `setupMockUsingHostContractsArtifacts` reference is resolved. `_contractsRepository` is
deliberately left unassigned on that branch with a `TODO(migration step 5)`: nothing reads it while
`FhevmExternalAPI` is stubbed, so this is not a regression.

*Verified:* the canonical stack still deploys on anvil (ACL at `0x50157CFf…`, `ACL.owner()` == the
standing `ACLOwner`).

**Remaining 8**, all `TS2307`: `FhevmEnvironment.ts` (3), `tasks/fhevm.ts` (2),
`errors/FhevmContractError.ts` (2), `FhevmDebugger.ts` (1).

### Step 3 — swap the client

- `FhevmEnvironment.createInstance()` → `createFhevmCleartextClient({ provider: hre.ethers.provider, chain })`.
- Build the chain once with `defineFhevmChain` from `@fhevm/sdk/chains`, from
  `FHEVM_HOST_CONTRACTS_CLEARTEXT_PACKAGE`: `id: 31337`, `acl`/`inputVerifier`/`kmsVerifier`/
  `protocolConfig`, `gateway.id: 654321`, gateway `decryption` / `inputVerification`. This is exactly the
  SDK's own `test/chains/localcleartext.ts` — cross-check against it.
- Delete `zamaFheRelayerSdkCreateInstance`. The `isEthereum` branch stays, but switches to `@fhevm/sdk`
  in **non-cleartext** mode — see the section below.

**DONE** (steps 3 and 3b together). `tsc --project tsconfig.build.cjs.json --noEmit`: **8 → 6 errors**.

- `internal/chains.ts` (new) — `localCleartext` built with `defineFhevmChain` from
  `FHEVM_HOST_CONTRACTS_CLEARTEXT_PACKAGE`; `sepolia` / `mainnet` re-exported straight from
  `@fhevm/sdk/chains`.
- `createInstance()` → `createFhevmCleartextClient` (local) / `createFhevmClient` (sepolia, mainnet),
  with `initFhevmRuntime()` awaited on the public-network path only. `_instance` is now an
  `FhevmClient`.
- `__initFhevmRuntimeConfig()` — calls `setFhevmRuntimeConfig` exactly once, guarded by
  `hasFhevmRuntimeConfig()`, and carries the API key.
- `_initializeAddressesSepolia` / `_initializeAddressesMainnet` now read the SDK chain definitions;
  `resolveRelayerUrl` looks the url up from them. `ZAMA_FHE_RELAYER_SDK_PACKAGE` is no longer read.
- `HCULimitAddress` dropped from `FhevmEnvironmentAddresses` — it had no reader anywhere.

**Verified against a live stack on anvil:** all four chain-definition addresses (`acl`,
`inputVerifier`, `kmsVerifier`, `protocolConfig`) match what the deploy produced; the client
constructs, `client.ready` resolves, and it reports
`protocolVersion = {"version":"0.13.0","comparator":"eq"}` — an exact v13 match read off the chain.

**API notes for step 4:** `client.ready` must be awaited before touching `protocolVersion` (or any
context-dependent member) — accessing it early throws `Fhevm context has not been resolved`. And the
`auth` discriminant is `type`, not the relayer-sdk's `__type`.

**Two upstream gaps hit** (both recorded in `HOST_CONTRACTS_CLEARTEXT_UPSTREAM_FIXES.md`): every
`core/`-backed `@fhevm/sdk` subpath is unresolvable under `node10`, and `FhevmClient` is not exported
from any public entry — it is recovered by inference in `internal/sdkTypes.ts`.

**Not done here:** `FhevmMockProvider` / `FhevmMockProviderType` / `MinimalProvider` and the
`contracts` repository still come from `@fhevm/mock-utils`; that is the provider abstraction and is
step 5/6 work.

### Step 3b — Sepolia / mainnet on `@fhevm/sdk`, non-cleartext

Both modes are the same SDK and the same client shape; only the runtime differs.

```
local (31337)        createFhevmCleartextClient({ provider, chain: localCleartextChain })
sepolia / mainnet    createFhevmClient({ provider, chain: sepolia | mainnet })
```

`createFhevmClient` and `createFhevmCleartextClient` have **identical signatures** and both return
`FhevmClient<chain, WithAll, provider>`, so `FhevmExternalAPI` is written once against `FhevmClient`
and never branches. The branch collapses to picking a factory and a chain.

Four concrete differences to handle:

1. **`setFhevmRuntimeConfig` is required for both**, and must be called before any client is created.
   Both runtimes throw `Call setFhevmRuntimeConfig first.` otherwise. It is a process-global singleton
   that *throws if called twice with different parameters*, so the plugin must call it exactly once, at
   a well-defined point (environment init), with one config for the whole run.
2. **Only the real mode needs WASM.** `initFhevmRuntime()` loads TFHE/TKMS and initialises the
   non-cleartext runtime only; cleartext never calls it. So it is an `await` on the Ethereum path and
   absent on the local path. The two runtimes are separate module-level singletons sharing one config,
   so both can coexist in one process.
3. **The API key moves.** Today: `createInstance({ auth: { __type: 'ApiKeyHeader', header: 'x-api-key',
   value: ZAMA_FHEVM_API_KEY } })` — per client. Now: `auth` is a field of `FhevmRuntimeConfig`, so
   `ZAMA_FHEVM_API_KEY` is passed to `setFhevmRuntimeConfig` instead. Combined with (1), that means the
   key must be read *before* the first client of either kind is built.
4. **The chain definition replaces the plugin's address tables** — and they currently disagree.

**The plugin's hardcoded Sepolia gateway addresses are stale.** Compared against `@fhevm/sdk@0.13.3`'s
own `sepolia` definition:

| | `@fhevm/sdk` | plugin `constants.ts` | |
| - | ------------ | --------------------- | - |
| gateway chainId | `10901` | `10901` | match |
| gateway `decryption` | `0x5D8BD78e2ea6bbE41f26dFe9fdaEAa349e077478` | `0x5ffdaAB0373E62E2ea2944776209aEf29E631A64` | **differ** |
| gateway `inputVerification` | `0x483b9dE06E4E4C7D35CCf5837A1668487406D955` | `0x812b06e1CDCE800494b79fFE4f925A504a9A9810` | **differ** |
| `protocolConfig` | `0x51f9AFBc89Ea792e1a21a12AB802ab58D4dbee83` | absent | **v13 contract the plugin has no slot for** |
| ACL / KMSVerifier / InputVerifier | — | — | match |

So this is not only a library swap: the plugin is carrying an out-of-date view of Sepolia. **Adopt the
SDK's `sepolia` / `mainnet` definitions as the single source of truth** and delete the plugin's copies:

- `_initializeAddressesSepolia`, `_initializeAddressesMainnet` → `import { sepolia, mainnet } from '@fhevm/sdk/chains'`
- `ZAMA_FHE_RELAYER_SDK_PACKAGE` (both `sepolia` and `mainnet` blocks) → delete
- `DECRYPTION_ADDRESS`, `INPUT_VERIFICATION_ADDRESS` in `constants.ts` → these are the **local
  cleartext** gateway values (`0xEaaA2FC6…` / `0x6189F6c0…`, chainId `654321`), already captured in
  `FHEVM_HOST_CONTRACTS_CLEARTEXT_PACKAGE.gateway`; the old Sepolia-flavoured pair goes
- `resolveRelayerUrl` → `chain.fhevm.relayerUrl` is part of the definition
  (`https://relayer.testnet.zama.org`), so the lookup disappears

**What to keep:** the `.env` override path (`_initializeAddressesEnv` / `FHEVM_HARDHAT_NETWORK=devnet`)
is the only remaining reason to build a chain by hand. Keep it as `defineFhevmChain({...})` fed from the
existing env vars, and add `PROTOCOL_CONFIG_CONTRACT_ADDRESS` — v13 needs it and the current `.env`
schema has no slot for it.

*Verify:* `npm run test:sepolia:testnet` (`FHECounterPublicDecrypt`) against the real testnet — that
suite exists precisely to cover this path.

### Step 3c — green the build

Not in the original plan: the build was expected to go green at the end of step 3, but the blocker
turned out to be the provider abstraction (step 6 work), not the client. Done as its own pass.

**DONE. `tsc --project tsconfig.build.cjs.json --noEmit`: 6 → 0 errors.** `npm run rebuild:cjs` and
`rebuild:types` both emit, and the output loads under Node.

Four modules graduated out of `migration/placeholders.ts` into real homes — these are the `OWN`
entries, so this is step 5 work done early where it was cheapest:

- `internal/fheType.ts` — the taxonomy plus `tryParseFhevmType`, `isFhevmEuint/Ebool/Eaddress`,
  `getFhevmTypeName`, and `fhevmTypeToSdkType` (the bridge to the SDK's string-literal `FheType`,
  which rejects `euint4` — the SDK has no counterpart for it).
- `internal/coprocessorConfig.ts` — `getCoprocessorConfig`, ported from mock-utils. Note this is
  **not** the SDK's `resolveFhevmConfig`: that resolves a *chain*'s config from the protocol
  contracts, whereas this reads the ERC-7201 `confidential.storage.config` slot inside a *user's*
  contract. No SDK equivalent; the plugin owns it.
- `internal/networkProvider.ts` — `FhevmNetworkProvider`, replacing `FhevmMockProvider`. Much thinner
  than what it replaces: the old one probed `web3_clientVersion` and negotiated
  `setCode`/`setBalance`/`impersonateAccount` spellings, all to drive the JS mock engine. With that
  gone, network name + live chain id is enough.
- `internal/sdkTypes.ts` — `FhevmClient`, recovered by inference (see upstream problem 4).

Stubbed rather than ported, consistently with `FhevmExternalAPI`:

- `FhevmDebugger` — every method read cleartexts through the deleted mock-engine RPCs.
- the `fhevm resolve-fhevm-config` CLI task — the SDK's `resolveFhevmConfig` is the right
  replacement, but it needs a `Fhevm` client and `createFhevmBaseClient` requires a complete
  `FhevmChain`, while the command is given only an ACL + KMSVerifier and is meant to discover the
  rest. Resolving that shape is step 4 work.

`migration/placeholders.ts` now also pins down `FhevmContractsRepository` — the exact surface the
plugin still reads (`acl`, `fhevmExecutor`, `inputVerifier`, `kmsVerifier`, `addressToContractMap`,
`getContractFromAddress`, `getContractFromName`) — so step 5 knows precisely what to rebuild and
nothing more. It records the v13 catch: the KMS signer set moved to `ProtocolConfig`, so
`getKmsSigners()` must be re-sourced rather than ported.

### Step 4 — fill in the `FhevmExternalAPI` stubs

The largest single body of work: replace step 0's throws with real implementations on `FhevmClient`,
one method at a time, per the mapping table above. The `userDecryptE*` family needs a permit +
transport key pair where it used to need `createEIP712` + a signature — hide that inside the
convenience methods so tests keep their shape.

The deprecated entries from step 0 stay throwing; they are not implemented, only documented and later
deleted.

**MOSTLY DONE — 16 of 21 implemented, and the plugin runs.** `npx hardhat compile` works (82
contracts, 222 typings) and real tests pass end to end.

Implemented: `initializeCLIApi`, `isMock`, `debugger`, `createInstance`, `getCoprocessorConfig`,
`assertCoprocessorInitialized`, `createEncryptedInput`, `encryptUint`/`Bool`/`Address`,
`publicDecrypt`, `publicDecryptEbool`/`Euint`/`Eaddress`, `userDecryptEbool`/`Euint`/`Eaddress`.

Still stubbed (all step 5 — they need the contracts repository or handle machinery): `typeof`,
`tryParseFhevmError`, `revertedWithCustomErrorArgs`, `parseCoprocessorEvents`,
`computeTransactionHCU`.

### Correction: `createEncryptedInput` is NOT deprecated

Step 0 listed it for removal. That was wrong, and running the suite proved it: **all 35 test files
encrypt through it**, and more importantly it expresses something the singular helpers cannot —
several values sharing **one** input proof, which is both cheaper and what a contract taking multiple
`externalEuintXX` arguments requires. `@fhevm/sdk` supports exactly this as `encryptValues`.

So it is reimplemented, not deleted: `internal/encryptedInput.ts` is an accumulate-then-`encrypt()`
builder (`add8`/`add16`/…/`addBool`/`addAddress`) over `encryptValues`, returning the historical
`{ handles, inputProof }`. The remaining six deprecations stand — they expose the relayer-sdk's
keypair/EIP-712 model, which has a genuine replacement in permits.

### Test-side changes

`FhevmType` was imported directly from `@fhevm/mock-utils` in 30 test files; rewritten to the
plugin's own public API (`src/types`), which re-exports it. Seven imports across six files remain —
`utils`, `getHCU`, `ClearValueType`, `UserDecryptResults`, `FhevmInstance`.

### Results so far

| suite | result |
| ----- | ------ |
| `internal/AplusB` | ✅ passes — batched encrypt → contract call → on-chain FHE add → user decrypt |
| `internal/FHECounterUserDecrypt` | ✅ 5/5 |
| `internal/TestACL` | 3/4 — the failure is `revertedWithCustomErrorArgs` (stubbed) |
| `internal/FHECounterPublicDecrypt` | 1/2 — ethers ABI arg error passing decryption signatures to the contract |
| `doc-examples` (4 files run) | 4 passing / 5 failing — `HeadsOrTails` and one message assertion |

Two failure classes beyond the known stubs, both to chase in step 5:

- **`HeadsOrTails`** — `Cannot read properties of undefined (reading 'then')`, i.e. something awaited
  is `undefined`. Likely the signature/`debugger` path.
- **Error-message drift** — `DecryptSingleValue` asserts on `/^dapp contract .* is not authorized/`
  and `@fhevm/sdk` says `Dapp contract 0x… `. A test-side fix, but worth deciding deliberately
  whether the plugin normalizes SDK error messages or the tests follow them.

*Verify:* `test/hardhat-mock-engine/` — `doc-examples/`, then `internal/`, then the `operators*`
suites (the bulk, and the most mechanical; not yet run).

### Step 5 — re-home what has no replacement

Neither new package provides these. They move into the plugin (or a small internal module):

| Lost with mock-utils | Used by |
| -------------------- | ------- |
| `FhevmTransactionHCUInfo`, `computeTransactionHCU`, `operatorsPrices.json` | `FhevmExternalAPI`, HCU tests |
| `CoprocessorEvent`, `parseCoprocessorEventsFromLogs` | `FhevmExternalAPI`, `types.ts` |
| `FhevmContractError`, `FhevmContractErrorList`, `parseFhevmError` | error decoding; needs contract ABIs — take them from `@fhevm/host-contracts-cleartext`'s `./abi/*.json` export |
| `FhevmDebugger` | public API |
| `FhevmHandle` / `FhevmHandleCoder` | partly replaceable by the SDK's `EncryptedValue` / `asEncryptedValue` / `isEncryptedValue` |
| type taxonomy (`FhevmType`, `getFhevmTypeInfo`, `isFhevmEuint`, `tryParseFhevmType`) | see gap below |

**Known gap:** the SDK has the taxonomy (`FheType` = `'ebool' | 'euint8' | … | 'eaddress'`,
`FheTypeToValueTypeMap`, `FheTypeToIdMap` in `core/types/fheType.d.ts`) but **does not export it** —
`core/types/index.d.ts` exposes only `EncryptedValue`, `TypedValue`, `Eip712Like`, the client types and
`asEncryptedValue`/`isEncryptedValue`. `encryptValue` takes `type: string`, so it is usable without,
but with no compile-time checking. Either define the union locally, or ask upstream to export
`FheType` — worth doing, it is one line and every consumer needs it.

### Step 5 — DONE

**Every `FhevmExternalAPI` stub is implemented** — `__notImplemented` no longer exists. Build is green
and **zero files in `src/` or `test/` import `@fhevm/mock-utils` or `@zama-fhe/relayer-sdk`.**

- `internal/contractsRepository.ts` — ABI-only, from `@fhevm/host-contracts-cleartext`'s
  `./abi/*.json`. Far smaller than what it replaces: the old repository also carried signer sets,
  gateway addresses and EIP-712 domains for the mock engine to forge relayer responses. Its one
  remaining job is decoding a revert into the custom error that produced it. The dead signer/gateway
  accessors were deleted from `FhevmEnvironment` with it, and `getGatewayChainId` now reads the chain
  definition.
- `internal/fhevmHandle.ts` — handle decoding (byte 30 is the type, byte 21 the input index), which
  `typeof` and HCU pricing both need.
- `internal/hcu/` — `hcu.ts` + `HCUByOperator.ts` ported from mock-utils essentially unchanged, since
  the v13 `CleartextFHEVMExecutor` emits the same operator events the price table is keyed by. Plus
  `fheTypeName.ts` (the `"Uint32"` spelling the table uses, mapped from `FhevmType`), `events.ts` and
  `eventArgs.ts`. Only the widths the table can actually price are declared — mock-utils declared the
  full protocol enum to `Uint2048`.
- `parseCoprocessorEvents` implemented against the repository's executor interface. Worth noting it
  is now near-vestigial: the cleartext stack evaluates operators on-chain, so nothing *computes* from
  these events, and the whole test suite references it once, in a commented-out line.

### `publicDecrypt` needed the signatures too

`decryptPublicValues` returns only values. Contracts verify decryptions on-chain
(`contract.verify(handles, abiEncodedClearValues, decryptionProof)`), so `publicDecrypt` uses
`decryptPublicValuesWithSignatures` and `PublicDecryptResults` regained `abiEncodedClearValues` /
`decryptionProof`. `FHECounterPublicDecrypt` is 6/6 with on-chain proof verification passing.

### Test-side

All remaining imports cleared. `timestampNow` and `getHCU` are now exported from the plugin's public
API (`src/types`) rather than pulled from mock-utils; `ClearValueType`, `UserDecryptResults` and
`FhevmInstance` type annotations were dropped where inference suffices.

### Checkpoint

16 passing across `AplusB`, `TestACL`, `FHECounterPublicDecrypt`, `fhevmHCU1`, `EncryptSingleValue`,
`EncryptMultipleValues`. Two known failure classes remain, both **decisions rather than defects**:

1. **`generateKeypair()` + `createEIP712` + `userDecrypt(...)`** — `FHECounterUserDecrypt` and
   `DecryptMultipleValues` use the old positional flow, which is deprecated. Either rewrite those
   tests onto `userDecryptE*`, or implement the deprecated three on top of permits for one release.
2. **Error-message drift** — `DecryptSingleValue` asserts `/^dapp contract .* is not authorized/`;
   `@fhevm/sdk` says `Dapp contract 0x…`. Decide whether the plugin normalizes SDK messages or the
   tests follow the SDK.

### Operators — DONE, and the debugger was the keystone

The `operators*` suites turned out to rest entirely on `fhevm.debugger.decryptEuint`/`decryptEbool`:
all 400 tests in the first file failed on the stub, none for any other reason. Implementing the
debugger took that file from **0 passing to 200/200**, and the full set to **2518 passing, 0 failing**
(2394 across `operators/`, 124 across `operators-manual/` + `operators-public-decrypt/`).

`FhevmDebugger` now reads `CleartextDB.get(bytes32) -> uint256` directly. That is the same capability
it always had — cleartext access with no ACL check, which is exactly what an operator test needs to
assert `FheAdd(a, b)` without arranging permissions — just served by one `eth_call` instead of a
`fhevm_get_clear_text` RPC into an in-process coprocessor. It refuses to run on a public network,
where values are really encrypted.

### Full suite: 2616 passing, 2 pending, 22 failing

Both remaining classes are the postponed relayer-sdk model, not defects:

| # | failure | files |
| - | ------- | ----- |
| 14 | `instance.publicDecrypt is not a function` | `Rand.ts` — holds a raw `createInstance()` result and calls relayer-sdk methods on it. `FhevmClient` has `decryptPublicValues`. |
| 8 | `fhevm.generateKeypair()` deprecated | `ConfidentialERC20`, `DecryptMultipleValues`, `FHECounterUserDecrypt`, `delegatedUserDecryption` |

Both resolve together when the deprecated keypair/EIP-712 flow is addressed — the same work item.

### Step 6 — clean the seams

`internal/types.ts` and `types.ts` re-export mock-utils types as the plugin's public API. Redefine them
locally or re-export the SDK equivalents. `internal/utils/hh.ts` needs local `isHardhatProvider` /
`connectedChainId`. Then drop `@fhevm/mock-utils` from the workspace and decide the fate of
`packages/mock-utils` itself.

### Step 7 — retire the workarounds and the docs

- Once upstream ships CJS-flavoured declarations, drop the `node10` pin (see
  `HOST_CONTRACTS_CLEARTEXT_UPSTREAM_FIXES.md`, fix 1b).
- Update README/docs: the plugin no longer "mocks" anything — it deploys a cleartext stack.
- Rename? `FhevmMockProvider`, `useEmbeddedMockEngine`, `isMock`, `test/hardhat-mock-engine/` are all
  named for a thing that no longer exists.

---

## Verification strategy

The test suite is the only real safety net and it is currently un-runnable, so restore it early:

1. **Step 0 restores the build.** Baseline 47 errors → target 0, with every unimplemented method
   throwing at runtime instead of failing at compile time. From here the compiler stays green and
   progress is measured in deleted `throw`s, not in error counts.
2. **Steps 1–2 are deletions** — the compiler is the check; it must stay at 0.
3. **First runnable milestone is end of step 3**: one encrypt/decrypt round-trip. Get here fast; it
   proves deploy + client + chain definition agree.
4. **Step 4 onwards, per-suite**: `doc-examples/` → `internal/` → `operators*`. A test that hits a
   still-stubbed method fails with a named "not implemented yet", which doubles as the worklist.
5. Keep the anvil harness from the setup.ts work as a smoke test that does not need the plugin to build.

## Risks, in order

1. **`FhevmExternalAPI` (step 4) is the whole migration's cost.** Everything else is deletion or
   rewiring. Budget accordingly, and do not start it before step 3 gives a working round-trip.
2. **The plugin's Sepolia gateway addresses are stale** (see step 3b). Anything that looked like it
   worked on Sepolia recently is worth re-checking — this is a correctness bug today, independent of
   the migration.
3. **Missing `FheType` export** — small, but it touches every typed call site. Raise upstream now so the
   answer arrives before step 4.
4. **The public API breaks regardless.** `createInstance()` returns a different type. Version and
   changelog accordingly — this is a major bump for `@fhevm/hardhat-plugin`.
5. **`@fhevm/mock-utils@0.4.2` is a published package**, not just an internal dependency — published
   from `packages/mock-utils/src/` (the outer `packages/mock-utils/package.json` is a private wrapper).
   Removing the plugin's use of it is not the same as deleting it; that is a separate release decision.
