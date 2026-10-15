import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

import { inspectDeploymentRecords, recordFolderOf } from '../base/checks/deployments.ts';
import { parseCliOptions } from '../cli-options.ts';
import { checkDeployments } from '../commands/check-deployments.ts';

const STACK = 'cleartext-v13-sepolia-2026-10-05-1';
const ADMIN = '0xD9F9298BbcD72843586e7E08DAe577E3a0aC8866';
const COMMIT = 'dd09b761fce79a17672ca7c6d1efd5e90d44e3c5';
const CHAIN = 11155111;
const S = `deployments/ethereum_sepolia/${STACK}`;
const DEPLOY = '00-deploy-v13.0-2026-10-05';
const HOTFIX = '01-hotfix-v13.1-2026-10-20';
const UPGRADE = '02-upgrade-v14.1-2026-11-02';

type Files = Record<string, string | null>;

const CHAINS: Files = {
  'fhevm-chains.config.json': JSON.stringify({
    networks: {
      testnet: { hosts: { ethereum_sepolia: { id: CHAIN } } },
      mainnet: { hosts: { ethereum: { id: 1 } } },
    },
  }),
  'deployments/README.md': '# records\n',
};

const hash = (n: number): string => `0x${n.toString(16).padStart(64, '0')}`;
/** Noon UTC of a `YYYY-MM-DD`, in seconds. */
const noon = (day: string): number => Date.parse(`${day}T12:00:00Z`) / 1000;
const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');

type EventSpec = {
  readonly name: string;
  readonly kind: 'deploy' | 'upgrade' | 'hotfix';
  readonly version: string;
  readonly packageVersion?: string;
  /** First, defining, last blocks; the defining one is dated noon UTC of the folder's day. */
  readonly blocks: readonly [number, number, number];
  readonly previous?: { readonly name: string; readonly manifest: string } | null;
};

/** The files of one event folder; returns them and the exact manifest text (for the next link's sha256). */
function eventFiles(base: string, spec: EventSpec, eventJson = true): { files: Files; manifest: string } {
  const [first, defining, last] = spec.blocks;
  const day = /\d{4}-\d{2}-\d{2}/.exec(spec.name)?.[0] ?? '';
  const manifestObject: Record<string, unknown> = {
    deploymentId: STACK,
    admin: ADMIN,
    chainId: CHAIN,
    version: spec.version,
    ...(spec.packageVersion === undefined ? {} : { packageVersion: spec.packageVersion }),
  };
  if (spec.previous) {
    const before = JSON.parse(spec.previous.manifest) as Record<string, unknown>;
    manifestObject['previous'] = {
      path: `../../${spec.previous.name}/record/manifest.json`,
      sha256: sha256(spec.previous.manifest),
      deploymentId: STACK,
      chainId: before['chainId'],
      version: before['version'],
      packageVersion: before['packageVersion'] ?? `0.${spec.previous.name.split('-v')[1]?.split('-')[0] ?? ''}`,
    };
  }
  const manifest = JSON.stringify(manifestObject);
  const journal = [first, defining, last].map((block) => JSON.stringify({ hash: hash(block), block })).join('\n');
  const files: Files = {
    [`${base}/${spec.kind}.config.json`]: JSON.stringify({ deploymentId: STACK, admin: ADMIN, outDir: 'record' }),
    [`${base}/tool-commit.txt`]: `${COMMIT}\n`,
    [`${base}/record/manifest.json`]: manifest,
    [`${base}/record/addresses.sol`]: '// addresses\n',
    [`${base}/record/journal.jsonl`]: `${journal}\n`,
  };
  if (spec.kind !== 'deploy') {
    files[`${base}/record/progress.jsonl`] = '{}\n';
    files[`${base}/record/verify-report.json`] = '{}\n';
  }
  if (eventJson) {
    const tx = (block: number, ts: number): Record<string, unknown> => ({
      hash: hash(block),
      block,
      blockTimestamp: ts,
    });
    files[`${base}/record/event.json`] = JSON.stringify({
      kind: spec.kind,
      defining: tx(defining, noon(day)),
      first: tx(first, noon(day) - 600),
      last: tx(last, noon(day) + (last === defining ? 0 : 600)),
    });
  }
  return { files, manifest };
}

