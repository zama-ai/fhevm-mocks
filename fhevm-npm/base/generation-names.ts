// Generation names, and the protocol version each one stands for. A generation is `major.minor`: 1.0 and 1.1 are
// different generations, and a patch release stays in its generation.
//
//   v<N>              legacy, below 1.0: `v13` is 0.13, `v14` is 0.14
//   v<major>.<minor>  from 1.0 on: `v1.0` is 1.0, `v1.1` is 1.1
//
// The release branch a generation owns is `release/<major>.<minor>.x`, and generations order by version, so
// v13 < v14 < v1.0 < v1.1. 0.15 is a ZOMBIE: it will never be released (the generation after 0.14 ships as 1.0),
// so no branch is ever derived for it, and nothing may target `release/0.15.x`. A `v15` name is still read, for as
// long as a directory carries it, but it owns no branch.
//
// One place, so every tool agrees: generation-parity (the branch), generations (face file names),
// generate-cleartext-config (the keys a config may name) and deployments (record names and versions).

export type GenerationVersion = { readonly major: number; readonly minor: number };

/** The generations that will never be released, as `major.minor`: no branch is derived for them. */
export const NEVER_RELEASED_GENERATIONS: readonly string[] = ['0.15'];

/** The last generation below 1.0, the one 1.0 follows. */
const LAST_LEGACY_MINOR = 14;

/** A generation name, as a regular-expression source: `v13`, `v1.0`. No anchors, so it can be embedded. */
export const GENERATION_NAME_SOURCE = String.raw`v(?:0|[1-9]\d*)(?:\.(?:0|[1-9]\d*))?`;

const LEGACY = /^v(0|[1-9]\d*)$/;
const MAJOR_MINOR = /^v([1-9]\d*)\.(0|[1-9]\d*)$/;

/** `v13` → 0.13, `v1.0` → 1.0; undefined for anything else, including `v0.15` (below 1.0 the name is `v15`). */
export function parseGenerationName(name: string): GenerationVersion | undefined {
  const legacy = LEGACY.exec(name);
  if (legacy !== null) return { major: 0, minor: Number(legacy[1]) };
  const current = MAJOR_MINOR.exec(name);
  if (current !== null) return { major: Number(current[1]), minor: Number(current[2]) };
  return undefined;
}

export function isGenerationName(name: string): boolean {
  return parseGenerationName(name) !== undefined;
}

/** 0.13 → `v13`, 1.0 → `v1.0`: the inverse of parseGenerationName. */
export function generationName(version: GenerationVersion): string {
  return version.major === 0 ? `v${version.minor}` : `v${version.major}.${version.minor}`;
}

/** `0.13`, `1.0`: the version a generation stands for, as the `version` of a deployment record writes it. */
export function generationVersionLabel(version: GenerationVersion): string {
  return `${version.major}.${version.minor}`;
}

/** `0.13` / `1.0` → the generation; undefined for anything else. */
export function parseGenerationVersion(label: string): GenerationVersion | undefined {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(label);
  return match === null ? undefined : { major: Number(match[1]), minor: Number(match[2]) };
}

export function isNeverReleased(version: GenerationVersion): boolean {
  return NEVER_RELEASED_GENERATIONS.includes(generationVersionLabel(version));
}

/** Negative, zero or positive as `a` is older than, the same as or newer than `b`. */
export function compareGenerations(a: GenerationVersion, b: GenerationVersion): number {
  return a.major !== b.major ? a.major - b.major : a.minor - b.minor;
}

export function sameGeneration(a: GenerationVersion, b: GenerationVersion): boolean {
  return compareGenerations(a, b) === 0;
}

/**
 * The generations that may come right after this one: the next minor, and from 1.0 on the next major too. 0.14 is
 * followed by 1.0, not by the zombie 0.15.
 */
export function nextGenerations(version: GenerationVersion): readonly GenerationVersion[] {
  if (version.major === 0) {
    if (version.minor >= LAST_LEGACY_MINOR) return [{ major: 1, minor: 0 }];
    return [{ major: 0, minor: version.minor + 1 }];
  }
  return [
    { major: version.major, minor: version.minor + 1 },
    { major: version.major + 1, minor: 0 },
  ];
}

/** `v13` → `release/0.13.x`, `v1.0` → `release/1.0.x`; undefined for a name that is not one, or never released. */
export function releaseBranchOf(name: string): string | undefined {
  const version = parseGenerationName(name);
  if (version === undefined || isNeverReleased(version)) return undefined;
  return `release/${generationVersionLabel(version)}.x`;
}

/**
 * The generation name an environment variable suffix spells. A dot cannot be in a variable name, so `V1_0` spells
 * `v1.0`, and `V13` spells `v13`.
 */
export function generationNameFromEnvSuffix(suffix: string): string {
  return suffix.toLowerCase().replaceAll('_', '.');
}
