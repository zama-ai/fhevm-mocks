#!/bin/bash
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# At this stage:
# - The root package version has been bumped using `npm version prerelease`
VERSION=$(npm pkg get version | tr -d '\"') 
echo "Bump to version=${VERSION}"

# WARNING: The following 4 steps must be executed in this exact order.

# Step 1
# ======
# we must update hardhat-plugin/package.json peer dependencies:
# @fhevm/mock-utils must point to the next bumped version number (otherwise the `npm version prerelease`` command will fail)
cd ${ROOT_DIR}/packages/hardhat-plugin/scripts
node ./update-peer-dependencies.cjs $VERSION

# Step 2
# ======
# Now we can safely bump @fhevm/mock-utils version number
# The `--allow-same-version` should be removed
cd ${ROOT_DIR}/packages/mock-utils/src 
npm version $VERSION --no-git-tag-version --allow-same-version

# Step 3
# ======
# Update @fhevm/mock-utils runtime version number file: `_version.ts`
cd ${ROOT_DIR}/packages/mock-utils/scripts
node ./generate-version.cjs

# Step 4
# ======
# Now we can safely bump @fhevm/hardhat-plugin version number
# The `--allow-same-version` should be removed
cd ${ROOT_DIR}/packages/hardhat-plugin
npm version $VERSION --no-git-tag-version --allow-same-version
