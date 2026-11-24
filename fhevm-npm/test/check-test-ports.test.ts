import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

import { inspectTestPorts } from '../base/checks/test-ports.ts';
import { parseTestNpmManifest } from './helpers.ts';

const FAMILY = 'cleartext';
const CURRENT = `${FAMILY}/vB`;
const PREVIOUS = `${FAMILY}/vA`;
const FORGE_STD = 'foundry/forge-fhevm-std';

type Groups = Record<string, { range: [number, number]; ports: Record<string, number> }>;

/** A file that the check accepts, together with `SOURCES`. Each test breaks one thing in a copy. */
function groups(): Groups {
  return {
    shared: { range: [8545, 8545], ports: { 'anvil-default': 8545 } },
    [FORGE_STD]: { range: [8546, 8549], ports: { anvil: 8546, 'anvil-mirror': 8548 } },
    [PREVIOUS]: { range: [8550, 8699], ports: { deploy: 8558, 'fhe-rand': 8634 } },
    [CURRENT]: { range: [8700, 8799], ports: { deploy: 8700, 'fhe-rand': 8701 } },
  };
}

const SOURCES: Readonly<Record<string, string>> = {
  'common/src/constants.ts': 'export const ANVIL_PORT = 8545;\n',
  [`${FORGE_STD}/package.json`]: JSON.stringify({
    scripts: {
      test: 'forge test',
      'test:anvil': '../../scripts/with-anvil.sh --port 8546 -- forge test',
      'test:anvil-mirror': '../../scripts/with-anvil.sh --port 8548 -- forge test',
    },
  }),
  // The previous generation is frozen with numbers. The default port is no suite's own, so it is not one.
  [`${PREVIOUS}/test/e2e/deploy.test.ts`]: "const PORT = 8558;\nspawn('anvil', ['--port', String(PORT)]);\n",
  [`${PREVIOUS}/test/ts/fhe-rand.test.ts`]:
    "const anvil = startAnvil({ port: 8634 });\nconst rpc = 'http://127.0.0.1:8545';\n",
  [`${CURRENT}/test/e2e/deploy.test.ts`]:
    "const PORT = testPort('deploy');\nspawn('anvil', ['--port', String(PORT)]);\n",
  [`${CURRENT}/test/ts/fhe-rand.test.ts`]:
    "// A comment may say 8734.\nconst anvil = startAnvil({ port: testPort('fhe-rand') });\n",
};

function manifest(previous: string) {
  return parseTestNpmManifest({
    generations: { [FAMILY]: { current: `./${CURRENT}`, previous: `./${previous}` } },
    packageJson: { published: { required: ['name'], excluded: ['private'] } },
    packages: {
      '.': { kind: 'workspace-root', name: 'workspace', private: true, member: false },
      ...Object.fromEntries(
        [CURRENT, previous].flatMap((generation) => [
          [
            `./${generation}`,
            {
              kind: 'dev',
              name: `${generation.replace('/', '-')}-dev`,
              private: true,
              member: true,
              publishedRelPath: `./${generation}/pkg`,
            },
          ],
          [`./${generation}/pkg`, { kind: 'published', name: 'cleartext', member: generation === CURRENT }],
        ]),
      ),
    },
  });
}

