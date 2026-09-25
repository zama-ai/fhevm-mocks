# Orchestration for the sdk workspace.
#
# This file owns the graph BETWEEN packages, and speaks to each package ONLY through its public verbs:
# clean, clean:generated, generate, fmt, fmt:check, lint, compile, check, test (plus test:consumer
# where it applies) — and `build`, the everyday sweep: fmt:check → lint → compile. Everything below a
# verb — phases, leaf generators, per-tool scripts — is the package's private business; each package owns the order WITHIN its own verbs, and re-deriving that here would
# duplicate knowledge with a correct home. The named exceptions are workspace-level, not package-level:
# the fhevm-npm formatting (a non-member `-w` cannot reach) and the `test:anvil` operator target
# (a manual entry point, not lifecycle orchestration).
#
# What Make adds is the edge npm cannot express: `hardhat/v2/e2e`'s LINT consumes the plugin's BUILD
# output, and `npm run <script> --workspaces` can only sequence whole packages for one script name. That
# is why a repo-wide "lint everything, then build everything" is unsatisfiable, and why the phases and
# their prerequisites live here instead.
#
# There are deliberately NO build stamps. Every `compile-*` target is phony and runs whenever it is
# asked for. A stamp needs an exhaustive list of that package's inputs, and no such list stays right:
# the old one matched four extensions in seven directories, so editing `foundry.toml` or
# `remappings.txt`, or deleting a source, left the stamp fresh and the output stale. An unnecessary
# compile is slow; a skipped one validates stale output and reports a false green. Make still runs each
# phony target at most once per invocation, so `make compile` compiles each package exactly once. The
# tools keep their own incremental caches — Make simply always asks them.
#
#   make              list the targets
#   make compile      every artifact, in dependency order
#   make build        the same, gated: fmt-check, lint, then compile
#   make lint         every package's lint, compiling whatever a lint actually requires first
#   make -j4 compile  the same, parallel across independent branches
#
# Generation is NOT part of compiling. Generated output here is committed — pkg/ts/index.ts is the
# package's public surface, compiled by tsc and imported by consumers — which makes it a compile
# SOURCE, and a compile must not rewrite its own inputs.
#
# Three verbs, one job each, exactly as formatting already works here:
#   make generate   writes tracked files, deliberately, and you commit the result
#   make compile    consumes them, writing only into output directories
#   check-generated deletes every generated file, regenerates, and requires a spotless tree — the one
#                   sequence that also catches a generator that silently STOPPED emitting a file.
#
# Parallel-safe, though `compile` is a linear chain so `-j` only pays off on `lint`.

# The flags live in SHELL, not in .SHELLFLAGS: .SHELLFLAGS is a GNU Make 4.0 feature and macOS ships
# 3.81, which ignores it silently — so `set -o pipefail` was never actually in effect. Verified both ways
# on 3.81: with .SHELLFLAGS a failing pipe let the recipe continue; with the flags on SHELL it aborts.
SHELL := /usr/bin/env bash -eu -o pipefail
.SHELLFLAGS := -c
.DEFAULT_GOAL := help

