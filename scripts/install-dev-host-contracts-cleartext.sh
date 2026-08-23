#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ZAMA_AI_DIR="$(cd "${ROOT_DIR}/.." && pwd)"

PKG_NAME="@fhevm/host-contracts-cleartext"
OLD_PKG_NAME="@zama-fhe/relayer-sdk"
DEP_SECTION="dependencies"

HARDHAT_PLUGIN_DIR="${ROOT_DIR}/packages/hardhat-plugin"
HARDHAT_PLUGIN_PKG_JSON="${HARDHAT_PLUGIN_DIR}/package.json"
HARDHAT_PLUGIN_NODE_MODULES_DIR="${HARDHAT_PLUGIN_DIR}/node_modules/${PKG_NAME}"
LOCK_FILE="${ROOT_DIR}/package-lock.json"
LOCK_PKG_PATH="node_modules/${PKG_NAME}"

DEFAULT_TGZ="${ZAMA_AI_DIR}/fhevm/sdk/host-contracts-cleartext/v13/tarball/fhevm-host-contracts-cleartext-0.13.0.tgz"

# Usage:
#   ./install-dev-host-contracts-cleartext.sh
#   ./install-dev-host-contracts-cleartext.sh /path/to/fhevm-host-contracts-cleartext-0.13.0.tgz
#   ./install-dev-host-contracts-cleartext.sh /path/to/tarball-dir
#   ./install-dev-host-contracts-cleartext.sh /path/to/tarball-dir --no-install
#   ./install-dev-host-contracts-cleartext.sh --force
#
# Installs a locally built @fhevm/host-contracts-cleartext tarball as a dependency of
# packages/hardhat-plugin, replacing the old @zama-fhe/relayer-sdk entry.
#
# Safe to re-run after rebuilding the tarball. A dev tarball keeps the same version across
# rebuilds, so the script compares the tarball's sha512 against the one recorded in
# package-lock.json rather than trusting the version, and reinstalls whenever they differ.
#
# Options:
#   --no-install      patch package.json but do not run npm install
#   --force           reinstall even if the tarball is byte-identical to what is installed
#   --ignore-scripts  pass --ignore-scripts to npm install, skipping the root 'prepare' build
#
# Example:
#   ./install-dev-host-contracts-cleartext.sh ../fhevm/sdk/host-contracts-cleartext/v13/tarball

TGZ_ARG=""
RUN_INSTALL=1
FORCE_REINSTALL=0
NPM_EXTRA_ARGS=""

for arg in "$@"; do
    case "${arg}" in
        --no-install)
            RUN_INSTALL=0
            ;;
        --force)
            FORCE_REINSTALL=1
            ;;
        --ignore-scripts)
            NPM_EXTRA_ARGS="--ignore-scripts"
            ;;
        -*)
            echo "❌ ERROR: unknown option ${arg}" >&2
            exit 1
            ;;
        *)
            if [ -n "${TGZ_ARG}" ]; then
                echo "❌ ERROR: too many arguments (${arg})" >&2
                exit 1
            fi
            TGZ_ARG="${arg}"
            ;;
    esac
done

if ! command -v jq >/dev/null 2>&1; then
    echo "❌ ERROR: jq is required." >&2
    exit 1
fi

if ! command -v openssl >/dev/null 2>&1; then
    echo "❌ ERROR: openssl is required (used to hash the tarball)." >&2
    exit 1
fi

# =====================================================
# Helpers
# =====================================================

# Reproduces npm's Subresource Integrity string for a tarball: base64 of its raw sha512.
# This is what package-lock.json stores, so the two are directly comparable.
compute_integrity() {
    printf 'sha512-%s' "$(openssl dgst -sha512 -binary "${1}" | openssl base64 -A)"
}

# The integrity npm recorded for this package, or empty if it is not in the lockfile.
lockfile_integrity() {
    if [ ! -f "${LOCK_FILE}" ]; then
        return 0
    fi
    jq -r --arg p "${LOCK_PKG_PATH}" '.packages[$p].integrity // empty' "${LOCK_FILE}"
}

