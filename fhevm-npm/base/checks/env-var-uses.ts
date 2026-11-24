// Finds the environment variables that the files of the workspace read, set or declare. The files are
// read as text, never run and never imported: a regular expression per form, per kind of file.
//
// What is found is what can be recognised. A name that code builds while it runs is not found, except
// in fhevm-npm, where `inspectEnvVars` refuses such a read.

import { basename, dirname, extname } from 'node:path';

/** How a file uses a variable. `declared` is a name that a file states as the name of a variable. */
export type EnvVarUseKind = 'read' | 'set' | 'declared';

export type EnvVarUse = {
  /** The name, or, when `isPrefix` is set, the start of every name that the file can read. */
  readonly name: string;
  readonly kind: EnvVarUseKind;
  /** The path of the file from the workspace root. */
  readonly file: string;
  /** The line of the use, from 1. */
  readonly line: number;
  readonly isPrefix: boolean;
};

export type SourceFile = {
  /** The path of the file from the workspace root. */
  readonly path: string;
  readonly text: string;
};

/** The name of an environment variable: capital letters, digits and underscores, from a capital letter. */
const NAME = '[A-Z][A-Z0-9_]*';

/** A name that a declaration states: two words or more, so that a lone capital word is not taken for one. */
const DECLARED_NAME = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/;

/** The start of the names of a family of variables, as `FHEVM_PARITY_REF_`. */
const DECLARED_PREFIX = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*_$/;

/** The identifier of a constant that holds the name of a variable, as `REPORT_VARIABLE` or `REF_VAR`. */
const VARIABLE_IDENTIFIER = /(?:^|_)VAR(?:IABLE)?S?(?:_|$)/;

const SCRIPT_EXTENSIONS = new Set(['.ts', '.mts', '.cts', '.mjs', '.cjs', '.js']);
const SHELL_SHEBANG = /^#!.*\b(?:ba|z)?sh\b/;

type Pattern = {
  readonly kind: EnvVarUseKind;
  /** The first capture is the name. */
  readonly expression: RegExp;
};

////////////////////////////////////////////////////////////////////////////////
// The forms, by kind of file
////////////////////////////////////////////////////////////////////////////////

const SCRIPT_PATTERNS: readonly Pattern[] = [
  { kind: 'read', expression: new RegExp(`process\\.env\\.(${NAME})\\b`, 'g') },
  { kind: 'read', expression: new RegExp(`process\\.env\\[\\s*['"](${NAME})['"]\\s*\\]`, 'g') },
  // An environment that a function receives, under its two usual names.
  { kind: 'read', expression: new RegExp(`(?<![.\\w])(?:env|environment)\\.(${NAME})\\b`, 'g') },
  { kind: 'read', expression: new RegExp(`(?<![.\\w])(?:env|environment)\\[\\s*['"](${NAME})['"]\\s*\\]`, 'g') },
  // A Hardhat variable: Hardhat takes it from its store, or from the environment.
  { kind: 'read', expression: new RegExp(`(?:vars\\.(?:get|has)|configVariable)\\(\\s*['"](${NAME})['"]`, 'g') },
  // A reader that takes the name of the variable as a field, as the Hardhat plugin does.
  { kind: 'read', expression: new RegExp(`\\bget(?:Optional)?Env\\w*\\(\\s*\\{\\s*name:\\s*['"](${NAME})['"]`, 'g') },
];

const SOLIDITY_PATTERNS: readonly Pattern[] = [
  {
    kind: 'read',
    expression: new RegExp(`\\benv(?:Or|String|Uint|Int|Bool|Address|Bytes32|Bytes|Exists)?\\(\\s*"(${NAME})"`, 'g'),
  },
  { kind: 'declared', expression: new RegExp(`constant\\s+\\w*VAR\\w*\\s*=\\s*"(${NAME})"`, 'g') },
];

const TOML_PATTERNS: readonly Pattern[] = [{ kind: 'read', expression: new RegExp(`\\$\\{(${NAME})\\}`, 'g') }];

const MAKEFILE_PATTERNS: readonly Pattern[] = [
  // A make variable with a default: make takes its value from the environment.
  { kind: 'declared', expression: new RegExp(`^(?:[\\w-]+:\\s*)?(?:export\\s+)?(${NAME})\\s*\\?=`, 'gm') },
  // A variable of the shell of a recipe, read with a default or a requirement.
  { kind: 'read', expression: new RegExp(`\\$\\$\\{(${NAME}):?[-=?+]`, 'g') },
  // A variable given to one command of a recipe, as `NAME=value $(MAKE) target`.
  { kind: 'set', expression: new RegExp(`(?<![\\w$({])(${NAME})=\\S+\\s+\\$\\((?:MAKE|call)\\b`, 'g') },
];

