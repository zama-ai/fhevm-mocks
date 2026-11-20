#!/usr/bin/env bash
#
# Prints the timings that scripts/timed-shell.sh logged, as a tree: each command under the one that
# started it, in the order they started, with its duration.
#
# Usage: ./scripts/timings-report.sh <log file>
#
# Commands shorter than one second are left out of the tree and counted at the end; the log file keeps
# every one of them. A command that failed is marked with its exit code.
#
set -euo pipefail

if [ $# -ne 1 ] || [ ! -f "$1" ]; then
  echo "usage: timings-report.sh <log file written through FHEVM_TIMINGS_LOG>" >&2
  exit 2
fi

echo ""
echo "⏱️  Timings (${1})"
echo ""

# Sorted by start time, then by depth: a parent and its first child can start in the same millisecond.
sort -t "$(printf '\t')" -k1,1n -k4,4n "$1" | awk -F'\t' '
  function human(s,   m) {
    if (s < 60) return sprintf("%5.1fs", s);
    m = int(s / 60);
    return sprintf("%dm%02ds", m, s - m * 60);
  }
  {
    if ($2 < 1 && $3 == 0) { hidden++; next }
    indent = sprintf("%" ($4 * 2) "s", "");
    failed = ($3 == 0) ? "" : "  ❌ exit " $3;
    printf "%8s  %s[%s] %s%s\n", human($2), indent, $6, substr($7, 1, 110 - $4 * 2), failed;
  }
  END {
    printf "\n%d commands logged, %d of them under one second and not shown.\n", NR, hidden;
  }
'
