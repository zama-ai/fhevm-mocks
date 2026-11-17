// SPDX-License-Identifier: BSD-3-Clause-Clear
//
// Small, dependency-free helpers for the two CREATE2 coordinators.
//
// Runs on plain `node` (>= 22.18), which strips types at load. That constrains the syntax to the
// "erasable" subset: no `enum`, no `namespace`, no parameter properties, and relative imports must
// carry their `.ts` extension. Union types stand in for enums throughout.

import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { relative, resolve, sep } from 'node:path';
import { createInterface } from 'node:readline/promises';

////////////////////////////////////////////////////////////////////////////////

export type CaptureResult = {
  readonly ok: boolean;
  readonly stdout: string;
  readonly stderr: string;
  readonly code: number;
};

////////////////////////////////////////////////////////////////////////////////

/** Print an error block to stderr and exit non-zero. Never returns. */
/**
 * The transcript: everything printed by this run, and by every child it streams, appended to one file.
 *
 * Off until `startTranscript` names a path. A run-book wants the exact output an operator saw, including
 * a child's `FAIL` lines, on disk rather than in a terminal scrollback that closes.
 */
let transcriptPath: string | null = null;

export function startTranscript(path: string): void {
  transcriptPath = path;
}

function transcribe(text: string): void {
  if (transcriptPath === null || text === '') return;
  appendFileSync(transcriptPath, text.endsWith('\n') ? text : `${text}\n`);
}

export function fail(...lines: readonly string[]): never {
  for (const line of lines) {
    console.error(line);
    transcribe(line);
  }
  process.exit(1);
}

////////////////////////////////////////////////////////////////////////////////

export function say(...lines: readonly string[]): void {
  for (const line of lines) {
    console.log(line);
    transcribe(line);
  }
}

const BANNER_RULE = '*'.repeat(60);

/**
 * The start of a stage, so a reader can tell where one ends and the next begins:
 *
 *   (blank line)
 *   (blank line)
 *   ************************************************************
 *   **   🥬 Step E: offer the ACLOwner to the admin
 *   ************************************************************
 *   (blank line)
 *
 * No closing `**` on the title line: an emoji is one character but two columns wide in most terminals,
 * so a right edge would never line up. Forge scripts print a banner of their own (`=== … ===`) inside
 * the stage; this is the stage's.
 */
export function banner(title: string): void {
  say('', '', BANNER_RULE, `**   ${title}`, BANNER_RULE, '');
}

////////////////////////////////////////////////////////////////////////////////

/** Only the first line is labeled; the rest are indented to align under it. */
export function warn(...lines: readonly string[]): void {
  lines.forEach((line, i) => {
    say(i === 0 ? `  WARNING: ${line}` : `           ${line}`);
  });
}

////////////////////////////////////////////////////////////////////////////////

/**
 * Run a command with its output streaming straight through, and return its exit code.
 *
 * Does NOT throw on failure: several callers need the code so they can record a journal entry
 * before giving up, which is the whole point of keeping the audit trail useful for failed runs.
 */
export function run(cmd: string, args: readonly string[], env?: NodeJS.ProcessEnv): number {
  const r = spawnSync(cmd, args as string[], {
    stdio: 'inherit',
    env: env ? { ...process.env, ...env } : process.env,
  });
  return r.status ?? 1;
}

/** How much of the last `runLogged` child's output is kept for `lastChildOutput`: its error is at the end. */
const CHILD_OUTPUT_TAIL = 64 * 1024;
let childOutput = '';

/**
 * `run`, streaming the child's output live — and into the transcript, when one is being kept.
 *
 * Without a transcript the child gets the real terminal: forge draws its live progress (transactions
 * being sent, receipts arriving) only when its output IS a terminal, so a pipe would hide all of it and a
 * broadcast would look frozen for minutes. With a transcript the output has to be piped to be copied, so
 * that progress is lost; `progress`, if given, is printed every `progressMs` while the child runs to
 * make up for it.
 *
 * Async because streaming and capturing at once needs pipes, and a pipe is read as it fills. The exit
 * code is returned, never thrown on, for the same reason as `run`.
 */
