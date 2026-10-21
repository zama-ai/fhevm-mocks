// Upgrade a LIVE previous-generation cleartext stack to this generation, through the canonical CREATE2 factory.
//
//
// Run through `upgrade/upgrade-cli`. The sibling of ts/deploy-testnet.ts, and everything that is not a stage comes from common.ts: argument
// parsing, the config file, the out-dir identity check, the chain and factory preflight, signer
// resolution, the reorg/finality waits, the journal, the seal gate and broadcast().
//
// ## Two invariants, structural rather than checked-and-hoped
//
// OWNERSHIP NEVER CHANGES. The live stack's ACL is already owned by a standing ACLOwner, and that
// ACLOwner is already owned by the admin; the upgrade runs entirely THROUGH that existing root. So this
// coordinator has no offer/accept stages at all — not stages that no-op, but absent — and it therefore
// cannot move ownership even when invoked wrongly. `verify` asserts it anyway.
//
// THE PAUSERS STAY THE SAME. No pauser stage either. PauserSet is untouched: same contract, same
// membership. Also asserted rather than assumed, because PauserSet exposes no enumeration.
//
// ## What is NOT here
//
// The nonce path (scripts/deploy.sh) and the TypeScript `updateV14ToV15` in pkg/ts are both untouched and
// remain what they were. This is a third path, for a stack whose addresses have to be predictable before
// anything is sent.

import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// The previous generation's contract versions, generated from ITS vendored Solidity (the source of truth: each
// contract's MAJOR/MINOR/PATCH constants). Through the workspace link, never retyped here: a copy would not
// follow a hotfix of the previous generation.
import { CONTRACT_VERSIONS as PREVIOUS_VERSIONS } from '@fhevm/host-contracts-cleartext-v14-dev/pkg/ts/versions.ts';
import {
  atBlock,
  callAddress,
  callAddresses,
  callString,
  callUint,
  sameAddressList,
  type RepointAdapter,
  runRepointCli,
  surveyStack,
  verifySealedHandles,
} from '../../ts/repoint.ts';

import { capture, fail, pad, readJson, say, warn } from '../../ts/utils.ts';
import {
  type Ctx,
  existingFlagFor,
  type Flow,
  manifestPath,
  ROLE_WIDTH,
  sameVersionLine,
  versionLine,
} from '../../ts/common.ts';

////////////////////////////////////////////////////////////////////////////////
// Stages
////////////////////////////////////////////////////////////////////////////////

/**
 * Four real stages against the deploy's nine, plus `precheck`, the read-only gate `materialize` runs first.
 *
 * Absent by design, and their absence is what enforces the invariants: `pausers`, `offer-acl`, `accept-acl`,
 * `offer-admin`, `accept-admin`. An upgrade that cannot name those stages cannot run them.
 */
export type Stage =
  | 'compute'
  | 'creates'
  | 'precheck'
  | 'rehearse'
  | 'materialize'
  | 'verify'
  | 'status'
  | 'log'
  | 'report'
  | 'progress'
  | 'params'
  | 'all';

const ALL_STAGES: readonly Stage[] = [
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
  'params',
  'all',
];

/** What `--stage all` runs, in order. `precheck` is not listed because `materialize` always runs it first. */
const RUN_ORDER: readonly Stage[] = ['compute', 'creates', 'rehearse', 'materialize', 'verify'];

/**
 * The previous generation's live stack, in the order the help and the banner list them: what an upgrade must be
 * given. The previous generation's own roles, not this one's (EXISTING_ROLES): a generation may add a contract.
 */
const PREVIOUS_ROLES: readonly string[] = [
  'ACL_ADDRESS',
  'FHEVM_EXECUTOR_ADDRESS',
  'KMS_VERIFIER_ADDRESS',
  'INPUT_VERIFIER_ADDRESS',
  'HCU_LIMIT_ADDRESS',
  'PROTOCOL_CONFIG_ADDRESS',
  'KMS_GENERATION_ADDRESS',
  'CLEARTEXT_ARITHMETIC_ADDRESS',
  'CLEARTEXT_DB_ADDRESS',
  'PAUSER_SET_ADDRESS',
  'ACL_OWNER',
];

