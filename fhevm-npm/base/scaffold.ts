import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { NpmManifest } from '../manifest.ts';
import { type LoadedPackage, loadPackages } from './npm.ts';
import { renderPackageJson } from './publish-render.ts';
import { loadVersions } from './versions.ts';

export type ScaffoldOptions = {
  readonly workspaceRoot: string;
  readonly manifest: NpmManifest;
  readonly selector: string;
  readonly out: string;
  readonly registry?: string;
  readonly force: boolean;
};

export type ScaffoldResult = {
  readonly packageKey: string;
  readonly out: string;
  readonly fileCount: number;
  readonly replacements: readonly { readonly name: string; readonly from: string; readonly to: string }[];
  readonly npmrc?: string;
};

export function scaffold(options: ScaffoldOptions, listFiles: FileLister = gitTrackedFiles): ScaffoldResult {
  const packages = loadPackages(options.workspaceRoot, options.manifest);
  const pkg = resolveScaffoldPackage(packages, options.selector);

  if (existsSync(options.out) && readdirSync(options.out).length > 0) {
    if (!options.force) throw new Error(`${options.out} exists and is not empty; pass --force to replace it`);
    rmSync(options.out, { recursive: true, force: true });
  }

  // Tracked files only. A working tree carries node_modules, hardhat artifacts, cache and dist, none of
  // which a user cloning this project would have — and listing them by hand would go stale.
  const files = listFiles(pkg.directory);
  if (files.length === 0) throw new Error(`${pkg.key} has no git-tracked files to copy`);
  for (const file of files) {
    const destination = join(options.out, file);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(join(pkg.directory, file), destination);
  }

  // A `file:` link resolves only inside this workspace. Rendered to the target's published range, the
  // copy installs from a registry exactly as a user's would.
  const rendered = renderPackageJson(pkg, packages, loadVersions(options.workspaceRoot), {
    requireNpmDistribution: false,
  });
  writeFileSync(join(options.out, 'package.json'), `${JSON.stringify(rendered.packageJson, null, 2)}\n`);

  let npmrc: string | undefined;
  if (options.registry !== undefined) {
    // Scoped, so only the workspace's own packages come from this registry and everything else still
    // resolves from npmjs. No auth token: installing needs none, and writing a fake one for npmjs
    // would be worse than useless.
    npmrc = `@fhevm:registry=${resolveRegistry(options.registry)}\n`;
    writeFileSync(join(options.out, '.npmrc'), npmrc);
  }

  return {
    packageKey: pkg.key,
    out: options.out,
    fileCount: files.length,
    replacements: rendered.replacements.map(({ name, from, to }) => ({ name, from, to })),
    npmrc,
  };
}

export const NPMJS_REGISTRY = 'https://registry.npmjs.org';

/** `npmjs` names the public registry, so testing against it does not mean typing out the URL. */
export function resolveRegistry(value: string): string {
  return value.toLowerCase() === 'npmjs' ? NPMJS_REGISTRY : value;
}

export type FileLister = (directory: string) => readonly string[];

function gitTrackedFiles(directory: string): readonly string[] {
  const stdout = execFileSync('git', ['ls-files', '-z'], { cwd: directory, encoding: 'utf8' });
  return stdout.split('\0').filter((entry) => entry.length > 0);
}

/** Any manifest package that owns a directory — not just the npm-distributed payloads `publish` accepts. */
export function resolveScaffoldPackage(packages: readonly LoadedPackage[], selector: string): LoadedPackage {
  const key = selector.startsWith('./') ? selector : `./${selector.replace(/^\/+/, '')}`;
  const byKey = packages.find((pkg) => pkg.key === key);
  // A dev owner names its payload, so `./hardhat/v2/fhevm-hardhat-template` reaches the pkg beneath it.
  const published = byKey?.inventory.publishedRelPath;
  const pkg =
    byKey?.packageJson.name !== undefined && published === undefined
      ? byKey
      : packages.find((candidate) => candidate.key === published);
  if (pkg !== undefined) return pkg;

  const candidates = packages
    .filter((candidate) => candidate.packageJson.name !== undefined)
    .map((candidate) => candidate.key)
    .sort();
  throw new Error(`No manifest package matches '${selector}'. Packages: ${candidates.join(', ')}`);
}
