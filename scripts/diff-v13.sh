#!/usr/bin/env bash
#
# Compares working-tree files against the v13 forge work branch.
#
#   scripts/diff-v13.sh <file>              # diff one file
#   scripts/diff-v13.sh --report [path...]  # classify a tree, four ways
#   CODE=1 scripts/diff-v13.sh <file>       # open VSCode's diff editor instead of printing
#   BRANCH=<ref> scripts/diff-v13.sh ...
#
# READ-ONLY. Nothing is checked out, no branch is switched, no file is written inside the repository —
# `git show` reads the object straight out of the database.
#
# THE PATH IS TRANSLATED, twice. The branch predates the v13 -> v14 rotation, so a file under
# `host-contracts-cleartext/v14/` is looked up under `host-contracts-cleartext/v13/` there — and the
# FILENAME carries the generation too, so `test/ts/deploy-v14.test.ts` also tries `deploy-v13.test.ts`.
# Anything outside that directory (foundry/, the root files) is looked up unchanged. The literal path
# is tried first, so a file that exists under both names resolves to its own.
#
# THE FOUR CLASSES. `--report` sorts every file into one of them, and the middle one is the point:
#
#   identical   the same bytes: it came across verbatim
#   renamed     the same bytes ONCE `v13` -> `v14` is applied (`V13`, and `0.13` -> `0.14`, with it).
#               Not identical in principle, identical in substance — the file was rotated, not edited,
#               and there is nothing in it to review.
#   differs     something else changed. This is the review surface.
#   new         no counterpart on the branch at all.
#
# The rename rule is deliberately literal. It substitutes those three spellings and demands the result
# match BYTE FOR BYTE; it does not ignore lines that merely mention a version. A rule loose enough to
# absorb a real edit would put that edit in the class labelled "nothing to review", which is the one
# outcome worth engineering against.
set -euo pipefail

BRANCH=${BRANCH:-devex/alexb/v13/forge-fhevm-std-v2}

# `v13` -> `v14` and the two spellings that travel with it. Applied to the BRANCH side.
readonly RENAME='s/v13/v14/g; s/V13/V14/g; s/0\.13/0.14/g'

usage() {
  echo "usage: ${0##*/} <file>            # diff one file against $BRANCH" >&2
  echo "       ${0##*/} --report [path..] # classify a tree: identical / renamed / differs / new" >&2
  exit 2
}

# The branch path a working-tree path came from, or nothing. Echoes the resolved path.
source_path() {
  local rel=$1 dir base
  dir=${rel/host-contracts-cleartext\/v14\//host-contracts-cleartext/v13/}
  # …and the same substitution inside the last path segment: deploy-v14.test.ts -> deploy-v13.test.ts
  base=$(printf '%s' "$dir" | sed 's|\(/[^/]*\)v14\([^/]*\)$|\1v13\2|')
  local candidate
  for candidate in "$rel" "$dir" "$base"; do
    if git cat-file -e "$BRANCH:$candidate" 2>/dev/null; then
      printf '%s' "$candidate"
      return 0
    fi
  done
  return 1
}

# identical | renamed | differs, for a path known to exist on both sides.
classify() {
  local rel=$1 src=$2
  if git diff --quiet "$BRANCH:$src" "$rel" 2>/dev/null; then
    echo identical
  elif diff -q <(git show "$BRANCH:$src" | sed "$RENAME") "$rel" >/dev/null 2>&1; then
    echo renamed
  else
    echo differs
  fi
}

root=$(git rev-parse --show-toplevel)

########################################################################################################
# --report
########################################################################################################

if [ "${1:-}" = "--report" ]; then
  shift
  cd "$root"
  # git's own file list, so .gitignore is honoured and no build output is classified.
  git ls-files --cached --others --exclude-standard -- "${@:-.}" | sort >"${TMPDIR:-/tmp}/dv13-files"

  : >"${TMPDIR:-/tmp}/dv13-identical"
  : >"${TMPDIR:-/tmp}/dv13-renamed"
  : >"${TMPDIR:-/tmp}/dv13-differs"
  : >"${TMPDIR:-/tmp}/dv13-new"

  while read -r rel; do
    [ -f "$rel" ] || continue # a staged deletion still lists; it has no working copy to classify
    if src=$(source_path "$rel"); then
      echo "$rel" >>"${TMPDIR:-/tmp}/dv13-$(classify "$rel" "$src")"
    else
      echo "$rel" >>"${TMPDIR:-/tmp}/dv13-new"
    fi
  done <"${TMPDIR:-/tmp}/dv13-files"

  for class in identical renamed differs new; do
    file="${TMPDIR:-/tmp}/dv13-$class"
    count=$(wc -l <"$file" | tr -d ' ')
    echo
    case $class in
      identical) echo "### identical ($count) — came across verbatim" ;;
      renamed) echo "### renamed ($count) — identical once v13 -> v14 is applied; nothing to review" ;;
      differs) echo "### differs ($count) — the review surface" ;;
      new) echo "### new ($count) — no counterpart on $BRANCH" ;;
    esac
    sed 's/^/  /' "$file"
  done
  exit 0
fi

########################################################################################################
# one file
########################################################################################################

[ $# -eq 1 ] || usage
[ -f "$1" ] || {
  echo "${0##*/}: $1: no such file" >&2
  exit 1
}

abs=$(cd "$(dirname "$1")" && pwd)/$(basename "$1")
rel=${abs#"$root"/}
[ "$rel" != "$abs" ] || {
  echo "${0##*/}: $1 is outside $root" >&2
  exit 1
}
cd "$root"

src=$(source_path "$rel") || {
  echo "${0##*/}: $rel has no counterpart on $BRANCH" >&2
  exit 1
}

case $(classify "$rel" "$src") in
  identical)
    echo "identical: $rel == $BRANCH:$src" >&2
    exit 0
    ;;
  renamed)
    # Still shown, because "only the rename" is a claim worth being able to check by eye.
    echo "renamed only: every difference below is v13 -> v14" >&2
    ;;
esac

if [ -n "${CODE:-}" ]; then
  command -v code >/dev/null 2>&1 || {
    echo "${0##*/}: no 'code' on PATH — run \"Shell Command: Install 'code' command in PATH\"" >&2
    exit 1
  }
  # Its own directory, so the name (and therefore the syntax highlighting) survives.
  tmp=$(mktemp -d)/${src##*/}
  git show "$BRANCH:$src" >"$tmp"
  exec code --diff "$tmp" "$rel"
fi

echo "--- $BRANCH:$src" >&2
echo "+++ $rel" >&2
# `<rev>:<path> <path>` reads the second side from the WORKING TREE, not from the index, so uncommitted
# edits show up.
exec git diff "$BRANCH:$src" "$rel"
