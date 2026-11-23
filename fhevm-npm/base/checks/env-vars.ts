// npm-manifest.json lists the environment variables of the workspace, in `envVarNames` and
// `toolEnvVarNames`. This check holds the sources to the two lists, and the lists to the sources.
//
// An environment variable is an input that no signature shows. Without one list, two parts of the
// workspace give two names to the same thing, and nobody can say what a run reads. So a variable that
// a file reads or sets must be listed, and a listed variable must be used.
//
// The sources are read as text, never run. In fhevm-npm every read is found, because a read with a
// computed name is refused there. Elsewhere, a name that code builds while it runs is not found.

import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import type { NpmManifest } from '../../manifest.ts';
import type { Violation } from '../diagnostics.ts';
import { gitVisibleFiles } from '../repository.ts';
import {
  type EnvVarUse,
  type SourceFile,
  computedEnvReads,
  envVarUsesOfFile,
  isShellScript,
  shellEnvVarUses,
} from './env-var-uses.ts';

const RULE = 'R-10';
const MANIFEST_KEY = './npm-manifest.json';

/** The folder whose every read is found. Its tests may read a variable by a computed name. */
const STRICT_FOLDER = 'fhevm-npm/';
const STRICT_FOLDER_TESTS = 'fhevm-npm/test/';

/** A file larger than this holds data, not code. */
const LARGEST_SOURCE_BYTES = 2_000_000;

/**
 * The files that the check does not read: what another repository owns, what holds records and not
 * code, the prose, and the tests of this check, which hold made-up names.
 */
const NOT_READ = [
  /(^|\/)(node_modules|dependencies)\//,
  /^common-vendored\//,
  /^deployments\//,
  /^operators-data\//,
  /^rules\//,
  /^\.claude\//,
  /\/docs\/skills\//,
  /\.md$/,
  /package-lock\.json$/,
  /^fhevm-npm\/test\/check-env-vars\.test\.ts$/,
] as const;

/** A part of a listed name that stands for any text, as `<ALIAS>` in `<ALIAS>_RPC_URL`. */
const PLACEHOLDER = /<[A-Z][A-Z0-9_]*>/g;
const LISTED_NAME = /^(?:[A-Z][A-Z0-9_]*|<[A-Z][A-Z0-9_]*>)(?:_?(?:[A-Z0-9_]+|<[A-Z][A-Z0-9_]*>))*$/;

export type EnvVarsInspection = {
  /** The listed names, of both lists. */
  readonly checkedKeys: readonly string[];
  readonly violations: readonly Violation[];
};

export type InspectEnvVarsInput = {
  readonly workspaceRoot: string;
  readonly manifest: NpmManifest;
};

export function inspectEnvVars(input: InspectEnvVarsInput): EnvVarsInspection {
  const own = input.manifest.envVarNames ?? [];
  const ofTools = input.manifest.toolEnvVarNames ?? [];
  const listed = [...own, ...ofTools];
  const files = sourceFiles(input.workspaceRoot);
  const uses = [...files.flatMap(envVarUsesOfFile), ...shellEnvVarUses(files.filter(isShellScript))];

  return {
    checkedKeys: listed,
    violations: [
      ...listViolations({ own, ofTools }),
      ...unlistedUses({ uses, listed }),
      ...unusedNames({ uses, listed }),
      ...computedReads(files),
    ],
  };
}

function violation(message: string, packageKey: string = MANIFEST_KEY): Violation {
  return { rule: RULE, packageKey, message };
}

////////////////////////////////////////////////////////////////////////////////
// The files
////////////////////////////////////////////////////////////////////////////////

function sourceFiles(workspaceRoot: string): readonly SourceFile[] {
  return gitVisibleFiles(workspaceRoot)
    .filter((path) => !NOT_READ.some((pattern) => pattern.test(path)))
    .flatMap((path) => {
      const absolute = join(workspaceRoot, path);
      const stat = statSync(absolute, { throwIfNoEntry: false });

      // A path that git lists and that is gone, a folder, or data.
      if (stat === undefined || !stat.isFile() || stat.size > LARGEST_SOURCE_BYTES) return [];

      return [{ path, text: readFileSync(absolute, 'utf8') }];
    });
}

////////////////////////////////////////////////////////////////////////////////
// The two lists
////////////////////////////////////////////////////////////////////////////////

type ListsInput = {
  readonly own: readonly string[];
  readonly ofTools: readonly string[];
};

