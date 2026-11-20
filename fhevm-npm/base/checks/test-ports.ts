// test-ports.config.json, at the workspace root, gives every test the port of the local node it starts.
// This check holds the file to its own layout, and the sources to the file.
//
// Not a style rule. A node started on a port that is already bound exits, and the test then talks to
// WHATEVER ELSE is listening: the wait for the node succeeds against the foreign one, and the failure
// surfaces far from its cause, as an `Out of gas` on an account the other node never funded. Some suites
// check their port first and SKIP when it is busy: a run that reports success having run fewer tests.
// One owner per port is also what lets two packages run their suites at the same time.
//
// The sources are read, never imported: the tests take minutes and start real nodes.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import type { NpmManifest } from '../../manifest.ts';
import type { Violation } from '../diagnostics.ts';
import { generationFamilies } from './generations.ts';

const RULE = 'NR-92';

export const TEST_PORTS_FILE = 'test-ports.config.json';
const FILE_KEY = `./${TEST_PORTS_FILE}`;

const SHARED_GROUP = 'shared';
const SHARED_PORT_NAME = 'anvil-default';
/** Where the default anvil port is spelled, as `export const ANVIL_PORT = <n>;`. */
const ANVIL_PORT_SOURCE = 'common/src/constants.ts';
const FORGE_STD_GROUP = 'foundry/forge-fhevm-std';

/**
 * The ways a test spells a port without the file: a `startAnvil` call, a call to the `deployStack(port)`
 * helper that wraps one, the `const PORT` of a suite that spawns anvil itself, a `--port` argument, any
 * `port` given a number, and a local URL. The first capture is the number: four or five digits, which is
 * what a port a test can bind looks like.
 */
