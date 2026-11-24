import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test, { type TestContext } from 'node:test';

import { computedEnvReads, envVarUsesOfFile, shellEnvVarUses } from '../base/checks/env-var-uses.ts';
import { inspectEnvVars } from '../base/checks/env-vars.ts';
import { parseTestNpmManifest } from './helpers.ts';

/** The uses of one file, as `<kind> <name>`, with `<...>` after the start of a family of names. */
function usesOf(path: string, text: string): readonly string[] {
  return envVarUsesOfFile({ path, text }).map((use) => `${use.kind} ${use.name}${use.isPrefix ? '<...>' : ''}`);
}

////////////////////////////////////////////////////////////////////////////////
// What a file uses
////////////////////////////////////////////////////////////////////////////////

test('a script reads a variable through process.env, an environment it receives, or a Hardhat variable', () => {
  const text = [
    'const a = process.env.ALPHA_ONE;',
    "const b = process.env['BETA_TWO'];",
    'function read(env: NodeJS.ProcessEnv) { return env.GAMMA_THREE ?? environment["DELTA_FOUR"]; }',
    "const c = vars.get('EPSILON_FIVE', ''); const d = configVariable('ZETA_SIX');",
    "const e = getEnvString({ name: 'ETA_SEVEN', dotEnvFile });",
    'const notOne = options.env.lowercase + something.THETA;',
  ].join('\n');

  assert.deepEqual(usesOf('pkg/src/a.ts', text), [
    'read ALPHA_ONE',
    'read BETA_TWO',
    'read GAMMA_THREE',
    'read DELTA_FOUR',
    'read EPSILON_FIVE',
    'read ZETA_SIX',
    'read ETA_SEVEN',
  ]);
});

test('a constant whose identifier says VARIABLE names its variables, and one that says PREFIX a family', () => {
  const text = [
    "export const REPORT_VARIABLE = 'ALPHA_REPORT';",
    "const RPC_VARIABLE_OF_CHAIN_ID = new Map([[1, 'ALPHA_RPC_URL'], [2, 'BETA_RPC_URL']]);",
    "export const REF_VARIABLE_PREFIX = 'ALPHA_REF_';",
    "const TITLE = 'NOT_A_VARIABLE';",
    "const VARIANT = 'ALSO_NOT_ONE';",
  ].join('\n');

  assert.deepEqual(usesOf('pkg/src/a.ts', text), [
    'declared ALPHA_REPORT',
    'declared ALPHA_RPC_URL',
    'declared BETA_RPC_URL',
    'declared ALPHA_REF_<...>',
  ]);
});

test('a script sets the variables of the environment it gives to a process it starts', () => {
  const text = "spawn('forge', [], { env: { ...process.env, ALPHA_URL: url, BETA_FLAG: 'true', [KEY]: value } });";

  assert.deepEqual(usesOf('pkg/src/a.ts', text), ['set ALPHA_URL', 'set BETA_FLAG']);
});

test('a name in a comment is no use, and a name after a URL or a glob in a text still is', () => {
  const text = [
    '// process.env.IN_A_LINE_COMMENT',
    '/* process.env.IN_A_BLOCK_COMMENT */',
    "const url = 'https://example.invalid'; const a = process.env.AFTER_A_URL;",
    "const glob = 'test/anvil/*'; const b = process.env.AFTER_A_GLOB; /* a comment */",
    'const pattern = /[\'"]quoted[\'"]/; const c = process.env.AFTER_A_PATTERN; // a comment',
  ].join('\n');

  assert.deepEqual(usesOf('pkg/src/a.ts', text), ['read AFTER_A_URL', 'read AFTER_A_GLOB', 'read AFTER_A_PATTERN']);
});

test('Solidity reads a variable with a cheatcode, or names it in a constant', () => {
  const text = [
    'string memory url = vm.envOr("ALPHA_RPC_URL", string(""));',
    'uint256 key = vm.envUint("BETA_KEY");',
    'string private constant SKIP_VAR = "GAMMA_SKIP";',
    '// vm.envString("IN_A_COMMENT")',
    'string memory built = VM.envOr(string.concat(alias, "_RPC_URL"), string(""));',
  ].join('\n');

  assert.deepEqual(usesOf('pkg/test/A.t.sol', text), ['read ALPHA_RPC_URL', 'read BETA_KEY', 'declared GAMMA_SKIP']);
});

