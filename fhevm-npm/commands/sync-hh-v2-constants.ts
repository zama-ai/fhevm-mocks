// HARDHAT 2 ONLY. When hardhat/v2 is deleted, delete this file, test/sync-hh-v2-constants.test.ts, and the
// lines tagged `hh-v2-constants` in cli-options.ts, fhevm-npm.ts, README.md and the Makefile. Nothing else
// depends on it.
//
// `sync hh-v2-constants` keeps the two package versions the Hardhat 2 plugin hardcodes in
// src/internal/constants.ts in line with the workspace's sources of truth. Neither a version bump nor a
// pin change touches that file, so without this it drifts silently.
//
//   FHEVM_HOST_CONTRACTS_CLEARTEXT_PACKAGE  <- versions.json, at the key the plugin's own `file:`
//                                              dependency points to (follows the plugin to another
//                                              generation without a change here)
//   FHEVM_SOLIDITY_PACKAGE                  <- the floor of npm-manifest.json#dependencies.pinned
//                                              (`^0.13.4` -> `0.13.4`): the release whose addresses
//                                              the block was checked against
//
// For each block, only two spots are rewritten, and each must occur exactly once:
//   // <package>@X               (the comment above the block)
//   <BLOCK>: { version: 'X'      (the block's first field)

import { readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

import { loadVersions, VERSIONS_FILE } from '../base/versions.ts';

export const HH_V2_PLUGIN_DIR = 'hardhat/v2/plugin/pkg';
export const HH_V2_CONSTANTS_FILE = `${HH_V2_PLUGIN_DIR}/src/internal/constants.ts`;
const MANIFEST_FILE = 'npm-manifest.json';
const CLEARTEXT_PACKAGE = '@fhevm/host-contracts-cleartext';
const SOLIDITY_PACKAGE = '@fhevm/solidity';

/** One package version recorded in constants.ts, and where its expected value comes from. */
export type HhV2ConstantsEntry = {
  readonly packageName: string;
  readonly block: string;
  readonly version: string;
  readonly source: string;
};

export type HhV2ConstantsStatus = {
  readonly path: string;
  readonly entries: readonly HhV2ConstantsEntry[];
  readonly status: 'identical' | 'different';
};

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const commentPattern = (packageName: string): RegExp =>
  new RegExp(`^([ \\t]*\\/\\/ ${escape(packageName)}@)([^\\s]+)[ \\t]*$`, 'gm');
const versionFieldPattern = (block: string): RegExp =>
  new RegExp(`(${escape(block)}:[ \\t]*\\{[ \\t]*\\r?\\n[ \\t]*version:[ \\t]*')([^']*)(')`, 'g');

/** The version versions.json gives the host-contracts-cleartext package the plugin depends on. */
export function hhV2HostContractsVersion(workspaceRoot: string): string {
  const pluginDir = join(workspaceRoot, HH_V2_PLUGIN_DIR);
  const packageJson = JSON.parse(readFileSync(join(pluginDir, 'package.json'), 'utf8')) as {
    readonly dependencies?: Readonly<Record<string, string>>;
  };
  const spec = packageJson.dependencies?.[CLEARTEXT_PACKAGE];
  if (spec === undefined || !spec.startsWith('file:')) {
    throw new Error(
      `${HH_V2_PLUGIN_DIR}/package.json: expected a file: dependency on ${CLEARTEXT_PACKAGE}, found ${spec}`,
    );
  }
  const key = `./${relative(workspaceRoot, resolve(pluginDir, spec.slice('file:'.length)))
    .split(sep)
    .join('/')}`;
  const version = loadVersions(workspaceRoot).packages[key];
  if (version === undefined) {
    throw new Error(
      `${VERSIONS_FILE} has no entry for ${key}, the ${CLEARTEXT_PACKAGE} the Hardhat 2 plugin depends on`,
    );
  }
  return version;
}

/** The floor of the workspace's pin of @fhevm/solidity: `^0.13.4`, `~0.13.4` and `0.13.4` all give `0.13.4`. */
export function hhV2SolidityVersion(workspaceRoot: string): string {
  const manifest = JSON.parse(readFileSync(join(workspaceRoot, MANIFEST_FILE), 'utf8')) as {
    readonly dependencies?: { readonly pinned?: Readonly<Record<string, string>> };
  };
  const pin = manifest.dependencies?.pinned?.[SOLIDITY_PACKAGE];
  const floor = /^[\^~]?(\d+\.\d+\.\d+)$/.exec(pin ?? '')?.[1];
  if (floor === undefined) {
    throw new Error(
      `${MANIFEST_FILE}#dependencies.pinned: expected an exact, caret or tilde pin of ${SOLIDITY_PACKAGE}, found ${pin}`,
    );
  }
  return floor;
}

/** What constants.ts must record, read from the workspace. */
export function hhV2ConstantsEntries(workspaceRoot: string): readonly HhV2ConstantsEntry[] {
  return [
    {
      packageName: CLEARTEXT_PACKAGE,
      block: 'FHEVM_HOST_CONTRACTS_CLEARTEXT_PACKAGE',
      version: hhV2HostContractsVersion(workspaceRoot),
      source: VERSIONS_FILE,
    },
    {
      packageName: SOLIDITY_PACKAGE,
      block: 'FHEVM_SOLIDITY_PACKAGE',
      version: hhV2SolidityVersion(workspaceRoot),
      source: `${MANIFEST_FILE}#dependencies.pinned`,
    },
  ];
}

/** Pure: constants.ts text in, the same text with every entry's two version spots set out. */
export function renderHhV2Constants(text: string, entries: readonly HhV2ConstantsEntry[]): string {
  let output = text;
  for (const { packageName, block, version } of entries) {
    const comment = commentPattern(packageName);
    const field = versionFieldPattern(block);
    for (const [pattern, what] of [
      [comment, `'// ${packageName}@<version>' comment`],
      [field, `'version' field opening ${block}`],
    ] as const) {
      const count = [...output.matchAll(pattern)].length;
      if (count !== 1) throw new Error(`${HH_V2_CONSTANTS_FILE}: expected exactly one ${what}, found ${count}`);
    }
    output = output
      .replace(comment, (_match, head: string) => `${head}${version}`)
      .replace(field, (_match, head: string, _old: string, tail: string) => `${head}${version}${tail}`);
  }
  return output;
}

/** Rewrites constants.ts (or, with `check`, only compares it against what it would write). */
export function syncHhV2Constants(options: {
  readonly workspaceRoot: string;
  readonly check: boolean;
}): HhV2ConstantsStatus {
  const path = join(options.workspaceRoot, HH_V2_CONSTANTS_FILE);
  const entries = hhV2ConstantsEntries(options.workspaceRoot);
  const current = readFileSync(path, 'utf8');
  const next = renderHhV2Constants(current, entries);
  if (next === current) return { path, entries, status: 'identical' };
  if (!options.check) writeFileSync(path, next);
  return { path, entries, status: options.check ? 'different' : 'identical' };
}

export function syncHhV2ConstantsCommand(options: { readonly workspaceRoot: string; readonly check: boolean }): void {
  const output = syncHhV2Constants(options);
  const display = relative(process.cwd(), output.path) || '.';
  const summary = output.entries.map(({ packageName, version }) => `${packageName}@${version}`).join(', ');
  if (!options.check) {
    console.log(`✅ ${display} records ${summary}`);
    return;
  }
  if (output.status !== 'identical') {
    console.error(`❌ ${display} does not record ${summary}`);
    for (const { packageName, source } of output.entries) console.error(`   ${packageName} comes from ${source}`);
    throw new Error(`Run \`fhevm-npm sync hh-v2-constants\` to update ${HH_V2_CONSTANTS_FILE}`);
  }
  console.log(`✅ ${display} matches ${summary}`);
}
