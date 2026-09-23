// Moves every pinned vendored source taken from ONE repository to a new tag, in one command.
//
// A tag bump used to be five hand edits in three files, each graded by a check afterwards: the tag and
// commit in npm-manifest.json (once per pinned entry), the digest each entry implies, the copies on disk,
// and the `fhevm.vendoredFrom` block of every owning package.json. Every one of them was derivable from
// the first, which is what made the sequence error-prone rather than hard. This does the derivation.
//
// Scoped by PACKAGE, with every pin under it moving together. A generation vendors two trees from one
// upstream (its contracts and its config), and both must sit at one commit — two pins from one upstream
// at two commits is the drift a hand edit produces. But two GENERATIONS vendor from that same upstream
// at deliberately different tags, so "every pin from this repository" would drag v(N-1) onto v(N)'s tag.
// The selector is a package key prefix: `./host-contracts-cleartext/v13` covers its nested `pkg` too.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type NpmManifest, parseNpmManifest } from '../manifest.ts';
import type { PinnedVendoredTarget } from './checks/vendored.ts';
import type { Violation } from './diagnostics.ts';
import { type ProgressLogger, type SyncVendoredResult, syncPinnedVendored, upstreamDigest } from './sync-vendored.ts';
import { vendoredDigest } from './vendored-digest.ts';
import { type Downloader, type PinnedSource } from './vendored-download.ts';

const RULE = 'vendored-bump';
const COMMIT = /^[0-9a-f]{40}$/;

/** `git ls-remote`, or a test's stand-in: the peeled and unpeeled refs a repository answers for a tag. */
export type RemoteRefs = (repository: string, tag: string) => string;

export type BumpVendoredOptions = {
  readonly workspaceRoot: string;
  readonly manifestFile: string;
  /** Package key or key prefix: `./host-contracts-cleartext/v13` selects it and `./host-contracts-cleartext/v13/pkg`. */
  readonly selector: string;
  /** Required only when the selection pins more than one repository; otherwise derived. */
  readonly repository?: string;
  readonly tag: string;
  /** Pins this commit instead of resolving `tag`; for a commit no tag names yet. */
  readonly commit?: string;
  /** Resolve, compute and compare, but write nothing. */
  readonly check: boolean;
  readonly onProgress?: ProgressLogger;
  readonly download?: Downloader;
  readonly remoteRefs?: RemoteRefs;
  /** See `SyncPinnedOptions.cacheRoot`: tests pass their own so a fake tree never lands in the real cache. */
  readonly cacheRoot?: string;
};

/** One pinned entry before and after, so the report can say exactly what moved. */
export type BumpedEntry = {
  readonly packageKey: string;
  readonly relPath: string;
  readonly from: { readonly tag: string; readonly commit: string; readonly digest?: string };
  readonly to: { readonly tag: string; readonly commit: string; readonly digest: string };
  /** Whether the copies on disk differ from what the new pin implies — the signal the checklist keys off. */
  readonly copiesChange: boolean;
};

export type BumpVendoredResult = {
  readonly repository: string;
  readonly commit: string;
  readonly entries: readonly BumpedEntry[];
  readonly manifestWritten: boolean;
  readonly sync: SyncVendoredResult | undefined;
  readonly violations: readonly Violation[];
};

