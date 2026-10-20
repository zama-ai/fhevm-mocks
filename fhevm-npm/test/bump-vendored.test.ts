import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { bumpVendored, editPinnedSources, normalizeRepository, resolveTag } from '../base/bump-vendored.ts';
import type { Downloader } from '../base/vendored-download.ts';

const REPOSITORY = 'https://github.com/zama-ai/fhevm';
const OLD = '07fb05fb75f0aa6cea934088640ddb4539d0b1b9';
const NEW = '096ad11a3ac3aff466f2a5cf03788eae655311ca';
const OTHER = 'https://github.com/zama-ai/other';

/** A downloader answering per commit, each with a GitHub-shaped tarball; nothing reaches the network. */
function serving(trees: Readonly<Record<string, Readonly<Record<string, string>>>>): Downloader {
  const archives = new Map<string, string>();
  for (const [commit, files] of Object.entries(trees)) {
    const staging = mkdtempSync(join(tmpdir(), 'fhevm-npm-bump-archive-'));
    const root = `fhevm-${commit}`;
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(join(staging, root, path, '..'), { recursive: true });
      writeFileSync(join(staging, root, path), content);
    }
    const archive = join(staging, 'prepared.tar.gz');
    execFileSync('tar', ['-czf', archive, '-C', staging, root]);
    archives.set(commit, archive);
  }
  return (url, destination) => {
    const commit = url.slice(url.lastIndexOf('/') + 1);
    const archive = archives.get(commit);
    if (archive === undefined) throw new Error(`no archive prepared for ${url}`);
    copyFileSync(archive, destination);
  };
}

const remoteRefs = (_repository: string, tag: string): string =>
  tag === 'v0.13.6' ? `deadbeef\trefs/tags/v0.13.6\n${NEW}\trefs/tags/v0.13.6^{}\n` : '';

/** Copies on disk are stored as `forge fmt` writes them, so the fixture must be too or it reads as drift. */
function fmt(source: string): string {
  return execFileSync('forge', ['fmt', '--raw', '-'], { encoding: 'utf8', input: source });
}

const ACL_OLD = 'pragma solidity ^0.8.24;\ncontract ACL { uint256 x; }\n';
const ACL_NEW = 'pragma solidity ^0.8.24;\ncontract ACL { uint256 x; uint256 y; }\n';
const CONFIG = 'pragma solidity ^0.8.24;\nlibrary ZamaConfig { uint256 constant A = 1; }\n';

function workspace(): { root: string; manifestFile: string; cacheRoot: string } {
  const root = mkdtempSync(join(process.cwd(), '.tmp-bump-vendored-'));
  mkdirSync(join(root, 'gen', 'pkg', 'src', 'contracts'), { recursive: true });
  mkdirSync(join(root, 'gen', 'internal', 'zama-config'), { recursive: true });
  mkdirSync(join(root, 'lib', 'pkg', 'src', 'other'), { recursive: true });
  writeFileSync(join(root, 'gen', 'package.json'), '{"name":"gen-dev","private":true}\n');
  writeFileSync(join(root, 'gen', 'pkg', 'package.json'), '{"name":"gen"}\n');
  writeFileSync(join(root, 'lib', 'pkg', 'package.json'), '{"name":"lib"}\n');
  writeFileSync(join(root, 'gen', 'pkg', 'src', 'contracts', 'ACL.sol'), fmt(ACL_OLD));
  writeFileSync(join(root, 'gen', 'internal', 'zama-config', 'ZamaConfig.sol'), fmt(CONFIG));
  writeFileSync(join(root, 'lib', 'pkg', 'src', 'other', 'Other.sol'), 'pragma solidity ^0.8.24;\n');
  writeFileSync(join(root, '.prettierrc'), '{ "printWidth": 120 }\n');
  writeFileSync(join(root, 'package.json'), '{"name":"workspace","private":true}\n');

  const pin = (from: string, digest: string) => ({ repository: REPOSITORY, tag: 'v0.13.2', commit: OLD, digest, from });
  const manifest = {
    packageJson: { published: { required: ['name', 'version'], excluded: ['private'] } },
    packages: {
      '.': { kind: 'workspace-root', type: 'esm', browser: false, name: 'workspace', private: true, member: false },
      './gen': {
        kind: 'dev',
        type: 'esm',
        browser: false,
        name: 'gen-dev',
        private: true,
        member: true,
        publishedRelPath: './gen/pkg',
        vendored: [
          { relPath: './internal/zama-config', source: pin('library-solidity/config', 'sha256-old1'), reason: 'r' },
        ],
      },
      './gen/pkg': {
        kind: 'published',
        type: 'esm',
        browser: false,
        name: 'gen',
        member: false,
        vendored: [{ relPath: './src/contracts', source: pin('host-contracts/contracts', 'sha256-old2'), reason: 'r' }],
      },
      './lib/pkg': {
        kind: 'published',
        type: 'esm',
        browser: false,
        name: 'lib',
        member: false,
        vendored: [
          {
            relPath: './src/other',
            source: { repository: OTHER, tag: 'v1', commit: OLD, digest: 'sha256-other', from: 'x' },
            reason: 'r',
          },
        ],
      },
    },
  };
  const manifestFile = join(root, 'npm-manifest.json');
  writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  const cacheRoot = mkdtempSync(join(tmpdir(), 'fhevm-npm-bump-cache-'));
  return { root, manifestFile, cacheRoot };
}

