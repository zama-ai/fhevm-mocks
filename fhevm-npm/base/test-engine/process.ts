import { type ChildProcessByStdio, spawn } from 'node:child_process';
import type { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';
import { setTimeout as sleep } from 'node:timers/promises';

import { environmentWithoutGuid } from './guid.ts';

/** How long a process group gets to end after SIGTERM, before SIGKILL. */
const STOP_GRACE_MILLISECONDS = 5_000;

/** How long the engine waits for a process group to disappear after SIGKILL. */
const KILL_WAIT_MILLISECONDS = 2_000;

/** How often the engine looks whether a process group still exists. */
const POLL_MILLISECONDS = 25;

/**
 * How long the engine still reads the output of a command that has ended. A process that left the
 * group can hold the pipes open for as long as it lives, so the engine does not wait for it.
 */
const DRAIN_MILLISECONDS = 1_000;

type GroupChild = ChildProcessByStdio<null, Readable, Readable>;

////////////////////////////////////////////////////////////////////////////////
// Starting
////////////////////////////////////////////////////////////////////////////////

export type StartInGroupInput = {
  readonly command: string;
  readonly cwd: string;
  readonly env?: NodeJS.ProcessEnv | undefined;
  /** Receives stdout, then stderr, before any output is read. */
  readonly onStream: (stream: Readable) => void;
  /** Aborted when the run is interrupted: the group is stopped. */
  readonly interruption: AbortSignal;
};

/** How a command ended. `error` is set when the command could not start. */
export type ExitResult = {
  readonly code: number | undefined;
  readonly signal: NodeJS.Signals | undefined;
  readonly error?: Error | undefined;
};

/** A shell command that runs in a process group of its own. */
export type GroupProcess = {
  /** Resolves as soon as the command's own process has exited, or could not start. Never rejects. */
  readonly exited: Promise<ExitResult>;
  /**
   * Resolves once the command has exited, everything it left in its group is stopped, and its output
   * is read. Never rejects.
   */
  readonly ended: Promise<ExitResult>;
  /** Stops the whole group, and resolves when the command has ended, as `ended` defines it. */
  readonly stop: () => Promise<void>;
};

/**
 * Starts a shell command in a process group of its own. The command and everything it starts share
 * that group, so stopping the group stops them all, and a signal sent to the engine's own group, such
 * as Ctrl-C in a terminal, does not reach them behind the engine's back.
 *
 * The command ends when its own process exits, not when its output closes: what it leaves running in
 * its group is stopped at that moment.
 */
export function startInGroup(input: StartInGroupInput): GroupProcess {
  const child: GroupChild = spawn(input.command, {
    cwd: input.cwd,
    env: input.env ?? environmentWithoutGuid(),
    shell: true,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const groupId = child.pid;
  // Once the group is released, its ID can go to another process: the engine never signals it again.
  let released = false;
  const stopGroup = async (): Promise<void> => {
    if (groupId !== undefined && !released) await stopProcessGroup(groupId);
  };
  const onInterruption = (): void => void stopGroup();

  input.onStream(child.stdout);
  input.onStream(child.stderr);
  input.interruption.addEventListener('abort', onInterruption);

  // An interruption that came before the start still stops the command.
  if (input.interruption.aborted) onInterruption();

  const exited = commandExit(child);
  const ended = exited.then(async (exit) => {
    input.interruption.removeEventListener('abort', onInterruption);

    await stopGroup();
    released = true;

    await outputRead(child);

    return exit;
  });
  const stop = async (): Promise<void> => {
    await stopGroup();
    await ended;
  };

  return { exited, ended, stop };
}

/** Resolves when the command's own process has exited, or could not start. */
function commandExit(child: GroupChild): Promise<ExitResult> {
  return new Promise((resolveExit) => {
    child.once('error', (error) => resolveExit({ code: undefined, signal: undefined, error }));
    child.once('exit', (code, signal) => resolveExit({ code: code ?? undefined, signal: signal ?? undefined }));
  });
}

/** Waits for the output to close, within the drain time, then stops reading it. */
async function outputRead(child: GroupChild): Promise<void> {
  const streams = [child.stdout, child.stderr];
  const closed = Promise.all(streams.map((stream) => finished(stream).catch(() => undefined)));
  const drain = new AbortController();

  await Promise.race([closed, sleep(DRAIN_MILLISECONDS, undefined, { signal: drain.signal }).catch(() => undefined)]);

  drain.abort();

  for (const stream of streams) stream.destroy();
}

export function isSuccess(exit: ExitResult): boolean {
  return exit.error === undefined && exit.code === 0;
}

export type DescribeExitInput = {
  readonly exit: ExitResult;
  /** What ended, to start the sentence: `The command`, for example. */
  readonly subject: string;
};

/** One sentence that says how a process ended, for a log. */
export function describeExit(input: DescribeExitInput): string {
  const { exit, subject } = input;

  if (exit.error !== undefined) return `${subject} could not start: ${exit.error.message}`;

  if (exit.signal !== undefined) return `${subject} was stopped by ${exit.signal}.`;

  return `${subject} exited with status ${String(exit.code)}.`;
}

////////////////////////////////////////////////////////////////////////////////
// Stopping
////////////////////////////////////////////////////////////////////////////////

/**
 * Stops a process group, and resolves when it is gone: SIGTERM first, then SIGKILL when the group is
 * still there after the grace period. Does nothing when the group does not exist.
 */
export async function stopProcessGroup(groupId: number): Promise<void> {
  if (!signalProcessGroup({ groupId, signal: 'SIGTERM' })) return;

  if (await processGroupIsGone({ groupId, withinMilliseconds: STOP_GRACE_MILLISECONDS })) return;

  signalProcessGroup({ groupId, signal: 'SIGKILL' });

  await processGroupIsGone({ groupId, withinMilliseconds: KILL_WAIT_MILLISECONDS });
}

type SignalGroupInput = {
  readonly groupId: number;
  /** 0 sends nothing, and only asks whether the group can be signalled. */
  readonly signal: NodeJS.Signals | 0;
};

/**
 * Sends a signal to a whole process group. Returns false when the group took no signal: it no longer
 * exists, or it holds only processes that have already ended.
 */
function signalProcessGroup(input: SignalGroupInput): boolean {
  try {
    process.kill(-input.groupId, input.signal);

    return true;
  } catch {
    return false;
  }
}

type GroupIsGoneInput = {
  readonly groupId: number;
  readonly withinMilliseconds: number;
};

/** Waits until the group no longer exists. Returns false when it still exists after the given time. */
async function processGroupIsGone(input: GroupIsGoneInput): Promise<boolean> {
  const deadline = performance.now() + input.withinMilliseconds;

  while (signalProcessGroup({ groupId: input.groupId, signal: 0 })) {
    if (performance.now() >= deadline) return false;

    await sleep(POLL_MILLISECONDS);
  }

  return true;
}
