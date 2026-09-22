# The HCU limit becomes a cleartext contract, in v13 and v12

Status: IMPLEMENTED (2026-09-22), v13 and v12. Every layer deploys the cleartext contract, no layer can name
the plain one without a test failing, and the results are in §9.

Three decisions changed during the work, all narrowing the surface:
- `CleartextHCULimit` carries `IS_CLEARTEXT` only. The generation marker stays on `CleartextACL` alone, the
  one address every consumer already holds through `ZamaConfig`.
- `LibCleartextProbe` gained `isForge`, the strictly narrower question, with `test/forge/LibCleartextProbe.t.sol`
  proving both answers on a live stack.
- `pkg/src/cleartext/shared/FhevmEvents.sol` was renamed to `LibFhevmEvents.sol`, matching the library it
  declares, along with its test.

## 0. What this is

`HCULimit` is the LAST proxy in the cleartext stack still holding a production implementation. Every other
role is a cleartext substitution — `CleartextACL`, `CleartextFHEVMExecutor`, `CleartextKMSVerifier`,
`CleartextInputVerifier` — plus the two cleartext-only roles. Three consequences:

- `LibCleartextProbe.isCleartext(HCU_LIMIT_ADDRESS)` is FALSE. A consumer probing the stack one contract at a
  time finds one that looks like a production deployment.
- `CleartextHCULimit.sol` and `CleartextForgeHCULimit.sol` exist in v13 (untracked, added 2026-09-22) and are
  referenced by NOTHING. The meter in the forge variant — `lastTransactionHCU`, `maxHandleHCU`, cleared per
  transaction — is unreachable.
- v12 has neither file.

The target is the `CleartextACL` + `CleartextForgeACL` pattern exactly: the marker contract behind every
BROADCAST path, the forge variant (which calls cheatcodes) behind the IN-PROCESS forge stack, and
`src/contracts/HCULimit.sol` deployed by nothing.

### Decisions taken as defaults

| Decision | Default | If flipped |
|---|---|---|
| Both files, both generations | v13 and v12 each get `CleartextHCULimit` (markers only) and `CleartextForgeHCULimit`. | v12 could take the marker contract alone and keep one implementation for both paths, like `CleartextDB`. Cheaper, but then the two generations differ in shape and the next port has to re-derive the answer. |
| v12's forge variant | **Carries the meter too**, same source as v13's. The v12 stack is what `test:upgrade` boots before upgrading, and a meter that exists in one generation only makes a gas comparison across the upgrade impossible. | Empty hook, as `CleartextForgeACL` started; then say so in its header. |
| Generated interface | Follows the precedent: `contractName: 'CleartextHCULimit'` generates `ICleartextHCULimit.sol`, and `IHCULimit.sol` disappears. | Keep the name `HCULimit` in `TARGET_CONTRACTS` and move only `sourcePath`. No ripple, but the generated interface would then be named after a contract the stack does not deploy. |
| `abi.encodeCall` targets | Unchanged: `UpgradeInitData` keeps `abi.encodeCall(HCULimit.reinitializeV3, ())`. The selector is what travels, `CleartextHCULimit` inherits the function without redeclaring it, and solc cannot form a function pointer to an inherited member — the same reason `FhevmDeployScript` encodes `ACL.initializeFromEmptyProxy` for a `CleartextACL` implementation. | — |

### Facts verified (2026-09-22)

- **Code size is not a blocker.** Runtime sizes against the EIP-170 limit of 24576 bytes:

  | Contract | Runtime bytes |
  |---|---|
  | `HCULimit` | 20231 |
  | `CleartextHCULimit` | 20293 |
  | `CleartextForgeHCULimit` | 20892 |

  The forge variant has 3.6 KB of headroom even with the meter and the gas-metering pauses.
