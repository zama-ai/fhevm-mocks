#!/bin/bash
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

FHEVM_DIR="${ROOT_DIR}/tmp/fhevm"
BRANCH="hostCleanup"

if [ ! -d "${FHEVM_DIR}" ]; then
    rm -rf "${ROOT_DIR}/tmp"

    mkdir "${ROOT_DIR}/tmp"
    cd "${ROOT_DIR}/tmp"

    git clone https://github.com/zama-ai/fhevm.git
fi

cd "${FHEVM_DIR}"

git checkout main
git pull origin
git checkout ${BRANCH}
git pull origin
