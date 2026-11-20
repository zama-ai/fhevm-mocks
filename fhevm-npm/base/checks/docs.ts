import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, sep } from 'node:path';

import type { NpmManifest } from '../../manifest.ts';
import type { Violation } from '../diagnostics.ts';
import { DOCS_DIRECTORY } from '../paths.ts';

/** The folder every docs folder holds. */
export const DOCS_SKILLS_DIRECTORY = 'skills';

const PROBE = join(import.meta.dirname, 'docs-tool-probe.ts');
const SCAN_EXCLUSIONS = new Set(['.git', 'node_modules', 'dependencies', 'out', 'cache', 'broadcast', 'tarballs']);

export type ToolReads = { readonly file: string; readonly prettier: boolean; readonly eslint: boolean };

/** What the check asks of the outside world, injectable so the tests need neither git, Prettier nor ESLint. */
export type DocsTools = {
  /** Every folder named `docs`, relative to the workspace root, written with `/`. */
  readonly findDocsFolders: (workspaceRoot: string) => readonly string[];
  /** Every file under `docsFolder`, relative to `packageFolder`. */
  readonly listFiles: (workspaceRoot: string, packageFolder: string, docsFolder: string) => readonly string[];
  readonly isDirectory: (path: string) => boolean;
  readonly gitIgnores: (workspaceRoot: string, path: string) => boolean;
  /** Whether Prettier and ESLint, run from `packageFolder`, read each file. */
  readonly toolReads: (packageFolder: string, files: readonly string[]) => readonly ToolReads[];
};

export type DocsInspection = {
  readonly checkedPaths: readonly string[];
  readonly violations: readonly Violation[];
};

export function inspectDocs(
  workspaceRoot: string,
  manifest: NpmManifest,
  tools: DocsTools = defaultTools,
): DocsInspection {
  const packageFolders = publishedPackageFolders(manifest);
  const checkedPaths: string[] = [];
  const violations: Violation[] = [];
  const fail = (path: string, message: string): void => {
    violations.push({ rule: 'R-09', packageKey: `./${path}`, message });
  };

  for (const docsFolder of tools.findDocsFolders(workspaceRoot)) {
    checkedPaths.push(docsFolder);
    const packageFolder = dirname(docsFolder);
    if (!packageFolders.has(packageFolder)) {
      fail(
        docsFolder,
        `a docs folder lives only at the root of a package, next to its published pkg/ (${[...packageFolders].sort().join(', ')})`,
      );
      continue;
    }
    if (!tools.isDirectory(join(workspaceRoot, docsFolder, DOCS_SKILLS_DIRECTORY))) {
      fail(docsFolder, `it has no ${DOCS_SKILLS_DIRECTORY}/ folder`);
    }
    if (tools.gitIgnores(workspaceRoot, docsFolder)) {
      fail(docsFolder, 'git ignores it, and a docs folder is committed');
    }
    const files = tools.listFiles(workspaceRoot, packageFolder, docsFolder);
    if (files.length === 0) continue;
    for (const reads of tools.toolReads(join(workspaceRoot, packageFolder), files)) {
      if (reads.prettier)
        fail(`${packageFolder}/${reads.file}`, 'Prettier reads it: add docs/ to the .prettierignore of the package');
      if (reads.eslint)
        fail(`${packageFolder}/${reads.file}`, 'ESLint reads it: docs/** must stay in the ignores of eslint.base.mjs');
    }
  }
  return { checkedPaths, violations };
}

/** The folders that hold a published `pkg/`, as `hardhat/v3/plugin`. */
function publishedPackageFolders(manifest: NpmManifest): ReadonlySet<string> {
  const folders = new Set<string>();
  for (const [key, entry] of Object.entries(manifest.packages)) {
    if (entry.kind !== 'published') continue;
    const path = key.replace(/^\.\//, '');
    folders.add(basename(path) === 'pkg' ? dirname(path) : path);
  }
  return folders;
}

const defaultTools: DocsTools = {
  findDocsFolders(workspaceRoot) {
    const found: string[] = [];
    const walk = (folder: string): void => {
      for (const entry of readdirSync(folder, { withFileTypes: true })) {
        if (!entry.isDirectory() || SCAN_EXCLUSIONS.has(entry.name)) continue;
        const path = join(folder, entry.name);
        if (entry.name === DOCS_DIRECTORY) found.push(relative(workspaceRoot, path).split(sep).join('/'));
        else walk(path);
      }
    };
    walk(workspaceRoot);
    return found.sort();
  },
  listFiles(workspaceRoot, packageFolder, docsFolder) {
    const files: string[] = [];
    const walk = (folder: string): void => {
      for (const entry of readdirSync(folder, { withFileTypes: true })) {
        const path = join(folder, entry.name);
        if (entry.isDirectory()) walk(path);
        else files.push(relative(join(workspaceRoot, packageFolder), path).split(sep).join('/'));
      }
    };
    walk(join(workspaceRoot, docsFolder));
    return files.sort();
  },
  isDirectory(path) {
    return existsSync(path) && statSync(path).isDirectory();
  },
  gitIgnores(workspaceRoot, path) {
    try {
      execFileSync('git', ['-C', workspaceRoot, 'check-ignore', '-q', path], { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  },
  toolReads(packageFolder, files) {
    const run = spawnSync(process.execPath, [PROBE, ...files], { cwd: packageFolder, encoding: 'utf8' });
    if (run.status !== 0) {
      throw new Error(`check docs: the Prettier and ESLint probe failed in ${packageFolder}: ${run.stderr.trim()}`);
    }
    return JSON.parse(run.stdout) as ToolReads[];
  },
};