const ENV_EXAMPLE_PATTERNS: readonly Pattern[] = [{ kind: 'declared', expression: new RegExp(`^(${NAME})=`, 'gm') }];

const NPM_SCRIPT_PATTERNS: readonly Pattern[] = [
  // A variable given to one command of an npm script, as `NAME=value command`.
  { kind: 'set', expression: new RegExp(`(?<![\\w$])(${NAME})=[^\\s=&|;"]+\\s`, 'g') },
];

////////////////////////////////////////////////////////////////////////////////
// One file
////////////////////////////////////////////////////////////////////////////////

/** The uses of environment variables in one file, in the order of the file. */
export function envVarUsesOfFile(file: SourceFile): readonly EnvVarUse[] {
  const uses = [...usesOfKindOfFile(file)];

  return uses.sort((a, b) => a.line - b.line);
}

function usesOfKindOfFile(file: SourceFile): readonly EnvVarUse[] {
  const name = basename(file.path);
  const extension = extname(name);

  if (SCRIPT_EXTENSIONS.has(extension)) return scriptUses(withoutComments(file));

  if (extension === '.sol' || name.endsWith('.sol.template')) {
    return patternUses({ file: withoutComments(file), patterns: SOLIDITY_PATTERNS });
  }

  if (extension === '.toml') return patternUses({ file, patterns: TOML_PATTERNS });

  if (extension === '.yml' || extension === '.yaml') return workflowUses(file);

  if (name === 'Makefile') return patternUses({ file, patterns: MAKEFILE_PATTERNS });

  if (name === 'package.json') return npmScriptUses(file);

  if (name === '.env.example' || name === '.env.sample') return patternUses({ file, patterns: ENV_EXAMPLE_PATTERNS });

  return [];
}

/**
 * The file with each comment replaced by spaces, so that an example in a comment is not taken for a
 * use, and every offset stays the one of the file. What stands in a text is kept as it is: a `//` or
 * a `/*` between quotes starts no comment, as in a URL or in a glob.
 */
function withoutComments(file: SourceFile): SourceFile {
  const { text } = file;
  const kept: string[] = [];
  let index = 0;

  while (index < text.length) {
    const end = endOfTextOrComment({ text, index });

    if (end === undefined) {
      kept.push(text[index] ?? '');
      index += 1;
    } else {
      const part = text.slice(index, end.index);

      kept.push(end.isComment ? part.replace(/[^\n]/g, ' ') : part);
      index = end.index;
    }
  }

  return { path: file.path, text: kept.join('') };
}

type TextPosition = {
  readonly text: string;
  readonly index: number;
};

/**
 * Where the text between quotes, or the comment, that starts at a position ends. Undefined when
 * neither starts there.
 */
function endOfTextOrComment(
  position: TextPosition,
): { readonly index: number; readonly isComment: boolean } | undefined {
  const { text, index } = position;
  const two = text.slice(index, index + 2);
  const quote = text[index];

  if (two === '//') return { index: endOrLength(text, text.indexOf('\n', index)), isComment: true };

  if (two === '/*') return { index: endOrLength(text, text.indexOf('*/', index + 2), 2), isComment: true };

  if (quote === '/' && startsRegularExpression(position))
    return { index: endOfRegularExpression(position), isComment: false };

  if (quote !== "'" && quote !== '"' && quote !== '`') return undefined;

  let end = index + 1;

  // A quote that a backslash escapes does not end the text.
  while (end < text.length && text[end] !== quote) end += text[end] === '\\' ? 2 : 1;

  return { index: Math.min(end + 1, text.length), isComment: false };
}

/**
 * True when the slash at a position starts a regular expression, and not a division: a regular
 * expression follows an opening bracket, an operator or a separator, never a value. A quote inside a
 * regular expression starts no text, so the expression is skipped as a whole.
 */