/** The six live proxies `ACLOwner.upgrade` re-points, in op order — the coordinator's copy of the Solidity table. */
const UPGRADED_ROLES: readonly string[] = [
  'ACL_ADDRESS',
  'FHEVM_EXECUTOR_ADDRESS',
  'KMS_VERIFIER_ADDRESS',
  'INPUT_VERIFIER_ADDRESS',
  'PROTOCOL_CONFIG_ADDRESS',
  'KMS_GENERATION_ADDRESS',
];

// The three proxies outside this table (HCULimit, CleartextArithmetic, CleartextDB) are byte-identical across
// the two generations, so the op list leaves them alone; the engine derives them, and one create per op.

const REPORT_STEPS: ReadonlyArray<{ readonly label: string; readonly title: string }> = [
  { label: 'creates', title: 'every CREATE2 through the factory' },
  { label: 'D', title: 'ACLOwner.upgrade — 6 reinitializations' },
];

const DEFAULT_CONFIG_NAME = 'upgrade.config.json';

/** `log`, `report` and `progress` read only local files, so they work with no network at all. */
function needsChain(stage: string): boolean {
  return stage !== 'log' && stage !== 'report' && stage !== 'progress';
}

/**
 * Which stages need the deployer resolved from the KEYSTORE, at the cost of a password prompt.
 *
 * `compute` is on this side of the line for the same reason it is in the deploy: the new addresses are a
 * function of the deployer, so taking it from anywhere but the key itself would let a typo seal a set
 * nobody holds the key to.
 */
function needsDeployerKey(stage: string): boolean {
  return stage === 'compute' || stage === 'creates' || stage === 'all';
}

////////////////////////////////////////////////////////////////////////////////

