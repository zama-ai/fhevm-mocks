// Hotfix a LIVE cleartext stack within its generation (vN.x -> vN.(x+1)), through the canonical CREATE2 factory.
//
// Run through `hotfix-cli`. The re-point engine (ts/repoint.ts) runs every stage — compute and seal, creates,
// rehearse on a fork, one atomic ACLOwner.upgrade, verify, event.json; this file says what a hotfix is:
//
//   - which proxies move: exactly those whose implementation in this build differs from the one they run (the
//     forge side decides it from the bytecode, script/hotfix/FhevmHotfixBase.s.sol), with no init data;
//   - what the live stack must be first: the latest record of the stack (`--deployment`), on THIS generation,
//     owned through its ACLOwner by the admin, and run by an older package than this one;
//   - what an op runs: nothing (a plain re-point), or, when a contract's REINITIALIZER_VERSION moved by exactly
//     one, its no-argument `reinitializeV<live>()` — the codebase's convention for an upgrade with no migration;
//   - what it refuses: any other change of reinitializer (that is a migration), and a build that changes nothing
//     ("nothing to re-point").
//
// Generation-agnostic and outside upgrade/, which a rotation deletes: a generation's hotfixes outlive it.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  type Ctx,
  EXISTING_ROLES,
  FHEVM_VERSION,
  type Flow,
  operatorDir,
  manifestPath,
  PACKAGE_ROOT,
  packageVersion,
  previousLink,
} from './common.ts';
import {
  callAddress,
  callUint,
  type RepointAdapter,
  runRepointCli,
  stageAbandon,
  SURVEY_TARGETS,
  surveyStack,
  verifySealedHandles,
} from './repoint.ts';
import { capture, fail, readJson, say } from './utils.ts';

////////////////////////////////////////////////////////////////////////////////
// What a hotfix is
////////////////////////////////////////////////////////////////////////////////

/** This package's generation, as `CLEARTEXT_PROTOCOL_VERSION` reports it: the minor of `0.<N>`. */
export const GENERATION = Number(FHEVM_VERSION.split('.')[1]);

/** OpenZeppelin `Initializable`'s namespaced storage: the low 8 bytes are the proxy's initialized version. */
export const INITIALIZABLE_STORAGE = '0xf0c57e16840df040f15088dc2f81fe391c3923bec73e23a9662efc9c229c6a00';

/**
 * The source that declares each proxy role's `REINITIALIZER_VERSION`: the contract itself, or the upstream base
 * a cleartext variant inherits it from. A private constant, so it is read from the source, never from the chain.
 */
export const REINITIALIZER_SOURCES: Readonly<Record<string, string>> = {
  ACL_ADDRESS: 'pkg/src/contracts/ACL.sol',
  FHEVM_EXECUTOR_ADDRESS: 'pkg/src/contracts/FHEVMExecutor.sol',
  KMS_VERIFIER_ADDRESS: 'pkg/src/contracts/KMSVerifier.sol',
  INPUT_VERIFIER_ADDRESS: 'pkg/src/contracts/InputVerifier.sol',
  HCU_LIMIT_ADDRESS: 'pkg/src/contracts/HCULimit.sol',
  PROTOCOL_CONFIG_ADDRESS: 'pkg/src/contracts/ProtocolConfig.sol',
  KMS_GENERATION_ADDRESS: 'pkg/src/contracts/KMSGeneration.sol',
  CLEARTEXT_ARITHMETIC_ADDRESS: 'pkg/src/cleartext/CleartextArithmetic.sol',
  CLEARTEXT_DB_ADDRESS: 'pkg/src/cleartext/CleartextDB.sol',
};

/** `uint64 private constant REINITIALIZER_VERSION = <n>;` in a Solidity source, or null when it has none. */
export function reinitializerVersionIn(source: string): number | null {
  const m = /uint64\s+(?:private|internal|public)\s+constant\s+REINITIALIZER_VERSION\s*=\s*(\d+)\s*;/.exec(source);
  return m === null ? null : Number(m[1]);
}

/** The initialized version a 32-byte `Initializable` storage word holds (its low 8 bytes). */
export function initializedVersionIn(word: string): number | null {
  const hex = /0x[0-9a-fA-F]{64}/.exec(word)?.[0];
  return hex === undefined ? null : Number(BigInt(`0x${hex.slice(-16)}`));
}

/** What one re-pointed role's op runs, sealed as `.reinitialize.<role>` when it is a call. */
export type ReinitializerPlan = { readonly call: string; readonly from: number; readonly to: number };

/**
 * One role's op, from its source and the live proxy's initialized version: `null` for a plain re-point (the same
 * reinitializer on both sides), a plan when it moved by exactly one and the source declares the no-argument
 * `reinitializeV<live>()` that runs it, else why it is refused.
 */