DIR_COMMON           := common
DIR_COMMON_VENDORED  := common-vendored
# The cleartext generation pair, V(N) and V(N-1), is decided ONCE in npm-manifest.json#generations
# (FHEVM_NPM_RULES.md section 3.4) and read here rather than repeated. Plain `node -p` on the JSON: no
# dependencies, so it works before `make install`. `check-generations` is what validates the pair.
manifest-generation  = $(patsubst ./%,%,$(shell node -p "require('./npm-manifest.json').generations?.['host-contracts-cleartext']?.$(1) ?? ''"))
DIR_CLEARTEXT_V_PREV := $(call manifest-generation,previous)
DIR_CLEARTEXT_V_CUR  := $(call manifest-generation,current)
ifneq ($(words $(DIR_CLEARTEXT_V_PREV) $(DIR_CLEARTEXT_V_CUR)),2)
$(error cannot read npm-manifest.json#generations.host-contracts-cleartext (previous/current); run ./fhevm-npm-cli check generations)
endif
DIR_HH_V2            := hardhat/v2
DIR_HH_V3            := hardhat/v3
DIR_HH_V2_PLUGIN     := hardhat/v2/plugin
DIR_HH_V2_E2E        := hardhat/v2/e2e
DIR_HH_V2_TEMPLATE   := hardhat/v2/fhevm-hardhat-template
DIR_HH_V3_PLUGIN     := hardhat/v3/plugin
DIR_HH_V3_E2E        := hardhat/v3/e2e
DIR_HH_V3_TEMPLATE   := hardhat/v3/fhevm-hardhat-template
DIR_FHEVM_NPM        := fhevm-npm
# The Forge companion to forge-std. A member of the sdk root; its pkg/src/_host is generated from V(N)'s
# forge payload, so every verb on it depends on V(N) having been generated and compiled first.
DIR_FORGE_STD        := foundry/forge-fhevm-std
FHEVM_NPM_CLI        := ./fhevm-npm-cli

# Global flags spliced in BEFORE the subcommand, for any target that calls the CLI. Mainly verbosity,
# which is how you see per-package detail and the timings a check reports:
#
#   make check-pre              FHEVM_NPM_ARGS=-v     # ✅/❌ per package
#   make check-vendored-origin  FHEVM_NPM_ARGS=-vv    # the above plus ⏱️  timings
#
# Repeatable up to -vvvv. Any global flag the CLI accepts works here, not just verbosity.
FHEVM_NPM_ARGS       ?=

# `npm run -w <name>` resolves from anywhere in the workspace, so recipes never cd.
W_COMMON             := @fhevm/sdk-common-dev
W_VENDORED           := @fhevm/sdk-vendored-dev
# Each generation's `-dev` workspace name is read from its own package.json, so it cannot drift from the
# directory the manifest points at.
package-name         = $(shell node -p "require('./$(1)/package.json').name" 2>/dev/null)
W_CLEARTEXT_V_PREV   := $(call package-name,$(DIR_CLEARTEXT_V_PREV))
W_CLEARTEXT_V_CUR    := $(call package-name,$(DIR_CLEARTEXT_V_CUR))
ifneq ($(words $(W_CLEARTEXT_V_PREV) $(W_CLEARTEXT_V_CUR)),2)
$(error a cleartext generation named by npm-manifest.json#generations has no readable package.json name ($(DIR_CLEARTEXT_V_PREV), $(DIR_CLEARTEXT_V_CUR)))
endif
W_FORGE_STD          := $(call package-name,$(DIR_FORGE_STD))
ifeq ($(W_FORGE_STD),)
$(error $(DIR_FORGE_STD) has no readable package.json name)
endif
W_HH_V2_PLUGIN       := @fhevm/hardhat-plugin-v2-dev
W_HH_V2_E2E          := @fhevm/hardhat-plugin-v2-e2e-dev
W_HH_V2_TEMPLATE     := @fhevm/hardhat-template-v2-dev
W_HH_V3_PLUGIN       := @fhevm/hardhat-plugin-v3-dev
W_HH_V3_E2E          := @fhevm/hardhat-plugin-v3-e2e-dev
W_HH_V3_TEMPLATE     := @fhevm/hardhat-template-v3-dev

run = npm run --silent $(2) -w $(1)

# Cluster members live in their own installation root (one npm workspace per hardhat generation —
# one hoisted hardhat instance each, no symlinks), so the root `-w` cannot reach them: `--prefix`
# selects the cluster, `-w` the member inside it.
run-hh-v2 = npm --prefix $(DIR_HH_V2) run --silent $(2) -w $(1)
run-hh-v3 = npm --prefix $(DIR_HH_V3) run --silent $(2) -w $(1)

# `fhevm-npm` is deliberately NOT a workspace member, so `-w` cannot reach it. It still needs
# formatting: it was once outside `fmt` entirely, which is how unformatted files reached ci.
# (`scripts/` holds only .sh by policy — nothing there for prettier.)
run-prefix = npm run --silent $(2) --prefix ./$(1)

run-fhevm-npm = $(FHEVM_NPM_CLI) $(FHEVM_NPM_ARGS) $(1)

########################################################################################################
# Aggregates
########################################################################################################

.PHONY: help graph build compile rebuild ci ci-fast ci-local build-ci ci-from-scratch distclean regenerate-package-lock lint test check check-pre generate fmt fmt-check clean clean-generated install install-fast install-ci install-npm-cli

help: ## List the targets
	@grep -hE '^[a-zA-Z0-9_-]+:.*?## ' $(MAKEFILE_LIST) \
	  | awk -F':.*?## ' '{ \
	      if ($$1 ~ /^(build|check|check-pre|ci|build-ci|ci-from-scratch|clean|compile|graph|help|install|lint|regenerate-package-lock|rebuild|test|distclean)$$/) group = 0; \
	      else if ($$1 ~ /^compile-/) group = 1; \
	      else if ($$1 ~ /^check-/) group = 2; \
	      else if ($$1 ~ /^fmt($$|-)/) group = 3; \
	      else if ($$1 ~ /^lint-/) group = 4; \
	      else if ($$1 ~ /^test-/) group = 5; \
	      else group = 6; \
	      printf "%d\t%s\t%s\n", group, $$1, $$2; \
	    }' \
	  | sort -k1,1n -k2,2 \
	  | awk -F'\t' '{ \
	      if (NR > 1 && $$1 != group) print ""; \
	      group = $$1; \
	      printf "  \033[36m%-25s\033[0m %s\n", $$2, $$3; \
	    }'

COMPILE_PACKAGES := \
  compile-forge-std \
  compile-hh-v2-e2e \
  compile-hh-v2-template \
  compile-hh-v3-e2e \
  compile-hh-v3-template

compile: $(COMPILE_PACKAGES) ## Compile every package, in dependency order

# The everyday sweep, in lifecycle order. ONE sub-make with three goals, deliberately: goals run left
# to right in a single invocation, so the compiles `lint` triggers are not re-run by `compile`.
# Overloading `build` fails in the safe direction — muscle-memory `make build` still produces every
# artifact, it just gates them behind formatting and lint first.
build: ## fmt-check, then lint, then compile — everything, gated
	$(MAKE) fmt-check lint compile

lint: lint-shared lint-cleartext lint-forge-std lint-hh-v2 lint-hh-v3 lint-npm-cli ## Lint every package

# The suites both test lanes run after V(N), which is the ONE entry they differ in. Hoisted into a
# variable rather than wrapped with backslashes because `help` greps for a target and its `##` on the
# same physical line (see its recipe above) — a continued prerequisite list would drop both from
# `make help` without failing anything, which is the worst way for it to break.
TEST_SUITES_TAIL := \
  test-forge-std \
  test-hh-v2-plugin \
  test-hh-v2-template \
  test-hh-v2-e2e \
  test-hh-v3-plugin \
  test-hh-v3-template \
  test-hh-v3-e2e

test: test-cleartext-v-prev test-cleartext-v-cur $(TEST_SUITES_TAIL) ## Run package tests only; this is not the full validation workflow (use: 'make ci' instead)

test-fast: test-cleartext-v-prev test-cleartext-v-cur-fast $(TEST_SUITES_TAIL) ## `test`, with V(N)'s create2 rehearsals swapped for the upgrade's fast lane

check: check-npm-cli ## Run pre-build checks, build, then post-build checks

check-pre: check-npm-cli-pre-build ## Run all checks that do not require build output

# Vendored content settles FIRST — and in two steps: common-vendored's own `generate` renders
# sdk/cleartext-config.json into common-vendored/src, THEN sync fans the sources out into pkg/src and
# pkg/ts, which the generators read and forge compiles. Each package's `generate` then owns its internal
# straddle (pre → forge → post).
generate: ## Write every generated file (then commit the result)
	$(call run,$(W_VENDORED),generate)
	$(MAKE) sync-common-vendored
	$(call run,$(W_CLEARTEXT_V_PREV),generate)
	$(call run,$(W_CLEARTEXT_V_CUR),generate)
	$(call run,$(W_FORGE_STD),generate)

# Each package's `fmt` owns what formatting means there (prettier, plus forge fmt where it has
# Solidity). fhevm-npm is a non-member `-w` cannot reach — the one named workspace-level exception.
# scripts/ holds only .sh by policy, so nothing there is prettier's business.
fmt: ## Rewrite formatting everywhere
	$(call run,$(W_COMMON),fmt)
	$(call run,$(W_VENDORED),fmt)
	$(call run,$(W_CLEARTEXT_V_PREV),fmt)
	$(call run,$(W_CLEARTEXT_V_CUR),fmt)
	$(call run,$(W_FORGE_STD),fmt)
	$(call run-hh-v2,$(W_HH_V2_PLUGIN),fmt)
	$(call run-hh-v2,$(W_HH_V2_TEMPLATE),fmt)
	$(call run-hh-v2,$(W_HH_V2_E2E),fmt)
	$(call run-hh-v3,$(W_HH_V3_PLUGIN),fmt)
	$(call run-hh-v3,$(W_HH_V3_TEMPLATE),fmt)
	$(call run-hh-v3,$(W_HH_V3_E2E),fmt)
	$(call run-prefix,$(DIR_FHEVM_NPM),prettier:write)

fmt-check: ## Verify formatting everywhere
	$(call run,$(W_COMMON),fmt:check)
	$(call run,$(W_VENDORED),fmt:check)
	$(call run,$(W_CLEARTEXT_V_PREV),fmt:check)
	$(call run,$(W_CLEARTEXT_V_CUR),fmt:check)
	$(call run,$(W_FORGE_STD),fmt:check)
	$(call run-hh-v2,$(W_HH_V2_PLUGIN),fmt:check)
	$(call run-hh-v2,$(W_HH_V2_TEMPLATE),fmt:check)
	$(call run-hh-v2,$(W_HH_V2_E2E),fmt:check)
	$(call run-hh-v3,$(W_HH_V3_PLUGIN),fmt:check)
	$(call run-hh-v3,$(W_HH_V3_TEMPLATE),fmt:check)
	$(call run-hh-v3,$(W_HH_V3_E2E),fmt:check)
	$(call run-prefix,$(DIR_FHEVM_NPM),prettier:check)

# One `npm install` per INSTALLATION ROOT. The sdk root workspace holds no hardhat at all; each
# hardhat generation is a CLUSTER — its own npm workspace ($(DIR_HH_V2), later hardhat/v3) with its
# own lockfile, where hoisting gives every member the SAME single hardhat instance. That is the
# no-symlink singleton guarantee: hardhat's environment is per-module, so a plugin and its consumer
# must resolve one hardhat directory, and one installation root per hardhat major makes that true
# natively. fhevm-npm keeps its own root too — the CLI must run whatever state the others are in.
install: ## Install every installation root (sdk, fhevm-npm, each hardhat cluster) and forge dependencies
	npm install
	npm --prefix $(DIR_FHEVM_NPM) install
	npm --prefix $(DIR_HH_V2) install
	npm --prefix $(DIR_HH_V3) install
	$(call run-fhevm-npm,install-forge-dependencies)

# The CLI alone, for a tree where nothing else is installed yet — a fresh clone, or a copy taken out of
# this repository. fhevm-npm depends on no workspace package (only ajv, commander, prettier, typescript
# and zod), so its root installs and runs on its own: every `check` works with the sdk root, the hardhat
# clusters and the forge trees all still empty. That autonomy is the same property `distclean` relies on
# when it keeps this one tree and deletes the rest.
install-npm-cli: ## Install ONLY fhevm-npm's own root, so the CLI runs with nothing else installed
	npm --prefix $(DIR_FHEVM_NPM) install

install-fast: ## Install every installation root (sdk, fhevm-npm, each hardhat cluster) and forge dependencies
	npm install --no-audit --no-fund
	npm --prefix $(DIR_FHEVM_NPM) install --no-audit --no-fund
	npm --prefix $(DIR_HH_V2) install --no-audit --no-fund
	npm --prefix $(DIR_HH_V3) install --no-audit --no-fund
	$(call run-fhevm-npm,install-forge-dependencies)

# The strict variant, for CI and for publishing: `npm ci` installs exactly what each lockfile records,
# fails when a lockfile and its package.json disagree, and never writes a lockfile. `install` above
# would re-resolve and rewrite instead, so an artifact built after it is not provably the reviewed
# resolution. It deletes node_modules first, which is why the daily loop keeps using `install`.
install-ci: ## Install every installation root from its committed lockfile (npm ci), then forge dependencies
	npm ci --no-audit --no-fund
	npm --prefix $(DIR_FHEVM_NPM) ci --no-audit --no-fund
	npm --prefix $(DIR_HH_V2) ci --no-audit --no-fund
	npm --prefix $(DIR_HH_V3) ci --no-audit --no-fund
	$(call run-fhevm-npm,install-forge-dependencies)

# Deliberately NOT `git clean`: pattern-based deletion cannot distinguish a build output from a
# developer's .vscode or .env, and gitignored files are invisible to the spotless guard — an editor
# setup or a secret must never be the price of a from-scratch test. Everything here is explicit and
# regenerable: build outputs via each package's own clean, node_modules via the audited script,
# forge dependency trees asked of `forge config --json`.
#
# The FULL list is shown first and confirmed ONCE, before anything at all is deleted; only after the
# yes do the sub-deleters run with --force (their own questions would be redundant — this gate IS
# the question). A non-interactive stdin aborts unless FORCE=1 is passed explicitly.
# Ordering matters: `clean` runs npm scripts, so it needs node_modules. fhevm-npm's own tree is
# deliberately KEPT — it is the orchestrator this flow runs (the forge cleaner) and the recovery
# tool afterwards; broken-tree recovery is `./scripts/clean-node-modules.sh --include-fhevm-npm`.
distclean: ## Undo 'make install' and 'make build': shows everything first, asks once, then deletes
	@echo "🧹 make distclean will remove ALL of the following:"
	@echo ""
	@echo "── Forge dependency trees (from forge config --json) ─────────────────────────"
	$(call run-fhevm-npm,clean-forge-dependencies --dry-run)
	@echo ""
	@echo "── node_modules ───────────────────────────────────────────────────────────────"
	./scripts/clean-node-modules.sh --dry-run
	@echo ""
	@echo "── Build outputs ──────────────────────────────────────────────────────────────"
	@echo "   Everything 'make clean' removes: each package's emit dirs (pkg/ts/_*, pkg/_*),"
	@echo "   forge cache/out/broadcast, hardhat artifacts, tsbuildinfo files, ./tarballs."
	@echo ""
	@echo "   Kept: fhevm-npm/node_modules — the CLI stays runnable (recovery: --include-fhevm-npm)."
	@echo ""
	@if [ "$(FORCE)" != "1" ]; then \
	  if [ ! -t 0 ]; then echo "🛑 stdin is not a terminal — pass FORCE=1 to remove without asking."; exit 1; fi; \
	  printf 'Remove ALL of the above? [Y/n] '; \
	  read -r reply || exit 1; \
	  case "$$reply" in [nN]|[nN][oO]) echo "Aborted. Nothing was removed."; exit 1;; esac; \
	fi
	$(MAKE) clean
	$(call run-fhevm-npm,clean-forge-dependencies --force)
	./scripts/clean-node-modules.sh --force

# `distclean` plus the INSTALL lockfiles `make install` owns — the sdk root's
# and each hardhat cluster's — so the next `make install` re-resolves every dependency range
# from scratch: a deliberate dependency-upgrade event whose lock diff is the reviewed commit. Excluded
# on purpose: consumer-fixture lockfiles (their lifecycle is `test-consumer-regenerate-package-lock`)
# and fhevm-npm's (the autonomous orchestrator manages its own; re-resolve it deliberately with
# `npm --prefix fhevm-npm install` after deleting its lock).
# The locks are TRACKED files, so unlike `distclean` this requires a spotless worktree first: anything
# deleted is then recoverable with `git checkout -- .`.
# The single [Y/n] is distclean's — the banner below adds the locks to what that question covers.
regenerate-package-lock: ## Everything 'distclean' removes PLUS the install lockfiles (next install re-resolves deps)
	$(call require-spotless-worktree)
	@echo "🧹 make regenerate-package-lock = make distclean PLUS these tracked lockfiles:"
	@echo ""
	@echo "   ./package-lock.json"
	@echo "   ./$(DIR_HH_V2)/package-lock.json"
	@echo "   ./$(DIR_HH_V3)/package-lock.json"
	@echo ""
	$(MAKE) distclean
	rm -f ./package-lock.json ./$(DIR_HH_V2)/package-lock.json ./$(DIR_HH_V3)/package-lock.json
	@echo "🗑  install lockfiles removed — 'make install' will re-resolve and rewrite them; review and commit the diff."

# `ci` WITH THE ENVIRONMENT IT NEEDS LOCALLY. A bare `make ci` here is not the gate GitHub runs: the
# workflow sets `FHEVM_SKIP_RPC_TESTS=true`, so the network suites skip there and run here, against a
# real chain. That is MORE coverage, not less -- keep it -- but it only works if those suites can reach
# the fixture they read, and a freshly deployed one does not exist at the blocks `ForkBlocks` counts
# back from the head. So the floor is read off the chain first and passed in.
#
# The script prints 0 -- the value that means "no floor" -- once the fixture is old enough not to need
# one, so this keeps working untouched across a redeploy and costs nothing when there is nothing to do.
# `&&` rather than a second line: if the chain cannot be reached the gate FAILS, rather than quietly
# running without a floor and blaming the tree for what the network did.
#
# NOT `FHEVM_PARITY_REF_V13`. While `release/0.13.x` does not yet carry the 0.13 forge work,
# `check generation-parity` has nothing there to compare V(N-1) against and every target that runs the
# pre-build checks needs a ref given to it. That is a fact about one unmerged branch, not about this
# workspace, so it is exported by whoever needs it and never written down here.
ci-local: ## `ci` with the fork fixture floor read off the chain, so the network suites run for real
	@floor=$$($(DIR_FORGE_STD)/test/fheTest/fixture-floor.sh) && \
	  echo "FHEVM_FORK_FIXTURE_FLOOR=$$floor  (0 means the fixture needs no floor)" && \
	  FHEVM_FORK_FIXTURE_FLOOR=$$floor $(MAKE) ci

# The strongest proof this workspace has: a brand-new machine could clone, install, and pass every
# gate. Sub-makes for the same `-j` ordering reason `ci` uses them.
ci-from-scratch: ## Prove a fresh clone works: distclean everything, install, then every ci gate
	$(MAKE) distclean
	$(MAKE) install
	$(MAKE) ci

# Everything `ci` gates EXCEPT the tests. Split out so one invocation can build and check the whole
# workspace while the tests are run separately — per package, in their own CI job (plans/CI_TARGETS_PLAN.md).
# It is NOT narrowed per package, deliberately: deciding which subset of the checks and compiles one
# package's tests depend on is the kind of list that is wrong eventually, and a wrong one validates
# stale output and reports a false green. Repeating the whole thing only costs minutes.
#
# The phase ORDER is load-bearing, cheapest gate first so a failure costs the least time:
#   - The spotless check runs FIRST, before anything at all: check-generated needs it anyway, and
#     discovering it only there would have already thrown away every build output for nothing.
#   - `clean` is deliberate — stamps make `build` skippable, and validating a stale payload with
#     publint/attw would be worse than not validating it.
#   - `check-generated` is SECOND so regeneration drift fails before any compile. It deletes every
#     generated file, regenerates, and fails unless the worktree comes back spotless: it only ever
#     COMPARES, and never accepts what the generators produced. Once it passes the tree is spotless by
#     definition, which is what guarantees every later phase compiles exactly the committed bytes.
#
# The phases are sequential recipe lines rather than prerequisites: prerequisites of one target may run
# in any order under `-j`, and make abandons the rest of a recipe at its first failing line, so nothing
# downstream of a failed gate can run.
build-ci: ## Every ci gate EXCEPT the tests: clean, check-generated, checks, build, check-post
	$(call require-spotless-worktree)
	$(MAKE) clean
	$(MAKE) check-generated
	$(MAKE) check-pre
	$(MAKE) check-vendored-origin
	$(MAKE) build
	$(MAKE) check-post

# The maximum run: every gate this workspace has. `build-ci` owns the build-and-check phases and the
# reasoning about their order; this adds the tests on top.
#
# `test-anvil-ci` runs LAST, and the order is load-bearing: the consumer rehearsals assert that nothing
# holds port 8545 and fail outright if something does, so any tier that binds a node goes after them.
#
# It is a subset of `test-anvil` — see that target for which suites are in and why. The hardhat e2e
# suites against anvil are therefore still not part of `ci`, in either their own or the wrapped form.
ci: ## Run EVERY gate from a clean tree: formatting, checks, compile, lint, tests, consumer rehearsal, anvil suite
	$(MAKE) build-ci
	$(MAKE) test
	$(MAKE) test-consumer-ci
	$(MAKE) test-anvil-ci

# The lane for a working tree you are still editing: every gate that reads the tree as it is, none that
# rewrites or wipes it, and none of the create2 rehearsals. Dropped, and why:
#   - `clean` and the spotless-worktree guard — you have uncommitted work, that is the point;
#   - `check-generated` — it deletes and regenerates every generated file (a full `generate`, forge
#     included) and needs a spotless tree to judge the result;
#   - the create2 coordinator e2es (v(N)'s `test:create2-deploy-e2e`, `test:upgrade`'s second half) —
#     ~4 minutes each of `forge script` recompiles, replaced by `test:upgrade:fast` (see that target);
#   - `test-consumer-ci` — installs every registered consumer from scratch.
# What stays catches everything the dropped gates have caught so far, in a few minutes instead of many.
# `test-anvil-ci` stays: it is seconds, and it is the only lane here that exercises the SDK against a
# real node rather than an in-process one. It sits beside `test-fast` rather than inside it for the same
# reason it sits beside `test` in `ci` — the node-backed suites are their own tier, not part of `test`.
# Run `ci` before you push.
ci-fast: ## Every ci gate that reads the tree as it is: checks, build, check-post, fast tests, anvil suite — no clean, no create2, no consumers
	$(MAKE) check-pre
	$(MAKE) check-vendored-origin
	$(MAKE) build
	$(MAKE) check-post
	$(MAKE) test-fast
	$(MAKE) test-anvil-ci

# Two sub-makes rather than `rebuild: clean build`: prerequisites of one target may run in any order
# under `-j`, which would race the clean against the build.
rebuild: ## Clean everything, then compile from scratch (no gates — use 'build' for the gated form)
	$(MAKE) clean
	$(MAKE) compile

# Reverse dependency order — dependents before their dependencies — so nothing is ever cleaned while
# something downstream of it is still expected to be usable. The template goes first because it consumes
# the plugin, which consumes V(N).
#
# Note the template's own `clean` deliberately does NOT delegate to `pkg`'s: upstream's version ends by
# running `npm run typechain`, and a clean that regenerates would need the plugin it just helped remove.
# The parent removes pkg's output directly instead.
# The tooling's $TMPDIR scratch roots are regenerable by construction and are deleted BEFORE any flow
# that uses them: a stale root left by an older tool version otherwise trips test-consumer's ownership
# guard ("Refusing unmarked test-consumer root"). `clean` removes them, and the consumer targets depend
# on this directly so a standalone `make test-consumer[-ci]` starts fresh too.
clean-scratch: ## Delete the tooling's $TMPDIR scratch roots (consumer installs, pack npm cache)
	rm -rf "$${TMPDIR:-/tmp}/fhevm-npm-test-consumer" "$${TMPDIR:-/tmp}/fhevm-sdk-npm-cache"

clean: clean-scratch ## Remove every package's build output and the tooling's scratch roots
	$(call run-hh-v3,$(W_HH_V3_TEMPLATE),clean)
	$(call run-hh-v3,$(W_HH_V3_E2E),clean)
	$(call run-hh-v3,$(W_HH_V3_PLUGIN),clean)
	$(call run-hh-v2,$(W_HH_V2_TEMPLATE),clean)
	$(call run-hh-v2,$(W_HH_V2_E2E),clean)
	$(call run-hh-v2,$(W_HH_V2_PLUGIN),clean)
	$(call run,$(W_FORGE_STD),clean)
	$(call run,$(W_CLEARTEXT_V_CUR),clean)
	$(call run,$(W_CLEARTEXT_V_PREV),clean)
	$(call run,$(W_VENDORED),clean)
	$(call run,$(W_COMMON),clean)
	rm -rf ./tarballs

# Deliberately NOT part of `clean`: this deletes committed, shipped payload, so a `clean` that did it
# would leave `make clean && make build` emitting an incomplete package.
#
# It exists for the one thing `check-generated` cannot prove on its own — that the generators still emit
# EVERY file. A generator that silently stops writing one leaves the committed copy untouched, so nothing
# looks dirty and the gate passes. Delete first and the missing file shows up as a deletion.
#
# Each package owns its own list, as `clean:generated`, because that list belongs beside the generators
# that write it. The one guard that has to live here is the safety one: a fully clean `git status` means
# everything about to be deleted is committed, so any mistake — including in a list this file has never
# seen — is undone by `git checkout -- .`. That is why it tests `git status`, not `git diff`: `git diff`
# ignores untracked files, and an untracked file deleted is gone for good.
# The command that ran this will (partway through) DELETE committed generated files and regenerate
# them — only recoverable from a spotless tree. Shared by `ci` (which fails fast, before anything at
# all has run) and `clean-generated` (the step that actually deletes).
define require-spotless-worktree
@[ -z "$$(git status --porcelain)" ] || { \
  echo ""; \
  echo "🛑 ══════════════════════════════════════════════════════════════════════════"; \
  echo "🛑  STOPPED — your git working tree has uncommitted changes"; \
  echo "🛑 ══════════════════════════════════════════════════════════════════════════"; \
  echo ""; \
  echo "   The command you ran deletes files wholesale — committed generated files"; \
  echo "   it will regenerate, or everything a fresh clone lacks. That is only safe"; \
  echo "   on a spotless tree: anything committed is undone with  git checkout -- ."; \
  echo ""; \
  echo "   ⚠️  With uncommitted changes, that same recovery would wipe YOUR work too."; \
  echo "      Nothing has been deleted. Nothing has been touched."; \
  echo ""; \
  echo "   👉 Pick one, then re-run your command:"; \
  echo ""; \
  echo "      1️⃣  Commit your work:       git add -A && git commit"; \
  echo "      2️⃣  Or set it aside:        git stash --include-untracked"; \
  echo "          (get it back later:     git stash pop)"; \
  echo ""; \
  echo "   🔍 What git considers uncommitted right now:  git status"; \
  echo ""; \
  exit 1; }
endef

clean-generated: ## Delete every regenerable file, to prove `make generate` reproduces them from nothing
	$(call require-spotless-worktree)
	$(call run,$(W_VENDORED),clean:generated)
	$(call run,$(W_CLEARTEXT_V_PREV),clean:generated)
	$(call run,$(W_CLEARTEXT_V_CUR),clean:generated)
	$(call run,$(W_FORGE_STD),clean:generated)
	@echo "Deleted. Run 'make generate' - a spotless 'git status' proves the generators reproduce everything."

# `make graph` answers "what would this build, and why", without running anything.
# GNU Make 3.81 (what macOS ships) has no --trace, but --debug=b prints the same tree, deepest first.
graph: ## Print the dependency graph for TARGET (default: compile)
	@$(MAKE) --debug=b -n $(or $(TARGET),compile) 2>&1 \
	  | grep 'Must remake target' \
	  | sed -e "s/Must remake target .//" -e "s/.\.$$//" \
	  | awk '{ l[NR] = $$0 } END { for (i = NR; i > 0; i--) print l[i] }'

########################################################################################################
# Build graph
#
# V(N-1) -> V(N) -> plugin -> e2e. Each edge is a real consumption of the previous package's BUILD OUTPUT:
# V(N) devDepends on V(N-1), plugin/pkg imports @fhevm/host-contracts-cleartext (= V(N)'s pkg), and e2e imports
# both @fhevm/hardhat-plugin (= plugin/pkg) and @fhevm/host-contracts-cleartext.
########################################################################################################

.PHONY: compile-package compile-cleartext-v-prev compile-cleartext-v-cur compile-forge-std compile-hh-v2-plugin compile-hh-v2-template
.PHONY: compile-hh-v2-e2e compile-hh-v3-plugin compile-hh-v3-template compile-hh-v3-e2e

# Public bridge for tools that discover a package by manifest path while keeping this file authoritative
# for the actual build graph. Unknown packages fail instead of silently bypassing Make with `npm run build`.
compile-package: ## Compile PACKAGE and its prerequisites
	+@case "$(PACKAGE)" in \
	  "./$(DIR_CLEARTEXT_V_PREV)") target=compile-cleartext-v-prev ;; \
	  "./$(DIR_CLEARTEXT_V_CUR)") target=compile-cleartext-v-cur ;; \
	  "./$(DIR_FORGE_STD)") target=compile-forge-std ;; \
	  "./$(DIR_HH_V2_PLUGIN)") target=compile-hh-v2-plugin ;; \
	  "./$(DIR_HH_V2_TEMPLATE)") target=compile-hh-v2-template ;; \
	  "./$(DIR_HH_V2_E2E)") target=compile-hh-v2-e2e ;; \
	  "./$(DIR_HH_V3_PLUGIN)") target=compile-hh-v3-plugin ;; \
	  "./$(DIR_HH_V3_TEMPLATE)") target=compile-hh-v3-template ;; \
	  "./$(DIR_HH_V3_E2E)") target=compile-hh-v3-e2e ;; \
	  *) echo "Unsupported build package '$(PACKAGE)'" >&2; exit 2 ;; \
	esac; \
	$(MAKE) --no-print-directory "$$target"

