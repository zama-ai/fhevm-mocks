import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { TestEngineError } from './errors.ts';
import { engineGuidAmong } from './guid.ts';
import type { EngineProcess, ProcessReader } from './process-reader.ts';

// macOS gives a program no file to read another process from, so the engine asks two programs that are
// part of the system: `ps` for the environment of a process, and `lsof` for the listeners of a port.
// Both run beside the engine, with a time limit: a slow answer never stops the engine from reading the
// output of its tests or from taking a signal.

const execFileAsync = promisify(execFile);

/** How long `ps` or `lsof` gets to answer. Past it, the engine has no answer, and says so. */
const TOOL_LIMIT_MILLISECONDS = 10_000;

/** The most output the engine takes from one call of `ps`: the whole process list, with every environment. */
const PS_OUTPUT_LIMIT_BYTES = 256 * 1024 * 1024;

export const MACOS_READER: ProcessReader = {
  list: () => processes(['-A']),
  guidOf: async (pid) => (await processes(['-p', String(pid)]))[0]?.guid,
  listenersOn,
};

/** Runs a program of the system, and returns what it printed. Undefined when it failed or took too long. */
async function toolOutput(program: string, options: readonly string[]): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync(program, [...options], {
      encoding: 'utf8',
      maxBuffer: PS_OUTPUT_LIMIT_BYTES,
      timeout: TOOL_LIMIT_MILLISECONDS,
      killSignal: 'SIGKILL',
    });

    return stdout;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new TestEngineError(`The engine needs ${program}, which is part of macOS, and did not find it.`);
    }

    return undefined;
  }
}

////////////////////////////////////////////////////////////////////////////////
// The environment of a process: ps
////////////////////////////////////////////////////////////////////////////////
// `ps -E` prints the arguments of a process, then its environment, on one line. To tell them apart,
// the engine asks twice, without and with the environment, and reads the GUID only in what the second
// answer adds. So a process that merely has the text of a GUID among its arguments is never taken for
// a node. In the environment, the engine keeps a process only when one word is exactly the variable
// and a whole GUID: a value that `ps` cut off does not match.
//
// macOS hides the environment of its own programs, such as /bin/sh, so a shell that wraps a node is not
// listed. The node behind it is, and stopping its process group stops the shell too.

type PsLine = {
  readonly pid: number;
  readonly groupId: number;
  /** The command column, as `ps` printed it. */
  readonly command: string;
};

async function processes(which: readonly string[]): Promise<readonly EngineProcess[]> {
  const withArguments = new Map((await psLines(which)).map((line) => [line.pid, line]));
  const withEnvironment = await psLines([...which, '-E']);

  return withEnvironment.flatMap(({ pid, groupId, command }) => {
    const argumentsOnly = withArguments.get(pid);

    // Another process took the ID between the two answers, or the process is new: it is not kept.
    if (argumentsOnly?.groupId !== groupId || !command.startsWith(argumentsOnly.command)) return [];

    const environment = command.slice(argumentsOnly.command.length).trim().split(/\s+/);
    const guid = engineGuidAmong(environment);

    return guid === undefined ? [] : [{ pid, groupId, guid }];
  });
}

async function psLines(options: readonly string[]): Promise<readonly PsLine[]> {
  // -ww keeps each line whole. ps fails when -p names a process that is gone.
  const output = (await toolOutput('ps', [...options, '-ww', '-o', 'pid=,pgid=,command='])) ?? '';

  return output.split('\n').flatMap((line) => {
    const fields = /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(line);

    return fields === null ? [] : [{ pid: Number(fields[1]), groupId: Number(fields[2]), command: fields[3] ?? '' }];
  });
}

////////////////////////////////////////////////////////////////////////////////
// The listeners of a port: lsof
////////////////////////////////////////////////////////////////////////////////

/** The processes that listen on the port. `lsof` prints one process ID per line, and fails when it finds none. */
async function listenersOn(port: number): Promise<readonly number[]> {
  // -nP keeps addresses and ports as numbers, and -t prints process IDs only.
  const output = (await toolOutput('lsof', ['-nP', '-t', `-iTCP:${port}`, '-sTCP:LISTEN'])) ?? '';

  return output.split('\n').filter(Boolean).map(Number);
}
