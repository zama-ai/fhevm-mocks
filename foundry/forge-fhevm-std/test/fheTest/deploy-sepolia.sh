#!/usr/bin/env bash
#
# Deploy the FHETest fixture beside this script to Sepolia, for one FHEVM group, and seed its encrypted values.
#
# TWO GROUPS SHARE SEPOLIA. `FHETest is ZamaEthereumConfig`, whose constructor picks the stack from
# `block.chainid` alone -- Sepolia gets `_getSepoliaConfig()`, the TESTNET stack. So:
#   --group testnet (default)  deploys FHETest, wired by that constructor, no argument.
#   --group devnet             deploys FHETestDevnet, which re-points the config at construction to the
#                              devnet stack it is given (the chain table's addresses, as a constructor argument).
# Either way the check below reads the wiring back off the chain and compares it with the chain table rather
# than trusting it.
#
# THE SEEDING IS THE SECOND STEP. A fresh FHETest holds nothing; `initFheTest` mints one publicly
# decryptable handle per type FOR msg.sender. The deployer therefore becomes the account the fork tests
# must use as SENDER -- a different key means handles the tests cannot find.
#
#   ./test/fheTest/deploy-sepolia.sh [--group testnet|devnet] --dry-run
#   PRIVATE_KEY=0x… ./test/fheTest/deploy-sepolia.sh [--group testnet|devnet]
#
set -euo pipefail

RPC_URL="${SEPOLIA_RPC_URL:-https://ethereum-sepolia-rpc.publicnode.com}"
DRY_RUN=false
GROUP=testnet
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true ;;
    --group)
      GROUP="${2:?--group needs testnet or devnet}"
      shift
      ;;
    *)
      echo "unknown argument: $1 (expected --group testnet|devnet, --dry-run)" >&2
      exit 1
      ;;
  esac
  shift
done
case "$GROUP" in
  testnet) CONTRACT=FHETest ;;
  devnet) CONTRACT=FHETestDevnet ;;
  *)
    echo "--group must be testnet or devnet, not $GROUP" >&2
    exit 1
    ;;
esac

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT="$(cd "$HERE/../.." && pwd)"        # the forge project: `forge create` runs from its root
ROOT="$(cd "$PROJECT/../.." && pwd)"        # the sdk root, which holds the chain table
TARGET="test/fheTest/$CONTRACT.sol:$CONTRACT"

# The stack this group's fixture must be wired to on Sepolia, according to the generated chain table.
read -r ACL EXECUTOR KMS_VERIFIER <<<"$(node -e '
  const h = require("'"$ROOT"'/fhevm-chains.config.json")
    .networks["'"$GROUP"'"].hosts.ethereum_sepolia.contracts;
  console.log(h.acl.address, h.fhevmExecutor.address, h.kmsVerifier.address);
')"

echo "rpc           $RPC_URL"
echo "group         $GROUP"
echo "contract      $HERE/$CONTRACT.sol"
echo "version       $(grep -oE 'CONTRACT_NAME = "[^"]+"' "$HERE/FHETest.sol" | head -1)"
echo "expected acl  $ACL   ($GROUP, from the chain table)"
echo "expected exec $EXECUTOR"
echo "expected kms  $KMS_VERIFIER"
[[ -n "${PRIVATE_KEY:-}" ]] && echo "deployer      $(cast wallet address --private-key "$PRIVATE_KEY")"

if [[ "$DRY_RUN" == true ]]; then
  echo
  echo "dry run: nothing deployed, nothing sent."
  exit 0
fi

: "${PRIVATE_KEY:?set PRIVATE_KEY to the deployer key}"
cd "$PROJECT"

echo
echo "deploying…"
# Only the devnet variant takes the stack as a constructor argument; FHETest wires itself.
CTOR_ARGS=()
[[ "$GROUP" == devnet ]] && CTOR_ARGS=(--constructor-args "($ACL,$EXECUTOR,$KMS_VERIFIER)")
ADDRESS="$(forge create "$TARGET" \
  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" --broadcast --json ${CTOR_ARGS[@]+"${CTOR_ARGS[@]}"} | jq -r '.deployedTo')"
printf '%-13s %s\n' "$CONTRACT" "$ADDRESS"

# WAIT UNTIL THE NODE SEES IT. A public RPC load-balances across backends, and the one answering the next
# call may not have imported the deploy's block yet: there the address has no code, `eth_call` returns
# empty data rather than reverting, and decoding three addresses out of nothing fails ("buffer overrun").
# So the code is polled first -- up to a minute -- and only then is the wiring read.
for attempt in $(seq 1 30); do
  CODE="$(cast code "$ADDRESS" --rpc-url "$RPC_URL" 2>/dev/null || true)"
  [[ -n "$CODE" && "$CODE" != "0x" ]] && break
  [[ "$attempt" == 30 ]] && {
    echo "the node still shows no code at $ADDRESS after a minute; nothing was seeded." >&2
    echo "check it later, then seed by hand: cast send $ADDRESS \"initFheTest(bool)\" true --rpc-url $RPC_URL --private-key …" >&2
    exit 1
  }
  sleep 2
done

# Before spending gas on seeding: did the constructor wire it where we think? A contract pointed at
# another stack would seed handles the fork tests can never read, and say nothing about it.
# All three addresses, not just the ACL: a devnet fixture with testnet's executor would compute nowhere useful.
ACTUAL="$(cast call "$ADDRESS" "getCoprocessorConfig()((address,address,address))" --rpc-url "$RPC_URL" | tr -d '() ')"
# `tr`, not `${x,,}`: that expansion is bash 4, and macOS still ships bash 3.2 as /bin/bash.
lower() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]'; }
if [[ "$(lower "$ACTUAL")" != "$(lower "$ACL,$EXECUTOR,$KMS_VERIFIER")" ]]; then
  echo "refusing to seed: the contract wired itself to ($ACTUAL), not ($ACL,$EXECUTOR,$KMS_VERIFIER)" >&2
  exit 1
fi
echo "wired to      $ACTUAL"

echo "seeding initFheTest(true)…"
cast send "$ADDRESS" "initFheTest(bool)" true \
  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" >/dev/null

echo
echo "deployed and seeded: $ADDRESS ($GROUP)"
echo "the fork tests need BOTH:"
echo "  FHE_TEST = IFHETest($ADDRESS)"
echo "  SENDER   = $(cast wallet address --private-key "$PRIVATE_KEY")   # initFheTest seeded ITS handles"
