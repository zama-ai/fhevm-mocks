// The re-point engine's shared pieces: what every flow that re-points a live stack's proxies needs, whatever
// generation it runs on and whatever it re-points — a generation upgrade (upgrade/) or a hotfix. Outside upgrade/
// on purpose: that folder is deleted at every rotation (ROTATION.md), and this is not.
//
//   reads     one `cast call` per getter, at the head or at a block
//   logs      event scans in RPC-sized windows
//   forge     a read-only script run, and the fresh recompile it checks against
//   progress  the step ledger (progress.jsonl) and its offline view

import { join } from 'node:path';

import { type Ctx, headBlock, traceArgs } from './common.ts';
import {
  appendJsonl,
  banner,
  capture,
  ensureDir,
  fail,
  heartbeat,
  pad,
  readJsonl,
  removeIfPresent,
  runLogged,
  say,
} from './utils.ts';

/** `--block N` for a read that must be taken at the snapshot block; nothing for a read at the head. */
export function atBlock(block?: number): string[] {
  return block === undefined ? [] : ['--block', String(block)];
}

/**
 * One `cast call` returning an address, or null if the call reverted or answered zero.
 *
 * `capture`, not `captureOrFail`: a revert is a legitimate ANSWER here rather than a failure. It is what
 * a wrong address looks like when it holds no code, or holds something without that getter — and the
 * caller is what decides whether that is fatal.
 */
export function callAddress(ctx: Ctx, target: string, sig: string, block?: number): string | null {
  const r = capture('cast', ['call', target, sig, '--rpc-url', ctx.opt.rpcUrl, ...atBlock(block)]);
  if (!r.ok) return null;
  const out = r.stdout;
  // `cast call` answers with a 32-byte word; an address is its low 20 bytes.
  if (out === '' || /^0x0*$/.test(out)) return null;
  return `0x${out.slice(-40)}`;
}

/**
 * One `cast call` returning a string (`getVersion`, and the EIP-712 domain name).
 *
 * No `abi-decode` step: giving `cast call` a signature WITH the return type — `getVersion()(string)` —
 * makes it decode for us and answer `"KMSVerifier v0.2.0"`, quotes included. Decoding that again fails,
 * which reported a perfectly good KMSVerifier as uninitialized and would have blocked a correct upgrade.
 * Only the quotes need stripping.
 */
export function callString(ctx: Ctx, target: string, sig: string): string | null {
  const r = capture('cast', ['call', target, sig, '--rpc-url', ctx.opt.rpcUrl]);
  return r.ok ? r.stdout.replace(/^"|"$/g, '') : null;
}

export function callUint(ctx: Ctx, target: string, sig: string, block?: number): bigint | null {
  const r = capture('cast', ['call', target, sig, '--rpc-url', ctx.opt.rpcUrl, ...atBlock(block)]);
  if (!r.ok || r.stdout === '') return null;
  const value = /^(0x[0-9a-fA-F]+|[0-9]+)/.exec(r.stdout)?.[1];
  if (value === undefined) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

export function callAddresses(ctx: Ctx, target: string, sig: string, block?: number): string[] | null {
  const r = capture('cast', ['call', target, sig, '--rpc-url', ctx.opt.rpcUrl, ...atBlock(block)]);
  if (!r.ok) return null;
  return r.stdout.match(/0x[0-9a-fA-F]{40}/g) ?? [];
}

export function isAddress(value: unknown): value is string {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value);
}

export function sameAddressList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, i) => value.toLowerCase() === b[i]?.toLowerCase());
}

export type Log = {
  readonly address: string;
  readonly topics: readonly string[];
  readonly blockNumber: string;
  readonly transactionHash: string;
};

/** Blocks per `eth_getLogs` call. Public RPCs cap the range, and compute-to-verify can span days. */
export const LOG_WINDOW = 2000;

/** One progress clock for every event scan of this run. See scanLogs. */
let scanBeat: ReturnType<typeof heartbeat> | null = null;

/** Every `signature` event `address` emitted from `fromBlock` to the head, fetched in RPC-sized windows. */
export function scanLogs(ctx: Ctx, address: string, signature: string, fromBlock: number): Log[] {
  const head = headBlock(ctx);
  const logs: Log[] = [];
  // Days between compute and verify are thousands of blocks, in RPC-sized windows, for a dozen scans:
  // the heartbeat is shared by all of them, or a dozen 50-second scans would never print a line.
  scanBeat ??= heartbeat();
  const beat = scanBeat;
  for (let from = fromBlock; from <= head; from += LOG_WINDOW) {
    const to = Math.min(from + LOG_WINDOW - 1, head);
    if (beat.due()) {
      say(
        `    … scanning ${signature.split('(')[0] ?? signature} events: block ${String(from)} of ${String(head)} (${beat.elapsed()})`,
      );
    }
    const r = capture('cast', [
      'logs',
      '--json',
      '--from-block',
      String(from),
      '--to-block',
      String(to),
      '--address',
      address,
      signature,
      '--rpc-url',
      ctx.opt.rpcUrl,
    ]);
    if (!r.ok) {
      fail(`Error: event scan failed for ${signature} on ${address} (blocks ${String(from)}-${String(to)}).`, r.stderr);
    }
    logs.push(...(JSON.parse(r.stdout === '' ? '[]' : r.stdout) as Log[]));
  }
  return logs;
}