/** The messages of the check on a workspace made of `SOURCES`, the given file and the given overrides. */
function violationsOf(
  file: unknown,
  sources: Readonly<Record<string, string | undefined>> = {},
  previous: string = PREVIOUS,
): string[] {
  const workspace = mkdtempSync(join(tmpdir(), 'fhevm-npm-test-ports-'));
  try {
    const write = (path: string, content: string): void => {
      mkdirSync(dirname(join(workspace, path)), { recursive: true });
      writeFileSync(join(workspace, path), content);
    };
    if (file !== undefined) write('test-ports.config.json', typeof file === 'string' ? file : JSON.stringify(file));
    for (const [path, content] of Object.entries({ ...SOURCES, ...sources })) {
      if (content !== undefined) write(path, content);
    }
    return inspectTestPorts(workspace, manifest(previous)).violations.map((violation) => {
      assert.equal(violation.rule, 'NR-92');
      return `${violation.packageKey}: ${violation.message}`;
    });
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}

function assertOne(violations: readonly string[], expected: RegExp): void {
  assert.equal(violations.length, 1, violations.join('\n'));
  assert.match(violations[0] ?? '', expected);
}

test('accepts a file whose groups keep to their ranges and whose sources use exactly their ports', () => {
  assert.deepEqual(violationsOf({ groups: groups() }), []);
});

test('refuses a file it cannot read, with one violation', () => {
  assertOne(violationsOf(undefined), /^\.\/test-ports\.config\.json: the file does not exist$/);
  assertOne(violationsOf('{'), /is not valid JSON/);
  assertOne(violationsOf({ ports: {} }), /must hold "groups"/);
  const stringPort = groups();
  (stringPort[CURRENT] as { ports: Record<string, unknown> }).ports.deploy = '8700';
  assertOne(violationsOf({ groups: stringPort }), /must hold "groups"/);
  const shortRange = groups();
  (shortRange[CURRENT] as { range: number[] }).range = [8700];
  assertOne(violationsOf({ groups: shortRange }), /must hold "groups"/);
});

test('refuses a missing group and a group that has no owner', () => {
  const { [PREVIOUS]: _dropped, ...withoutPrevious } = groups();
  assertOne(violationsOf({ groups: withoutPrevious }), /group 'cleartext\/vA' is missing/);

  // The group of a retired generation: the manifest no longer names it.
  const retired = violationsOf({ groups: groups() }, {}, 'cleartext/vZ');
  assert.ok(
    retired.some((message) => /group 'cleartext\/vA' has no owner/.test(message)),
    retired.join('\n'),
  );
  assert.ok(
    retired.some((message) => /group 'cleartext\/vZ' is missing/.test(message)),
    retired.join('\n'),
  );
});

test('refuses ranges that overlap, are out of order, or are empty', () => {
  const overlapping = groups();
  (overlapping[CURRENT] as { range: number[] }).range = [8699, 8799];
  const overlap = violationsOf({ groups: overlapping });
  assert.ok(overlap.some((message) => /starts at or before the end of the range of 'cleartext\/vA'/.test(message)));

  const { [CURRENT]: current, ...rest } = groups();
  const reordered = violationsOf({ groups: { [CURRENT]: current, ...rest } });
  assert.ok(
    reordered.some((message) => /group 'shared' has the range 8545-8545, which starts at or before/.test(message)),
  );

  const empty = groups();
  (empty[FORGE_STD] as { range: number[] }).range = [8549, 8546];
  assert.ok(violationsOf({ groups: empty }).some((message) => /has an empty range, 8549-8546/.test(message)));
});

test('refuses a port outside the range of its group', () => {
  const outside = groups();
  (outside[FORGE_STD] as { range: number[] }).range = [8546, 8547];
  assertOne(
    violationsOf({ groups: outside }),
    /port 'anvil-mirror' of group 'foundry\/forge-fhevm-std' is 8548, outside the range 8546-8547/,
  );
});

test('refuses ports that are not listed by increasing number, which covers a port listed twice', () => {
  const unsorted = groups();
  (unsorted[PREVIOUS] as { ports: Record<string, number> }).ports = { 'fhe-rand': 8634, deploy: 8558 };
  assertOne(
    violationsOf({ groups: unsorted }),
    /port 'deploy' of group 'cleartext\/vA' is 8558, not above 'fhe-rand', 8634/,
  );

  const twice = groups();
  (twice[PREVIOUS] as { ports: Record<string, number> }).ports = { deploy: 8558, 'fhe-rand': 8558 };
  const violations = violationsOf({ groups: twice });
  assert.ok(
    violations.some((message) => /is 8558, not above 'deploy', 8558/.test(message)),
    violations.join('\n'),
  );
});

test('refuses a current generation that does not fill its range from the first port', () => {
  const gap = groups();
  (gap[CURRENT] as { ports: Record<string, number> }).ports = { deploy: 8700, 'fhe-rand': 8710 };
  assertOne(violationsOf({ groups: gap }), /port 'fhe-rand' of group 'cleartext\/vB' is 8710, expected 8701/);
});

test('refuses a shared group that is not the default anvil port', () => {
  const moved = groups();
  (moved.shared as Groups[string]) = { range: [8544, 8544], ports: { 'anvil-default': 8544 } };
  const violations = violationsOf({ groups: moved });
  assert.ok(
    violations.some((message) =>
      /group 'shared' holds \{ anvil-default: 8544 \}, expected \{ anvil-default: 8545 \}/.test(message),
    ),
    violations.join('\n'),
  );
  assertOne(
    violationsOf({ groups: groups() }, { 'common/src/constants.ts': 'export const OTHER = 1;\n' }),
    /^\.\/common\/src\/constants\.ts: cannot read 'export const ANVIL_PORT/,
  );
});

test('refuses forge-fhevm-std scripts and a group that disagree', () => {
  const script = (port: number, mirror = "'test:anvil-mirror'"): string =>
    JSON.stringify({
      scripts: {
        'test:anvil': `../../scripts/with-anvil.sh --port ${String(port)} -- forge test`,
        ...(mirror === '' ? {} : { 'test:anvil-mirror': '../../scripts/with-anvil.sh --port 8548 -- forge test' }),
      },
    });
  assertOne(
    violationsOf({ groups: groups() }, { [`${FORGE_STD}/package.json`]: script(8547) }),
    /package\.json: script 'test:anvil' starts its node on 8547, and group .* gives 'anvil' 8546/,
  );
  assertOne(
    violationsOf({ groups: groups() }, { [`${FORGE_STD}/package.json`]: script(8546, '') }),
    /port 'anvil-mirror' of group 'foundry\/forge-fhevm-std' has no script 'test:anvil-mirror'/,
  );
  assertOne(
    violationsOf(
      { groups: groups() },
      { [`${FORGE_STD}/package.json`]: JSON.stringify({ scripts: { 'test:new': 'with-anvil.sh -- forge test' } }) },
    ).slice(0, 1),
    /cannot read the port of script 'test:new'/,
  );
});

test('refuses every way a test of the current generation spells a port without the file', () => {
  const path = `${CURRENT}/test/ts/fhe-rand.test.ts`;
  const spelled = (code: string): string[] => violationsOf({ groups: groups() }, { [path]: code });
  const named = "startAnvil({ port: testPort('fhe-rand') });\n";

  for (const code of [
    'const anvil = startAnvil({ port: 8799 });',
    'const stack = await deployStack(8799);',
    "const args = ['--port', '8799'];",
    'const options = { port: 8799 };',
    "const rpc = 'http://127.0.0.1:8799';",
    "const rpc = 'http://localhost:8799';",
  ]) {
    const violations = spelled(`${named}${code}\n`);
    assert.ok(
      violations.some((message) => /fhe-rand\.test\.ts:2: spells the port 8799/.test(message)),
      code,
    );
  }

  // A number that is no port, and the default port, are not spelled ports.
  assert.deepEqual(spelled(`${named}const rpc = 'http://127.0.0.1:1';\nconst url = 'http://localhost:8545';\n`), []);

  assertOne(
    spelled("const port = testPort('fhe-rand');\nstartAnvil({ port: port + 1 });\n"),
    /'startAnvil\(\{ port: port \+ 1' starts a node on a port that is not exactly testPort/,
  );
  // The shorthand passes: the helper's callers are the ones that name the port.
  assert.deepEqual(spelled("const port = testPort('fhe-rand');\nstartAnvil({ port });\n"), []);

  const computed = spelled("const name = 'fhe-rand';\nstartAnvil({ port: testPort(name) });\n");
  assert.ok(
    computed.some((message) => /fhe-rand\.test\.ts:2: calls testPort\(\) without a literal 'name'/.test(message)),
  );

  const deploy = `${CURRENT}/test/e2e/deploy.test.ts`;
  assertOne(
    violationsOf(
      { groups: groups() },
      { [deploy]: "const PORT = testPort('deploy');\nspawn('anvil', ['--port', '0']);\n" },
    ),
    /deploy\.test\.ts: spawns anvil without/,
  );
});

test('refuses names of the current generation that the tests and the group do not share one to one', () => {
  const path = `${CURRENT}/test/ts/fhe-rand.test.ts`;

  assertOne(
    violationsOf({ groups: groups() }, { [path]: '// No node here.\n' }),
    /port 'fhe-rand' of group 'cleartext\/vB' is read by no test/,
  );
  const unknown = violationsOf(
    { groups: groups() },
    { [path]: "startAnvil({ port: testPort('fhe-rand') });\nstartAnvil({ port: testPort('new') });\n" },
  );
  assertOne(unknown, /fhe-rand\.test\.ts:2: reads the port 'new', which group 'cleartext\/vB' does not have/);

  const twice = violationsOf(
    { groups: groups() },
    { [path]: "startAnvil({ port: testPort('fhe-rand') });\nstartAnvil({ port: testPort('fhe-rand') });\n" },
  );
  assertOne(twice, /port 'fhe-rand' of group 'cleartext\/vB' is read 2 times/);

  // No test file at all: the scan found nothing, and says so before it compares anything.
  const none = violationsOf(
    { groups: groups() },
    { [path]: undefined, [`${CURRENT}/test/e2e/deploy.test.ts`]: undefined },
  );
  assert.ok(none.some((message) => /found no testPort\('<name>'\) call .* refusing to pass vacuously/.test(message)));
});

test('holds the frozen generation to the numbers of its group, in both directions', () => {
  const path = `${PREVIOUS}/test/ts/fhe-rand.test.ts`;
  assertOne(
    violationsOf({ groups: groups() }, { [path]: 'const anvil = startAnvil({ port: 8635 });\n' }).slice(0, 1),
    /fhe-rand\.test\.ts:1: starts a node on 8635, which group 'cleartext\/vA' .* does not record/,
  );
  const unused = violationsOf({ groups: groups() }, { [path]: '// The suite is gone.\n' });
  assertOne(unused, /port 'fhe-rand' of group 'cleartext\/vA', 8634, is used by no test/);

  // After a rotation the frozen generation reads names: they resolve in its own group.
  assert.deepEqual(violationsOf({ groups: groups() }, { [path]: "startAnvil({ port: testPort('fhe-rand') });\n" }), []);
  assertOne(
    violationsOf(
      { groups: groups() },
      { [path]: "startAnvil({ port: 8634 });\nstartAnvil({ port: testPort('gone') });\n" },
    ),
    /fhe-rand\.test\.ts:2: reads the port 'gone', which group 'cleartext\/vA' does not have/,
  );
});