export function runLogged(
  cmd: string,
  args: readonly string[],
  env?: NodeJS.ProcessEnv,
  progress?: () => string,
  progressMs = 30_000,
): Promise<number> {
  childOutput = '';
  return new Promise((resolveCode) => {
    const childEnv = env ? { ...process.env, ...env } : process.env;
    if (transcriptPath === null) {
      const child = spawn(cmd, args as string[], { stdio: 'inherit', env: childEnv });
      child.on('error', () => {
        resolveCode(1);
      });
      child.on('close', (code) => {
        resolveCode(code ?? 1);
      });
      return;
    }

    const child = spawn(cmd, args as string[], { stdio: ['inherit', 'pipe', 'pipe'], env: childEnv });
    const keep = (chunk: Buffer): void => {
      childOutput = (childOutput + chunk.toString()).slice(-CHILD_OUTPUT_TAIL);
    };
    // Piped, the child shows no live progress of its own, so something here must: the caller's line if it
    // has a better one, otherwise which command is still running and for how long.
    const beat = heartbeat(progressMs);
    const line = progress ?? (() => `  … ${cmd} ${args[0] ?? ''} still running (${beat.elapsed()})`);
    const timer = setInterval(() => {
      say(line());
    }, progressMs);
    const stop = (code: number): void => {
      clearInterval(timer);
      resolveCode(code);
    };
    child.stdout.on('data', (chunk: Buffer) => {
      process.stdout.write(chunk);
      transcribe(chunk.toString());
      keep(chunk);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      process.stderr.write(chunk);
      transcribe(chunk.toString());
      keep(chunk);
    });
    child.on('error', () => {
      stop(1);
    });
    child.on('close', (code) => {
      stop(code ?? 1);
    });
  });
}

/**
 * The end of what the last `runLogged` child printed, so a caller can tell why it failed (`rpcFailure`).
 * Only when a transcript is kept: otherwise the child had the terminal, and its output was never seen here ('').
 */
export function lastChildOutput(): string {
  return childOutput;
}

/** Is a transcript being kept? Then a child's output is piped, and its own live progress is not shown. */
export function transcriptActive(): boolean {
  return transcriptPath !== null;
}

/**
 * A rate limiter for "still waiting" lines: true at most once per `ms`, starting `ms` after creation.
 * A wait loop that polls every few seconds then speaks once a minute — never silent for long, never a
 * flood. `elapsed()` says how long the wait has been going, for the line itself.
 */
export function heartbeat(ms = 60_000): { readonly due: () => boolean; readonly elapsed: () => string } {
  const started = Date.now();
  let last = started;
  return {
    due: () => {
      const now = Date.now();
      if (now - last < ms) return false;
      last = now;
      return true;
    },
    elapsed: () => {
      const s = Math.round((Date.now() - started) / 1000);
      return s < 60 ? `${String(s)}s` : `${String(Math.floor(s / 60))}m${String(s % 60).padStart(2, '0')}s`;
    },
  };
}

////////////////////////////////////////////////////////////////////////////////

/**
 * The `cast` subcommands that only read the chain. Only these are retried on an RPC error (`capture`): a
 * transaction (`send`, `publish`) or a raw `rpc` call is never repeated behind the operator's back.
 */
const CAST_READS: ReadonlySet<string> = new Set([
  'balance',
  'block',
  'block-number',
  'call',
  'chain-id',
  'code',
  'logs',
  'nonce',
  'receipt',
  'storage',
  'tx',
]);

/** The waits between attempts of a read that hit an RPC error: 15 s in all, more than a block on Ethereum. */
const RPC_RETRY_MS: readonly number[] = [1_000, 2_000, 4_000, 8_000];

/**
 * Run a command and capture its output. Never throws; inspect `.ok`.
 *
 * A `cast` read that fails on an RPC error (`rpcFailure`: a rate limit, a backend behind the head, a dropped
 * connection) is tried again, up to four times over 15 s, before its failure is returned. Without it, such an
 * error comes back as an answer: `cast call` failing reads as "reverted", `cast code` as "no code", and the
 * caller decides on it. Synchronous, like the rest of `capture`: the run waits.
 */
export function capture(cmd: string, args: readonly string[]): CaptureResult {
  const retries = cmd === 'cast' && CAST_READS.has(args[0] ?? '') ? RPC_RETRY_MS : [];
  for (let attempt = 0; ; attempt++) {
    const r = captureOnce(cmd, args);
    const wait = retries[attempt];
    if (r.ok || wait === undefined || rpcFailure(r.stderr) === null) return r;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, wait);
  }
}

