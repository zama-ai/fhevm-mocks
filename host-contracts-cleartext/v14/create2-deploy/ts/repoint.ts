// The re-point engine's shared pieces: what every flow that re-points a live stack's proxies needs, whatever
// generation it runs on and whatever it re-points — a generation upgrade (upgrade/) or a hotfix. Outside upgrade/
// on purpose: that folder is deleted at every rotation (ROTATION.md), and this is not.
//
//   reads     one `cast call` per getter, at the head or at a block
//   logs      event scans in RPC-sized windows
//   forge     a read-only script run, and the fresh recompile it checks against
//   progress  the step ledger (progress.jsonl) and its offline view

import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import {
  awaitPrerequisites,
  broadcast,
  buildContext,
  checkRecordedImplementations,
  type Ctx,
  type EventRecord,
  EXISTING_ROLES,
  FHEVM_VERSION,
  finalizedBlock,
  type Flow,
  generatedConfigEnv,
  hasCodeAt,
  headBlock,
  implementationAt,
  INVOCATION_DIR,
  isCompleteSeal,
  journalHasSentTx,
  loadConfigFile,
  type Manifest,
  manifestPath,
  PACKAGE_ROOT,
  parseCliArgs,
  preflight,
  previousLink,
  PROXY_ROLES,
  readJournal,
  recordFinality,
  recordObservation,
  removeScratchIfSealed,
  requireBuiltArtifacts,
  resolveOptions,
  ROLE_WIDTH,
  RULE_WIDTH,
  scratchPath,
  SCRIPT_DIR,
  scriptEnv,
  settledBlock,
  settlementRule,
  showJournal,
  stageReport,
  stampSeal,
  traceArgs,
  waitForBlock,
  writeEventConfig,
  writeEventRecord,
} from './common.ts';
import {
  appendJsonl,
  banner,
  capture,
  captureOrFail,
  ensureDir,
  fail,
  freePort,
  heartbeat,
  hexToNumber,
  pad,
  readJson,
  readJsonl,
  removeIfPresent,
  requireTool,
  runLogged,
  say,
  sleep,
  spawnBackground,
  startTranscript,
  waitUntil,
  warn,
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

////////////////////////////////////////////////////////////////////////////////
// The getter survey and the sealed handles: what verify compares before and after
////////////////////////////////////////////////////////////////////////////////

export type AbiParameter = { readonly type?: string; readonly components?: readonly AbiParameter[] };
export type AbiEntry = {
  readonly type?: string;
  readonly name?: string;
  readonly stateMutability?: string;
  readonly inputs?: readonly AbiParameter[];
  readonly outputs?: readonly AbiParameter[];
};

export const SURVEY_TARGETS: ReadonlyArray<{ readonly label: string; readonly role: string; readonly abi: string }> = [
  { label: 'ACL', role: 'ACL_ADDRESS', abi: 'CleartextACL.json' },
  { label: 'FHEVMExecutor', role: 'FHEVM_EXECUTOR_ADDRESS', abi: 'CleartextFHEVMExecutor.json' },
  { label: 'KMSVerifier', role: 'KMS_VERIFIER_ADDRESS', abi: 'CleartextKMSVerifier.json' },
  { label: 'InputVerifier', role: 'INPUT_VERIFIER_ADDRESS', abi: 'CleartextInputVerifier.json' },
  { label: 'HCULimit', role: 'HCU_LIMIT_ADDRESS', abi: 'CleartextHCULimit.json' },
  { label: 'ProtocolConfig', role: 'PROTOCOL_CONFIG_ADDRESS', abi: 'ProtocolConfig.json' },
  { label: 'KMSGeneration', role: 'KMS_GENERATION_ADDRESS', abi: 'KMSGeneration.json' },
  { label: 'CleartextArithmetic', role: 'CLEARTEXT_ARITHMETIC_ADDRESS', abi: 'CleartextArithmetic.json' },
  { label: 'CleartextDB', role: 'CLEARTEXT_DB_ADDRESS', abi: 'CleartextDB.json' },
  { label: 'PauserSet', role: 'PAUSER_SET_ADDRESS', abi: 'PauserSet.json' },
  { label: 'ACLOwner', role: 'ACL_OWNER', abi: 'ACLOwner.json' },
];

export function abiType(parameter: AbiParameter): string {
  const type = parameter.type ?? '';
  if (!type.startsWith('tuple')) return type;
  const suffix = type.slice('tuple'.length);
  return `(${(parameter.components ?? []).map(abiType).join(',')})${suffix}`;
}

/**
 * Every zero-argument getter of every host contract, read at `block`: the ABIs come from `dir` (the generation
 * the stack runs at the time of the reading), so a getter that exists on both sides is compared, not guessed.
 */
export function surveyStack(
  ctx: Ctx,
  dir: string,
  generationLabel: string,
  block?: number,
): Readonly<Record<string, string>> {
  const readings: Record<string, string> = {};
  // One RPC call per getter, 60+ of them: on a slow public RPC that is a minute or more.
  const beat = heartbeat();
  for (const target of SURVEY_TARGETS) {
    const path = join(dir, target.abi);
    if (!existsSync(path))
      fail(`Error: required ${generationLabel} ABI is missing: ${path}`, '       Pass --previous-abi-dir PATH.');
    const abi = JSON.parse(readFileSync(path, 'utf8')) as AbiEntry[];
    const getters = abi.filter(
      (entry) =>
        entry.type === 'function' &&
        (entry.stateMutability === 'view' || entry.stateMutability === 'pure') &&
        (entry.inputs ?? []).length === 0 &&
        entry.name !== undefined,
    );
    for (const getter of getters) {
      const name = getter.name ?? '';
      const returns = (getter.outputs ?? []).map(abiType).join(',');
      const signature = returns === '' ? `${name}()` : `${name}()(${returns})`;
      const result = capture('cast', [
        'call',
        ctx.opt.existing[target.role] ?? '',
        signature,
        '--rpc-url',
        ctx.opt.rpcUrl,
        ...atBlock(block),
      ]);
      readings[`${target.label}.${name}`] = result.ok ? result.stdout : '<reverted>';
      if (beat.due()) {
        say(
          `    … ${String(Object.keys(readings).length)} getters read so far, now ${target.label} (${beat.elapsed()})`,
        );
      }
    }
  }
  if (Object.keys(readings).length < 50) {
    fail(
      `Error: the ${generationLabel} ABI survey produced only ${String(Object.keys(readings).length)} readings; refusing a vacuous snapshot.`,
    );
  }
  return readings;
}

/** Every sealed `--handle` still resolves to the value it had before, in the live CleartextDB. */
export function verifySealedHandles(ctx: Ctx, handles: Readonly<Record<string, string>>): void {
  const db = ctx.opt.existing.CLEARTEXT_DB_ADDRESS ?? '';
  for (const [handle, was] of Object.entries(handles)) {
    const result = capture('cast', ['call', db, 'get(bytes32)(uint256)', handle, '--rpc-url', ctx.opt.rpcUrl]);
    if (!result.ok || result.stdout !== was)
      fail(
        `Error: cleartext handle changed: ${handle}`,
        `         before: ${was}`,
        `         after:  ${result.stdout}`,
      );
  }
  if (Object.keys(handles).length > 0) {
    say(`    ok   ${String(Object.keys(handles).length)} pre-upgrade cleartext handle(s) survived`);
  } else {
    warn('no pre-upgrade handle was sealed; existing CleartextDB data survival was not proven.');
  }
}

////////////////////////////////////////////////////////////////////////////////
// The engine: every stage of a re-point, whatever it re-points
////////////////////////////////////////////////////////////////////////////////

/** A forge script of the adapter's script folder, as `File.s.sol:Contract`. */
export type ScriptTarget = `${string}.s.sol:${string}`;

/**
 * What one re-point flow plugs into the engine. The engine owns the stages — compute and seal, creates,
 * rehearse on a fork, one atomic `ACLOwner.upgrade`, verify — and their records; the adapter says which
 * proxies are re-pointed, what the live stack must look like first, and what else verify must prove.
 */
export type RepointAdapter = {
  readonly flow: Flow;
  /** The folder of its forge scripts, under `create2-deploy/script/` (e.g. `upgrade`). */
  readonly scriptDir: string;
  readonly scripts: {
    readonly compute: ScriptTarget;
    readonly creates: ScriptTarget;
    readonly precheck: ScriptTarget;
    readonly materialize: ScriptTarget;
    readonly verify: ScriptTarget;
  };
  /** compute's banner, e.g. `🍟 Compute: 2 passes, 1 rebuild`. */
  readonly computeTitle: string;
  /** The proxies `ACLOwner.upgrade` re-points, in op order: the coordinator's copy of the Solidity table. */
  readonly repointed: (ctx: Ctx) => readonly string[];
  /** compute's first check of the live stack, before anything is snapshotted or built. */
  readonly validateLive: { readonly label: string; readonly run: (ctx: Ctx) => void };
  /** The adapter's own part of the pre-snapshot, every reading at `block`, merged into it. */
  readonly snapshotExtras: (ctx: Ctx, block: number) => Readonly<Record<string, unknown>>;
  /** Extra environment for every script that reads the seal. */
  readonly sealedEnv: (ctx: Ctx) => NodeJS.ProcessEnv;
  /** verify's middle layer, between the Solidity terminal conditions and the event scans. */
  readonly verifyExtras: { readonly label: string; readonly run: (ctx: Ctx) => void };
  /** The comment line of the generated live `addresses.sol`. */
  readonly addressesHeader: string;
  /** What the record's `event.json` says it is. */
  readonly eventKind: EventRecord['kind'];
  /**
   * Run right after the second compute pass, before the seal is completed: a flow's last word on what it is
   * about to seal (the hotfix refuses an op that would need a reinitializer). Optional.
   */
  readonly afterCompute?: (ctx: Ctx) => void;
  /** Stages only this flow has (e.g. `params`), by name. */
  readonly extraStages: Readonly<Record<string, (ctx: Ctx) => void>>;
};

/** The engine's part of the pre-snapshot; an adapter's extras are merged beside these keys. */
export type RepointSnapshot = {
  readonly blockNumber: number;
  readonly admin: string;
  readonly handles: Readonly<Record<string, string>>;
  /** Every live proxy's implementation at the snapshot block: re-pointed or not, verify needs its "before". */
  readonly implementation: Readonly<Record<string, string>>;
};

/** The flow this process runs: one per process, set once by runRepointCli. */
let activeAdapter: RepointAdapter | null = null;

function adapter(): RepointAdapter {
  if (activeAdapter === null) fail('Error: internal: the re-point engine ran without its adapter.');
  return activeAdapter;
}

/** The proxies re-pointed, in op order. */
function repointed(ctx: Ctx): readonly string[] {
  return adapter().repointed(ctx);
}

/** The proxies the op list must leave alone. */
function untouched(ctx: Ctx): readonly string[] {
  const ops = new Set(repointed(ctx));
  return PROXY_ROLES.filter((role) => !ops.has(role));
}

/** The sealed creates: one implementation per op. */
function createRoles(ctx: Ctx): readonly string[] {
  return repointed(ctx).map((role) => `IMPL_${role}`);
}

/** `<script dir>/File.s.sol:Contract`, from the package root, the file checked to exist. */
function scriptTarget(stage: keyof RepointAdapter['scripts']): string {
  const [file, contract] = adapter().scripts[stage].split(':');
  return `${requireScript(file ?? '')}:${contract ?? ''}`;
}

/** The same as `broadcast` takes it: relative to `create2-deploy/script/`. */
function broadcastTarget(stage: keyof RepointAdapter['scripts']): string {
  scriptTarget(stage);
  return `${adapter().scriptDir}/${adapter().scripts[stage]}`;
}

/** The script path and contract, as runReadOnly takes them. */
function scriptAndContract(stage: keyof RepointAdapter['scripts']): [string, string] {
  const [file, contract] = adapter().scripts[stage].split(':');
  return [requireScript(file ?? ''), contract ?? ''];
}

/**
 * The pre-snapshot, every reading taken at ONE settled block.
 *
 * One block, so the readings are consistent with each other; a settled one, so none of them can be
 * reorged away. A snapshot read at the head is the seal's only witness to "before", and a witness whose
 * block is later orphaned has seen a chain that no longer exists.
 */
function capturePreUpgrade(ctx: Ctx): RepointSnapshot & Readonly<Record<string, unknown>> {
  const blockNumber = settledBlock(ctx);
  if (!Number.isSafeInteger(blockNumber) || blockNumber < 0) fail('Error: could not capture the pre-upgrade block.');
  say(`  🔭 snapshotting the live stack at settled block ${String(blockNumber)}`);

  const admin = callAddress(ctx, ctx.opt.existing.ACL_OWNER ?? '', 'owner()(address)', blockNumber);
  if (admin === null) fail('Error: could not capture the pre-upgrade admin (ACLOwner.owner).');
  const extras = adapter().snapshotExtras(ctx, blockNumber);

  // Every live proxy, including those the op list must not touch: verify needs their "before" to say
  // "unchanged", and a proxy nobody meant to re-point is exactly the one nobody thought to snapshot.
  const implementation: Record<string, string> = {};
  for (const role of PROXY_ROLES) {
    const value = implementationAt(ctx, ctx.opt.existing[role] ?? '', blockNumber);
    if (value === null) fail(`Error: could not snapshot the implementation slot of ${role}.`);
    implementation[role] = value;
  }

  return { ...extras, blockNumber, admin, handles: recordHandleValues(ctx, blockNumber), implementation };
}

function requireScript(name: string): string {
  const path = join(SCRIPT_DIR, adapter().scriptDir, name);
  if (!existsSync(join(PACKAGE_ROOT, path))) {
    fail(
      `Error: ${path} does not exist yet.`,
      `       Restore the ${adapter().flow.name} script before running this stage.`,
    );
  }
  return path;
}

/** A stage's banner, numbered by its place in the full run (`4/5: 🧩 Materialize: …`), standalone or not. */
function stageBanner(stage: string, title: string): void {
  const order = adapter().flow.runOrder;
  const at = order.indexOf(stage);
  banner(at < 0 ? title : `${String(at + 1)}/${String(order.length)}: ${title}`);
}

/**
 * Has this upgrade already put anything on chain? Asked of the CHAIN, through the sealed manifest's own
 * addresses, so a run killed between sending and journaling still answers yes. The journal is consulted
 * too, but only as a second witness — the chain is the one that cannot be lost with a directory.
 */
function repointStarted(ctx: Ctx): boolean {
  if (journalHasSentTx(ctx)) return true;
  const manifest = readJson<Manifest>(manifestPath(ctx));
  if (manifest?.address === undefined) return false;
  const head = headBlock(ctx);
  return createRoles(ctx).some((role) => hasCodeAt(ctx, manifest.address?.[role] ?? '', head));
}

/** The live stack, passed to the forge scripts as FHEVM_EXISTING_<ROLE>. */
function existingEnv(ctx: Ctx): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const role of EXISTING_ROLES) {
    env[`FHEVM_EXISTING_${role}`] = ctx.opt.existing[role] ?? '';
  }
  return env;
}

