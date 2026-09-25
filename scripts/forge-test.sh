#!/usr/bin/env bash
#
# Runs `forge test` and fails when it ran no tests at all.
#
# WHY THIS EXISTS. `forge test` EXITS 0 when it finds nothing to run -- it prints "No tests found in
# project!" and reports success. Every other way a test tier can go wrong is loud; this one is silent,
# and it is the one that actually happened: a poisoned `cache/solidity-files-cache.json` left forge
# convinced there was nothing to compile, so the SDK's forge tiers in `make ci-fast` passed for days
# having executed zero tests. `make ci` escaped only because it cleans first.
#
# A tier that runs nothing has proved nothing, so this wrapper turns that outcome into a failure. It is
# deliberately not a fix for any particular poisoner: the cache one is fixed elsewhere (forge-fhevm-std
# lints under its own profile now). This is here to catch the NEXT one, in seconds rather than at a
# release.
#
# Everything else is pass-through: the arguments go to `forge test` untouched, output is streamed live,
# and forge's own exit code is this script's exit code whenever forge itself failed.
#
# Usage: ./scripts/forge-test.sh [forge test args...]

set -uo pipefail

log_file="$(mktemp -t forge-test)"
trap 'rm -f "${log_file}"' EXIT

forge test "$@" 2>&1 | tee "${log_file}"
status="${PIPESTATUS[0]}"

# forge failing for its own reasons (a compile error, a failing test) is already reported; do not
# second-guess it, and do not let the emptiness check mask the real message.
if [[ "${status}" -ne 0 ]]; then
  exit "${status}"
fi

# "Suite result:" is printed once per test contract that ran. None of them means none ran, whether or
# not forge bothered to say "No tests found in project!".
if ! grep -q "Suite result:" "${log_file}"; then
  echo "" >&2
  echo "forge-test.sh: forge exited 0 but ran NO tests -- refusing to call that a pass." >&2
  echo "  command: forge test $*" >&2
  echo "" >&2
  echo "  If this tier is supposed to select tests, the selector matched nothing." >&2
  echo "  If it is supposed to run everything, the build cache is lying about what changed:" >&2
  echo "    rm -f cache/solidity-files-cache.json   # ~6s to recover, out/ survives" >&2
  exit 1
fi
