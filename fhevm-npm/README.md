# fhevm-npm

Autonomous Node-native TypeScript CLI for validating [`FHEVM_NPM_RULES.md`](../fhevm-npm-docs/FHEVM_NPM_RULES.md). It owns its dependencies,
TypeScript configuration and tests, and imports no code from the surrounding SDK.

```sh
npm install
node ./fhevm-npm.ts check names
node ./fhevm-npm.ts check dependencies
node ./fhevm-npm.ts check pinned-dependencies
node ./fhevm-npm.ts check package-json
node ./fhevm-npm.ts check package-json-paths
node ./fhevm-npm.ts check workspaces
node ./fhevm-npm.ts check ownership
node ./fhevm-npm.ts check scripts
node ./fhevm-npm.ts check lockfiles
node ./fhevm-npm.ts check consumer-lockfiles
node ./fhevm-npm.ts check foundry
node ./fhevm-npm.ts check json-schemas
node ./fhevm-npm.ts check manifest-coverage
node ./fhevm-npm.ts check published-files
node ./fhevm-npm.ts check tsconfig-paths
node ./fhevm-npm.ts check tsc-mode
node ./fhevm-npm.ts check commit-scope
node ./fhevm-npm.ts check cleartext-config
node ./fhevm-npm.ts check generations
node ./fhevm-npm.ts check safechain
node ./fhevm-npm.ts check safechain --min-age-hours 72
node ./fhevm-npm.ts sync vendored
node ./fhevm-npm.ts sync vendored --check
node ./fhevm-npm.ts sync pinned
node ./fhevm-npm.ts sync pinned --check
node ./fhevm-npm.ts update dependencies --dry-run
node ./fhevm-npm.ts update dependencies
node ./fhevm-npm.ts update dependencies --min-age-hours 48
node ./fhevm-npm.ts bump vendored ./host-contracts-cleartext/v13 --tag v0.13.6
node ./fhevm-npm.ts bump vendored ./host-contracts-cleartext/v13 --tag v0.13.6 --check
node ./fhevm-npm.ts sync fhevm-chains --latest
node ./fhevm-npm.ts check fhevm-chains-origin
node ./fhevm-npm.ts check deployments
node ./fhevm-npm.ts check deployments --base origin/release/0.13.x
node ./fhevm-npm.ts sync hh-v2-constants          # hh-v2-constants: Hardhat 2 only, delete with hardhat/v2
node ./fhevm-npm.ts sync hh-v2-constants --check  # hh-v2-constants
node ./fhevm-npm.ts generate chain-constants
node ./fhevm-npm.ts generate chain-constants --check
node ./fhevm-npm.ts version check
node ./fhevm-npm.ts version apply --dry-run
node ./fhevm-npm.ts version apply --check-npmjs
node ./fhevm-npm.ts version list
node ./fhevm-npm.ts version list --check-npmjs
node ./fhevm-npm.ts version list --check-npmjs --json
node ./fhevm-npm.ts publish order
node ./fhevm-npm.ts publish render ./hardhat/v3/plugin/pkg
node ./fhevm-npm.ts publish render ./hardhat/v3/plugin/pkg --json
node ./fhevm-npm.ts publish pack ./hardhat/v3/plugin/pkg
node ./fhevm-npm.ts publish check ./hardhat/v3/plugin/pkg
node ./fhevm-npm.ts publish check ./hardhat/v3/plugin/pkg --check-npmjs
node ./fhevm-npm.ts publish check ./hardhat/v3/plugin/pkg --check-npmjs --audit
node ./fhevm-npm.ts publish check ./hardhat/v3/plugin/pkg --audit --audit-level moderate
node ./fhevm-npm.ts publish rehearse --exclude ./hardhat/v2/plugin/pkg
node ./fhevm-npm.ts scaffold ./hardhat/v2/fhevm-hardhat-template --out ~/try-template
node ./fhevm-npm.ts scaffold ./hardhat/v2/fhevm-hardhat-template --out ~/try-template --registry https://registry.npmjs.org
node ./fhevm-npm.ts test-consumer --list
node ./fhevm-npm.ts test-consumer ./host-contracts-cleartext/v12
node ./fhevm-npm.ts test-consumer ./host-contracts-cleartext/v12 --build-linked-dependencies --run
node ./fhevm-npm.ts test-consumer ./hardhat/v2/fhevm-hardhat-template/pkg --build-linked-dependencies --run --ci
node ./fhevm-npm.ts test-consumer --all --build-linked-dependencies --run --ci
```

