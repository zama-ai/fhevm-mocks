#!/bin/bash
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

VERSION=$(npm pkg get version | tr -d '\"') 
echo "Bump to version=${VERSION}"

cd ${ROOT_DIR}/packages/hardhat-plugin/scripts
node ./update-peer-dependencies.cjs $VERSION

cd ${ROOT_DIR}/packages/mock-utils/src 
npm version $VERSION --no-git-tag-version --allow-same-version

cd ${ROOT_DIR}/packages/mock-utils/scripts
node ./generate-version.cjs

cd ${ROOT_DIR}/packages/hardhat-plugin
npm version $VERSION --no-git-tag-version --allow-same-version
