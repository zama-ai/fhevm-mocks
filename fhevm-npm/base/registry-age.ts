// What safe-chain asks of the registry, answered here so the tree can be checked and moved the same way: when was
// each version published, and which version of a `^`/`~` range would npm pick if nothing younger than a cutoff
// existed. safe-chain refuses any version younger than its minimum package age (48 hours by default); a version
// both commands accept is therefore one safe-chain lets through.

import { compareVersions, isPrerelease, parseVersion, type ParsedVersion } from './semver.ts';

const NPMJS_REGISTRY = 'https://registry.npmjs.org';

/** What the commands read from a full packument: publish times, deprecations and the `latest` tag. */
export type Packument = {
  readonly name: string;
  /** Version -> ISO publish time. */
  readonly time: Readonly<Record<string, string>>;
  readonly versions: readonly string[];
  readonly deprecated: ReadonlySet<string>;
  readonly latest?: string;
};

/** Fetches one packument, or undefined when the registry has never seen the name. Injected by tests. */
export type PackumentFetch = (name: string) => Promise<Packument | undefined>;

export function hoursAgo(hours: number, now: Date = new Date()): Date {
  return new Date(now.getTime() - hours * 3_600_000);
}

export function ageInHours(publishedAt: string, now: Date = new Date()): number {
  return (now.getTime() - Date.parse(publishedAt)) / 3_600_000;
}

/** The full packument: the abbreviated one npm installs from carries no publish time. */
export const fetchPackument: PackumentFetch = async (name) => {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(`${NPMJS_REGISTRY}/${encodeURIComponent(name).replace(/^%40/, '@')}`, {
        signal: AbortSignal.timeout(60_000),
      });
      if (response.status === 404) return undefined;
      if (response.status !== 200) throw new Error(`HTTP ${String(response.status)}`);
      return toPackument(name, (await response.json()) as unknown);
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`registry.npmjs.org: cannot read '${name}': ${errorMessage(lastError)}`);
};

/** Keeps only what the commands need, so a 15 MB packument is not held whole. */
export function toPackument(name: string, body: unknown): Packument {
  const record = (value: unknown): Record<string, unknown> =>
    typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  const time = Object.fromEntries(
    Object.entries(record(record(body).time)).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
  const versions = record(record(body).versions);
  const deprecated = new Set(
    Object.entries(versions).flatMap(([version, meta]) =>
      typeof record(meta).deprecated === 'string' ? [version] : [],
    ),
  );
  const latest = record(record(body)['dist-tags']).latest;
  return {
    name,
    time,
    versions: Object.keys(versions),
    deprecated,
    ...(typeof latest === 'string' ? { latest } : {}),
  };
}

/** Fetches every name once, at most `concurrency` at a time. A failed fetch rejects the whole batch. */
export async function fetchPackuments(
  names: Iterable<string>,
  fetchOne: PackumentFetch,
  concurrency = 16,
): Promise<ReadonlyMap<string, Packument | undefined>> {
  const queue = [...new Set(names)].sort();
  const result = new Map<string, Packument | undefined>();
  const worker = async (): Promise<void> => {
    for (let name = queue.shift(); name !== undefined; name = queue.shift()) result.set(name, await fetchOne(name));
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));
  return result;
}

/** A `^x.y.z` or `~x.y.z` spec: the only kind `update dependencies` moves. */
export type FloorRange = { readonly operator: '^' | '~'; readonly floor: ParsedVersion; readonly text: string };

export function parseFloorRange(spec: string): FloorRange | undefined {
  const match = /^([\^~])(\d+\.\d+\.\d+)$/.exec(spec);
  if (match === null) return undefined;
  const floor = parseVersion(match[2] ?? '');
  return floor === undefined ? undefined : { operator: match[1] as '^' | '~', floor, text: match[2] ?? '' };
}

/** npm's `^`/`~` semantics: `^1.2.3` <2, `^0.2.3` <0.3, `^0.0.3` <0.0.4, `~1.2.3` <1.3. No prerelease. */
export function satisfiesFloorRange(candidate: ParsedVersion, range: FloorRange): boolean {
  if (isPrerelease(candidate) || compareVersions(candidate, range.floor) < 0) return false;
  const { floor } = range;
  if (range.operator === '~') return candidate.major === floor.major && candidate.minor === floor.minor;
  if (floor.major > 0) return candidate.major === floor.major;
  if (floor.minor > 0) return candidate.major === 0 && candidate.minor === floor.minor;
  return candidate.major === 0 && candidate.minor === 0 && candidate.patch === floor.patch;
}

/**
 * The version `npm install --before=<cutoff>` would resolve for the range: the `latest` tag when it is in range and
 * old enough, else the newest version that is. Deprecated versions are passed over while any other is left, and
 * only then considered, as npm does (a whole deprecated line, eslint 9 say, still installs). Undefined when no
 * version in range is older than the cutoff.
 */
export function pickBefore(packument: Packument, range: FloorRange, cutoff: Date): string | undefined {
  const inRange = packument.versions.filter((version) => {
    const parsed = parseVersion(version);
    const publishedAt = packument.time[version];
    return (
      parsed !== undefined &&
      satisfiesFloorRange(parsed, range) &&
      publishedAt !== undefined &&
      Date.parse(publishedAt) <= cutoff.getTime()
    );
  });
  const supported = inRange.filter((version) => !packument.deprecated.has(version));
  const eligible = supported.length > 0 ? supported : inRange;
  if (packument.latest !== undefined && eligible.includes(packument.latest)) return packument.latest;
  return eligible
    .map((version) => ({ version, parsed: parseVersion(version) as ParsedVersion }))
    .sort((left, right) => compareVersions(right.parsed, left.parsed))[0]?.version;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
