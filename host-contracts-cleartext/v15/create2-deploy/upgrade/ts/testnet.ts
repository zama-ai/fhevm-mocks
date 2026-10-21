// Upgrade a LIVE v13 cleartext stack to v14, through the canonical CREATE2 factory.
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
// The nonce path (scripts/deploy.sh) and the TypeScript `updateV13ToV14` in pkg/ts are both untouched and
// remain what they were. This is a third path, for a stack whose addresses have to be predictable before
// anything is sent.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The previous generation's contract versions, generated from ITS vendored Solidity (the source of truth: each
// contract's MAJOR/MINOR/PATCH constants). Through the workspace link, never retyped here: a copy would not
// follow a v13 hotfix.
import { CONTRACT_VERSIONS as PREVIOUS_VERSIONS } from '@fhevm/host-contracts-cleartext-v14-dev/pkg/ts/versions.ts';
import {
  atBlock,
  callAddress,
  callAddresses,
  callString,
  callUint,
  isAddress,
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
  PACKAGE_ROOT,
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

/** The seven live proxies `ACLOwner.upgrade` re-points, in op order — the coordinator's copy of the Solidity table. */
const UPGRADED_ROLES: readonly string[] = [
  'PROTOCOL_CONFIG_ADDRESS',
  'KMS_GENERATION_ADDRESS',
  'ACL_ADDRESS',
  'FHEVM_EXECUTOR_ADDRESS',
  'HCU_LIMIT_ADDRESS',
  'KMS_VERIFIER_ADDRESS',
  'CLEARTEXT_ARITHMETIC_ADDRESS',
];

// The two proxies outside this table (InputVerifier, CleartextDB) are byte-identical across the two
// generations, so the op list leaves them alone; the engine derives them, and one create per op.

const REPORT_STEPS: ReadonlyArray<{ readonly label: string; readonly title: string }> = [
  { label: 'creates', title: 'every CREATE2 through the factory' },
  { label: 'D', title: 'ACLOwner.upgrade — 7 reinitializations' },
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
Upgrade a live v13 cleartext stack to v14, via the canonical CREATE2 factory.

Usage: upgrade-cli --rpc-url URL [--account NAME] --admin 0x...
                   --deployment-id ID --previous-manifest PATH [--handle 0x...]

  --rpc-url URL        node to upgrade on (required)
  --account NAME       forge keystore account to broadcast from. Required on every chain EXCEPT a
                       local anvil, where accounts 0 and 1 of anvil's public mnemonic are used
  --admin 0x...        the CURRENT ACLOwner owner. Not a value this sets — a value it VERIFIES, since
                       ownership must not change. Optional with --admin-account, whose address is
                       then used; with both, they must be the same account
  --deployment-id ID   reuse the deployment's own id. The salt mixes the version, so "0.14" here and
                       "0.13" for the original deploy already give disjoint addresses

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

  Every one is validated against the live chain before anything is computed, because the seven v14
  implementations BAKE these addresses into their creation code: a wrong entry produces a stack that
  materializes cleanly and fails only in use. Eight are cross-checked against the stack's own wiring;
  --kms-verifier, --protocol-config and --kms-generation cannot be (no contract exposes a getter
  returning them), so they get a weaker check and say so.

  --handle 0x...       a cleartext handle already in the live CleartextDB, repeatable. compute records
                       its value; verify requires it unchanged. STRONGLY RECOMMENDED: without one,
                       verify can only prove the stack still works, not that existing data survived

  --migration PATH     the KMS migration seed. Omit to reconstruct it from the live ProtocolConfig plus
                       the package defaults, which is refused if the live signer set disagrees.
                       Keys are ProtocolConfig.reinitializeV2's parameter names, verbatim:
                       kmsNodeParams[], softwareVersion, pcrValues[]. The context id and thresholds
                       are read off the chain, not from this file. Inside each node signerAddress,
                       txSenderAddress, ipAddress and storageUrl must be what the live v13 context
                       holds, in order (compute, precheck, materialize and verify each refuse otherwise);
                       partyId, mpcIdentity, caCert (hex) and storagePrefix are new in v14 and, with
                       softwareVersion and pcrValues[{pcr0,pcr1,pcr2}], are what this file is for
  --previous-abi-dir PATH
                       v13 ABI directory used to snapshot every zero-argument getter. Defaults to
                       ../v13/pkg/abi; compute refuses to use v14 ABIs as a weaker fallback


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
                       relative paths (outDir, previousManifest, migration, previousAbiDir) are
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

type MigrationNode = {
  readonly txSenderAddress: string;
  readonly signerAddress: string;
  readonly ipAddress: string;
  readonly storageUrl: string;
  readonly partyId: number;
  readonly mpcIdentity: string;
  readonly caCert: string;
  readonly storagePrefix: string;
};

type PcrValues = { readonly pcr0: string; readonly pcr1: string; readonly pcr2: string };

type KmsThresholds = {
  readonly publicDecryption: string;
  readonly userDecryption: string;
  readonly kmsGen: string;
  readonly mpc: string;
};

/** What `reinitializeV2` is given (nodes, version, PCRs) plus the live values it anchors alongside them. */
type SealedMigration = {
  readonly existingContextId: string;
  readonly kmsNodeParams: readonly MigrationNode[];
  readonly thresholds: KmsThresholds;
  readonly softwareVersion: string;
  readonly pcrValues: readonly PcrValues[];
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
  readonly migration: SealedMigration;
  readonly implementation: Readonly<Record<string, string>>;
};

function previousAbiDir(ctx: Ctx): string {
  return ctx.opt.previousAbiDir ?? join(PACKAGE_ROOT, '..', 'v13', 'pkg', 'abi');
}

function solidityArray(source: string, functionName: string, quoted: boolean): string[] {
  const match = new RegExp(`function ${functionName}\\(\\)[\\s\\S]*?\\{([\\s\\S]*?)\\n    \\}`).exec(source);
  const body = match?.[1];
  if (body === undefined) fail(`Error: cannot read ${functionName}() from generated LocalHostBootstrap.sol.`);
  const values = [...body.matchAll(/out\[\d+\] = ([^;]+);/g)].map((entry) => (entry[1] ?? '').trim());
  if (values.length === 0) fail(`Error: ${functionName}() has no entries in generated LocalHostBootstrap.sol.`);
  return quoted ? values.map((value) => JSON.parse(value) as string) : values;
}

const LOCAL_HOST_BOOTSTRAP = join(PACKAGE_ROOT, 'pkg', 'forge', 'src', '_internal', 'LocalHostBootstrap.sol');

/** The cleartext `softwareVersion`, read off the generated `KMS_SOFTWARE_VERSION` constant. */
function defaultSoftwareVersion(): string {
  const source = readFileSync(LOCAL_HOST_BOOTSTRAP, 'utf8');
  const match = /constant KMS_SOFTWARE_VERSION = "([^"]+)";/.exec(source);
  if (match?.[1] === undefined) fail('Error: cannot read KMS_SOFTWARE_VERSION from generated LocalHostBootstrap.sol.');
  return match[1];
}