const HELP = `
Upgrade a live previous-generation cleartext stack to this generation, via the canonical CREATE2 factory.

Usage: upgrade-cli --rpc-url URL [--account NAME] --admin 0x...
                   --deployment-id ID --previous-manifest PATH [--handle 0x...]

  --rpc-url URL        node to upgrade on (required)
  --account NAME       forge keystore account to broadcast from. Required on every chain EXCEPT a
                       local anvil, where accounts 0 and 1 of anvil's public mnemonic are used
  --admin 0x...        the CURRENT ACLOwner owner. Not a value this sets — a value it VERIFIES, since
                       ownership must not change. Optional with --admin-account, whose address is
                       then used; with both, they must be the same account
  --deployment-id ID   reuse the deployment's own id. The salt mixes the version, so this generation's
                       and the original deploy's already give disjoint addresses

THE LIVE STACK — eleven addresses, best supplied through --previous-manifest or the config file:

  --acl 0x...                    --hcu-limit 0x...
  --fhevm-executor 0x...         --protocol-config 0x...
  --kms-verifier 0x...           --kms-generation 0x...
  --input-verifier 0x...         --cleartext-arithmetic 0x...
  --pauser-set 0x...             --cleartext-db 0x...
  --acl-owner 0x...

  --deployment PATH    a stack folder of deployments/<chain>/ (deployments/README.md): its LATEST event is
                       the live stack. Its sealed manifest is the previous manifest, and its config gives
                       rpcUrl, account, adminAccount and admin, below the config file and the flags (so a
                       fork's --rpc-url wins); the folder name is the deploymentId. Refused with
                       --previous-manifest, for a legacy flat record, and for an out dir inside the stack.
                       Without a config file, the event's config is written where you run, next to the
                       out dir, ready to archive

  --real ID            required by a sending stage (all, creates, materialize) on a chain that is not an anvil:
                       names the real stack it changes (its deploymentId). Refused against an anvil
  --fork URL           a SIMULATION on that anvil fork, the only send target (refused with --rpc-url, and for
                       a node that is not an anvil). Keyless unless --account / --admin-account are given:
                       creates from anvil's test account 0, the admin impersonated on the fork. Defaults to 0
                       confirmations, no finality, no git seal and a temporary out dir; the record is marked
                       \`simulation\` and never archived. With --deployment: the real upgrade, rehearsed

  --previous-manifest PATH
                       manifest.json from the deploy that produced the live stack. Seeds all eleven
                       roles above from its "address" block, and is cross-checked FIRST: its chainId
                       must be this chain and its deploymentId must be --deployment-id. Lowest
                       precedence — the config file's "existing" block and the flags above both still
                       win, so one address can be corrected without editing anything

  Every one is validated against the live chain before anything is computed, because the six new
  implementations BAKE these addresses into their creation code: a wrong entry produces a stack that
  materializes cleanly and fails only in use. Eight are cross-checked against the stack's own wiring;
  --kms-verifier, --protocol-config and --kms-generation cannot be (no contract exposes a getter
  returning them), so they get a weaker check and say so.

  --handle 0x...       a cleartext handle already in the live CleartextDB, repeatable. compute records
                       its value; verify requires it unchanged. STRONGLY RECOMMENDED: without one,
                       verify can only prove the stack still works, not that existing data survived

  --previous-abi-dir PATH
                       the previous generation's ABI directory, used to snapshot every zero-argument
                       getter. Defaults to the workspace-linked previous package's pkg/abi; compute
                       never falls back to this generation's ABIs


  --confirmations N    reorg DEPTH floor for the between-stage waits
  --no-finality        wait only for --confirmations of depth, not for finality
  --out-dir PATH       where this upgrade's seal, generated config and journal go. Any folder, inside
                       the repository or not; relative to the current directory on the command line
  --dry-run            run the chosen stage WITHOUT --broadcast
  --min-block N        FHEVM_MIN_BLOCK for a single manual --stage run
  --no-confirm         do not ask about the seal before the first transaction
  --no-build           reuse the artifacts already in the out dir
  --no-git             this upgrade needs no git-committed seal
  --config PATH        JSON file holding the stable arguments (default: ./${DEFAULT_CONFIG_NAME} in the
                       current directory, if it exists). Its
                       relative paths (outDir, previousManifest, previousAbiDir) are
                       relative to the config file's own folder
  --stage STAGE        one of, in order:
                         compute       2 builds + 2 passes, writes the manifest      (no tx)
                         creates       the CREATE2s through the factory
                         precheck      the gate before the point of no return          (no tx)
                         rehearse      precheck, then the exact upgrade calldata applied on a
                                       local anvil FORK of this chain, then verify against the
                                       fork. Nothing reaches this chain                (no tx)
                         materialize   precheck, then one atomic ACLOwner.upgrade
                         verify        versions, wiring, and the invariants           (no tx)
                       or a read-only view: status, log, report, progress, params
                       default: all
                       precheck and verify recompile into <out-dir>/build-check first, so the
                       seal is re-derived from the current checkout rather than from the build
                       that produced it; --no-build checks against the sealed build instead
  -v, --verbose        pass -vvvv to forge
  -h, --help           this

PROGRESS. Every step of every stage is announced as it starts and reported as it ends, with its duration
and the head block, and appended to <out-dir>/progress.jsonl; the full output of each invocation,
forge's included, is kept in <out-dir>/logs/<time>-<stage>.log. --stage progress renders the ledger
without a node. --stage all prints the plan first.

WAITS. Nothing that decides anything is read from a block that can still be reorged. compute snapshots
at the settled block (finalized, or --confirmations deep with --no-finality); rehearse and materialize
wait until every create is settled; verify waits until the materialize block is. All of it is derived
from the chain — never from the journal — so an interrupted run resumes by re-running the same command.
`;

////////////////////////////////////////////////////////////////////////////////
// The live stack
////////////////////////////////////////////////////////////////////////////////

type KmsThresholds = {
  readonly publicDecryption: string;
  readonly userDecryption: string;
  readonly kmsGen: string;
  readonly mpc: string;
};

