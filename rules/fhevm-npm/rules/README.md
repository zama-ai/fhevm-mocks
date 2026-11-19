---
kind: rules
prefix: N
groups:
  Packages: Read these rules before you add, remove, rename, or re-kind a package, or change what its `package.json` declares.
  Inventory: Read these rules before you change `npm-manifest.json`, its schema, or the manifest check.
  Dependencies: Read these rules before you add, remove, or bump a dependency or a pin.
  Generations: Read these rules before you rotate a generation or touch the previous one.
  Vendoring: Read these rules before you move a vendored pin or add a vendored copy.
  Tooling: Read these rules, and then NR-19, before you add a script, a tsconfig, a format or lint config, or a Foundry project.
  Publishing: Read these rules before you change what a payload ships, bump a version, or publish.
  Consumer tests: Read these rules before you write or register a consumer test.
  Lockfiles: Read these rules when a lockfile check fails or an install is broken.
  Deployments: Read these rules before you archive a deployment, an upgrade, or a hotfix.
---

# fhevm-npm rules

Contributors to the npm workspace follow these rules when they change a package, a dependency, a check, a release, or a deployment record.

## Related documents

- [definitions/](../definitions/README.md): the terms of the npm workspace, `ND-<NN>`.
- [WORKSPACE.md](../WORKSPACE.md): what these rules are for, and how generations live side by side.
- `GUIDE.md`: the everyday commands.
- `VERSION_BUMP_RUNBOOK.md`: how to bump a version.
- `deployments/README.md`: the layout of the deployment records.
- [Global rules](../../global/rules/README.md): the rules for every package. R-04 there is the other copy of NR-27.

<!-- BEGIN GENERATED INDEX. Edit the entry files, then run generate-index.mjs. -->

The IDs in this file start with `NR-`.

| Rule tag     | Meaning                                                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `[HOLD]`     | The text is accurate, and the code follows it. Nothing needs a fix.                                                                   |
| `[STALE]`    | The rule is still wanted, but its text names files, symbols, commands, or versions that changed. The fix goes to the rule text.       |
| `[RETIRED]`  | The rule is withdrawn: what it governs no longer exists, or another rule replaces it. Delete the rule text and keep the ID.           |
| `[VIOLATED]` | The text is accurate and still wanted, but the code does not follow it. The fix goes to the code.                                     |
| `[CONFLICT]` | The rule contradicts or repeats another rule. The fix is a decision, then one rule changes or merges.                                 |
| `[GAP]`      | The rule is wanted and the repository follows it today, but no check, or only a weaker check, enforces it. The fix goes to the check. |

To read the full text of every live rule on one page, open [groups/all.md](groups/all.md).

## Groups

