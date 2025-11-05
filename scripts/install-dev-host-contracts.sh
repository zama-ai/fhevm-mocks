#!/bin/bash
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

TMP_DIR="${ROOT_DIR}/tmp"
FHEVM_DIR="${ROOT_DIR}/tmp/fhevm"

# Usage: 
#   ./install-dev-host-contracts.sh /path/to/fhevm 0.9.0-3
#   ./install-dev-host-contracts.sh /path/to/fhevm
#   ./install-dev-host-contracts.sh 
#
# Example:
#   ./install-dev-host-contracts.sh ../../../../good-bye-oracle/fhevm 0.9.0-3

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

HOST_CONTRACTS_DIR="${FHEVM_DIR}/host-contracts"
HOST_CONTRACTS_NODE_MODULES_DIR="${ROOT_DIR}/node_modules/@fhevm/host-contracts"

if [ ! -d "${HOST_CONTRACTS_NODE_MODULES_DIR}" ]; then
    echo "❌ ERROR: ${HOST_CONTRACTS_NODE_MODULES_DIR} does not exist!"
    exit 1
fi

if [ -n "$(find "${LIB_SOL_DIR}" -maxdepth 1 -name "*.tgz" -print -quit 2>/dev/null)" ]; then
    echo "❌ ERROR: Found at least one .tgz file in ${LIB_SOL_DIR}." >&2
    exit 1
fi

rm -rf ${TMP_DIR}/package
rm -rf ${TMP_DIR}/fhevm-host-contracts.tgz
rm -rf ${HOST_CONTRACTS_DIR}/*.tgz

cd "${HOST_CONTRACTS_DIR}"

if [ ! -f ".env" ]; then
    cp .env.example .env
fi

npm ci --include=optional
npm run deploy:emptyProxies
npm run compile
npm pack && mv *.tgz fhevm-host-contracts.tgz

if [ ! -d "${TMP_DIR}" ]; then
    mkdir -p "${TMP_DIR}"
fi

cd "${TMP_DIR}"
mv "${HOST_CONTRACTS_DIR}/fhevm-host-contracts.tgz" "${TMP_DIR}"
tar xfvz fhevm-host-contracts.tgz

rm -rf "${HOST_CONTRACTS_NODE_MODULES_DIR}"
cp -R "${TMP_DIR}/package" "${HOST_CONTRACTS_NODE_MODULES_DIR}"

rm -rf ${TMP_DIR}/package
rm -rf ${TMP_DIR}/fhevm-host-contracts.tgz
rm -f ${HOST_CONTRACTS_DIR}/fhevm-host-contracts.tgz

# Change package version
if [ ! -z "$2" ]; then
    VERSION="${2}"

    cat "${HOST_CONTRACTS_NODE_MODULES_DIR}/package.json" | jq --arg v "$VERSION" '.version = $v' > "${HOST_CONTRACTS_NODE_MODULES_DIR}/package-2.json"
    mv "${HOST_CONTRACTS_NODE_MODULES_DIR}/package-2.json" "${HOST_CONTRACTS_NODE_MODULES_DIR}/package.json"
    jq '.version' "${HOST_CONTRACTS_NODE_MODULES_DIR}/package.json"
fi

