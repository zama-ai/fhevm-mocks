// Rule 6.1.3: an isolated consumer fixture's package-lock.json pins every published payload it reaches at the
// version versions.json declares, resolved to the payload its depender actually names.
//
// The lockfile is what `npm ci` installs, so a stale one silently tests yesterday's package: after the
// Hardhat v3 plugin moved from V(N-1)'s host contracts to V(N)'s, its consumer lock still recorded
// `@fhevm/hardhat-plugin-v3@0.13.0` depending on `host-contracts-cleartext/v13/pkg` — both versions
// correct for the files they named, both files the wrong ones. Hence two assertions per published node:
// the version matches versions.json for the payload the `resolved` path points at, and that path is the
// one the depender's package.json declares.
import { existsSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { registeredConsumers } from '../../manifest.ts';
import type { Violation } from '../diagnostics.ts';
import type { LoadedPackage } from '../npm.ts';
import type { VersionsFile } from '../versions.ts';

export const RULE = '6.1.3';

/** Reads a file, or undefined when it does not exist. Injectable so tests need no disk. */
export type FileReader = (file: string) => string | undefined;

type LockNode = {
  readonly version?: string;
  readonly resolved?: string;
  readonly link?: boolean;
};

type Payload = { readonly key: string; readonly name: string; readonly version: string; readonly directory: string };

function readIfPresent(file: string): string | undefined {
  return existsSync(file) ? readFileSync(file, 'utf8') : undefined;
}

export function validateConsumerLockfiles(
  workspaceRoot: string,
  packages: readonly LoadedPackage[],
  versions: VersionsFile,
  readFile: FileReader = readIfPresent,
): readonly Violation[] {
  const violations: Violation[] = [];
  const payloads = publishedPayloads(packages, versions);
  const payloadByDirectory = new Map(payloads.map((payload) => [payload.directory, payload]));
  const payloadNames = new Set(payloads.map((payload) => payload.name));
  const byKey = new Map(packages.map((pkg) => [pkg.key, pkg]));

  for (const consumerKey of isolatedConsumerKeys(packages)) {
    const consumer = byKey.get(consumerKey);
    if (consumer === undefined) continue;
    const lockfile = join(consumer.directory, 'package-lock.json');
    const text = readFile(lockfile);
    if (text === undefined) continue; // 6.1.1 already reports the missing lock

    const lockKey = `${consumerKey}/package-lock.json`;
    const fix = `regenerate it: fhevm-npm test-consumer-regenerate-package-lock ${consumerKey}`;
    const nodes = lockNodes(text);
    if (nodes === undefined) {
      violations.push({ rule: RULE, packageKey: lockKey, message: `not a lockfileVersion 2 or 3 file — ${fix}` });
      continue;
    }

    // Pass 1: every published node, by the payload its `resolved` path names.
    const resolvedPayloadOf = new Map<string, Payload>(); // lock node key → payload
    for (const [nodeKey, node] of nodes) {
      const name = nodeName(nodeKey);
      if (name === undefined || !payloadNames.has(name)) continue;

      // A workspace link carries no version of its own: `resolved` is a bare path to the node that does.
      if (node.link === true) {
        const target =
          node.resolved === undefined ? undefined : payloadByDirectory.get(resolve(consumer.directory, node.resolved));
        if (target === undefined) continue;
        resolvedPayloadOf.set(nodeKey, target);
        const linked = node.resolved === undefined ? undefined : nodes.get(node.resolved);
        if (linked?.version !== undefined && linked.version !== target.version) {
          violations.push({
            rule: RULE,
            packageKey: lockKey,
            message:
              `${nodeKey} → ${String(node.resolved)}: pins ${name}@${linked.version}, but versions.json says ` +
              `${target.key} is ${target.version} — ${fix}`,
          });
        }
        continue;
      }

      const payload = payloadFor(node, name, consumer.directory, payloads, payloadByDirectory);
      if (payload === undefined) {
        violations.push({
          rule: RULE,
          packageKey: lockKey,
          message:
            `${nodeKey}: resolves ${name} to '${String(node.resolved)}', which is not a published payload of this ` +
            `workspace — ${fix}`,
        });
        continue;
      }
      resolvedPayloadOf.set(nodeKey, payload);
      if (node.version !== payload.version) {
        violations.push({
          rule: RULE,
          packageKey: lockKey,
          message:
            `${nodeKey}: pins ${name}@${String(node.version)}, but versions.json says ${payload.key} is ` +
            `${payload.version} — ${fix}`,
        });
      }
    }

    // Pass 2: every `file:` dependency on a payload — the consumer's own, and those of each payload the
    // lock reached — must resolve in the lock to the directory the depender names.
    const dependers: readonly {
      readonly label: string;
      readonly directory: string;
      readonly text: string | undefined;
    }[] = [
      {
        label: `${consumerKey}/package.json`,
        directory: consumer.directory,
        text: readFile(join(consumer.directory, 'package.json')),
      },
      ...[...new Set(resolvedPayloadOf.values())].map((payload) => ({
        label: `${payload.key}/package.json`,
        directory: payload.directory,
        text: readFile(join(payload.directory, 'package.json')),
      })),
    ];
    for (const depender of dependers) {
      for (const [name, target] of filePayloadDependencies(depender.text, depender.directory, payloadByDirectory)) {
        const candidates = [...nodes].filter(([nodeKey]) => nodeName(nodeKey) === name);
        if (candidates.length === 0) {
          violations.push({
            rule: RULE,
            packageKey: lockKey,
            message: `has no node for ${name}, which ${depender.label} depends on (${target.key}) — ${fix}`,
          });
          continue;
        }
        if (candidates.some(([nodeKey]) => resolvedPayloadOf.get(nodeKey)?.key === target.key)) continue;
        const found = candidates.map(([nodeKey, node]) => `${nodeKey} → '${String(node.resolved)}'`).join(', ');
        violations.push({
          rule: RULE,
          packageKey: lockKey,
          message:
            `resolves ${name} to ${found}, but ${depender.label} depends on ${target.key} ` +
            `('${relative(depender.directory, target.directory)}') — ${fix}`,
        });
      }
    }
  }
  return violations;
}

/**
 * The registered consumers that carry a lock of their own: a member consumer is covered by its installation
 * root's lock (6.1.1), so only an isolated fixture is graded here. Sorted, so a report reads the same each run.
 */
export function isolatedConsumerKeys(packages: readonly LoadedPackage[]): readonly string[] {
  const byKey = new Map(packages.map((pkg) => [pkg.key, pkg]));
  const keys = new Set(
    packages.flatMap((pkg) => registeredConsumers(pkg.inventory).map((registration) => registration.consumerKey)),
  );
  return [...keys].filter((key) => byKey.get(key)?.inventory.member === false).sort();
}

/** Published payloads that versions.json prices, with their absolute directories. */
function publishedPayloads(packages: readonly LoadedPackage[], versions: VersionsFile): readonly Payload[] {
  return packages.flatMap((pkg) => {
    const version = versions.packages[pkg.key];
    const name = pkg.inventory.name;
    if (pkg.inventory.kind !== 'published' || version === undefined || name === undefined) return [];
    return [{ key: pkg.key, name, version, directory: resolve(pkg.directory) }];
  });
}

/** The `packages` map of a lockfileVersion 2 or 3 file, minus the root entry; undefined for any other shape. */
function lockNodes(text: string): ReadonlyMap<string, LockNode> | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return undefined;
  }
  const packages = (parsed as { packages?: unknown }).packages;
  if (typeof packages !== 'object' || packages === null) return undefined;
  return new Map(Object.entries(packages as Record<string, LockNode>).filter(([key]) => key !== ''));
}