/** The address an indexed `address` topic carries. */
export function topicAddress(topic: string | undefined): string {
  return `0x${(topic ?? '').slice(-40)}`.toLowerCase();
}

/**
 * A fresh `forge --out` for the read-only checks.
 *
 * Checking against the build that sealed the manifest compares the seal with itself. A recompile into an
 * empty directory makes the current checkout re-derive every init-code hash — the independent recompile
 * an auditor would do — for the price of a few seconds of solc.
 */
export function checkBuildOut(ctx: Ctx): string {
  if (ctx.opt.noBuild) {
    say('  (--no-build: checking against the sealed build, not a fresh recompile)');
    return ctx.buildOut;
  }
  const dir = join(ctx.outDir, 'build-check');
  removeIfPresent(dir);
  return dir;
}

/** One read-only forge script (`script`: its path from the package root): simulated against the head, nothing signed, nothing sent. */
export async function runReadOnly(
  ctx: Ctx,
  script: string,
  contract: string,
  out: string,
  env: NodeJS.ProcessEnv,
): Promise<boolean> {
  const args = [
    'script',
    `${script}:${contract}`,
    '--out',
    out,
    '--rpc-url',
    ctx.opt.rpcUrl,
    ...ctx.forgeArgs,
    ...traceArgs(ctx),
  ];
  return (await runLogged('forge', args, env)) === 0;
}

////////////////////////////////////////////////////////////////////////////////
// Progress — the ledger of every step, and the offline view of it
////////////////////////////////////////////////////////////////////////////////

export type ProgressEntry = {
  readonly ts: string;
  readonly stage: string;
  readonly step: string;
  readonly status: 'start' | 'ok' | 'fail';
  readonly block?: number | null;
  readonly ms?: number;
};

export function progressPath(ctx: Ctx): string {
  return join(ctx.outDir, 'progress.jsonl');
}

/** The step in flight, so a `fail()` — which exits — still leaves a `fail` line behind it. */
let openStep: { readonly ctx: Ctx; readonly stage: string; readonly step: string; readonly startedAt: number } | null =
  null;

process.on('exit', (code) => {
  if (openStep === null || code === 0) return;
  const { ctx, stage, step: name, startedAt } = openStep;
  appendJsonl(progressPath(ctx), [
    { ts: new Date().toISOString(), stage, step: name, status: 'fail', ms: Date.now() - startedAt },
  ]);
});

/**
 * One step of a stage: announced, timed, recorded.
 *
 * The ledger is an audit trail like the journal, and like the journal nothing reads it to decide anything.
 * What it adds is the intermediate checks, which send no transaction and so leave no other trace.
 */
export async function step<T>(ctx: Ctx, stage: string, name: string, body: () => T | Promise<T>): Promise<T> {
  const startedAt = Date.now();
  ensureDir(ctx.outDir);
  appendJsonl(progressPath(ctx), [{ ts: new Date().toISOString(), stage, step: name, status: 'start' }]);
  openStep = { ctx, stage, step: name, startedAt };
  say(`  ▸ ${name}`);
  const result = await body();
  const ms = Date.now() - startedAt;
  const block = ctx.flow.needsChain(stage) ? headBlock(ctx) : null;
  appendJsonl(progressPath(ctx), [{ ts: new Date().toISOString(), stage, step: name, status: 'ok', ms, block }]);
  openStep = null;
  say(`  ✔ ${name}  (${(ms / 1000).toFixed(1)}s${block === null ? '' : `, block ${String(block)}`})`);
  return result;
}

export function stageProgress(ctx: Ctx): void {
  const rows = readJsonl<ProgressEntry>(progressPath(ctx));
  if (rows.length === 0) {
    say(`No progress ledger at ${progressPath(ctx)} - nothing has run for this ${ctx.flow.name} yet.`);
    return;
  }
  banner(`📈 Progress: ${progressPath(ctx)}`);
  say(`  ${pad('WHEN', 20)} ${pad('STAGE', 10)} ${pad('STATUS', 7)} ${pad('TOOK', 8)} ${pad('BLOCK', 9)} STEP`);
  const when = (row: ProgressEntry): string => pad(row.ts.slice(0, 19).replace('T', ' '), 20);
  const open = new Map<string, ProgressEntry>();
  for (const row of rows) {
    const key = `${row.stage}/${row.step}`;
    if (row.status === 'start') {
      open.set(key, row);
      continue;
    }
    open.delete(key);
    const took = row.ms === undefined ? '-' : `${(row.ms / 1000).toFixed(1)}s`;
    const block = row.block === null || row.block === undefined ? '-' : String(row.block);
    say(`  ${when(row)} ${pad(row.stage, 10)} ${pad(row.status, 7)} ${pad(took, 8)} ${pad(block, 9)} ${row.step}`);
  }
  for (const row of open.values()) {
    say(
      `  ${when(row)} ${pad(row.stage, 10)} ${pad('OPEN', 7)} ${pad('-', 8)} ${pad('-', 9)} ${row.step}  <- started, never finished`,
    );
  }
  say('', `  transcripts: ${join(ctx.outDir, 'logs')}`);
}