type PreUpgradeSnapshot = {
  readonly blockNumber: number;
  readonly handles: Readonly<Record<string, string>>;
  readonly readings: Readonly<Record<string, string>>;
  readonly admin: string;
  readonly kmsSigners: readonly string[];
  readonly kmsThresholds: KmsThresholds;
  readonly coprocessorSigners: readonly string[];
  readonly coprocessorThreshold: number;
  /** The KMS context and epoch the stack runs: the upgrade migrates nothing, so verify requires both unchanged. */
  readonly kmsContextId: string;
  readonly kmsEpochId: string;
  readonly implementation: Readonly<Record<string, string>>;
};

/** The previous generation's ABIs, through the same workspace link `PREVIOUS_VERSIONS` comes from. */
const PREVIOUS_ABI_DIR = dirname(
  fileURLToPath(import.meta.resolve('@fhevm/host-contracts-cleartext-v14-dev/pkg/abi/CleartextACL.json')),
);

function previousAbiDir(ctx: Ctx): string {
  return ctx.opt.previousAbiDir ?? PREVIOUS_ABI_DIR;
}

////////////////////////////////////////////////////////////////////////////////

/**
 * Every supplied address, checked against the live chain before anything is computed.
 *
 * This is the most important thing this coordinator does, and the reason is worth stating where the code
 * is: the six new implementations bake these addresses into their CREATION CODE. A wrong entry does not
 * fail here-and-now — it produces implementations at addresses derived from the wrong inputs, whose
 * compiled-in references point at nothing. The stack materializes cleanly and fails in use.
 *
 * The stack largely describes itself, so most of the work is asking it. Every expectation below is a
 * reading from a DIFFERENT contract than the one being checked, which is what makes it a check rather
 * than a tautology.
 */