function captureOnce(cmd: string, args: readonly string[]): CaptureResult {
  const r = spawnSync(cmd, args as string[], { encoding: 'utf8' });
  // `r.error` is set when `cmd` itself doesn't exist (ENOENT) — nothing was spawned, so `r.stdout`/
  // `r.stderr` are `undefined` at runtime despite spawnSync's types promising a string once `encoding`
  // is set. `requireTool` relies on this never throwing so its `command`-then-`which` fallback can
  // reach the second attempt on a platform (Linux) where `command` isn't a standalone executable,
  // only a shell builtin, unlike on macOS.
  if (r.error) return { ok: false, stdout: '', stderr: '', code: 1 };
  return {
    ok: r.status === 0,
    stdout: r.stdout.trim(),
    stderr: r.stderr.trim(),
    code: r.status ?? 1,
  };
}

////////////////////////////////////////////////////////////////////////////////

/** Capture, or die with the command line and stderr. For calls whose failure is not recoverable. */
export function captureOrFail(cmd: string, args: readonly string[]): string {
  const r = capture(cmd, args);
  if (!r.ok) {
    const cause = rpcFailure(r.stderr);
    if (cause !== null) {
      fail(...rpcFailureLines(`\`${cmd} ${args[0] ?? ''}\``, cause, 'This call sent nothing.'), r.stderr);
    }
    fail(`Error: \`${cmd} ${args.join(' ')}\` failed (exit ${r.code}).`, r.stderr === '' ? '' : `       ${r.stderr}`);
  }
  return r.stdout;
}

////////////////////////////////////////////////////////////////////////////////

/**
 * The RPC errors that end a step without anything being wrong with what it checks, each with what it means.
 *
 * All three seen on Sepolia came from public endpoints, not from the stack: a load-balanced RPC whose backends
 * are at different heights (forge forking at a head one backend has not seen: `block not found`, -32001; `cast
 * logs` up to a head read a moment before from another backend: `beyond current head block`, -32602), and a
 * free tier's rate limit (HTTP 429, -32005). The last row is the transport itself. Kept short on purpose: each
 * pattern is specific to a node or transport error, never to anything a check prints.
 */
const RPC_ERRORS: ReadonlyArray<readonly [RegExp, string]> = [
  [/block not found|header not found/i, 'the node did not have a block it was asked for'],
  [/beyond current head block/i, 'the node is behind the head this run read from it a moment earlier'],
  [/HTTP error 429|error code -32005|too many requests|rate.?limit/i, 'the node rate-limited this run'],
  [
    /connection refused|connection reset|connection closed|error sending request|timed out/i,
    'the connection to the node failed or timed out',
  ],
];

/** A line a verify or precheck script prints for a failed check (FhevmVerifyBase.s.sol: `  FAIL <what>`). */
const CHECK_FAILED = /^\s*FAIL\s/m;

/**
 * Why a forge or cast step failed, when it is the RPC: what that error means, or null when it is not one.
 *
 * Null as soon as the output holds a failed check (`FAIL`): then the checks speak, whatever else went wrong.
 */
export function rpcFailure(output: string): string | null {
  if (CHECK_FAILED.test(output)) return null;
  return RPC_ERRORS.find(([pattern]) => pattern.test(output))?.[1] ?? null;
}

/**
 * The error for a step that failed on the RPC (`cause`, from `rpcFailure`): that it is not a check, what was
 * sent (`sent`, the caller's to say), and what to do.
 *
 * No forge setting is suggested for a rate limit: forge already retries a rate-limited request with backoff, and its
 * `--compute-units-per-second` has no environment or config equivalent this tool could pass on (Foundry 1.5.1).
 */
export function rpcFailureLines(what: string, cause: string, sent: string): string[] {
  return [
    `Error: ${what} failed on an RPC error, not on a check: ${cause}.`,
    `       ${sent}`,
    '       Run the same command again. If it recurs, point --rpc-url (rpcUrl in the config) at a single,',
    '       non-load-balanced archive node rather than a load-balanced public endpoint, whose backends can be at',
    '       different heights; a rate limit (HTTP 429) clears after a pause, or with a plan that allows more.',
  ];
}

