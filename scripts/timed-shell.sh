#!/usr/bin/env bash
#
# The shell every Makefile recipe line and every npm script runs through. It runs the command exactly as
# before and, when FHEVM_TIMINGS_LOG names a file, appends one line to it saying how long the command took.
#
# WHY THIS EXISTS. `make ci` takes about an hour and nothing said where the hour goes. Timing each
# recipe line by hand means editing every recipe; replacing the shell times all of them at once, and
# times the npm scripts below them too, without editing any package.
#
# Two callers, told apart by the first argument:
#
#   make   SHELL = ./scripts/timed-shell.sh --make=$@    then `-c <recipe line>`
#          The command runs under `bash -eu -o pipefail`, the flags the Makefile has always used. The
#          target is empty for a `$(shell ...)` call, which is never logged.
#   npm    npm_config_script_shell=<this file>            then `-c <script>`
#          The command runs under `sh`, npm's own default. This script sets that variable itself, and
#          only while it is logging, so npm is untouched in every other run.
#
# Without FHEVM_TIMINGS_LOG this script is a pass-through: it replaces itself with the shell and adds
# nothing. `make ci` sets the variable; set it yourself to time any other target:
#
#   FHEVM_TIMINGS_LOG=/tmp/test.tsv make test && ./scripts/timings-report.sh /tmp/test.tsv
#
# One line per command, tab-separated, appended when the command ends (so a parent comes after its
# children; scripts/timings-report.sh puts them back in order):
#
#   start (epoch seconds)  duration (seconds)  exit code  depth  make|npm  target or package:script  command
#
# scripts/run-lanes.sh writes the same line for each step of a lane, with `lane` and the name of the lane.
#
set -u

kind=npm
label="${npm_package_name:-?}:${npm_lifecycle_event:-?}"
if [[ "${1:-}" == --make=* ]]; then
  kind=make
  label="${1#--make=}"
  shift
fi

run() {
  if [ "${kind}" = make ]; then bash -eu -o pipefail "$@"; else sh "$@"; fi
}

log="${FHEVM_TIMINGS_LOG:-}"
if [ -z "${log}" ] || [ -z "${label}" ]; then
  if [ "${kind}" = make ]; then exec bash -eu -o pipefail "$@"; else exec sh "$@"; fi
fi

# Milliseconds where perl is present (macOS and the CI runners), whole seconds otherwise: bash 3.2, which
# macOS ships, has no clock of its own.
now() {
  perl -MTime::HiRes=time -e 'printf "%.3f", time' 2>/dev/null || date +%s
}

depth="${FHEVM_TIMINGS_DEPTH:-0}"
if [ "${depth}" -eq 0 ]; then mkdir -p "$(dirname "${log}")"; fi

self="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
export FHEVM_TIMINGS_DEPTH=$((depth + 1))
export npm_config_script_shell="${self}"

# The last argument is the command (`-c <command>`). One line of it, without tabs, is enough to name it.
command_text="$(printf '%s' "${!#}" | tr '\t\n' '  ' | cut -c1-200)"

started="$(now)"
run "$@"
exit_code=$?
ended="$(now)"

printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
  "${started}" \
  "$(awk -v s="${started}" -v e="${ended}" 'BEGIN { printf "%.3f", e - s }')" \
  "${exit_code}" "${depth}" "${kind}" "${label}" "${command_text}" >> "${log}"

exit "${exit_code}"