const LITERAL_PORT_PATTERNS = [
  /startAnvil\(\s*\{\s*port:\s*(\d{4,5})\b/,
  /\bdeployStack\((\d{4,5})\)/,
  /^const PORT = (\d{4,5});/,
  /--port['",\s=]+(\d{4,5})\b/,
  /\bport\s*[:=]\s*(\d{4,5})\b/i,
  /(?:127\.0\.0\.1|localhost):(\d{4,5})\b/,
] as const;

type Group = {
  readonly name: string;
  readonly first: number;
  readonly last: number;
  /** Name and port, in the order of the file. */
  readonly ports: ReadonlyArray<readonly [name: string, port: number]>;
};

type SourceFile = { readonly path: string; readonly text: string };
type Found<T> = T & { readonly where: string };

export type TestPortsInspection = {
  /** One `<group> > <name>` per port of the file. */
  readonly checkedKeys: readonly string[];
  readonly violations: readonly Violation[];
};

export function inspectTestPorts(workspaceRoot: string, manifest: NpmManifest): TestPortsInspection {
  const groups = readGroups(workspaceRoot);
  if ('rule' in groups) return { checkedKeys: [], violations: [groups] };

  const families = generationFamilies(manifest);
  const currents = families.map((family) => groupName(family.current));
  const previous = families.flatMap((family) => (family.previous === undefined ? [] : [groupName(family.previous)]));
  const defaultPort = groups.find((group) => group.name === SHARED_GROUP)?.ports[0]?.[1];

  const violations = [
    ...validateGroupNames(groups, [SHARED_GROUP, FORGE_STD_GROUP, ...currents, ...previous]),
    ...validateRanges(groups),
    ...validateSharedGroup(workspaceRoot, groups),
    ...validateForgeStdGroup(workspaceRoot, groups),
    ...currents.flatMap((name) => validateCurrentGeneration(workspaceRoot, groups, name, defaultPort)),
    ...previous.flatMap((name) => validatePreviousGeneration(workspaceRoot, groups, name, defaultPort)),
  ];
  return {
    checkedKeys: groups.flatMap((group) => group.ports.map(([name]) => `${group.name} > ${name}`)),
    violations,
  };
}

function fileViolation(message: string, packageKey: string = FILE_KEY): Violation {
  return { rule: RULE, packageKey, message };
}

/** A generation's key in the manifest, `./<family>/<vN>`, as the name of its group, `<family>/<vN>`. */
function groupName(packageKey: string): string {
  return packageKey.replace(/^\.\//, '');
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPort(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

/** The groups of the file in its own order, or the one violation that says why it cannot be read. */
function readGroups(workspaceRoot: string): readonly Group[] | Violation {
  const path = join(workspaceRoot, TEST_PORTS_FILE);
  if (!existsSync(path)) return fileViolation('the file does not exist');

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    return fileViolation(`the file is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  // `check json-schemas` reports the details; this check only needs a shape it can read.
  const malformed = fileViolation(
    'the file must hold "groups": { <group>: { "range": [<first>, <last>], "ports": { <name>: <port> } } }, with integer ports',
  );
  if (!isRecord(parsed) || !isRecord(parsed.groups)) return malformed;

  const groups: Group[] = [];
  for (const [name, group] of Object.entries(parsed.groups)) {
    if (!isRecord(group) || !Array.isArray(group.range) || !isRecord(group.ports)) return malformed;
    const [first, last] = group.range as readonly unknown[];
    const ports = Object.entries(group.ports);
    if (group.range.length !== 2 || !isPort(first) || !isPort(last)) return malformed;
    if (!ports.every((entry): entry is [string, number] => isPort(entry[1]))) return malformed;
    groups.push({ name, first, last, ports });
  }
  return groups;
}

/** The file has one group for each owner of ports, and no other. */
function validateGroupNames(groups: readonly Group[], expected: readonly string[]): Violation[] {
  const names = groups.map((group) => group.name);
  return [
    ...expected
      .filter((name) => !names.includes(name))
      .map((name) => fileViolation(`group '${name}' is missing: its tests have no port to read`)),
    // A group nothing reads is a block of ports held for no one: a retired generation, or a misspelt path.
    ...names
      .filter((name) => !expected.includes(name))
      .map((name) =>
        fileViolation(
          `group '${name}' has no owner: the groups are '${SHARED_GROUP}', '${FORGE_STD_GROUP}', and the generations of npm-manifest.json#generations`,
        ),
      ),
  ];
}

/** Every group keeps to a range of its own, and the file reads in increasing order from top to bottom. */
function validateRanges(groups: readonly Group[]): Violation[] {
  const violations: Violation[] = [];
  groups.forEach((group, index) => {
    const range = `${String(group.first)}-${String(group.last)}`;
    if (group.first > group.last) {
      violations.push(fileViolation(`group '${group.name}' has an empty range, ${range}`));
    }
    const above = groups[index - 1];
    if (above !== undefined && group.first <= above.last) {
      violations.push(
        fileViolation(
          `group '${group.name}' has the range ${range}, which starts at or before the end of the range of '${above.name}', listed above it: ranges never overlap, and groups are listed by increasing range`,
        ),
      );
    }
    group.ports.forEach(([name, port], position) => {
      if (port < group.first || port > group.last) {
        violations.push(
          fileViolation(`port '${name}' of group '${group.name}' is ${String(port)}, outside the range ${range}`),
        );
      }
      const before = group.ports[position - 1];
      if (before !== undefined && port <= before[1]) {
        violations.push(
          fileViolation(
            `port '${name}' of group '${group.name}' is ${String(port)}, not above '${before[0]}', ${String(before[1])}, listed before it: a group lists its ports by increasing number, each one once`,
          ),
        );
      }
    });
  });
  return violations;
}

/** The shared group is the default anvil port, and nothing else. */
function validateSharedGroup(workspaceRoot: string, groups: readonly Group[]): Violation[] {
  const group = groups.find((candidate) => candidate.name === SHARED_GROUP);
  if (group === undefined) return [];

  const sourcePath = join(workspaceRoot, ANVIL_PORT_SOURCE);
  const source = existsSync(sourcePath) ? readFileSync(sourcePath, 'utf8') : '';
  const anvilPort = /^export const ANVIL_PORT = (\d+);$/m.exec(source)?.[1];
  if (anvilPort === undefined) {
    return [fileViolation("cannot read 'export const ANVIL_PORT = <port>;'", `./${ANVIL_PORT_SOURCE}`)];
  }
  const expected = `${SHARED_PORT_NAME}: ${anvilPort}`;
  const actual = group.ports.map(([name, port]) => `${name}: ${String(port)}`).join(', ');
  return actual === expected
    ? []
    : [
        fileViolation(
          `group '${SHARED_GROUP}' holds { ${actual} }, expected { ${expected} }, the ANVIL_PORT of ${ANVIL_PORT_SOURCE}`,
        ),
      ];
}

/** A script `test:<name>` of forge-fhevm-std that starts a node through with-anvil.sh owns the port `<name>`. */
function validateForgeStdGroup(workspaceRoot: string, groups: readonly Group[]): Violation[] {
  const group = groups.find((candidate) => candidate.name === FORGE_STD_GROUP);
  if (group === undefined) return [];

  const packageKey = `./${FORGE_STD_GROUP}/package.json`;
  const path = join(workspaceRoot, FORGE_STD_GROUP, 'package.json');
  if (!existsSync(path)) return [fileViolation('the file does not exist', packageKey)];
  const scripts = (JSON.parse(readFileSync(path, 'utf8')) as { scripts?: Record<string, string> }).scripts ?? {};

  const violations: Violation[] = [];
  const inScripts = new Map<string, number>();
  for (const [script, command] of Object.entries(scripts)) {
    if (!command.includes('with-anvil.sh')) continue;
    const port = /with-anvil\.sh --port (\d+) /.exec(command)?.[1];
    if (port === undefined) {
      violations.push(
        fileViolation(
          `cannot read the port of script '${script}': expected 'with-anvil.sh --port <port> '`,
          packageKey,
        ),
      );
    } else {
      inScripts.set(script.replace(/^test:/, ''), Number(port));
    }
  }

  const recorded = new Map(group.ports);
  for (const [name, port] of inScripts) {
    if (recorded.get(name) !== port) {
      violations.push(
        fileViolation(
          `script 'test:${name}' starts its node on ${String(port)}, and group '${FORGE_STD_GROUP}' of ${TEST_PORTS_FILE} gives '${name}' ${String(recorded.get(name) ?? 'no port')}`,
          packageKey,
        ),
      );
    }
  }
  for (const [name] of group.ports) {
    if (!inScripts.has(name)) {
      violations.push(
        fileViolation(`port '${name}' of group '${FORGE_STD_GROUP}' has no script 'test:${name}' that starts a node`),
      );
    }
  }
  return violations;
}

/** Every `.ts` file under `test/` of one package, with its workspace path. Dot folders and node_modules hold no tests. */
function testFiles(workspaceRoot: string, group: string): SourceFile[] {
  const files = (directory: string): string[] =>
    !existsSync(join(workspaceRoot, directory))
      ? []
      : readdirSync(join(workspaceRoot, directory), { withFileTypes: true })
          .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
          .flatMap((entry) => {
            if (entry.name.startsWith('.') || entry.name === 'node_modules') return [];
            const path = `${directory}/${entry.name}`;
            if (entry.isDirectory()) return files(path);
            return entry.name.endsWith('.ts') ? [path] : [];
          });
  return files(`${group}/test`).map((path) => ({ path, text: readFileSync(join(workspaceRoot, path), 'utf8') }));
}

/** The lines of a file that are code, with where. A line that is only a comment spells nothing. */
function codeLines(file: SourceFile): Array<Found<{ readonly line: string }>> {
  return file.text
    .split('\n')
    .map((line, index) => ({ line, where: `./${file.path}:${String(index + 1)}` }))
    .filter(({ line }) => !/^\s*(\/\/|\/?\*)/.test(line));
}

/** Every port a file spells as a number, the shared default excepted: it is no suite's own. */
function literalPorts(file: SourceFile, defaultPort: number | undefined): Array<Found<{ readonly port: number }>> {
  return codeLines(file).flatMap(({ line, where }) =>
    LITERAL_PORT_PATTERNS.map((pattern) => pattern.exec(line)?.[1])
      .filter((port) => port !== undefined)
      .map((port) => ({ port: Number(port), where }))
      .filter(({ port }) => port !== defaultPort),
  );
}

/** Every `testPort('<name>')` a file reads, by name. */
function namedPorts(file: SourceFile): Array<Found<{ readonly name: string }>> {
  return codeLines(file).flatMap(({ line, where }) =>
    [...line.matchAll(/\btestPort\('([a-z0-9-]+)'\)/g)].map((match) => ({ name: match[1] ?? '', where })),
  );
}

/**
 * The current generation takes every port from the file, by a name that one test reads, and fills its
 * range from the first port, one by one.
 */
function validateCurrentGeneration(
  workspaceRoot: string,
  groups: readonly Group[],
  name: string,
  defaultPort: number | undefined,
): Violation[] {
  const group = groups.find((candidate) => candidate.name === name);
  if (group === undefined) return [];

  const violations: Violation[] = [];
  const files = testFiles(workspaceRoot, name);

  for (const { port, where } of files.flatMap((file) => literalPorts(file, defaultPort))) {
    violations.push(
      fileViolation(
        `spells the port ${String(port)}: name the port in group '${name}' of ${TEST_PORTS_FILE} and read it with testPort('<name>')`,
        where,
      ),
    );
  }

  for (const file of files) {
    // A node is started on a named port and nothing else: directly, or through a helper whose callers are.
    // Read over the whole file, so a call that the formatter wraps is still one call.
    for (const match of file.text.matchAll(/startAnvil\(\s*\{\s*port\b([^,}]*)/g)) {
      const given = (match[1] ?? '').trim();
      if (given !== '' && !/^: testPort\('[a-z0-9-]+'\)$/.test(given)) {
        violations.push(
          fileViolation(
            `'startAnvil({ port${given}' starts a node on a port that is not exactly testPort('<name>')`,
            `./${file.path}`,
          ),
        );
      }
    }
    // A suite that spawns anvil itself does it on its one `PORT`, which is a name.
    const spawnsWithoutPort = codeLines(file).some(
      ({ line }) => line.includes("spawn('anvil'") && !line.includes("'--port', String(PORT)"),
    );
    if (
      file.text.includes("spawn('anvil'") &&
      (spawnsWithoutPort || !/^const PORT = testPort\('[a-z0-9-]+'\);$/m.test(file.text))
    ) {
      violations.push(
        fileViolation(
          "spawns anvil without `const PORT = testPort('<name>');` and `'--port', String(PORT)`",
          `./${file.path}`,
        ),
      );
    }
    // Every call is one this check can read: a name computed at run time is a port nothing checked.
    const read = namedPorts(file).map(({ where }) => where);
    for (const { line, where } of codeLines(file)) {
      const calls = [...line.matchAll(/\btestPort\(/g)].length;
      if (calls !== read.filter((candidate) => candidate === where).length) {
        violations.push(fileViolation("calls testPort() without a literal 'name'", where));
      }
    }
  }

  const readers = new Map<string, string[]>();
  for (const { name: port, where } of files.flatMap(namedPorts)) {
    readers.set(port, [...(readers.get(port) ?? []), where]);
  }
  // A scan that found nothing would agree with an empty group, and would say nothing about the tests.
  if (readers.size === 0) {
    violations.push(fileViolation(`found no testPort('<name>') call under ./${name}/test: refusing to pass vacuously`));
  }
  const recorded = new Map(group.ports);
  for (const [port, where] of readers) {
    if (where.length > 1) {
      violations.push(
        fileViolation(
          `port '${port}' of group '${name}' is read ${String(where.length)} times, at ${where.join(' and ')}: two tests would start their nodes on one port`,
        ),
      );
    }
    if (!recorded.has(port)) {
      violations.push(fileViolation(`reads the port '${port}', which group '${name}' does not have`, where[0]));
    }
  }
  for (const [port] of group.ports) {
    if (!readers.has(port)) {
      violations.push(fileViolation(`port '${port}' of group '${name}' is read by no test of ./${name}/test`));
    }
  }

  // The one kind of group that nothing freezes counts up, so the next port is never a choice.
  group.ports.forEach(([port, value], index) => {
    if (value !== group.first + index) {
      violations.push(
        fileViolation(
          `port '${port}' of group '${name}' is ${String(value)}, expected ${String(group.first + index)}: the current generation fills its range from the first port, one by one`,
        ),
      );
    }
  });
  return violations;
}

/**
 * The previous generation is frozen: its tests say their ports as numbers, or as names of its own group,
 * and the file records exactly those ports.
 */
function validatePreviousGeneration(
  workspaceRoot: string,
  groups: readonly Group[],
  name: string,
  defaultPort: number | undefined,
): Violation[] {
  const group = groups.find((candidate) => candidate.name === name);
  if (group === undefined) return [];

  const violations: Violation[] = [];
  const files = testFiles(workspaceRoot, name);
  const recorded = new Map(group.ports);
  const inSources = new Map<number, string>();

  for (const { port, where } of files.flatMap((file) => literalPorts(file, defaultPort))) {
    if (!inSources.has(port)) inSources.set(port, where);
  }
  for (const { name: port, where } of files.flatMap(namedPorts)) {
    const value = recorded.get(port);
    if (value === undefined) {
      violations.push(fileViolation(`reads the port '${port}', which group '${name}' does not have`, where));
    } else if (!inSources.has(value)) {
      inSources.set(value, where);
    }
  }
  if (inSources.size === 0) {
    violations.push(fileViolation(`found no port under ./${name}/test: refusing to pass vacuously`));
  }

  const values = new Set(group.ports.map(([, value]) => value));
  for (const [port, where] of inSources) {
    if (!values.has(port)) {
      violations.push(
        fileViolation(
          `starts a node on ${String(port)}, which group '${name}' of ${TEST_PORTS_FILE} does not record. This generation is frozen: record the port in the file`,
          where,
        ),
      );
    }
  }
  for (const [port, value] of group.ports) {
    if (!inSources.has(value)) {
      violations.push(
        fileViolation(`port '${port}' of group '${name}', ${String(value)}, is used by no test of ./${name}/test`),
      );
    }
  }
  return violations;
}
