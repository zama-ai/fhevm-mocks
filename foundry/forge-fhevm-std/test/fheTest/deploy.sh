#!/usr/bin/env bash
#
# Deploy the FHETest.sol beside this script to Sepolia (or BSC Testnet), and seed its encrypted values.
#
# NO CONFIG CALL. `FHETest is ZamaMultiChainConfig`, whose constructor picks the stack from `block.chainid`
# -- Sepolia gets `_getSepoliaConfig()`, the TESTNET stack -- so the contract is wired the moment it is
# created. The check below reads that choice back off the chain and compares it with the chain table
# rather than trusting it.
#
# WHICH ZamaConfig.sol. By default FHETest compiles against the installed `@fhevm/solidity`, which knows
# no BSC. `--zama-config release-0.14.x` compiles it against zama-config/release-0.14.x/ZamaConfig.sol
# instead (fhevm release/0.14.x, which adds chain 97), through foundry.toml's `zama-config-release-0-14-x`
# profile, whose own `out`/`cache` leave the test build's artifacts alone. BSC Testnet needs it: with the
# installed file the constructor reverts with `ZamaProtocolUnsupported()`.
#
# THE SEEDING IS THE SECOND STEP. A fresh FHETest holds nothing; `initFheTest` mints one publicly
# decryptable handle per type FOR msg.sender. The deployer therefore becomes the account the fork tests
# must use as SENDER -- a different key means handles the tests cannot find.
#
# THE WALLET, one of:
#   --account NAME         a foundry keystore in ~/.foundry/keystores (`cast wallet import NAME --interactive`)
#   --keystore PATH        a keystore file anywhere
#   PRIVATE_KEY=0x…        a raw key in the environment
# A keystore's password is asked for ONCE, then handed to every forge/cast call through a temporary file
# only the current user can read, deleted on exit -- never on a command line, where `ps` would show it.
# `--password-file PATH` skips the prompt. A raw PRIVATE_KEY, on the other hand, DOES go on forge's and
# cast's command lines (`--private-key` has no environment variable): prefer a keystore.
#
#   ./test/fheTest/deploy.sh --dry-run
#   PRIVATE_KEY=0x… ./test/fheTest/deploy.sh
#   ./test/fheTest/deploy.sh --account fhevm-deployer
#   ./test/fheTest/deploy.sh --network bsc-testnet --zama-config release-0.14.x --account fhevm-deployer --dry-run
#   ./test/fheTest/deploy.sh --network bsc-testnet --zama-config release-0.14.x --account fhevm-deployer
#
# THE RPC: $SEPOLIA_RPC_URL / $BSC_TESTNET_RPC_URL from the environment, else the same variable from the
# repository's `.env` (read, never sourced), else a publicnode default. Only its host is printed, and it
# reaches forge and cast as ETH_RPC_URL, not as `--rpc-url`, so an API key in it stays off command lines.
#
# --dry-run builds the contract and simulates its creation (eth_estimateGas) on the target chain, so a
# constructor that would revert says so before anything is sent. With a wallet, it also unlocks it, so a
# wrong password shows up here too.
#
set -euo pipefail

usage() {
  cat >&2 <<EOF
usage: $0 [--dry-run] [--network sepolia|bsc-testnet] [--zama-config installed|release-0.14.x]
          [--account NAME | --keystore PATH] [--password-file PATH]
EOF
  exit 2
}