function checkExistingManifestIdentity(ctx: Ctx): void {
  const manifest = readJson<Manifest>(manifestPath(ctx));
  if (manifest?.address === undefined) return;
  for (const role of EXISTING_ROLES) {
    const sealed = manifest.address[role];
    const supplied = ctx.opt.existing[role];
    if (sealed === undefined || supplied?.toLowerCase() !== sealed.toLowerCase()) {
      fail(
        `Error: ${role} differs from the live stack sealed at compute.`,
        `         sealed:   ${sealed ?? '(missing)'}`,
        `         supplied: ${supplied ?? '(missing)'}`,
        '       Use the original upgrade config; a different live stack needs its own out-dir.',
      );
    }
  }
}

/**
 * The value of each `--handle`, read before the upgrade and required unchanged after it.
 *
 * Reported rather than silently skipped when empty, because the two situations give different guarantees
 * and conflating them in the output would overstate what `verify` proved.
 */
function recordHandleValues(ctx: Ctx, block?: number): Readonly<Record<string, string>> {
  const values: Record<string, string> = {};
  if (ctx.opt.handles.length === 0) {
    warn(
      '  no --handle given: verify will be able to prove the stack still WORKS after the upgrade, but',
      '  not that existing cleartext data survived it. Those are different claims.',
    );
    return values;
  }
  const db = ctx.opt.existing.CLEARTEXT_DB_ADDRESS ?? '';
  for (const handle of ctx.opt.handles) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(handle)) fail(`Error: --handle is not bytes32: ${handle}`);
    const r = capture('cast', [
      'call',
      db,
      'get(bytes32)(uint256)',
      handle,
      '--rpc-url',
      ctx.opt.rpcUrl,
      ...atBlock(block),
    ]);
    if (!r.ok) {
      fail(
        `Error: --handle ${handle} does not resolve in the live CleartextDB at ${db}.`,
        '       A handle that cannot be read now cannot be shown to survive.',
      );
    }
    values[handle.toLowerCase()] = r.stdout;
    say(`    ${pad(handle, ROLE_WIDTH)} = ${r.stdout}`);
  }
  return values;
}

