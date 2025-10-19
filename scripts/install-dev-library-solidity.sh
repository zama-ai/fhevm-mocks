#!/bin/bash
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

TMP_DIR="${ROOT_DIR}/tmp"
FHEVM_DIR="${ROOT_DIR}/tmp/fhevm"
LIB_SOL_DIR="${FHEVM_DIR}/library-solidity"
LIB_SOL_NODE_MODULES_DIR="${ROOT_DIR}/node_modules/@fhevm/solidity"

if [ ! -d "${ROOT_DIR}/node_modules/@fhevm/solidity" ]; then
    echo "${ROOT_DIR}/node_modules/@fhevm/solidity" does not exist!
    exit 1
fi

rm -rf ${TMP_DIR}/package
rm -rf ${TMP_DIR}/*.tgz
rm -rf ${LIB_SOL_DIR}/*.tgz

cd "${LIB_SOL_DIR}"
cp .env.example .env
npm ci --include=optional
npm run compile
npm pack && mv *.tgz fhevm-solidity.tgz

cd "${TMP_DIR}"
mv "${LIB_SOL_DIR}/fhevm-solidity.tgz" "${TMP_DIR}"
tar xfvz fhevm-solidity.tgz

rm -rf "${LIB_SOL_NODE_MODULES_DIR}"
cp -R "${TMP_DIR}/package" "${LIB_SOL_NODE_MODULES_DIR}"

rm -rf ${TMP_DIR}/package
rm -rf ${TMP_DIR}/*.tgz
rm -rf ${LIB_SOL_DIR}/*.tgz
