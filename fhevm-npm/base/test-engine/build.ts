import { TestEngineError } from './errors.ts';
import { formatDuration } from './output.ts';
import { describeExit, isSuccess, startInGroup } from './process.ts';
import { openTestLog } from './test-log.ts';

/** The name of the build in its log, and in front of its lines when they are printed. */
const BUILD_LOG_ID = 'build';

/** What the engine knows of the build of a run: the command it was given, and how long it took. */
export type BuildOutcome = {
  readonly command: string;
  readonly durationMilliseconds: number;
};

export type RunBuildInput = {
  /** The command that builds the workspace, as given when the engine was launched. */
  readonly command: string;
  /** The directory the command runs from. */
  readonly root: string;
  readonly logFile: string;
  /** True: each line of the build's output is also printed. */
  readonly verbose: boolean;
  /** Aborted when the run is interrupted: the build is stopped. */
  readonly interruption: AbortSignal;
  /** Called when the build starts, with the file of its log. */
  readonly onStart: (logFile: string) => void;
  /** Called when the build ended, whatever its result. */
  readonly onEnd: () => void;
};

/**
 * Runs the build command of a run, once, before any test. The engine knows nothing of what the command
 * does: it runs it from the root, keeps its output, and reads whether it succeeded. A build that fails
 * fails the run, so that no test runs on a workspace that is not built.
 */
export async function runBuild(input: RunBuildInput): Promise<BuildOutcome> {
  const { command, logFile } = input;
  const log = openTestLog({ file: logFile, id: BUILD_LOG_ID, verbose: input.verbose });
  const startedAt = performance.now();

  console.log(`▶ Building, from ${input.root}: $ ${command}`);
  console.log(`  The output of the build goes to ${logFile}`);
  log.line(`$ ${command}`);
  input.onStart(logFile);

  const build = startInGroup({ command, cwd: input.root, onStream: log.attach, interruption: input.interruption });
  const exit = await build.ended;

  input.onEnd();

  const durationMilliseconds = performance.now() - startedAt;
  const ending = describeExit({ exit, subject: 'The build' });

  log.line(`\n${ending}`);
  await log.close();

  if (input.interruption.aborted)
    throw new TestEngineError(`The run was interrupted during the build. Log: ${logFile}`);

  if (!isSuccess(exit)) throw new TestEngineError(`${ending} No test was run. Log: ${logFile}`);

  console.log(`✅ built  ${formatDuration(durationMilliseconds)}`);

  return { command, durationMilliseconds };
}
