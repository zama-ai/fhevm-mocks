#!/usr/bin/env bash
#
# Runs a command against a throwaway anvil that this script owns: started before the command, stopped
# however the script leaves (success, failure, `set -e` abort, Ctrl-C). Keep it dependency-free bash —
# it is the lifecycle owner for the `make test-anvil` tier, so it must work before any node tooling does.
#
# WHY THIS EXISTS. Three suites need a local node and each solved it differently: forge-fhevm-std started
# its own with a blind `sleep 1` (a race on a cold CI runner), and the two hardhat e2e suites started
# nothing at all and assumed an operator had a node running. This is the one implementation all three now
# share, so a node is never left holding a port and a missing node is never mistaken for a passing suite.
#
# THE PORT IS NOT SHARED. Refusing to start on a busy port is deliberate: reusing whatever already
# answers there is how a suite ends up testing against a stranger's node — a different mnemonic, a
# different chain, or another suite's half-migrated state. If you DO want to point a suite at a node you
# manage, run the bring-your-own-node target instead (`make test-hh-v2-e2e-anvil`).
#
# Usage: ./scripts/with-anvil.sh --port N [--skip-if-missing] [--timeout S] -- <command> [args...]
#
#   --port N            TCP port for the node. Required; there is no default on purpose, because the
#                       port is a cross-package invariant (see the port map in the Makefile).
#   --skip-if-missing   if the `anvil` binary is absent, print why and exit 0 instead of failing. For
#                       local runs on a machine without foundry. CI must NOT pass this: there, a missing
#                       binary is a broken runner, and a skip that looks like a pass is the one outcome
#                       worth failing over.
#   --timeout S         seconds to wait for the node to answer (default 60).
#   -h, --help          print this header and exit.
#
# The command inherits ANVIL_PORT and ANVIL_RPC_URL, the names already used by common/src/constants.ts
# and by forge-fhevm-std's `hasRpcUrlFor("anvil")` opt-in. Its exit code is this script's exit code.
#
# Example:
#   ./scripts/with-anvil.sh --port 8546 -- forge test --match-path 'test/anvil/*'
#
set -euo pipefail

readonly ANVIL_HOST=127.0.0.1

port=""
timeout_seconds=60
skip_if_missing=0

usage() {
  sed -n '2,/^set -euo pipefail$/p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//; $d'
}

# ------------------------------------------------------------------------------
# Arguments. Everything after `--` is the command, verbatim — no re-splitting, so
# a quoted glob like 'test/anvil/*' reaches the child as one argument.
# ------------------------------------------------------------------------------
while [ $# -gt 0 ]; do
  case "$1" in
    --port) port="${2:-}"; shift 2 ;;
    --timeout) timeout_seconds="${2:-}"; shift 2 ;;
    --skip-if-missing) skip_if_missing=1; shift ;;
    -h|--help) usage; exit 0 ;;
    --) shift; break ;;
    *) echo "with-anvil.sh: unknown option '$1' (did you forget '--' before the command?)" >&2; exit 2 ;;
  esac
done

if [ -z "${port}" ]; then
  echo "with-anvil.sh: --port is required." >&2
  exit 2
fi
if [ $# -eq 0 ]; then
  echo "with-anvil.sh: no command given; expected '-- <command> [args...]'." >&2
  exit 2
fi

readonly anvil_url="http://${ANVIL_HOST}:${port}"

# ------------------------------------------------------------------------------
# Is the port already taken? bash's /dev/tcp rather than lsof: lsof is not on
# every runner, and this needs no package to be installed.
# ------------------------------------------------------------------------------
port_is_open() {
  (exec 3<>"/dev/tcp/${ANVIL_HOST}/${port}") 2>/dev/null
}

if ! command -v anvil > /dev/null 2>&1; then
  if [ "${skip_if_missing}" -eq 1 ]; then
    echo "with-anvil.sh: SKIPPED — 'anvil' is not on PATH. Install foundry (foundryup) to run this suite."
    exit 0
  fi
  echo "with-anvil.sh: 'anvil' is not on PATH. Install foundry (foundryup), or pass --skip-if-missing." >&2
  exit 1
fi

if port_is_open; then
  echo "with-anvil.sh: port ${port} is already in use, so a node was NOT started." >&2
  echo "               Stop whatever holds it, or use the bring-your-own-node target for this suite." >&2
  exit 1
fi

# ------------------------------------------------------------------------------
# Lifecycle. The log is captured rather than silenced: a suite that fails because
# the node died needs the node's side of the story.
# ------------------------------------------------------------------------------
anvil_pid=""
anvil_log="$(mktemp -t with-anvil.XXXXXX)"
readonly anvil_log

cleaned=0

cleanup() {
  local exit_code=$?

  # Idempotent: the signal traps below call this and then exit, which fires the EXIT trap too.
  if [ "${cleaned}" -eq 1 ]; then return; fi
  cleaned=1

  if [ -n "${anvil_pid}" ] && kill -0 "${anvil_pid}" 2>/dev/null; then
    kill "${anvil_pid}" 2>/dev/null || true
    wait "${anvil_pid}" 2>/dev/null || true
  fi

  # anvil can outlive the wrapper; free the port whatever still holds it. Best effort, and only when
  # lsof exists — a leftover listener is worth reporting even where we cannot clear it.
  if command -v lsof > /dev/null 2>&1; then
    local pid
    for pid in $(lsof -i ":${port}" -t 2>/dev/null || true); do
      echo "with-anvil.sh: killing leftover listener on port ${port} (pid ${pid})"
      kill "${pid}" 2>/dev/null || true
    done
  fi

  if [ "${exit_code}" -ne 0 ]; then
    echo "with-anvil.sh: command failed (exit ${exit_code}); last 40 lines of the anvil log:" >&2
    tail -n 40 "${anvil_log}" >&2 || true
  fi
  rm -f "${anvil_log}"
}
# The signal traps exit explicitly: a handler that just returns would resume the interrupted script.
trap cleanup EXIT
trap 'cleanup; exit 130' INT
trap 'cleanup; exit 143' TERM

echo "with-anvil.sh: starting anvil on ${anvil_url}"
anvil --host "${ANVIL_HOST}" --port "${port}" > "${anvil_log}" 2>&1 &
anvil_pid=$!

# ------------------------------------------------------------------------------
# Readiness. Poll until the node answers a real JSON-RPC call — not merely until
# the port accepts a connection, which it does before it can serve anything. Give
# up early if the process is already gone rather than waiting out the timeout.
# ------------------------------------------------------------------------------
ready=0
for _ in $(seq 1 "${timeout_seconds}"); do
  if ! kill -0 "${anvil_pid}" 2>/dev/null; then
    echo "with-anvil.sh: anvil exited while starting up." >&2
    exit 1
  fi
  if curl -fsS -m 2 -X POST -H 'Content-Type: application/json' \
      --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
      "${anvil_url}" > /dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done

if [ "${ready}" -ne 1 ]; then
  echo "with-anvil.sh: anvil did not answer on ${anvil_url} within ${timeout_seconds}s." >&2
  exit 1
fi

echo "with-anvil.sh: anvil ready (pid ${anvil_pid}); running: $*"

# `set +e` around the run rather than `|| true`: with `|| true` the command always succeeds and `$?`
# records THAT, so a failing suite reports as a pass.
set +e
ANVIL_PORT="${port}" ANVIL_RPC_URL="${anvil_url}" "$@"
command_exit_code=$?
set -e

exit "${command_exit_code}"
