// Checks the convention that ties ALL_TESTS.json to the package scripts it calls. It reads the real
// inventory and the real package.json files of the workspace, and runs nothing.
//
// The convention, which fhevm-npm-docs/TESTS.md states in "Name the scripts of the test engine":
//
// 1. A test of the inventory calls one script, `test-engine:<name>`, of the package it tests:
//    `npm run --silent test-engine:<name> -w <workspace>`.
// 2. The main test of a package has the name `suite`. Every other test of the package has an ID that is
//    the ID of the main test, a hyphen, and its name. So the same kind of test has the same name in
//    every package.
// 3. When `test-engine:<name>` runs more than forge, its forge part is `test-engine:<name>:forge`.
// 4. The list command of a test calls the same forge script with FHEVM_TEST_LIST=1, so the test and its
//    list select the same functions.
// 5. The previous generation is frozen, so its scripts are in the root package.json, and its tests call
//    them with no `-w`. It has every name of the current generation except `upgrade`: the upgrade test
//    upgrades the previous generation to the current one, so only the current generation has it.
// 6. Every `test-engine:` script is called by the inventory, and every test of a package that has a
//    `test-engine:suite` script follows the convention. The `upgrade` script of the previous generation
//    may stay uncalled: after a rotation, no test calls it any more.
// 7. A script, with the scripts it runs, names the RPC variable of a chain only when its test declares
//    that chain. `validate` checks the command of a test, and cannot see inside a script.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import type { Test } from '../base/test-engine/inventory.ts';
import { undeclaredRpcVariableLines } from '../base/test-engine/live-chains.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PREFIX = 'test-engine:';
const SUITE = 'suite';
const FORGE_PART = ':forge';
const LIST_VARIABLE = 'FHEVM_TEST_LIST=1';

/** The test that only the current generation has. */
const UPGRADE = `${PREFIX}upgrade`;

/** The previous and the current generation of the cleartext packages, as their test IDs name them. */
const PREVIOUS_GENERATION = 'test-cleartext-v-prev';
const CURRENT_GENERATION = 'test-cleartext-v-cur';

type InventoryTest = Test;

type ScriptCall = {
  readonly script: string;
  /** Undefined: the script of the root package.json. */
  readonly workspace: string | undefined;
};

/** Where the scripts of the test engine live: one package.json, by its workspace or the root. */
type ScriptOwner = {
  readonly key: string;
  readonly workspace: string | undefined;
  readonly scripts: Readonly<Record<string, string>>;
};

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

const inventory = readJson<Record<string, InventoryTest | string>>(join(ROOT, 'ALL_TESTS.json'));
const tests = Object.entries(inventory).flatMap(([id, entry]) => (typeof entry === 'string' ? [] : [{ id, ...entry }]));

/** Every package.json of the workspace, the root included. */
function allPackages(): readonly ScriptOwner[] {
  const root = readJson<{ workspaces: readonly string[]; scripts: Record<string, string> }>(join(ROOT, 'package.json'));
  const members = root.workspaces.map((folder) => {
    const packageJson = readJson<{ name: string; scripts?: Record<string, string> }>(
      join(ROOT, folder, 'package.json'),
    );

    return { key: packageJson.name, workspace: packageJson.name, scripts: packageJson.scripts ?? {} };
  });

  return [{ key: '(root)', workspace: undefined, scripts: root.scripts }, ...members];
}

const packages = allPackages();

/** The package.json files that have a script of the test engine. */
const owners = packages.filter((owner) => Object.keys(owner.scripts).some((script) => script.startsWith(PREFIX)));

type ExpandInput = {
  readonly owner: ScriptOwner;
  readonly script: string;
  /** The scripts already read, so that a cycle ends. */
  readonly seen: Set<string>;
};

/** The text of a script, followed by the text of each script it runs with `npm run`, in any package. */
function expandedScript(input: ExpandInput): string {
  const body = input.owner.scripts[input.script];
  const key = `${input.owner.key}\0${input.script}`;

  if (body === undefined || input.seen.has(key)) return '';

  input.seen.add(key);

  const nested = [...body.matchAll(/npm run (?:--silent )?(\S+)(?: -w (\S+))?/g)].map((match) => {
    const owner = match[2] === undefined ? input.owner : packages.find((one) => one.workspace === match[2]);

    return owner === undefined ? '' : expandedScript({ owner, script: match[1]!, seen: input.seen });
  });

  return [body, ...nested].join('\n');
}

/** The script that a command calls, if it is a call of the convention. */
function scriptCall(input: { readonly command: string; readonly listed: boolean }): ScriptCall | undefined {
  const head = input.listed ? `${LIST_VARIABLE} ` : '';
  const match = new RegExp(`^${head}npm run --silent (${PREFIX}\\S+)(?: -w (\\S+))?$`).exec(input.command);

  return match === null ? undefined : { script: match[1]!, workspace: match[2] };
}

