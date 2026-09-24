#!/usr/bin/env bash
#
# Print the value for FHEVM_FORK_FIXTURE_FLOOR: the block the fixture was deployed at.
#
#   export FHEVM_FORK_FIXTURE_FLOOR=$(./test/fheTest/fixture-floor.sh)
#   make ci
#
# PRINTS 0 WHEN NO FLOOR IS NEEDED, and 0 is the value that means "no floor" -- so the line above is
# safe to keep in a profile: it stops mattering by itself once the chain has moved past the fixture.
#
# WHY A SEARCH AND NOT A CONSTANT. The block is written down in README.md beside the address, and that
# is fine until someone redeploys and forgets. This asks the chain instead.
#
# THE SEARCH IS BOUNDED ON PURPOSE. An ordinary node serves state only for its most recent blocks and
# answers `state at block #N is pruned` for anything older -- measured at somewhere between 4096 and
# 16384 blocks on the endpoint this repo defaults to. A search from block 0 therefore walks straight
# into pruned territory and concludes the contract has always existed. WINDOW stays inside the part
# that is served; a fixture older than it needs no floor anyway, which is the early exit below.
set -euo pipefail

RPC_URL="${SEPOLIA_RPC_URL:-https://ethereum-sepolia-rpc.publicnode.com}"
ADDRESS="${1:-0x6Bc47f6A33c0E04235f79e1Fc9A3cCD6e7Bbb5fc}"
WINDOW="${FIXTURE_SEARCH_WINDOW:-4096}"

has_code() { [[ "$(cast code "$ADDRESS" --rpc-url "$RPC_URL" --block "$1")" != "0x" ]]; }

HEAD="$(cast block-number --rpc-url "$RPC_URL")"

has_code "$HEAD" || { echo "no code at $ADDRESS on the chain at $RPC_URL" >&2; exit 1; }

# Old enough that the ordinary blocks already clear it: no floor, nothing to compute.
if has_code $((HEAD - WINDOW)); then
  echo 0
  exit 0
fi

# Deployed inside the window: bisect for the first block that has code.
lo=$((HEAD - WINDOW + 1))
hi=$HEAD
while [[ $lo -lt $hi ]]; do
  mid=$(((lo + hi) / 2))
  if has_code "$mid"; then hi=$mid; else lo=$((mid + 1)); fi
done
echo "$lo"