function validateExisting(ctx: Ctx): void {
  const existing = ctx.opt.existing;

  const missing = PREVIOUS_ROLES.filter((role) => (existing[role] ?? '') === '');
  if (missing.length > 0) {
    const previous = ctx.opt.previousManifest;
    const fromManifest =
      previous === null
        ? []
        : ['', `       --previous-manifest supplied ${String(Object.keys(previous.address).length)} of them.`];
    fail(
      `Error: the live stack is not fully specified — ${String(missing.length)} of ${String(PREVIOUS_ROLES.length)} addresses missing:`,
      ...missing.map((role) => `         ${existingFlagFor(role)}  (${role})`),
      ...fromManifest,
      '',
      `       Put them in the "existing" block of ${DEFAULT_CONFIG_NAME}, or pass the flags. An upgrade`,
      '       derives nothing from the chain it does not first verify.',
    );
  }

  const at = (role: string): string => existing[role] ?? '';
  const acl = at('ACL_ADDRESS');
  const executor = at('FHEVM_EXECUTOR_ADDRESS');
  const arithmetic = at('CLEARTEXT_ARITHMETIC_ADDRESS');
  const aclOwner = at('ACL_OWNER');

  say('  🔬 validating the live stack');

  // Where the address under test came from, so the transcript records the seal's provenance and not
  // just its content. `?` for a role no layer supplied — the missing gate above has already failed.
  const from = (role: string): string => `[${ctx.opt.existingSource[role] ?? '?'}]`;

  let bad = 0;
  const expect = (role: string, target: string, sig: string, source: string): void => {
    const got = callAddress(ctx, target, sig);
    const want = at(role);
    if (got === null) {
      say(
        `    ?    ${pad(role, ROLE_WIDTH)} ${source} did not answer — is that address a live previous-generation contract?`,
      );
      bad += 1;
      return;
    }
    if (got.toLowerCase() !== want.toLowerCase()) {
      say(`    FAIL ${pad(role, ROLE_WIDTH)} ${source} says ${got}, you passed ${want} ${from(role)}`);
      bad += 1;
      return;
    }
    say(`    ok   ${pad(role, ROLE_WIDTH)} confirmed by ${source}  ${from(role)}`);
  };

  // Eight addresses, each corroborated by a contract OTHER than itself. ACL by three.
  expect('ACL_ADDRESS', executor, 'getACLAddress()(address)', 'FHEVMExecutor.getACLAddress');
  expect('ACL_ADDRESS', at('CLEARTEXT_DB_ADDRESS'), 'getACLAddress()(address)', 'CleartextDB.getACLAddress');
  expect('ACL_ADDRESS', aclOwner, 'ACL_ADDRESS()(address)', 'ACLOwner.ACL_ADDRESS');
  expect('FHEVM_EXECUTOR_ADDRESS', acl, 'getFHEVMExecutorAddress()(address)', 'ACL.getFHEVMExecutorAddress');
  expect(
    'FHEVM_EXECUTOR_ADDRESS',
    at('HCU_LIMIT_ADDRESS'),
    'getFHEVMExecutorAddress()(address)',
    'HCULimit.getFHEVMExecutorAddress',
  );
  expect(
    'INPUT_VERIFIER_ADDRESS',
    executor,
    'getInputVerifierAddress()(address)',
    'FHEVMExecutor.getInputVerifierAddress',
  );
  expect('HCU_LIMIT_ADDRESS', executor, 'getHCULimitAddress()(address)', 'FHEVMExecutor.getHCULimitAddress');
  expect(
    'CLEARTEXT_ARITHMETIC_ADDRESS',
    executor,
    'getCleartextArithmeticAddress()(address)',
    'FHEVMExecutor.getCleartextArithmeticAddress',
  );
  expect(
    'CLEARTEXT_DB_ADDRESS',
    arithmetic,
    'getCleartextDBAddress()(address)',
    'CleartextArithmetic.getCleartextDBAddress',
  );
  expect('PAUSER_SET_ADDRESS', acl, 'getPauserSetAddress()(address)', 'ACL.getPauserSetAddress');
  expect('ACL_OWNER', acl, 'owner()(address)', 'ACL.owner');

  // --admin is verified, never set. The upgrade must not move ownership, so a mismatch here means
  // the operator believes something false about who controls the stack.
  const liveAdmin = callAddress(ctx, aclOwner, 'owner()(address)');
  if (liveAdmin?.toLowerCase() !== ctx.opt.admin.toLowerCase()) {
    say(
      `    FAIL ${pad('ACLOwner.owner (--admin)', ROLE_WIDTH)} chain says ${liveAdmin ?? '(no answer)'}, you passed ${ctx.opt.admin}`,
    );
    bad += 1;
  } else {
    say(`    ok   ${pad('ACLOwner.owner (--admin)', ROLE_WIDTH)} matches --admin`);
  }

  // KMS_VERIFIER_ADDRESS, PROTOCOL_CONFIG_ADDRESS, KMS_GENERATION_ADDRESS: no contract in the previous set
  // exposes a getter returning them, so they cannot be corroborated by wiring the way the others are.
  // What follows establishes "this is an initialized previous-generation contract of that kind" — NOT that it
  // is this stack's — plus the one tie available: the KMSVerifier reads its signers off ProtocolConfig, so the
  // two must answer alike. The post-upgrade signer-set comparison covers the residual case.
  const kms = at('KMS_VERIFIER_ADDRESS');
  const kmsCode = capture('cast', ['code', kms, '--rpc-url', ctx.opt.rpcUrl]);
  const kmsVersion = callString(ctx, kms, 'getVersion()(string)');
  const kmsSigners = callAddresses(ctx, kms, 'getKmsSigners()(address[])');
  const kmsThreshold = callUint(ctx, kms, 'getThreshold()(uint256)');
  const domain = capture('cast', [
    'call',
    kms,
    'eip712Domain()(bytes1,string,string,uint256,address,bytes32,uint256[])',
    '--rpc-url',
    ctx.opt.rpcUrl,
  ]);
  if (
    !kmsCode.ok ||
    kmsCode.stdout === '' ||
    kmsCode.stdout === '0x' ||
    !sameVersionLine(kmsVersion, PREVIOUS_VERSIONS.kmsVerifier) ||
    kmsSigners === null ||
    kmsSigners.length === 0 ||
    kmsThreshold === null ||
    kmsThreshold <= 0n ||
    !domain.ok ||
    !domain.stdout.includes('Decryption')
  ) {
    say(
      `    FAIL ${pad('KMS_VERIFIER_ADDRESS', ROLE_WIDTH)} not an initialized previous-generation Decryption KMSVerifier (${versionLine(PREVIOUS_VERSIONS.kmsVerifier)}); reports ${kmsVersion ?? '(nothing)'}`,
    );
    bad += 1;
  } else {
    say(
      `    ok   ${pad('KMS_VERIFIER_ADDRESS', ROLE_WIDTH)} reports ${kmsVersion} — WEAK: not corroborated by wiring  ${from('KMS_VERIFIER_ADDRESS')}`,
    );
  }
  const weak = (role: string, version: string, extra: boolean): void => {
    const got = callString(ctx, at(role), 'getVersion()(string)');
    if (!sameVersionLine(got, version) || !extra) {
      say(
        `    FAIL ${pad(role, ROLE_WIDTH)} not an initialized previous-generation ${version.split(' ')[0] ?? ''} (${versionLine(version)}); reports ${got ?? '(nothing)'}`,
      );
      bad += 1;
      return;
    }
    say(`    ok   ${pad(role, ROLE_WIDTH)} reports ${got} — WEAK: not corroborated by wiring  ${from(role)}`);
  };
  const pcSigners = callAddresses(ctx, at('PROTOCOL_CONFIG_ADDRESS'), 'getKmsSigners()(address[])');
  weak(
    'PROTOCOL_CONFIG_ADDRESS',
    PREVIOUS_VERSIONS.protocolConfig,
    pcSigners !== null && sameAddressList(pcSigners, kmsSigners ?? []),
  );
  weak('KMS_GENERATION_ADDRESS', PREVIOUS_VERSIONS.kmsGeneration, true);
  warn('       KMS_VERIFIER, PROTOCOL_CONFIG and KMS_GENERATION are the addresses the live stack cannot confirm.');

  if (bad > 0) {
    fail(
      '',
      `Error: ${String(bad)} of the supplied addresses do not match the live stack.`,
      '       Nothing has been computed. Fix them before re-running: the six new implementations bake',
      '       these addresses into their creation code, so a wrong one produces a stack that deploys',
      '       cleanly and fails only in use.',
    );
  }
  say(`    ${String(PREVIOUS_ROLES.length)} addresses verified against the live stack`);
}

