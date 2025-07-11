#!/usr/bin/env bash

set -euo pipefail # Exit on error, undefined vars, and pipe errors

ANVIL_PORT=8545
ANVIL_HOST=127.0.0.1
ANVIL_URL="http://${ANVIL_HOST}:${ANVIL_PORT}"
TIMEOUT_SECONDS=60 # Max time to wait for Anvil to start
CHECK_INTERVAL_SECONDS=1 # How often to poll the node

echo "--- Starting Anvil in background ---"
# Start Anvil in the background
anvil &> /dev/null &
ANVIL_PID=$! # Get the PID of the background process

echo "Anvil started with PID: $ANVIL_PID. Waiting for it to be ready..."

# --- Wait for Anvil to be ready ---
ATTEMPTS=0
while [ $ATTEMPTS -lt $TIMEOUT_SECONDS ]; do
    if curl -s -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' "$ANVIL_URL" > /dev/null 2>&1; then
        echo "Anvil is ready!"
        break
    fi
    echo "Waiting for Anvil... (Attempt $((ATTEMPTS+1))/$TIMEOUT_SECONDS)"
    sleep "$CHECK_INTERVAL_SECONDS"
    ATTEMPTS=$((ATTEMPTS+1))
done

if [ $ATTEMPTS -eq $TIMEOUT_SECONDS ]; then
    echo "Error: Anvil did not start within $TIMEOUT_SECONDS seconds."
    kill "$ANVIL_PID" # Kill the process if it didn't start
    exit 1
fi

# --- Run tests ---
echo "--- Running tests against external Anvil ---"
npm run test:anvil || true

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