- **`getVersion()` is unaffected.** The cleartext contracts add constants and override two internal hooks;
  the string stays `HCULimit v0.3.0`, so `LocalHostVersions` and `LibFhevmVersion`'s ceiling do not move.
  (Confirm by diffing the regenerated file, step 1.)
- **Seven deploy layers per generation name the HCU implementation**, and `stack-order.test.ts` already
  enumerates six of them in `DEPLOY_LAYER_FILES` for the ACL guard:

  | Layer (v13 path) | What it names today |
  |---|---|
  | `pkg/ts/deploy.ts` | `artifacts/HCULimit.js` |
  | `pkg/ts/upgrade.ts` | `artifacts/HCULimit.js` |
  | `pkg/forge/src/LibForgeFhevmStack.sol` | `HCU_LIMIT_CREATION_CODE` |
  | `pkg/forge/script/FhevmDeployScript.s.sol` | `new HCULimit()` |
  | `pkg/forge/script/DeployLocalStack.s.sol` | `HCU_LIMIT_CREATION_CODE` |
  | `create2-deploy/script/FhevmCreate2Base.s.sol` | `pkg/src/contracts/HCULimit.sol:HCULimit` |
  | `create2-deploy/script/upgrade/FhevmUpgradeBase.s.sol` | `pkg/src/contracts/HCULimit.sol:HCULimit` |
  | `scripts/anvil-lib.sh` | `read_blob HCU_LIMIT_CREATION_CODE` |
- **The blob name follows from the contract name**: `HCULimit` → `HCU_LIMIT_CREATION_CODE`, so
  `CleartextHCULimit` → `CLEARTEXT_HCU_LIMIT_CREATION_CODE` and the forge variant's constant is declared
  explicitly as `CLEARTEXT_FORGE_HCU_LIMIT`.
- **`IHCULimit` has four users in v13** (`DeployLocalStack`, `LibForgeFhevmStack`, `ForgeFhevmDeploy`,
  `LibForgeFhevmHCU`) and four more in the generated forge-fhevm-std payload. The rename is mechanical but
  crosses a package boundary (step 5).

## 1. v13: the sources and the generators

1. `pkg/src/cleartext/CleartextHCULimit.sol` — already written: `IS_CLEARTEXT`, `CLEARTEXT_PROTOCOL_VERSION`
   = 13, nothing else, mirroring `CleartextACL`. Review its header against `CleartextACL`'s and keep the
   "constants rather than storage, because these run behind proxies" paragraph.
2. `pkg/src/cleartext/CleartextForgeHCULimit.sol` — already written: the meter, cleared per transaction via a
   transient flag, under `pauseGasMetering`. Add the `IS_FORGE` marker `CleartextForgeACL` carries, so
   `ForgeFhevmDeploy.t.sol` can assert the proxy sits over the FORGE variant and not merely a cleartext one.
3. `internal/generateTemplates.ts`: replace the `HCULimit` entry with
   `{ contractName: 'CleartextHCULimit', kind: 'proxy', sourcePath: 'src/cleartext/CleartextHCULimit.sol' }`,
   keeping its position in the list (the order is the materialisation order).
4. `internal/generateLocalHostBytecode.ts`: rename the `CODE_KIND` key `HCULimit` → `CleartextHCULimit`
   (`'creation'`), and add to `FORGE_VARIANTS`:
   `{ constantName: 'CLEARTEXT_FORGE_HCU_LIMIT', contractName: 'CleartextForgeHCULimit', sourcePath: 'src/cleartext/CleartextForgeHCULimit.sol' }`.
   Its header lists "Three contracts have Forge variants" — make it four.