compile-cleartext-v-prev: check-npm-cli-pre-build ## Compile the previous cleartext generation, V(N-1)
	@echo "==> compile $(DIR_CLEARTEXT_V_PREV)"
	$(call run,$(W_CLEARTEXT_V_PREV),compile)

compile-cleartext-v-cur: compile-cleartext-v-prev ## Compile the current cleartext generation, V(N)
	@echo "==> compile $(DIR_CLEARTEXT_V_CUR)"
	$(call run,$(W_CLEARTEXT_V_CUR),compile)

compile-forge-std: compile-cleartext-v-cur ## Compile forge-fhevm-std (its _host payload is generated from V(N))
	@echo "==> compile $(DIR_FORGE_STD)"
	$(call run,$(W_FORGE_STD),compile)

compile-hh-v2-plugin: compile-cleartext-v-cur ## Compile the Hardhat v2 plugin
	@echo "==> compile $(DIR_HH_V2_PLUGIN)"
	$(call run-hh-v2,$(W_HH_V2_PLUGIN),compile)

# Like its v2 sibling: plugin/pkg imports @fhevm/host-contracts-cleartext/ts, whose types are build output.
compile-hh-v3-plugin: compile-cleartext-v-cur ## Compile the Hardhat v3 plugin
	@echo "==> compile $(DIR_HH_V3_PLUGIN)"
	$(call run-hh-v3,$(W_HH_V3_PLUGIN),compile)