/** deploy (legacy-style: no packageVersion, no event.json) -> hotfix v13.1 -> upgrade v14.1. */
function history(): Files {
  const deploy = eventFiles(
    `${S}/${DEPLOY}`,
    { name: DEPLOY, kind: 'deploy', version: '0.13', blocks: [100, 200, 200] },
    false,
  );
  const hotfix = eventFiles(`${S}/${HOTFIX}`, {
    name: HOTFIX,
    kind: 'hotfix',
    version: '0.13',
    packageVersion: '0.13.1',
    blocks: [300, 310, 320],
    previous: { name: DEPLOY, manifest: deploy.manifest },
  });
  const upgrade = eventFiles(`${S}/${UPGRADE}`, {
    name: UPGRADE,
    kind: 'upgrade',
    version: '0.14',
    packageVersion: '0.14.1',
    blocks: [400, 410, 420],
    previous: { name: HOTFIX, manifest: hotfix.manifest },
  });
  return { ...CHAINS, ...deploy.files, ...hotfix.files, ...upgrade.files };
}

/** The flat layout before events had folders. */
function legacy(): Files {
  return {
    ...CHAINS,
    [`${S}/deploy.config.json`]: JSON.stringify({ deploymentId: STACK, admin: ADMIN, outDir: 'record' }),
    [`${S}/tool-commit.txt`]: `${COMMIT}\n# a note\n`,
    [`${S}/addresses.json`]: '{}\n',
    [`${S}/record/manifest.json`]: JSON.stringify({
      deploymentId: STACK,
      admin: ADMIN,
      chainId: CHAIN,
      version: '0.13',
    }),
    [`${S}/record/addresses.sol`]: '// addresses\n',
    [`${S}/record/journal.jsonl`]: '{}\n',
  };
}