DRY_RUN=false
NETWORK=sepolia
ZAMA_CONFIG=installed
ACCOUNT=""
KEYSTORE=""
PASSWORD_FILE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    --network) [[ $# -ge 2 ]] || usage; NETWORK="$2"; shift 2 ;;
    --zama-config) [[ $# -ge 2 ]] || usage; ZAMA_CONFIG="$2"; shift 2 ;;
    --account) [[ $# -ge 2 ]] || usage; ACCOUNT="$2"; shift 2 ;;
    --keystore) [[ $# -ge 2 ]] || usage; KEYSTORE="$2"; shift 2 ;;
    --password-file) [[ $# -ge 2 ]] || usage; PASSWORD_FILE="$2"; shift 2 ;;
    *) usage ;;
  esac
done

# Relative paths are the caller's: made absolute now, so they still hold after the `cd "$PROJECT"` below.
abspath() { case "$1" in /*) printf '%s' "$1" ;; *) printf '%s/%s' "$PWD" "$1" ;; esac; }
if [[ -n "$KEYSTORE" ]]; then KEYSTORE="$(abspath "$KEYSTORE")"; fi
if [[ -n "$PASSWORD_FILE" ]]; then PASSWORD_FILE="$(abspath "$PASSWORD_FILE")"; fi

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT="$(cd "$HERE/../.." && pwd)"        # the forge project: `forge create` runs from its root
ROOT="$(cd "$PROJECT/../.." && pwd)"        # the sdk root, which holds the chain table and `.env`
TARGET="test/fheTest/FHETest.sol:FHETest"

# One variable from the repository's `.env`. The file is READ, never sourced, so nothing in it runs;
# the last `NAME=value` (or `export NAME=value`) line wins. A quoted value is taken between its quotes;
# an unquoted one ends at ` #` (a trailing comment) and loses trailing blanks.
dotenv() {
  [[ -f "$ROOT/.env" ]] || return 0
  sed -n -E "s/^[[:space:]]*(export[[:space:]]+)?$1[[:space:]]*=[[:space:]]*//p" "$ROOT/.env" | tail -1 \
    | sed -E -e 's/^"([^"]*)".*$/\1/' -e t -e "s/^'([^']*)'.*\$/\\1/" -e t \
      -e 's/[[:space:]]+#.*$//' -e 's/[[:space:]]+$//'
}

# RPC_URL from, in order: the environment, `.env`, the default. `${!1}`: indirect expansion, bash 3.2 has it.
resolve_rpc_url() {
  RPC_URL="${!1:-}"
  RPC_SOURCE="\$$1"
  if [[ -z "$RPC_URL" ]]; then
    RPC_URL="$(dotenv "$1")"
    RPC_SOURCE="$1 in $ROOT/.env"
  fi
  if [[ -z "$RPC_URL" ]]; then
    RPC_URL="$2"
    RPC_SOURCE="default"
  fi
}

# For display only: an RPC URL often carries an API key in its userinfo, path or query, so only scheme
# and host. Anything that does not look like a URL is not printed at all.
show_url() {
  case "$1" in
    [A-Za-z]*://*)
      printf '%s' "$1" | sed -E -e 's#^([A-Za-z][A-Za-z0-9+.-]*://)[^/?@]*@#\1…@#' \
        -e 's#^([A-Za-z][A-Za-z0-9+.-]*://[^/?]+)[/?].*$#\1/…#' ;;
    *) printf '(not a URL)' ;;
  esac
}

case "$NETWORK" in
  sepolia)
    resolve_rpc_url SEPOLIA_RPC_URL https://ethereum-sepolia-rpc.publicnode.com
    CHAIN_ID=11155111
    HOST=ethereum_sepolia ;;
  bsc-testnet)
    resolve_rpc_url BSC_TESTNET_RPC_URL https://bsc-testnet-rpc.publicnode.com
    CHAIN_ID=97
    HOST=bsc_testnet ;;
  *) echo "unknown network: $NETWORK" >&2; usage ;;
esac

# The foundry profile the dry-run build and `forge create` both use, so both compile the same bytecode.
case "$ZAMA_CONFIG" in
  installed)
    ZAMA_CONFIG_FILE="$ROOT/node_modules/@fhevm/solidity/config/ZamaConfig.sol"
    PROFILE=default ;;
  release-0.14.x)
    # The remapping, `out` and `cache_path` live in foundry.toml's profile of the same name. Not
    # `--remappings` on the command line: that REPLACES the project's remappings instead of adding one.
    ZAMA_CONFIG_FILE="$HERE/zama-config/release-0.14.x/ZamaConfig.sol"
    PROFILE=zama-config-release-0-14-x ;;
  *) echo "unknown zama config: $ZAMA_CONFIG" >&2; usage ;;
esac
export FOUNDRY_PROFILE="$PROFILE"

if [[ "$NETWORK" == bsc-testnet && "$ZAMA_CONFIG" != release-0.14.x ]]; then
  echo "bsc-testnet needs --zama-config release-0.14.x: the installed ZamaConfig.sol has no chain 97" >&2
  exit 1
fi

# The wallet: at most one source, turned into the flags every forge/cast call that signs gets.
SOURCES=0
[[ -n "${PRIVATE_KEY:-}" ]] && SOURCES=$((SOURCES + 1))
[[ -n "$ACCOUNT" ]] && SOURCES=$((SOURCES + 1))
[[ -n "$KEYSTORE" ]] && SOURCES=$((SOURCES + 1))
if [[ "$SOURCES" -gt 1 ]]; then
  echo "pick one wallet: PRIVATE_KEY, --account or --keystore" >&2
  exit 1
fi
if [[ -n "$PASSWORD_FILE" && -z "$ACCOUNT$KEYSTORE" ]]; then
  echo "--password-file goes with --account or --keystore" >&2
  exit 1
fi

WALLET_ARGS=()
WALLET=""
if [[ -n "${PRIVATE_KEY:-}" ]]; then
  WALLET_ARGS=(--private-key "$PRIVATE_KEY")
  WALLET="PRIVATE_KEY"
elif [[ -n "$ACCOUNT$KEYSTORE" ]]; then
  if [[ -n "$ACCOUNT" ]]; then
    KEYSTORE_FILE="$HOME/.foundry/keystores/$ACCOUNT"
    WALLET_ARGS=(--account "$ACCOUNT")
    WALLET="keystore $ACCOUNT"
  else
    KEYSTORE_FILE="$KEYSTORE"
    WALLET_ARGS=(--keystore "$KEYSTORE")
    WALLET="keystore $KEYSTORE"
  fi
  if [[ ! -f "$KEYSTORE_FILE" ]]; then
    echo "no keystore at $KEYSTORE_FILE" >&2
    [[ -n "$ACCOUNT" ]] && echo "available: $(ls "$HOME/.foundry/keystores" 2>/dev/null | tr '\n' ' ')" >&2
    exit 1
  fi
  if [[ -z "$PASSWORD_FILE" ]]; then
    # Prompt once, from the terminal (stdin may be a pipe), into a file only this user can read.
    PASSWORD_FILE="$(umask 077 && mktemp "${TMPDIR:-/tmp}/fhetest-deploy.XXXXXX")"
    trap 'rm -f "$PASSWORD_FILE"' EXIT
    printf 'password for %s: ' "$WALLET" >/dev/tty
    IFS= read -r -s PASSWORD </dev/tty
    printf '\n' >/dev/tty
    printf '%s' "$PASSWORD" >"$PASSWORD_FILE"
    unset PASSWORD
  fi
  WALLET_ARGS+=(--password-file "$PASSWORD_FILE")
fi

# What the constructor WILL choose, according to the generated chain table.
read -r ACL EXECUTOR KMS_VERIFIER <<<"$(node -e '
  const h = require("'"$ROOT"'/fhevm-chains.config.json")
    .networks.testnet.hosts["'"$HOST"'"].contracts;
  console.log(h.acl.address, h.fhevmExecutor.address, h.kmsVerifier.address);
')"

# Every forge/cast call below reads the RPC from here, not from `--rpc-url`: off the command lines.
export ETH_RPC_URL="$RPC_URL"

# Its own error is swallowed: cast quotes the full URL in it, API key included.
if ! ACTUAL_CHAIN_ID="$(cast chain-id 2>/dev/null)"; then
  echo "refusing: cannot reach $(show_url "$RPC_URL") ($RPC_SOURCE)" >&2
  exit 1
fi
if [[ "$ACTUAL_CHAIN_ID" != "$CHAIN_ID" ]]; then
  echo "refusing: $(show_url "$RPC_URL") ($RPC_SOURCE) is chain $ACTUAL_CHAIN_ID, not $NETWORK ($CHAIN_ID)" >&2
  exit 1
fi

echo "network       $NETWORK ($CHAIN_ID)"
echo "rpc           $(show_url "$RPC_URL")   ($RPC_SOURCE)"
echo "contract      $HERE/FHETest.sol"
echo "zama config   $ZAMA_CONFIG_FILE"
echo "version       $(grep -oE 'CONTRACT_NAME = "[^"]+"' "$HERE/FHETest.sol" | head -1)"
echo "expected acl  $ACL   (testnet, from the chain table)"
DEPLOYER=""
if [[ -n "$WALLET" ]]; then
  # Unlocks a keystore: a wrong password fails here, before anything is built or sent.
  DEPLOYER="$(cast wallet address "${WALLET_ARGS[@]}")"
  echo "wallet        $WALLET"
  echo "deployer      $DEPLOYER"
fi

cd "$PROJECT"

if [[ "$DRY_RUN" == true ]]; then
  echo
  echo "building…"
  forge build "test/fheTest/FHETest.sol" >/dev/null
  # The artifact compiled FROM test/fheTest/FHETest.sol, picked by its compilation target: another
  # FHETest.sol (test/examples/contracts) exists, so neither the artifact path nor `forge inspect
  # FHETest` is unambiguous.
  BYTECODE=""
  while IFS= read -r ARTIFACT; do
    if jq -e '.metadata.settings.compilationTarget["test/fheTest/FHETest.sol"] == "FHETest"' \
      "$ARTIFACT" >/dev/null 2>&1; then
      BYTECODE="$(jq -r '.bytecode.object' "$ARTIFACT")"
    fi
  done < <(find "$(forge config --json | jq -r '.out')" -name 'FHETest*.json')
  if [[ -z "$BYTECODE" ]]; then
    echo "no artifact compiled from test/fheTest/FHETest.sol" >&2
    exit 1
  fi
  echo "simulating the deployment…"
  GAS="$(cast estimate ${DEPLOYER:+--from "$DEPLOYER"} --create "$BYTECODE")"
  echo "estimated gas $GAS"
  echo
  echo "dry run: nothing deployed, nothing sent."
  exit 0
fi

if [[ -z "$WALLET" ]]; then
  echo "no wallet: set PRIVATE_KEY, or pass --account NAME or --keystore PATH" >&2
  exit 1
fi

echo
echo "deploying…"
ADDRESS="$(forge create "$TARGET" "${WALLET_ARGS[@]}" --broadcast --json | jq -r '.deployedTo')"
echo "FHETest       $ADDRESS"

# Before spending gas on seeding: did the constructor wire it where we think? A contract pointed at
# another stack would seed handles the fork tests can never read, and say nothing about it.
ACTUAL_ACL="$(cast call "$ADDRESS" "getCoprocessorConfig()((address,address,address))" | tr -d '()' | cut -d, -f1)"
# `tr`, not `${x,,}`: that expansion is bash 4, and macOS still ships bash 3.2 as /bin/bash.
lower() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]'; }
if [[ "$(lower "$ACTUAL_ACL")" != "$(lower "$ACL")" ]]; then
  echo "refusing to seed: the contract wired itself to $ACTUAL_ACL, not $ACL" >&2
  exit 1
fi
echo "wired to      $ACTUAL_ACL"

echo "seeding initFheTest(true)…"
cast send "$ADDRESS" "initFheTest(bool)" true "${WALLET_ARGS[@]}" >/dev/null

echo
echo "deployed and seeded: $ADDRESS"
echo "the fork tests need BOTH:"
echo "  FHE_TEST = IFHETest($ADDRESS)"
echo "  SENDER   = $DEPLOYER   # initFheTest seeded ITS handles"
