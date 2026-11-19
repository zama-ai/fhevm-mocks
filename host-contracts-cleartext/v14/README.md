# The `<vN>` dev package of host-contracts-cleartext

This directory is the dev package of `@fhevm/host-contracts-cleartext`. It is private and never published. `pkg/` is
the published payload, and everything else here generates, checks, and tests that payload.

This file is for the maintainers of the package. It lists the commands, and it holds the checklist to follow when the
upstream pin moves or a new generation starts.

In this file, `<vN>` is the generation that this directory holds, `<vN-1>` is the generation before it, and `<vN+1>` is
the next one. `<N>` is the `major.minor` version of `<vN>`. In a command, replace each of them with the real name.

## Layout

- `pkg/src/contracts/` is the upstream `host-contracts/contracts`, vendored at the pinned tag. Never edit it by hand.
- `pkg/src/cleartext/` holds the cleartext contracts that this package owns. Most of them extend a vendored contract.
- `pkg/abi/` and `pkg/templates/` are generated from the forge build: the ABIs, and the bytecode with a placeholder for
  each address.
- `pkg/ts/` is the TypeScript library that deploys, verifies, and upgrades a stack.
- `pkg/forge/` is the Foundry payload. See [Consuming `pkg/forge` from Foundry](#consuming-pkgforge-from-foundry).
- `internal/` holds the generators and the checks behind the `npm run` scripts. `internal/zama-config/` is a vendored
  copy of the upstream `library-solidity/config` (NR-42c).
- `create2-deploy/` holds the CREATE2 deploy, hotfix, and upgrade tools.
  [create2-deploy/README.md](create2-deploy/README.md) describes them.
- `test/` holds the tests of this package. `test-consumer/` holds the ESM and CJS projects that consume the payload
  from outside the workspace.
- `scripts/` holds shell launchers, such as `anvil.sh` and `deploy.sh`.
- [ROTATION.md](ROTATION.md) lists what `<vN>` deletes when `<vN+1>` arrives.

## Commands

To install, run `make install` from the workspace root. This package is a member of the root npm workspace and has no
lockfile of its own. [fhevm-npm-docs/GUIDE.md](../../fhevm-npm-docs/GUIDE.md) describes the install and the workspace
commands. [BUILD.md](BUILD.md) describes `generate`, `compile`, and `build`.

Run the commands below from this directory.

```sh
npm run test         # forge tests, template tests, TypeScript tests, then the create2 deploy and hotfix e2es
npm run test:fast    # the same without the create2 e2es
npm run check        # contract sizes, publint and attw, vendored origin, ZamaConfig addresses
./scripts/anvil.sh   # start anvil on port 8545 and deploy a fresh stack on it (Ctrl-C stops the node)
```

`npm run check` reads `./out` and the compiled payload, so run `npm run generate` and `npm run compile` first. The
upgrade tests have their own commands, listed in [step 11](#11-verify).

## Consuming `pkg/forge` from Foundry

`pkg/forge/` holds what a forge test needs to deploy and drive a cleartext stack: `ForgeFhevmDeploy.sol` and the
`LibForgeFhevm*` libraries. `foundry/forge-fhevm-std` is its consumer. The `generate:forge-payload` script of that
package copies `pkg/forge/src`, byte for byte, into `foundry/forge-fhevm-std/pkg/src/_host`.

The natspec of `pkg/forge/src/ForgeFhevmDeploy.sol` says what a consumer may import. The header of each generated
`pkg/forge/src/_internal/LocalHost*.sol` file says what the file holds and which script writes it.

`_internal/LocalHostAddresses.sol` declares the same constant names as the `fhevm-config-<N>.0/addresses.sol` file that
`pkg/src` compiles against. A file that imports both by name does not compile. Import only one of them, or bind one to
a namespace, as `LocalHostBytecode.sol` does.

The default forge profile leaves `pkg/forge` out. `[profile.forgefhevmcore]` in `foundry.toml` compiles, formats, and
lints it.

## Move the upstream pin, or start `<vN+1>`

The steps below are the usual path. Each upstream release is different, so read the diff at every step. Steps 5 and 6
apply only when the protocol minor changes, which is when a new generation starts.

### 1. Move the pin

`bump vendored` is the only command that moves a pin (NR-42a). Run it from the workspace root:

```sh
make bump-vendored PKG=./host-contracts-cleartext/<vN> TAG=<tag> CHECK=1   # report what would move, write nothing
make bump-vendored PKG=./host-contracts-cleartext/<vN> TAG=<tag>
```

The command moves both pins of this generation to one commit (NR-42c): the contracts in `pkg/src/contracts` and the
config in `internal/zama-config`. It resolves the tag to its commit, downloads both trees, and formats them with
`forge fmt`. It adds the files that upstream added and removes the files that upstream dropped. Then it writes the tag,
the commit, and the digest in `npm-manifest.json`, and `fhevm.vendoredFrom` in both `package.json` files. It never
touches the pins of `<vN-1>`.

You choose the tag. Do not assume that a higher patch number is a later commit. In a clone of the upstream repository,
list the tags of the line and compare the two candidates:

```sh
git tag --list 'v<N>.*'
git merge-base --is-ancestor <tag-a> <tag-b> && echo "<tag-a> is an ancestor of <tag-b>"
```

### 2. Read what changed

The report of the command has one line for each pin. `copies unchanged` on the `src/contracts` line means that steps 3,
4, and 7 have nothing to do. Otherwise, `git diff pkg/src/contracts` is the list of upstream changes that the next
steps respond to.

Review each file that the command added. If the stack cannot compile a new source, or has no use for it, add the source
to `skip` in `foundry.toml`. The three bridge sources that import LayerZero packages are there for that reason.

### 3. Update the cleartext contracts

A contract in `pkg/src/cleartext/` that extends a vendored contract may need the same change. For example,
`CleartextFHEVMExecutor` extends `FHEVMExecutor`, so a changed upstream signature must change there too. If an
upstream initializer gains a parameter, update `BootstrapConfig` and the types next to it in `pkg/ts/types/public.ts`.

### 4. Update the addresses, if the set of host addresses changed

1. In `pkg/src/addresses/FHEVMHostAddresses.sol`, add or remove the `*Add` alias and its import.
2. In `internal/constants.ts`, update `ADDRESS_NAMES` and `NONCE_OFFSET`. If the deploy order changes, change it in
   `pkg/ts/addresses.ts` too. `npm run generate` renders `pkg/forge/script/ComputeAddresses.s.sol` from
   `NONCE_OFFSET`, so never edit that script. `test/ts/precompute-addresses.test.ts` checks every offset.
3. In `internal/generateTemplates.ts`, add or remove the contract in `TARGET_CONTRACTS`.
4. Run `npm run generate:placeholders`. It writes `internal/placeholders/addresses.sol`, which you never edit by hand.

### 5. Move the config prefix, if the protocol minor changed

The contracts import their addresses through the prefix `fhevm-config-<N>.0/`. The prefix carries the version so that
two generations can compile in one project.

Three places must agree, and `test/config-remapping.test.ts` fails when they do not:

- The import in `pkg/src/addresses/FHEVMHostAddresses.sol`. Every script and tool reads the prefix from it.
- The line in `remappings.txt`.
- The `major.minor` of the payload version (step 8).

`npm run generate` rewrites the prefix in `pkg/forge/script/ComputeAddresses.s.sol`. Comments repeat it too, as the
usage lines of `pkg/forge/script/FhevmDeployScript.s.sol` do. To find every occurrence:

```sh
grep -rn 'fhevm-config-' pkg/src pkg/forge/script internal test scripts create2-deploy/ts remappings.txt
```

### 6. Point the upgrade path at the new previous generation

In a new generation, the upgrade path must start from the generation before it. [ROTATION.md](ROTATION.md) covers the
other side: what that previous generation deletes.

The upgrade path and its tests name one pair of generations. To list the files that name the old pair, search for the
directory name of the generation that leaves:

```sh
grep -rliE '<name of the generation that leaves>' --include='*.ts' --include='*.sol' --include='*.json' \
  --include='*.txt' --include='*.toml' \
  --exclude-dir=node_modules --exclude-dir=_cjs --exclude-dir=_esm --exclude-dir=_types --exclude-dir=_types-cjs \
  internal pkg test create2-deploy package.json remappings.txt foundry.toml
```

Most matches are comments. Two groups change behavior:

- **The dependency on the previous dev package.** These are the `devDependencies` entry and the `test:upgrade:fast`
  script in `package.json`, the remapping in `remappings.txt` and `allow_paths` in `foundry.toml`, the imports in
  `test/upgrade/*.t.sol`, `test/ts/upgrade/library.test.ts`, and `create2-deploy/upgrade/ts/testnet.ts`,
  `PREVIOUS_GENERATION_DIR_ABS_PATH` in `test/e2e/upgrade/create2.test.ts`, and `previousAbiDir` in
  `create2-deploy/upgrade/anvil-config.json`.
- **The public API.** `pkg/ts/upgrade.ts` exports one upgrade function, and `pkg/ts/types/public.ts` declares its
  types. Their names hold both generation numbers. A new name breaks every consumer that calls the old one, so decide
  on purpose whether to rename them.

Also rename `test/ts/deploy-<vN>.test.ts`.

`test/e2e/upgrade/create2.test.ts` skips when the previous generation, `anvil`, or `forge` is missing. After this step,
read the output of `npm run test:upgrade` and confirm that the test ran.

### 7. Check the reinitializer versions

Do this step only if deployed stacks must be upgraded. It is a check, not an edit. All the contracts that declare a
`reinitializeV<n>` function are vendored, except `CleartextArithmetic`, so their versions arrive with the pin or not at
all.

The command reads the templates and ABIs that `npm run generate` writes. After steps 1 to 6 they are stale, so run
`npm run generate` first. Step 9 runs it again with the patch sites.

```sh
npm run list:upgrade-ops -- ../<vN-1>            # report, exits 0 whatever it finds
npm run list:upgrade-ops -- ../<vN-1> --strict   # exits 1 on any ⚠ verdict
```

The command reads only the committed `pkg/templates/` and `pkg/abi/` of both generations, so it needs no build. For
each contract it reports whether the bytecode changed and which `reinitializeV<n>` each generation declares. The
comment at the top of `internal/listUpgradeOps.ts` describes how it compares them.

A `⚠` verdict means that the two signals disagree:

| Bytecode | Reinitializer | Verdict                 | Meaning                                                                                    |
| -------- | ------------- | ----------------------- | ------------------------------------------------------------------------------------------ |
| changed  | same          | `⚠ CHANGED, NOT BUMPED` | An upgrade of that proxy has no replay guard, and the chain does not show the new version. |
| same     | bumped        | `⚠ BUMPED, UNCHANGED`   | The bump forces an upgrade operation that changes nothing, and uses up a version number.   |

Neither verdict is always a defect. For example, a contract can change only because an enum that it takes as a
parameter gained a member. Decide each case, then compare the `reinitialize` lines of the report with the operations in
`pkg/ts/upgrade.ts` and in `create2-deploy/script/upgrade/UpgradeInitData.sol`. A contract whose bytecode did not
change must not appear in either.

The report does not give the arguments of a reinitializer or the order of the operations. Read both in the contracts.
Two details help:

- `reinitializeV<n>` is guarded by `reinitializer(n + 1)`, because `initializeFromEmptyProxy` uses the same
  `REINITIALIZER_VERSION`.
- Most reinitializers have an empty body and only advance the counter. `ProtocolConfig` and `InputVerifier` take
  arguments, and `KMSGeneration` has a body.

### 8. Set the version

The root `versions.json` is the only authority for the payload version (NR-36). `version apply` copies it into
`pkg/package.json`, so never edit the version there. Its `major.minor` must be `<N>`: `create2-deploy` derives its
`FHEVM_VERSION` from it, and the test of step 5 compares it with the config prefix. `version apply` refuses a worktree that has changes besides `versions.json`,
so commit steps 1 to 7 first. Then follow [VERSION_BUMP_RUNBOOK.md](../../fhevm-npm-docs/VERSION_BUMP_RUNBOOK.md).

Step 1 already wrote `fhevm.vendoredFrom`. Never edit it.

### 9. Regenerate, then refresh the patch-site baseline

```sh
npm run generate               # generate:pre, then compile:forge, then generate:post
npm run generate:patch-sites   # rewrites internal/placeholders/patch-sites.json from the new templates
```

Run them in this order, because the second command reads the templates that the first one writes. `generate` does not
run `generate:patch-sites`: `test/templates.test.ts` compares the templates with that baseline, so you refresh it only
to accept a change.

Review the diff of `patch-sites.json`. A count that falls to 0 for an address that the contracts still use means that a
deploy would leave a placeholder in the bytecode.

### 10. Check the contract sizes

```sh
npm run check:contract-sizes
```

The command reads `./out` and fails when a deployable contract of `pkg/src` exceeds the EIP-170 limit of 24,576 bytes.
The three `CleartextForge*` contracts that `internal/checkContractSizes.ts` lists are exempt: a forge test installs
them in its own EVM, and nothing deploys them on a chain. `CleartextFHEVMExecutor` and `ProtocolConfig` are within 300
bytes of the limit, so new upstream code can exceed it. If a contract exceeds the limit, make the contract smaller. Do
not raise the limit of the node, because the stack must deploy on any chain.

### 11. Verify

```sh
npm run lint
npm run compile             # npm run check reads the compiled payload
npm run test
npm run check
npm run test:upgrade:fast   # the upgrade from <vN-1>, without the create2 coordinator
npm run test:upgrade        # the upgrade from <vN-1>, with the create2 coordinator
./scripts/anvil.sh          # deploys on a real node, then reads the stack back and checks it
```

`npm run check` runs four checks:

- `check:contract-sizes` is step 10.
- `check:publint` runs `publint` and `attw` on the payload.
- `check:vendored-origin` compares the vendored copies with the digests in `npm-manifest.json` (NR-42a). It prints
  nothing on success. `npm run --silent check:vendored-origin -- -v` prints `✅ check vendored-origin: 2 package(s) checked.`
- `check:zama-config` compares `ZAMA_LOCAL_CONFIG` with `_getLocalConfig()` in `internal/zama-config/ZamaConfig.sol`.
  Every dApp that inherits the localhost config of upstream compiles those three addresses in, so the stack must
  deploy at them. The header of `internal/cli/checkZamaLocalConfig.ts` gives the details.

The upgrade has two test commands. `test:upgrade:fast` runs the forge tests of `test/upgrade/`,
`test/stack-order.test.ts`, `list:upgrade-ops`, and the library upgrade of `test/ts/upgrade/` on a fresh anvil.
`test:upgrade` runs the library upgrade too, then the create2 e2e: it deploys `<vN-1>` with its own create2 coordinator
and upgrades it with the coordinator of `<vN>`. It is several times slower, because the placeholder patches defeat the
forge cache and `forge script` recompiles. Use `test:upgrade:fast` while
you work, and run `test:upgrade` before you commit a pin move. From the workspace root, the same two commands are
`make test-cleartext-upgrade-fast` and `make test-cleartext-upgrade`.