function write(root: string, files: Files): void {
  for (const [path, content] of Object.entries(files)) {
    if (content === null) {
      rmSync(join(root, path), { recursive: true, force: true });
      continue;
    }
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
}

function withTree(files: Files, body: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), 'check-deployments-'));
  try {
    write(root, files);
    body(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

/** `<key relative to the stack>: <message>` for every violation. */
function found(root: string): readonly string[] {
  return inspectDeploymentRecords(root).violations.map(
    (v) => `${v.packageKey.replace(`./${S}`, '').replace(/^\//, '') || '.'}: ${v.message}`,
  );
}

function expectOne(files: Files, pattern: RegExp): void {
  withTree(files, (root) => {
    const all = found(root);
    assert.ok(
      all.some((m) => pattern.test(m)),
      `expected ${String(pattern)} in:\n${all.join('\n')}`,
    );
  });
}

const edit = (files: Files, path: string, change: (value: Record<string, unknown>) => void): Files => {
  const value = JSON.parse(files[path] ?? '{}') as Record<string, unknown>;
  change(value);
  return { ...files, [path]: JSON.stringify(value) };
};

/** Move every file of an event folder to another name. */
const rename = (files: Files, from: string, to: string): Files => {
  const out: Files = {};
  for (const [path, content] of Object.entries(files)) out[path.replace(`${S}/${from}/`, `${S}/${to}/`)] = content;
  return out;
};

// --- consistency ------------------------------------------------------------------------------------

test('a full history (deploy, hotfix, upgrade) passes', () => {
  withTree(history(), (root) => {
    const inspection = inspectDeploymentRecords(root);
    assert.deepEqual(inspection.violations, []);
    assert.deepEqual(inspection.checkedRecordKeys, [`./${S}/${DEPLOY}`, `./${S}/${HOTFIX}`, `./${S}/${UPGRADE}`]);
    assert.equal(inspection.notes, undefined);
  });
});

test('no deployments folder at all is not an error', () => {
  withTree({}, (root) => assert.deepEqual(inspectDeploymentRecords(root), { checkedRecordKeys: [], violations: [] }));
});

test('a legacy flat record is still checked, and reported as a note to relocate', () => {
  withTree(legacy(), (root) => {
    const inspection = inspectDeploymentRecords(root);
    assert.deepEqual(inspection.violations, []);
    assert.deepEqual(inspection.checkedRecordKeys, [`./${S}`]);
    assert.match(inspection.notes?.[0] ?? '', /legacy flat record: relocate it, as a pure move/);
  });
  expectOne({ ...legacy(), [`${S}/record/journal.jsonl`]: null }, /^\.: missing record\/journal\.jsonl$/);
  expectOne({ ...legacy(), ...history() }, /mixes a legacy flat record with event folders/);
});

test('names: unknown entries, the sequence, exactly one deploy first', () => {
  expectOne({ ...history(), [`${S}/notes.txt`]: 'x' }, /'notes.txt' is not an event folder/);
  expectOne(
    { ...history(), [`${S}/03-patch-v14.2-2026-11-03/x`]: 'x' },
    /'03-patch-v14.2-2026-11-03' is not an event folder/,
  );
  expectOne(rename(history(), UPGRADE, '03-upgrade-v14.1-2026-11-02'), /sequence 3, expected 2/);
  expectOne(rename(history(), DEPLOY, '00-hotfix-v13.0-2026-10-05'), /the first event is '00-hotfix/);
  withTree({ ...history(), [`${S}/README.md`]: '# story\n', [`${S}/aborted/README.md`]: '# why\n' }, (root) =>
    assert.deepEqual(found(root), []),
  );
  withTree(CHAINS, (root) => {
    mkdirSync(join(root, S), { recursive: true });
    assert.deepEqual(found(root), ['.: holds no event folder: a stack starts with 00-deploy-…']);
  });
});

test('per folder: files, identity, scratch, tool commit', () => {
  expectOne(
    { ...history(), [`${S}/${HOTFIX}/record/verify-report.json`]: null },
    /missing record\/verify-report\.json/,
  );
  expectOne({ ...history(), [`${S}/${UPGRADE}/record/event.json`]: null }, /missing record\/event\.json/);
  expectOne({ ...history(), [`${S}/${HOTFIX}/hotfix.config.json`]: null }, /hotfix\.config\.json is missing/);
  expectOne({ ...history(), [`${S}/${HOTFIX}/record/cache/x`]: '{}' }, /record\/cache is forge scratch/);
  expectOne({ ...history(), [`${S}/${HOTFIX}/record/rehearsal/x`]: '{}' }, /record\/rehearsal is forge scratch/);
  expectOne({ ...history(), [`${S}/${HOTFIX}/tool-commit.txt`]: 'dd09b76\n' }, /full 40-hex commit, found 'dd09b76'/);
  expectOne(
    edit(history(), `${S}/${DEPLOY}/record/manifest.json`, (m) => {
      m['toolCommit'] = 'f'.repeat(40);
    }),
    /tool-commit\.txt names dd09b7.*, the seal was made by f{40}/,
  );
  expectOne(
    edit(history(), `${S}/${HOTFIX}/record/manifest.json`, (m) => {
      m['deploymentId'] = 'other';
    }),
    /manifest\.json: deploymentId is 'other', the stack is/,
  );
  expectOne(
    edit(history(), `${S}/${HOTFIX}/hotfix.config.json`, (c) => {
      c['admin'] = '0x0000000000000000000000000000000000000001';
    }),
    /differs from the sealed admin/,
  );
});

test("a fork simulation's record is never archived", () => {
  expectOne(
    edit(history(), `${S}/${HOTFIX}/record/manifest.json`, (m) => {
      m['simulation'] = { fork: 'http://127.0.0.1:8556' };
    }),
    /is a fork simulation's seal/,
  );
});

test('the chain folder must be a known host chain, matching every sealed chain id', () => {
  const moved: Files = {};
  for (const [path, content] of Object.entries(history()))
    moved[path.replace('/ethereum_sepolia/', '/ethereum/')] = content;
  withTree(moved, (root) => {
    const all = inspectDeploymentRecords(root).violations.map((v) => v.message);
    assert.ok(all.some((m) => m === `manifest.json: chainId is ${CHAIN}, but the chain folder is chain 1`));
  });
  const unknown: Files = {};
  for (const [path, content] of Object.entries(history()))
    unknown[path.replace('/ethereum_sepolia/', '/ethereum-sepolia/')] = content;
  withTree(unknown, (root) =>
    assert.match(
      inspectDeploymentRecords(root).violations[0]?.message ?? '',
      /'ethereum-sepolia' is not a host chain of .*\(known: ethereum, ethereum_sepolia\)/,
    ),
  );
  expectOne(
    { ...history(), 'deployments/ethereum_sepolia/stray.json': '{}' },
    /'stray.json' is neither a stack folder/,
  );
});

test('versions: the folder name and the manifest agree', () => {
  expectOne(
    edit(history(), `${S}/${HOTFIX}/record/manifest.json`, (m) => {
      m['packageVersion'] = '0.13.2';
    }),
    /packageVersion is '0\.13\.2', the folder name says v13\.1/,
  );
  expectOne(
    edit(history(), `${S}/${UPGRADE}/record/manifest.json`, (m) => {
      m['version'] = '0.13';
    }),
    /version is '0\.13', the folder name says generation v14/,
  );
  expectOne(
    edit(history(), `${S}/${HOTFIX}/record/manifest.json`, (m) => {
      delete m['packageVersion'];
    }),
    /packageVersion is missing/,
  );
});

test('kinds: an upgrade moves one generation, a hotfix moves the patch within its generation', () => {
  // Names changed together with what they seal, so only the kind rule is at fault.
  const twoUp = edit(
    rename(history(), UPGRADE, '02-upgrade-v15.0-2026-11-02'),
    `${S}/02-upgrade-v15.0-2026-11-02/record/manifest.json`,
    (m) => {
      m['version'] = '0.15';
      m['packageVersion'] = '0.15.0';
    },
  );
  expectOne(twoUp, /an upgrade moves exactly one generation up: v13 -> v15/);
  const samePatch = edit(
    rename(history(), HOTFIX, '01-hotfix-v13.0-2026-10-20'),
    `${S}/01-hotfix-v13.0-2026-10-20/record/manifest.json`,
    (m) => {
      m['packageVersion'] = '0.13.0';
    },
  );
  expectOne(samePatch, /a hotfix stays in its generation with a higher patch: v13\.0 -> v13\.0/);
});

test('links: previous resolves to the event before, by path and sha256', () => {
  expectOne(
    edit(history(), `${S}/${UPGRADE}/record/manifest.json`, (m) => {
      (m['previous'] as Record<string, unknown>)['path'] = `../../${DEPLOY}/record/manifest.json`;
    }),
    /does not resolve to the manifest of the record before it/,
  );
  expectOne(
    {
      ...history(),
      [`${S}/${DEPLOY}/record/manifest.json`]: JSON.stringify({
        deploymentId: STACK,
        admin: ADMIN,
        chainId: CHAIN,
        version: '0.13',
        edited: true,
      }),
    },
    /previous\.sha256 does not match the bytes of/,
  );
  expectOne(
    edit(history(), `${S}/${UPGRADE}/record/manifest.json`, (m) => {
      delete m['previous'];
    }),
    /previous is missing/,
  );
  expectOne(
    edit(history(), `${S}/${UPGRADE}/record/manifest.json`, (m) => {
      (m['previous'] as Record<string, unknown>)['packageVersion'] = '0.13.0';
    }),
    /previous\.packageVersion is "0\.13\.0", that record is "0\.13\.1"/,
  );
  expectOne(
    edit(history(), `${S}/${UPGRADE}/upgrade.config.json`, (c) => {
      c['previousManifest'] = '../elsewhere/manifest.json';
    }),
    /previousManifest '\.\.\/elsewhere\/manifest\.json' differs from the sealed previous\.path/,
  );
  expectOne(
    edit(history(), `${S}/${DEPLOY}/record/manifest.json`, (m) => {
      m['previous'] = { path: 'x' };
    }),
    /a deploy starts nothing, so it has no previous/,
  );
});

test('dates come from event.json, and follow the chain', () => {
  expectOne(
    edit(history(), `${S}/${HOTFIX}/record/event.json`, (e) => {
      (e['defining'] as Record<string, unknown>)['blockTimestamp'] = noon('2026-10-21');
    }),
    /dated 2026-10-20, its defining transaction's block is from 2026-10-21/,
  );
  expectOne(
    edit(history(), `${S}/${HOTFIX}/record/event.json`, (e) => {
      (e['defining'] as Record<string, unknown>)['hash'] = hash(999);
    }),
    /'defining' transaction 0x0+3e7 is not in journal\.jsonl/,
  );
  expectOne(
    edit(history(), `${S}/${HOTFIX}/record/event.json`, (e) => {
      e['kind'] = 'upgrade';
    }),
    /kind is 'upgrade', expected 'hotfix'/,
  );
  // An upgrade whose defining block is not after the hotfix's.
  const early = history();
  const journal = `${[150, 160, 170].map((block) => JSON.stringify({ hash: hash(block), block })).join('\n')}\n`;
  const tx = (block: number, ts: number): Record<string, unknown> => ({ hash: hash(block), block, blockTimestamp: ts });
  early[`${S}/${UPGRADE}/record/journal.jsonl`] = journal;
  early[`${S}/${UPGRADE}/record/event.json`] = JSON.stringify({
    kind: 'upgrade',
    defining: tx(160, noon('2026-11-02')),
    first: tx(150, noon('2026-11-02')),
    last: tx(170, noon('2026-11-02')),
  });
  expectOne(early, /its defining transaction \(block 160\) is not after '01-hotfix/);
});

test('attempts: recorded under aborted/, linked to an event, never verified', () => {
  const attempt = `${S}/aborted/2026-10-30-upgrade-v14.1-1`;
  const files = history();
  const hotfixManifest = files[`${S}/${HOTFIX}/record/manifest.json`] ?? '';
  const made = eventFiles(attempt, {
    name: '2026-10-30-upgrade-v14.1-1',
    kind: 'upgrade',
    version: '0.14',
    packageVersion: '0.14.1',
    blocks: [350, 350, 360],
    previous: { name: HOTFIX, manifest: hotfixManifest },
  });
  const attemptFiles: Files = {
    ...made.files,
    [`${attempt}/record/verify-report.json`]: null,
    [`${attempt}/ABORTED.md`]: 'why\n',
  };
  // The attempt's previous.path is one level deeper (aborted/<attempt>/record).
  const fixed = edit({ ...files, ...attemptFiles }, `${attempt}/record/manifest.json`, (m) => {
    (m['previous'] as Record<string, unknown>)['path'] = `../../../${HOTFIX}/record/manifest.json`;
  });
  const aborted = edit(fixed, `${attempt}/record/event.json`, (e) => {
    e['kind'] = 'aborted';
  });
  withTree(aborted, (root) => assert.deepEqual(found(root), []));
  expectOne(
    { ...aborted, [`${attempt}/record/verify-report.json`]: '{}' },
    /verify-report\.json in an aborted attempt/,
  );
  expectOne(
    edit(aborted, `${attempt}/record/event.json`, (e) => {
      e['defining'] = e['last'];
    }),
    /an attempt is dated by its first transaction/,
  );
  expectOne(
    edit(aborted, `${attempt}/record/manifest.json`, (m) => {
      (m['previous'] as Record<string, unknown>)['path'] = '../../nowhere/manifest.json';
    }),
    /does not resolve to an event of this stack/,
  );
  expectOne({ ...aborted, [`${S}/aborted/oops/x`]: 'x' }, /'aborted\/oops' is not an attempt folder/);
});

test('recordFolderOf names event folders, attempts, and legacy flat records', () => {
  assert.equal(recordFolderOf(`${S}/${DEPLOY}/record/manifest.json`), `${S}/${DEPLOY}`);
  assert.equal(
    recordFolderOf(`${S}/aborted/2026-10-30-upgrade-v14.1-1/record/x`),
    `${S}/aborted/2026-10-30-upgrade-v14.1-1`,
  );
  assert.equal(recordFolderOf(`${S}/README.md`), undefined);
  assert.equal(recordFolderOf(`${S}/aborted/README.md`), undefined);
  assert.equal(recordFolderOf('deployments/ethereum_sepolia/README.md'), undefined);
  assert.equal(recordFolderOf('deployments/README.md'), undefined);
  assert.equal(recordFolderOf(`${S}/tool-commit.txt`, new Set([S])), S);
});

// --- frozen records, against a real repository ------------------------------------------------------

function git(root: string, ...args: string[]): string {
  return execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

/** A repository whose `base` branch holds `files`, checked out on a `work` branch. */
function repository(files: Files): string {
  const root = mkdtempSync(join(tmpdir(), 'check-deployments-'));
  write(root, files);
  git(root, 'init', '-q', '-b', 'base');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'records');
  git(root, 'switch', '-q', '-c', 'work');
  return root;
}

function withRepository(files: Files, body: (root: string) => void): void {
  const root = repository(files);
  try {
    body(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

/** The freeze violations only: an edited record usually breaks its own consistency too, checked above. */
function frozen(root: string): readonly string[] {
  return checkDeployments({ workspaceRoot: root, base: 'base' })
    .violations.map((v) => `${v.packageKey}: ${v.message}`)
    .filter((m) => /frozen record|relocated record|left behind|may only move|split across/.test(m));
}

function commitAll(root: string): void {
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'change');
}

test('untouched records pass against their base', () => {
  withRepository(history(), (root) => assert.deepEqual(frozen(root), []));
  withRepository(legacy(), (root) => assert.deepEqual(frozen(root), []));
});

test('modifying, deleting or adding a file in a frozen event fails, committed or not', () => {
  withRepository(history(), (root) => {
    writeFileSync(join(root, S, HOTFIX, 'record/journal.jsonl'), '{"edited":true}\n');
    assert.deepEqual(frozen(root), [
      `./${S}/${HOTFIX}: record/journal.jsonl modified in a frozen record. A record never changes after it lands; record a later on-chain event in a new folder`,
    ]);
    commitAll(root);
    rmSync(join(root, S, DEPLOY, 'tool-commit.txt'));
    writeFileSync(join(root, S, UPGRADE, 'notes.md'), 'late\n');
    commitAll(root);
    const all = frozen(root);
    assert.equal(all.length, 3);
    assert.ok(all.some((m) => m.includes('deleted from a frozen record')));
    assert.ok(all.some((m) => m.includes('notes.md added to a frozen record')));
  });
});

test('a new event folder, a new stack and the READMEs may change', () => {
  withRepository(history(), (root) => {
    const next = eventFiles(`${S}/03-hotfix-v14.2-2026-11-03`, {
      name: '03-hotfix-v14.2-2026-11-03',
      kind: 'hotfix',
      version: '0.14',
      packageVersion: '0.14.2',
      blocks: [500, 510, 520],
      previous: { name: UPGRADE, manifest: readFileSync(join(root, S, UPGRADE, 'record/manifest.json'), 'utf8') },
    });
    write(root, {
      ...next.files,
      'deployments/README.md': '# records, edited\n',
      'deployments/ethereum_sepolia/README.md': '# sepolia\n',
      [`${S}/README.md`]: '# this stack\n',
    });
    commitAll(root);
    assert.deepEqual(frozen(root), []);
    assert.deepEqual(inspectDeploymentRecords(root).violations, []);
  });
});

test('the legacy flat record may be relocated, as a pure move, and only so', () => {
  const relocate = (root: string, target: string, skip: readonly string[] = []): void => {
    mkdirSync(join(root, S, target), { recursive: true });
    for (const entry of ['deploy.config.json', 'tool-commit.txt', 'addresses.json', 'record']) {
      if (!skip.includes(entry)) git(root, 'mv', `${S}/${entry}`, `${S}/${target}/${entry}`);
    }
  };
  withRepository(legacy(), (root) => {
    relocate(root, DEPLOY);
    commitAll(root);
    assert.deepEqual(frozen(root), []);
    const after = inspectDeploymentRecords(root);
    assert.deepEqual(after.violations, []);
    assert.equal(after.notes, undefined);
  });
  withRepository(legacy(), (root) => {
    relocate(root, DEPLOY);
    writeFileSync(join(root, S, DEPLOY, 'record/journal.jsonl'), '{"edited":true}\n');
    commitAll(root);
    assert.ok(
      frozen(root).some((m) => /may only move, byte for byte|left behind/.test(m)),
      frozen(root).join('\n'),
    );
  });
  withRepository(legacy(), (root) => {
    relocate(root, DEPLOY, ['addresses.json']);
    commitAll(root);
    assert.ok(frozen(root).some((m) => m.includes('addresses.json was left behind')));
  });
  withRepository(legacy(), (root) => {
    relocate(root, '01-deploy-v13.0-2026-10-05');
    commitAll(root);
    assert.ok(frozen(root).some((m) => m.includes('may only move, byte for byte')));
  });
  withRepository(legacy(), (root) => {
    relocate(root, DEPLOY);
    writeFileSync(join(root, S, DEPLOY, 'record/event.json'), '{}\n');
    commitAll(root);
    assert.ok(frozen(root).some((m) => m.includes('added to a relocated record')));
  });
  withRepository(legacy(), (root) => {
    writeFileSync(join(root, S, 'notes.md'), 'late\n');
    commitAll(root);
    assert.ok(frozen(root).some((m) => m.includes('notes.md added to a frozen record')));
  });
});

test('a base that cannot be resolved fails instead of passing', () => {
  withRepository(history(), (root) =>
    assert.throws(() => checkDeployments({ workspaceRoot: root, base: 'no-such-ref' }), /cannot find the merge base/),
  );
});

test("'check deployments' parses with and without --base", () => {
  const plain = parseCliOptions(['check', 'deployments']);
  if (plain.command !== 'check-deployments') throw new Error(`unexpected command ${plain.command}`);
  assert.equal(plain.base, undefined);

  const based = parseCliOptions(['check', 'deployments', '--base', 'origin/release/0.13.x']);
  if (based.command !== 'check-deployments') throw new Error(`unexpected command ${based.command}`);
  assert.equal(based.base, 'origin/release/0.13.x');
});