function preUpgradePath(ctx: Ctx): string {
  return join(ctx.outDir, 'pre-upgrade.json');
}

function writePreUpgrade(ctx: Ctx, snapshot: RepointSnapshot): void {
  writeFileSync(preUpgradePath(ctx), `${JSON.stringify(snapshot, null, 2)}\n`);
}

function writeInitialAddresses(ctx: Ctx): void {
  const address = (role: string): string => ctx.opt.existing[role] ?? '';
  const constants: ReadonlyArray<readonly [string, string]> = [
    ['ACL_ADDRESS', address('ACL_ADDRESS')],
    ['FHEVM_EXECUTOR_ADDRESS', address('FHEVM_EXECUTOR_ADDRESS')],
    ['KMS_VERIFIER_ADDRESS', address('KMS_VERIFIER_ADDRESS')],
    ['INPUT_VERIFIER_ADDRESS', address('INPUT_VERIFIER_ADDRESS')],
    ['HCU_LIMIT_ADDRESS', address('HCU_LIMIT_ADDRESS')],
    ['PROTOCOL_CONFIG_ADDRESS', address('PROTOCOL_CONFIG_ADDRESS')],
    ['KMS_GENERATION_ADDRESS', address('KMS_GENERATION_ADDRESS')],
    ['CLEARTEXT_ARITHMETIC_ADDRESS', address('CLEARTEXT_ARITHMETIC_ADDRESS')],
    ['CLEARTEXT_DB_ADDRESS', address('CLEARTEXT_DB_ADDRESS')],
    ['PAUSER_SET_ADDRESS', address('PAUSER_SET_ADDRESS')],
  ];
  const source = [
    '// SPDX-License-Identifier: BSD-3-Clause-Clear',
    'pragma solidity ^0.8.24;',
    adapter().addressesHeader,
    ...constants.map(
      ([name, value]) => `address constant ${name} = address(uint160(0x00${value.toLowerCase().slice(2)}));`,
    ),
    '',
  ].join('\n');
  writeFileSync(join(ctx.outDir, 'addresses.sol'), source);
}

