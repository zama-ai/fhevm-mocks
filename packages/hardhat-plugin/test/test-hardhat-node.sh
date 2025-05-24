#!/usr/bin/env bash

set -euo pipefail # Exit on error, undefined vars, and pipe errors

HARDHAT_NODE_PORT=8545
HARDHAT_NODE_HOST=127.0.0.1
HARDHAT_NODE_URL="http://${HARDHAT_NODE_HOST}:${HARDHAT_NODE_PORT}"
TIMEOUT_SECONDS=60 # Max time to wait for Hardhat Node to start
CHECK_INTERVAL_SECONDS=1 # How often to poll the node

echo "--- Starting Hardhat Node in background ---"
# Start Hardhat Node in the background, redirecting output to a log file
# Or /dev/null if you want to suppress all output from the node itself
npx hardhat node &> /dev/null &
HARDHAT_PID=$! # Get the PID of the background process

echo "Hardhat Node started with PID: $HARDHAT_PID. Waiting for it to be ready..."

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

if [ $ATTEMPTS -eq $TIMEOUT_SECONDS ]; then
    echo "Error: Hardhat Node did not start within $TIMEOUT_SECONDS seconds."
    kill "$HARDHAT_PID" # Kill the process if it didn't start
    exit 1
fi

# --- Run Vitest tests ---
echo "--- Running Vitest tests against external Hardhat Node ---"
npm run test:node || true # This runs 'vitest run' without watch mode

# Capture the exit code of the Vitest run
VITEST_EXIT_CODE=$?

# --- Kill Hardhat Node ---
echo "--- Killing Hardhat Node (PID: $HARDHAT_PID) ---"
kill "$HARDHAT_PID"

# Wait for the process to actually terminate
# This might not be strictly necessary, but good practice
if ps -p $HARDHAT_PID > /dev/null; then
    echo "Waiting for Hardhat Node to terminate..."
    wait $HARDHAT_PID || true # wait for process to finish, ignore errors
fi

# Exit with the same exit code as the Vitest tests
# This ensures CI/CD pipelines fail if tests fail
exit "$VITEST_EXIT_CODE"