/** `node_modules/@scope/name` or `.../node_modules/name` → the package name; anything else → undefined. */
function nodeName(nodeKey: string): string | undefined {
  const match = /(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/@]+)$/.exec(nodeKey);
  return match?.[1];
}

/**
 * The payload a lock node stands for. A `file:` resolution names it outright; a registry resolution is
 * matched by name, and when several payloads share the name (host-contracts-cleartext across generations)
 * by the version that agrees — an ambiguity only a `file:` link can settle, and every consumer here uses one.
 */
function payloadFor(
  node: LockNode,
  name: string,
  consumerDirectory: string,
  payloads: readonly Payload[],
  byDirectory: ReadonlyMap<string, Payload>,
): Payload | undefined {
  if (node.resolved?.startsWith('file:') === true) {
    return byDirectory.get(resolve(consumerDirectory, node.resolved.slice('file:'.length)));
  }
  const named = payloads.filter((payload) => payload.name === name);
  if (named.length === 1) return named[0];
  return named.find((payload) => payload.version === node.version) ?? named[0];
}

/** `file:` dependencies of a package.json that point at a published payload: name → payload. */
function filePayloadDependencies(
  text: string | undefined,
  directory: string,
  byDirectory: ReadonlyMap<string, Payload>,
): ReadonlyMap<string, Payload> {
  const out = new Map<string, Payload>();
  if (text === undefined) return out;
  let parsed: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    return out;
  }
  for (const [name, spec] of Object.entries({ ...parsed.dependencies, ...parsed.devDependencies })) {
    if (!spec.startsWith('file:')) continue;
    const payload = byDirectory.get(resolve(directory, spec.slice('file:'.length)));
    if (payload !== undefined) out.set(name, payload);
  }
  return out;
}
