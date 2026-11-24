/** A test that the engine has started, and that has not ended yet. */
export type StartedTest = {
  readonly id: string;
  /** The number of the lane the test runs in, from 1. */
  readonly lane: number;
};

/** A test that waits for a resource that other tests hold. */
export type WaitingTest = StartedTest & {
  /** The tests that hold a resource it needs, or that wait for one before it. */
  readonly heldBy: readonly string[];
};

/** Says that the tests of a run are alive, whatever the tests print themselves. */
export type Progress = {
  /** A test waits for a resource before it starts: prints one line. */
  readonly waiting: (test: WaitingTest) => void;
  /** A test starts: prints one line. */
  readonly started: (test: StartedTest) => void;
  /** A test ended: it is in no later line. */
  readonly ended: (id: string) => void;
  /** Prints nothing more. */
  readonly stop: () => void;
};

export type WatchProgressInput = {
  /** How often to print the running tests. Undefined: never. */
  readonly intervalMilliseconds: number | undefined;
  readonly write: (line: string) => void;
};

/**
 * Prints one line when a test starts and, at each interval, one line for each test that is still
 * running, with the time since it started. A test that prints nothing for minutes, as a forge test does
 * while one of its functions runs, then still shows that it runs, and for how long. A test that waits
 * for a resource has its own lines, until it starts.
 */
export function watchProgress(input: WatchProgressInput): Progress {
  const running = new Map<string, { readonly lane: number; readonly startedAt: number }>();
  const waiting = new Map<string, { readonly lane: number; readonly startedAt: number }>();
  const printRunning = (): void => {
    const lines = [
      ...[...running].map(([id, test]) => ({ id, ...test, label: '⏳ running' })),
      ...[...waiting].map(([id, test]) => ({ id, ...test, label: '⏸ waiting' })),
    ].sort((a, b) => a.lane - b.lane);

    for (const { id, lane, startedAt, label } of lines) {
      input.write(`${label}  lane ${lane}  ${id}  ${formatElapsed(performance.now() - startedAt)}`);
    }
  };
  const timer =
    input.intervalMilliseconds === undefined ? undefined : setInterval(printRunning, input.intervalMilliseconds);

  // The timer alone never keeps the engine alive.
  timer?.unref();

  return {
    waiting: ({ id, lane, heldBy }) => {
      waiting.set(id, { lane, startedAt: performance.now() });
      input.write(
        `⏸ waiting  lane ${lane}  ${id}  for a resource that ${heldBy.join(', ')} ${heldBy.length === 1 ? 'uses' : 'use'}`,
      );
    },
    started: ({ id, lane }) => {
      waiting.delete(id);
      running.set(id, { lane, startedAt: performance.now() });
      input.write(`▶ started  lane ${lane}  ${id}`);
    },
    ended: (id) => running.delete(id),
    stop: () => clearInterval(timer),
  };
}

/**
 * A time since a start, for a person to read: `45s`, `2m05s`, `1h02m05s`. It is rounded to the nearest
 * second, so that a line printed every 30 seconds does not say `29s`, then `1m00s`.
 */
export function formatElapsed(milliseconds: number): string {
  const total = Math.round(milliseconds / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const padded = (value: number): string => String(value).padStart(2, '0');

  if (hours > 0) return `${hours}h${padded(minutes)}m${padded(seconds)}s`;

  return minutes > 0 ? `${minutes}m${padded(seconds)}s` : `${seconds}s`;
}