function ownerOf(workspace: string | undefined): ScriptOwner | undefined {
  return owners.find((owner) => owner.workspace === workspace);
}

/** The ID of the main test of each owner: the test that calls its `suite` script. */
function mainTestOf(owner: ScriptOwner): string | undefined {
  const main = tests.find((one) => {
    const call = scriptCall({ command: one.command, listed: false });

    return call !== undefined && call.workspace === owner.workspace && call.script === `${PREFIX}${SUITE}`;
  });

  return main?.id;
}

////////////////////////////////////////////////////////////////////////////////

test('each owner of scripts of the test engine has a main test, which calls its suite script', () => {
  assert.ok(owners.length >= 3, `found ${owners.map((owner) => owner.key).join(', ')}`);

  for (const owner of owners) assert.notEqual(mainTestOf(owner), undefined, owner.key);
});

test('every test of a package with a suite script calls one script, named after its ID', () => {
  for (const owner of owners) {
    const main = mainTestOf(owner)!;
    const ofPackage = tests.filter((one) => one.id === main || one.id.startsWith(`${main}-`));

    for (const one of ofPackage) {
      const name = one.id === main ? SUITE : one.id.slice(main.length + 1);
      const call = scriptCall({ command: one.command, listed: false });

      assert.deepEqual(
        call,
        { script: `${PREFIX}${name}`, workspace: owner.workspace },
        `${one.id}: its command must be 'npm run --silent ${PREFIX}${name}${owner.workspace === undefined ? '' : ` -w ${owner.workspace}`}'`,
      );
      assert.ok(owner.scripts[call.script] !== undefined, `${one.id}: ${owner.key} has no script ${call.script}`);
    }
  }
});

test('the list command of a test calls the same script, or its forge part, with FHEVM_TEST_LIST=1', () => {
  for (const one of tests) {
    const call = scriptCall({ command: one.command, listed: false });

    if (call === undefined || one.list === undefined) continue;

    const owner = ownerOf(call.workspace)!;
    const forgePart = `${call.script}${FORGE_PART}`;
    const expected = owner.scripts[forgePart] === undefined ? call.script : forgePart;

    assert.deepEqual(
      scriptCall({ command: one.list, listed: true }),
      { script: expected, workspace: call.workspace },
      one.id,
    );
  }
});

test('a forge part is called by its script, and every script of the test engine is called by a test', () => {
  for (const owner of owners) {
    const called = new Set(
      tests.flatMap((one) => {
        const call = scriptCall({ command: one.command, listed: false });

        return call !== undefined && call.workspace === owner.workspace ? [call.script] : [];
      }),
    );

    for (const [script, body] of Object.entries(owner.scripts)) {
      if (!script.startsWith(PREFIX)) continue;

      // After a rotation, the upgrade script of the previous generation stays, and no test calls it.
      if (script === UPGRADE && mainTestOf(owner) === PREVIOUS_GENERATION) continue;

      if (script.endsWith(FORGE_PART)) {
        const whole = script.slice(0, -FORGE_PART.length);

        assert.ok(owner.scripts[whole]?.includes(`npm run ${script}`), `${owner.key}: ${whole} must run ${script}`);
        continue;
      }

      assert.ok(called.has(script), `${owner.key}: no test calls ${script} (${body})`);
    }
  }
});

test('the previous generation has, in the root package.json, the script names of the current generation, upgrade apart', () => {
  const namesOf = (main: string): readonly string[] => {
    const owner = owners.find((one) => mainTestOf(one) === main);

    assert.ok(owner !== undefined, `no package has the main test ${main}`);

    return Object.keys(owner.scripts)
      .filter((script) => script.startsWith(PREFIX) && script !== UPGRADE)
      .sort();
  };

  assert.equal(owners.find((owner) => mainTestOf(owner) === PREVIOUS_GENERATION)?.workspace, undefined);
  assert.deepEqual(namesOf(PREVIOUS_GENERATION), namesOf(CURRENT_GENERATION));
  assert.ok(owners.some((owner) => mainTestOf(owner) === CURRENT_GENERATION && owner.scripts[UPGRADE] !== undefined));
});

test('a script names the RPC variable of a chain only when its test declares that chain', () => {
  const lines = tests.flatMap((one) => {
    const call = scriptCall({ command: one.command, listed: false });
    const owner = call === undefined ? undefined : packages.find((pkg) => pkg.workspace === call.workspace);

    if (call === undefined || owner === undefined) return [];

    const text = expandedScript({ owner, script: call.script, seen: new Set() });

    return undeclaredRpcVariableLines({ id: one.id, test: { ...one, command: text } });
  });

  assert.deepEqual(lines, []);
});