5. Regenerate and read the diff: `LocalHostBytecode.sol` gains `CLEARTEXT_HCU_LIMIT_CREATION_CODE` and
   `CLEARTEXT_FORGE_HCU_LIMIT_CREATION_CODE` and loses `HCU_LIMIT_CREATION_CODE`; the interfaces directory
   gains `ICleartextHCULimit.sol` and loses `IHCULimit.sol`; `pkg/ts/artifacts/` gains `CleartextHCULimit.ts`
   and loses `HCULimit.ts`; `LocalHostVersions.sol` keeps `HCULimit v0.3.0` and changes at most a `@dev`
   source-path comment; `LocalHostAddresses.sol` does not move (the nonce sequence is unchanged).
   ```sh
   cd host-contracts-cleartext/v13 && npm run generate && git diff --stat
   ```
   The build will break at every layer that still names the old blob — that is step 2's worklist.

## 2. v13: the deploy layers

Each layer takes the CLEARTEXT contract, and the in-process forge one takes the FORGE variant, exactly as
they choose between `CleartextACL` and `CleartextForgeACL` today.

| Layer | Becomes |
|---|---|
| `pkg/forge/src/LibForgeFhevmStack.sol` | `CLEARTEXT_FORGE_HCU_LIMIT_CREATION_CODE`, label `"HCULimit impl (forge)"` |
| `pkg/forge/script/DeployLocalStack.s.sol` | `CLEARTEXT_HCU_LIMIT_CREATION_CODE`; `IHCULimit` → `ICleartextHCULimit` |
| `pkg/forge/script/FhevmDeployScript.s.sol` | `new CleartextHCULimit()`, init still encoded against `HCULimit` |
| `pkg/ts/deploy.ts` | `artifacts/CleartextHCULimit.js` |
| `create2-deploy/script/FhevmCreate2Base.s.sol` | `pkg/src/cleartext/CleartextHCULimit.sol:CleartextHCULimit` |
| `scripts/anvil-lib.sh` | `read_blob CLEARTEXT_HCU_LIMIT_CREATION_CODE` |

`ForgeFhevmDeploy.sol`, `LibForgeFhevmStack.sol` and `LibForgeFhevmHCU.sol` swap `IHCULimit` for
`ICleartextHCULimit`.

```sh
cd host-contracts-cleartext/v13 && npm run forge:fmt && npm run forge:lint && forge test
```

## 3. v13: the upgrade path

1. `pkg/ts/upgrade.ts`: the `HCULimit` entry takes the `CleartextHCULimit` template and ABI. Its
   `contractName` string is the ROLE and stays `'HCULimit'` unless `list:upgrade-ops --strict` says otherwise
   — check, since that string reaches the ops listing the v12 comparison reads.
2. `create2-deploy/script/upgrade/FhevmUpgradeBase.s.sol`: index 4's artifact becomes
   `pkg/src/cleartext/CleartextHCULimit.sol:CleartextHCULimit`.
3. `create2-deploy/script/upgrade/UpgradeInitData.sol`: UNCHANGED, and a comment says why — the payload is a
   selector, `CleartextHCULimit` inherits `reinitializeV3`, and solc cannot take a pointer to an inherited
   member. The same note already exists in `FhevmDeployScript` for the ACL.
4. `test/upgrade/Create2UpgradeOrdinals.t.sol` and `test/Create2Ordinals.t.sol`: the ordinals do not move,
   but the artifact strings they may assert do.
   ```sh
   cd host-contracts-cleartext/v13 && npm run --silent list:upgrade-ops -- ../v12 --strict && npm run test:upgrade:fast
   ```

## 4. THE SUITE BREAKS LOUDLY IF THE CLEARTEXT LIMIT IS NOT DEPLOYED

Three independent layers, because these paths are four languages and no compiler sees them together. Each is
proven by breaking it (rules.md 7.1): revert one layer to the plain contract, watch exactly one guard fail,
restore.