# `hardhat build` compiles the contracts and generates the typechain types the suite's lint reads.
# Loading hardhat.config.ts requires the built plugin.
compile-hh-v3-e2e: compile-hh-v3-plugin ## Compile the Hardhat v3 e2e suite
	@echo "==> compile $(DIR_HH_V3_E2E)"
	$(call run-hh-v3,$(W_HH_V3_E2E),compile)

compile-hh-v3-template: compile-hh-v3-plugin ## Compile the Hardhat v3 template
	@echo "==> compile $(DIR_HH_V3_TEMPLATE)"
	$(call run-hh-v3,$(W_HH_V3_TEMPLATE),compile)

compile-hh-v2-template: compile-hh-v2-plugin ## Compile the mirrored Hardhat v2 template
	@echo "==> compile $(DIR_HH_V2_TEMPLATE)"
	$(call run-hh-v2,$(W_HH_V2_TEMPLATE),compile)

# e2e's `compile` (hardhat compile) generates its own typechain types; its `lint` self-provides them
# the same way. Both need the compiled plugin, because loading hardhat.config.ts requires it.
compile-hh-v2-e2e: compile-hh-v2-plugin ## Compile the Hardhat v2 e2e suite
	@echo "==> compile $(DIR_HH_V2_E2E)"
	$(call run-hh-v2,$(W_HH_V2_E2E),compile)

