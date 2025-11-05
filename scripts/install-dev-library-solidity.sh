#!/bin/bash
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="${ROOT_DIR}/tmp"
FHEVM_DIR="${ROOT_DIR}/tmp/fhevm"

# Usage: 
#   ./install-dev-library-solidity.sh /path/to/fhevm 0.9.0-2
#   ./install-dev-library-solidity.sh /path/to/fhevm
#   ./install-dev-library-solidity.sh 
#
# Example:
#   ./install-dev-library-solidity.sh ../../../../good-bye-oracle/fhevm 0.9.0-2

if [ ! -z "$1" ]; then
    FHEVM_DIR="${1}"
fi

if [ ! -d "${FHEVM_DIR}" ]; then
    echo "${FHEVM_DIR} does not exist!"
    exit 1
else
    FHEVM_DIR="$(cd "${FHEVM_DIR}" && pwd)"
fi

echo $FHEVM_DIR

LIB_SOL_DIR="${FHEVM_DIR}/library-solidity"
LIB_SOL_NODE_MODULES_DIR="${ROOT_DIR}/node_modules/@fhevm/solidity"

if [ ! -d "${LIB_SOL_NODE_MODULES_DIR}" ]; then
    echo "❌ ERROR: ${LIB_SOL_NODE_MODULES_DIR} does not exist!"
    exit 1
fi

if [ -n "$(find "${LIB_SOL_DIR}" -maxdepth 1 -name "*.tgz" -print -quit 2>/dev/null)" ]; then
    echo "❌ ERROR: Found at least one .tgz file in ${LIB_SOL_DIR}." >&2
    exit 1
fi

rm -rf ${TMP_DIR}/package
rm -rf ${TMP_DIR}/*.tgz
rm -rf ${LIB_SOL_DIR}/*.tgz

cd "${LIB_SOL_DIR}"

if [ ! -f ".env" ]; then
    cp .env.example .env
fi

npm ci --include=optional
npm run compile
npm pack && mv *.tgz fhevm-solidity.tgz

if [ ! -d "${TMP_DIR}" ]; then
    mkdir -p "${TMP_DIR}"
fi

cd "${TMP_DIR}"
mv "${LIB_SOL_DIR}/fhevm-solidity.tgz" "${TMP_DIR}"
tar xfvz fhevm-solidity.tgz

rm -rf "${LIB_SOL_NODE_MODULES_DIR}"
cp -R "${TMP_DIR}/package" "${LIB_SOL_NODE_MODULES_DIR}"

rm -rf ${TMP_DIR}/package
rm -rf ${TMP_DIR}/*.tgz
rm -f ${LIB_SOL_DIR}/fhevm-solidity.tgz

# Change package version
if [ ! -z "$2" ]; then
    VERSION="${2}"

    cat "${LIB_SOL_NODE_MODULES_DIR}/package.json" | jq --arg v "$VERSION" '.version = $v' > "${LIB_SOL_NODE_MODULES_DIR}/package-2.json"
    mv "${LIB_SOL_NODE_MODULES_DIR}/package-2.json" "${LIB_SOL_NODE_MODULES_DIR}/package.json"
    jq '.version' "${LIB_SOL_NODE_MODULES_DIR}/package.json"
fi
