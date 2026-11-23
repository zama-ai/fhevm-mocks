/** A test that the engine has started, and that has not ended yet. */
export type StartedTest = {
  readonly id: string;
  /** The number of the lane the test runs in, from 1. */
  readonly lane: number;
};

/** Says that the tests of a run are alive, whatever the tests print themselves. */
export type Progress = {
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
 * while one of its functions runs, then still shows that it runs, and for how long.
 */
export function watchProgress(input: WatchProgressInput): Progress {
  const running = new Map<string, { readonly lane: number; readonly startedAt: number }>();
  const printRunning = (): void => {
    const byLane = [...running].sort(([, a], [, b]) => a.lane - b.lane);

    for (const [id, { lane, startedAt }] of byLane) {
      input.write(`⏳ running  lane ${lane}  ${id}  ${formatElapsed(performance.now() - startedAt)}`);
    }
  };
  const timer =
    input.intervalMilliseconds === undefined ? undefined : setInterval(printRunning, input.intervalMilliseconds);

  // The timer alone never keeps the engine alive.
  timer?.unref();

  return {
    started: ({ id, lane }) => {
      running.set(id, { lane, startedAt: performance.now() });
      input.write(`▶ started  lane ${lane}  ${id}`);
    },
    ended: (id) => running.delete(id),
    stop: () => clearInterval(timer),
  };
}

/** A time since a start, for a person to read: `45s`, `2m05s`, `1h02m05s`. */
export function formatElapsed(milliseconds: number): string {
  const total = Math.floor(milliseconds / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const padded = (value: number): string => String(value).padStart(2, '0');

  if (hours > 0) return `${hours}h${padded(minutes)}m${padded(seconds)}s`;

  return minutes > 0 ? `${minutes}m${padded(seconds)}s` : `${seconds}s`;
}