# Remove the package's lockfile entries — its own, plus anything nested beneath it
# (its private dependencies live at "<path>/node_modules/...").
strip_lockfile_entries() {
    if [ ! -f "${LOCK_FILE}" ]; then
        return 0
    fi
    jq --arg p "${LOCK_PKG_PATH}" '
        .packages |= with_entries(select(.key != $p and ((.key | startswith($p + "/")) | not)))
        ' "${LOCK_FILE}" > "${LOCK_FILE}.tmp"
    mv "${LOCK_FILE}.tmp" "${LOCK_FILE}"
}

find_installed_pkg_json() {
    for candidate in \
        "${HARDHAT_PLUGIN_NODE_MODULES_DIR}/package.json" \
        "${ROOT_DIR}/node_modules/${PKG_NAME}/package.json"; do
        if [ -f "${candidate}" ]; then
            printf '%s' "${candidate}"
            return 0
        fi
    done
}

# =====================================================
# Resolve the tarball
# =====================================================

TGZ_FILE="${TGZ_ARG:-${DEFAULT_TGZ}}"

if [ -d "${TGZ_FILE}" ]; then
    TGZ_DIR="$(cd "${TGZ_FILE}" && pwd)"
    FOUND=$(find "${TGZ_DIR}" -maxdepth 1 -name "fhevm-host-contracts-cleartext-*.tgz" | sort)
    COUNT=$(echo "${FOUND}" | grep -c . || true)
    if [ "${COUNT}" -eq 0 ]; then
        echo "❌ ERROR: No fhevm-host-contracts-cleartext-*.tgz found in ${TGZ_DIR}." >&2
        exit 1
    fi
    if [ "${COUNT}" -gt 1 ]; then
        echo "❌ ERROR: Found ${COUNT} fhevm-host-contracts-cleartext-*.tgz files in ${TGZ_DIR}:" >&2
        echo "${FOUND}" >&2
        exit 1
    fi
    TGZ_FILE="${FOUND}"
fi

if [ ! -f "${TGZ_FILE}" ]; then
    echo "❌ ERROR: ${TGZ_FILE} does not exist!" >&2
    exit 1
fi

TGZ_FILE="$(cd "$(dirname "${TGZ_FILE}")" && pwd)/$(basename "${TGZ_FILE}")"

if [ ! -f "${HARDHAT_PLUGIN_PKG_JSON}" ]; then
    echo "❌ ERROR: ${HARDHAT_PLUGIN_PKG_JSON} does not exist!" >&2
    exit 1
fi

# =====================================================
# Sanity check the tarball content
# =====================================================

TGZ_PKG_JSON="$(tar xzOf "${TGZ_FILE}" package/package.json)"
TGZ_NAME="$(echo "${TGZ_PKG_JSON}" | jq -r '.name')"
TGZ_VERSION="$(echo "${TGZ_PKG_JSON}" | jq -r '.version')"

if [ "${TGZ_NAME}" != "${PKG_NAME}" ]; then
    echo "❌ ERROR: ${TGZ_FILE} contains '${TGZ_NAME}', expected '${PKG_NAME}'." >&2
    exit 1
fi

TGZ_INTEGRITY="$(compute_integrity "${TGZ_FILE}")"

echo "tarball   : ${TGZ_FILE}"
echo "package   : ${TGZ_NAME}@${TGZ_VERSION}"
echo "integrity : ${TGZ_INTEGRITY}"
echo "target    : ${HARDHAT_PLUGIN_PKG_JSON}"

# =====================================================
# Patch packages/hardhat-plugin/package.json
# =====================================================

DEP_SPEC="file:${TGZ_FILE}"