1. **Static, across every deploy layer.** `test/stack-order.test.ts` already has
   `no deploy layer deploys the plain ACL` over `DEPLOY_LAYER_FILES`. Generalise it to a table of
   `{ role, forbidden[] }` and add the HCU limit, with the same four shapes and a lookbehind that spares the
   cleartext constants:
   ```ts
   { pattern: /(?<![A-Za-z_])HCU_LIMIT_CREATION_CODE/, what: 'the plain HCULimit bytecode blob' },
   { pattern: /new HCULimit\(\)/,                      what: 'a direct `new HCULimit()`' },
   { pattern: /contracts\/HCULimit\.sol:HCULimit\b/,   what: 'the HCULimit.sol forge artifact' },
   { pattern: /artifacts\/HCULimit\.(?:js|ts)\b/,      what: 'the HCULimit TypeScript artifact' },
   ```
   Add `HCU_LIMIT` to `canonicalRole`'s substitution set, so `CLEARTEXT_FORGE_HCU_LIMIT` and
   `CLEARTEXT_HCU_LIMIT` both reduce to the `HCU_LIMIT` role and the order comparison still lines up.
2. **Runtime, and EXHAUSTIVE.** `ForgeFhevmDeploy.t.sol`'s `test_cleartextContractsAdvertiseTheMarker` lists
   the marked proxies one by one, so a new unmarked proxy is invisible to it. Replace the list with a sweep
   over every address the stack materialises: each must either answer `IS_CLEARTEXT() == true` with
   `CLEARTEXT_PROTOCOL_VERSION() == 13`, or appear in a short, NAMED exemption list (`ProtocolConfig`,
   `KMSGeneration` — vendored contracts with no cleartext variant). The HCU limit moves from the exemptions
   to the marked set in this step, and any proxy added later must be classified or the test fails. Assert
   `IS_FORGE()` on the HCU limit too, beside the arithmetic one, so the in-process stack cannot silently fall
   back to the non-forge variant and lose the meter.
3. **The broadcast paths.** `scripts/anvil-lib.sh`'s smoke section gains an `IS_CLEARTEXT` check on the HCU
   limit beside its existing cap checks; `test/e2e/create2-deploy.test.ts` already probes `IS_CLEARTEXT` and
   gains the HCU limit address. These are the only two layers the forge tests never execute.

```sh
cd host-contracts-cleartext/v13 && node --test test/stack-order.test.ts && forge test --match-contract ForgeFhevmDeploy
```
Then break each guard once, in a scratch edit, and record in the plan that it failed.

## 5. forge-fhevm-std: the regenerated payload

The SDK copies v13's `pkg/forge/src` into `pkg/src/_host`. After step 2 it carries
`ICleartextHCULimit.sol`, the new blobs, and a `LibForgeFhevmHCU` that names the new interface.

1. `cd foundry/forge-fhevm-std && npm run generate` and read the diff.
2. Nothing in `pkg/src/*.sol` should need an edit: the kernel reaches the HCU limit through
   `LibForgeFhevmHCU` (rule 2.16). Confirm, and fix the imports if not.
3. The meter becomes reachable from the SDK for the first time. Out of scope here, noted for a follow-up: a
   cheat that reads `lastTransactionHCU` / `maxHandleHCU` would give tests a gas-style HCU assertion.
   ```sh
   cd foundry/forge-fhevm-std && npm run lint && forge clean && forge test
   ```

## 6. v12: the same, in v12's shapes

v12 has `CleartextACL` and `CleartextForgeACL` already, so every step above transposes. Differences to watch:

- The in-process stack is `pkg/forge/src/FhevmCleartextDeploy.sol`, not `LibForgeFhevmStack.sol`.
- `CLEARTEXT_PROTOCOL_VERSION = 12` in v12's `CleartextHCULimit`.
- v12's `FORGE_VARIANTS` and `CODE_KIND` live in its own `internal/generateLocalHostBytecode.ts`.
- v12's `scripts/anvil-lib.sh` and its `stack-order` equivalent get the same guards. If v12 has no
  `stack-order.test.ts`, the static guard is the one thing to port by hand rather than transpose.
- v12 is an UPGRADE SOURCE, not a deploy target for users: its `pkg/ts/deploy.ts` boots the stack that
  `test:upgrade` then upgrades, so its layers matter for exactly that test.