function mergePreUpgradeIntoManifest(ctx: Ctx): void {
  const manifest = readJson<Record<string, unknown>>(manifestPath(ctx));
  const snapshot = readJson<RepointSnapshot>(preUpgradePath(ctx));
  if (manifest === null) fail(`Error: compute did not seal ${manifestPath(ctx)}.`);
  if (snapshot === null) fail(`Error: pre-upgrade snapshot missing at ${preUpgradePath(ctx)}.`);
  writeFileSync(manifestPath(ctx), `${JSON.stringify({ ...manifest, preUpgrade: snapshot }, null, 2)}\n`);
}

async function stageCompute(ctx: Ctx): Promise<void> {
  stageBanner('compute', adapter().computeTitle);

  // Same reasoning as the deploy: recomputing after transactions have been sent would move the sealed
  // address set out from under a half-applied upgrade. An upgrade is worse than a deploy here, because
  // `materialize` is NOT idempotent — the reinitializers are reinitializer(n)-guarded, so a second run
  // reverts rather than no-oping. Also the snapshot block would move past the creates, and verify's event
  // window with it.
  if (repointStarted(ctx)) {
    fail(
      `Error: '${ctx.opt.deploymentId}' has already put contracts on chain (see ${ctx.journalPath} and --stage status),`,
      '       so its addresses are not safe to recompute. Resume with the next stage instead.',
      `       To discard this ${adapter().flow.name}'s record and start over: rm -rf ${ctx.outDir}`,
    );
  }

  ensureDir(ctx.outDir);
  removeIfPresent(
    ctx.buildOut,
    join(ctx.outDir, 'addresses.sol'),
    scratchPath(ctx),
    manifestPath(ctx),
    preUpgradePath(ctx),
  );

  // Before anything is computed, and before any build. This is the cheap check that prevents the
  // expensive mistake, and the only point at which the old values are still available.
  await step(ctx, 'compute', adapter().validateLive.label, () => {
    adapter().validateLive.run(ctx);
  });
  if (ctx.opt.previousManifest !== null) {
    await step(ctx, 'compute', 'every proxy runs the implementation the previous record sealed', () => {
      checkRecordedImplementations(ctx);
    });
  }
  await step(ctx, 'compute', 'snapshot the live stack at the settled block', () => {
    writePreUpgrade(ctx, capturePreUpgrade(ctx));
  });
  writeInitialAddresses(ctx);

  const target = scriptTarget('compute');
  const build = async (env: NodeJS.ProcessEnv): Promise<void> => {
    if (ctx.opt.noBuild) {
      requireBuiltArtifacts(ctx);
      say('  (--no-build: using the artifacts already in the out dir)');
      return;
    }
    if ((await runLogged('forge', ['build', '--out', ctx.buildOut, '--skip', 'test', ...ctx.forgeArgs], env)) !== 0) {
      fail('Error: forge build failed.');
    }
  };
  const pass = async (n: number, env: NodeJS.ProcessEnv): Promise<void> => {
    // --rpc-url even though a pass sends nothing: without it forge runs against its own in-memory EVM
    // where block.chainid is 31337, and the manifest would be sealed for the wrong chain.
    const args = [
      'script',
      target,
      '--out',
      ctx.buildOut,
      ...ctx.forgeArgs,
      '--rpc-url',
      ctx.opt.rpcUrl,
      ...traceArgs(ctx),
    ];
    if ((await runLogged('forge', args, { ...env, FHEVM_PASS: String(n) })) !== 0) {
      fail(`Error: compute pass ${String(n)} failed.`);
    }
  };

  // Two passes, not the deploy's three: the ACL already exists, so nothing computed here feeds
  // anything the live stack has already fixed.
  const env = { ...scriptEnv(ctx, existingEnv(ctx)), ...generatedConfigEnv(ctx) };
  await step(ctx, 'compute', 'build, then pass 1: the live addresses file', async () => {
    await build(env);
    await pass(1, env);
  });
  await step(
    ctx,
    'compute',
    `rebuild, then pass 2: the ${String(repointed(ctx).length)} implementations, assert, seal`,
    async () => {
      await build(env);
      await pass(2, env);
    },
  );
  const after = adapter().afterCompute;
  if (after !== undefined) {
    await step(ctx, 'compute', `check what this ${adapter().flow.name} seals`, () => {
      after(ctx);
    });
  }
  mergePreUpgradeIntoManifest(ctx);
  const previous = ctx.opt.previousManifest;
  stampSeal(
    ctx,
    previous === null
      ? null
      : previousLink(
          previous.path,
          ctx.outDir,
          ctx.opt.configPath === null ? INVOCATION_DIR : dirname(ctx.opt.configPath),
        ),
  );
  writeEventConfig(ctx);
  // The seal is complete only once the pre-upgrade snapshot is merged into it.
  removeScratchIfSealed(ctx, ['preUpgrade']);
}

function sealedManifest(ctx: Ctx): {
  readonly address: Readonly<Record<string, string>>;
  readonly preUpgrade: RepointSnapshot;
} {
  const manifest = readJson<Manifest & { readonly preUpgrade?: RepointSnapshot }>(manifestPath(ctx));
  if (manifest?.address === undefined || manifest.preUpgrade === undefined) {
    fail('Error: manifest has no sealed addresses and pre-upgrade snapshot; run compute first.');
  }
  return { address: manifest.address, preUpgrade: manifest.preUpgrade };
}

/** Every op target already at its sealed implementation, read at the head. */
function isMaterialized(ctx: Ctx): boolean {
  const { address } = sealedManifest(ctx);
  return repointed(ctx).every(
    (role) => implementationAt(ctx, address[role] ?? '', null) === (address[`IMPL_${role}`] ?? '').toLowerCase(),
  );
}

/**
 * Block until every sealed create holds code at the settled block.
 *
 * The chain-side reorg gate for everything that reads the creates and then decides — precheck, rehearse,
 * materialize. It replaces "wait N blocks after the stage that sent them", which only an uninterrupted
 * `all` can know; this is answered from the chain by any invocation, days later, with no journal.
 */
async function waitForCreatesSettled(ctx: Ctx): Promise<void> {
  const { address } = sealedManifest(ctx);
  await awaitPrerequisites(
    ctx,
    `the ${String(createRoles(ctx).length)} creates`,
    createRoles(ctx).map((role) => ({
      what: `code at ${role}`,
      holds: (block: number | null) => hasCodeAt(ctx, address[role] ?? '', block),
    })),
  );
}

/**
 * Block until the materialize transaction is settled, and return its block.
 *
 * Found through `HostUpgraded` on the ACLOwner rather than through a receipt, so a multisig's transaction
 * and a run whose journal was lost are handled the same way as the happy path.
 */