########################################################################################################
# Check graph
########################################################################################################

.PHONY: check-npm-cli check-npm-cli-pre-build check-npm-cli-post-build check-mirror

check-npm-cli: check-npm-cli-post-build # Internal: run every fhevm-npm check in lifecycle order

# Deliberately PHONY, so it re-runs every time something asks for it — four times in a `make ci`, and
# that is the correct trade. Stamping it needs an exhaustive list of what these checks read, and that
# list cannot be right: check-tsconfig-paths reads every tsconfig.json, check-lint-policy reads the
# eslint configs, and neither is package metadata. A stamp whose inputs are incomplete SKIPS a check that
# should have run. Re-running a cheap check costs seconds; missing one costs a broken release.
check-npm-cli-pre-build: # Internal: run fhevm-npm checks that do not require generated output
	$(call run-fhevm-npm,check foundry)
	$(call run-fhevm-npm,check json-schemas)
	$(call run-fhevm-npm,check manifest-coverage)
	$(call run-fhevm-npm,version check)
	$(call run-fhevm-npm,check names)
	$(call run-fhevm-npm,check workspaces)
	$(call run-fhevm-npm,check ownership)
	$(call run-fhevm-npm,check package-json)
	$(call run-fhevm-npm,check published-files)
	$(call run-fhevm-npm,check dependencies)
	$(call run-fhevm-npm,check pinned-dependencies)
	$(call run-fhevm-npm,check generations)
	$(call run-fhevm-npm,check generation-parity)
	$(call run-fhevm-npm,check scripts)
	$(call run-fhevm-npm,check tsc-mode)
	$(call run-fhevm-npm,check lockfiles)
	$(call run-fhevm-npm,check extraneous)
	$(call run-fhevm-npm,check consumer-lockfiles)
	$(call run-fhevm-npm,check lint-policy)
	$(call run-fhevm-npm,check cleartext-config)
	$(call run-fhevm-npm,sync vendored --check)

# Not wired into `check-pre` or `ci`: the mirror spec is not implemented yet. Running it today reports 7
# violations, but they are the spec's gaps rather than real drift — it has not been taught about the
# workspace adaptations (renamed eslint/prettier configs, dropped .vscode/). The target exists so the
# work stays visible and addressable; swap the echo for the real check once the spec lands.
check-mirror: ## Verify the hardhat template still mirrors upstream byte-for-byte (NOT YET IMPLEMENTED)
	@echo "⚠️  Not Yet Implemented Warning: check-mirror is a placeholder."
	@echo "⚠️  The mirror spec does not yet describe this workspace's adaptations, so the real check"
	@echo "⚠️  ($(DIR_HH_V2_TEMPLATE) -> npm run check:mirror) still reports false violations."

# The prerequisites are `compile`'s, deliberately: both checks below validate literal paths across every
# package, and build output is among those paths — the templates' gitignored `types/`, and each plugin
# payload's `_esm`/`_types`, which its own `exports` and `types` name. A prerequisite list narrower than
# `compile` makes them pass on whatever the last build happened to leave and fail on a clean tree; that
# is how the v3 cluster went unbuilt here while its `_types/index.d.ts` was being checked.
check-npm-cli-post-build: compile # Internal: check generated paths
	$(call run-fhevm-npm,check package-json-paths)
	$(call run-fhevm-npm,check tsconfig-paths)

########################################################################################################
# Post-build checks
#
# Each package's `check` validates its own deliverables (publint/attw, contract sizes, configs, vendored
# provenance). Its prerequisite is that `generate` and `build` have RUN in this worktree: forge's ./out
# comes from generate's internal compile, the tsc payload from build. The build deps below provide the
# payloads transitively; ./out is a documented prerequisite — in `ci` the gate's regeneration provides
# it, and a worktree where it never existed fails loudly (contract-sizes throws), never silently.
########################################################################################################

