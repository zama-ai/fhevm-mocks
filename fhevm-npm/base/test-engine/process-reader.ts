import { TestEngineError } from './errors.ts';
import { LINUX_READER } from './process-reader-linux.ts';
import { MACOS_READER } from './process-reader-macos.ts';

/** A running process that carries a GUID of the engine in its environment. */
export type EngineProcess = {
  readonly pid: number;
  readonly groupId: number;
  readonly guid: string;
};

/**
 * How the engine reads the processes of one operating system: which ones carry a GUID of the engine,
 * and which ones listen on a port. No reader ever throws for a process it cannot read: it leaves that
 * process out. So what a reader returns is what the engine could see, not all there is.
 */
export type ProcessReader = {
  /** Every running process that carries a GUID of the engine, as far as the engine can see. */
  readonly list: () => Promise<readonly EngineProcess[]>;
  /** The GUID that a process carries now, or undefined when it carries none, is gone, or cannot be read. */
  readonly guidOf: (pid: number) => Promise<string | undefined>;
  /** The processes that listen on a TCP port now, as far as the engine can see. */
  readonly listenersOn: (port: number) => Promise<readonly number[]>;
};

export function processReader(): ProcessReader {
  if (process.platform === 'linux') return LINUX_READER;

  if (process.platform === 'darwin') return MACOS_READER;

  throw new TestEngineError(`The engine cannot read the processes of ${process.platform}.`);
}
