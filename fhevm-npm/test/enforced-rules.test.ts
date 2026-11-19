import assert from 'node:assert/strict';
import { Command } from 'commander';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { addRuleIdOption, parseCli } from '../cli-options.ts';
import { ENFORCED_RULES, REQUIRED_OPTIONS } from '../enforced-rules.ts';

const CLI = fileURLToPath(new URL('../fhevm-npm.ts', import.meta.url));
const RULES = fileURLToPath(new URL('../../rules/fhevm-npm/rules/entries/', import.meta.url));
// Well formed, and no rule will ever have it: rule numbers start at 01.
const UNKNOWN_RULE = 'NR-00';
const LAUNCHER = './fhevm-npm-cli ';

/** Runs the CLI from an empty folder with an empty workspace root, so nothing it answers can come from files. */
function runCli(args: readonly string[]): { readonly status: number | null; readonly output: string } {
  const empty = mkdtempSync(join(tmpdir(), 'fhevm-npm-rule-id-'));
  const result = spawnSync(process.execPath, [CLI, '--root', empty, ...args], { cwd: empty, encoding: 'utf8' });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

/** A "no" is exit code 1 with no output, so a commander error, which prints, never passes for one. */
function assertNo(args: readonly string[]): void {
  assert.deepEqual(runCli(args), { status: 1, output: '' }, args.join(' '));
}

/** The options a checked-by names: the words from the first option on. */
function optionsOf(checkedBy: string): readonly string[] {
  const words = checkedBy.slice(LAUNCHER.length).split(' ');
  const firstOption = words.findIndex((word) => word.startsWith('-'));
  return firstOption === -1 ? [] : words.slice(firstOption);
}

/** The command a checked-by names: the words after the launcher, up to the first option. */
function commandOf(checkedBy: string): string {
  const words = checkedBy.slice(LAUNCHER.length).split(' ');
  const firstOption = words.findIndex((word) => word.startsWith('-'));
  return (firstOption === -1 ? words : words.slice(0, firstOption)).join(' ');
}

function answer(command: string, id: string, extra: readonly string[] = []): boolean {
  const options = parseCli([...command.split(' '), ...extra, '--rule-id', id]);
  assert.equal(options.command, 'rule-id', `${command} --rule-id ${id} must answer instead of running`);
  if (options.command !== 'rule-id') throw new Error('unreachable');
  return options.enforced;
}

type RuleEntry = { readonly id: string; readonly tag: string; readonly check: string; readonly checkedBy?: string };

function readRuleEntries(): readonly RuleEntry[] {
  return readdirSync(RULES)
    .filter((file) => file.endsWith('.md'))
    .map((file) => {
      const frontMatter = readFileSync(join(RULES, file), 'utf8').split('\n---')[0] ?? '';
      const field = (key: string): string | undefined =>
        new RegExp(`^${key}: "?([^"\\n]*)"?$`, 'm').exec(frontMatter)?.[1];
      return {
        id: field('id') ?? file,
        tag: field('tag') ?? '',
        check: field('check') ?? '',
        checkedBy: field('checked-by'),
      };
    });
}

test('--rule-id exits 0 when the command enforces the rule and 1 when it does not', () => {
  assert.equal(runCli(['check', 'names', '--rule-id', 'NR-01']).status, 0);
  assert.equal(runCli(['check', 'names', '--rule-id', 'NR-40']).status, 0);
  assertNo(['check', 'names', '--rule-id', 'NR-79']);
  assertNo(['check', 'names', '--rule-id', UNKNOWN_RULE]);
  assert.equal(runCli(['check', 'deployments', '--rule-id', 'NR-79']).status, 0);
});

test('--rule-id answers before required arguments and options are checked', () => {
  // `publish check` requires <payload>: the answer must not depend on it.
  assert.equal(runCli(['publish', 'check', '--rule-id', 'NR-38']).status, 0);
  // `scaffold` requires the option -o: the answer must not depend on it either.
  assertNo(['scaffold', '--rule-id', UNKNOWN_RULE]);
});

test('--rule-id prints nothing, so the words it receives never reach the output', () => {
  assert.equal(runCli(['check', 'names', '--rule-id', 'NR-01']).output, '');
  assert.equal(runCli(['check', 'names', '--rule-id', 'NR-79']).output, '');
});

test('an unknown command fails even with --rule-id', () => {
  assert.notEqual(runCli(['check', 'bogus', '--rule-id', 'NR-01']).status, 0);
});

test('--rule-id fails when the rest of the line is wrong, as the same line would without it', () => {
  assert.notEqual(runCli(['check', 'deployments', '--bse', 'main', '--rule-id', 'NR-84']).status, 0);
  assert.notEqual(runCli(['check', 'names', 'extra', '--rule-id', 'NR-01']).status, 0);
});

test('a rule that a check enforces only with an option is answered yes only with that option', () => {
  assertNo(['check', 'deployments', '--rule-id', 'NR-84']);
  assert.deepEqual(runCli(['check', 'deployments', '--base', 'main', '--rule-id', 'NR-84']), { status: 0, output: '' });
  assertNo(['sync', 'vendored', '--rule-id', 'NR-42a']);
  assert.deepEqual(runCli(['sync', 'vendored', '--check', '--rule-id', 'NR-42a']), { status: 0, output: '' });
  assertNo(['sync', 'pinned', '--rule-id', 'NR-21']);
  assert.deepEqual(runCli(['sync', 'pinned', '--check', '--rule-id', 'NR-21']), { status: 0, output: '' });
});

test('an option that turns the check off, or an empty value, does not count as the option', () => {
  // --digest prints the upstream digest instead of checking the copies, whatever --check says.
  assertNo(['sync', 'vendored', '--check', '--digest', '--rule-id', 'NR-42a']);
  assertNo(['check', 'deployments', '--base', '', '--rule-id', 'NR-84']);
});

test('the help command never answers --rule-id, so it cannot claim every rule', () => {
  assert.notEqual(runCli(['help', 'check', 'names', '--rule-id', UNKNOWN_RULE]).status, 0);
  assert.notEqual(runCli(['check', 'help', 'names', '--rule-id', UNKNOWN_RULE]).status, 0);
});

test('every leaf command gets --rule-id, and a table key that names no command is refused', () => {
  const program = new Command();
  program.command('alone');
  program.command('group').command('leaf');
  addRuleIdOption(program, { 'group leaf': ['NR-01'] });
  const leaves = [program.commands[0], program.commands[1]?.commands[0]];
  for (const leaf of leaves)
    assert.ok(
      leaf?.options.some((option) => option.long === '--rule-id'),
      leaf?.name(),
    );

  assert.throws(
    () => addRuleIdOption(new Command().addCommand(new Command('alone')), { 'group leafs': ['NR-01'] }),
    /'group leafs'/,
  );
});

test('every command of the table answers yes for each of its rules and no for an unknown rule', () => {
  const entries = new Map(readRuleEntries().map((entry) => [entry.id, entry]));
  for (const [command, ids] of Object.entries(ENFORCED_RULES)) {
    for (const id of ids) {
      // A rule that needs an option of this command has its own test above.
      if (REQUIRED_OPTIONS[command]?.[id] !== undefined && commandOf(entries.get(id)?.checkedBy ?? '') !== command)
        continue;
      const checkedBy = entries.get(id)?.checkedBy;
      const extra = checkedBy !== undefined && commandOf(checkedBy) === command ? optionsOf(checkedBy) : [];
      assert.equal(answer(command, id, extra), true, `${command} ${extra.join(' ')} --rule-id ${id}`);
    }
    assert.equal(answer(command, UNKNOWN_RULE), false, `${command} --rule-id ${UNKNOWN_RULE}`);
  }
});

test('a rule that two commands check between them is answered yes by both', () => {
  assert.equal(answer('check package-json', 'NR-53'), true);
  assert.equal(answer('check published-files', 'NR-53'), true);
  assert.equal(answer('check ownership', 'NR-55'), true);
  assert.equal(answer('check scripts', 'NR-55'), true);
});

test('a command outside the table enforces no rule', () => {
  assert.equal(answer('list-packages', 'NR-01'), false);
  assert.equal(answer('check safechain', 'NR-01'), false);
});

test('a content comparison does not claim the rule about check entry points', () => {
  assert.equal(answer('check mirror', 'NR-42'), false);
  assert.equal(answer('check vendored-origin', 'NR-42'), false);
  assert.equal(answer('check vendored-origin', 'NR-42a'), true);
});

test('every rule of the table is a live rule checked by a script', () => {
  const entries = new Map(readRuleEntries().map((entry) => [entry.id, entry]));
  for (const [command, ids] of Object.entries(ENFORCED_RULES)) {
    for (const id of ids) {
      const entry = entries.get(id);
      assert.ok(entry, `${command} lists ${id}, which has no file in rules/fhevm-npm/rules/entries/`);
      assert.notEqual(entry.tag, 'RETIRED', `${command} lists ${id}, which is retired`);
      assert.equal(entry.check, 'script', `${command} lists ${id}, whose front matter says check: ${entry.check}`);
      assert.ok(entry.checkedBy, `${command} lists ${id}, which has no checked-by`);
    }
  }
});

test('every checked-by that names this CLI names a command of the table that lists the rule', () => {
  for (const entry of readRuleEntries()) {
    if (entry.checkedBy === undefined || !entry.checkedBy.startsWith(LAUNCHER)) continue;
    const command = commandOf(entry.checkedBy);
    assert.ok(
      ENFORCED_RULES[command]?.includes(entry.id as `NR-${string}`),
      `${entry.id} says checked-by: ${entry.checkedBy}, but ENFORCED_RULES['${command}'] does not list it`,
    );
  }
});

test('every checked-by that reaches fhevm-npm goes through the launcher', () => {
  for (const entry of readRuleEntries()) {
    if (entry.checkedBy === undefined || !entry.checkedBy.includes('fhevm-npm')) continue;
    assert.ok(
      entry.checkedBy.startsWith(LAUNCHER),
      `${entry.id} says checked-by: ${entry.checkedBy}; use ${LAUNCHER}<command>`,
    );
  }
});

test('a rule that a check enforces only with an option names that option in its checked-by', () => {
  const entries = new Map(readRuleEntries().map((entry) => [entry.id, entry]));
  for (const [command, rules] of Object.entries(REQUIRED_OPTIONS)) {
    for (const [id, options] of Object.entries(rules)) {
      const checkedBy = entries.get(id)?.checkedBy ?? '';
      if (commandOf(checkedBy) !== command) continue;
      for (const option of options?.given ?? [])
        assert.ok(optionsOf(checkedBy).includes(`--${option}`), `${id}: ${checkedBy}`);
    }
  }
});

test('every rule ID a violation reports is a live rule', () => {
  const live = new Set(
    readRuleEntries()
      .filter((entry) => entry.tag !== 'RETIRED')
      .map((entry) => entry.id),
  );
  let found = 0;
  for (const [source, text] of readSources()) {
    // Any quote, and any text after NR-, so that a malformed ID such as NR-4 or NR-42A is caught too.
    for (const match of text.matchAll(/['"`](NR-[^'"`]*)['"`]/g)) {
      found += 1;
      assert.ok(live.has(match[1] ?? ''), `${source} reports ${match[1]}, which is not a live rule`);
    }
  }
  assert.ok(found > 50, `found only ${found} rule IDs in the sources; the scan is broken`);
});

/** The sources that can report a rule ID: everything but the table itself. */
function readSources(): ReadonlyMap<string, string> {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const topLevel = readdirSync(root).filter((file) => file.endsWith('.ts') && file !== 'enforced-rules.ts');
  const files = [...topLevel, ...['base', 'commands'].flatMap((folder) => readTsFiles(join(root, folder), folder))];
  return new Map(files.map((file) => [file, readFileSync(join(root, file), 'utf8')]));
}

function readTsFiles(folder: string, relative: string): readonly string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? readTsFiles(join(folder, entry.name), `${relative}/${entry.name}`)
      : entry.name.endsWith('.ts')
        ? [`${relative}/${entry.name}`]
        : [],
  );
}

/**
 * The commands that print the violations of each file that reports a rule ID. A file that starts
 * reporting rule IDs must be added here, so that the test below sees every printed ID.
 */
const PRINTED_BY: Readonly<Record<string, readonly string[]>> = {
  'base/checks/consumer-lockfiles.ts': ['check consumer-lockfiles'],
  'base/checks/dependencies.ts': ['check dependencies'],
  'base/checks/extraneous.ts': ['check extraneous'],
  'base/checks/foundry.ts': ['check foundry'],
  'base/checks/generation-parity.ts': ['check generation-parity'],
  'base/checks/generations.ts': ['check generations'],
  'base/checks/inventory.ts': ['check manifest-coverage'],
  'base/checks/lockfiles.ts': ['check lockfiles'],
  'base/checks/ownership.ts': ['check ownership'],
  'base/checks/package-json-paths.ts': ['check package-json-paths'],
  'base/checks/package-json.ts': ['check package-json'],
  'base/checks/package-names.ts': ['check names'],
  'base/checks/pinned-dependencies.ts': ['check pinned-dependencies'],
  'base/checks/published-files.ts': ['check published-files'],
  'base/checks/scripts.ts': ['check scripts'],
  'base/checks/tsc-mode.ts': ['check tsc-mode'],
  'base/checks/tsconfig-paths.ts': ['check tsconfig-paths'],
  'base/checks/vendored.ts': ['check vendored-origin'],
  'base/checks/workspaces.ts': ['check workspaces'],
  'base/publish-check.ts': ['publish check', 'publish rehearse'],
  'base/sync-vendored.ts': ['sync vendored', 'bump vendored'],
  'base/version-check.ts': ['version check', 'version apply'],
  'base/versions.ts': ['version check', 'version apply'],
  'commands/check-json-schemas.ts': ['check json-schemas'],
  'commands/sync-pinned.ts': ['sync pinned'],
};

test('every rule ID a command prints is listed under that command', () => {
  const missing: string[] = [];
  for (const [source, text] of readSources()) {
    const ids = [...text.matchAll(/['"`](NR-[^'"`]*)['"`]/g)].map((match) => match[1] ?? '');
    if (ids.length === 0) continue;
    const commands = PRINTED_BY[source];
    assert.ok(commands, `${source} reports ${[...new Set(ids)].join(', ')}; add it to PRINTED_BY`);
    for (const command of commands) {
      for (const id of new Set(ids)) {
        if (!ENFORCED_RULES[command]?.includes(id as `NR-${string}`)) missing.push(`'${command}': ${id} (${source})`);
      }
    }
  }
  assert.deepEqual(missing, []);
  const reporting = new Set(
    [...readSources()].filter(([, text]) => /['"`]NR-[^'"`]*['"`]/.test(text)).map(([source]) => source),
  );
  const stale = Object.keys(PRINTED_BY).filter((source) => !reporting.has(source));
  assert.deepEqual(stale, [], 'PRINTED_BY lists files that report no rule ID; remove them');
});
