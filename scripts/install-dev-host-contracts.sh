#!/bin/bash
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

TMP_DIR="${ROOT_DIR}/tmp"
FHEVM_DIR="${ROOT_DIR}/tmp/fhevm"

if [ ! -d "${ROOT_DIR}/node_modules/@fhevm/host-contracts" ]; then
    echo "${ROOT_DIR}/node_modules/@fhevm/host-contracts" does not exist!
    exit 1
fi

rm -rf ${TMP_DIR}/package
rm -rf ${TMP_DIR}/fhevm-host-contracts.tgz
rm -rf ${FHEVM_DIR}/host-contracts/*.tgz

cd "${FHEVM_DIR}"
cd host-contracts
cp .env.example .env
npm ci --include=optional
npm run deploy:emptyProxies
npm run compile
npm run compile:decryptionOracle
npm pack && mv *.tgz fhevm-host-contracts.tgz

cd "${TMP_DIR}"
mv "${FHEVM_DIR}/host-contracts/fhevm-host-contracts.tgz" "${TMP_DIR}"
tar xfvz fhevm-host-contracts.tgz

rm -rf "${ROOT_DIR}/node_modules/@fhevm/host-contracts"
cp -R "${TMP_DIR}/package" "${ROOT_DIR}/node_modules/@fhevm/host-contracts"

rm -rf ${TMP_DIR}/package
rm -rf ${TMP_DIR}/fhevm-host-contracts.tgz
