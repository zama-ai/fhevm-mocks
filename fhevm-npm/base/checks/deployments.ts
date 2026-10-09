// Deployment records: `deployments/<chain>/<deploymentId>/`, one folder per on-chain event (a deploy, an
// upgrade), copied from the operator's deployment folder once the event is final. A record is evidence of
// transactions that cannot be undone, so it is frozen: editing it can only make it disagree with the chain.
// A later event (an upgrade to the next generation, an ownership change) gets a NEW folder.
//
// Two checks, because only one of them needs git history:
//   consistency  every record folder is complete and agrees with itself and with fhevm-chains.config.json,
//                and holds none of the forge scratch the deploy tool writes when run inside it.
//   frozen       against a base ref: no record folder that exists at the base may change in any way.
//                Files outside record folders (deployments/README.md, a per-chain README) stay editable.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

import { CHAINS_CONFIG_FILE } from '../fhevm-chains.ts';
import type { Violation } from '../diagnostics.ts';

export const DEPLOYMENTS_DIR = 'deployments';
export const RECORD_CONFIG_FILE = 'deploy.config.json';
export const RECORD_TOOL_COMMIT_FILE = 'tool-commit.txt';
/** What the deploy tool leaves in its out dir and a record must keep. */
export const RECORD_SEAL_FILES = ['manifest.json', 'addresses.sol', 'journal.jsonl'] as const;
/** What the deploy tool writes into its out dir as scratch. Present in a record = the tool ran inside it. */
export const RECORD_SCRATCH = ['build', 'broadcast', 'cache', '.foundry', 'pass2.json'] as const;

const RULE = 'deployments';
const COMMIT = /^[0-9a-f]{40}$/;

export type DeploymentsInspection = {
  readonly checkedRecordKeys: readonly string[];
  readonly violations: readonly Violation[];
};

/** Repo-relative-looking keys for one record folder, as `./deployments/<chain>/<id>`. */
const recordKey = (chain: string, id: string): string => `./${DEPLOYMENTS_DIR}/${chain}/${id}`;

const isDirectory = (path: string): boolean => existsSync(path) && statSync(path).isDirectory();

/** Every `<chain>/<id>` directory under deployments/, sorted. Files at the two upper levels are not records. */
export function listRecordFolders(workspaceRoot: string): readonly { readonly chain: string; readonly id: string }[] {
  const root = join(workspaceRoot, DEPLOYMENTS_DIR);
  if (!isDirectory(root)) return [];
  const records: { chain: string; id: string }[] = [];
  for (const chain of readdirSync(root).sort()) {
    if (!isDirectory(join(root, chain))) continue;
    for (const id of readdirSync(join(root, chain)).sort()) {
      if (isDirectory(join(root, chain, id))) records.push({ chain, id });
    }
  }
  return records;
}

/**
 * Host chain name -> chain id, across every network group of fhevm-chains.config.json (`networks.<group>.
 * hosts.<name>.id`). Only the names and ids are read: the file's own check validates the rest, and a host
 * chain recurs across groups with the same id (Sepolia is served by the testnet and the devnet gateway).
 */
export function knownHostChains(workspaceRoot: string): ReadonlyMap<string, number> {
  const path = join(workspaceRoot, CHAINS_CONFIG_FILE);
  const chains = new Map<string, number>();
  if (!existsSync(path)) return chains;
  const config = JSON.parse(readFileSync(path, 'utf8')) as {
    readonly networks?: Readonly<
      Record<string, { readonly hosts?: Readonly<Record<string, { readonly id?: number }>> }>
    >;
  };
  for (const group of Object.values(config.networks ?? {})) {
    for (const [name, host] of Object.entries(group.hosts ?? {})) {
      if (typeof host.id === 'number') chains.set(name, host.id);
    }
  }
  return chains;
}

function readJsonObject(path: string): Record<string, unknown> | string {
  try {
    const value = JSON.parse(readFileSync(path, 'utf8')) as unknown;
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return 'is not a JSON object';
    return value as Record<string, unknown>;
  } catch (error) {
    return `is not valid JSON (${(error as Error).message})`;
  }
}

