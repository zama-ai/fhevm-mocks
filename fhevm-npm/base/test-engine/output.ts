import { StringDecoder } from 'node:string_decoder';

/** Receives output in chunks, and hands it on one whole line at a time, each with a prefix. */
export type LinePrefixer = {
  readonly push: (chunk: Buffer) => void;
  /** Hands on what remains when the output ends without a newline. */
  readonly flush: () => void;
};

export type LinePrefixerInput = {
  readonly prefix: string;
  readonly write: (line: string) => void;
};

/** One prefixer serves one stream: it keeps the unfinished line, and the unfinished character, of that stream. */
export function linePrefixer(input: LinePrefixerInput): LinePrefixer {
  const decoder = new StringDecoder('utf8');
  let pending = '';

  const takeLines = (text: string): void => {
    const lines = (pending + text).split('\n');

    pending = lines.pop() ?? '';

    for (const line of lines) input.write(`${input.prefix}${line}`);
  };

  return {
    push: (chunk) => takeLines(decoder.write(chunk)),
    flush: () => {
      takeLines(decoder.end());

      if (pending !== '') input.write(`${input.prefix}${pending}`);

      pending = '';
    },
  };
}

/** A duration for a person to read, such as `2.0s`. */
export function formatDuration(milliseconds: number): string {
  return `${(milliseconds / 1000).toFixed(1)}s`;
}
