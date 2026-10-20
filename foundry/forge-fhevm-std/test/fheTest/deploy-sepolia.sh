#!/usr/bin/env bash
#
# Deploy the FHETest.sol beside this script to Sepolia, and seed its encrypted values.
#
# NO CONFIG CALL. `FHETest is ZamaEthereumConfig`, whose constructor picks the stack from `block.chainid`
# -- Sepolia gets `_getSepoliaConfig()`, the TESTNET stack -- so the contract is wired the moment it is
# created. The check below reads that choice back off the chain and compares it with the chain table
# rather than trusting it.
#
# THE SEEDING IS THE SECOND STEP. A fresh FHETest holds nothing; `initFheTest` mints one publicly
# decryptable handle per type FOR msg.sender. The deployer therefore becomes the account the fork tests
# must use as SENDER -- a different key means handles the tests cannot find.
#
#   ./test/fheTest/deploy-sepolia.sh --dry-run
#   PRIVATE_KEY=0x… ./test/fheTest/deploy-sepolia.sh
#
set -euo pipefail

RPC_URL="${SEPOLIA_RPC_URL:-https://ethereum-sepolia-rpc.publicnode.com}"
DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT="$(cd "$HERE/../.." && pwd)"        # the forge project: `forge create` runs from its root
ROOT="$(cd "$PROJECT/../.." && pwd)"        # the sdk root, which holds the chain table
TARGET="test/fheTest/FHETest.sol:FHETest"

# What the constructor WILL choose on Sepolia, according to the generated chain table.
read -r ACL EXECUTOR KMS_VERIFIER <<<"$(node -e '
  const h = require("'"$ROOT"'/fhevm-chains.config.json")
    .networks.testnet.hosts.ethereum_sepolia.contracts;
  console.log(h.acl.address, h.fhevmExecutor.address, h.kmsVerifier.address);
')"

echo "rpc           $RPC_URL"
echo "contract      $HERE/FHETest.sol"
echo "version       $(grep -oE 'CONTRACT_NAME = "[^"]+"' "$HERE/FHETest.sol" | head -1)"
echo "expected acl  $ACL   (testnet, from the chain table)"
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
ADDRESS="$(forge create "$TARGET" \
  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" --broadcast --json | jq -r '.deployedTo')"
echo "FHETest       $ADDRESS"

# Before spending gas on seeding: did the constructor wire it where we think? A contract pointed at
# another stack would seed handles the fork tests can never read, and say nothing about it.
ACTUAL_ACL="$(cast call "$ADDRESS" "getCoprocessorConfig()((address,address,address))" --rpc-url "$RPC_URL" \
  | tr -d '()' | cut -d, -f1)"
# `tr`, not `${x,,}`: that expansion is bash 4, and macOS still ships bash 3.2 as /bin/bash.
lower() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]'; }
if [[ "$(lower "$ACTUAL_ACL")" != "$(lower "$ACL")" ]]; then
  echo "refusing to seed: the contract wired itself to $ACTUAL_ACL, not $ACL" >&2
  exit 1
fi
echo "wired to      $ACTUAL_ACL"

echo "seeding initFheTest(true)…"
cast send "$ADDRESS" "initFheTest(bool)" true \
  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" >/dev/null

echo
echo "deployed and seeded: $ADDRESS"
echo "the fork tests need BOTH:"
echo "  FHE_TEST = IFHETest($ADDRESS)"
echo "  SENDER   = $(cast wallet address --private-key "$PRIVATE_KEY")   # initFheTest seeded ITS handles"
