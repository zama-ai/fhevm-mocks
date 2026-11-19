import assert from 'node:assert/strict';
import { Command } from 'commander';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { addRuleIdOption, parseCli } from '../cli-options.ts';
import { ENFORCED_RULES } from '../enforced-rules.ts';

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

/** The command a checked-by names: the words after the launcher, up to the first option. */
function commandOf(checkedBy: string): string {
  const words = checkedBy.slice(LAUNCHER.length).split(' ');
  const firstOption = words.findIndex((word) => word.startsWith('-'));
  return (firstOption === -1 ? words : words.slice(0, firstOption)).join(' ');
}

function answer(command: string, id: string): boolean {
  const options = parseCli([...command.split(' '), '--rule-id', id]);
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
  for (const leaf of leaves) assert.ok(leaf?.options.some((option) => option.long === '--rule-id'), leaf?.name());

  assert.throws(
    () => addRuleIdOption(new Command().addCommand(new Command('alone')), { 'group leafs': ['NR-01'] }),
    /'group leafs'/,
  );
});

test('every command of the table answers yes for each of its rules and no for an unknown rule', () => {
  for (const [command, ids] of Object.entries(ENFORCED_RULES)) {
    for (const id of ids) assert.equal(answer(command, id), true, `${command} --rule-id ${id}`);
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
  assert.equal(answer('check mirror', 'NR-01'), false);
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
    assert.ok(entry.checkedBy.startsWith(LAUNCHER), `${entry.id} says checked-by: ${entry.checkedBy}; use ${LAUNCHER}<command>`);
  }
});

test('a rule that only --base checks says so in its checked-by', () => {
  const entries = new Map(readRuleEntries().map((entry) => [entry.id, entry]));
  for (const id of ['NR-84', 'NR-85']) {
    assert.equal(entries.get(id)?.checkedBy, `${LAUNCHER}check deployments --base main`, id);
  }
});
