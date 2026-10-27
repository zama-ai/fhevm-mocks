// Tarball pins: an npm-manifest.json#dependencies.pinned entry whose spec is `file:<path>.tgz` (rule 3.3.4).
//
// A pin normally names a registry version. A tarball pin names a package that is not published yet — a release
// candidate built elsewhere — so the workspace can be developed and tested against it before it reaches npm. The
// manifest is the only place its path is written: the path is absolute, or relative to the workspace root, and
// moving the tarball is one edit of the pin followed by `fhevm-npm sync pinned` and a reinstall.
//
// Nothing here names a package. Any pin of that shape is a tarball pin, and what each declaration must carry is
// derived from it:
//   - a peer dependency gets a range on the tarball's own version (`~1.0.0-0`): a peer is resolved by whoever
//     installs the package, so it must stay a range a published package can carry;
//   - every other field gets a `file:` spec relative to the declaring package, since npm resolves a `file:` spec
//     from the package.json that holds it, so one verbatim string cannot be right at every depth.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';

import type { DependencyField } from './npm.ts';

const TARBALL_PIN = /^file:(.+\.tgz)$/;

/** Is this pin a tarball pin: `file:<path>.tgz`? */
export function isTarballPin(pin: string): boolean {
  return TARBALL_PIN.test(pin);
}

/** A `file:` spec on a `.tgz`, wherever it is declared: what only a tarball pin may produce. */
export function isTarballSpec(spec: string): boolean {
  return TARBALL_PIN.test(spec);
}

/** The tarball a pin names, as an absolute path: the pin's path is absolute or relative to the workspace root. */
export function tarballPinPath(workspaceRoot: string, pin: string): string {
  const path = TARBALL_PIN.exec(pin)?.[1];
  if (path === undefined) throw new Error(`not a tarball pin: "${pin}"`);
  return isAbsolute(path) ? path : resolve(workspaceRoot, path);
}

/** The tarball a `file:` spec names, from the directory of the package.json that holds it. */
export function tarballSpecPath(directory: string, spec: string): string {
  const path = TARBALL_PIN.exec(spec)?.[1];
  if (path === undefined) throw new Error(`not a tarball spec: "${spec}"`);
  return isAbsolute(path) ? path : resolve(directory, path);
}

/** Reads the `version` an npm tarball declares in its `package/package.json`. */
export type TarballVersionReader = (tarball: string) => string;

const versions = new Map<string, string>();

/** `tar` rather than a parser: every platform the workspace runs on has it, and the tarball is npm's own format. */
export const readTarballVersion: TarballVersionReader = (tarball) => {
  const cached = versions.get(tarball);
  if (cached !== undefined) return cached;
  if (!existsSync(tarball)) throw new Error(`tarball pin: ${tarball} does not exist`);
  const text = execFileSync('tar', ['-xOzf', tarball, 'package/package.json'], { encoding: 'utf8' });
  const version = (JSON.parse(text) as { version?: unknown }).version;
  if (typeof version !== 'string') throw new Error(`tarball pin: ${tarball} declares no version`);
  versions.set(tarball, version);
  return version;
};

/**
 * The spec a declaration of a pinned package must carry, from the package.json in `directory`. A version pin is
 * repeated verbatim; a tarball pin becomes a range on its version for a peer, and a relative `file:` spec otherwise.
 */
export function expectedPinnedSpec(parameters: {
  readonly workspaceRoot: string;
  readonly pin: string;
  readonly directory: string;
  readonly field: DependencyField;
  readonly readVersion?: TarballVersionReader;
}): string {
  const { workspaceRoot, pin, directory, field } = parameters;
  if (!isTarballPin(pin)) return pin;
  const tarball = tarballPinPath(workspaceRoot, pin);
  if (field === 'peerDependencies') return `~${(parameters.readVersion ?? readTarballVersion)(tarball)}`;
  const path = relative(directory, tarball).split(sep).join('/');
  return `file:${path.startsWith('.') ? path : `./${path}`}`;
}
