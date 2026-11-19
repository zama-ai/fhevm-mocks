import assert from 'node:assert/strict';
import { Command } from 'commander';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { addRuleIdOption, parseCli } from '../cli-options.ts';
import {
  ENFORCED_RULES,
  REQUIRED_OPTIONS,
  type RuleFileState,
  type RuleId,
  checkWithoutRule,
  missingRuleFiles,
} from '../enforced-rules.ts';

const CLI = fileURLToPath(new URL('../fhevm-npm.ts', import.meta.url));
// The rule books whose IDs fhevm-npm checks report: the npm rules and the global rules.
const RULE_BOOKS = ['../../rules/fhevm-npm/rules/entries/', '../../rules/global/rules/entries/'].map((path) =>
  fileURLToPath(new URL(path, import.meta.url)),
);
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
  return RULE_BOOKS.flatMap((book) =>
    readdirSync(book)
      .filter((file) => file.endsWith('.md'))
      .map((file) => ({ book, file })),
  ).map(({ book, file }) => {
    const frontMatter = readFileSync(join(book, file), 'utf8').split('\n---')[0] ?? '';
    const field = (key: string): string | undefined => {
      // Plain, double-quoted, or single-quoted, as Prettier writes it ('' is a quote inside single quotes).
      const raw = new RegExp(`^${key}: (.*)$`, 'm').exec(frontMatter)?.[1];
      if (raw === undefined) return undefined;
      if (raw.startsWith("'")) return raw.slice(1, -1).replaceAll("''", "'");
      if (raw.startsWith('"')) return JSON.parse(raw) as string;
      return raw;
    };
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
      assert.ok(entry, `${command} lists ${id}, which has no file in the rule books`);
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
      ENFORCED_RULES[command]?.includes(entry.id as RuleId),
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
    for (const match of text.matchAll(/['"`]((?:NR|R)-[^'"`]*)['"`]/g)) {
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
  'commands/check-cleartext-config.ts': ['check cleartext-config'],
  'base/checks/dependencies.ts': ['check dependencies'],
  'base/checks/extraneous.ts': ['check extraneous'],
  'base/checks/forge-std-chains.ts': ['check forge-std-chains'],
  'base/checks/foundry.ts': ['check foundry'],
  'base/checks/generation-parity.ts': ['check generation-parity'],
  'base/checks/generations.ts': ['check generations'],
  'base/checks/inventory.ts': ['check manifest-coverage'],
  'base/checks/lint-policy.ts': ['check lint-policy'],
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
  'commands/check-md-links.ts': ['check md-links'],
  'commands/sync-pinned.ts': ['sync pinned'],
};

test('every rule ID a command prints is listed under that command', () => {
  const missing: string[] = [];
  for (const [source, text] of readSources()) {
    const ids = [...text.matchAll(/['"`]((?:NR|R)-[^'"`]*)['"`]/g)].map((match) => match[1] ?? '');
    if (ids.length === 0) continue;
    const commands = PRINTED_BY[source];
    assert.ok(commands, `${source} reports ${[...new Set(ids)].join(', ')}; add it to PRINTED_BY`);
    for (const command of commands) {
      for (const id of new Set(ids)) {
        if (!ENFORCED_RULES[command]?.includes(id as RuleId)) missing.push(`'${command}': ${id} (${source})`);
      }
    }
  }
  assert.deepEqual(missing, []);
  const reporting = new Set(
    [...readSources()].filter(([, text]) => /['"`](?:NR|R)-[^'"`]*['"`]/.test(text)).map(([source]) => source),
  );
  const stale = Object.keys(PRINTED_BY).filter((source) => !reporting.has(source));
  assert.deepEqual(stale, [], 'PRINTED_BY lists files that report no rule ID; remove them');
});

test('a check that no rule names fails loudly, after printing what it found', () => {
  // The workspace itself: generate chain-constants --check passes on it, so only the missing rule can fail it.
  const result = spawnSync(process.execPath, [CLI, 'generate', 'chain-constants', '--check'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /'generate chain-constants --check' is a check, but no rule names it/);
});

test('a global rule can be enforced too: check md-links enforces R-07', () => {
  assert.equal(answer('check md-links', 'R-07'), true);
  assert.equal(answer('check md-links', 'R-99'), false);
});

test('a run is a check when it is under check, is version or publish check, or writes nothing with --check', () => {
  assert.match(checkWithoutRule('check safechain', false) ?? '', /'check safechain' is a check/);
  assert.equal(checkWithoutRule('check lint-policy', false), undefined, 'check lint-policy has NR-89');
  assert.match(
    checkWithoutRule('generate chain-constants', true) ?? '',
    /'generate chain-constants --check' is a check/,
  );
  assert.equal(checkWithoutRule('generate chain-constants', false), undefined, 'a write is not a check');
  assert.equal(checkWithoutRule('sync hh-v2-constants', true), undefined, 'sync hh-v2-constants --check has NR-88');
  assert.equal(checkWithoutRule('list-packages', false), undefined);
  assert.equal(checkWithoutRule('check names', false), undefined, 'check names has rules');
  assert.equal(checkWithoutRule('version check', false), undefined, 'version check has rules');
});

test('a check fails loudly when a rule it lists has no entry file, or a retired one', () => {
  const missing = (): RuleFileState => 'missing';
  const retired = (): RuleFileState => 'retired';
  assert.match(
    missingRuleFiles('check md-links', missing) ?? '',
    /'check md-links' enforces R-07, but rules\/global\/rules\/entries\/R-07\.md does not exist/,
  );
  assert.match(missingRuleFiles('check names', retired) ?? '', /enforces NR-01, but .*NR-01\.md is retired/);
  assert.equal(
    missingRuleFiles('check md-links', () => 'live'),
    undefined,
  );
  assert.equal(missingRuleFiles('list-packages', missing), undefined, 'a command that lists no rule');
});

test('every rule the table lists has a live entry file in this repository', () => {
  for (const command of Object.keys(ENFORCED_RULES)) assert.equal(missingRuleFiles(command), undefined, command);
});