/** Consistency of every record folder on disk. Needs no git. */
export function inspectDeploymentRecords(workspaceRoot: string): DeploymentsInspection {
  const violations: Violation[] = [];
  const records = listRecordFolders(workspaceRoot);
  const chains = knownHostChains(workspaceRoot);

  for (const { chain, id } of records) {
    const key = recordKey(chain, id);
    const dir = join(workspaceRoot, DEPLOYMENTS_DIR, chain, id);
    const fail = (message: string): void => {
      violations.push({ rule: RULE, packageKey: key, message });
    };

    if (existsSync(join(dir, '.git'))) {
      fail('holds a .git folder: a nested repository is committed as a bare pointer, without its files');
    }

    // The tool commit: the first line, a full sha. Comment lines below it are allowed.
    const toolCommitPath = join(dir, RECORD_TOOL_COMMIT_FILE);
    if (!existsSync(toolCommitPath)) {
      fail(`missing ${RECORD_TOOL_COMMIT_FILE} (the commit of the deploy tool that computed the seal)`);
    } else {
      const first = readFileSync(toolCommitPath, 'utf8').split('\n')[0]?.trim() ?? '';
      if (!COMMIT.test(first))
        fail(`${RECORD_TOOL_COMMIT_FILE}: the first line must be a full 40-hex commit, found '${first}'`);
    }

    const config = existsSync(join(dir, RECORD_CONFIG_FILE))
      ? readJsonObject(join(dir, RECORD_CONFIG_FILE))
      : `is missing`;
    if (typeof config === 'string') {
      fail(`${RECORD_CONFIG_FILE} ${config}`);
      continue;
    }
    if (config['deploymentId'] !== id) {
      fail(`${RECORD_CONFIG_FILE}: deploymentId is '${String(config['deploymentId'])}', the folder is named '${id}'`);
    }

    // The out dir, as the deploy tool resolves it: relative to the config file. It must stay inside the record.
    const outDir = config['outDir'];
    if (typeof outDir !== 'string' || outDir === '' || isAbsolute(outDir)) {
      fail(`${RECORD_CONFIG_FILE}: outDir must be a relative path inside the record, found ${JSON.stringify(outDir)}`);
      continue;
    }
    const out = resolve(dir, outDir);
    const outRelative = relative(dir, out);
    if (outRelative === '' || outRelative.startsWith('..') || isAbsolute(outRelative)) {
      fail(`${RECORD_CONFIG_FILE}: outDir '${outDir}' leaves the record folder`);
      continue;
    }
    if (!isDirectory(out)) {
      fail(`${RECORD_CONFIG_FILE}: outDir '${outDir}' does not exist`);
      continue;
    }
    for (const file of RECORD_SEAL_FILES) {
      if (!existsSync(join(out, file))) fail(`missing ${outRelative.split(sep).join('/')}/${file}`);
    }
    for (const scratch of RECORD_SCRATCH) {
      if (existsSync(join(out, scratch))) {
        fail(
          `${outRelative.split(sep).join('/')}/${scratch} is forge scratch: the deploy tool was run inside the record. ` +
            'Delete it, and run the tool from a copy of the folder instead',
        );
      }
    }

    const manifestPath = join(out, 'manifest.json');
    if (!existsSync(manifestPath)) continue;
    const manifest = readJsonObject(manifestPath);
    if (typeof manifest === 'string') {
      fail(`manifest.json ${manifest}`);
      continue;
    }
    if (manifest['deploymentId'] !== id) {
      fail(`manifest.json: deploymentId is '${String(manifest['deploymentId'])}', the folder is named '${id}'`);
    }
    const admin = config['admin'];
    if (
      typeof admin === 'string' &&
      (typeof manifest['admin'] !== 'string' || manifest['admin'].toLowerCase() !== admin.toLowerCase())
    ) {
      fail(`${RECORD_CONFIG_FILE}: admin ${admin} differs from the sealed admin ${String(manifest['admin'])}`);
    }

    // The chain folder names a host chain of fhevm-chains.config.json, and the seal was made on that chain.
    const expectedChainId = chains.get(chain);
    if (expectedChainId === undefined) {
      fail(
        `the chain folder '${chain}' is not a host chain of ${CHAINS_CONFIG_FILE}` +
          (chains.size > 0 ? ` (known: ${[...chains.keys()].sort().join(', ')})` : ''),
      );
    } else if (manifest['chainId'] !== expectedChainId) {
      fail(`manifest.json: chainId is ${String(manifest['chainId'])}, but '${chain}' is chain ${expectedChainId}`);
    }
  }

  return { checkedRecordKeys: records.map(({ chain, id }) => recordKey(chain, id)), violations };
}

