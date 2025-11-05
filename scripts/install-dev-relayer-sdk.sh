#!/bin/bash
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ZAMA_AI_DIR="$(cd "${ROOT_DIR}/../.." && pwd)"
TMP_DIR="${ROOT_DIR}/tmp"
RELAYER_SDK_DIR="${ROOT_DIR}/tmp/relayer-sdk"
OUT_ZAMA_FHE_DIR="${ROOT_DIR}/node_modules/@zama-fhe"
OUT_RELAYER_SDK_DIR="${OUT_ZAMA_FHE_DIR}/relayer-sdk"

# Usage: 
#   ./install-dev-relayer-sdk.sh /path/to/relayer-sdk 0.3.0-4
#   ./install-dev-relayer-sdk.sh /path/to/relayer-sdk
#   ./install-dev-relayer-sdk.sh 
#
# Example:
#   ./install-dev-relayer-sdk.sh ../../../relayer-sdk 0.3.0-4

if [ ! -z "$1" ]; then
    RELAYER_SDK_DIR="${1}"
else
    echo "Missing relayer-sdk directory"
    exit 1
fi

if [ ! -d "${RELAYER_SDK_DIR}" ]; then
    echo "${RELAYER_SDK_DIR} does not exist!"
    exit 1
else
    RELAYER_SDK_DIR="$(cd "${RELAYER_SDK_DIR}" && pwd)"
fi

if [ ! -d "${OUT_RELAYER_SDK_DIR}" ]; then
    echo "${OUT_RELAYER_SDK_DIR} does not exist!"
    exit 1
else
    OUT_RELAYER_SDK_DIR="$(cd "${OUT_RELAYER_SDK_DIR}" && pwd)"
fi

echo $RELAYER_SDK_DIR
echo $OUT_RELAYER_SDK_DIR

VERSION=$(jq -r '.version' "${RELAYER_SDK_DIR}/package.json")
NAME=$(jq -r '.name' "${RELAYER_SDK_DIR}/package.json")
NAME=${NAME/@/}
NAME=${NAME//\//-}
TGZ_FILE="${NAME}-${VERSION}.tgz"

echo "${TMP_DIR}/${TGZ_FILE}"

if [ -n "$(find "${RELAYER_SDK_DIR}" -maxdepth 1 -name "*.tgz" -print -quit 2>/dev/null)" ]; then
    echo "❌ ERROR: Found at least one .tgz file in ${RELAYER_SDK_DIR}." >&2
    exit 1
fi

rm -rf ${TMP_DIR}/package
rm -rf ${TMP_DIR}/relayer-sdk
rm -rf ${TMP_DIR}/*.tgz
rm -rf ${RELAYER_SDK_DIR}/*.tgz

# =====================================================
# Build relayer-sdk
# =====================================================

cd "${RELAYER_SDK_DIR}"

npm run clean
npm run build

# =====================================================
# Create tgz
# =====================================================

cd ${RELAYER_SDK_DIR}
npm pack

ls -la

# move tarball
mv ./${TGZ_FILE} ${TMP_DIR}

cd ${TMP_DIR}

# extract
tar xfvz ./${TGZ_FILE}
rm -f ./${TGZ_FILE}

# rename dir
mv ./package ./relayer-sdk

# replace
rm -rf ${OUT_RELAYER_SDK_DIR}
mv ./relayer-sdk ${OUT_ZAMA_FHE_DIR}

# clean
rm -rf ${TMP_DIR}/package
rm -rf ${TMP_DIR}/relayer-sdk
rm -rf ${TMP_DIR}/*.tgz
rm -f ${RELAYER_SDK_DIR}/relayer-sdk.tgz

# Change package version
if [ ! -z "$2" ]; then
    VERSION="${2}"

    cat "${OUT_RELAYER_SDK_DIR}/package.json" | jq --arg v "$VERSION" '.version = $v' > "${OUT_RELAYER_SDK_DIR}/package-2.json"
    mv "${OUT_RELAYER_SDK_DIR}/package-2.json" "${OUT_RELAYER_SDK_DIR}/package.json"
    jq '.version' "${OUT_RELAYER_SDK_DIR}/package.json"
fi