/** The cleartext CA certificate, read off the generated `KMS_NODE_CA_CERT` bytes constant, as hex. */
function defaultCaCert(): string {
  const source = readFileSync(LOCAL_HOST_BOOTSTRAP, 'utf8');
  const match = /constant KMS_NODE_CA_CERT = hex"([0-9a-fA-F]*)";/.exec(source);
  if (match?.[1] === undefined) fail('Error: cannot read KMS_NODE_CA_CERT from generated LocalHostBootstrap.sol.');
  return `0x${match[1]}`;
}

function defaultMigrationNodes(liveSigners: readonly string[]): MigrationNode[] {
  const source = readFileSync(LOCAL_HOST_BOOTSTRAP, 'utf8');
  const signers = solidityArray(source, 'kmsSigners', false);
  const txSenders = solidityArray(source, 'kmsTxSenders', false);
  const ips = solidityArray(source, 'kmsIpAddresses', true);
  const urls = solidityArray(source, 'kmsStorageUrls', true);
  const identities = solidityArray(source, 'kmsMpcIdentities', true);
  const prefixes = solidityArray(source, 'kmsStoragePrefixes', true);
  const caCert = defaultCaCert();
  return liveSigners.map((signer) => {
    const index = signers.findIndex((candidate) => candidate.toLowerCase() === signer.toLowerCase());
    if (index < 0) {
      fail(
        `Error: live KMS signer ${signer} is not in LocalHostBootstrap's default signer pool.`,
        '       Supply --migration with the real node metadata; defaults would register the wrong nodes.',
      );
    }
    const txSenderAddress = txSenders[index];
    const ipAddress = ips[index];
    const storageUrl = urls[index];
    const mpcIdentity = identities[index];
    const storagePrefix = prefixes[index];
    if (
      !isAddress(txSenderAddress) ||
      ipAddress === undefined ||
      storageUrl === undefined ||
      mpcIdentity === undefined ||
      storagePrefix === undefined
    ) {
      fail('Error: generated LocalHostBootstrap KMS metadata arrays are not index-aligned.');
    }
    // partyId is one-based like `kmsPartyIds()`.
    return {
      txSenderAddress,
      signerAddress: signer,
      ipAddress,
      storageUrl,
      partyId: index + 1,
      mpcIdentity,
      caCert,
      storagePrefix,
    };
  });
}