async function waitForMaterializeSettled(ctx: Ctx): Promise<number> {
  const { address, preUpgrade } = sealedManifest(ctx);
  const logs = scanLogs(ctx, address.ACL_OWNER ?? '', 'HostUpgraded(address,address)', preUpgrade.blockNumber + 1);
  const block = Math.max(0, ...logs.map((log) => hexToNumber(log.blockNumber) ?? 0));
  if (logs.length === 0 || block === 0) {
    fail(
      'Error: no HostUpgraded event since the seal: the upgrade has not been materialized, or its',
      '       transaction was reorged out. --stage status says which; --stage materialize is safe to re-run.',
    );
  }
  const beat = heartbeat();
  let announced = false;
  for (;;) {
    const settled = settledBlock(ctx);
    if (settled >= block) {
      say(
        `  the materialize block ${String(block)} is settled (${settlementRule(ctx)}, settled block ${String(settled)})`,
      );
      recordFinality(ctx);
      return block;
    }
    if (!announced || beat.due()) {
      say(
        `  waiting for block ${String(block)} to settle (${settlementRule(ctx)}, settled block ${String(settled)}${announced ? `, ${beat.elapsed()}` : ''})`,
      );
      announced = true;
    }
    await sleep(12_000);
  }
}

async function stageCreates(ctx: Ctx): Promise<void> {
  stageBanner('creates', '🥩 Creates: one CREATE2 per create, each gated on getCode');
  ctx.stageLabel = 'creates';
  await broadcast(ctx, broadcastTarget('creates'), undefined, undefined, existingEnv(ctx));
}

/**
 * The gate before the point of no return. Read-only; reports everything rather than stopping at the first
 * failure, so the operator sees the whole picture before the one transaction that cannot be retried.
 */
async function stagePrecheck(ctx: Ctx): Promise<void> {
  // A stage of its own only when asked for; inside rehearse and materialize it is one of their steps.
  if (ctx.opt.stage === 'precheck') banner('🚧 Precheck: everything that must hold before the atomic upgrade');
  else say('  🚧 precheck: everything that must hold before the atomic upgrade');
  const env = { ...scriptEnv(ctx, existingEnv(ctx)), ...generatedConfigEnv(ctx), ...adapter().sealedEnv(ctx) };
  await step(ctx, 'precheck', 'pre-materialize check, from a fresh recompile', async () => {
    const ok = await runReadOnly(ctx, ...scriptAndContract('precheck'), checkBuildOut(ctx), env);
    if (!ok) {
      fail('Error: the pre-materialize check failed. Nothing was sent; read the FAIL lines above before retrying.');
    }
  });
}

/**
 * The exact `ACLOwner.upgrade` payload, written by the materialize script itself in prepare-only mode, so
 * what a multisig signs and what a rehearsal applies is byte-identical to what a key here would send.
 */
async function prepareCalldata(ctx: Ctx): Promise<{ readonly calldata: string; readonly path: string }> {
  const env = {
    ...scriptEnv(ctx, existingEnv(ctx)),
    ...generatedConfigEnv(ctx),
    ...adapter().sealedEnv(ctx),
    FHEVM_MIN_BLOCK: String(ctx.opt.minBlockOverride ?? 0),
    FHEVM_PREPARE_ONLY: 'true',
  };
  const code = await runLogged(
    'forge',
    [
      'script',
      scriptTarget('materialize'),
      '--rpc-url',
      ctx.opt.rpcUrl,
      '--out',
      ctx.buildOut,
      ...ctx.forgeArgs,
      '--sender',
      ctx.opt.admin,
      ...traceArgs(ctx),
    ],
    env,
  );
  if (code !== 0) fail('Error: could not prepare the ACLOwner.upgrade payload.');
  const path = join(ctx.outDir, 'materialize-calldata.txt');
  return { calldata: readFileSync(path, 'utf8').trim(), path };
}

/**
 * The upgrade, for real, on a chain that does not matter.
 *
 * Everything before this point asks the chain and the build questions. This asks the only one that
 * matters and that no static check can answer — does the exact payload, applied to the exact live state,
 * leave a stack that passes the exact verify — and asks it where a wrong answer costs nothing: an anvil
 * forked from the live node at its head, with the admin impersonated. The verify that runs against the
 * fork is the same code, byte for byte, that will run against the live chain afterwards.
 *
 * What the fork keeps separate: its own out dir under `rehearsal/`, so the rehearsal's journal line and
 * `verify-report.json` can never be mistaken for the real ones. The manifest and generated config are
 * copied in, not moved — the seal stays where it is.
 */
async function stageRehearse(ctx: Ctx): Promise<void> {
  stageBanner('rehearse', '🎭 Rehearse: the upgrade on a fork of this chain');
  requireTool('anvil');
  if (!ctx.opt.dryRun) await waitForCreatesSettled(ctx);
  await stagePrecheck(ctx);
  if (isMaterialized(ctx)) {
    say('  materialize already complete — nothing left to rehearse; run verify.');
    return;
  }
  const { calldata } = await step(ctx, 'rehearse', 'prepare the exact ACLOwner.upgrade payload', () =>
    prepareCalldata(ctx),
  );

  const forkDir = join(ctx.outDir, 'rehearsal');
  removeIfPresent(forkDir);
  ensureDir(forkDir);
  copyFileSync(manifestPath(ctx), join(forkDir, 'manifest.json'));
  copyFileSync(join(ctx.outDir, 'addresses.sol'), join(forkDir, 'addresses.sol'));

  const port = await freePort();
  const forkUrl = `http://127.0.0.1:${String(port)}`;
  const forkedAt = headBlock(ctx);
  say(`  ▸ fork ${ctx.opt.rpcUrl} at block ${String(forkedAt)}`);
  const anvil = spawnBackground('anvil', [
    '--fork-url',
    ctx.opt.rpcUrl,
    '--fork-block-number',
    String(forkedAt),
    '--port',
    String(port),
    '--host',
    '127.0.0.1',
    '--auto-impersonate',
    '--silent',
  ]);
  try {
    await waitUntil(() => capture('cast', ['chain-id', '--rpc-url', forkUrl]).ok, 60_000, `anvil fork on ${forkUrl}`);
    // A fork mines only when sent to, so a depth wait there would never end: on the fork, settled is head.
    const fork: Ctx = {
      ...ctx,
      opt: { ...ctx.opt, rpcUrl: forkUrl, minBlockOverride: null, confirmations: 0 },
      outDir: forkDir,
      buildOut: join(forkDir, 'build'),
      broadcastDir: join(forkDir, 'broadcast'),
      journalPath: join(forkDir, 'journal.jsonl'),
      useFinality: false,
    };
    say(`  ✔ forked ${ctx.opt.rpcUrl} at block ${String(forkedAt)} onto ${forkUrl}`);

    // A multisig admin may hold no ETH; on the fork it is given some, and its signature is not needed.
    await step(ctx, 'rehearse', 'apply the payload on the fork as the impersonated admin', () => {
      const admin = ctx.opt.admin;
      const target = ctx.opt.existing.ACL_OWNER ?? '';
      captureOrFail('cast', ['rpc', 'anvil_setBalance', admin, '0xDE0B6B3A7640000', '--rpc-url', forkUrl]);
      const sent = capture('cast', [
        'send',
        '--json',
        '--unlocked',
        '--from',
        admin,
        target,
        calldata,
        '--rpc-url',
        forkUrl,
      ]);
      if (!sent.ok) fail('Error: ACLOwner.upgrade REVERTED on the fork. The live chain is untouched.', sent.stderr);
      const receipt = JSON.parse(sent.stdout) as { readonly status?: string; readonly transactionHash?: string };
      if (receipt.status !== '0x1') {
        fail(`Error: ACLOwner.upgrade failed on the fork (status ${receipt.status ?? '?'}).`);
      }
      say(`    applied ACLOwner.upgrade on the fork: ${receipt.transactionHash ?? '?'}`);
    });

    await step(ctx, 'rehearse', 'verify against the fork', () => stageVerify(fork, true));
    say(
      '',
      `  REHEARSAL PASSED at block ${String(forkedAt)}: the exact payload leaves a stack that passes verify.`,
      `  Nothing was sent to ${ctx.opt.rpcUrl}. Records: ${forkDir}`,
    );
  } finally {
    if (anvil.exitCode === null && anvil.signalCode === null) anvil.kill('SIGTERM');
  }
}