export async function bumpVendored(options: BumpVendoredOptions): Promise<BumpVendoredResult> {
  const text = readFileSync(options.manifestFile, 'utf8');
  const json = JSON.parse(text) as ManifestJson;
  const selected = selectPinned(json, options.selector);
  const repository = chooseRepository(selected, options);
  const commit = options.commit ?? resolveTag(repository, options.tag, options.remoteRefs ?? gitLsRemote);
  if (!COMMIT.test(commit)) {
    throw new Error(`bump vendored: --commit expects a full 40-hex lowercase sha, got '${commit}'`);
  }
  options.onProgress?.(`🔖 ${options.tag} is ${commit} in ${repository}`);

  const entries: BumpedEntry[] = [];
  const violations: Violation[] = [];

  for (const { packageKey, element } of selected) {
    const source = element.source;
    if (normalizeRepository(source.repository) !== repository) continue;

    const next: PinnedSource = { repository: source.repository, commit, from: source.from };
    options.onProgress?.(`→ ${packageKey} ${element.relPath} (${source.from}: ${source.tag} → ${options.tag})`);
    let digest: string;
    try {
      digest = upstreamDigest(next, options.download, options.cacheRoot);
    } catch (error) {
      violations.push({
        rule: RULE,
        packageKey,
        message: `${element.relPath}: unable to read ${source.from} at ${commit}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
      continue;
    }
    entries.push({
      packageKey,
      relPath: element.relPath,
      from: { tag: source.tag, commit: source.commit, digest: source.digest },
      to: { tag: options.tag, commit, digest },
      // Compared against the copies as they are NOW, before anything is written: in check mode nothing
      // ever is, and this is still the answer the operator came for.
      copiesChange: onDiskDigest(options.workspaceRoot, packageKey, element.relPath) !== digest,
    });
    source.tag = options.tag;
    source.commit = commit;
    source.digest = digest;
  }

  if (entries.length === 0 && violations.length === 0) {
    throw new Error(`bump vendored: nothing under '${options.selector}' pins ${repository}`);
  }
  if (violations.length > 0) {
    return { repository, commit, entries, manifestWritten: false, sync: undefined, violations };
  }

  const rendered = editPinnedSources(text, json);
  const manifestChanged = rendered !== text;
  if (!options.check && manifestChanged) writeFileSync(options.manifestFile, rendered);

  // Check mode stops here: the copies are compared above, and running the sync's own check against a
  // manifest that names the NEW digest would only restate "the copies are not at the new pin yet".
  if (options.check) {
    return {
      repository,
      commit,
      entries,
      manifestWritten: false,
      sync: undefined,
      violations: manifestChanged ? [manifestViolation(entries)] : [],
    };
  }

  // The copies and every owning package.json follow the manifest that was just written — the same
  // writer `sync vendored` is, restricted to the bumped entries so nothing else is touched.
  const manifest: NpmManifest = parseNpmManifest(json);
  const bumped = new Set(entries.map((entry) => `${entry.packageKey} ${entry.relPath}`));
  const sync = syncPinnedVendored({
    workspaceRoot: options.workspaceRoot,
    manifest,
    check: false,
    onProgress: options.onProgress,
    download: options.download,
    cacheRoot: options.cacheRoot,
    only: (target: PinnedVendoredTarget) => bumped.has(`${target.packageKey} ${target.relPath}`),
  });

  return { repository, commit, entries, manifestWritten: manifestChanged, sync, violations: sync.violations };
}

type SelectedPin = { readonly packageKey: string; readonly element: PinnedElement };

/** Every pinned entry whose package key is the selector or lies under it. */
function selectPinned(json: ManifestJson, selector: string): readonly SelectedPin[] {
  const prefix = selector.replace(/\/+$/, '');
  return Object.entries(json.packages)
    .filter(([key]) => key === prefix || key.startsWith(`${prefix}/`))
    .flatMap(([packageKey, pkg]) =>
      (pkg.vendored ?? [])
        .filter((element): element is PinnedElement => typeof element.source !== 'string')
        .map((element) => ({ packageKey, element })),
    );
}

/** The one repository the selection pins, or the `--repository` that picks among several. */
function chooseRepository(selected: readonly SelectedPin[], options: BumpVendoredOptions): string {
  const repositories = [...new Set(selected.map(({ element }) => normalizeRepository(element.source.repository)))];
  if (options.repository !== undefined) {
    const wanted = normalizeRepository(options.repository);
    if (!repositories.includes(wanted)) {
      throw new Error(`bump vendored: nothing under '${options.selector}' pins ${wanted}`);
    }
    return wanted;
  }
  if (repositories.length === 0) throw new Error(`bump vendored: nothing under '${options.selector}' is pinned`);
  if (repositories.length > 1) {
    throw new Error(
      `bump vendored: '${options.selector}' pins ${String(repositories.length)} repositories (${repositories.join(', ')}); pass --repository`,
    );
  }
  return repositories[0]!;
}

/** What the copies hash to today, or undefined when there are none yet (a pin being bootstrapped). */
function onDiskDigest(workspaceRoot: string, packageKey: string, relPath: string): string | undefined {
  const directory = join(workspaceRoot, packageKey, relPath);
  if (!existsSync(directory)) return undefined;
  try {
    return vendoredDigest(directory);
  } catch {
    return undefined;
  }
}

/** In check mode a manifest that would change is a finding, named per entry, not a silent no-op. */
function manifestViolation(entries: readonly BumpedEntry[]): Violation {
  const moved = entries.map((entry) => `${entry.packageKey} ${entry.relPath}: ${entry.from.tag} → ${entry.to.tag}`);
  return { rule: RULE, packageKey: './npm-manifest.json', message: `would move ${moved.join('; ')}` };
}

/**
 * The commit a tag names, peeled: an annotated tag is an object of its own, and `refs/tags/<tag>^{}` is
 * the commit behind it. A lightweight tag has no peeled line, so the plain ref is the commit already.
 */
export function resolveTag(repository: string, tag: string, remoteRefs: RemoteRefs): string {
  const lines = remoteRefs(repository, tag)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.split(/\s+/) as [string, string]);
  const peeled = lines.find(([, ref]) => ref === `refs/tags/${tag}^{}`);
  const plain = lines.find(([, ref]) => ref === `refs/tags/${tag}`);
  const sha = (peeled ?? plain)?.[0];
  if (sha === undefined) {
    throw new Error(`bump vendored: ${repository} has no tag '${tag}' (pass --commit to pin one that has no tag yet)`);
  }
  return sha;
}

function gitLsRemote(repository: string, tag: string): string {
  return execFileSync('git', ['ls-remote', '--tags', repository, `refs/tags/${tag}`, `refs/tags/${tag}^{}`], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

/** `https://github.com/o/r`, `…/r.git` and `…/r/` are one repository; the manifest may spell any of them. */
export function normalizeRepository(url: string): string {
  return url.replace(/\/+$/, '').replace(/\.git$/, '');
}

/**
 * Writes the moved fields INTO THE FILE'S OWN TEXT, three lines per pinned entry, leaving every other
 * byte as it was. Re-serialising the parsed JSON is not an option: the file is prettier-formatted with
 * expanded objects and a mix of `\u` escapes and literal characters, none of which survive a round trip,
 * and a bump must read as a diff of the pin and nothing else.
 *
 * Each pinned entry is one `"source": { … }` block, and the blocks occur in the text in the same order
 * as the pinned entries occur in the parsed object — JSON.parse keeps key order and local sources are
 * strings, not blocks — so the n-th block is the n-th pinned entry. The result is parsed back and
 * compared with the mutated object, so a mismatch fails loudly rather than writing a lie.
 */
export function editPinnedSources(text: string, json: ManifestJson): string {
  const pinned = Object.values(json.packages).flatMap((pkg) =>
    (pkg.vendored ?? []).filter((element): element is PinnedElement => typeof element.source !== 'string'),
  );
  const blocks = [...text.matchAll(/"source":\s*\{[^}]*\}/g)];
  if (blocks.length !== pinned.length) {
    throw new Error(
      `bump vendored: npm-manifest.json has ${String(blocks.length)} pinned source blocks but parses to ${String(pinned.length)}`,
    );
  }

  let out = '';
  let cursor = 0;
  blocks.forEach((match, index) => {
    const element = pinned[index]!;
    const start = match.index;
    out += text.slice(cursor, start) + rewriteBlock(match[0], element.source);
    cursor = start + match[0].length;
  });
  out += text.slice(cursor);

  // Key order is not content: a digest appended to the object lands last, while in the text it follows
  // `commit`. Compared with keys sorted, so only a real difference fails.
  const reparsed = JSON.parse(out) as unknown;
  if (canonical(reparsed) !== canonical(json)) {
    throw new Error(
      'bump vendored: the edited npm-manifest.json does not parse to the intended content; nothing written',
    );
  }
  return out;
}

/** JSON with every object's keys sorted, so two values compare by content rather than by insertion order. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, inner]) => `${JSON.stringify(key)}:${canonical(inner)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** One block with `tag`, `commit` and `digest` set to the entry's; `digest` appended after `commit` if absent. */
function rewriteBlock(block: string, source: PinnedElement['source']): string {
  const set = (input: string, key: 'tag' | 'commit' | 'digest', value: string): string =>
    input.replace(new RegExp(`("${key}":\\s*)"[^"]*"`), `$1${JSON.stringify(value)}`);
  let next = set(set(block, 'tag', source.tag), 'commit', source.commit);
  if (source.digest !== undefined) {
    next = /"digest":/.test(next)
      ? set(next, 'digest', source.digest)
      : next.replace(/("commit":\s*"[^"]*")(,?)(\s*)/, (_all, commit: string, _comma, ws: string) => {
          return `${commit},${ws}"digest": ${JSON.stringify(source.digest)},${ws}`.replace(/,\s*$/, `,${ws}`);
        });
  }
  return next;
}

/** Only the slice of npm-manifest.json this command touches; everything else passes through untouched. */
type PinnedElement = {
  relPath: string;
  source: { repository: string; tag: string; commit: string; from: string; digest?: string };
};
type ManifestJson = {
  packages: Record<string, { vendored?: Array<{ relPath: string; source: string } | PinnedElement> }>;
};
