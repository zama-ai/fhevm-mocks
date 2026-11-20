import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { join, posix, relative, resolve } from 'node:path';

import type { CommandReport, Violation } from '../base/diagnostics.ts';
import { isInDocsFolder } from '../base/paths.ts';

/** One issue of `mlc --format json`. */
export type MlcIssue = {
  readonly severity: string;
  readonly source: string;
  readonly line: number;
  readonly column: number;
  readonly target: string;
  readonly message: string;
};

/** What the check needs from the outside world, injectable so the tests need neither git nor mlc. */
export type MdLinksTools = {
  /** The repository's .md files, relative to the root, without the ones git ignores. */
  readonly listMarkdownFiles: (workspaceRoot: string) => readonly string[];
  /** The folders of the previous generations, as `host-contracts-cleartext/<vN-1>`; none without a manifest. */
  readonly previousGenerations: (workspaceRoot: string) => readonly string[];
  /** The folders of the vendored copies, as `hardhat/v2/plugin/pkg/src/internal/vendored`; none without a manifest. */
  readonly vendoredFolders: (workspaceRoot: string) => readonly string[];
  /** `undefined` when mlc is not on PATH; otherwise the issues it reported for these files. */
  readonly runMlc: (
    workspaceRoot: string,
    files: readonly string[],
    options: { readonly offline: boolean },
  ) => readonly MlcIssue[] | undefined;
};

// Manifest-free: it reads every .md file git does not ignore, and needs the external `mlc` binary
// (https://github.com/becheran/mlc). Without mlc the check is skipped with a warning, never failed.
export function checkMdLinks(options: {
  readonly workspaceRoot: string;
  readonly offline?: boolean;
  readonly tools?: MdLinksTools;
}): CommandReport {
  const tools = options.tools ?? realMdLinksTools;
  const offline = options.offline ?? false;
  const command = offline ? 'check md-links --offline' : 'check md-links';
  // Frozen folders are not checked here: the previous generation is fixed on its release branch (R-04), and
  // a vendored copy at its source, then synced (R-07). A file in both counts once, for the first.
  const frozen = [
    ...tools.previousGenerations(options.workspaceRoot).map((folder) => ({
      folder,
      why: 'of the previous generation (R-04)',
    })),
    ...tools.vendoredFolders(options.workspaceRoot).map((folder) => ({
      folder,
      why: 'of a vendored copy (R-07)',
    })),
  ];
  const frozenIn = (file: string) => frozen.find(({ folder }) => file.startsWith(`${folder}/`));
  const all = tools.listMarkdownFiles(options.workspaceRoot);
  // No tool of the workspace reads a docs folder (R-09).
  const inDocs = all.filter((file) => isInDocsFolder(file));
  const listed = all.filter((file) => frozenIn(file) === undefined && !isInDocsFolder(file));
  // Leaving a frozen folder out is the rule, not a finding: it goes to `skipped`, never to `notes`.
  const skipped = frozen
    .map((entry) => [entry, all.filter((file) => frozenIn(file) === entry).length] as const)
    .filter(([, count]) => count > 0)
    .map(([{ folder, why }, count]) => `${folder}: ${count} markdown file(s) ${why}`);
  if (inDocs.length > 0) skipped.push(`docs folders: ${inDocs.length} markdown file(s) that no tool reads (R-09)`);
  // mlc takes a comma-separated list, so a file whose name holds a comma cannot be passed to it.
  const files = listed.filter((file) => !file.includes(','));
  const notes: string[] = [];
  notes.push(
    ...listed
      .filter((file) => file.includes(','))
      .map((file) => `${file}: not checked, mlc cannot take a file name that contains a comma`),
  );

  const issues = files.length === 0 ? [] : tools.runMlc(options.workspaceRoot, files, { offline });
  if (issues === undefined) {
    return {
      command,
      checkedPackageKeys: [],
      checkedItemLabel: 'markdown file(s)',
      notes: ['mlc is not on PATH: markdown links were NOT checked (install it with `cargo install mlc`)'],
      violations: [],
    };
  }

  // Only errors fail: mlc's warnings are mostly bracketed text it mistakes for reference links
  // (`[!NOTE]`, `[GAP]`, …), which are not links at all.
  const violations: Violation[] = issues
    .filter((issue) => issue.severity === 'error')
    .map((issue) => ({
      rule: 'R-07',
      packageKey: relativeSource(options.workspaceRoot, issue.source),
      message: `${issue.line}:${issue.column} ${issue.target}: ${issue.message}`,
    }));
  return {
    command,
    checkedPackageKeys: files,
    checkedItemLabel: 'markdown file(s)',
    ...(notes.length === 0 ? {} : { notes }),
    ...(skipped.length === 0 ? {} : { skipped }),
    violations,
  };
}