async function stageMaterialize(ctx: Ctx): Promise<void> {
  stageBanner('materialize', '🧩 Materialize: one atomic ACLOwner.upgrade');
  ctx.stageLabel = 'D';

  // The gate runs at the depth the transaction will be sent at, and always — a manual `--stage
  // materialize` gets it too. A dry run never waits, by its own rule.
  if (!ctx.opt.dryRun) await waitForCreatesSettled(ctx);
  await stagePrecheck(ctx);

  if (ctx.opt.adminSigner === null) {
    const { calldata, path: calldataPath } = await step(ctx, 'D', 'write the external ACLOwner.upgrade payload', () =>
      prepareCalldata(ctx),
    );
    say(
      '  external admin action required:',
      `    target   ${ctx.opt.existing.ACL_OWNER ?? ''}`,
      '    value    0',
      `    calldata ${calldata}`,
      `    keccak   ${captureOrFail('cast', ['keccak', calldata])}  <- must equal the digest precheck printed`,
      `    saved    ${calldataPath}`,
    );
    if (ctx.opt.stage === 'all') {
      fail('Error: --stage all stops until the contract/multisig admin executes the payload above.');
    }
    return;
  }
  const adminSigner = ctx.opt.adminSigner;
  await step(ctx, 'D', 'broadcast ACLOwner.upgrade as the admin', () =>
    broadcast(ctx, broadcastTarget('materialize'), adminSigner, ctx.opt.admin, {
      ...existingEnv(ctx),
      ...adapter().sealedEnv(ctx),
    }),
  );
}

/**
 * The terminal conditions, in three layers that answer three different questions:
 *
 *   Solidity   did the intended changes happen — from a fresh recompile, against the seal
 *   survey     did anything ELSE change — every v13 getter, and the sealed handles
 *   events     was the path between the two endpoints straight — one atomic upgrade, no authority moved
 *
 * Waits for the materialize block to be buried and finalized first: a verdict read off a block about to be
 * orphaned is not a verdict. Run it again later at greater depth; `verify-report.json` records each run.
 */
async function stageVerify(ctx: Ctx, rehearsal = false): Promise<void> {
  stageBanner('verify', '✅ Verify');
  if (ctx.opt.minBlockOverride !== null) await waitForBlock(ctx, ctx.opt.minBlockOverride);
  await waitForMaterializeSettled(ctx);
  const out = checkBuildOut(ctx);
  // The sealed migration too: verify recomputes the context anchor hash from it and compares to the chain.
  const env = { ...scriptEnv(ctx, existingEnv(ctx)), ...generatedConfigEnv(ctx), ...adapter().sealedEnv(ctx) };
  await step(ctx, 'verify', 'terminal conditions in Solidity, from a fresh recompile', async () => {
    if (!(await runReadOnly(ctx, ...scriptAndContract('verify'), out, env))) {
      fail('Error: verify failed.');
    }
  });
  await step(ctx, 'verify', adapter().verifyExtras.label, () => {
    adapter().verifyExtras.run(ctx);
  });
  const materialize = await step(ctx, 'verify', 'events: one atomic upgrade, nothing else', () => {
    const found = verifyUpgradeEvents(ctx);
    verifyNoAuthorityEvents(ctx);
    return found;
  });
  writeVerifyReport(ctx, materialize, out);
  // Verified, so the event is complete: date the record from the chain (its ACLOwner.upgrade). Not the
  // rehearsal's: a fork's transactions are on no chain anyone will read, and its folder is scratch.
  if (!rehearsal) writeEventRecord(ctx, adapter().eventKind, materialize.hash);
}

/**
 * The upgrade's own events: the path between the two endpoints was straight.
 *
 * Slot values prove where each proxy ENDED UP. They cannot see an intermediate implementation that ran
 * for a block and was then replaced by the sealed one — code with full storage access that the endpoint
 * checks would never know about. The logs can: exactly one `Upgraded` per re-pointed proxy, to the sealed
 * implementation, all seven in ONE transaction; none at all on the two proxies the op list must not
 * touch; and seven `HostUpgraded` on the ACLOwner naming the same (proxy, implementation) pairs in op
 * order.
 *
 * That one transaction is also the materialize receipt when the admin is a multisig and no local record
 * exists — so it is written to the journal as an observation, once.
 */