.PHONY: check-post

check-post: check-npm-cli-post-build ## Checks that require a generated and built tree
	$(call run,$(W_CLEARTEXT_V_PREV),check)
	$(call run,$(W_CLEARTEXT_V_CUR),check)
	$(call run,$(W_FORGE_STD),check)
	$(call run-hh-v2,$(W_HH_V2_PLUGIN),check)
	$(call run-hh-v3,$(W_HH_V3_PLUGIN),check)

########################################################################################################
# Lint graph
#
# Type-aware linting reads its dependencies' DECLARATIONS, so a lint edge points at a build, not a lint.
# This is the part npm cannot express, and the reason `npm run lint --workspaces` fails on a clean tree.
########################################################################################################

.PHONY: lint-shared lint-cleartext lint-hh-v2
.PHONY: lint-common lint-common-vendored lint-cleartext-v-prev lint-cleartext-v-cur lint-forge-std
.PHONY: lint-hh-v2-plugin lint-hh-v2-template lint-hh-v2-e2e lint-hh-v3 lint-hh-v3-plugin lint-hh-v3-template lint-hh-v3-e2e lint-npm-cli

lint-shared: lint-common lint-common-vendored

lint-cleartext: lint-cleartext-v-prev lint-cleartext-v-cur

lint-hh-v2: lint-hh-v2-plugin lint-hh-v2-template lint-hh-v2-e2e

lint-hh-v3: lint-hh-v3-plugin lint-hh-v3-template lint-hh-v3-e2e

lint-common: ## Lint common
	$(call run,$(W_COMMON),lint)

lint-common-vendored: ## Lint common-vendored
	$(call run,$(W_VENDORED),lint)

lint-cleartext-v-prev: compile-cleartext-v-prev ## Lint the previous cleartext generation, V(N-1) (needs its own generated sources)
	$(call run,$(W_CLEARTEXT_V_PREV),lint)

lint-cleartext-v-cur: compile-cleartext-v-cur ## Lint the current cleartext generation, V(N)
	$(call run,$(W_CLEARTEXT_V_CUR),lint)

lint-forge-std: compile-forge-std ## Lint forge-fhevm-std: eslint + tsc over internal/, then forge lint
	$(call run,$(W_FORGE_STD),lint)

lint-hh-v2-plugin: compile-cleartext-v-cur ## Lint the Hardhat v2 plugin (its types resolve through V(N)'s pkg)
	$(call run-hh-v2,$(W_HH_V2_PLUGIN),lint)

lint-hh-v2-template: compile-hh-v2-plugin ## Lint the mirrored Hardhat v2 template against the built plugin
	$(call run-hh-v2,$(W_HH_V2_TEMPLATE),lint)

lint-hh-v2-e2e: compile-hh-v2-plugin ## Lint Hardhat v2 e2e (self-provides typechain; needs the built plugin)
	$(call run-hh-v2,$(W_HH_V2_E2E),lint)

lint-hh-v3-plugin: compile-cleartext-v-cur ## Lint the Hardhat v3 plugin (its types resolve through V(N)'s pkg)
	$(call run-hh-v3,$(W_HH_V3_PLUGIN),lint)

lint-hh-v3-template: compile-hh-v3-plugin ## Lint the Hardhat v3 template against the built plugin
	$(call run-hh-v3,$(W_HH_V3_TEMPLATE),lint)

lint-hh-v3-e2e: compile-hh-v3-plugin ## Lint Hardhat v3 e2e (self-provides typechain; needs the built plugin)
	$(call run-hh-v3,$(W_HH_V3_E2E),lint)

lint-npm-cli: ## Typecheck and test the fhevm-npm CLI
	npm --prefix $(DIR_FHEVM_NPM) run typecheck
	npm --prefix $(DIR_FHEVM_NPM) test

########################################################################################################
# Tests
#
# Tests assume a BUILT tree — `make build test`, not `make test` alone. They declare no build
# prerequisite on purpose: re-running one test should never trigger a 90s rebuild, and a test target that
# silently rebuilds hides what it costs. `make ci` is the one-liner that orders the whole thing.
########################################################################################################

.PHONY: test-cleartext-v-prev test-cleartext-v-cur test-cleartext-v-cur-fast test-fast test-cleartext-upgrade test-cleartext-upgrade-fast test-hh-v2-plugin test-hh-v2-template test-hh-v3-plugin test-hh-v3-template
.PHONY: test-hh-v2-e2e test-hh-v2-e2e-anvil test-hh-v3-e2e test-hh-v3-e2e-anvil test-consumer test-consumer-ci clean-scratch
.PHONY: test-forge-std test-forge-std-fork test-forge-std-fork-url test-forge-std-anvil test-forge-std-anvil-refusals test-forge-std-anvil-mirror
.PHONY: test-anvil test-anvil-ci test-anvil-hh-v2-e2e test-anvil-hh-v3-e2e

# `test` is what a generation can prove ALONE; `test:upgrade` is what it can only prove against V(N-1),
# and only V(N) has a V(N-1) to prove it against. Which generation that is comes from the manifest, so the
# verb is asked of V(N) and never of V(N-1) — a rotation retires the older generation's upgrade suite by
# moving the pair, with nothing to remember inside the package. Deleting the suite it can no longer run is
# then unhurried cleanup rather than a step the rotation is blocked on.
test-cleartext-v-prev: compile-cleartext-v-prev ## Previous cleartext generation, V(N-1): unit + forge + harness tests (self-provides ./out)
	$(call run,$(W_CLEARTEXT_V_PREV),test)

test-cleartext-v-cur: compile-cleartext-v-cur ## Current cleartext generation, V(N): the above, then the upgrade from V(N-1)
	$(call run,$(W_CLEARTEXT_V_CUR),test)
	$(call run,$(W_CLEARTEXT_V_CUR),test:upgrade)

# V(N-1)'s `test` is already the fast shape (no create2 e2e: a retired generation deploys nothing new).
test-cleartext-v-cur-fast: compile-cleartext-v-cur ## Current cleartext generation, V(N): unit + forge + harness, then the upgrade's fast lane
	$(call run,$(W_CLEARTEXT_V_CUR),test:fast)
	$(call run,$(W_CLEARTEXT_V_CUR),test:upgrade:fast)

test-cleartext-upgrade: compile-cleartext-v-cur ## V(N) only: the upgrade from V(N-1), on its own
	$(call run,$(W_CLEARTEXT_V_CUR),test:upgrade)

# The same upgrade, minus the create2 coordinator: the full lane spends ~4 of its 5 minutes recompiling
# inside `forge script` (placeholder patching defeats the cache, by design). What is left here — the
# init-data tables, the deploy order across every notation, the bytecode/reinitializer table, and the
# library upgrade on a fresh anvil — is where every upgrade failure so far has actually surfaced, in
# well under a minute. Local iteration runs this; CI and the final check before a bump run the full lane.
test-cleartext-upgrade-fast: compile-cleartext-v-cur ## V(N) only: the upgrade's fast lane (no create2 coordinator, <1 min)
	$(call run,$(W_CLEARTEXT_V_CUR),test:upgrade:fast)

# The offline suite is the one `test` runs. The three below need the outside world. The two fork targets
# need a Sepolia RPC (`SEPOLIA_RPC_URL`, else `[rpc_endpoints] sepolia` in its foundry.toml), so they stay
# opt-in and enter no aggregate. `test-forge-std-anvil` needs only a local node and starts its own, so it
# is part of the `test-anvil` tier — and through it, of `ci`.
#
# `FHEVM_SKIP_RPC_TESTS=true` turns every REMOTE-rpc test in `test-forge-std` into a skip, which is how ci
# keeps that lane offline: the package commits an `[rpc_endpoints] sepolia`, so each suite's own
# `hasRpcUrlFor` opt-in is always satisfied and can never skip by itself. It does not touch the anvil
# suite — a local node is not a network.
test-forge-std: compile-forge-std ## forge-fhevm-std offline forge tests
	$(call run,$(W_FORGE_STD),test)