////////////////////////////////////////////////////////////////////////////////
// Stages
////////////////////////////////////////////////////////////////////////////////

/**
 * Give a missing source a coordinator-level error rather than Forge's less useful "script not found".
 */

////////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////////////

function safeNumber(value: bigint, label: string): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) fail(`Error: ${label} exceeds JavaScript's safe integer range.`);
  return Number(value);
}

/**
 * The upgrade's part of the pre-snapshot, at the engine's settled block: the KMS context and epoch, the KMS and
 * coprocessor signer sets and thresholds — all of which the upgrade must leave as they are — and every
 * previous-generation getter (the survey verify compares against). The engine adds the block, the admin, the
 * handles and every proxy's implementation.
 */
function snapshotExtras(ctx: Ctx, blockNumber: number): Readonly<Record<string, unknown>> {
  const pc = ctx.opt.existing.PROTOCOL_CONFIG_ADDRESS ?? '';
  const inputVerifier = ctx.opt.existing.INPUT_VERIFIER_ADDRESS ?? '';
  const kmsSigners = callAddresses(ctx, pc, 'getKmsSigners()(address[])', blockNumber);
  const kmsThresholds = readKmsThresholds(ctx, pc, blockNumber);
  const kmsContextAndEpoch = readKmsContextAndEpoch(ctx, pc, blockNumber);
  const coprocessorSigners = callAddresses(ctx, inputVerifier, 'getCoprocessorSigners()(address[])', blockNumber);
  const coprocessorThreshold = callUint(ctx, inputVerifier, 'getThreshold()(uint256)', blockNumber);
  if (
    kmsSigners === null ||
    kmsThresholds === null ||
    kmsContextAndEpoch === null ||
    coprocessorSigners === null ||
    coprocessorThreshold === null
  ) {
    fail('Error: could not capture the pre-upgrade authority and signer snapshot.');
  }
  say(`    every previous-generation zero-argument getter, from ${previousAbiDir(ctx)}`);
  const readings = surveyStack(ctx, previousAbiDir(ctx), 'previous-generation', blockNumber);
  say(`    ${String(Object.keys(readings).length)} getter readings captured at block ${String(blockNumber)}`);

  return {
    readings,
    kmsSigners,
    kmsThresholds,
    coprocessorSigners,
    coprocessorThreshold: safeNumber(coprocessorThreshold, 'coprocessor threshold'),
    kmsContextId: kmsContextAndEpoch.contextId,
    kmsEpochId: kmsContextAndEpoch.epochId,
  };
}