const trees = {
  [NEW]: {
    'host-contracts/contracts/ACL.sol': ACL_NEW,
    'host-contracts/contracts/shared/New.sol': 'pragma solidity ^0.8.24;\ncontract New {}\n',
    'library-solidity/config/ZamaConfig.sol': CONFIG,
  },
};

test('the tag resolves to its peeled commit, and a lightweight tag to the plain ref', () => {
  assert.equal(resolveTag(REPOSITORY, 'v0.13.6', remoteRefs), NEW);
  assert.equal(
    resolveTag(REPOSITORY, 'light', () => `${OLD}\trefs/tags/light\n`),
    OLD,
  );
  assert.throws(() => resolveTag(REPOSITORY, 'nope', remoteRefs), /has no tag 'nope'/);
  assert.equal(normalizeRepository('https://github.com/zama-ai/fhevm.git/'), REPOSITORY);
});

test('every pin from the repository moves together; another repository is untouched', async () => {
  const { root, manifestFile, cacheRoot } = workspace();
  process.env['FHEVM_NPM_TEST_CACHE'] = cacheRoot;
  try {
    const result = await bumpVendored({
      workspaceRoot: root,
      manifestFile,
      selector: './gen',
      repository: `${REPOSITORY}.git`,
      tag: 'v0.13.6',
      check: false,
      download: serving(trees),
      remoteRefs,
      cacheRoot,
    });
    assert.equal(result.commit, NEW);
    assert.deepEqual(result.violations, []);
    assert.deepEqual(result.entries.map((entry) => `${entry.packageKey} ${entry.relPath}`).sort(), [
      './gen ./internal/zama-config',
      './gen/pkg ./src/contracts',
    ]);

    // The manifest: both fhevm pins moved with fresh digests, the other repository's did not.
    const manifest = JSON.parse(readFileSync(manifestFile, 'utf8')) as {
      packages: Record<string, { vendored: Array<{ source: { tag: string; commit: string; digest: string } }> }>;
    };
    for (const key of ['./gen', './gen/pkg']) {
      const source = manifest.packages[key]!.vendored[0]!.source;
      assert.equal(source.tag, 'v0.13.6');
      assert.equal(source.commit, NEW);
      assert.match(source.digest, /^sha256-/);
      assert.notEqual(source.digest, 'sha256-old1');
    }
    assert.equal(manifest.packages['./lib/pkg']!.vendored[0]!.source.commit, OLD);
    assert.equal(manifest.packages['./lib/pkg']!.vendored[0]!.source.digest, 'sha256-other');
    assert.equal(result.manifestWritten, true);

    // The copies: ACL rewritten, a new upstream file adopted, the unchanged config left alone.
    const acl = readFileSync(join(root, 'gen', 'pkg', 'src', 'contracts', 'ACL.sol'), 'utf8');
    assert.match(acl, /uint256 y;/);
    assert.ok(existsSync(join(root, 'gen', 'pkg', 'src', 'contracts', 'shared', 'New.sol')));
    const written = result.sync?.written ?? [];
    assert.ok(written.some((path) => path.endsWith('src/contracts/ACL.sol')));
    assert.ok(!written.some((path) => path.includes('zama-config')), 'config bytes did not change');

    // The provenance block in each owning package.json follows.
    for (const dir of [join(root, 'gen'), join(root, 'gen', 'pkg')]) {
      const packageJson = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
        fhevm: { vendoredFrom: { tag: string; commit: string } };
      };
      assert.equal(packageJson.fhevm.vendoredFrom.tag, 'v0.13.6');
      assert.equal(packageJson.fhevm.vendoredFrom.commit, NEW);
    }
    assert.ok(!existsSync(join(root, 'lib', 'pkg', 'package.json.bak')));
    assert.equal(
      JSON.parse(readFileSync(join(root, 'lib', 'pkg', 'package.json'), 'utf8')).fhevm,
      undefined,
      'the other repository owner is untouched',
    );

    // A second run at the same tag is a no-op: nothing to write, no violation.
    const again = await bumpVendored({
      workspaceRoot: root,
      manifestFile,
      selector: './gen',
      tag: 'v0.13.6',
      check: true,
      download: serving(trees),
      remoteRefs,
      cacheRoot,
    });
    assert.deepEqual(again.violations, []);
    assert.ok(again.entries.every((entry) => !entry.copiesChange));
    assert.equal(again.manifestWritten, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(cacheRoot, { recursive: true, force: true });
  }
});

