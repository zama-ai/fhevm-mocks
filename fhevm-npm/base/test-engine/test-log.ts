import { type WriteStream, createWriteStream } from 'node:fs';
import type { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';

import { linePrefixer } from './output.ts';

/** The log of one test: the output of what the engine starts for it, and what the engine says about it. */
export type TestLog = {
  readonly file: string;
  /** Sends everything a stream produces to the log, at the pace the log can take. */
  readonly attach: (stream: Readable) => void;
  /** Writes one line of the engine's own. */
  readonly line: (text: string) => void;
  /** Resolves when everything is written. Never rejects. */
  readonly close: () => Promise<void>;
};

export type OpenTestLogInput = {
  readonly file: string;
  readonly id: string;
  /** True: each line of output is also printed, with the test ID in front. */
  readonly verbose: boolean;
};

/**
 * Opens the log of a test. A log that cannot be written never fails or blocks the test: the engine says
 * so once, and the output is read and dropped.
 */
export function openTestLog(input: OpenTestLogInput): TestLog {
  const file = createWriteStream(input.file);
  const sources: Readable[] = [];
  let broken = false;

  file.once('error', (error) => {
    broken = true;
    console.error(`⚠️  The log of ${input.id} cannot be written: ${error.message}`);

    for (const source of sources) dropOutput({ source, file });
  });

  return {
    file: input.file,
    attach: (stream) => {
      sources.push(stream);

      if (input.verbose) echoLines({ stream, id: input.id });

      if (broken) dropOutput({ source: stream, file });
      else stream.pipe(file, { end: false });
    },
    line: (text) => {
      if (!broken) file.write(`${text}\n`);
    },
    close: async () => {
      if (!broken) file.end();

      await finished(file).catch(() => undefined);
    },
  };
}

type DropOutputInput = {
  readonly source: Readable;
  readonly file: WriteStream;
};

/** Keeps reading a stream without writing it: a process whose output nobody reads would block. */
function dropOutput(input: DropOutputInput): void {
  input.source.unpipe(input.file);
  input.source.resume();
}

type EchoLinesInput = {
  readonly stream: Readable;
  readonly id: string;
};

function echoLines(input: EchoLinesInput): void {
  const echo = linePrefixer({ prefix: `[${input.id}] `, write: (line) => console.log(line) });

  input.stream.on('data', echo.push);
  input.stream.once('close', echo.flush);
}