function isHexBytes(value: unknown): value is string {
  return typeof value === 'string' && /^0x([0-9a-fA-F]{2})*$/.test(value);
}

function parseBigInt(value: unknown, label: string): bigint {
  if (typeof value !== 'string' && typeof value !== 'number') fail(`Error: ${label} must be an integer string.`);
  if (typeof value === 'number' && !Number.isSafeInteger(value))
    fail(`Error: ${label} is not a safe JSON integer; quote it.`);
  try {
    const parsed = BigInt(value);
    if (parsed < 0n) fail(`Error: ${label} must not be negative.`);
    return parsed;
  } catch {
    fail(`Error: ${label} is not an integer.`);
  }
}

function resolveMigration(
  ctx: Ctx,
  liveContextId: bigint,
  liveSigners: readonly string[],
  liveThresholds: KmsThresholds,
): SealedMigration {
  let nodes: readonly MigrationNode[];
  let softwareVersion: string;
  let pcrValues: readonly PcrValues[] = [];

  if (ctx.opt.migrationPath !== null) {
    const raw = readJson<Record<string, unknown>>(ctx.opt.migrationPath);
    if (raw === null) fail(`Error: migration file not found: ${ctx.opt.migrationPath}`);
    if (!Array.isArray(raw.kmsNodeParams)) fail('Error: migration.kmsNodeParams must be an array.');
    nodes = raw.kmsNodeParams.map((entry, index) =>
      parseMigrationNode(entry, `migration.kmsNodeParams[${String(index)}]`),
    );
    if (typeof raw.softwareVersion !== 'string' || raw.softwareVersion === '') {
      fail('Error: migration.softwareVersion must be a non-empty string.');
    }
    softwareVersion = raw.softwareVersion;
    if (!Array.isArray(raw.pcrValues)) fail('Error: migration.pcrValues must be an array (empty for cleartext).');
    pcrValues = raw.pcrValues.map((entry, index) => {
      const pcr = (typeof entry === 'object' && entry !== null ? entry : {}) as Record<string, unknown>;
      if (!isHexBytes(pcr.pcr0) || !isHexBytes(pcr.pcr1) || !isHexBytes(pcr.pcr2)) {
        fail(`Error: migration.pcrValues[${String(index)}] must have hex pcr0, pcr1 and pcr2.`);
      }
      return { pcr0: pcr.pcr0, pcr1: pcr.pcr1, pcr2: pcr.pcr2 };
    });
  } else {
    nodes = defaultMigrationNodes(liveSigners);
    softwareVersion = defaultSoftwareVersion();
  }

  const migrationSigners = nodes.map((node) => node.signerAddress);
  if (!sameAddressList(migrationSigners, liveSigners)) {
    fail('Error: migration KMS signers do not exactly match the live v13 signer set (including order).');
  }
  const txSenders = nodes.map((node) => node.txSenderAddress.toLowerCase());
  if (new Set(txSenders).size !== txSenders.length) fail('Error: migration KMS tx-sender addresses must be unique.');
  if (new Set(nodes.map((node) => node.partyId)).size !== nodes.length) {
    fail('Error: migration KMS party ids must be unique.');
  }

  return {
    existingContextId: liveContextId.toString(),
    kmsNodeParams: nodes,
    thresholds: liveThresholds,
    softwareVersion,
    pcrValues,
  };
}