test-forge-std-fork: compile-forge-std ## forge-fhevm-std fork tests against Sepolia (needs SEPOLIA_RPC_URL or foundry.toml rpc_endpoints)
	$(call run,$(W_FORGE_STD),test:fork)

test-forge-std-fork-url: compile-forge-std ## forge-fhevm-std born-on-a-fork suite under `forge test --fork-url` (same RPC opt-in)
	$(call run,$(W_FORGE_STD),test:fork-url)

test-forge-std-anvil: compile-forge-std ## forge-fhevm-std anvil suite (starts and stops its own anvil on port 8546)
	$(call run,$(W_FORGE_STD),test:anvil)

# A TIER MEMBER OF ITS OWN, and not part of the suite above, because it is the opposite test: that one
# asks whether a healthy node works, this one arranges BROKEN ones -- a node that refuses `anvil_setCode`,
# or accepts it and does nothing -- and asserts the SDK says which. It needs its own node (it resets it
# between cases) and its own port, and it drives forge from TypeScript because a forge test cannot put a
# node into those states: forge owns the fork and caches it per url.
test-forge-std-anvil-refusals: compile-forge-std ## forge-fhevm-std anvil REFUSAL paths (own anvil on port 8547)
	$(call run,$(W_FORGE_STD),test:anvil-refusals)

# Also its own node, for a smaller reason: it RESETS the node mid-test, which is the only way to make the
# SDK mirror a second time -- and doing that to the shared one wipes state the suite beside it relies on.
test-forge-std-anvil-mirror: compile-forge-std ## forge-fhevm-std mirror suite (own anvil on port 8548)
	$(call run,$(W_FORGE_STD),test:anvil-mirror)

test-hh-v2-plugin: compile-hh-v2-plugin ## Hardhat v2 plugin tests
	$(call run-hh-v2,$(W_HH_V2_PLUGIN),test)

test-hh-v2-template: compile-hh-v2-template ## Hardhat v2 template tests (workspace-native form)
	$(call run-hh-v2,$(W_HH_V2_TEMPLATE),test)

test-hh-v3-plugin: compile-hh-v3-plugin ## Hardhat v3 plugin tests (skip themselves until the cluster is installed)
	$(call run-hh-v3,$(W_HH_V3_PLUGIN),test)

test-hh-v3-template: compile-hh-v3-template ## Hardhat v3 template tests
	$(call run-hh-v3,$(W_HH_V3_TEMPLATE),test)

test-hh-v3-e2e: compile-hh-v3-e2e ## Hardhat v3 e2e tests on the in-process network
	$(call run-hh-v3,$(W_HH_V3_E2E),test)

test-hh-v3-e2e-anvil: compile-hh-v3-e2e ## Hardhat v3 e2e tests against a local anvil (must already be running)
	$(call run-hh-v3,$(W_HH_V3_E2E),test:anvil)

# HARDHAT_NETWORK=hardhat — the in-process network, so this needs nothing running. The variants below
# do: `anvil` a local node, `sepolia`/`devnet` a funded remote account.
test-hh-v2-e2e: compile-hh-v2-e2e ## Hardhat v2 e2e tests on the in-process network
	$(call run-hh-v2,$(W_HH_V2_E2E),test)

test-hh-v2-e2e-anvil: compile-hh-v2-e2e ## Hardhat v2 e2e tests against a local anvil (must already be running)
	$(call run-hh-v2,$(W_HH_V2_E2E),test:anvil)

# Separate tier: packs and installs each payload into a temp project and runs its suite. Minutes, not
# seconds, so it is deliberately not part of `make test`.
#
# WHICH consumers run is not this file's knowledge: `--all` runs every consumer registered in
# npm-manifest.json#consumerTests, serially, in source order (`test-consumer --list` shows them). HOW each
# is installed is derived per consumer by the CLI, not chosen here: a committed lockfile is replayed
# (npm ci); a workspace MEMBER — both hardhat templates — has none BY DESIGN (rule 6.1.1: its installation
# root locks it) and is resolved fresh (npm install). The templates' lock-replaying rehearsal belongs to
# the publish-mirror RENDER, which regenerates a public lockfile; until that lands their legs still prove
# a fresh consumer install and test against the live workspace payloads. The v2 template is also the v2
# PLUGIN's consumer test: it links the plugin payload, so the resolution checks the CLI runs on every
# linked payload cover the plugin there.
#
# The two targets differ by ONE flag. `--ci` is a strictness assertion: an isolated (non-member) consumer
# with no committed lockfile is a warning below and a hard error in the CI variant. Nothing else changes.
test-consumer: clean-scratch compile-hh-v2-template compile-hh-v3-template ## Install and test every registered consumer (missing fixture lockfile: warn)
	$(call run-fhevm-npm,test-consumer --all --build-linked-dependencies --run)

test-consumer-ci: clean-scratch compile-hh-v2-template compile-hh-v3-template ## Install and test every registered consumer (missing fixture lockfile: error)
	$(call run-fhevm-npm,test-consumer --all --build-linked-dependencies --run --ci)

# Separate tier: the suites that need a local EVM node. Every one of them OWNS its node here —
# `scripts/with-anvil.sh` starts it, waits until it answers, and stops it however the run ends — so this
# tier needs nothing running beforehand and leaves nothing running after. That is what makes it CI-safe,
# and why it can sit in `ci` while the bring-your-own-node targets below cannot.
#
# Each suite gets a FRESH node rather than sharing one: the hardhat plugin deploys the cleartext stack on
# first connection, so a second suite meeting a stack it did not deploy is not the scenario under test.
#
# THE PORT MAP, because it is a cross-package invariant and nothing else states it in one place:
#   8545        hardhat v2/v3 e2e, and the v12/v13 consumer rehearsals — never concurrent, see `ci`
#   8546        forge-fhevm-std `test:anvil`
#   8547        forge-fhevm-std `test:anvil-refusals` — resets its node between cases, so it cannot
#               share one with 8546
#   8548        forge-fhevm-std `test:anvil-mirror` — resets its node mid-test, same reason
#   8557/8558   v13 create2 e2e (spawned by the suites themselves)
#   8600-8651   v12/v13 vitest suites; uniqueness enforced by test/anvil-ports.test.ts in each generation
# Anything added here must claim a port no one else holds.
#
# The two targets below are the bring-your-own-node ones with a node provided; they repeat the suite's
# own invocation rather than recursing into it, so there is no sub-make inside the wrapper script.
test-anvil-hh-v2-e2e: compile-hh-v2-e2e ## Hardhat v2 e2e against an anvil this target starts and stops
	./scripts/with-anvil.sh --port 8545 -- $(call run-hh-v2,$(W_HH_V2_E2E),test:anvil)

test-anvil-hh-v3-e2e: compile-hh-v3-e2e ## Hardhat v3 e2e against an anvil this target starts and stops
	./scripts/with-anvil.sh --port 8545 -- $(call run-hh-v3,$(W_HH_V3_E2E),test:anvil)

# Sequential recipe lines, not prerequisites — the reasoning at `build-ci` applies, and here it is not
# merely about ordering: two of these three bind the same port, so running them in parallel cannot work.
test-anvil: ## Every suite that needs a local node, each against a fresh one it starts and stops
	$(MAKE) test-forge-std-anvil
	$(MAKE) test-forge-std-anvil-refusals
	$(MAKE) test-forge-std-anvil-mirror
	$(MAKE) test-anvil-hh-v2-e2e
	$(MAKE) test-anvil-hh-v3-e2e

# What `ci` runs, and deliberately a SUBSET of `test-anvil`: the two hardhat e2e suites take ~4 minutes
# each, which is not yet worth paying on every push. They are not excluded because they fail — all three
# pass under `make test-anvil` — so promoting one is a single line here when it earns its minutes.
test-anvil-ci: ## The part of `test-anvil` that ci runs: the forge-fhevm-std anvil suites
	$(MAKE) test-forge-std-anvil
	$(MAKE) test-forge-std-anvil-refusals
	$(MAKE) test-forge-std-anvil-mirror