test('--check writes nothing and names what would move', async () => {
  const { root, manifestFile, cacheRoot } = workspace();
  try {
    const before = readFileSync(manifestFile, 'utf8');
    const result = await bumpVendored({
      workspaceRoot: root,
      manifestFile,
      selector: './gen/',
      tag: 'v0.13.6',
      check: true,
      download: serving(trees),
      remoteRefs,
      cacheRoot,
    });
    assert.equal(readFileSync(manifestFile, 'utf8'), before);
    // The contracts tree differs upstream, the config tree does not — said per entry, without writing.
    const byPath = new Map(result.entries.map((entry) => [entry.relPath, entry.copiesChange]));
    assert.equal(byPath.get('./src/contracts'), true);
    assert.equal(byPath.get('./internal/zama-config'), false);
    assert.equal(readFileSync(join(root, 'gen', 'pkg', 'src', 'contracts', 'ACL.sol'), 'utf8'), fmt(ACL_OLD));
    assert.ok(result.violations.some((v) => v.rule === 'vendored-bump' && /v0\.13\.2 → v0\.13\.6/.test(v.message)));
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(cacheRoot, { recursive: true, force: true });
  }
});

test('a selection that pins nothing, or several repositories without --repository, is refused', async () => {
  const { root, manifestFile, cacheRoot } = workspace();
  const common = {
    workspaceRoot: root,
    manifestFile,
    tag: 'v1',
    commit: NEW,
    check: true,
    download: serving(trees),
    remoteRefs,
  };
  try {
    await assert.rejects(bumpVendored({ ...common, selector: './nothing' }), /is pinned/);
    await assert.rejects(
      bumpVendored({ ...common, selector: './gen', repository: 'https://github.com/zama-ai/nothing' }),
      /pins https:\/\/github\.com\/zama-ai\/nothing/,
    );
    // `.` covers every package, and the workspace pins two upstreams: ambiguous without --repository.
    await assert.rejects(bumpVendored({ ...common, selector: '.' }), /pins 2 repositories.*pass --repository/);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(cacheRoot, { recursive: true, force: true });
  }
});

test('the manifest edit touches the moved fields only: expanded objects, escapes and spacing survive', () => {
  const text = `{
  "foundry": {
    "version": "1.5.1"
  },
  "packages": {
    "./gen": {
      "note": "a \\u2014 dash and a literal — dash",
      "vendored": [
        { "relPath": "./ts", "source": "./common/src", "reason": "local" },
        {
          "relPath": "./internal/zama-config",
          "source": {
            "repository": "https://github.com/zama-ai/fhevm",
            "tag": "v0.13.2",
            "commit": "${OLD}",
            "from": "library-solidity/config"
          },
          "reason": "no digest yet"
        }
      ]
    },
    "./gen/pkg": {
      "vendored": [
        {
          "relPath": "./src/contracts",
          "source": {
            "repository": "https://github.com/zama-ai/fhevm",
            "tag": "v0.13.2",
            "commit": "${OLD}",
            "digest": "sha256-old",
            "from": "host-contracts/contracts"
          },
          "reason": "r"
        }
      ]
    }
  }
}
`;
  const json = JSON.parse(text) as Parameters<typeof editPinnedSources>[1];
  for (const pkg of Object.values(json.packages)) {
    for (const element of pkg.vendored ?? []) {
      if (typeof element.source === 'string') continue;
      element.source.tag = 'v0.13.6';
      element.source.commit = NEW;
      element.source.digest = 'sha256-new';
    }
  }
  const edited = editPinnedSources(text, json);
  const expected = text
    .replaceAll('"tag": "v0.13.2"', '"tag": "v0.13.6"')
    .replaceAll(`"commit": "${OLD}"`, `"commit": "${NEW}"`)
    .replace('"digest": "sha256-old"', '"digest": "sha256-new"')
    .replace(
      `"commit": "${NEW}",\n            "from": "library-solidity/config"`,
      `"commit": "${NEW}",\n            "digest": "sha256-new",\n            "from": "library-solidity/config"`,
    );
  assert.equal(edited, expected);
  assert.deepEqual(JSON.parse(edited), json);
});