/** One `kmsNodeParams` entry of the migration file, every field checked for shape. */
function parseMigrationNode(entry: unknown, label: string): MigrationNode {
  if (typeof entry !== 'object' || entry === null) fail(`Error: ${label} is not an object.`);
  const node = entry as Record<string, unknown>;
  if (!isAddress(node.txSenderAddress) || !isAddress(node.signerAddress)) {
    fail(`Error: ${label} has an invalid address.`);
  }
  if (
    typeof node.ipAddress !== 'string' ||
    typeof node.storageUrl !== 'string' ||
    typeof node.mpcIdentity !== 'string' ||
    typeof node.storagePrefix !== 'string'
  ) {
    fail(`Error: ${label} has invalid metadata.`);
  }
  const partyId = parseBigInt(node.partyId, `${label}.partyId`);
  if (partyId > 0x7fffffffn) fail(`Error: ${label}.partyId does not fit int32.`);
  if (!isHexBytes(node.caCert)) fail(`Error: ${label}.caCert must be hex bytes ("0x" when empty).`);
  return {
    txSenderAddress: node.txSenderAddress,
    signerAddress: node.signerAddress,
    ipAddress: node.ipAddress,
    storageUrl: node.storageUrl,
    partyId: Number(partyId),
    mpcIdentity: node.mpcIdentity,
    caCert: node.caCert,
    storagePrefix: node.storagePrefix,
  };
}

////////////////////////////////////////////////////////////////////////////////

/**
 * Every supplied address, checked against the live chain before anything is computed.
 *
 * This is the most important thing this coordinator does, and the reason is worth stating where the code
 * is: the seven v14 implementations bake these addresses into their CREATION CODE. A wrong entry does not
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
      say(`    ?    ${pad(role, ROLE_WIDTH)} ${source} did not answer — is that address a live v13 contract?`);
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

  // KMS_VERIFIER_ADDRESS, PROTOCOL_CONFIG_ADDRESS, KMS_GENERATION_ADDRESS: no contract in the v13 set
  // exposes a getter returning them, so they cannot be corroborated by wiring the way the others are.
  // What follows establishes "this is an initialized v13 contract of that kind" — NOT that it is this
  // stack's — plus the one tie available: v13's KMSVerifier reads its signers off ProtocolConfig, so the
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
      `    FAIL ${pad('KMS_VERIFIER_ADDRESS', ROLE_WIDTH)} not an initialized v13 Decryption KMSVerifier (${versionLine(PREVIOUS_VERSIONS.kmsVerifier)}); reports ${kmsVersion ?? '(nothing)'}`,
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
        `    FAIL ${pad(role, ROLE_WIDTH)} not an initialized v13 ${version.split(' ')[0] ?? ''} (${versionLine(version)}); reports ${got ?? '(nothing)'}`,
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
      '       Nothing has been computed. Fix them before re-running: the seven v14 implementations bake',
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
 * The upgrade's part of the pre-snapshot, at the engine's settled block: the KMS and coprocessor signer sets,
 * the migration they seed, and every v13 getter (the survey verify compares against). The engine adds the
 * block, the admin, the handles and every proxy's implementation.
 */