/**
 * The KMS context and epoch `ProtocolConfig` runs, as decimal strings (a context id is near 2^250, past any
 * JSON number), or null if unreadable. cast prints one value per line, a large one followed by a
 * `[scientific]` gloss; only the leading digits are kept.
 */
function readKmsContextAndEpoch(
  ctx: Ctx,
  pc: string,
  block?: number,
): { readonly contextId: string; readonly epochId: string } | null {
  const r = capture('cast', [
    'call',
    pc,
    'getCurrentKmsContextAndEpoch()(uint256,uint256)',
    '--rpc-url',
    ctx.opt.rpcUrl,
    ...atBlock(block),
  ]);
  if (!r.ok) return null;
  const values = r.stdout
    .split('\n')
    .map((line) => /^([0-9]+)/.exec(line.trim())?.[1])
    .filter((value): value is string => value !== undefined);
  const [contextId, epochId] = values;
  if (values.length !== 2 || contextId === undefined || epochId === undefined) return null;
  return { contextId, epochId };
}

/** The four per-operation KMS thresholds of the live `ProtocolConfig`, or null if any is unreadable. */
function readKmsThresholds(ctx: Ctx, pc: string, block?: number): KmsThresholds | null {
  const read = (getter: string): string | null => callUint(ctx, pc, `${getter}()(uint256)`, block)?.toString() ?? null;
  const publicDecryption = read('getPublicDecryptionThreshold');
  const userDecryption = read('getUserDecryptionThreshold');
  const kmsGen = read('getKmsGenThreshold');
  const mpc = read('getMpcThreshold');
  if (publicDecryption === null || userDecryption === null || kmsGen === null || mpc === null) return null;
  return { publicDecryption, userDecryption, kmsGen, mpc };
}

const MAY_CHANGE = new Set([
  'ACL.getVersion',
  'FHEVMExecutor.getVersion',
  'KMSVerifier.getVersion',
  'InputVerifier.getVersion',
  'ProtocolConfig.getVersion',
  'KMSGeneration.getVersion',
  // The ACL's protocol-version marker: the previous generation's number before the upgrade, this one's after,
  // by construction. `IS_CLEARTEXT`
  // is deliberately NOT here — it reads true on both sides, so it must not move.
  'ACL.CLEARTEXT_PROTOCOL_VERSION',
  'HCULimit.getBlockMeter',
]);