function verifyUpgradeEvents(ctx: Ctx): { readonly hash: string; readonly block: number | null } {
  const { address, preUpgrade } = sealedManifest(ctx);
  const fromBlock = preUpgrade.blockNumber + 1;
  const at = (role: string): string => (address[role] ?? '').toLowerCase();

  const hashes = new Set<string>();
  let block: number | null = null;
  const ops = repointed(ctx);
  for (const role of ops) {
    // Every op target is a live proxy, so its whole history since the seal is one `Upgraded` at materialize.
    const expected = [at(`IMPL_${role}`)];
    const logs = scanLogs(ctx, at(role), 'Upgraded(address)', fromBlock);
    if (logs.length !== expected.length) {
      fail(
        `Error: ${role} emitted ${String(logs.length)} Upgraded event(s) since the seal; exactly ${String(expected.length)} expected.`,
      );
    }
    logs.forEach((log, i) => {
      const implementation = topicAddress(log.topics[1]);
      if (implementation !== expected[i]) {
        fail(
          `Error: ${role} Upgraded[${String(i)}] points at ${implementation}, not the sealed ${expected[i] ?? '?'}.`,
        );
      }
    });
    const last = logs[logs.length - 1];
    if (last === undefined) fail(`Error: ${role} has no Upgraded event.`);
    hashes.add(last.transactionHash);
    block = hexToNumber(last.blockNumber);
  }
  for (const role of untouched(ctx)) {
    if (scanLogs(ctx, at(role), 'Upgraded(address)', fromBlock).length !== 0) {
      fail(`Error: ${role} emitted an Upgraded event; the upgrade must not touch it.`);
    }
  }
  const [hash] = [...hashes];
  if (hashes.size !== 1 || hash === undefined) {
    fail(
      `Error: the ${String(ops.length)} Upgraded events span more than one transaction; the upgrade was not atomic.`,
    );
  }

  const host = scanLogs(ctx, at('ACL_OWNER'), 'HostUpgraded(address,address)', fromBlock);
  if (host.length !== ops.length) {
    fail(
      `Error: ACLOwner emitted ${String(host.length)} HostUpgraded events; exactly ${String(ops.length)} are expected.`,
    );
  }
  host.forEach((log, i) => {
    const role = ops[i] ?? '';
    const matches =
      log.transactionHash === hash &&
      topicAddress(log.topics[1]) === at(role) &&
      topicAddress(log.topics[2]) === at(`IMPL_${role}`);
    if (!matches) fail(`Error: HostUpgraded[${String(i)}] does not match the sealed op for ${role}.`);
  });

  say(`    ok   one atomic ACLOwner.upgrade, ${String(ops.length)} ops: ${hash} (block ${String(block)})`);
  recordExternalMaterialize(ctx, hash, block);
  return { hash, block };
}

/** A materialize this tooling did not send has no local receipt; the block it landed in is still worth a line. */
function recordExternalMaterialize(ctx: Ctx, hash: string, block: number | null): void {
  const known = readJournal(ctx).some((row) => row.hash === hash || row.note?.includes(hash) === true);
  if (known) return;
  recordObservation(ctx, 'D', `ACLOwner.upgrade sent externally: ${hash}`, block ?? 0);
}

function verifyNoAuthorityEvents(ctx: Ctx): void {
  const { address, preUpgrade } = sealedManifest(ctx);
  const fromBlock = preUpgrade.blockNumber + 1;
  const scans: ReadonlyArray<readonly [string, string, string]> = [
    ['ACL ownership', address.ACL_ADDRESS ?? '', 'OwnershipTransferStarted(address,address)'],
    ['ACL ownership', address.ACL_ADDRESS ?? '', 'OwnershipTransferred(address,address)'],
    ['ACLOwner ownership', address.ACL_OWNER ?? '', 'OwnershipTransferStarted(address,address)'],
    ['ACLOwner ownership', address.ACL_OWNER ?? '', 'OwnershipTransferred(address,address)'],
    ['PauserSet', address.PAUSER_SET_ADDRESS ?? '', 'AddPauser(address)'],
    ['PauserSet', address.PAUSER_SET_ADDRESS ?? '', 'RemovePauser(address)'],
    ['PauserSet', address.PAUSER_SET_ADDRESS ?? '', 'SwapPauser(address,address)'],
  ];
  for (const [label, target, signature] of scans) {
    if (scanLogs(ctx, target, signature, fromBlock).length > 0) {
      fail(`Error: forbidden ${label} event emitted during upgrade: ${signature}`);
    }
  }
  say('    ok   no ownership or pauser event was emitted during the upgrade');
}

/**
 * The verify's own record: at which block it passed, how deep that block was, and which transaction it
 * verified. `verify` is meant to be run again later at greater depth; this is how two runs are compared.
 */
function writeVerifyReport(
  ctx: Ctx,
  materialize: { readonly hash: string; readonly block: number | null },
  buildOut: string,
): void {
  const report = {
    deploymentId: ctx.opt.deploymentId,
    chainId: ctx.chainId,
    verifiedAt: new Date().toISOString(),
    verifiedAtBlock: headBlock(ctx),
    finalizedBlock: ctx.useFinality ? finalizedBlock(ctx) : null,
    materializeTx: materialize.hash,
    materializeBlock: materialize.block,
    buildOut,
  };
  const path = join(ctx.outDir, 'verify-report.json');
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
  say(`    wrote ${path}`);
}

/** `--stage progress`: the ledger, rendered. Reads local files only. */
function stageStatus(ctx: Ctx): void {
  const manifest = readJson<Manifest & { readonly preUpgrade?: RepointSnapshot }>(manifestPath(ctx));
  if (manifest?.address === undefined || manifest.preUpgrade === undefined) {
    say(`no manifest at ${manifestPath(ctx)} — run compute first.`);
    return;
  }
  say('-'.repeat(RULE_WIDTH));
  banner(`📋 Status: ${ctx.opt.deploymentId} @ v${FHEVM_VERSION}`);
  say('-'.repeat(RULE_WIDTH));

  const creates = createRoles(ctx);
  let createsDone = 0;
  for (const role of creates) {
    const address = manifest.address[role] ?? '';
    const code = capture('cast', ['code', address, '--rpc-url', ctx.opt.rpcUrl]);
    const done = code.ok && code.stdout !== '' && code.stdout !== '0x';
    if (done) createsDone += 1;
    say(`  ${done ? 'done' : 'todo'}  ${pad(role, ROLE_WIDTH)} ${address}`);
  }
  say(`  creates: ${String(createsDone)}/${String(creates.length)}`);

  const upgradedRoles = repointed(ctx);
  const n = String(upgradedRoles.length);
  const slotOf = (role: string): string | null => implementationAt(ctx, manifest.address?.[role] ?? '', null);
  let complete = 0;
  let expectedPrevious = 0;
  let foreign = 0;
  for (const role of upgradedRoles) {
    const current = slotOf(role);
    if (current === null) {
      say(`  FATAL ${pad(role, ROLE_WIDTH)} implementation slot unreadable`);
      foreign += 1;
      continue;
    }
    const target = (manifest.address[`IMPL_${role}`] ?? '').toLowerCase();
    const previous = (manifest.preUpgrade.implementation[role] ?? '').toLowerCase();
    if (current === target) complete += 1;
    else if (current === previous) expectedPrevious += 1;
    else {
      foreign += 1;
      say(`  FATAL ${pad(role, ROLE_WIDTH)} unsealed implementation ${current}`);
    }
  }
  if (foreign > 0) say('  materialize: FATAL — at least one proxy has a foreign implementation');
  else if (complete === upgradedRoles.length) say(`  materialize: done — all ${n} implementation slots match the seal`);
  else if (complete > 0) say(`  materialize: FATAL — partial atomic upgrade (${String(complete)}/${n} slots match)`);
  else if (expectedPrevious === upgradedRoles.length && createsDone === creates.length) {
    say(`  materialize: ready — all ${n} creates exist and all ${n} slots are at their sealed previous values`);
  } else if (expectedPrevious === upgradedRoles.length) say('  materialize: BLOCKED — run creates first');
  else say('  materialize: FATAL — slot classification is inconsistent');

  // The proxies outside the op list, which must still run what they ran at seal time.
  for (const role of untouched(ctx)) {
    const current = slotOf(role);
    const sealed = (manifest.preUpgrade.implementation[role] ?? '').toLowerCase();
    if (current === sealed) say(`  ok    ${pad(role, ROLE_WIDTH)} untouched, still at its sealed implementation`);
    else
      say(
        `  FATAL ${pad(role, ROLE_WIDTH)} implementation moved to ${current ?? '(unreadable)'} - the op list must not touch it`,
      );
  }
}