function snapshotExtras(ctx: Ctx, blockNumber: number): Readonly<Record<string, unknown>> {
  const pc = ctx.opt.existing.PROTOCOL_CONFIG_ADDRESS ?? '';
  const inputVerifier = ctx.opt.existing.INPUT_VERIFIER_ADDRESS ?? '';
  const kmsSigners = callAddresses(ctx, pc, 'getKmsSigners()(address[])', blockNumber);
  const kmsThresholds = readKmsThresholds(ctx, pc, blockNumber);
  const kmsContextId = callUint(ctx, pc, 'getCurrentKmsContextId()(uint256)', blockNumber);
  const coprocessorSigners = callAddresses(ctx, inputVerifier, 'getCoprocessorSigners()(address[])', blockNumber);
  const coprocessorThreshold = callUint(ctx, inputVerifier, 'getThreshold()(uint256)', blockNumber);
  if (
    kmsSigners === null ||
    kmsThresholds === null ||
    kmsContextId === null ||
    coprocessorSigners === null ||
    coprocessorThreshold === null
  ) {
    fail('Error: could not capture the pre-upgrade authority and signer snapshot.');
  }
  say(`    every v13 zero-argument getter, from ${previousAbiDir(ctx)}`);
  const readings = surveyStack(ctx, previousAbiDir(ctx), 'v13', blockNumber);
  say(`    ${String(Object.keys(readings).length)} getter readings captured at block ${String(blockNumber)}`);

  const migration = resolveMigration(ctx, kmsContextId, kmsSigners, kmsThresholds);
  requireMigrationNodesMatchLive(ctx, pc, migration, blockNumber);

  return {
    readings,
    kmsSigners,
    kmsThresholds,
    coprocessorSigners,
    coprocessorThreshold: safeNumber(coprocessorThreshold, 'coprocessor threshold'),
    migration,
  };
}

/**
 * The four node fields v13 stores — tx sender, signer, ip, storage url — must be exactly what the live context
 * holds, in order. `reinitializeV2` writes none of them; it anchors and announces them, so a sealed value the
 * chain does not hold would describe a node set nobody runs. Compared as ABI encodings: the live
 * `getKmsNodesForContext` return data against `cast abi-encode` of the same four fields from the migration.
 * FhevmUpgradeBase._migrationNodesMatch repeats this at precheck, materialize and verify.
 */