export function planReinitializer(source: string, live: number | null): ReinitializerPlan | null | string {
  const next = reinitializerVersionIn(source);
  if (next === null) return 'its source declares no REINITIALIZER_VERSION';
  if (live === null) return 'its initialized version could not be read';
  if (next === live) return null;
  if (next !== live + 1) {
    return `its reinitializer moves from ${String(live)} to ${String(next)}: only a move by one is a hotfix, anything else is a migration`;
  }
  const call = `reinitializeV${String(live)}()`;
  if (!new RegExp(`function\\s+reinitializeV${String(live)}\\s*\\(\\s*\\)`).test(source)) {
    return `its reinitializer moves from ${String(live)} to ${String(next)} but it declares no no-argument ${call}`;
  }
  return { call, from: live, to: next };
}

/**
 * Whether `next` (this package) may hotfix a stack whose latest record was made by `previous`: the same
 * generation, a higher patch. Returns why not, or null.
 */
export function hotfixVersionRefusal(previous: string | undefined, next: string): string | null {
  const parse = (v: string): readonly [number, number] | null => {
    const m = /^0\.(\d+)\.(\d+)$/.exec(v);
    return m === null ? null : [Number(m[1]), Number(m[2])];
  };
  const now = parse(next);
  if (now === null) return `this package's version ${next} is not 0.<generation>.<patch>`;
  if (previous === undefined) {
    return 'the latest record names no package version: start from a stack folder (--deployment), whose event folders name it';
  }
  const before = parse(previous);
  if (before === null) return `the latest record's package version ${previous} is not 0.<generation>.<patch>`;
  if (before[0] !== now[0]) {
    return `the latest record is generation v${String(before[0])}, this package v${String(now[0])}: that is an upgrade, not a hotfix`;
  }
  if (now[1] <= before[1]) {
    return `this package (${next}) is not newer than the one the latest record was made with (${previous})`;
  }
  return null;
}

/** The roles compute sealed (`.repointed`); empty before compute. */
function sealedRepointed(ctx: Ctx): readonly string[] {
  const manifest = readJson<{ readonly repointed?: readonly string[] }>(manifestPath(ctx));
  return manifest?.repointed ?? [];
}

////////////////////////////////////////////////////////////////////////////////
// The adapter's hooks
////////////////////////////////////////////////////////////////////////////////

/** compute's first check: the live stack is the latest record's, on this generation, run by an older package. */
function validateLive(ctx: Ctx): void {
  const previous = ctx.opt.previousManifest;
  if (previous === null) {
    fail(
      "Error: a hotfix starts from the stack's latest record: pass --deployment <stack folder>",
      '       (or --previous-manifest <its manifest>). Its implementations are what the hotfix compares against.',
    );
  }
  for (const role of EXISTING_ROLES) {
    const address = ctx.opt.existing[role] ?? '';
    const code = capture('cast', ['code', address, '--rpc-url', ctx.opt.rpcUrl]);
    if (!code.ok || code.stdout === '' || code.stdout === '0x') fail(`Error: no code at ${role} ${address}.`);
  }
  say(`    ok   all ${String(EXISTING_ROLES.length)} recorded addresses hold code`);

  const acl = ctx.opt.existing.ACL_ADDRESS ?? '';
  const live = callUint(ctx, acl, 'CLEARTEXT_PROTOCOL_VERSION()(uint256)');
  if (live !== BigInt(GENERATION)) {
    fail(
      `Error: the live stack reports CLEARTEXT_PROTOCOL_VERSION ${String(live)}, this package is generation ${String(GENERATION)}.`,
      '       A hotfix stays within a generation; moving to another one is an upgrade.',
    );
  }
  say(`    ok   the live stack is generation ${String(GENERATION)}`);

  const aclOwner = ctx.opt.existing.ACL_OWNER ?? '';
  if (callAddress(ctx, acl, 'owner()(address)')?.toLowerCase() !== aclOwner.toLowerCase()) {
    fail(`Error: ACL.owner() is not the recorded ACLOwner ${aclOwner}.`);
  }
  if (callAddress(ctx, aclOwner, 'owner()(address)')?.toLowerCase() !== ctx.opt.admin.toLowerCase()) {
    fail(`Error: ACLOwner.owner() is not the admin ${ctx.opt.admin}; only the admin can send the re-point.`);
  }
  say('    ok   ACL -> ACLOwner -> admin, as recorded');

  const before = previousLink(previous.path, ctx.outDir, operatorDir(ctx)).packageVersion;
  const refusal = hotfixVersionRefusal(before, packageVersion());
  if (refusal !== null) fail(`Error: ${refusal}.`);
  say(`    ok   package ${packageVersion()} follows ${before ?? '?'} within generation ${String(GENERATION)}`);
}