test('a foundry.toml, a Makefile, a workflow, an npm script and an env example each have their forms', () => {
  assert.deepEqual(usesOf('pkg/foundry.toml', 'needs_env = "${ALPHA_UNSET}"\n'), ['read ALPHA_UNSET']);
  assert.deepEqual(
    usesOf(
      'Makefile',
      'ALPHA_LOG ?= out.log\nci: export BETA_LOG ?= x\nt:\n\tGAMMA_FLOOR=$$floor $(MAKE) ci\n\trm "$${DELTA_TMP:-/tmp}/x"\n',
    ),
    ['declared ALPHA_LOG', 'declared BETA_LOG', 'set GAMMA_FLOOR', 'read DELTA_TMP'],
  );
  assert.deepEqual(
    usesOf(
      '.github/workflows/a.yml',
      'jobs:\n  a:\n    env:\n      ALPHA_TOKEN: x\n      # BETA_COMMENT: y\n    steps:\n      - run: echo\n        with:\n          GAMMA_INPUT: z\n',
    ),
    ['set ALPHA_TOKEN'],
  );
  assert.deepEqual(
    usesOf(
      'pkg/package.json',
      JSON.stringify({ scripts: { test: 'ALPHA_PROFILE=debug forge test', fmt: 'prettier "**/*.{js,ts}"' } }),
    ),
    ['set ALPHA_PROFILE'],
  );
  assert.deepEqual(usesOf('.env.example', '# A comment\nALPHA_URL=\nBETA_URL=\n'), [
    'declared ALPHA_URL',
    'declared BETA_URL',
  ]);
});

test('a shell script reads a variable that no script of its folder assigns, and sets what it exports', () => {
  const uses = shellEnvVarUses([
    {
      path: 'scripts/a.sh',
      text: '# usage: ALPHA_KEY=0x1 ./a.sh\nurl="${ALPHA_URL:-https://x}"\n: "${ALPHA_KEY:?set it}"\necho "${LOCAL_ONE:-}" "${OTHER_FILE:-}"\nexport BETA_DEPTH=1\nLOCAL_ONE=1\n',
    },
    { path: 'scripts/b.sh', text: 'OTHER_FILE=2\n' },
    { path: 'elsewhere/c.sh', text: 'echo "${OTHER_FILE:-}"\n' },
  ]);

  assert.deepEqual(
    uses.map((use) => `${use.file} ${use.kind} ${use.name}`),
    [
      'scripts/a.sh read ALPHA_URL',
      'scripts/a.sh read ALPHA_KEY',
      'scripts/a.sh set BETA_DEPTH',
      'elsewhere/c.sh read OTHER_FILE',
    ],
  );
});

test('a read of process.env by a computed name is found, unless a constant that names the variable gives it', () => {
  const text = 'const a = process.env[name];\nconst b = process.env[REPORT_VARIABLE];\n// process.env[inAComment]\n';

  assert.deepEqual(computedEnvReads({ path: 'fhevm-npm/a.ts', text }), [{ line: 1, expression: 'name' }]);
});

////////////////////////////////////////////////////////////////////////////////
// The lists against a workspace
////////////////////////////////////////////////////////////////////////////////

type Lists = {
  readonly envVarNames?: readonly string[];
  readonly toolEnvVarNames?: readonly string[];
};

type Workspace = Lists & {
  readonly context: TestContext;
  readonly sources: Readonly<Record<string, string>>;
};

/** The messages of the check on a workspace made of the given sources and lists, each with its file. */
function violationsOf(workspace: Workspace): readonly string[] {
  const root = mkdtempSync(join(tmpdir(), 'check-env-vars-'));

  workspace.context.after(() => rmSync(root, { recursive: true, force: true }));
  // The check asks git for the files of the workspace.
  execFileSync('git', ['init', '--quiet', root]);

  for (const [path, text] of Object.entries(workspace.sources)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }

  const manifest = parseTestNpmManifest({
    envVarNames: workspace.envVarNames ?? [],
    toolEnvVarNames: workspace.toolEnvVarNames ?? [],
    packageJson: { published: { required: ['name'], excluded: ['private'] } },
    packages: { '.': { kind: 'workspace-root', name: 'workspace', private: true, member: false } },
  });

  return inspectEnvVars({ workspaceRoot: root, manifest }).violations.map((violation) => {
    return `${violation.packageKey}: ${violation.message}`;
  });
}

