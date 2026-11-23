import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

import { TestEngineError } from './errors.ts';
import { errorMessage } from './utils.ts';

/** The file of environment variables that the engine reads at the root, when no option names another. */
export const DEFAULT_ENV_FILE_NAME = '.env';
export const ENV_FILE_OPTION_DEFAULT = `<root>/${DEFAULT_ENV_FILE_NAME}, when it exists`;

export type ApplyEnvFileInput = {
  /** The root of the run, as an absolute path. */
  readonly root: string;
  /** The file that the command line names. Undefined: the default file, which may not exist. */
  readonly file: string | undefined;
  /** The environment to complete. The engine passes it on to every test. */
  readonly environment: NodeJS.ProcessEnv;
};

export type AppliedEnvFile = {
  readonly file: string;
  /** The variables that the file set, sorted by name. */
  readonly set: readonly string[];
  /** The variables of the file that the environment already set, and that keep their value. */
  readonly kept: readonly string[];
};

/**
 * Completes the environment with the variables of an env file: lines of `NAME=value`. A variable that
 * the environment already sets keeps its value, so a variable given on the command line wins over the
 * file. Empty counts as not set, as everywhere in the engine.
 *
 * Returns undefined when there is no file to read: the default file is optional. A file that the
 * command line names must exist.
 */
export function applyEnvFile(input: ApplyEnvFileInput): AppliedEnvFile | undefined {
  const file = input.file === undefined ? resolve(input.root, DEFAULT_ENV_FILE_NAME) : resolve(input.file);

  if (!existsSync(file)) {
    if (input.file === undefined) return undefined;

    throw new TestEngineError(`The env file ${file} does not exist.`);
  }

  const variables = Object.entries(readEnvFile(file));
  const isSet = (name: string): boolean => (input.environment[name] ?? '') !== '';
  const kept = variables.filter(([name]) => isSet(name)).map(([name]) => name);
  const toSet = variables.filter(([name]) => !isSet(name));

  for (const [name, value] of toSet) input.environment[name] = value;

  return { file, set: toSet.map(([name]) => name), kept };
}

function readEnvFile(file: string): Readonly<Record<string, string>> {
  try {
    return Object.fromEntries(
      Object.entries(parseEnv(readFileSync(file, 'utf8'))).filter((entry): entry is [string, string] => {
        return entry[1] !== undefined && entry[1] !== '';
      }),
    );
  } catch (error) {
    throw new TestEngineError(`The env file ${file} cannot be read: ${errorMessage(error)}`);
  }
}

/** What the engine says about an env file it read. It names the variables, and never prints a value. */
export function envFileLines(applied: AppliedEnvFile): readonly string[] {
  const { file, set, kept } = applied;

  return [
    set.length === 0 ? `${file} sets no variable.` : `${file} sets ${set.join(', ')}.`,
    ...(kept.length === 0 ? [] : [`The environment already sets ${kept.join(', ')}: the file does not change them.`]),
  ];
}