The package exposes the same entry point as the `fhevm-npm` bin, so an installed or linked copy uses:

```sh
fhevm-npm [options] <command>
```

Verbosity is global and cumulative:

- no `-v`: print violations and command-specific result banners; successful npm subprocesses are silent;
- `-v`: add concise progress and success summaries while npm subprocess output remains silent;
- `-vv`: print detailed successes, timings, and normal npm subprocess output (the former `-v` behavior);
- `-vvv`: additionally run npm with `--loglevel verbose`;
- `-vvvv`: run npm with `--loglevel silly`.

Captured npm output is always printed when a silent subprocess fails.

Check commands have no command-specific options, except `check safechain --min-age-hours`. `test-consumer` accepts a package selector plus options for listing,
building linked dependencies, running and choosing or replacing its persistent output directory. Each consumer is
installed in isolation the way its own state dictates: `npm ci --install-links` when it carries a committed lockfile,
`npm install --install-links` when it is a workspace member (its installation root locks it, so it has none by policy)
or when an isolated consumer lacks one, which prints a warning. `--ci` turns that warning into an error and changes
nothing else. Without `--run`, it prints and preserves the
resulting directory for manual inspection. With
`--run`, it logs each directory below `${TMPDIR}/fhevm-npm-test-consumer/<consumer>/<format>`, executes `npm test` and
removes the marked format directory afterward; an explicit `--output` remains
available for inspection. The consumers are exactly those registered in `npm-manifest.json#consumerTests`: nothing is
discovered from directory names, scripts or dependencies. A selector names a consumer (key or package name), a published
payload, or that payload's dev owner; a payload or owner selector runs every suite it registers, and a consumer several
payloads register runs once; `--all` runs every registered consumer serially in source order. The CLI
recursively substitutes manifest-listed published runtime dependencies when their exact name and version match a local
candidate. The committed consumer manifest therefore only needs its genuine direct `file:` candidate. The CLI always
delegates linked package builds to the SDK Makefile, which owns prerequisite ordering and incremental build stamps. It
reads the manifest from `<root>/npm-manifest.json`; run
`fhevm-npm test-consumer --help` for details.

`update dependencies` raises every `^`/`~` floor to the newest in-range version published at least `--min-age-hours`
ago (default 72, a day beyond safe-chain's 48), then relocks each installation root with `npm install
--package-lock-only --before=<cutoff>` and regenerates each edited consumer fixture's lockfile with the same cutoff,
so a floor and its lock name the same version. Published packages move `devDependencies` only; `peerDependencies`, the
`npm-manifest.json` pins, exact versions and `file:`/`npm:` specs never move. It ends by comparing every floor it
covers with its lockfile, and fails on a lock still newer than its floor. `check safechain` asks registry.npmjs.org
when each version in every committed lockfile was published and fails on one younger than `--min-age-hours` (default
48, safe-chain's own) or listed in Aikido's malware feed. Both depend on the clock and the network, so neither is part
of `make check`.

`publish check --audit` vouches for what a payload brings at the time it is published. Once `--check-npmjs` (which
`--audit` implies) has proven every dependency installable, the packed tarball is installed alone into a throwaway
project with `npm install --legacy-peer-deps --ignore-scripts`, and `npm audit` must report nothing at or above
`--audit-level` (default `high`). Peers are the user's to install, so they are excluded, and the probe's lockfile is
checked to prove it: a peer that reached it fails the check instead of being audited. The publish workflow runs it on
the exact tarball it uploads.

`publish rehearse` runs what a release runs for each payload it publishes — `publish pack`, then `publish check
--check-npmjs --audit` — before any of them is on npm, and prints one line per payload with the result of each step.
The set is every npm-distributed payload in publish order, minus the previous generation of each family
(`generations`) and minus each `--exclude`. Since nothing is published yet, a dependency on another payload of the set
is satisfied by that payload's fresh tarball: the registry is not asked about it, and the audit installs it beside the
audited tarball. `make publish-rehearse` compiles first and excludes hardhat/v2.

Exit code `0` means the check passed, `1` means policy violations were found, and `2` means the CLI, manifest or
workspace could not be loaded.