async function runStage(ctx: Ctx, stage: string): Promise<void> {
  switch (stage) {
    case 'compute':
      await stageCompute(ctx);
      return;
    case 'creates':
      await stageCreates(ctx);
      return;
    case 'precheck':
      await stagePrecheck(ctx);
      return;
    case 'rehearse':
      await stageRehearse(ctx);
      return;
    case 'materialize':
      await stageMaterialize(ctx);
      return;
    case 'verify':
      await stageVerify(ctx);
      return;
    case 'status':
      stageStatus(ctx);
      return;
    case 'log':
      showJournal(ctx);
      return;
    case 'report':
      stageReport(ctx);
      return;
    case 'progress':
      stageProgress(ctx);
      return;
    case 'all':
      fail("Error: 'all' is expanded by main, not run as a stage.");
  }
  const extra = adapter().extraStages[stage];
  if (extra === undefined) fail(`Error: unknown stage '${stage}'.`);
  extra(ctx);
}

/**
 * A re-point flow's whole command line: parse, preflight, then one stage or the full run. The adapter says what
 * the flow is; everything else is the engine's.
 */
export async function runRepointCli(flowAdapter: RepointAdapter): Promise<void> {
  activeAdapter = flowAdapter;
  const FLOW = flowAdapter.flow;
  const cli = parseCliArgs(FLOW, process.argv.slice(2));
  const { cfg, path: configPath } = loadConfigFile(FLOW, cli.configPath);
  const opt = resolveOptions(FLOW, cli, cfg, configPath);

  process.chdir(PACKAGE_ROOT);
  if (FLOW.needsChain(opt.stage)) {
    requireTool('forge');
    requireTool('cast');
  }

  const ctx = buildContext(FLOW, opt);
  if (FLOW.needsChain(opt.stage)) {
    // Everything this invocation prints, forge's output included, kept beside the seal.
    const logs = join(ctx.outDir, 'logs');
    ensureDir(logs);
    startTranscript(join(logs, `${new Date().toISOString().replace(/[:.]/g, '-')}-${opt.stage}.log`));
    say(`📝  transcript: ${logs}`);
    preflight(ctx);
    checkExistingManifestIdentity(ctx);
  }

  if (opt.stage === 'all') {
    say(
      '🗺   plan',
      ...FLOW.runOrder.map((stage, i) => `    ${String(i + 1)}/${String(FLOW.runOrder.length)}  ${stage}`),
      '',
    );
    // Same rule as the deploy: `compute` alone is a hard error once anything was sent, but inside `all`
    // it is incidental, so a sealed upgrade past its first transaction skips it. Otherwise `--stage all`
    // could never resume the upgrade it started. Asked of the chain, so a run killed before it wrote its
    // journal still resumes rather than resealing.
    // Before anything is sent, an existing complete seal — pre-upgrade snapshot included — is reused,
    // never recomputed: the snapshot is the only witness to "before", and the operator committed it.
    if (repointStarted(ctx)) {
      stageBanner('compute', '🍟 Compute: already sealed and past its first transaction - skipping (resume)');
    } else if (isCompleteSeal(ctx, ['preUpgrade'])) {
      stageBanner('compute', `🍟 Compute: using the existing seal ${manifestPath(ctx)} (--stage compute reseals)`);
    } else {
      await stageCompute(ctx);
    }
    for (const stage of FLOW.runOrder.filter((s) => s !== 'compute')) {
      await runStage(ctx, stage);
    }
    say('done (all)');
    return;
  }

  await runStage(ctx, opt.stage);
  say(`done (${opt.stage})`);
}

/**
 * `--stage abandon`: an attempt that sent transactions and will not be finished. It cannot be erased — its
 * transactions are on chain for good — so it is recorded: `event.json` (kind `aborted`, dated by its first
 * transaction's block) is written, and the folder goes under the stack's `aborted/` (deployments/README.md).
 * Refused for an attempt that sent nothing (nothing to record) and for one that materialized (an event, not an
 * attempt: run verify).
 */
export function stageAbandon(ctx: Ctx): void {
  banner(`🪦 Abandon: record this ${adapter().flow.name} as an attempt`);
  if (!journalHasSentTx(ctx)) {
    fail(
      'Error: this attempt sent no transaction, so there is nothing to record.',
      `       Delete ${ctx.outDir} if you do not want to finish it.`,
    );
  }
  if (readJson<Manifest>(manifestPath(ctx)) !== null && isMaterialized(ctx)) {
    fail(
      'Error: every op target already runs its sealed implementation: this is an event, not an attempt. Run verify.',
    );
  }
  writeEventRecord(ctx, 'aborted', null);
  say(
    '',
    '  Archive it, unchanged, as deployments/<chain>/<stack>/aborted/<YYYY-MM-DD>-<kind>-v<N>.<p>-<n>/, the date being',
    "  event.json's first transaction's block day, with an ABORTED.md saying why it was abandoned.",
  );
}
