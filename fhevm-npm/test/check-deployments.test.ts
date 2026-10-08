import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

import { inspectDeploymentRecords, recordFolderOf } from '../base/checks/deployments.ts';
import { parseCliOptions } from '../cli-options.ts';
import { checkDeployments } from '../commands/check-deployments.ts';

const ID = 'cleartext-v13-sepolia-2026-10-05-1';
const ADMIN = '0xD9F9298BbcD72843586e7E08DAe577E3a0aC8866';
const RECORD = `deployments/ethereum_sepolia/${ID}`;

type Files = Record<string, string | null>;

/** A workspace with one complete, consistent record; `overrides` replace (or, with null, delete) files. */
function workspace(overrides: Files = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'check-deployments-'));
  const files: Files = {
    'fhevm-chains.config.json': JSON.stringify({
      networks: {
        testnet: { hosts: { ethereum_sepolia: { id: 11155111 } } },
        mainnet: { hosts: { ethereum: { id: 1 } } },
      },
    }),
    'deployments/README.md': '# records\n',
    [`${RECORD}/deploy.config.json`]: JSON.stringify({ deploymentId: ID, admin: ADMIN, outDir: 'record' }),
    [`${RECORD}/tool-commit.txt`]: 'dd09b761fce79a17672ca7c6d1efd5e90d44e3c5\n# a note\n',
    [`${RECORD}/addresses.json`]: '{}\n',
    [`${RECORD}/record/manifest.json`]: JSON.stringify({ deploymentId: ID, admin: ADMIN, chainId: 11155111 }),
    [`${RECORD}/record/addresses.sol`]: '// addresses\n',
    [`${RECORD}/record/journal.jsonl`]: '{}\n',
    ...overrides,
  };
  for (const [path, content] of Object.entries(files)) {
    if (content === null) continue;
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

function messages(root: string): readonly string[] {
  return inspectDeploymentRecords(root).violations.map((violation) => violation.message);
}

function withWorkspace(overrides: Files, body: (root: string) => void): void {
  const root = workspace(overrides);
  try {
    body(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('a complete record passes, and files above record folders are not records', () => {
  withWorkspace({}, (root) => {
    const inspection = inspectDeploymentRecords(root);
    assert.deepEqual(inspection.violations, []);
    assert.deepEqual(inspection.checkedRecordKeys, [`./${RECORD}`]);
  });
});

test('no deployments folder at all is not an error', () => {
  const root = mkdtempSync(join(tmpdir(), 'check-deployments-'));
  try {
    assert.deepEqual(inspectDeploymentRecords(root), { checkedRecordKeys: [], violations: [] });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('missing files are reported', () => {
  withWorkspace({ [`${RECORD}/record/journal.jsonl`]: null, [`${RECORD}/tool-commit.txt`]: null }, (root) => {
    const found = messages(root);
    assert.ok(found.some((m) => m === 'missing record/journal.jsonl'));
    assert.ok(found.some((m) => m.startsWith('missing tool-commit.txt')));
  });
  withWorkspace({ [`${RECORD}/deploy.config.json`]: null }, (root) => {
    assert.deepEqual(messages(root), ['deploy.config.json is missing']);
  });
});

test('the tool commit must start with a full sha', () => {
  withWorkspace({ [`${RECORD}/tool-commit.txt`]: 'dd09b76\n' }, (root) => {
    assert.match(messages(root)[0] ?? '', /first line must be a full 40-hex commit, found 'dd09b76'/);
  });
});

test('the folder name, the config and the seal must name the same deployment and admin', () => {
  withWorkspace(
    {
      [`${RECORD}/deploy.config.json`]: JSON.stringify({ deploymentId: 'other', admin: ADMIN, outDir: 'record' }),
      [`${RECORD}/record/manifest.json`]: JSON.stringify({
        deploymentId: 'other',
        admin: '0x0000000000000000000000000000000000000001',
        chainId: 11155111,
      }),
    },
    (root) => {
      const found = messages(root);
      assert.ok(found.some((m) => m.includes("deploy.config.json: deploymentId is 'other'")));
      assert.ok(found.some((m) => m.includes("manifest.json: deploymentId is 'other'")));
      assert.ok(found.some((m) => m.includes('differs from the sealed admin')));
    },
  );
});

test('the admin comparison ignores address checksum case', () => {
  withWorkspace(
    {
      [`${RECORD}/deploy.config.json`]: JSON.stringify({
        deploymentId: ID,
        admin: ADMIN.toLowerCase(),
        outDir: 'record',
      }),
    },
    (root) => assert.deepEqual(messages(root), []),
  );
});

test('outDir must be a folder inside the record', () => {
  for (const outDir of ['/abs', '..', '../elsewhere', '.', '']) {
    withWorkspace(
      { [`${RECORD}/deploy.config.json`]: JSON.stringify({ deploymentId: ID, admin: ADMIN, outDir }) },
      (root) => assert.match(messages(root)[0] ?? '', /outDir/, `outDir ${JSON.stringify(outDir)}`),
    );
  }
  withWorkspace(
    { [`${RECORD}/deploy.config.json`]: JSON.stringify({ deploymentId: ID, admin: ADMIN, outDir: 'missing' }) },
    (root) => assert.deepEqual(messages(root), ["deploy.config.json: outDir 'missing' does not exist"]),
  );
});

test('the chain folder must be a known host chain, matching the sealed chain id', () => {
  const moved = (chain: string): Files => {
    const files: Files = { [`${RECORD}/addresses.json`]: null };
    for (const [path, content] of Object.entries({
      'deploy.config.json': JSON.stringify({ deploymentId: ID, admin: ADMIN, outDir: 'record' }),
      'tool-commit.txt': 'dd09b761fce79a17672ca7c6d1efd5e90d44e3c5\n',
      'record/manifest.json': JSON.stringify({ deploymentId: ID, admin: ADMIN, chainId: 11155111 }),
      'record/addresses.sol': '',
      'record/journal.jsonl': '',
    })) {
      files[`deployments/${chain}/${ID}/${path}`] = content;
      files[`${RECORD}/${path}`] = null;
    }
    return files;
  };
  withWorkspace(moved('ethereum-sepolia'), (root) =>
    assert.match(
      messages(root)[0] ?? '',
      /'ethereum-sepolia' is not a host chain of .*\(known: ethereum, ethereum_sepolia\)/,
    ),
  );
  withWorkspace(moved('ethereum'), (root) =>
    assert.deepEqual(messages(root), ["manifest.json: chainId is 11155111, but 'ethereum' is chain 1"]),
  );
});

test('forge scratch and a nested repository are reported', () => {
  withWorkspace(
    {
      [`${RECORD}/record/cache/solidity-files-cache.json`]: '{}',
      [`${RECORD}/record/pass2.json`]: '{}',
      [`${RECORD}/.git/HEAD`]: 'ref: refs/heads/main\n',
    },
    (root) => {
      const found = messages(root);
      assert.ok(found.some((m) => m.startsWith('record/cache is forge scratch')));
      assert.ok(found.some((m) => m.startsWith('record/pass2.json is forge scratch')));
      assert.ok(found.some((m) => m.startsWith('holds a .git folder')));
    },
  );
});

test('recordFolderOf only names paths inside a record folder', () => {
  assert.equal(recordFolderOf(`${RECORD}/record/manifest.json`), RECORD);
  assert.equal(recordFolderOf(`${RECORD}/tool-commit.txt`), RECORD);
  assert.equal(recordFolderOf('deployments/ethereum_sepolia/README.md'), undefined);
  assert.equal(recordFolderOf('deployments/README.md'), undefined);
  assert.equal(recordFolderOf('fhevm-npm/README.md'), undefined);
});

// --- frozen records, against a real repository ------------------------------------------------------

function git(root: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/** A repository whose `base` branch already holds the record, checked out on a `work` branch. */
function repository(): string {
  const root = workspace();
  git(root, 'init', '-q', '-b', 'base');
  git(root, '-c', 'user.name=t', '-c', 'user.email=t@t', 'add', '-A');
  git(root, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'record');
  git(root, 'switch', '-q', '-c', 'work');
  return root;
}

function frozenMessages(root: string): readonly string[] {
  return checkDeployments({ workspaceRoot: root, base: 'base' }).violations.map((v) => `${v.packageKey}: ${v.message}`);
}

function commitAll(root: string): void {
  git(root, 'add', '-A');
  git(root, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'change');
}

test('an untouched record passes against its base', () => {
  const root = repository();
  try {
    assert.deepEqual(frozenMessages(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('modifying, deleting or adding a file in a frozen record fails, committed or not', () => {
  const root = repository();
  try {
    writeFileSync(join(root, RECORD, 'record/journal.jsonl'), '{"edited":true}\n');
    assert.deepEqual(frozenMessages(root), [
      `./${RECORD}: record/journal.jsonl modified in a frozen record. A record never changes after it lands; record a later on-chain event in a new folder`,
    ]);

    commitAll(root);
    rmSync(join(root, RECORD, 'addresses.json'));
    writeFileSync(join(root, RECORD, 'notes.md'), 'late\n');
    commitAll(root);
    const found = frozenMessages(root);
    assert.equal(found.length, 3);
    assert.ok(found.some((m) => m.includes('record/journal.jsonl modified in')));
    assert.ok(found.some((m) => m.includes('addresses.json deleted from')));
    assert.ok(found.some((m) => m.includes('notes.md added to')));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a new record folder and files outside record folders may change', () => {
  const root = repository();
  try {
    const next = 'deployments/ethereum_sepolia/cleartext-v14-sepolia-2027-01-01-1';
    for (const [path, content] of Object.entries({
      'deploy.config.json': JSON.stringify({ deploymentId: 'cleartext-v14-sepolia-2027-01-01-1', outDir: 'record' }),
      'tool-commit.txt': 'dd09b761fce79a17672ca7c6d1efd5e90d44e3c5\n',
      'record/manifest.json': JSON.stringify({ deploymentId: 'cleartext-v14-sepolia-2027-01-01-1', chainId: 11155111 }),
      'record/addresses.sol': '',
      'record/journal.jsonl': '',
    })) {
      mkdirSync(dirname(join(root, next, path)), { recursive: true });
      writeFileSync(join(root, next, path), content);
    }
    writeFileSync(join(root, 'deployments/README.md'), '# records, edited\n');
    writeFileSync(join(root, 'deployments/ethereum_sepolia/README.md'), '# sepolia history\n');
    commitAll(root);
    assert.deepEqual(frozenMessages(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a base that cannot be resolved fails instead of passing', () => {
  const root = repository();
  try {
    assert.throws(() => checkDeployments({ workspaceRoot: root, base: 'no-such-ref' }), /cannot find the merge base/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("'check deployments' parses with and without --base", () => {
  const plain = parseCliOptions(['check', 'deployments']);
  if (plain.command !== 'check-deployments') throw new Error(`unexpected command ${plain.command}`);
  assert.equal(plain.base, undefined);

  const based = parseCliOptions(['check', 'deployments', '--base', 'origin/release/0.13.x']);
  if (based.command !== 'check-deployments') throw new Error(`unexpected command ${based.command}`);
  assert.equal(based.base, 'origin/release/0.13.x');
});