########################################################################################################
# Generated sources
#
# Generation is its own flow, deliberately outside `build` and outside `test`: a build that rewrites its
# own tracked inputs can never settle, and stamps derived from those inputs go stale the moment it runs.
# So nothing here is a prerequisite of a build — you run `make generate` and commit the result, and ci
# only ever *checks* that the committed output is what the generators produce.
########################################################################################################

.PHONY: check-generated sync-common-vendored check-vendored-origin

# THE regeneration gate: delete every generated file, regenerate everything, and require the worktree to
# come back spotless. Deleting first is what regenerate-and-diff alone cannot do — a generator that
# silently STOPS emitting a file leaves the committed copy untouched and nothing looks dirty; after the
# delete, the missing file shows up as a deletion.
#
# There is no list of generated paths, deliberately: each package owns its own as `clean:generated`, and
# the final `git status --porcelain` catches drift wherever it lands — modified, deleted AND untracked
# (`git diff` would miss a generator that starts emitting a NEW file).
#
# The cost, accepted knowingly: this REQUIRES a spotless worktree (the guard in `clean-generated`
# enforces it), because deleting committed files is only recoverable from a clean tree. The old gate
# tolerated a dirty tree via snapshots but could not see dropped emitters.
check-generated: ## Delete every generated file, regenerate, and fail unless the tree returns spotless
	$(MAKE) clean-generated
	$(MAKE) generate
	@dirty="$$(git status --porcelain)"; \
	  if [ -n "$$dirty" ]; then \
	    echo ""; \
	    echo "🛑 ══════════════════════════════════════════════════════════════════════════"; \
	    echo "🛑  FAILED — the committed generated files do not match what the generators"; \
	    echo "🛑  actually produce"; \
	    echo "🛑 ══════════════════════════════════════════════════════════════════════════"; \
	    echo ""; \
	    echo "   Every generated file was deleted and regenerated from its sources."; \
	    echo "   If everything were in sync, git would now see a spotless tree."; \
	    echo "   Instead, these files differ from what is committed:"; \
	    echo ""; \
	    printf '%s\n' "$$dirty" | sed 's/^/      /'; \
	    echo ""; \
	    echo "   This usually means someone changed a generator INPUT (a contract in"; \
	    echo "   pkg/src, an export.manifest.json, a config, a vendored pin) without"; \
	    echo "   committing the regenerated output — or edited a generated file by hand."; \
	    echo ""; \
	    echo "   👉 How to fix:"; \
	    echo ""; \
	    echo "      1️⃣  Look at what changed:              git diff"; \
	    echo "      2️⃣  If the changes look right, keep:   git add -A && git commit"; \
	    echo "      3️⃣  Re-run:                            make ci   (or make check-generated)"; \
	    echo ""; \
	    echo "   ↩️  If the changes look WRONG, undo them (git checkout -- .) and fix the"; \
	    echo "      generator or its input instead — never hand-edit a generated file."; \
	    echo ""; \
	    exit 1; \
	  fi

########################################################################################################
# Vendored sources
########################################################################################################

.PHONY: sync-common-vendored bump-vendored check-vendored-origin check-vendored check-cleartext-config sync-fhevm-chains check-fhevm-chains
.PHONY: version-list version-check version-plan version-apply publish-order publish-render publish-pack publish-pack-all publish-check

########################################################################################################
# Release: versions and publication (plans/RELEASE_PLAN.md). ./versions.json is the authority for
# every published version; package.json versions and lockfile member lines are derived from it.
# Nothing here publishes: `publish pack` produces the tarball, `npm publish <tarball>` is CI's.
########################################################################################################

# The payload selector for the publish-* targets: a manifest key such as ./hardhat/v3/plugin/pkg.
PAYLOAD ?=
require-payload = $(if $(PAYLOAD),,$(error PAYLOAD is required, e.g. make $(1) PAYLOAD=./hardhat/v3/plugin/pkg))

version-list: ## Every published payload: central version, package.json version, channels
	$(call run-fhevm-npm,version list)

version-check: ## Is every derived version equal to versions.json (also part of check-pre)
	$(call run-fhevm-npm,version check)

version-plan: ## Preview what `version apply` would reconcile from versions.json, writing nothing
	$(call run-fhevm-npm,version apply --dry-run)

version-apply: ## Reconcile package.json versions and lockfile member lines from versions.json
	$(call run-fhevm-npm,version apply)

publish-order: ## The npm-distributed payloads in dependency order, one manifest key per line
	$(call run-fhevm-npm,publish order)

publish-render: ## Show PAYLOAD's package.json as npmjs.com will see it, and the files npm would pack
	$(call require-payload,publish-render)
	$(call run-fhevm-npm,publish render $(PAYLOAD))

publish-pack: ## Render PAYLOAD and `npm pack` it into ./tarballs; prints the tarball path
	$(call require-payload,publish-pack)
	$(call run-fhevm-npm,publish pack $(PAYLOAD))

publish-check: ## Is PAYLOAD's tarball fit for npmjs.com (no file: spec, central version)
	$(call require-payload,publish-check)
	$(call run-fhevm-npm,publish check $(PAYLOAD))

# `build` first, deliberately: `publish pack` stages what a payload ships, so packing an unbuilt tree
# produces a tarball missing its own compiled output — and npm pack reports success either way. The
# payload list comes from `publish order`, so a payload that links another is packed after it, and a
# new npm-distributed package is picked up here the day the manifest declares it.
publish-pack-all: build ## Build, then pack every npm-distributed payload into ./tarballs
	@for payload in $$($(FHEVM_NPM_CLI) publish order); do \
	  $(call run-fhevm-npm,publish pack $$payload) || exit 1; \
	done

sync-common-vendored: ## Write every vendored destination from its source of truth
	$(call run-fhevm-npm,sync vendored)

# The one way a pin moves. Everything derived from it follows in the same run: the manifest's commit and
# digest, the copies, each owning package.json. Read the diff it leaves, then the generation's checklist.
#
#   make bump-vendored PKG=./host-contracts-cleartext/v13 TAG=v0.13.6
#   make bump-vendored PKG=… TAG=… COMMIT=<sha>          # a commit no tag names yet
#   make bump-vendored PKG=… TAG=… CHECK=1               # say what would move, write nothing
bump-vendored: ## Move every vendored pin under PKG to TAG (manifest, digests, copies, package.json)
	@test -n "$(PKG)" -a -n "$(TAG)" || { echo "usage: make bump-vendored PKG=<package key> TAG=<tag> [COMMIT=<sha>] [CHECK=1]"; exit 2; }
	$(call run-fhevm-npm,bump vendored $(PKG) --tag $(TAG) $(if $(COMMIT),--commit $(COMMIT),) $(if $(CHECK),--check,))

# Read-only: re-renders every face of sdk/cleartext-config.json in memory and fails if a committed one
# differs. The direct guard for the faces nothing else reads back — scripts/cleartext-config.sh above all.
check-cleartext-config: ## Does every generated cleartext-config face match sdk/cleartext-config.json
	$(call run-fhevm-npm,check cleartext-config)

check-vendored-origin: ## Does each local vendored folder match its declared origin (git commit)
	$(call run-fhevm-npm,check vendored-origin)

# The full vendored audit, read-only: copies current (would the copier write anything?) AND
# legitimate (does each vendored folder match its declared origin?). Green on both is the only state
# meaning every copy is current and accounted for. The cheaper compare runs first, to fail fast.
check-vendored: ## Audit vendored content: copies current AND matching their declared origins
	$(call run-fhevm-npm,sync vendored --check)
	$(call run-fhevm-npm,check vendored-origin)

# Both need the network and an authenticated `gh` (the protocol registry is private), so neither is in
# `check-pre` or `ci` — run them when touching chain addresses, or from a CI job that holds a token.
sync-fhevm-chains: ## Write fhevm-chains.config.json from the protocol registry's main head
	$(call run-fhevm-npm,sync fhevm-chains --latest)

check-fhevm-chains: ## Is fhevm-chains.config.json current with the protocol registry's main head
	$(call run-fhevm-npm,check fhevm-chains-origin)