const SOURCES = {
  'pkg/src/read.ts': 'export const url = process.env.ALPHA_RPC_URL;\n',
  'pkg/test/A.t.sol': 'contract A { function f() public { vm.envOr("BETA_KEY", uint256(0)); } }\n',
  'pkg/package.json': JSON.stringify({ scripts: { test: 'TOOL_PROFILE=debug forge test' } }),
};
const LISTS = { envVarNames: ['ALPHA_RPC_URL', 'BETA_KEY'], toolEnvVarNames: ['TOOL_PROFILE'] };

test('a workspace whose every variable is listed, and whose every listed variable is used, has no violation', (context) => {
  assert.deepEqual(violationsOf({ context, sources: SOURCES, ...LISTS }), []);
});

test('a variable that a file reads or sets, and that no list holds, is a violation of that file', (context) => {
  const violations = violationsOf({ context, sources: SOURCES, envVarNames: ['BETA_KEY'], toolEnvVarNames: [] });

  assert.equal(violations.length, 2);
  assert.match(
    violations[0] ?? '',
    /^\.\/pkg\/package\.json: line 1 sets the environment variable TOOL_PROFILE, which/,
  );
  assert.match(
    violations[1] ?? '',
    /^\.\/pkg\/src\/read\.ts: line 1 reads the environment variable ALPHA_RPC_URL, which/,
  );
});

test('a listed variable that no file uses is a violation of the manifest', (context) => {
  const violations = violationsOf({
    context,
    sources: SOURCES,
    ...LISTS,
    envVarNames: ['ALPHA_RPC_URL', 'BETA_KEY', 'GAMMA_GONE'],
  });

  assert.deepEqual(violations, [
    "./npm-manifest.json: 'GAMMA_GONE' is listed, and no file reads, sets or names it: remove it from the list",
  ]);
});

test('a name with a placeholder lists every name it stands for, and is not asked to be used', (context) => {
  const sources = {
    ...SOURCES,
    'pkg/src/more.ts':
      "export const a = process.env.GAMMA_RPC_URL;\nexport const REF_VARIABLE_PREFIX = 'DELTA_REF_';\n",
  };
  const envVarNames = ['<ALIAS>_RPC_URL', 'BETA_KEY', 'DELTA_REF_<GENERATION>', 'NEVER_<READ>'];

  assert.deepEqual(violationsOf({ context, sources, envVarNames, toolEnvVarNames: ['TOOL_PROFILE'] }), []);
});

test('a list is sorted, holds each name once and in one list only, and holds names only', (context) => {
  const violations = violationsOf({
    context,
    sources: SOURCES,
    envVarNames: ['BETA_KEY', 'ALPHA_RPC_URL', 'TOOL_PROFILE'],
    toolEnvVarNames: ['TOOL_PROFILE', 'TOOL_PROFILE', 'not a name'],
  });

  assert.deepEqual(violations, [
    './npm-manifest.json: envVarNames is not sorted: expected ALPHA_RPC_URL, BETA_KEY, TOOL_PROFILE',
    "./npm-manifest.json: toolEnvVarNames holds 'TOOL_PROFILE' more than once",
    "./npm-manifest.json: 'not a name' is not the name of an environment variable, with or without <PLACEHOLDER> parts",
    "./npm-manifest.json: 'TOOL_PROFILE' is in envVarNames and in toolEnvVarNames: a variable has one list",
    "./npm-manifest.json: 'not a name' is listed, and no file reads, sets or names it: remove it from the list",
  ]);
});

test('fhevm-npm reads no variable by a computed name, outside its tests', (context) => {
  const sources = {
    'fhevm-npm/base/a.ts': 'export const a = process.env[name];\n',
    'fhevm-npm/test/a.test.ts': 'const before = process.env[name];\n',
    'pkg/src/a.ts': 'export const b = process.env[name];\n',
  };
  const violations = violationsOf({ context, sources });

  assert.equal(violations.length, 1);
  assert.match(
    violations[0] ?? '',
    /^\.\/fhevm-npm\/base\/a\.ts: line 1 reads process\.env with a computed name, 'name'/,
  );
});

test('the check does not read what another repository owns, the prose, or the records', (context) => {
  const read = 'export const a = process.env.NEVER_LISTED;\n';
  const sources = {
    'pkg/node_modules/x/a.ts': read,
    'pkg/dependencies/forge-std/a.ts': read,
    'common-vendored/a.ts': read,
    'rules/a.ts': read,
    'pkg/README.md': 'Set `process.env.NEVER_LISTED`.\n',
    'deployments/a.ts': read,
  };

  assert.deepEqual(violationsOf({ context, sources }), []);
});