type RawManifest = {
  readonly generations?: Readonly<Record<string, { readonly previous?: string }>>;
  readonly packages?: Readonly<Record<string, { readonly vendored?: readonly { readonly relPath: string }[] }>>;
};

/** npm-manifest.json, read raw, not through loadNpmManifest: this check runs before, and without, its checks. */
function readRawManifest(workspaceRoot: string): RawManifest {
  const manifestFile = join(workspaceRoot, 'npm-manifest.json');
  return existsSync(manifestFile) ? (JSON.parse(readFileSync(manifestFile, 'utf8')) as RawManifest) : {};
}

/** A folder as git lists it: `./a/b/` becomes `a/b`. */
function folderKey(folder: string): string {
  return folder.replace(/^\.\//, '').replace(/\/$/, '');
}

function relativeSource(workspaceRoot: string, source: string): string {
  // mlc prints the canonical absolute path of each file, so a root reached through a symlink (macOS's
  // /var -> /private/var, for one) must be canonicalised before the path is made relative to it.
  const absolute = resolve(workspaceRoot, source);
  const plain = relative(workspaceRoot, absolute);
  if (!plain.startsWith('..') || !existsSync(workspaceRoot)) return plain;
  return relative(realpathSync(workspaceRoot), absolute);
}

export const realMdLinksTools: MdLinksTools = {
  previousGenerations(workspaceRoot) {
    return Object.values(readRawManifest(workspaceRoot).generations ?? {})
      .map((family) => family.previous)
      .filter((folder): folder is string => typeof folder === 'string')
      .map(folderKey)
      .sort();
  },
  vendoredFolders(workspaceRoot) {
    return Object.entries(readRawManifest(workspaceRoot).packages ?? {})
      .flatMap(([packageKey, entry]) => (entry.vendored ?? []).map((copy) => `${packageKey}/${copy.relPath}`))
      .map((folder) => folderKey(posix.normalize(folder)))
      .sort();
  },
  listMarkdownFiles(workspaceRoot) {
    // Tracked files plus untracked ones git does not ignore. A tracked file deleted from the working
    // tree is still listed by --cached, hence the existence filter.
    const result = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', '*.md'], {
      cwd: workspaceRoot,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    if (result.error !== undefined) throw result.error;
    if (result.status !== 0) throw new Error(`git ls-files failed in ${workspaceRoot}: ${result.stderr.trim()}`);
    return [...new Set(result.stdout.split('\0').filter((file) => file !== ''))]
      .filter((file) => existsSync(join(workspaceRoot, file)))
      .sort();
  },
  runMlc(workspaceRoot, files, { offline }) {
    const args = ['--quiet', '--format', 'json', ...(offline ? ['--offline'] : []), '--files', files.join(','), '.'];
    const result = spawnSync('mlc', args, { cwd: workspaceRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if ((result.error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT') return undefined;
    if (result.error !== undefined) throw result.error;
    // mlc exits 1 when it found an error, so the status alone says nothing; the JSON document is the answer.
    let parsed: { readonly issues?: readonly MlcIssue[] };
    try {
      parsed = JSON.parse(result.stdout) as { readonly issues?: readonly MlcIssue[] };
    } catch {
      throw new Error(
        `mlc printed no JSON report (exit ${result.status}): ${result.stderr.trim() || result.stdout.trim()}`,
      );
    }
    if (!Array.isArray(parsed.issues)) throw new Error('mlc JSON report has no issues array');
    return parsed.issues;
  },
};