/** The live proxy's initialized version (OpenZeppelin `Initializable`), or null when unreadable. */
function liveInitializedVersion(ctx: Ctx, proxy: string): number | null {
  return initializedVersionIn(
    capture('cast', ['storage', proxy, INITIALIZABLE_STORAGE, '--rpc-url', ctx.opt.rpcUrl]).stdout,
  );
}

/**
 * After compute: each op is a plain re-point or one no-argument reinitializer call (planReinitializer), and the
 * plan is sealed into the manifest (`reinitialize`), where the forge scripts read it. Anything else is refused
 * before the seal is complete.
 */
function planReinitializers(ctx: Ctx): void {
  const plans: Record<string, ReinitializerPlan> = {};
  let refused = 0;
  for (const role of sealedRepointed(ctx)) {
    const source = REINITIALIZER_SOURCES[role];
    const plan =
      source === undefined
        ? `no source is known for ${role}`
        : planReinitializer(
            readFileSync(join(PACKAGE_ROOT, source), 'utf8'),
            liveInitializedVersion(ctx, ctx.opt.existing[role] ?? ''),
          );
    if (typeof plan === 'string') {
      say(`    FAIL ${role}: ${plan}`);
      refused += 1;
    } else if (plan === null) {
      say(`    ok   ${role}: a plain re-point`);
    } else {
      say(`    ok   ${role}: ${plan.call} (reinitializer ${String(plan.from)} -> ${String(plan.to)})`);
      plans[role] = plan;
    }
  }
  if (refused > 0) {
    fail(
      '',
      `Error: ${String(refused)} change(s) are not a hotfix: a hotfix re-points, at most calling one no-argument`,
      '       reinitializer per contract. A migration needs its own reviewed flow.',
    );
  }
  const manifest = readJson<Record<string, unknown>>(manifestPath(ctx)) ?? {};
  writeFileSync(manifestPath(ctx), `${JSON.stringify({ ...manifest, reinitialize: plans }, null, 2)}\n`);
}

/** The labels of the surveyed contracts behind the re-pointed proxies: their `getVersion` may move. */
function mayChange(ctx: Ctx): ReadonlySet<string> {
  const roles = new Set(sealedRepointed(ctx));
  const keys = SURVEY_TARGETS.filter((target) => roles.has(target.role)).map((target) => `${target.label}.getVersion`);
  // The block meter moves with every block, whatever the hotfix does.
  return new Set([...keys, 'HCULimit.getBlockMeter']);
}

/** verify's middle layer: nothing readable moved but what the hotfix may move, and every sealed handle survived. */
function verifySurveyAndHandles(ctx: Ctx): void {
  const manifest = readJson<{
    readonly preUpgrade?: {
      readonly readings?: Readonly<Record<string, string>>;
      readonly handles?: Readonly<Record<string, string>>;
    };
  }>(manifestPath(ctx));
  const before = manifest?.preUpgrade;
  if (before?.readings === undefined || before.handles === undefined)
    fail('Error: manifest has no pre-hotfix snapshot.');
  const after = surveyStack(ctx, abiDir(), `v${String(GENERATION)}`);

  const vanished = Object.keys(before.readings).filter((key) => !(key in after));
  if (vanished.length > 0) fail('Error: getters vanished after the hotfix:', ...vanished.map((key) => `       ${key}`));
  const allowed = mayChange(ctx);
  // A getter the old code did not have reverted before and answers now: new on a re-pointed contract, allowed.
  const repointedLabels = new Set(
    SURVEY_TARGETS.filter((target) => sealedRepointed(ctx).includes(target.role)).map((target) => target.label),
  );
  const isNew = (key: string, was: string): boolean =>
    was === '<reverted>' && repointedLabels.has(key.split('.')[0] ?? '');
  const changed = Object.entries(before.readings)
    .filter(([key, was]) => !allowed.has(key) && !isNew(key, was) && after[key] !== was)
    .map(([key, was]) => `${key}: ${was} -> ${String(after[key])}`);
  if (changed.length > 0)
    fail('Error: readable values changed that a hotfix must not change:', ...changed.map((v) => `       ${v}`));
  say(`    ok   ${String(Object.keys(before.readings).length)} getter readings survived`);
  verifySealedHandles(ctx, before.handles);

  // Each sealed reinitializer ran: the proxy is now initialized at its new version.
  const plans = readJson<{ readonly reinitialize?: Readonly<Record<string, ReinitializerPlan>> }>(manifestPath(ctx));
  for (const [role, plan] of Object.entries(plans?.reinitialize ?? {})) {
    const live = liveInitializedVersion(ctx, ctx.opt.existing[role] ?? '');
    if (live !== plan.to)
      fail(`Error: ${role} is initialized at ${String(live)}, not ${String(plan.to)}: ${plan.call} did not run.`);
    say(`    ok   ${role} is initialized at ${String(plan.to)} (${plan.call} ran)`);
  }
}

