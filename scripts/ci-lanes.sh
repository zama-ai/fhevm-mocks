# The test lanes of the workspace: every test that `make ci` runs, cut into groups that can run at the
# same time. scripts/run-lanes.sh sources this file; it is the one place that says what a lane runs.
#
#   lane <name> [after <lane>[,<lane>...]]    starts a lane; it runs once the lanes after `after` passed
#   step <directory> <command>                adds a command to that lane, run from that directory
#
# WHAT MAKES TWO LANES SAFE TOGETHER. They share no node port (test-ports.config.json gives every port
# one owner), and neither writes a directory the other reads:
#
#   - `forge test` writes `out/` and `cache/` of its package, so every `forge test` of one package is in
#     one lane. The create2 suites carry their own build directories and can sit in any lane.
#   - The two `templates` lanes REWRITE their package (placeholder addresses, remappings, a clean build,
#     the generated ABIs and templates). Nothing runs beside them: every other lane starts after both.
#   - The consumer tests copy the template folders that the hardhat lanes write, so they start after.
#
# A lane runs its steps on a tree that is already built: `make build-ci` comes first. A step calls the
# script below a package's `test`, which is why this file, unlike the Makefile, names those scripts.
#
# A test added to a package's `test` script, or to the Makefile's test targets, must be added to a lane.

# The cleartext generation pair, read where the Makefile reads it. `root` is set by run-lanes.sh.
generation() {
  node -p "require('${root}/npm-manifest.json').generations['host-contracts-cleartext'].$1.replace(/^\.\//, '')"
}
previous="$(generation previous)" || die "cannot read the previous cleartext generation from npm-manifest.json"
current="$(generation current)" || die "cannot read the current cleartext generation from npm-manifest.json"
readonly forge_std=foundry/forge-fhevm-std
readonly e2e='node --test --test-concurrency=1'

# ---- Alone: the steps that rewrite the tree ---------------------------------------------------------

lane prev-templates
step "${previous}" 'npm run --silent test:templates:run'

lane cur-templates after prev-templates
step "${current}" 'npm run --silent test:templates:run'

# ---- The previous generation ------------------------------------------------------------------------

lane prev-core after prev-templates,cur-templates
step "${previous}" 'npm run --silent test:forge'
step "${previous}" 'npm run --silent test:harness:run'

lane prev-deploy after prev-templates,cur-templates
step "${previous}" "${e2e} test/e2e/create2-deploy.test.ts"

# Settlement and hotfix share one port in this generation, so they share a lane. It is the longest one.
lane prev-settle-hotfix after prev-templates,cur-templates
step "${previous}" "${e2e} test/e2e/create2-settlement.test.ts"
step "${previous}" 'npm run --silent test:create2-hotfix-e2e'

# ---- The current generation -------------------------------------------------------------------------

lane cur-core after prev-templates,cur-templates
step "${current}" 'npm run --silent test:forge'
step "${current}" 'npm run --silent test:harness:run'

# What `test:upgrade` runs, without the `npm run compile` it starts with: the tree is built.
lane cur-upgrade after prev-templates,cur-templates
step "${current}" 'npx --no-install tsc --project test/ts/upgrade/tsconfig.json --noEmit'
step "${current}" 'npx --no-install vitest run --config test/ts/upgrade/vitest.config.ts'
step "${current}" 'node --test test/e2e/upgrade/create2.test.ts'

lane cur-deploy-hotfix after prev-templates,cur-templates
step "${current}" "${e2e} test/e2e/create2-deploy.test.ts"
step "${current}" 'npm run --silent test:create2-hotfix-e2e'

lane cur-settlement after prev-templates,cur-templates
step "${current}" "${e2e} test/e2e/create2-settlement.test.ts"

# ---- The other packages -----------------------------------------------------------------------------

lane forge-std after prev-templates,cur-templates
step "${forge_std}" 'npm run --silent test'
step "${forge_std}" 'npm run --silent test:anvil'
step "${forge_std}" 'npm run --silent test:anvil-refusals'
step "${forge_std}" 'npm run --silent test:anvil-mirror'

lane hh-v2 after prev-templates,cur-templates
step . 'npm --prefix hardhat/v2 run --silent test -w @fhevm/hardhat-plugin-v2-dev'
step . 'npm --prefix hardhat/v2 run --silent test -w @fhevm/hardhat-template-v2-dev'
step . 'npm --prefix hardhat/v2 run --silent test -w @fhevm/hardhat-plugin-v2-e2e-dev'

lane hh-v3 after prev-templates,cur-templates
step . 'npm --prefix hardhat/v3 run --silent test -w @fhevm/hardhat-plugin-v3-dev'
step . 'npm --prefix hardhat/v3 run --silent test -w @fhevm/hardhat-template-v3-dev'
step . 'npm --prefix hardhat/v3 run --silent test -w @fhevm/hardhat-plugin-v3-e2e-dev'

# Without `--build-linked-dependencies`: the tree is built, and a rebuild here would rewrite what the
# lanes beside this one read.
lane consumers after hh-v2,hh-v3
step . 'make clean-scratch'
step . './fhevm-npm-cli test-consumer --all --run --ci'