/** Git, from the workspace root; injectable so tests can drive it without a network. */
export type DeploymentsGit = {
  /** The commit both sides share, or a thrown error when `base` cannot be resolved. */
  readonly mergeBase: (base: string) => string;
  /** Every file under deployments/ at `revision`, workspace-relative. */
  readonly filesAt: (revision: string) => readonly string[];
  /** `<status>\t<path>` for every file under deployments/ that differs between `revision` and the worktree. */
  readonly changesSince: (revision: string) => readonly { readonly status: string; readonly path: string }[];
};

export function realDeploymentsGit(workspaceRoot: string): DeploymentsGit {
  const git = (args: readonly string[]): string =>
    execFileSync('git', [...args], { cwd: workspaceRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return {
    mergeBase: (base) => git(['merge-base', base, 'HEAD']).trim(),
    filesAt: (revision) =>
      git(['ls-tree', '-r', '-z', '--name-only', revision, '--', DEPLOYMENTS_DIR]).split('\0').filter(Boolean),
    // Against the worktree, not HEAD: an uncommitted edit of a record is caught locally too. Untracked
    // files are not listed, and need not be: a new file is an addition, judged the same once committed.
    changesSince: (revision) => {
      const fields = git(['diff', '--name-status', '--no-renames', '-z', '--relative', revision, '--', DEPLOYMENTS_DIR])
        .split('\0')
        .filter(Boolean);
      const changes: { status: string; path: string }[] = [];
      for (let i = 0; i + 1 < fields.length; i += 2)
        changes.push({ status: fields[i] ?? '', path: fields[i + 1] ?? '' });
      return changes;
    },
  };
}

/** The record folder a path belongs to, as `deployments/<chain>/<id>`, or undefined above that depth. */
export function recordFolderOf(path: string): string | undefined {
  const parts = path.split('/');
  if (parts[0] !== DEPLOYMENTS_DIR || parts.length < 4) return undefined;
  return parts.slice(0, 3).join('/');
}

const STATUS_WORDS: Readonly<Record<string, string>> = {
  A: 'added to',
  M: 'modified in',
  D: 'deleted from',
  T: 'changed type in',
};

/** Frozen records: nothing under a record folder that exists at the merge base with `base` may change. */
export function inspectFrozenRecords(
  base: string,
  git: DeploymentsGit,
): DeploymentsInspection & { readonly mergeBase: string } {
  let mergeBase: string;
  try {
    mergeBase = git.mergeBase(base);
  } catch (error) {
    // A check that cannot find its base must not pass: in CI that is a shallow checkout, not a clean record.
    throw new Error(
      `check deployments: cannot find the merge base of '${base}' and HEAD (${(error as Error).message.trim()}). ` +
        'Fetch the base ref, or check out with full history (fetch-depth: 0).',
    );
  }

  const frozen = new Set(
    git
      .filesAt(mergeBase)
      .map(recordFolderOf)
      .filter((folder) => folder !== undefined),
  );
  const violations: Violation[] = [];
  for (const { status, path } of git.changesSince(mergeBase)) {
    const folder = recordFolderOf(path);
    if (folder === undefined || !frozen.has(folder)) continue;
    const word = STATUS_WORDS[status.charAt(0)] ?? `changed (${status}) in`;
    violations.push({
      rule: RULE,
      packageKey: `./${folder}`,
      message: `${path.slice(folder.length + 1)} ${word} a frozen record. A record never changes after it lands; record a later on-chain event in a new folder`,
    });
  }
  return { checkedRecordKeys: [...frozen].sort().map((folder) => `./${folder}`), violations, mergeBase };
}
