import { posix } from 'node:path';

import type { NpmManifest } from '../../manifest.ts';
import { generationFamilies } from '../checks/generations.ts';
import { loadVersions } from '../versions.ts';

export const hardhatTemplateV2PackageKey = './hardhat/v2/fhevm-hardhat-template/pkg';

/** The published payload this template links against. Its generation is never spelled out here. */
const CLEARTEXT_PAYLOAD_NAME = '@fhevm/host-contracts-cleartext';

/**
 * The rendered manifest's own identity. `version` is read from versions.json, which owns every published
 * payload's version — written down here it went stale exactly as the specs below did, saying 0.4.2 while
 * versions.json and the committed mirror both said 0.13.0. Field order matches the upstream template's,
 * so a field this patch has to ADD lands where it did before.
 */
function identityFields(workspaceRoot: string): Readonly<Record<string, string>> {
  return {
    name: 'fhevm-hardhat-template-v2',
    version: templateVersion(workspaceRoot),
    description: 'Hardhat v2 based template for developing FHEVM Solidity smart contracts',
  };
}

function templateVersion(workspaceRoot: string): string {
  const version = loadVersions(workspaceRoot).packages[hardhatTemplateV2PackageKey];
  if (version === undefined) {
    throw new Error(`versions.json does not version '${hardhatTemplateV2PackageKey}', which the mirror renders`);
  }
  return version;
}

const removedDependencies = ['@fhevm/mock-utils', '@zama-fhe/relayer-sdk'] as const;

// The specs are NOT written here: every one of them already has a home in npm-manifest.json, and a copy
// in the tool is a pin no workspace edit can reach. `@fhevm/sdk` proves it — this file said ^0.13.3 while
// the manifest had moved to ^0.13.4, and the rendered mirror was quietly a patch level behind.
const addedPinnedDependencies = ['@fhevm/solidity'] as const;
const addedPinnedDevDependencies = ['@fhevm/sdk'] as const;

const addedDevDependencies: Readonly<Record<string, string>> = {
  '@fhevm/hardhat-plugin': 'file:../../plugin/pkg',
};

/** A spec from npm-manifest.json#dependencies.pinned, the one place a shared external pin is declared. */
function pinnedSpec(npmManifest: NpmManifest, name: string): string {
  const spec = npmManifest.dependencies?.pinned?.[name];
  if (spec === undefined) {
    throw new Error(`npm-manifest.json#dependencies.pinned does not pin ${name}, which the mirror injects`);
  }
  return spec;
}

function pinnedAdditions(npmManifest: NpmManifest, names: readonly string[]): Record<string, string> {
  return Object.fromEntries(names.map((name) => [name, pinnedSpec(npmManifest, name)]));
}

/**
 * The `file:` spec for the cleartext payload, resolved from npm-manifest.json#generations rather than
 * written down: a spec spelled out here would be a generation pin inside the tool, which a rotation
 * cannot fix by editing the workspace — rule 3.4.1 would report the rendered mirror as pinned to V(N-1)
 * and the only remedy would be editing fhevm-npm itself.
 *
 * The family is found by the name the template depends on, so neither the family directory nor the
 * generation appears in this file.
 */
export function cleartextPayloadSpec(npmManifest: NpmManifest): string {
  for (const family of generationFamilies(npmManifest)) {
    const payloadKey = npmManifest.packages[family.current]?.publishedRelPath;
    if (payloadKey === undefined) continue;
    if (npmManifest.packages[payloadKey]?.name !== CLEARTEXT_PAYLOAD_NAME) continue;
    // Relative to the package DIRECTORY, the way its sibling 'file:../../plugin/pkg' link is.
    return `file:${posix.relative(hardhatTemplateV2PackageKey, payloadKey)}`;
  }
  throw new Error(
    `npm-manifest.json#generations names no current generation whose payload publishes ${CLEARTEXT_PAYLOAD_NAME}`,
  );
}

export type JsonObject = Record<string, unknown>;

export function patchHardhatTemplateV2Manifest(
  source: JsonObject,
  workspaceRoot: string,
  npmManifest: NpmManifest,
  log: (message: string) => void = () => undefined,
): JsonObject {
  const manifest = structuredClone(source);
  for (const [field, value] of Object.entries(identityFields(workspaceRoot))) {
    log(`~ ${field.padEnd(33)} ${JSON.stringify(manifest[field])} → ${JSON.stringify(value)}`);
    manifest[field] = value;
  }

  const dependencies = dependencyMap(manifest, 'dependencies');
  const devDependencies = dependencyMap(manifest, 'devDependencies');
  for (const name of removedDependencies) {
    const maps = [dependencies, devDependencies].filter((map) => name in map);
    for (const map of maps) delete map[name];
    log(`${maps.length === 0 ? '·' : '−'} ${name}${maps.length === 0 ? ' (not declared)' : ''}`);
  }
  for (const [target, additions] of [
    [dependencies, pinnedAdditions(npmManifest, addedPinnedDependencies)],
    [
      devDependencies,
      {
        ...addedDevDependencies,
        ...pinnedAdditions(npmManifest, addedPinnedDevDependencies),
        [CLEARTEXT_PAYLOAD_NAME]: cleartextPayloadSpec(npmManifest),
      },
    ],
  ] as const) {
    for (const [name, spec] of Object.entries(additions)) {
      log(`${name in target ? '~' : '+'} ${name.padEnd(33)} ${spec}`);
      target[name] = spec;
    }
  }

  manifest.dependencies = sortKeys(dependencies);
  manifest.devDependencies = sortKeys(devDependencies);
  const scripts = dependencyMap(manifest, 'scripts');
  scripts['check:mirror'] = 'node ../../../fhevm-npm/fhevm-npm.ts check mirror ./hardhat/v2/fhevm-hardhat-template';
  manifest.scripts = sortKeys(scripts);
  return manifest;
}

function dependencyMap(manifest: JsonObject, field: string): Record<string, string> {
  const value = manifest[field];
  if (value === undefined) return {};
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`package.json: "${field}" is not an object`);
  }
  const entries = Object.entries(value);
  if (entries.some(([, item]) => typeof item !== 'string')) {
    throw new Error(`package.json: "${field}" contains a non-string value`);
  }
  return Object.fromEntries(entries) as Record<string, string>;
}

function sortKeys(entries: Readonly<Record<string, string>>): Record<string, string> {
  return Object.fromEntries(Object.entries(entries).sort(([left], [right]) => left.localeCompare(right)));
}