| Group                             | Description                                                                                                           | Rules | Full text                                     |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----- | --------------------------------------------- |
| [Packages](#packages)             | Read these rules before you add, remove, rename, or re-kind a package, or change what its `package.json` declares.    | 13    | [packages.md](groups/packages.md)             |
| [Inventory](#inventory)           | Read these rules before you change `npm-manifest.json`, its schema, or the manifest check.                            | 7     | [inventory.md](groups/inventory.md)           |
| [Dependencies](#dependencies)     | Read these rules before you add, remove, or bump a dependency or a pin.                                               | 14    | [dependencies.md](groups/dependencies.md)     |
| [Generations](#generations)       | Read these rules before you rotate a generation or touch the previous one.                                            | 8     | [generations.md](groups/generations.md)       |
| [Vendoring](#vendoring)           | Read these rules before you move a vendored pin or add a vendored copy.                                               | 4     | [vendoring.md](groups/vendoring.md)           |
| [Tooling](#tooling)               | Read these rules, and then NR-19, before you add a script, a tsconfig, a format or lint config, or a Foundry project. | 11    | [tooling.md](groups/tooling.md)               |
| [Publishing](#publishing)         | Read these rules before you change what a payload ships, bump a version, or publish.                                  | 11    | [publishing.md](groups/publishing.md)         |
| [Consumer tests](#consumer-tests) | Read these rules before you write or register a consumer test.                                                        | 10    | [consumer-tests.md](groups/consumer-tests.md) |
| [Lockfiles](#lockfiles)           | Read these rules when a lockfile check fails or an install is broken.                                                 | 6     | [lockfiles.md](groups/lockfiles.md)           |
| [Deployments](#deployments)       | Read these rules before you archive a deployment, an upgrade, or a hotfix.                                            | 10    | [deployments.md](groups/deployments.md)       |

## Packages

| ID                                    | Rule                                              | Short rule                                                                                       | Old number | Check  | Issues     |
| ------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------- | ------ | ---------- |
| [NR-01](entries/NR-01.md) `[HOLD]`    | Private dev packages use version 0.0.0            | Every private development package named `…-dev` sets `"version": "0.0.0"`.                       | 1.2.1      | script | I-03       |
| [NR-02](entries/NR-02.md) `[GAP]`     | Members are explicit paths, never globs           | Every installation root lists its members as explicit relative paths, never globs.               | 2.1.1      | script | I-01, I-70 |
| [NR-03](entries/NR-03.md) `[GAP]`     | The published payload lives in pkg/               | A dev owner stores its published payload in `pkg/`.                                              | 2.1.2      | script | I-71       |
| [NR-04](entries/NR-04.md) `[GAP]`     | One member per published name                     | At most one workspace member has a given published package name, across every installation root. | 2.1.3      | script | I-01, I-72 |
| [NR-05](entries/NR-05.md) `[HOLD]`    | A standalone consumer is never a member           | A standalone consumer is never a member.                                                         | 2.1.4      | script | I-08       |
| [NR-07](entries/NR-07.md) `[GAP]`     | Every entry point target exists                   | Every local entrypoint target in an inventoried `package.json` exists.                           | 2.1.6      | script | I-45, I-74 |
| [NR-08](entries/NR-08.md) `[HOLD]`    | Declare the module type explicitly                | Every package.json declares its module type explicitly.                                          | 2.1.7      | script |            |
| [NR-09](entries/NR-09.md) `[GAP]`     | Published metadata follows the central field list | Published package metadata follows the central field list.                                       | 2.1.8      | script | I-75       |
| [NR-10](entries/NR-10.md) `[GAP]`     | Declare runtime compatibility                     | Every inventory entry declares runtime compatibility.                                            | 2.1.9      | script | I-76       |
| [NR-11](entries/NR-11.md) `[HOLD]`    | One canonical order for package.json fields       | Top-level package.json entries follow one canonical order.                                       | 2.1.10     | script |            |
| [NR-12](entries/NR-12.md) `[RETIRED]` | Published packages carry the repository license   | Merged into NR-53.                                                                               | 2.1.11     | script |            |
| [NR-13](entries/NR-13.md) `[HOLD]`    | Node types match the Node runtime                 | Node types match the supported Node runtime.                                                     | 2.1.12     | script |            |
| [NR-40](entries/NR-40.md) `[HOLD]`    | Private dev packages end in -dev                  | Private development packages are named `…-dev` and set `"private": true`.                        | 5.1.1      | script |            |

## Inventory

| ID                                       | Rule                                               | Short rule                                                                                   | Old number | Check   | Issues           |
| ---------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------- | ------- | ---------------- |
| [NR-70](entries/NR-70.md) `[HOLD]`       | The inventory universe                             | The inventory universe is every source `package.json` at or below the workspace root.        | 7.1.1      | script  | I-01             |
| [NR-71](entries/NR-71.md) `[GAP]`        | Classify every manifest exactly once               | `npm-manifest.json` classifies every in-scope manifest exactly once.                         | 7.1.2      | script  | I-01, I-115      |
| [NR-72](entries/NR-72.md) `[HOLD]`       | Inventory equals discovery                         | The inventory and discovery sets are equal.                                                  | 7.1.3      | script  | I-07             |
| [NR-73](entries/NR-73.md) `[GAP]`        | Manifest paths stay inside their root              | A manifest path never contains `.` or `..` as a segment and never escapes its declared root. | 7.1.4      | script  | I-116            |
| [NR-73a](entries/NR-73a.md) `[VIOLATED]` | Do not assume the repository root                  | The workspace root is not assumed to be the repository root.                                 | 7.1.5      | missing | I-01, I-21, I-55 |
| [NR-74](entries/NR-74.md) `[GAP]`        | JSON Schema checks entry-local invariants          | JSON Schema enforces entry-local invariants.                                                 | 7.2.1      | script  | I-01, I-117      |
| [NR-75](entries/NR-75.md) `[HOLD]`       | The validator checks external and graph invariants | The TypeScript validator enforces external and graph invariants.                             | 7.2.2      | script  |                  |

## Dependencies

| ID                                     | Rule                                         | Short rule                                                                                                                                                          | Old number | Check   | Issues           |
| -------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------- | ---------------- |
| [NR-15](entries/NR-15.md) `[GAP]`      | Link a member by directory, not by version   | A member depending on another member uses a relative `file:` link to that member's directory.                                                                       | 3.1.1      | script  | I-01, I-78       |
| [NR-16](entries/NR-16.md) `[GAP]`      | No tarball spec for a member                 | Never use `file:*.tgz` for a name that is also a member.                                                                                                            | 3.1.2      | script  | I-79             |
| [NR-17](entries/NR-17.md) `[GAP]`      | An outside consumer links a directory        | A consumer installed outside the workspace links a directory on disk, not a version.                                                                                | 3.2.1      | script  | I-80             |
| [NR-18](entries/NR-18.md) `[VIOLATED]` | Declare every package you use                | Declare every package whose API or executable you use.                                                                                                              | 3.3.1      | script  | I-01, I-53       |
| [NR-19](entries/NR-19.md) `[GAP]`      | Tell tools that do not walk up where to look | Tools that do not walk up must be told where to look.                                                                                                               | 3.3.2      | missing | I-01, I-81       |
| [NR-20](entries/NR-20.md) `[GAP]`      | Forbidden packages need an exact exception   | Globally forbidden packages appear in no dependency section unless the exact package has an exception.                                                              | 3.3.3      | script  | I-82             |
| [NR-21](entries/NR-21.md) `[GAP]`      | One spec for each pinned dependency          | A pinned external dependency is declared with the same spec everywhere.                                                                                             | 3.3.4      | script  | I-01, I-09, I-83 |
| [NR-28](entries/NR-28.md) `[GAP]`      | The workspace root pins shared dependencies  | The workspace root pins what the whole workspace shares.                                                                                                            | 4.1.1      | script  | I-01, I-86       |
| [NR-31](entries/NR-31.md) `[GAP]`      | Private packages repeat the root spec        | A private workspace package declares every exact root pin it directly uses, and every private package repeats the root's spec for each root dependency it declares. | 4.2.1      | script  | I-01, I-58       |
| [NR-32](entries/NR-32.md) `[GAP]`      | Per-group dependencies stay in the member    | A dependency that differs per dependency group stays in its member.                                                                                                 | 4.2.2      | script  | I-01, I-89       |
| [NR-33](entries/NR-33.md) `[GAP]`      | One range per dependency group               | Packages a dependency group installs together declare identical ranges.                                                                                             | 4.2.3      | script  | I-09, I-54       |
| [NR-34](entries/NR-34.md) `[HOLD]`     | Dev owners use devDependencies only          | A dev owner declares packages only in `devDependencies`.                                                                                                            | 4.2.4      | script  | I-08             |
| [NR-35](entries/NR-35.md) `[GAP]`      | Published floors equal the root pin          | A published dep or peer range's floor equals the exact root pin.                                                                                                    | 4.3.1      | script  | I-90             |
| [NR-39](entries/NR-39.md) `[GAP]`      | Standalone projects state their own versions | A standalone project states every version it needs itself, and a non-package declares no dependencies.                                                              | 4.4.1      | missing | I-01, I-94       |

## Generations

| ID                                 | Rule                                                          | Short rule                                                                                                                                              | Old number | Check   | Issues       |
| ---------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------- | ------------ |
| [NR-22](entries/NR-22.md) `[GAP]`  | Depend on the current generation                              | A dependency on a generation family targets `<vN>`; the only edge into `<vN-1>` is `<vN>`'s upgrade-test devDependency on the `<vN-1>` dev package.     | 3.4.1      | script  | I-84         |
| [NR-23](entries/NR-23.md) `[HOLD]` | Vendored copies cover exactly the live generations            | Every vendored destination under a generation family sits in a live generation, and every live generation is among the directories that receive a face. | 3.4.2      | script  |              |
| [NR-24](entries/NR-24.md) `[HOLD]` | The cleartext config names the live generations               | `cleartext-config.json#appliesTo.generations` names exactly the live generations.                                                                       | 3.4.3      | script  |              |
| [NR-25](entries/NR-25.md) `[HOLD]` | Only the current payload is a member                          | `<vN>`'s published payload is a workspace member; `<vN-1>`'s is not.                                                                                    | 3.4.4      | script  | I-01, I-08   |
| [NR-26](entries/NR-26.md) `[GAP]`  | Only the current generation has upgrade scripts               | `<vN>` declares the upgrade scripts, `test:upgrade` and any `test:upgrade:*`; `<vN-1>` declares none.                                                   | 3.4.5      | script  | I-09, I-50   |
| [NR-27](entries/NR-27.md) `[GAP]`  | The previous generation matches its release branch            | `<vN-1>` is byte-identical to the release branch that owns it, minus whatever a rotation deleted.                                                       | 3.4.6      | script  | I-13, I-85   |
| [NR-86](entries/NR-86.md) `[GAP]`  | The developer moves the generations, and the checks only read | The developer creates the generation directories and edits every pin, and the checks only read them and report.                                         |            | missing |              |
| [NR-87](entries/NR-87.md) `[GAP]`  | A family has exactly two live generations                     | A generation family always has two live generations, the current one and the previous one.                                                              |            | script  | I-120, I-121 |

## Vendoring

| ID                                       | Rule                                             | Short rule                                                                          | Old number | Check   | Issues           |
| ---------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------- | ---------- | ------- | ---------------- |
| [NR-42](entries/NR-42.md) `[HOLD]`       | Content-integrity checks have conventional names | Content-integrity capabilities have conventional check entry points.                | 5.1.3      | script  |                  |
| [NR-42a](entries/NR-42a.md) `[HOLD]`     | A pinned vendored copy records a digest          | A pinned vendored copy records a content digest, and every build verifies it.       | 5.1.3a     | script  | I-21             |
| [NR-42b](entries/NR-42b.md) `[VIOLATED]` | Declare vendored copies only in the manifest     | `npm-manifest.json` is the only place a vendored copy is declared.                  | 5.1.3b     | script  | I-01, I-21, I-55 |
| [NR-42c](entries/NR-42c.md) `[GAP]`      | One upstream commit per generation               | A generation pins ONE upstream commit, and every copy taken from upstream rides it. | 5.1.3c     | missing | I-09, I-21, I-61 |

## Tooling

| ID                                  | Rule                                       | Short rule                                                                                                                | Old number | Check  | Issues                 |
| ----------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ | ---------------------- |
| [NR-06](entries/NR-06.md) `[GAP]`   | Every tsconfig path exists                 | Every literal local path named by an owned tsconfig exists.                                                               | 2.1.5      | script | I-73                   |
| [NR-14](entries/NR-14.md) `[GAP]`   | Match the tsc mode to the tsconfig shape   | A `tsc` invocation matches its tsconfig's shape.                                                                          | 2.1.13     | script | I-77                   |
| [NR-29](entries/NR-29.md) `[GAP]`   | One Foundry version in the manifest        | The manifest is the single source of truth for the Foundry version.                                                       | 4.1.2      | script | I-49, I-87             |
| [NR-30](entries/NR-30.md) `[GAP]`   | Foundry projects inherit the format policy | Every Foundry project inherits the shared formatting policy.                                                              | 4.1.3      | script | I-01, I-49, I-88       |
| [NR-43](entries/NR-43.md) `[GAP]`   | Common hygiene scripts                     | Private source-owning workspace packages expose common hygiene scripts.                                                   | 5.1.4      | script | I-42, I-95             |
| [NR-43a](entries/NR-43a.md) `[GAP]` | The artifact verb is compile               | The artifact verb is `compile`; `build` is the optional gated sweep.                                                      | 5.1.4a     | script | I-07, I-21, I-96       |
| [NR-43b](entries/NR-43b.md) `[GAP]` | Generators expose the full round trip      | A package that generates exposes the full round trip.                                                                     | 5.1.4b     | script | I-21, I-97             |
| [NR-43c](entries/NR-43c.md) `[GAP]` | A package can delete its build output      | A private source-owning package can delete its own build output.                                                          | 5.1.4c     | script | I-21, I-43, I-98       |
| [NR-44](entries/NR-44.md) `[GAP]`   | Prettier does not format Solidity          | Prettier scripts do not target Solidity.                                                                                  | 5.1.5      | script | I-42, I-99             |
| [NR-45](entries/NR-45.md) `[GAP]`   | Use the workspace Prettier configuration   | A non-published package running Prettier uses the workspace configuration, unless it is a template under a `…-dev` owner. | 5.1.6      | script | I-01, I-100            |
| [NR-46](entries/NR-46.md) `[GAP]`   | Three ESLint layers                        | ESLint configuration has three layers: policy, layout, local.                                                             | 5.1.7      | script | I-01, I-09, I-11, I-62 |

## Publishing

| ID                                 | Rule                                        | Short rule                                                                                                                       | Old number | Check   | Issues            |
| ---------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------- | ----------------- |
| [NR-36](entries/NR-36.md) `[GAP]`  | Central versions live in versions.json      | `versions.json` is the only authority for a published payload's version.                                                         | 4.3.2      | script  | I-07, I-91        |
| [NR-37](entries/NR-37.md) `[GAP]`  | Derived versions equal the central version  | Every derived version equals the central one.                                                                                    | 4.3.3      | script  | I-01, I-07, I-92  |
| [NR-38](entries/NR-38.md) `[GAP]`  | Rendered ranges stop at the generation      | A rendered dependency range is `~<version>`: the target's central version, up to the end of its generation.                      | 4.3.4      | script  | I-01, I-93, I-123 |
| [NR-41](entries/NR-41.md) `[GAP]`  | A payload never imports a dev package       | Nothing under `pkg/` imports a `…-dev` package.                                                                                  | 5.1.2      | missing | I-60              |
| [NR-47](entries/NR-47.md) `[GAP]`  | Dev owners define check:publint and check   | Every dev owner of an npm-distributed payload defines `check:publint` and the `check` verb wrapping its deliverable validations. | 5.2.1      | script  | I-101             |
| [NR-48](entries/NR-48.md) `[GAP]`  | Exports are the whole public surface        | A payload with a public API declares `exports`; it is the whole public surface, and stays minimal.                               | 5.2.2      | missing | I-02, I-65        |
| [NR-52](entries/NR-52.md) `[GAP]`  | Every payload file ships or is excluded     | Every file in an npm-distributed payload directory is published or deliberately excluded.                                        | 5.2.6      | script  | I-105             |
| [NR-53](entries/NR-53.md) `[GAP]`  | Ship the license and the front page         | Every published package carries the repository license, and every npm-distributed payload also carries its front page.           | 5.2.7      | script  | I-07, I-106       |
| [NR-55](entries/NR-55.md) `[HOLD]` | One dev owner per published package         | Every published package has exactly one dev owner carrying its applicable conventional checks.                                   | 5.3.2      | script  |                   |
| [NR-61](entries/NR-61.md) `[GAP]`  | Packaging linters supplement consumer tests | Packaging linters supplement the consumer test.                                                                                  | 5.3.8      | missing | I-111             |
| [NR-63](entries/NR-63.md) `[GAP]`  | A tarball carries only registry specs       | A tarball for an npm-distributed payload carries only registry specs and the central version.                                    | 5.3.10     | script  | I-48, I-112       |

## Consumer tests

| ID                                 | Rule                                              | Short rule                                                                                | Old number | Check   | Issues      |
| ---------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------- | ------- | ----------- |
| [NR-49](entries/NR-49.md) `[GAP]`  | Test the module formats consumers use             | Consumer tests resolve the package in the module formats its consumers use.               | 5.2.3      | missing | I-102       |
| [NR-50](entries/NR-50.md) `[GAP]`  | Assert the resolved declaration file              | A consumer test asserts the resolved declaration file, not merely successful compilation. | 5.2.4      | missing | I-103       |
| [NR-51](entries/NR-51.md) `[GAP]`  | Resolution checks supplement the consumer profile | Modern resolution checks supplement the real consumer profile.                            | 5.2.5      | missing | I-104       |
| [NR-54](entries/NR-54.md) `[GAP]`  | Wrapping dev packages define test:consumer        | Every dev package that wraps an npm-distributed package defines `test:consumer`.          | 5.3.1      | script  | I-02, I-107 |
| [NR-56](entries/NR-56.md) `[GAP]`  | Consumer tests run outside the workspace          | A consumer test runs outside every workspace.                                             | 5.3.3      | script  | I-01, I-108 |
| [NR-57](entries/NR-57.md) `[HOLD]` | Install candidates with --install-links           | Candidate directories are installed with `--install-links`.                               | 5.3.4      | script  |             |
| [NR-58](entries/NR-58.md) `[GAP]`  | Install a release set together                    | Packages released together are installed together.                                        | 5.3.5      | script  | I-109       |
| [NR-59](entries/NR-59.md) `[HOLD]` | Prove a physical and isolated install             | The gate proves that installation is physical and isolated.                               | 5.3.6      | script  | I-01        |
| [NR-60](entries/NR-60.md) `[GAP]`  | Resolve the package by name                       | The consumer exercises the published surface by package name.                             | 5.3.7      | script  | I-110       |
| [NR-62](entries/NR-62.md) `[GAP]`  | Run tests that share state one at a time          | Consumer tests that share state outside their own process run one at a time.              | 5.3.9      | script  | I-56        |

## Lockfiles

| ID                                 | Rule                                        | Short rule                                                                                                                             | Old number | Check      | Issues      |
| ---------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------- | ----------- |
| [NR-64](entries/NR-64.md) `[GAP]`  | One lockfile per installation root          | One authoritative lockfile per installation root.                                                                                      | 6.1.1      | script     | I-01, I-113 |
| [NR-65](entries/NR-65.md) `[HOLD]` | No extraneous lockfile nodes                | No lockfile carries an extraneous node.                                                                                                | 6.1.2      | script     |             |
| [NR-66](entries/NR-66.md) `[GAP]`  | Consumer lockfiles pin the central versions | An isolated consumer lockfile pins every published payload at its `versions.json` version, resolved to the payload its depender names. | 6.1.3      | script     | I-114       |
| [NR-67](entries/NR-67.md) `[HOLD]` | Member changes invalidate the tree          | A member rename or a `workspaces` edit invalidates the tree, not just the lock.                                                        | 6.2.1      | impossible |             |
| [NR-68](entries/NR-68.md) `[HOLD]` | Delete the tree when packages are missing   | When npm says "up to date" and packages are absent, delete the tree.                                                                   | 6.2.2      | impossible |             |
| [NR-69](entries/NR-69.md) `[HOLD]` | The local .npmrc applies, not an ancestor   | `.npmrc` is read from the local prefix, not from ancestors.                                                                            | 6.2.3      | impossible | I-01        |

## Deployments

| ID                                 | Rule                               | Short rule                                                                                                                              | Old number | Check  | Issues                  |
| ---------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ | ----------------------- |
| [NR-76](entries/NR-76.md) `[HOLD]` | One folder per stack               | Each deployed stack has one folder, `deployments/<chain>/<stack>/`, that holds only event folders, `aborted/`, and a `README.md`.       | 8.1.1      | script | I-10                    |
| [NR-77](entries/NR-77.md) `[GAP]`  | Event folders are numbered         | An event folder is named `<seq>-<deploy\|upgrade\|hotfix>-v<release>-<YYYY-MM-DD>`, with a sequence that starts at `00` and has no gap. | 8.1.2      | script | I-10, I-67              |
| [NR-78](entries/NR-78.md) `[GAP]`  | Attempts are outside the sequence  | An unfinished attempt that sent transactions goes under `aborted/`, outside the event sequence.                                         | 8.1.3      | script | I-10, I-118             |
| [NR-79](entries/NR-79.md) `[GAP]`  | Complete and self-consistent       | Each record holds its config, its tool commit, and the files its kind requires in its out dir, and no scratch or `.git`.                | 8.2.1      | script | I-10, I-57, I-69, I-119 |
| [NR-80](entries/NR-80.md) `[GAP]`  | Identity                           | The manifest of a record states the stack, the chain, the admin, the generation, and the package version that its folders name.         | 8.2.2      | script | I-10, I-57, I-69        |
| [NR-81](entries/NR-81.md) `[HOLD]` | Dated by the chain                 | The date of an event folder is the block day of its defining transaction, never the clock of the operator.                              | 8.2.3      | script | I-10, I-67, I-69        |
| [NR-82](entries/NR-82.md) `[HOLD]` | Kinds move versions one way        | An upgrade moves one generation up, a hotfix raises the patch, and versions and dates never go back.                                    | 8.3.1      | script | I-10, I-66              |
| [NR-83](entries/NR-83.md) `[GAP]`  | Each event links to the one before | Every event except a deploy links to the manifest of the event before it, by path and sha256.                                           | 8.3.2      | script | I-10, I-59, I-68        |
| [NR-84](entries/NR-84.md) `[HOLD]` | A record never changes             | Nothing under an event or attempt folder that exists at the merge base changes.                                                         | 8.4.1      | script | I-10                    |
| [NR-85](entries/NR-85.md) `[HOLD]` | The legacy relocation              | A flat legacy record may move once into a `00-deploy` event folder, as a pure move.                                                     | 8.4.2      | script | I-10                    |

<!-- END GENERATED INDEX -->