```sh
cd host-contracts-cleartext/v12 && npm run generate && npm run forge:fmt && npm run forge:lint && forge test
```

## 7. Proof

```sh
# each generation on its own
cd host-contracts-cleartext/v12 && npm run generate && npm run lint && forge test
cd ../v13 && npm run generate && npm run lint && forge test && node --test test/stack-order.test.ts
npm run test:upgrade            # v12 -> v13, the full path, not just :fast
npm run test:e2e                # create2 + anvil smoke, the two broadcast layers

# the consumer of the payload
cd ../../foundry/forge-fhevm-std && npm run lint && forge clean && forge test
ARBITRUM_RPC_URL=… FOUNDRY_PROFILE=fhevm-debug forge test --match-path test/fork/CleartextOnForeignChain.t.sol

# the workspace
cd ../.. && make check-pre && make ci-fast
```

A stack booted after this change answers `IS_CLEARTEXT` on seven of its nine proxies, the two exceptions
being named in the test that checks it.

## 8. Out of scope, on purpose

- Any behaviour change to the HCU accounting itself. `CleartextHCULimit` adds two constants; the forge
  variant adds readings and pauses metering around its own writes, and neither touches a cap or a check.
- Exposing the meter through forge-fhevm-std's cheat surface (noted in step 5).
- Re-pinning confidential-defi's soldeer dependency, which will need a new commit once this and the debug
  config land.


## 9. As built (2026-09-22)

| Gate | Result |
|---|---|
| v13 `npm run test:fast` (forge + templates + harness) | 168 forge tests, 37 node tests, 0 failed |
| v13 `npm run test:upgrade:fast` (v12 → v13) | 2 passed |
| v12 `npm test` | 23 forge tests, 36 node tests, 0 failed |
| forge-fhevm-std, payload regenerated, offline suite | 524 passed, 0 failed, 15 skipped |
| lint, `forge fmt --check`, `tsc` in all three | clean |
| `make check-pre` | clean |

**The guards, each proven by breaking it.** Reverting ANY of the eight layers to the plain contract was
caught: `pkg/ts/deploy.ts`, `pkg/ts/verify.ts`, `pkg/ts/upgrade.ts`, `LibForgeFhevmStack.sol`,
`FhevmDeployScript.s.sol`, `DeployLocalStack.s.sol`, `FhevmCreate2Base.s.sol`, `FhevmUpgradeBase.s.sol`,
`anvil-lib.sh`. Pointing the in-process stack at the non-forge cleartext limit failed
`test_forgeVariantsSitBehindTheirProxies`. Adding an unmarked contract to the stack failed the exhaustive
sweep by address. Reverting to the plain blob no longer even COMPILES: the generator stopped emitting
`HCU_LIMIT_CREATION_CODE` at all.

**Two latent bugs found and fixed on the way.**
- `_constantFor` returned `undefined` for a contract missing from `CONSTANT_NAMES`, emitting
  `undefined_CREATION_CODE` into the generated Solidity — a valid identifier that fails only at the layer
  reaching for the real name. It now throws, in both generations.
- `pkg/ts/verify.ts` was an eighth layer nobody had listed: it names the same artifacts to CHECK a deployed
  stack, so pointed at the plain contract it verifies the wrong ABI and passes. It is in `DEPLOY_LAYER_FILES`
  now.

**Baselines refreshed, counts unchanged.** `internal/placeholders/patch-sites.json` renamed its entry with
identical counts in both generations, which is the evidence the marker adds constants and no address
reference. The templates test's forge-blob list gained `CLEARTEXT_FORGE_HCU_LIMIT`.

**Pre-existing, untouched.** `list:upgrade-ops --strict` still flags `CleartextDB` as "CHANGED, NOT BUMPED".
That is a v12/v13 source difference in the DB and predates this work.