function verifySurveyAndHandles(ctx: Ctx): void {
  const manifest = readJson<{ readonly preUpgrade?: PreUpgradeSnapshot }>(manifestPath(ctx));
  const before = manifest?.preUpgrade;
  if (before === undefined) fail('Error: manifest has no pre-upgrade snapshot.');
  const after = surveyStack(ctx, previousAbiDir(ctx), 'previous-generation');

  const vanished = Object.keys(before.readings).filter((key) => !(key in after));
  if (vanished.length > 0)
    fail('Error: getters vanished after the upgrade:', ...vanished.map((key) => `       ${key}`));

  const changed: string[] = [];
  for (const [key, was] of Object.entries(before.readings)) {
    const now = after[key];
    if (!MAY_CHANGE.has(key) && now !== was) changed.push(`${key}: ${was} -> ${String(now)}`);
  }
  if (changed.length > 0)
    fail('Error: readable values changed outside the allow-list:', ...changed.map((v) => `       ${v}`));

  const unused = [...MAY_CHANGE].filter((key) => key in before.readings && before.readings[key] === after[key]);
  if (unused.length > 0)
    fail('Error: survey allow-list entries did not change:', ...unused.map((key) => `       ${key}`));
  say(`    ok   ${String(Object.keys(before.readings).length)} previous-generation getter readings survived`);

  verifySealedHandles(ctx, before.handles);
}

////////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////////////
// Settlement — every wait derives from the chain, none from the journal
////////////////////////////////////////////////////////////////////////////////

/** The reinitializer each op calls, index-aligned with `UPGRADED_ROLES` and `UpgradeInitData.initName`. */
const UPGRADE_INIT_CALLS: readonly string[] = [
  'ACL.reinitializeV6()',
  'FHEVMExecutor.reinitializeV7()',
  'KMSVerifier.reinitializeV5()',
  'InputVerifier.reinitializeV3()',
  'ProtocolConfig.reinitializeV3()',
  'KMSGeneration.reinitializeV3()',
];

/**
 * `--stage params`: the init calls this upgrade sends. Every one is a no-argument reinitializer, so there is
 * nothing to seal or decode: the list is the whole payload, the same table `UpgradeInitData.sol` encodes.
 */
function stageParams(ctx: Ctx): void {
  say(`🧬  init calls  ${ctx.opt.deploymentId}`, '');
  for (const call of UPGRADE_INIT_CALLS) say(`  ${call}`);
  say('', '  no arguments: the upgrade migrates nothing');
}

////////////////////////////////////////////////////////////////////////////////

/** This coordinator's half of the split with common.ts: the stages, the help, the two predicates. */
const UPGRADE_FLOW: Flow = {
  name: 'upgrade',
  help: HELP,
  defaultConfigName: DEFAULT_CONFIG_NAME,
  stages: ALL_STAGES,
  runOrder: RUN_ORDER,
  reportSteps: REPORT_STEPS,
  needsChain,
  needsDeployerKey,
  adminSendingStages: ['materialize'],
  readOnlyStages: ['precheck', 'verify', 'status'],
  existingRoles: PREVIOUS_ROLES,
};

////////////////////////////////////////////////////////////////////////////////

/** The previous generation -> this one, as the re-point engine runs it. */
const UPGRADE_ADAPTER: RepointAdapter = {
  flow: UPGRADE_FLOW,
  scriptDir: 'upgrade',
  scripts: {
    compute: 'FhevmComputeUpgradeAddresses.s.sol:FhevmComputeUpgradeAddresses',
    creates: 'FhevmUpgradeCreates.s.sol:FhevmUpgradeCreates',
    precheck: 'FhevmPreMaterializeCheck.s.sol:FhevmPreMaterializeCheck',
    materialize: 'FhevmMaterializeUpgrade.s.sol:FhevmMaterializeUpgrade',
    verify: 'FhevmVerifyUpgrade.s.sol:FhevmVerifyUpgrade',
  },
  computeTitle: '🍟 Compute: 2 passes, 1 rebuild',
  repointed: () => UPGRADED_ROLES,
  validateLive: { label: 'validate the eleven live addresses against the stack', run: validateExisting },
  snapshotExtras,
  // Nothing is sealed into forge's environment: every reinitializer takes no arguments.
  sealedEnv: () => ({}),
  verifyExtras: {
    label: 'survey: every previous-generation getter and every sealed handle',
    run: verifySurveyAndHandles,
  },
  addressesHeader: '// The live previous-generation addresses, which this generation keeps. Generated; do not edit.',
  eventKind: 'upgrade',
  extraStages: { params: stageParams },
};

await runRepointCli(UPGRADE_ADAPTER);