function startsRegularExpression(position: TextPosition): boolean {
  const before = position.text.slice(0, position.index).trimEnd();

  return before === '' || /[(,=:[!&|?{};]$/.test(before) || /\breturn$/.test(before);
}

/** The position after the regular expression that starts at a position. A slash inside `[...]` does not end it. */
function endOfRegularExpression(position: TextPosition): number {
  const { text } = position;
  let end = position.index + 1;
  let inClass = false;

  while (end < text.length && text[end] !== '\n' && (inClass || text[end] !== '/')) {
    if (text[end] === '\\') end += 1;
    else if (text[end] === '[') inClass = true;
    else if (text[end] === ']') inClass = false;

    end += 1;
  }

  return Math.min(end + 1, text.length);
}

/** The position after what was found, or the end of the text when it was not found. */
function endOrLength(text: string, found: number, length = 0): number {
  return found === -1 ? text.length : found + length;
}

type PatternUsesInput = {
  readonly file: SourceFile;
  readonly patterns: readonly Pattern[];
  /** The text to search, when it is a part of the file. Its offsets are those of the file. */
  readonly text?: string | undefined;
};

function patternUses(input: PatternUsesInput): EnvVarUse[] {
  const { file, patterns } = input;
  const text = input.text ?? file.text;

  return patterns.flatMap(({ kind, expression }) => {
    return [...text.matchAll(expression)].flatMap((match) => {
      const name = match[1];

      return name === undefined ? [] : [useAt({ file, name, kind, offset: match.index })];
    });
  });
}

type UseAtInput = {
  readonly file: SourceFile;
  readonly name: string;
  readonly kind: EnvVarUseKind;
  readonly offset: number;
  readonly isPrefix?: boolean;
};

function useAt(input: UseAtInput): EnvVarUse {
  const line = input.file.text.slice(0, input.offset).split('\n').length;

  return { name: input.name, kind: input.kind, file: input.file.path, line, isPrefix: input.isPrefix ?? false };
}

////////////////////////////////////////////////////////////////////////////////
// TypeScript and JavaScript
////////////////////////////////////////////////////////////////////////////////

function scriptUses(file: SourceFile): EnvVarUse[] {
  return [...patternUses({ file, patterns: SCRIPT_PATTERNS }), ...declaredInConstants(file), ...setForAChild(file)];
}

/**
 * The names that a constant holds, when the identifier of the constant says that it holds the name of
 * a variable: `const REPORT_VARIABLE = 'FHEVM_TEST_REPORT'`, or a table such as
 * `const RPC_VARIABLE_OF_CHAIN_ID = new Map([[1, 'MAINNET_RPC_URL']])`. A constant whose identifier
 * also says `PREFIX` holds the start of a family of names.
 */
function declaredInConstants(file: SourceFile): EnvVarUse[] {
  const declaration = /\bconst\s+([A-Z][A-Z0-9_]*)\b[^=;]*=([^;]*);/g;

  return [...file.text.matchAll(declaration)].flatMap((match) => {
    const [, identifier = '', value = ''] = match;

    if (!VARIABLE_IDENTIFIER.test(identifier)) return [];

    const isPrefix = /(?:^|_)PREFIX(?:_|$)/.test(identifier);
    const expected = isPrefix ? DECLARED_PREFIX : DECLARED_NAME;

    return [...value.matchAll(/['"]([A-Z][A-Z0-9_]*)['"]/g)].flatMap((literal) => {
      const name = literal[1] ?? '';
      const offset = match.index + match[0].indexOf(literal[0]);

      return expected.test(name) ? [useAt({ file, name, kind: 'declared', offset, isPrefix })] : [];
    });
  });
}

/** The names that a file sets in the environment of a process it starts, as `env: { ...process.env, NAME: value }`. */
function setForAChild(file: SourceFile): EnvVarUse[] {
  const environment = /\benv\s*:\s*\{([^}]*)\}/g;

  return [...file.text.matchAll(environment)].flatMap((match) => {
    const body = match[1] ?? '';
    const bodyOffset = match.index + match[0].indexOf(body);

    return [...body.matchAll(new RegExp(`(?<![\\w.'"\\[])(${NAME})\\s*:`, 'g'))].flatMap((key) => {
      const name = key[1];

      return name === undefined ? [] : [useAt({ file, name, kind: 'set', offset: bodyOffset + key.index })];
    });
  });
}

/**
 * The places where a script reads `process.env` with a name that is not written there: `process.env[x]`.
 * A constant whose identifier says that it holds the name of a variable is accepted, since
 * `declaredInConstants` finds the name where the constant is declared.
 */
export function computedEnvReads(file: SourceFile): readonly ComputedEnvRead[] {
  const { text } = withoutComments(file);
  const computed = /process\.env\[\s*([^\]'"\s][^\]]*?)\s*\]/g;

  return [...text.matchAll(computed)].flatMap((match) => {
    const expression = match[1] ?? '';
    const isNamedConstant = /^[A-Z][A-Z0-9_]*$/.test(expression) && VARIABLE_IDENTIFIER.test(expression);

    return isNamedConstant ? [] : [{ line: text.slice(0, match.index).split('\n').length, expression }];
  });
}

export type ComputedEnvRead = {
  /** The line of the read, from 1. */
  readonly line: number;
  /** What stands between the brackets of `process.env[...]`. */
  readonly expression: string;
};

////////////////////////////////////////////////////////////////////////////////
// npm scripts and GitHub workflows
////////////////////////////////////////////////////////////////////////////////

/** The variables that the scripts of a package.json give to a command. Nothing else of the file is read. */
function npmScriptUses(file: SourceFile): EnvVarUse[] {
  return Object.entries(scriptsOfPackageJson(file.text)).flatMap(([script, command]) => {
    // The line of the script in the file: its key is written once, at the start of its line.
    const offset = Math.max(0, file.text.indexOf(`"${script}":`));

    return patternUses({ file, patterns: NPM_SCRIPT_PATTERNS, text: `${command} ` }).map((use) => {
      return { ...use, line: file.text.slice(0, offset).split('\n').length };
    });
  });
}

function scriptsOfPackageJson(text: string): Readonly<Record<string, string>> {
  try {
    const scripts: unknown = (JSON.parse(text) as { scripts?: unknown }).scripts;
    const entries = typeof scripts === 'object' && scripts !== null ? Object.entries(scripts) : [];

    return Object.fromEntries(entries.filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
  } catch {
    // Another check reports a package.json that is no JSON.
    return {};
  }
}

/** The keys under each `env:` of a workflow: the variables that a job or a step sets. */
function workflowUses(file: SourceFile): EnvVarUse[] {
  const lines = file.text.split('\n');
  const uses: EnvVarUse[] = [];
  let envIndent: number | undefined;

  for (const [index, line] of lines.entries()) {
    const indent = line.length - line.trimStart().length;

    if (/^\s*env:\s*$/.test(line)) {
      envIndent = indent;
      continue;
    }

    if (envIndent === undefined || line.trim() === '' || line.trimStart().startsWith('#')) continue;

    if (indent <= envIndent) {
      envIndent = undefined;
      continue;
    }

    const key = new RegExp(`^\\s+(${NAME}):`).exec(line)?.[1];

    if (key !== undefined) uses.push({ name: key, kind: 'set', file: file.path, line: index + 1, isPrefix: false });
  }

  return uses;
}

////////////////////////////////////////////////////////////////////////////////
// Shell scripts
////////////////////////////////////////////////////////////////////////////////

/** True for a shell script: by its extension, or by its first line. */
export function isShellScript(file: SourceFile): boolean {
  return extname(file.path) === '.sh' || SHELL_SHEBANG.test(file.text.slice(0, 80));
}

/**
 * The variables that the shell scripts read from their environment, or set for what they start.
 *
 * A script reads a variable of its environment when it reads the variable with a default or a
 * requirement, as `${NAME:-value}` or `${NAME:?message}`, and no script of its folder assigns the
 * variable: the scripts of one folder source each other, so an assignment in one of them makes the
 * variable their own.
 */
export function shellEnvVarUses(scripts: readonly SourceFile[]): readonly EnvVarUse[] {
  const assignedInFolder = new Map<string, Set<string>>();

  for (const script of scripts) {
    const folder = dirname(script.path);
    const assigned = assignedInFolder.get(folder) ?? new Set<string>();

    for (const name of assignedInShell(withoutShellComments(script.text))) assigned.add(name);

    assignedInFolder.set(folder, assigned);
  }

  return scripts.flatMap((file) => {
    const assigned = assignedInFolder.get(dirname(file.path)) ?? new Set<string>();
    const reads = patternUses({
      file,
      patterns: [{ kind: 'read', expression: new RegExp(`\\$\\{(${NAME}):?[-=?+]`, 'g') }],
    });
    const exports = patternUses({
      file,
      patterns: [{ kind: 'set', expression: new RegExp(`^\\s*export\\s+(${NAME})=`, 'gm') }],
    });

    return [...reads.filter((use) => !assigned.has(use.name)), ...exports];
  });
}

/** The script with each line that is a comment emptied: a usage line such as `# NAME=value ./script.sh` assigns nothing. */
function withoutShellComments(text: string): string {
  return text.replace(/^\s*#.*$/gm, '');
}

/** The variables that a shell script assigns itself, by a plain assignment, a `for`, or a `read`. */
function assignedInShell(text: string): readonly string[] {
  // An exported assignment is not counted: `export NAME=value` gives the variable to what the script starts.
  const assignments = [...text.matchAll(new RegExp(`(?<![\\w$\{])(?<!export\\s)(${NAME})=`, 'g'))];
  const loops = [...text.matchAll(new RegExp(`\\bfor\\s+(${NAME})\\s+in\\b`, 'g'))];
  const reads = [...text.matchAll(new RegExp(`\\bread\\s+(?:-\\w+\\s+)*((?:${NAME}\\s*)+)`, 'g'))];

  return [
    ...assignments.map((match) => match[1] ?? ''),
    ...loops.map((match) => match[1] ?? ''),
    ...reads.flatMap((match) => (match[1] ?? '').trim().split(/\s+/)),
  ];
}