function requireMigrationNodesMatchLive(ctx: Ctx, pc: string, migration: SealedMigration, block: number): void {
  const sig = 'getKmsNodesForContext(uint256)';
  const live = capture('cast', [
    'call',
    pc,
    sig,
    migration.existingContextId,
    '--rpc-url',
    ctx.opt.rpcUrl,
    ...atBlock(block),
  ]);
  if (!live.ok || live.stdout === '') fail('Error: could not read the live v13 KMS nodes (getKmsNodesForContext).');
  const tuples = migration.kmsNodeParams.map(
    (node) =>
      `(${node.txSenderAddress},${node.signerAddress},${JSON.stringify(node.ipAddress)},${JSON.stringify(node.storageUrl)})`,
  );
  const sealed = capture('cast', ['abi-encode', 'f((address,address,string,string)[])', `[${tuples.join(',')}]`]);
  if (!sealed.ok) fail('Error: could not ABI-encode the migration KMS nodes.', `       ${sealed.stderr}`);
  if (sealed.stdout.toLowerCase() !== live.stdout.toLowerCase()) {
    const decoded = capture('cast', ['abi-decode', `${sig}((address,address,string,string)[])`, live.stdout]);
    fail(
      'Error: migration kmsNodeParams do not match the live v13 nodes (txSenderAddress, signerAddress, ipAddress, ' +
        'storageUrl, including order).',
      `       live: ${decoded.ok ? decoded.stdout : live.stdout}`,
    );
  }
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

function sealedMigrationEnv(ctx: Ctx): NodeJS.ProcessEnv {
  const manifest = readJson<{ readonly preUpgrade?: PreUpgradeSnapshot }>(manifestPath(ctx));
  const snapshot = manifest?.preUpgrade;
  if (snapshot === undefined) fail('Error: manifest has no sealed preUpgrade snapshot; run compute again.');
  const migration = snapshot.migration;
  const env: NodeJS.ProcessEnv = {
    FHEVM_MIGRATION_CONTEXT_ID: migration.existingContextId,
    FHEVM_MIGRATION_NODE_COUNT: String(migration.kmsNodeParams.length),
    FHEVM_MIGRATION_PUBLIC_DECRYPTION_THRESHOLD: migration.thresholds.publicDecryption,
    FHEVM_MIGRATION_USER_DECRYPTION_THRESHOLD: migration.thresholds.userDecryption,
    FHEVM_MIGRATION_KMS_GEN_THRESHOLD: migration.thresholds.kmsGen,
    FHEVM_MIGRATION_MPC_THRESHOLD: migration.thresholds.mpc,
    FHEVM_MIGRATION_SOFTWARE_VERSION: migration.softwareVersion,
    FHEVM_MIGRATION_PCR_COUNT: String(migration.pcrValues.length),
  };
  migration.kmsNodeParams.forEach((node, i) => {
    const prefix = `FHEVM_MIGRATION_NODE_${String(i)}`;
    env[`${prefix}_TX_SENDER`] = node.txSenderAddress;
    env[`${prefix}_SIGNER`] = node.signerAddress;
    env[`${prefix}_IP`] = node.ipAddress;
    env[`${prefix}_STORAGE`] = node.storageUrl;
    env[`${prefix}_PARTY_ID`] = String(node.partyId);
    env[`${prefix}_MPC_IDENTITY`] = node.mpcIdentity;
    env[`${prefix}_CA_CERT`] = node.caCert;
    env[`${prefix}_STORAGE_PREFIX`] = node.storagePrefix;
  });
  migration.pcrValues.forEach((pcr, i) => {
    env[`FHEVM_MIGRATION_PCR_${String(i)}_0`] = pcr.pcr0;
    env[`FHEVM_MIGRATION_PCR_${String(i)}_1`] = pcr.pcr1;
    env[`FHEVM_MIGRATION_PCR_${String(i)}_2`] = pcr.pcr2;
  });
  return env;
}

const MAY_CHANGE = new Set([
  'ProtocolConfig.getVersion',
  'KMSGeneration.getVersion',
  'ACL.getVersion',
  'FHEVMExecutor.getVersion',
  'HCULimit.getVersion',
  'KMSVerifier.getVersion',
  'CleartextArithmetic.getVersion',
  // The ACL's protocol-version marker: 13 before the upgrade, 14 after, by construction. `IS_CLEARTEXT`
  // is deliberately NOT here — it reads true on both sides, so it must not move.
  'ACL.CLEARTEXT_PROTOCOL_VERSION',
  'HCULimit.getBlockMeter',
]);

function verifySurveyAndHandles(ctx: Ctx): void {
  const manifest = readJson<{ readonly preUpgrade?: PreUpgradeSnapshot }>(manifestPath(ctx));
  const before = manifest?.preUpgrade;
  if (before === undefined) fail('Error: manifest has no pre-upgrade snapshot.');
  const after = surveyStack(ctx, previousAbiDir(ctx), 'v13');

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
  say(`    ok   ${String(Object.keys(before.readings).length)} v13 getter readings survived`);

  verifySealedHandles(ctx, before.handles);
}

////////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////////////
// Settlement — every wait derives from the chain, none from the journal
////////////////////////////////////////////////////////////////////////////////

/**
 * `--stage params`: the init parameters this upgrade sends, decoded.
 *
 * The one op with arguments is `ProtocolConfig.reinitializeV2`; this is its payload. After `compute` it
 * is read from the seal. Before, it is resolved exactly as `compute` would resolve it — the live
 * ProtocolConfig plus `--migration` or the package defaults — and printed as a preview, so an operator
 * can see what WOULD be sealed before anything is. `precheck` prints the same values at send time.
 */
function stageParams(ctx: Ctx): void {
  const manifest = readJson<{ readonly preUpgrade?: PreUpgradeSnapshot }>(manifestPath(ctx));
  const sealed = manifest?.preUpgrade?.migration;
  const migration = sealed ?? previewMigration(ctx);
  say(
    sealed === undefined
      ? `🧬  init parameters  ${ctx.opt.deploymentId}  PREVIEW: not sealed yet, resolved as compute would`
      : `🧬  init parameters  ${ctx.opt.deploymentId}  (${manifestPath(ctx)})`,
    '',
  );
  say('  ProtocolConfig.reinitializeV2(kmsNodeParams, softwareVersion, pcrValues)', '');
  say(`  live contextId     ${migration.existingContextId}   <- not an argument; stays on chain`);
  migration.kmsNodeParams.forEach((node, i) => {
    say(
      `  kmsNodeParams[${String(i)}]`,
      `    signerAddress    ${node.signerAddress}   <- read off the live v13 ProtocolConfig`,
      `    txSenderAddress  ${node.txSenderAddress}`,
      `    ipAddress        ${node.ipAddress}`,
      `    storageUrl       ${node.storageUrl}`,
      `    partyId          ${String(node.partyId)}   <- new in v14: --migration, or package default`,
      `    mpcIdentity      ${node.mpcIdentity}`,
      `    caCert           ${node.caCert}`,
      `    storagePrefix    ${node.storagePrefix}`,
    );
  });
  const t = migration.thresholds;
  say(
    `  softwareVersion    ${migration.softwareVersion}`,
    `  pcrValues          ${String(migration.pcrValues.length)} entr${migration.pcrValues.length === 1 ? 'y' : 'ies'}`,
    '  live thresholds    <- not arguments; enter the anchor hash alongside the values above',
    `    publicDecryption ${t.publicDecryption}`,
    `    userDecryption   ${t.userDecryption}`,
    `    kmsGen           ${t.kmsGen}`,
    `    mpc              ${t.mpc}`,
    '',
    '  the six other ops take no arguments (reinitializers)',
  );
}

/** What `compute` would seal right now: the live ProtocolConfig, plus the migration file or the defaults. */
function previewMigration(ctx: Ctx): SealedMigration {
  const pc = ctx.opt.existing.PROTOCOL_CONFIG_ADDRESS ?? '';
  if (pc === '')
    fail('Error: PROTOCOL_CONFIG_ADDRESS is not known - pass --previous-manifest, --protocol-config or a config file.');
  const signers = callAddresses(ctx, pc, 'getKmsSigners()(address[])');
  const thresholds = readKmsThresholds(ctx, pc);
  const contextId = callUint(ctx, pc, 'getCurrentKmsContextId()(uint256)');
  if (signers === null || thresholds === null || contextId === null) {
    fail(`Error: ${pc} did not answer as a live v13 ProtocolConfig.`);
  }
  say(`  source  ${ctx.opt.migrationPath ?? 'package defaults (no --migration)'}`, `  live    ${pc} (ProtocolConfig)`);
  return resolveMigration(ctx, contextId, signers, thresholds);
}

////////////////////////////////////////////////////////////////////////////////

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

/** The v13 -> v14 generation upgrade, as the re-point engine runs it. */
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
  sealedEnv: sealedMigrationEnv,
  verifyExtras: { label: 'survey: every v13 getter and every sealed handle', run: verifySurveyAndHandles },
  addressesHeader: '// The live v13 addresses, which v14 keeps. Generated; do not edit.',
  eventKind: 'upgrade',
  extraStages: { params: stageParams },
};

await runRepointCli(UPGRADE_ADAPTER);