jq \
    --arg section "${DEP_SECTION}" \
    --arg name "${PKG_NAME}" \
    --arg old "${OLD_PKG_NAME}" \
    --arg spec "${DEP_SPEC}" \
    '
    # drop the old relayer-sdk entry wherever it lives
    (.dependencies, .devDependencies, .peerDependencies) |= (if . == null then . else del(.[$old]) end)
    # install the cleartext host contracts in its place
    | .[$section] = ((.[$section] // {}) + {($name): $spec})
    ' \
    "${HARDHAT_PLUGIN_PKG_JSON}" > "${HARDHAT_PLUGIN_PKG_JSON}.tmp"

mv "${HARDHAT_PLUGIN_PKG_JSON}.tmp" "${HARDHAT_PLUGIN_PKG_JSON}"

jq --arg section "${DEP_SECTION}" '.[$section]' "${HARDHAT_PLUGIN_PKG_JSON}"

# =====================================================
# Install
# =====================================================

if [ "${RUN_INSTALL}" -eq 0 ]; then
    echo "⏩ Skipping npm install (--no-install)."
    exit 0
fi

cd "${ROOT_DIR}"

# Is what is currently installed the same bytes as the tarball we were handed?
#
# The version alone cannot answer that: a dev tarball is rebuilt over and over as
# 0.13.0, so `npm install` sees a spec the lockfile already satisfies and does nothing.
# The recorded `integrity` hash is the only thing that distinguishes two builds of the
# same version, so compare against that.
LOCK_INTEGRITY="$(lockfile_integrity)"

if [ "${FORCE_REINSTALL}" -eq 0 ] &&
    [ -n "${LOCK_INTEGRITY}" ] &&
    [ "${LOCK_INTEGRITY}" = "${TGZ_INTEGRITY}" ] &&
    [ -n "$(find_installed_pkg_json)" ]; then
    echo "✅ ${PKG_NAME}@${TGZ_VERSION} is already installed from this exact tarball. Nothing to do."
    echo "   (pass --force to reinstall anyway)"
    exit 0
fi

if [ -n "${LOCK_INTEGRITY}" ] && [ "${LOCK_INTEGRITY}" != "${TGZ_INTEGRITY}" ]; then
    echo "♻️  Tarball changed since the last install (same version, different contents):"
    echo "      installed: ${LOCK_INTEGRITY}"
    echo "      tarball  : ${TGZ_INTEGRITY}"
fi

# Drop every trace of the previous install before reinstalling.
#
# Deleting the directory is not enough on its own: the lockfile still carries the OLD
# `integrity` for this path, and npm treats that as authoritative. Left in place it either
# reinstalls the previously cached bytes or aborts with EINTEGRITY once it fetches the new
# tarball and the hash disagrees. Removing the entries forces npm to re-resolve the file:
# spec from scratch and record the new hash.
rm -rf "${HARDHAT_PLUGIN_NODE_MODULES_DIR}"
rm -rf "${ROOT_DIR}/node_modules/${PKG_NAME}"
strip_lockfile_entries

# npm's exit code is deliberately not fatal here.
#
# This repo's root package.json runs `prepare` -> `npm run build` after every install, so a
# workspace that does not currently compile fails the whole command *after* the dependency
# tree has been written. That is precisely the situation this script is used in — you are
# swapping the tarball because the code does not build yet — so a lifecycle failure must not
# be reported as "the install failed". Judge the outcome by the integrity check below instead.
set +e
npm install --workspace packages/hardhat-plugin ${NPM_EXTRA_ARGS}
NPM_STATUS=$?
set -e

# Confirm npm actually picked up the new bytes rather than resurrecting a cached copy.
NEW_LOCK_INTEGRITY="$(lockfile_integrity)"
if [ -n "${NEW_LOCK_INTEGRITY}" ] && [ "${NEW_LOCK_INTEGRITY}" != "${TGZ_INTEGRITY}" ]; then
    echo "❌ ERROR: after install, ${LOCK_FILE} records ${NEW_LOCK_INTEGRITY}" >&2
    echo "          but ${TGZ_FILE} hashes to ${TGZ_INTEGRITY}." >&2
    exit 1
fi
if [ -z "${NEW_LOCK_INTEGRITY}" ]; then
    echo "❌ ERROR: ${PKG_NAME} is missing from ${LOCK_FILE} after install." >&2
    exit 1
fi

INSTALLED_PKG_JSON="$(find_installed_pkg_json)"

if [ -z "${INSTALLED_PKG_JSON}" ]; then
    echo "❌ ERROR: ${PKG_NAME} was not installed in node_modules." >&2
    exit 1
fi

echo "✅ Installed $(jq -r '.name + "@" + .version' "${INSTALLED_PKG_JSON}") -> $(dirname "${INSTALLED_PKG_JSON}")"
echo "   integrity ${NEW_LOCK_INTEGRITY}"

if [ "${NPM_STATUS}" -ne 0 ]; then
    echo ""
    echo "⚠️  'npm install' exited with status ${NPM_STATUS}, but ${PKG_NAME} installed correctly."
    echo "    That exit code almost certainly comes from a lifecycle script — this repo's root"
    echo "    'prepare' runs 'npm run build' across the workspaces. Re-run with --ignore-scripts"
    echo "    to skip it, or ignore this once the workspaces compile again."
fi
