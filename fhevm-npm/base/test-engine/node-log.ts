import { writeFileSync } from 'node:fs';
import type { Readable } from 'node:stream';
import { StringDecoder } from 'node:string_decoder';

/** How many lines of a node's output the engine keeps, when the run names no other number. */
export const DEFAULT_NODE_LOG_LINES = 500;

/** The variable that gives the number of lines to keep, when no option does. */
export const NODE_LOG_LINES_VARIABLE = 'FHEVM_TEST_NODE_LOG_LINES';

/**
 * The log of one node that the engine started. It is kept apart from the log of the node's test, and
 * holds only the last lines the node printed: a node prints a line or more for each request it serves,
 * so its whole output is large, and what explains a failure is at its end.
 */
export type NodeLog = {
  readonly file: string;
  /** Takes everything a stream of the node produces. */
  readonly attach: (stream: Readable) => void;
  /** Writes the lines that were kept to the file. Never throws: a log that cannot be written is said, once. */
  readonly close: () => void;
};

export type OpenNodeLogInput = {
  readonly file: string;
  /** The most lines to keep. A whole number, 1 or more. */
  readonly maximumLines: number;
};

/**
 * Opens the log of a node. The engine knows nothing of what a node prints, so it keeps no line for what
 * it says: it keeps the most recent ones, whatever the node program is.
 */
export function openNodeLog(input: OpenNodeLogInput): NodeLog {
  const { file, maximumLines } = input;
  const kept: string[] = [];
  let dropped = 0;

  const keep = (line: string): void => {
    kept.push(line);

    if (kept.length > maximumLines) {
      kept.shift();
      dropped += 1;
    }
  };

  return {
    file,
    attach: (stream) => keepLinesOf({ stream, keep }),
    close: () => {
      const header =
        dropped === 0
          ? []
          : [`[The node printed ${dropped} line(s) before these. Only its last ${maximumLines} are kept.]`];

      try {
        writeFileSync(file, [...header, ...kept, ''].join('\n'));
      } catch (error) {
        console.error(
          `⚠️  The log of the node cannot be written to ${file}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
  };
}

type KeepLinesInput = {
  readonly stream: Readable;
  readonly keep: (line: string) => void;
};

/** Hands on the output of one stream, one whole line at a time. Each stream keeps its own unfinished line. */
function keepLinesOf(input: KeepLinesInput): void {
  const decoder = new StringDecoder('utf8');
  let pending = '';

  const take = (text: string): void => {
    const lines = (pending + text).split('\n');

    pending = lines.pop() ?? '';
    lines.forEach(input.keep);
  };

  input.stream.on('data', (chunk: Buffer) => take(decoder.write(chunk)));
  input.stream.once('close', () => {
    take(decoder.end());

    if (pending !== '') input.keep(pending);

    pending = '';
  });
}
