#!/usr/bin/env bash

set -euo pipefail # Exit on error, undefined vars, and pipe errors

ANVIL_PORT=8545
ANVIL_HOST=127.0.0.1
ANVIL_URL="http://${ANVIL_HOST}:${ANVIL_PORT}"
TIMEOUT_SECONDS=60 # Max time to wait for Anvil to start
CHECK_INTERVAL_SECONDS=1 # How often to poll the node


########################################################################

HARDHAT_NODE_PORT=${ANVIL_PORT}
HARDHAT_NODE_URL="http://${ANVIL_HOST}:${HARDHAT_NODE_PORT}"

########################################################################

echo "--- Starting Hardhat Node in background ---"
# Start Hardhat Node in the background, redirecting output to a log file
# Or /dev/null if you want to suppress all output from the node itself
npx hardhat node &> /dev/null &
HARDHAT_PID_ROOT=$! # Get the PID of the background process

echo "Hardhat Node started with PID: $HARDHAT_PID_ROOT. Waiting for it to be ready..."

# --- Wait for Hardhat Node to be ready ---
ATTEMPTS=0
while [ $ATTEMPTS -lt $TIMEOUT_SECONDS ]; do
    if curl -s -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' "$HARDHAT_NODE_URL" > /dev/null 2>&1; then
        echo "Hardhat Node is ready!"
        break
    fi
    echo "Waiting for Hardhat Node... (Attempt $((ATTEMPTS+1))/$TIMEOUT_SECONDS)"
    sleep "$CHECK_INTERVAL_SECONDS"
    ATTEMPTS=$((ATTEMPTS+1))
done

HARDHAT_PID=$(lsof -i :${HARDHAT_NODE_PORT} -t)

if [ $ATTEMPTS -eq $TIMEOUT_SECONDS ]; then
    echo "Error: Hardhat Node did not start within $TIMEOUT_SECONDS seconds."
    kill "$HARDHAT_PID_ROOT" # Kill the process if it didn't start
    kill "$HARDHAT_PID" || true
    exit 1
fi

# --- Kill Hardhat Node ---
echo "--- Killing Hardhat Node (PID: $HARDHAT_PID_ROOT) ---"
if ps -p "$HARDHAT_PID_ROOT" > /dev/null 2>&1; then
  echo "Process $HARDHAT_PID_ROOT is running. Killing..."
  kill "$HARDHAT_PID_ROOT"
else
  echo "Process $HARDHAT_PID_ROOT is not running."
fi

if ps -p "$HARDHAT_PID" > /dev/null 2>&1; then
  echo "Process $HARDHAT_PID is running. Killing..."
  kill "$HARDHAT_PID"
else
  echo "Process $HARDHAT_PID is not running."
fi

wait "$HARDHAT_PID_ROOT" 2>/dev/null || true
wait "$HARDHAT_PID" 2>/dev/null || true

# --- Add extra sleep (to avoid possible conflict with next server instance launch) ---
sleep 1

########################################################################


echo "--- Starting Anvil in background ---"
# Start Anvil in the background
# anvil &> /dev/null &
anvil > anvil.log 2>&1 &
ANVIL_PID=$! # Get the PID of the background process
sleep 2

echo "Anvil started with PID: $ANVIL_PID. Waiting for it to be ready..."

cat anvil.log

# --- Wait for Anvil to be ready ---
ATTEMPTS=0
while [ $ATTEMPTS -lt $TIMEOUT_SECONDS ]; do
    if curl -s -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":2}' "$ANVIL_URL" > /dev/null 2>&1; then
        echo "Anvil is ready!"
        break
    fi
    echo "Waiting for Anvil... (Attempt $((ATTEMPTS+1))/$TIMEOUT_SECONDS)"
    sleep "$CHECK_INTERVAL_SECONDS"
    ATTEMPTS=$((ATTEMPTS+1))
done

echo "--- Request Anvil web3_clientVersion ---"
curl -s -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"web3_clientVersion","params":[],"id":3}' "$ANVIL_URL"

if [ $ATTEMPTS -eq $TIMEOUT_SECONDS ]; then
    echo "Error: Anvil did not start within $TIMEOUT_SECONDS seconds."
    kill "$ANVIL_PID" # Kill the process if it didn't start
    exit 1
fi

# --- Run tests ---
echo "--- Running tests against external Anvil ---"
npm run test:anvilsimple || true

# Capture the test exit code 
TEST_EXIT_CODE=$?

# --- Kill Anvil ---
echo "--- Killing Anvil (PID: $ANVIL_PID) ---"
kill "$ANVIL_PID"

# Wait for the process to actually terminate
# This might not be strictly necessary, but good practice
if ps -p $ANVIL_PID > /dev/null; then
    echo "Waiting for Anvil to terminate..."
    wait $ANVIL_PID || true # wait for process to finish, ignore errors
fi

# Exit with the same exit code 
exit "$TEST_EXIT_CODE"