/** This generation's ABIs: a hotfix surveys the stack with the contracts it already runs. */
function abiDir(): string {
  return join(PACKAGE_ROOT, 'pkg', 'abi');
}

function snapshotExtras(ctx: Ctx, blockNumber: number): Readonly<Record<string, unknown>> {
  say(`    every zero-argument getter, from ${abiDir()}`);
  const readings = surveyStack(ctx, abiDir(), `v${String(GENERATION)}`, blockNumber);
  say(`    ${String(Object.keys(readings).length)} getter readings captured at block ${String(blockNumber)}`);
  return { readings };
}

////////////////////////////////////////////////////////////////////////////////
// The flow
////////////////////////////////////////////////////////////////////////////////

const HELP = `
Hotfix a live cleartext stack within its generation, via the canonical CREATE2 factory.

Usage: hotfix-cli --deployment deployments/<chain>/<stack> [--out-dir record] [options]

Re-points exactly the proxies whose implementation in this build differs from the one they run, in ONE
atomic ACLOwner.upgrade, after rehearsing it on a fork. Nothing else moves: no proxy, no
owner, no pauser, no storage. Refused: another generation (that is an upgrade), a package not newer than the
latest record's, a reinitializer change other than a move by one (which runs the contract's no-argument
reinitializeV<live>()), a build that changes nothing.

  --deployment PATH    the stack folder (deployments/README.md): its LATEST event is the live stack. Required,
                       unless --previous-manifest names that record. Its config gives rpcUrl, account,
                       adminAccount and admin, below the config file and the flags.
  --out-dir PATH       your own folder, outside deployments/ (refused inside it)
  --stage STAGE        compute, creates, precheck, rehearse, materialize, verify, status, log, report,
                       progress, abandon, or all (default)
  --account NAME       keystore of the account sending the creates (any funded account)
  --admin-account NAME keystore of the admin, which sends the one ACLOwner.upgrade
  --rpc-url URL        overrides the latest record's RPC (e.g. a fork)
  --confirmations N, --no-finality, --no-git, --no-confirm, --dry-run, --no-build, -v
                       as for upgrade-cli

  abandon              an attempt that sent transactions and will not be finished: writes its event.json
                       (kind aborted), to be archived under the stack's aborted/ folder.
`;

const ALL_STAGES = [
  'compute',
  'creates',
  'precheck',
  'rehearse',
  'materialize',
  'verify',
  'status',
  'log',
  'report',
  'progress',
  'abandon',
  'all',
] as const;

const HOTFIX_FLOW: Flow = {
  name: 'hotfix',
  help: HELP,
  defaultConfigName: 'hotfix.config.json',
  stages: ALL_STAGES,
  runOrder: ['compute', 'creates', 'rehearse', 'materialize', 'verify'],
  reportSteps: [
    { label: 'creates', title: 'every CREATE2 through the factory' },
    { label: 'D', title: 'ACLOwner.upgrade — plain re-points' },
  ],
  needsChain: (stage) => stage !== 'log' && stage !== 'report' && stage !== 'progress',
  needsDeployerKey: (stage) => stage === 'compute' || stage === 'creates' || stage === 'all',
  adminSendingStages: ['materialize'],
  readOnlyStages: ['precheck', 'verify', 'status'],
};

/** A hotfix, as the re-point engine runs it. */
const HOTFIX_ADAPTER: RepointAdapter = {
  flow: HOTFIX_FLOW,
  scriptDir: 'hotfix',
  scripts: {
    compute: 'FhevmHotfixComputeAddresses.s.sol:FhevmHotfixComputeAddresses',
    creates: 'FhevmHotfixCreates.s.sol:FhevmHotfixCreates',
    precheck: 'FhevmHotfixPreMaterializeCheck.s.sol:FhevmHotfixPreMaterializeCheck',
    materialize: 'FhevmHotfixMaterialize.s.sol:FhevmHotfixMaterialize',
    verify: 'FhevmHotfixVerify.s.sol:FhevmHotfixVerify',
  },
  computeTitle: '🩹 Compute: 2 passes, 1 rebuild — what changed',
  repointed: sealedRepointed,
  validateLive: { label: 'the live stack is the latest record, on this generation', run: validateLive },
  snapshotExtras,
  sealedEnv: () => ({}),
  verifyExtras: { label: 'survey: every getter and every sealed handle', run: verifySurveyAndHandles },
  addressesHeader: '// The live addresses, which the hotfix keeps. Generated; do not edit.',
  eventKind: 'hotfix',
  afterCompute: planReinitializers,
  extraStages: { abandon: stageAbandon },
};

// Run as the CLI only, so the pure rules above can be imported by tests.
if (import.meta.main) await runRepointCli(HOTFIX_ADAPTER);