/** `fail` with `rpcFailureLines` when `output` shows an RPC error; returns otherwise, for the caller's own error. */
export function failIfRpcError(what: string, output: string, sent: string): void {
  const cause = rpcFailure(output);
  if (cause !== null) fail(...rpcFailureLines(what, cause, sent));
}

////////////////////////////////////////////////////////////////////////////////

export function requireTool(name: string): void {
  if (!capture('command', ['-v', name]).ok && !capture('which', [name]).ok) {
    fail(`Error: ${name} not on PATH.`);
  }
}

////////////////////////////////////////////////////////////////////////////////

/**
 * Parse a hex quantity as forge writes it ("0x5f3a91") into a number.
 *
 * Block numbers and gas values are well inside Number's exact-integer range; anything that is not
 * is a bug worth surfacing rather than silently rounding, hence the explicit guard.
 */
export function hexToNumber(hex: string | null | undefined): number | null {
  if (hex === null || hex === undefined) return null;
  const n = BigInt(hex);
  if (n > BigInt(Number.MAX_SAFE_INTEGER)) fail(`Error: value out of safe integer range: ${hex}`);
  return Number(n);
}

////////////////////////////////////////////////////////////////////////////////

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

////////////////////////////////////////////////////////////////////////////////

/** A TCP port nothing is listening on right now, from the kernel rather than a guess. */
export function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      server.close(() => {
        if (port === 0) reject(new Error('no free port'));
        else resolvePort(port);
      });
    });
  });
}

////////////////////////////////////////////////////////////////////////////////

/**
 * Start a long-lived process in the background, silenced, and make sure it dies with this one.
 *
 * `stdio: 'ignore'` rather than inherit: a node's log would interleave with the run's own output, and the
 * caller reads the node through its RPC, not its stdout.
 */
export function spawnBackground(cmd: string, args: readonly string[]): ChildProcess {
  const child = spawn(cmd, args as string[], { stdio: 'ignore' });
  const kill = (): void => {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
  };
  process.once('exit', kill);
  return child;
}

////////////////////////////////////////////////////////////////////////////////

/** Poll `ready` every 200 ms until it holds, or fail after `timeoutMs`. */
export async function waitUntil(ready: () => boolean, timeoutMs: number, what: string): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!ready()) {
    if (Date.now() > deadline) fail(`Error: ${what} did not become ready within ${String(timeoutMs)} ms.`);
    await sleep(200);
  }
}

////////////////////////////////////////////////////////////////////////////////

/** Case-insensitive address comparison. Neither side is assumed to be checksummed. */
export function sameAddress(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

////////////////////////////////////////////////////////////////////////////////

/**
 * Is `child` the same as, or underneath, `parent`?
 *
 * Compares resolved paths rather than strings, so `..` segments and a trailing slash cannot smuggle
 * a path out of the directory it is being checked against.
 */
export function isInside(child: string, parent: string): boolean {
  const rel = relative(resolve(parent), resolve(child));
  return rel === '' || (!rel.startsWith('..') && !rel.startsWith(sep) && !/^[A-Za-z]:/.test(rel));
}

////////////////////////////////////////////////////////////////////////////////

export function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

////////////////////////////////////////////////////////////////////////////////

/** Append one JSON object per line. Creates the file if absent; never rewrites what is there. */
export function appendJsonl(path: string, rows: readonly unknown[]): void {
  if (rows.length === 0) return;
  appendFileSync(path, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
}

////////////////////////////////////////////////////////////////////////////////

export function readJsonl<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l) as T);
}

////////////////////////////////////////////////////////////////////////////////

export function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

////////////////////////////////////////////////////////////////////////////////

export function removeIfPresent(...paths: readonly string[]): void {
  for (const p of paths) rmSync(p, { recursive: true, force: true });
}

////////////////////////////////////////////////////////////////////////////////

/** Left-padded fixed-width column, truncated rather than allowed to overflow and break alignment. */
export function pad(value: string, width: number): string {
  const s = value.length > width ? value.slice(0, width) : value;
  return s.padEnd(width);
}

////////////////////////////////////////////////////////////////////////////////

export async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(question);
    return answer.trim().toLowerCase() === 'y';
  } finally {
    rl.close();
  }
}