function listViolations(input: ListsInput): readonly Violation[] {
  const { own, ofTools } = input;
  const inBoth = own.filter((name) => ofTools.includes(name));

  return [
    ...listOrderViolations({ list: own, key: 'envVarNames' }),
    ...listOrderViolations({ list: ofTools, key: 'toolEnvVarNames' }),
    ...[...own, ...ofTools]
      .filter((name) => !LISTED_NAME.test(name))
      .map((name) =>
        violation(`'${name}' is not the name of an environment variable, with or without <PLACEHOLDER> parts`),
      ),
    ...inBoth.map((name) => violation(`'${name}' is in envVarNames and in toolEnvVarNames: a variable has one list`)),
  ];
}

type ListOrderInput = {
  readonly list: readonly string[];
  readonly key: string;
};

/** A list reads in the order of the alphabet, with each name once, so that a name has one place. */
function listOrderViolations(input: ListOrderInput): readonly Violation[] {
  const { list, key } = input;
  const sorted = [...new Set(list)].sort();
  const repeated = [...new Set(list.filter((name, index) => list.indexOf(name) !== index))];

  return [
    ...repeated.map((name) => violation(`${key} holds '${name}' more than once`)),
    ...(repeated.length === 0 && list.join('\n') !== sorted.join('\n')
      ? [violation(`${key} is not sorted: expected ${sorted.join(', ')}`)]
      : []),
  ];
}

/** The regular expression of a listed name: each placeholder stands for one text or more. */
function expressionOf(listedName: string): RegExp {
  const escaped = listedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  return new RegExp(`^${escaped.replace(PLACEHOLDER, '[A-Z0-9_]+')}$`);
}

function hasPlaceholder(listedName: string): boolean {
  return listedName.includes('<');
}

////////////////////////////////////////////////////////////////////////////////
// The sources against the lists
////////////////////////////////////////////////////////////////////////////////

type UsesAndListInput = {
  readonly uses: readonly EnvVarUse[];
  readonly listed: readonly string[];
};

const VERB_OF_KIND = { read: 'reads', set: 'sets', declared: 'names' } as const;

/** A variable that a file reads, sets or names, and that neither list holds. One violation per file and name. */
function unlistedUses(input: UsesAndListInput): readonly Violation[] {
  const expressions = input.listed.map(expressionOf);
  const prefixesOfPatterns = input.listed.filter(hasPlaceholder).map((name) => name.slice(0, name.indexOf('<')));
  const isListed = (use: EnvVarUse): boolean => {
    // A family of names, known by its start, is listed by a name that starts the same way, then a placeholder.
    if (use.isPrefix) return prefixesOfPatterns.includes(use.name);

    return expressions.some((expression) => expression.test(use.name));
  };
  const seen = new Set<string>();

  return input.uses.flatMap((use) => {
    const key = `${use.file}\n${use.name}`;

    if (isListed(use) || seen.has(key)) return [];

    seen.add(key);

    const name = use.isPrefix ? `${use.name}<...>` : use.name;

    return [
      violation(
        `line ${use.line} ${VERB_OF_KIND[use.kind]} the environment variable ${name}, which npm-manifest.json does ` +
          `not list. Use a listed variable, or add this one to envVarNames, or to toolEnvVarNames when a tool defines it.`,
        `./${use.file}`,
      ),
    ];
  });
}

/**
 * A listed name that no file uses. A name with a placeholder is not checked: the names it stands for
 * are built while the code runs, so a file that reads one cannot be found.
 */
function unusedNames(input: UsesAndListInput): readonly Violation[] {
  const used = new Set(input.uses.filter((use) => !use.isPrefix).map((use) => use.name));

  return input.listed
    .filter((name) => !hasPlaceholder(name) && !used.has(name))
    .map((name) => violation(`'${name}' is listed, and no file reads, sets or names it: remove it from the list`));
}

/** In fhevm-npm, outside its tests, a read of `process.env` names its variable where it reads it. */
function computedReads(files: readonly SourceFile[]): readonly Violation[] {
  return files
    .filter((file) => file.path.startsWith(STRICT_FOLDER) && !file.path.startsWith(STRICT_FOLDER_TESTS))
    .flatMap((file) => {
      return computedEnvReads(file).map((read) => {
        return violation(
          `line ${read.line} reads process.env with a computed name, '${read.expression}': the name of the variable is ` +
            `not written there. ` +
            `Write the name, or read it through a constant whose identifier ends in _VARIABLE and that holds the name.`,
          `./${file.path}`,
        );
      });
    });
}
