// Shared machinery for the two CREATE2 coordinators, `ts/deploy-testnet.ts` and `upgrade/ts/testnet.ts`,
// which operators run through the `deploy-cli` and `upgrade/upgrade-cli` launchers.
//
// The split is by WHAT VARIES, not by size. Both flows want the same everything-except-the-stages:
// argument parsing, the config file, the out-dir identity check, the chain and factory preflight, signer
// resolution, the reorg/finality waits, the journal, the seal gate, and the one `forge script` invocation
// that broadcasts a stage. What differs is the stage list, the help text, and which stages need a chain
// or a key — so those seven things arrive as a `Flow` descriptor and everything else lives here.
//
// Why not a base class or a single coordinator with a `--mode` flag: the two flows have genuinely
// different preconditions. A deploy asserts nothing exists yet; an upgrade asserts a specific stack
// already does, and must never touch its ownership or its pausers. Sharing the plumbing while keeping the
// stage tables apart is what keeps each one's preconditions readable in one place.
//
// Distinct from `utils.ts`, which is dependency-free and knows nothing about this deploy at all.

import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

import {
  appendJsonl,
  capture,
  captureOrFail,
  ensureDir,
  fail,
  heartbeat,
  hexToNumber,
  isInside,
  pad,
  readJson,
  readJsonl,
  removeIfPresent,
  runLogged,
  sameAddress,
  say,
  sleep,
  transcriptActive,
  warn,
} from './utils.ts';

////////////////////////////////////////////////////////////////////////////////

/**
 * A stage name. Left as a plain string here because the two flows have different stage sets; each
 * coordinator declares its own union and passes the list in via `Flow`.
 */
export type Stage = string;

/**
 * Everything that differs between the deploy and the upgrade.
 *
 * A handful of fields, which is the honest measure of how much the two flows actually diverge: the rest
 * of this file is identical for both. Adding a flow means writing one of these plus its stage functions.
 */
export type Flow = {
  /** For messages and the journal, e.g. `deploy` or `upgrade`. */
  readonly name: string;
  /** `--help` output. */
  readonly help: string;
  /** Auto-discovered config file name, e.g. `deploy.config.json`. */
  readonly defaultConfigName: string;
  /** Every accepted `--stage` value, including the pseudo-stages and `all`. */
  readonly stages: readonly Stage[];
  /** What `--stage all` runs, in order. */
  readonly runOrder: readonly Stage[];
  /** The steps `--report` tabulates. */
  readonly reportSteps: ReadonlyArray<{ readonly label: string; readonly title: string }>;
  /** Does this stage talk to a node at all? */
  readonly needsChain: (stage: Stage) => boolean;
  /** Does this stage need the deployer resolved from the keystore, at the cost of a password prompt? */
  readonly needsDeployerKey: (stage: Stage) => boolean;
  /** The stages that send a transaction FROM THE ADMIN (besides `all`), so preflight checks its funds. */
  readonly adminSendingStages: readonly Stage[];
};

export type Options = {
  readonly rpcUrl: string;
  readonly account: string;
  /** How stages sign. Null only for the read-only stages, which sign nothing. */
  readonly signer: Signer | null;
  /** Who signs step F on the admin's behalf, when anything does. */
  readonly adminSigner: Signer | null;
  readonly admin: string;
  /** True when `admin` was not given and was read off the admin signer (keystore or anvil). */
  readonly adminDerived: boolean;
  readonly deploymentId: string;
  readonly pauser: string | null;
  readonly adminAccount: string | null;
  readonly confirmations: number;
  readonly minBlockOverride: number | null;
  readonly outDirArg: string | null;
  readonly stage: Stage;
  readonly dryRun: boolean;
  readonly useFinality: boolean;
  readonly noConfirm: boolean;
  /** false = this deployment needs no git-committed seal. See confirmSealed. */
  readonly requireGitSeal: boolean;
  /** Trust the artifacts already in the out dir instead of rebuilding. See stageCompute. */
  readonly noBuild: boolean;
  /** Pass -vvvv to forge, so its execution traces are printed. See traceArgs. */
  readonly verbose: boolean;
  /** Where the stable half came from, or null if it was all typed. Shown in the preflight banner. */
  readonly configPath: string | null;

  // ---- upgrade only; empty / null for a deploy ----

  /** The live stack being upgraded (see ExistingAddresses). Empty for a deploy. */
  readonly existing: ExistingAddresses;
  /** Where each `existing` role came from: 'manifest', 'config', or the flag that set it. */
  readonly existingSource: Readonly<Record<string, string>>;
  /** The previous generation's manifest, when one was given. Seeds `existing` at the lowest precedence. */
  readonly previousManifest: PreviousManifest | null;
  /** Path to the KMS migration seed, or null to reconstruct it from the live stack plus defaults. */
  readonly migrationPath: string | null;
  /** Directory containing the previous generation's ABIs for the before/after getter survey. */
  readonly previousAbiDir: string | null;
  /**
   * Cleartext handles already recorded in the live `CleartextDB`, whose values must survive the upgrade.
   *
   * Optional and repeatable, and its emptiness is REPORTED rather than silently tolerated: without one,
   * verify can only prove the stack still works, not that existing data survived. Two different claims.
   */
  readonly handles: readonly string[];
};

/**
 * The JSON config file: what this deployment IS.
 *
 * Deliberately does NOT include stage, dryRun, minBlock or yes — those are what a single invocation
 * DOES, and pinning them in a file turns every invocation into the same one. loadConfigFile rejects
 * them by name rather than ignoring them.
 */
export type ConfigFile = {
  readonly rpcUrl?: string;
  readonly account?: string;
  readonly admin?: string;
  readonly deploymentId?: string;
  readonly pauser?: string;
  readonly adminAccount?: string;
  readonly confirmations?: number;
  readonly outDir?: string;
  /** Positive form of --no-finality: `false` disables the finality wait. */
  readonly finality?: boolean;
  /** Positive form of --no-git: `false` means this deployment needs no committed seal. */
  readonly git?: boolean;
  /** Upgrade only: the live stack's addresses. Nine flags is unreasonable to retype. */
  readonly existing?: ExistingAddresses;
  /** Upgrade only: path to the KMS migration seed. */
  readonly migration?: string;
  /** Upgrade only: previous generation ABI directory. */
  readonly previousAbiDir?: string;
  /** Upgrade only: the previous generation's sealed manifest, seeding the nine addresses above. */
  readonly previousManifest?: string;
  /** Upgrade only: handles whose cleartext values must survive. */
  readonly handles?: readonly string[];
};

/** Command line before the config file is merged under it. `null` means "not given". */
export type CliArgs = {
  configPath: string | null;
  rpcUrl: string | null;
  account: string | null;
  admin: string | null;
  deploymentId: string | null;
  pauser: string | null;
  adminAccount: string | null;
  confirmations: number | null;
  outDirArg: string | null;
  useFinality: boolean | null;
  minBlockOverride: number | null;
  stage: Stage | null;
  dryRun: boolean;
  noConfirm: boolean;
  requireGitSeal: boolean | null;
  noBuild: boolean;
  verbose: boolean;
  /** Upgrade only. Merged over the config file's `existing` block, so a single address can be overridden. */
  existing: Record<string, string>;
  migrationPath: string | null;
  previousAbiDir: string | null;
  previousManifestPath: string | null;
  handles: string[];
};

/** Mutable run state. The shell version kept these as globals; they are threaded explicitly here. */
export type Ctx = {
  /** What varies between the deploy and the upgrade. */
  readonly flow: Flow;
  readonly opt: Options;
  readonly outDir: string;
  readonly buildOut: string;
  readonly broadcastDir: string;
  readonly journalPath: string;
  readonly deployer: string;
  chainId: string;
  useFinality: boolean;
  /** Block the next broadcasting stage may not start before. */
  nextMinBlock: number;
  /** Block that must FINALIZE before the next stage. 0 = nothing sent yet. */
  finalityTarget: number;
  stageLabel: string;
  /**
   * `--root <package> --config-path <generated foundry.toml>`, appended to every forge invocation so
   * forge may write to the out dir wherever it is. Set by prepareForgeConfig, in preflight.
   */
  forgeArgs: readonly string[];
};

/**
 * One transaction in the journal: sent by this tooling (from forge's broadcast records), recovered from
 * the chain, or observed (a multisig's step F, which no local key sent).
 *
 * Append-only: a later line with the SAME hash supersedes an earlier one — `unmined` becoming mined,
 * a block hash filled in, a reorg re-read. readJournal keeps the last line per hash.
 *
 *   status    ok | REVERTED   mined, per its receipt
 *             unmined         SENT (it has a hash) but no receipt yet: in the mempool, dropped, or reorged out
 *   blockHash                 with `block`, proof of WHERE it was mined: a reorg changes the hash at that height
 *   recovered                 how a line the run itself did not write got here: `broadcast-file` (forge's own
 *                             records), `nonce-scan` (found on chain from a stage-start anchor)
 */
export type JournalEntry = {
  readonly kind?: 'tx';
  readonly stage: string;
  readonly script?: string;
  readonly hash: string | null;
  readonly type?: string | null;
  readonly contract?: string | null;
  readonly address?: string | null;
  readonly function?: string | null;
  readonly from?: string | null;
  readonly nonce?: number | null;
  readonly block: number | null;
  readonly blockHash?: string | null;
  readonly gasUsed?: number | null;
  readonly status: 'ok' | 'REVERTED' | 'unmined';
  readonly recovered?: 'broadcast-file' | 'nonce-scan';
  readonly observed?: boolean;
  readonly note?: string;
  readonly ts?: number | null;
};

/**
 * Written BEFORE forge is started for a broadcasting stage, so that even a run killed the instant after
 * it sent something leaves a trace: who was about to send, from which nonce, from which block. At startup,
 * nonces the journal cannot account for are looked up on chain from here (reconcileJournal).
 */
export type JournalStageStart = {
  readonly kind: 'stage-start';
  readonly stage: string;
  readonly script: string;
  readonly from: string;
  readonly nonce: number;
  readonly head: number;
  readonly ts: number;
};

/**
 * A transaction's block is final: the chain's settled block (finalized tag, or `confirmations` deep with
 * --no-finality) had reached it, AND the block at that height still had the recorded hash.
 */
export type JournalFinalized = {
  readonly kind: 'finalized';
  readonly hash: string;
  readonly block: number;
  readonly blockHash: string;
  readonly settledBlock: number;
  readonly rule: string;
  readonly ts: number;
};

export type JournalLine = JournalEntry | JournalStageStart | JournalFinalized;

/** The shape of forge's broadcast/<Script>/<chainId>/run-*.json that this reads. */
export type ForgeRun = {
  readonly timestamp?: number;
  readonly transactions?: ReadonlyArray<{
    readonly hash: string | null;
    readonly transactionType?: string;
    readonly contractName?: string;
    readonly contractAddress?: string;
    readonly function?: string | null;
    readonly transaction?: { readonly from?: string; readonly nonce?: string };
  }>;
  readonly receipts?: ReadonlyArray<{
    readonly transactionHash: string;
    readonly blockNumber?: string;
    readonly blockHash?: string;
    readonly status?: string;
    readonly gasUsed?: string;
  }>;
};

export type Manifest = {
  readonly chainId?: number;
  readonly deploymentId?: string;
  readonly deployer?: string;
  readonly admin?: string;
  /** Deploy only: the optional operator pauser, the zero address when none. */
  readonly pauser0?: string;
  /** The tool's git commit at `compute` (stampToolCommit); null when the tool is not a git checkout. */
  readonly toolCommit?: string | null;
  readonly address?: Record<string, string>;
};

////////////////////////////////////////////////////////////////////////////////

/**
 * Located from this file's own path, not from the caller's working directory, so the tool can be run
 * from anywhere. main() chdirs to PACKAGE_ROOT before touching forge, because forge resolves script
 * paths, remappings and fs_permissions against the directory holding foundry.toml.
 *
 * Paths are resolved BEFORE that chdir, so they mean what the operator meant: a path typed on the
 * command line is relative to the caller's directory, and a path written in a config file is relative
 * to that file's directory. An operator folder can therefore live anywhere — its config says
 * `"outDir": "out"` and that means the `out` beside it.
 */
export const INVOCATION_DIR = process.cwd();

/** `create2-deploy/`. This file lives in `create2-deploy/ts/`, one level below. */
export const DRAFT_DIR = dirname(import.meta.dirname);
export const PACKAGE_ROOT = dirname(DRAFT_DIR);
/** Relative on purpose: forge resolves script paths against the project root it runs in. */
export const SCRIPT_DIR = 'create2-deploy/script';

/** Baked into every salt. MAJOR_MINOR only — a patch release must not move the addresses. */
export const FHEVM_VERSION = '0.13';
export const CONFIG_PREFIX = `fhevm-config-${FHEVM_VERSION}.0/`;

export const FACTORY = '0x4e59b44847b379578588920cA78FbF26c0B4956C';

/**
 * The factory's runtime code hash.
 *
 * WHY THIS IS A CONSTANT RATHER THAN COMPUTED. Computing it is trivial — checkFactory already does
 * `keccak(eth_getCode(FACTORY))` on the target chain. But deriving the EXPECTED value from the same
 * chain being checked compares a value against itself and can never fail. The gate exists to catch a
 * DIFFERENT contract squatting this address on some chain, and "different" is only meaningful
 * against a reference that did not come from that chain. The nonce path makes the identical argument
 * about a different value in scripts/deploy.sh: "an 'expected' value fetched from the thing under
 * test always matches, which is not a check."
 *
 * NOT Sepolia-specific, despite where it was first read: mainnet, Sepolia, Holesky and base-sepolia
 * all return this, and it is also what anvil pre-deploys locally. The factory is the same deployed
 * bytes everywhere by construction — that is the entire point of a deterministic-deployment proxy.
 *
 * PROVENANCE: read it off mainnet or Sepolia; do not transcribe it from memory or from a
 * blog post": read off mainnet and Sepolia, which agree. Re-verify with
 *
 *     cast keccak "$(cast code 0x4e59b44847b379578588920cA78FbF26c0B4956C --rpc-url <rpc>)"
 *
 * The runtime is the EIP-3860-aware variant, whose leading PUSH32 mask rejects initcode at or above
 * the 49152-byte limit. Shorter bytecode for this address circulates in older write-ups; it is stale,
 * which is exactly why the value must be read rather than recalled.
 */
export const FACTORY_CODEHASH = '0x2fa86add0aed31f33a762c9d88e807c475bd51d0f52bd0955754b2608f7e4989';

/**
 * Testnets only. This is the cleartext stack — FHE is replaced by plaintext and the KMS /
 * coprocessor signer keys derive from the published FHEVM_MNEMONIC at documented HD paths. On a
 * testnet that is the POINT: the js-sdk relayer must hold those keys for cleartext decryption to
 * work. On mainnet it is total compromise.
 *
 * This list binds OUR tooling and nobody
 * else's — the address set is replayable onto mainnet by anyone, and no allow-list here can stop it.
 *
 * The list lives in `create2-deploy/create2-deploy.config.json`, committed, so adding a testnet is a
 * reviewed one-line diff rather than a code change. KNOWN_MAINNET_CHAIN_IDS stays in code on purpose:
 * it is the backstop that keeps an edit to that file from opening a mainnet.
 */
export const CHAINS_CONFIG_PATH = join(DRAFT_DIR, 'create2-deploy.config.json');

export type AllowedChain = { readonly chainId: string; readonly name: string };

/** Refused even when listed in create2-deploy.config.json. Not exhaustive: a backstop, not the rule. */
export const KNOWN_MAINNET_CHAIN_IDS: readonly string[] = [
  '1', // Ethereum
  '10', // OP Mainnet
  '56', // BNB Smart Chain
  '79', // Zenith mainnet
  '100', // Gnosis
  '137', // Polygon PoS
  '324', // zkSync Era
  '8453', // Base
  '42161', // Arbitrum One
  '42170', // Arbitrum Nova
  '43114', // Avalanche C-Chain
  '59144', // Linea
  '534352', // Scroll
];

/** Read and validate the allow-list. Any problem with the file is fatal: an unreadable list allows nothing. */
export function loadAllowedChains(): readonly AllowedChain[] {
  const path = CHAINS_CONFIG_PATH;
  if (!existsSync(path)) fail(`Error: no chain allow-list at ${path}.`);
  let raw: unknown;
  try {
    raw = readJson<unknown>(path);
  } catch {
    fail(`Error: ${path} is not valid JSON.`);
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) fail(`Error: ${path} is not a JSON object.`);
  const obj = raw as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (key !== '//' && key !== 'allowedChains') fail(`Error: unknown key '${key}' in ${path}.`);
  }
  if (!Array.isArray(obj.allowedChains) || obj.allowedChains.length === 0) {
    fail(`Error: ${path} needs a non-empty "allowedChains" array.`);
  }

  const chains = obj.allowedChains.map((entry: unknown, i: number): AllowedChain => {
    const e = (typeof entry === 'object' && entry !== null ? entry : {}) as Record<string, unknown>;
    if (typeof e.chainId !== 'number' || !Number.isSafeInteger(e.chainId) || e.chainId <= 0) {
      fail(`Error: ${path} allowedChains[${String(i)}].chainId must be a positive integer.`);
    }
    if (typeof e.name !== 'string' || e.name === '') {
      fail(`Error: ${path} allowedChains[${String(i)}].name must be a non-empty string.`);
    }
    const chainId = String(e.chainId);
    if (KNOWN_MAINNET_CHAIN_IDS.includes(chainId)) {
      fail(
        `Error: ${path} lists chain ${chainId} (${e.name}), which is a MAINNET.`,
        "       The cleartext stack's signer keys come from a published mnemonic; on a mainnet anyone",
        '       can sign for it. Remove the entry.',
      );
    }
    return { chainId, name: e.name };
  });

  const ids = chains.map((c) => c.chainId);
  if (new Set(ids).size !== ids.length) fail(`Error: ${path} lists a chain id twice.`);
  return chains;
}

/** Where the default `.out` dir lives, when neither --out-dir nor a config file names one. */
export const FS_ROOT = DRAFT_DIR;

////////////////////////////////////////////////////////////////////////////////

export const CONFIG_KEYS: readonly string[] = [
  'rpcUrl',
  'account',
  'admin',
  'deploymentId',
  'pauser',
  'adminAccount',
  'confirmations',
  'outDir',
  'finality',
  'git',
  'existing',
  'migration',
  'previousAbiDir',
  'previousManifest',
  'handles',
];

/** Rejected in a config file by name, so the message can say where they belong instead. */
export const CLI_ONLY_KEYS: readonly string[] = [
  'stage',
  'dryRun',
  'minBlock',
  'noConfirm',
  'report',
  'noBuild',
  'verbose',
];

////////////////////////////////////////////////////////////////////////////////

export const HOST_ROLES: readonly string[] = [
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
];

/** Widest role name is IMPL_CLEARTEXT_ARITHMETIC_ADDRESS, at 34. */
export const ROLE_WIDTH = 34;

/** Width of the rule under a report step's header. Sized to the block+status+hash columns. */
export const RULE_WIDTH = 92;

/**
 * The steps a report accounts for, in run order, keyed by the label each stage tags its journal
 * entries with. `compute` is absent because it sends nothing — its evidence is the manifest.
 */

////////////////////////////////////////////////////////////////////////////////

export const ANVIL_MNEMONIC = 'test test test test test test test test test test test junk';

/** Account 0 deploys; account 1 is the admin that takes root in step F. Matches anvil-config.json. */
export const ANVIL_DEPLOYER_INDEX = 0;
export const ANVIL_ADMIN_INDEX = 1;

/**
 * The nine addresses of a stack that ALREADY EXISTS, supplied by the operator.
 *
 * Only the upgrade uses this; a deploy derives every address it needs. Keyed by the role names the
 * manifest and the generated `addresses.sol` use, so a value read here can be written straight out
 * without a second naming convention to keep in step.
 *
 * Never REQUIRED to come from a previous manifest: a stack may have been deployed by the nonce path, by
 * an older revision, or by someone else, and a tool that only upgrades what it deployed itself is
 * unusable exactly when it matters. `--previous-manifest` is therefore a seed and not a source — it
 * fills these in when one exists, and loses to both the config file and the flags.
 *
 * However they arrive, a typo bakes into the new implementations, which is why every entry is validated
 * against the live chain before anything is computed.
 */
export type ExistingAddresses = Readonly<Record<string, string>>;

/**
 * A previous generation's sealed manifest, read and cross-checked.
 *
 * `deployer` and `admin` are carried for the banner only. Asserting them would be wrong: ownership can
 * legitimately have moved through the offer/accept path since the deploy, and the upgrade's own verify
 * is what establishes who owns the stack now.
 */
export type PreviousManifest = {
  readonly path: string;
  readonly chainId: number;
  readonly deploymentId: string;
  readonly deployer: string | null;
  readonly admin: string | null;
  /** Only the EXISTING_ROLES keys. A deploy manifest also names roles an upgrade must not be given. */
  readonly address: ExistingAddresses;
};

/** The role names an upgrade must be given, in the order the help and the banner list them. */
export const EXISTING_ROLES: readonly string[] = [
  'ACL_ADDRESS',
  'FHEVM_EXECUTOR_ADDRESS',
  'KMS_VERIFIER_ADDRESS',
  'INPUT_VERIFIER_ADDRESS',
  'HCU_LIMIT_ADDRESS',
  'CLEARTEXT_ARITHMETIC_ADDRESS',
  'CLEARTEXT_DB_ADDRESS',
  'PAUSER_SET_ADDRESS',
  'ACL_OWNER',
];

/** `--acl` -> `ACL_ADDRESS`. The CLI spelling of each role above. */
export const EXISTING_FLAGS: Readonly<Record<string, string>> = {
  '--acl': 'ACL_ADDRESS',
  '--fhevm-executor': 'FHEVM_EXECUTOR_ADDRESS',
  '--kms-verifier': 'KMS_VERIFIER_ADDRESS',
  '--input-verifier': 'INPUT_VERIFIER_ADDRESS',
  '--hcu-limit': 'HCU_LIMIT_ADDRESS',
  '--cleartext-arithmetic': 'CLEARTEXT_ARITHMETIC_ADDRESS',
  '--cleartext-db': 'CLEARTEXT_DB_ADDRESS',
  '--pauser-set': 'PAUSER_SET_ADDRESS',
  '--acl-owner': 'ACL_OWNER',
};

/** `ACL_ADDRESS` -> `--acl`. The reverse of EXISTING_FLAGS, for messages that name what to pass. */
export function existingFlagFor(role: string): string {
  return Object.entries(EXISTING_FLAGS).find(([, r]) => r === role)?.[0] ?? `--${role.toLowerCase()}`;
}

/**
 * Read a previous generation's manifest, and refuse one that is not this deployment's.
 *
 * A manifest from a different stack names addresses that are all real and all wrong, and they get baked
 * into the new implementations' creation code — the one failure mode this flag adds over typing the nine
 * flags. It is also the one a manifest can answer about itself, so deploymentId is checked here, before
 * anything touches a node. The chain half is checkPreviousManifest, which needs one.
 *
 * Missing roles are NOT an error: the config file and the flags layer over this, and validateExisting is
 * what decides whether the nine ended up complete.
 */
export function loadPreviousManifest(path: string, deploymentId: string): PreviousManifest {
  if (!existsSync(path)) fail(`Error: no manifest at ${path} (--previous-manifest).`);
  const raw = readJson<Manifest>(path);
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    fail(`Error: ${path} is not a JSON object (--previous-manifest).`);
  }

  if (typeof raw.chainId !== 'number' || typeof raw.deploymentId !== 'string' || raw.deploymentId === '') {
    fail(
      `Error: ${path} is missing chainId or deploymentId.`,
      '       Both are what make a manifest checkable rather than merely readable, so a file without',
      '       them is not accepted as one. Pass the nine addresses as flags instead.',
    );
  }

  if (raw.deploymentId !== deploymentId) {
    fail(
      'Error: --previous-manifest is not this deployment.',
      `         manifest deploymentId  ${raw.deploymentId}`,
      `         --deployment-id        ${deploymentId}`,
      '',
      '       A manifest from a different stack names nine live addresses that are all real and all',
      '       wrong. Point at the deploy that produced the stack you are upgrading.',
    );
  }

  const address: Record<string, string> = {};
  for (const role of EXISTING_ROLES) {
    const value = raw.address?.[role];
    if (value === undefined || value === '') continue;
    if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
      fail(`Error: ${path} has a malformed ${role}: ${value}`);
    }
    address[role] = value;
  }

  return {
    path,
    chainId: raw.chainId,
    deploymentId: raw.deploymentId,
    deployer: raw.deployer ?? null,
    admin: raw.admin ?? null,
    address,
  };
}

/**
 * How a stage signs: a forge keystore account, or an index into the public anvil mnemonic.
 *
 * A tagged union rather than a nullable account name because the two produce DIFFERENT forge flags,
 * and because it puts the anvil-only restriction in one place — `resolveSigner` is the only thing that
 * can mint the `anvil` variant, and it refuses unless the node answers `anvil_nodeInfo`.
 */
export type Signer =
  { readonly kind: 'keystore'; readonly account: string } | { readonly kind: 'anvil'; readonly index: number };

/**
 * Flags for `forge script`. Note the PLURAL names: forge takes `--mnemonics` / `--mnemonic-indexes`,
 * while `cast wallet` takes the singular `--mnemonic` / `--mnemonic-index`. They are not interchangeable,
 * and passing the wrong pair fails with an unhelpful clap error.
 */
export function forgeSignerArgs(signer: Signer): string[] {
  return signer.kind === 'keystore'
    ? ['--account', signer.account]
    : ['--mnemonics', ANVIL_MNEMONIC, '--mnemonic-indexes', String(signer.index)];
}

/** Flags for `cast wallet address` — the singular spellings. */
export function castSignerArgs(signer: Signer): string[] {
  return signer.kind === 'keystore'
    ? ['--account', signer.account]
    : ['--mnemonic', ANVIL_MNEMONIC, '--mnemonic-index', String(signer.index)];
}

export function signerAddress(signer: Signer): string {
  return captureOrFail('cast', ['wallet', 'address', ...castSignerArgs(signer)]);
}

export function describeSigner(signer: Signer): string {
  return signer.kind === 'keystore' ? `keystore '${signer.account}'` : `anvil account ${String(signer.index)}`;
}

/**
 * Is this RPC an anvil?
 *
 * `anvil_nodeInfo` is the discriminator: anvil answers it, and every other node returns JSON-RPC
 * -32601 "Method not found". Chain id is NOT used — anvil happily runs with any chain id (`--chain-id`,
 * or a fork inheriting the upstream one), so 31337 both misses forked anvils and could be spoofed by a
 * private chain configured to claim it.
 */
export function isAnvil(rpcUrl: string): boolean {
  return capture('cast', ['rpc', 'anvil_nodeInfo', '--rpc-url', rpcUrl]).ok;
}

export function rejectRawPrivateKey(flag: string, value: string): void {
  if (!/^(0x)?[0-9a-fA-F]{64}$/.test(value)) return;
  fail(
    `Error: ${flag} takes a forge KEYSTORE NAME, not a private key.`,
    '       (The value looks like one, so it is not being echoed here. If it is a real key,',
    '        treat it as compromised — it may already be in your shell history.)',
    '',
    '       Import it once, then pass the name:',
    '         cast wallet import my-deployer --interactive',
    `         ${flag} my-deployer`,
  );
}

////////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////////////

export function parseCliArgs(flow: Flow, argv: readonly string[]): CliArgs {
  const cli: CliArgs = {
    configPath: null,
    rpcUrl: null,
    account: null,
    admin: null,
    deploymentId: null,
    pauser: null,
    adminAccount: null,
    confirmations: null,
    outDirArg: null,
    useFinality: null,
    minBlockOverride: null,
    stage: null,
    dryRun: false,
    noConfirm: false,
    requireGitSeal: null,
    noBuild: false,
    verbose: false,
    existing: {},
    migrationPath: null,
    previousAbiDir: null,
    previousManifestPath: null,
    handles: [],
  };

  const need = (i: number, flag: string): string => {
    const v = argv[i + 1];
    if (v === undefined) fail(`Error: ${flag} requires a value.`);
    return v;
  };

  for (let i = 0; i < argv.length; i++) {
    // argv[i] is `string | undefined` under noUncheckedIndexedAccess, and the loop bound makes it
    // never actually undefined — but the switch has to say so rather than assert it.
    const a = argv[i] ?? '';
    switch (a) {
      case '--config':
        cli.configPath = need(i, a);
        i++;
        break;
      case '--rpc-url':
        cli.rpcUrl = need(i, a);
        i++;
        break;
      case '--account':
        cli.account = need(i, a);
        i++;
        break;
      case '--admin':
        cli.admin = need(i, a);
        i++;
        break;
      case '--deployment-id':
        cli.deploymentId = need(i, a);
        i++;
        break;
      case '--pauser':
        cli.pauser = need(i, a);
        i++;
        break;
      case '--admin-account':
        cli.adminAccount = need(i, a);
        i++;
        break;
      case '--confirmations':
        cli.confirmations = Number(need(i, a));
        i++;
        break;
      case '--min-block':
        cli.minBlockOverride = Number(need(i, a));
        i++;
        break;
      case '--out-dir':
        cli.outDirArg = need(i, a);
        i++;
        break;
      case '--stage':
        cli.stage = need(i, a);
        i++;
        break;
      case '--report':
        cli.stage = 'report';
        break;
      case '--dry-run':
        cli.dryRun = true;
        break;
      case '--no-finality':
        cli.useFinality = false;
        break;
      case '--no-confirm':
        cli.noConfirm = true;
        break;
      case '--no-git':
        cli.requireGitSeal = false;
        break;
      case '--no-build':
        cli.noBuild = true;
        break;
      case '-v':
      case '--verbose':
        cli.verbose = true;
        break;
      case '--migration':
        cli.migrationPath = need(i, a);
        i += 1;
        break;
      case '--previous-abi-dir':
        cli.previousAbiDir = need(i, a);
        i += 1;
        break;
      case '--previous-manifest':
        cli.previousManifestPath = need(i, a);
        i += 1;
        break;
      case '--handle':
        // Repeatable rather than comma-separated: a handle is 66 characters and a missed comma would
        // produce one unusable value instead of an error.
        cli.handles.push(need(i, a));
        i += 1;
        break;
      case '-h':
      case '--help':
        say(flow.help);
        process.exit(0);
      // The --help case above ends in `process.exit`, which is `never` — but the rule cannot see that,
      // and `allowUnreachableCode: false` forbids adding the `break` that would otherwise silence it.
      // The directive has to be the line immediately before `default`, or it applies to a comment.
      // eslint-disable-next-line no-fallthrough
      default: {
        // The nine `existing` address flags, from one table rather than nine cases.
        const role = EXISTING_FLAGS[a];
        if (role !== undefined) {
          cli.existing[role] = need(i, a);
          i += 1;
          break;
        }
        fail(`Error: unknown argument '${a}'. Try --help.`);
      }
    }
  }
  return cli;
}

////////////////////////////////////////////////////////////////////////////////

/**
 * Load the JSON config, if there is one.
 *
 * A deployment spans many invocations, and retyping five identity flags every time is how they drift
 * — which is the whole reason preflight has to check them against the seal. A config file removes
 * the retyping, so the drift it guards against becomes much less likely in the first place.
 *
 * It holds only the STABLE half of the arguments: what this deployment IS. The per-invocation half —
 * which stage to run, whether to dry-run, the reorg floor for one manual step — stays on the command
 * line, and is rejected here with a pointer rather than silently accepted. A config that pinned
 * `stage: "all"` would turn every invocation into a full deploy.
 *
 * Unknown keys are rejected too. A typo in `deploymentId` would otherwise surface as "missing
 * required argument" three functions later, or worse, silently select a different address set.
 */

////////////////////////////////////////////////////////////////////////////////

export function loadConfigFile(
  flow: Flow,
  explicitPath: string | null,
): { readonly cfg: ConfigFile; readonly path: string | null } {
  // Without --config, the conventional name in the CURRENT directory, and nowhere else: an operator runs
  // the CLI from their deployment folder. Falling back to a second location would silently pick up a
  // different deployment's config whenever someone forgot to cd.
  const path = explicitPath ?? join(INVOCATION_DIR, flow.defaultConfigName);

  if (!existsSync(path)) {
    // An explicit --config that is not there is an error; the conventional path simply not existing
    // is the normal case for someone passing everything on the command line.
    if (explicitPath !== null) fail(`Error: no config file at ${path}`);
    return { cfg: {}, path: null };
  }

  const cfg = readJson<Record<string, unknown>>(path);
  if (cfg === null || typeof cfg !== 'object' || Array.isArray(cfg)) {
    fail(`Error: ${path} is not a JSON object.`);
  }

  for (const key of Object.keys(cfg)) {
    if (CONFIG_KEYS.includes(key)) continue;
    if (CLI_ONLY_KEYS.includes(key)) {
      fail(
        `Error: '${key}' is not allowed in ${path}.`,
        '       The config file holds what this deployment IS, not what one invocation DOES.',
        `       Pass --${key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())} on the command line.`,
      );
    }
    fail(`Error: unknown key '${key}' in ${path}.`, `       allowed: ${CONFIG_KEYS.join(', ')}`);
  }

  return { cfg: cfg, path };
}

////////////////////////////////////////////////////////////////////////////////

/**
 * Merge the config file under the command line, then validate.
 *
 * PRECEDENCE: an explicit flag always wins. That is what makes a config file safe to keep around —
 * `--stage creates --dry-run` against a pinned deployment needs no other arguments, and a one-off
 * `--rpc-url` override does not require editing the file.
 */

////////////////////////////////////////////////////////////////////////////////

export function resolveOptions(flow: Flow, cli: CliArgs, cfg: ConfigFile, configPath: string | null): Options {
  const stage: Stage = cli.stage ?? 'all';
  if (!flow.stages.includes(stage)) {
    fail(`Error: unknown --stage '${stage}'.`, `       one of: ${flow.stages.join(', ')}`);
  }

  const rpcUrl = cli.rpcUrl ?? cfg.rpcUrl ?? '';
  const account = cli.account ?? cfg.account ?? '';
  let admin = cli.admin ?? cfg.admin ?? '';
  const deploymentId = cli.deploymentId ?? cfg.deploymentId ?? '';
  const adminAccount = cli.adminAccount ?? cfg.adminAccount ?? null;

  const missing = (flag: string, key: string): string =>
    configPath === null
      ? `Error: ${flag} is required (or put "${key}" in a config file - see --help).`
      : `Error: ${flag} is required, and "${key}" is not in ${configPath}.`;

  if (rpcUrl === '') fail(missing('--rpc-url', 'rpcUrl'));

  // Before the value reaches `cast`, which would print it in its own error.
  if (account !== '') rejectRawPrivateKey('--account', account);
  if (adminAccount !== null) rejectRawPrivateKey('--admin-account', adminAccount);

  // --account is optional in exactly one case: a local anvil, where the funded accounts come from a
  // mnemonic that is public knowledge. Anywhere else it stays mandatory —
  // the deployer key owns ACLOwner until step F, so a testnet run must not accept an unprotected key.
  //
  // The probe runs only when the operator has actually omitted --account, so an unreachable node
  // cannot break the flows that supplied one. Read-only stages sign nothing and skip it entirely.
  let signer: Signer | null = null;
  if (account !== '') {
    signer = { kind: 'keystore', account };
  } else if (flow.needsDeployerKey(stage)) {
    if (!isAnvil(rpcUrl)) {
      fail(
        missing('--account', 'account'),
        '',
        `       ${rpcUrl} did not answer anvil_nodeInfo, so it is not an anvil. The keystore-free`,
        '       default exists only for a local anvil rehearsal, whose funded accounts come from a',
        '       PUBLIC mnemonic. On any other chain the deployer key owns ACLOwner until step F',
        '       completes, so it has to be a keystore:',
        '',
        '         cast wallet import my-deployer --interactive',
        '         --account my-deployer',
      );
    }
    signer = { kind: 'anvil', index: ANVIL_DEPLOYER_INDEX };
  } else if (flow.needsChain(stage) && isAnvil(rpcUrl)) {
    // Preserve the unattended local rehearsal for stages sent by anvil's admin account, without
    // turning a read-only or external-admin stage on a real chain into a deployer-key requirement.
    signer = { kind: 'anvil', index: ANVIL_DEPLOYER_INDEX };
  }

  // Step F is sent by the admin. With a keystore that is --admin-account; on anvil it is simply the
  // next account, so the rehearsal completes unattended instead of stopping to poll for a transaction
  // no one is going to send.
  const adminSigner: Signer | null =
    adminAccount !== null
      ? { kind: 'keystore', account: adminAccount }
      : signer?.kind === 'anvil'
        ? { kind: 'anvil', index: ANVIL_ADMIN_INDEX }
        : null;

  // --admin is an ADDRESS. When it is not given but an admin signer is — `--admin-account`, or the anvil
  // default — it is read off that signer: the only value that could pass checkAdminAccount anyway. A
  // keystore costs its password here, which is why checkAdminAccount then skips the comparison rather
  // than asking a second time. A multisig admin has no signer, so there it stays mandatory.
  //
  // Only for stages that reach the chain: `log` and `report` read local files and never use the admin,
  // so they must not unlock a keystore just to compute it.
  let adminDerived = false;
  if (admin === '' && adminSigner !== null && flow.needsChain(stage)) {
    admin = signerAddress(adminSigner);
    adminDerived = true;
  }
  if (admin === '' && flow.needsChain(stage)) fail(missing('--admin', 'admin'));
  if (deploymentId === '') fail(missing('--deployment-id', 'deploymentId'));

  // A path typed on the command line is relative to the caller's directory; a path written in a config
  // file is relative to that FILE's directory, so an operator folder works wherever it is and whatever
  // directory the command is run from. Resolved here, before main() chdirs to the package root.
  const configDir = configPath === null ? INVOCATION_DIR : dirname(resolve(configPath));
  const pathOption = (fromCli: string | null, fromConfig: string | undefined): string | null =>
    fromCli !== null ? resolve(fromCli) : fromConfig !== undefined ? resolve(configDir, fromConfig) : null;

  // The live stack, lowest layer first: a previous manifest, then the config file, then the flags.
  // A flag someone typed must never lose to a file, and the manifest is a convenience over typing nine
  // of them — so it sits at the bottom. existingSource records which layer won each role, because a
  // sealed address is only auditable if the seal says where it came from.
  const previousManifestPath = pathOption(cli.previousManifestPath, cfg.previousManifest);
  const previousManifest =
    previousManifestPath === null ? null : loadPreviousManifest(previousManifestPath, deploymentId);

  const existing: Record<string, string> = {};
  const existingSource: Record<string, string> = {};
  const layer = (source: (role: string) => string, addresses: Readonly<Record<string, string>>): void => {
    for (const [role, address] of Object.entries(addresses)) {
      if (address === '') continue;
      existing[role] = address;
      existingSource[role] = source(role);
    }
  };
  layer(() => 'manifest', previousManifest?.address ?? {});
  layer(() => 'config', cfg.existing ?? {});
  layer(existingFlagFor, cli.existing);

  // A dry run of `all` would be theater: nothing is sent, so stage 2 simulates against a chain where
  // stage 1 never happened, and every later stage reports blocked on a precondition a real run would
  // have satisfied.
  if (cli.dryRun && stage === 'all') {
    fail(
      "Error: --dry-run needs a specific --stage. Simulating 'all' would report every stage",
      '       after the first as blocked, because a dry run sends nothing.',
    );
  }

  return {
    rpcUrl,
    account,
    signer,
    adminSigner,
    admin,
    adminDerived,
    deploymentId,
    adminAccount,
    pauser: cli.pauser ?? cfg.pauser ?? null,
    confirmations: cli.confirmations ?? cfg.confirmations ?? 3,
    minBlockOverride: cli.minBlockOverride,
    outDirArg: pathOption(cli.outDirArg, cfg.outDir),
    stage,
    dryRun: cli.dryRun,
    useFinality: cli.useFinality ?? cfg.finality ?? true,
    noConfirm: cli.noConfirm,
    requireGitSeal: cli.requireGitSeal ?? cfg.git ?? true,
    noBuild: cli.noBuild,
    verbose: cli.verbose,
    configPath,

    // Upgrade inputs. Empty for a deploy, which derives every address it needs.
    existing,
    existingSource,
    previousManifest,
    migrationPath: pathOption(cli.migrationPath, cfg.migration),
    previousAbiDir: pathOption(cli.previousAbiDir, cfg.previousAbiDir),
    handles: cli.handles.length > 0 ? cli.handles : (cfg.handles ?? []),
  };
}

////////////////////////////////////////////////////////////////////////////////

/**
 * Resolve the out dir: anywhere on disk, so an operator keeps a deployment in a folder of their own
 * rather than inside this repository. `outDirArg` is already absolute (see resolveOptions); null is
 * the developer default, `create2-deploy/.out`.
 *
 * Forge writes there through a generated config (prepareForgeConfig), not through foundry.toml. The one
 * thing refused is an out dir that CONTAINS the package: forge would be granted write access to the
 * whole source tree, and `compute` clears paths inside the out dir.
 */
export function resolveOutDir(outDirArg: string | null): string {
  const outDir = outDirArg ?? join(FS_ROOT, '.out');
  if (isInside(PACKAGE_ROOT, outDir)) {
    fail(
      `Error: the out dir ${outDir} contains the package at ${PACKAGE_ROOT}.`,
      '       Use a dedicated folder for each deployment, e.g. --out-dir ~/fhevm-deployments/arbsepolia/out',
    );
  }
  return outDir;
}

/**
 * Let forge write to the out dir, wherever it is, WITHOUT editing the repository's foundry.toml.
 *
 * `fs_permissions` is static config and forge ignores it in the environment, so this writes a complete
 * config of its own: forge's own fully resolved one (`forge config`, which also flattens the `extends`
 * chain — forge refuses nested `extends`), plus the out dir in `fs_permissions` and in `allow_paths`
 * (solc must be allowed to import the generated addresses.sol from there). Every forge call then gets
 * `--root <package> --config-path <it>`.
 *
 * Every path in it is written ABSOLUTE, resolved against the package root. Forge resolves the relative
 * paths of a `--config-path` file against that file's directory, not against `--root` — so a relative
 * `libs` or remapping would point into the out dir, and solc would find nothing. Absolute paths are what
 * forge computes internally from the original file anyway.
 *
 * The generated file must change NOTHING else, because every CREATE2 address is a hash of the compiled
 * bytecode. So it is not trusted: both configs are resolved again, every path made absolute the same
 * way, and compared — everything but the two permission fields. Any difference stops the run before a
 * single build.
 */
export function prepareForgeConfig(ctx: Ctx): void {
  const dir = join(ctx.outDir, '.foundry');
  const path = join(dir, 'foundry.toml');
  const quoted = JSON.stringify(ctx.outDir);

  const dumped = captureOrFail('forge', ['config', '--root', PACKAGE_ROOT]);
  // Only [profile.default] and its subtables are rewritten: [fmt], [doc] and the rest have keys of the
  // same names (`out`, ...) that mean something else.
  const sectionEnd = dumped.search(/^\[(?!\[?profile\.default[\].])/m);
  const head = sectionEnd < 0 ? dumped : dumped.slice(0, sectionEnd);
  const tail = sectionEnd < 0 ? '' : dumped.slice(sectionEnd);

  let profile = head.replace(
    new RegExp(`^(${FORGE_PATH_KEYS.join('|')}) = "(.*)"$`, 'gm'),
    (_m, key: string, value: string) => `${key} = ${JSON.stringify(absolutePath(value))}`,
  );
  profile = profile.replace(/^(libs|remappings) = \[([\s\S]*?)\]$/gm, (_m, key: string, body: string) => {
    const entries = [...body.matchAll(/"([^"]*)"/g)].map((m) => m[1] ?? '');
    const absolute = entries.map((entry) => (key === 'libs' ? absolutePath(entry) : absoluteRemapping(entry)));
    return `${key} = [${absolute.map((entry) => JSON.stringify(entry)).join(', ')}]`;
  });

  const allowPaths = /^allow_paths = \[(.*)\]$/m;
  const inner = allowPaths.exec(profile)?.[1];
  if (inner === undefined) fail('Error: `forge config` printed no single-line allow_paths; cannot extend it.');
  profile = profile.replace(allowPaths, `allow_paths = [${inner.trim() === '' ? quoted : `${inner}, ${quoted}`}]`);

  const toml = `${profile}${tail}\n\n[[profile.default.fs_permissions]]\naccess = true\npath = ${quoted}\n`;
  ensureDir(dir);
  writeFileSync(path, toml);

  const resolved = (args: readonly string[]): Record<string, unknown> =>
    normalizeForgePaths(
      JSON.parse(captureOrFail('forge', ['config', '--json', '--root', PACKAGE_ROOT, ...args])) as Record<
        string,
        unknown
      >,
    );
  const want = resolved([]);
  const got = resolved(['--config-path', path]);

  const differing = [...new Set([...Object.keys(want), ...Object.keys(got)])].filter(
    (key) => key !== 'fs_permissions' && key !== 'allow_paths' && stableJson(want[key]) !== stableJson(got[key]),
  );
  if (differing.length > 0) {
    fail(
      `Error: the generated forge config ${path} changes more than the out dir permission:`,
      ...differing.map((key) => `         ${key}`),
      '       Every address depends on the compiled bytecode, so nothing else may differ.',
    );
  }
  const granted = JSON.stringify(got.fs_permissions ?? []).includes(quoted.slice(1, -1));
  if (!granted) fail(`Error: the generated forge config ${path} does not grant write access to ${ctx.outDir}.`);

  ctx.forgeArgs = ['--root', PACKAGE_ROOT, '--config-path', path];
}

/** The single-path keys of a forge profile. `libs` and `remappings` are handled as lists. */
const FORGE_PATH_KEYS: readonly string[] = [
  'src',
  'test',
  'script',
  'out',
  'cache_path',
  'snapshots',
  'broadcast',
  'test_failures_file',
];

/** A forge path, absolute, resolved the way forge resolves the repository's own foundry.toml. */
function absolutePath(value: string): string {
  return resolve(PACKAGE_ROOT, value);
}

/** `[context:]prefix=target` with the target made absolute, keeping its trailing slash. */
function absoluteRemapping(remapping: string): string {
  const eq = remapping.indexOf('=');
  if (eq < 0) return remapping;
  const target = remapping.slice(eq + 1);
  const slash = target.endsWith('/') ? '/' : '';
  return `${remapping.slice(0, eq + 1)}${absolutePath(target)}${slash}`;
}

/** The same rewriting, applied to `forge config --json` output, so two configs compare by MEANING. */
function normalizeForgePaths(config: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...config };
  for (const key of FORGE_PATH_KEYS) {
    const value = out[key];
    if (typeof value === 'string') out[key] = absolutePath(value);
  }
  if (Array.isArray(out.libs)) out.libs = out.libs.map((v: unknown) => (typeof v === 'string' ? absolutePath(v) : v));
  if (Array.isArray(out.remappings)) {
    out.remappings = out.remappings.map((v: unknown) => (typeof v === 'string' ? absoluteRemapping(v) : v));
  }
  return out;
}

/** JSON with object keys sorted, so two equal configs always serialize to the same string. */
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableJson(obj[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

////////////////////////////////////////////////////////////////////////////////

/**
 * Does this stage touch the network?
 *
 * `log` and `report` read the journal and nothing else, so they must work with no RPC, no keystore
 * and no foundry installed — which is exactly when you want them: reading back what happened from a
 * machine that cannot reach the chain, or after the deployer key has been put away.
 */

////////////////////////////////////////////////////////////////////////////////

export function buildContext(flow: Flow, opt: Options): Ctx {
  const outDir = resolveOutDir(opt.outDirArg);

  // The deployer key owns ACLOwner — root over the stack — until step F completes. Keystore
  // only. A raw private key is accepted by scripts/deploy.sh for 31337 and is NOT accepted here.
  // "Testnet" is not "throwaway": these stacks are what the js-sdk integration story runs against.
  //
  // Read-only stages take the deployer off the manifest instead, and so never unlock anything. That
  // does make checkOutDirIdentity's deployer comparison vacuous for them — which is the point: that
  // check guards stages that SEND, and there is nothing to protect when nothing is sent.
  let deployer = '';
  if (!flow.needsDeployerKey(opt.stage)) {
    deployer = readJson<Manifest>(join(outDir, 'manifest.json'))?.deployer ?? '';
  }
  if (deployer === '' && flow.needsChain(opt.stage)) {
    deployer = opt.signer === null ? '' : signerAddress(opt.signer);
  }

  return {
    flow,
    opt,
    outDir,
    buildOut: join(outDir, 'build'),
    broadcastDir: join(outDir, 'broadcast'),
    journalPath: join(outDir, 'journal.jsonl'),
    deployer,
    chainId: '',
    useFinality: opt.useFinality,
    nextMinBlock: 0,
    finalityTarget: 0,
    stageLabel: '',
    forgeArgs: [],
  };
}

////////////////////////////////////////////////////////////////////////////////

export function manifestPath(ctx: Ctx): string {
  return join(ctx.outDir, 'manifest.json');
}

/** `compute`'s pass-to-pass scratch file. Read only by the next compute pass, never by a later stage. */
export function scratchPath(ctx: Ctx): string {
  return join(ctx.outDir, 'pass2.json');
}

/**
 * Delete `compute`'s scratch file, but ONLY once the seal is complete.
 *
 * The last pass carried everything it needed out of the scratch file into the manifest, so a complete
 * manifest makes it dead weight — and a leftover file next to the seal invites someone to commit it or
 * read it as if it meant something. "Complete" is checked rather than assumed: the manifest parses, its
 * address map is non-empty, every entry is an address, the ACL and ACLOwner are there, and every
 * `requiredKeys` top-level field exists. Anything less keeps the scratch file, because a failed seal is
 * exactly when its intermediate values help to diagnose what went wrong.
 */
export function removeScratchIfSealed(ctx: Ctx, requiredKeys: readonly string[] = []): void {
  if (!isCompleteSeal(ctx, requiredKeys)) {
    warn(`keeping ${scratchPath(ctx)}: ${manifestPath(ctx)} is not a complete seal.`);
    return;
  }
  removeIfPresent(scratchPath(ctx));
}

/**
 * Is `manifest.json` a complete seal? It parses, its address map is non-empty, every entry is an address,
 * the ACL and ACLOwner are there, and every `requiredKeys` top-level field exists.
 *
 * What `--stage all` asks before reusing a seal instead of computing one, and what the scratch cleanup
 * asks before deleting pass2.json — one definition, so the two can never disagree.
 */
export function isCompleteSeal(ctx: Ctx, requiredKeys: readonly string[] = []): boolean {
  let manifest: Record<string, unknown> | null = null;
  try {
    manifest = readJson<Record<string, unknown>>(manifestPath(ctx));
  } catch {
    return false;
  }
  if (manifest === null) return false;
  const address = manifest.address;
  if (address === null || typeof address !== 'object' || Array.isArray(address)) return false;
  const map = address as Record<string, unknown>;
  const values = Object.values(map);
  return (
    values.length > 0 &&
    values.every((a) => typeof a === 'string' && /^0x[0-9a-fA-F]{40}$/.test(a)) &&
    ['ACL_ADDRESS', 'ACL_OWNER'].every((role) => role in map) &&
    requiredKeys.every((key) => key in manifest)
  );
}

/** The tool checkout's git commit, or null when it is not a git checkout. */
export function toolCommit(): string | null {
  const r = capture('git', ['-C', PACKAGE_ROOT, 'rev-parse', 'HEAD']);
  return r.ok && /^[0-9a-f]{40}$/.test(r.stdout) ? r.stdout : null;
}

/**
 * Record the tool's git commit in the seal, so a later run can tell when the checkout has moved.
 *
 * Every address is a hash of bytecode this checkout compiled; another commit can compile other
 * bytecode. `creates` would still catch the drift address by address, but only after a build, and
 * with a message about bytecode rather than about the `git pull` that caused it.
 */
export function stampToolCommit(ctx: Ctx): void {
  const manifest = readJson<Record<string, unknown>>(manifestPath(ctx));
  if (manifest === null) return;
  writeFileSync(manifestPath(ctx), `${JSON.stringify({ ...manifest, toolCommit: toolCommit() }, null, 2)}\n`);
}

////////////////////////////////////////////////////////////////////////////////

/**
 * The environment every forge script in this path reads. No script takes a CLI argument.
 *
 * FHEVM_DEPLOYER is an ADDRESS, not a key: the scripts only predict with it and check it against
 * msg.sender, while forge authenticates via --account/--sender. No script here ever holds a key.
 */
export function scriptEnv(ctx: Ctx, extra?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return {
    FHEVM_VERSION,
    FHEVM_DEPLOYMENT_ID: ctx.opt.deploymentId,
    FHEVM_DEPLOYER: ctx.deployer,
    FHEVM_ADMIN: ctx.opt.admin,
    FHEVM_CONFIRMATIONS: String(ctx.opt.confirmations),
    FHEVM_OUT_DIR: ctx.outDir,
    ...(ctx.opt.pauser !== null && ctx.opt.pauser !== '' ? { FHEVM_PAUSER_0: ctx.opt.pauser } : {}),
    // Redirect forge's own per-run records into the out dir, so a run leaves nothing in the package
    // root and the raw artifacts sit beside the journal distilled from them.
    FOUNDRY_BROADCAST: ctx.broadcastDir,
    ...extra,
  };
}

////////////////////////////////////////////////////////////////////////////////

/**
 * `-vvvv` when --verbose, nothing otherwise.
 *
 * Worth knowing where the traces come from: `forge script` runs the script in its OWN EVM against a
 * fork, fetching state with eth_getCode / eth_getStorageAt and executing locally. A `view` call like
 * ACL.getFHEVMExecutorAddress() therefore never reaches the node as an eth_call, and never appears
 * in anvil's log — it is not a transaction and, mostly, not even a request. forge prints the trace on
 * failure; on success you have to ask.
 */
export function traceArgs(ctx: Ctx): readonly string[] {
  return ctx.opt.verbose ? ['-vvvv'] : [];
}

////////////////////////////////////////////////////////////////////////////////

/**
 * Point the `fhevm-config-X.Y.0/` import prefix at the GENERATED addresses.sol.
 *
 * Every stage after compute's first pass needs this. It is NOT applied globally on purpose: compute
 * pass 1 must build against the committed placeholders, because it is what PRODUCES the generated
 * config, and a global would quietly make pass 1 depend on its own output (or on last run's).
 *
 * Overrides just this one prefix and leaves openzeppelin/forge-std to be discovered as usual, so
 * remappings.txt is never edited and there is no restore-on-failure to get wrong.
 */
export function generatedConfigEnv(ctx: Ctx): NodeJS.ProcessEnv {
  return { FOUNDRY_REMAPPINGS: `${CONFIG_PREFIX}=${ctx.outDir}/` };
}

////////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////////////

export function checkChainAllowed(ctx: Ctx): void {
  const allowed = loadAllowedChains();
  const match = allowed.find((c) => c.chainId === ctx.chainId);
  if (match !== undefined) {
    say(`  chain id ${ctx.chainId} allowed: ${match.name}, listed in ${CHAINS_CONFIG_PATH}`);
    return;
  }

  // An anvil is exempt whatever chain id it reports, and that is not a hole in the rule — it is the
  // rule read properly. What the allow-list protects against is BROADCASTING a stack whose KMS keys
  // come from a published mnemonic onto a network other people use. An anvil is a local sandbox: it
  // reaches nothing, so there is nothing to protect. A plain `anvil` starts on 31337, which is
  // excluded from the list for an unrelated reason (it is the nonce path's chain), and requiring
  // `--chain-id 11155111` just to rehearse was friction with no safety behind it.
  //
  // Keyed on `anvil_nodeInfo` rather than on the chain id, so a private chain that simply claims 31337
  // gets no exemption. A mainnet-FORKED anvil does qualify, and should: it reports chain id 1 while
  // still being a sandbox that sends nothing to mainnet.
  if (isAnvil(ctx.opt.rpcUrl)) {
    say(`  chain id ${ctx.chainId} allowed: the node answers anvil_nodeInfo, so it is a local anvil`);
    return;
  }

  fail(
    `Error: chain id ${ctx.chainId} is not in the testnet allow-list, and ${ctx.opt.rpcUrl} is not an anvil.`,
    '       This stack derives its KMS/coprocessor keys from a PUBLISHED mnemonic, so it may only be',
    `       broadcast to a testnet listed in ${CHAINS_CONFIG_PATH}`,
    `       (${allowed.map((c) => `${c.name} ${c.chainId}`).join(', ')}) or to a local anvil.`,
  );
}

////////////////////////////////////////////////////////////////////////////////

/**
 * Do the arguments of this session match the ones the manifest was sealed with?
 *
 * A deployment spans many invocations, often days apart, and every one of them retypes the whole
 * argument list. The manifest is the record of what the first one decided, so it is also the
 * only thing that can catch the second one from drifting. Four fields, four distinct failures:
 *
 *   wrong chain          --out-dir was not changed when --rpc-url was. The next `compute` would
 *                        reseal over another network's record.
 *   wrong deploymentId   the salts have changed, so this is a DIFFERENT address set that
 *                        happens to be pointed at the same directory. Every read-only stage would
 *                        compute new salts while reading old addresses and report drift on all of them.
 *   wrong deployer       --account points at another key. The deployer is baked into the ACL
 *                        proxy's initcode, so this too is a different address set — but only SOME
 *                        of the 22 move, which is why the symptom is so misleading without this.
 *   wrong admin          moves no address, but silently redirects who ends up with root.
 *
 * In every case the standing stack is unharmed — but its manifest is how it is verified and upgraded
 * for the rest of its life, and overwriting that is the actual loss.
 */
export function checkOutDirIdentity(ctx: Ctx): void {
  const manifest = readJson<Manifest>(manifestPath(ctx));
  if (manifest === null) return;

  if (manifest.chainId !== undefined && String(manifest.chainId) !== ctx.chainId) {
    fail(
      `Error: ${ctx.outDir} holds a manifest sealed for chain ${manifest.chainId}, not ${ctx.chainId}.`,
      `       Use one --out-dir per chain, e.g. --out-dir .out-${ctx.chainId}`,
    );
  }

  if (manifest.deploymentId !== undefined && manifest.deploymentId !== ctx.opt.deploymentId) {
    fail(
      `Error: ${ctx.outDir} belongs to deployment '${manifest.deploymentId}', not '${ctx.opt.deploymentId}'.`,
      '       A different --deployment-id is a different set of salts, so a different',
      '       address set entirely - it needs its own --out-dir.',
      `         --deployment-id ${ctx.opt.deploymentId} --out-dir .out-${ctx.opt.deploymentId}`,
      `       '${manifest.deploymentId}' stays where it is; its stack is untouched and still standing.`,
    );
  }

  // A --account pointed at a different key between sessions. Caught HERE because the failure it
  // otherwise produces is actively misleading: the deployer is baked into the ACL proxy's initcode,
  // so `creates` would stop at ACL_ADDRESS reporting "build drift", blaming the build for what is
  // really a changed key — and only some of them would have moved, since the shared proxies and
  // PauserSet do not reference the deployer at all.
  if (manifest.deployer !== undefined && !sameAddress(manifest.deployer, ctx.deployer)) {
    fail(
      `Error: '${ctx.opt.deploymentId}' was sealed by a different deployer.`,
      `         sealed:            ${manifest.deployer}`,
      `         ${ctx.opt.signer === null ? 'the deployer' : describeSigner(ctx.opt.signer)} resolves to ${ctx.deployer}`,
      '       Every address in this stack derives from the deployer, so this is',
      '       a different address set — not a different way of reaching the same one.',
      '       Use the keystore account that sealed it, or start a new deployment with its own',
      '       --deployment-id and --out-dir.',
    );
  }

  // The admin moves no address, so this is not about the address set — it is about who ends
  // up with root. Step E's predicate is "offered to THIS admin", so a changed --admin would not be
  // seen as already-done: it would offer again, silently redirecting ownership of the whole stack to
  // an address the seal never named.
  if (manifest.admin !== undefined && !sameAddress(manifest.admin, ctx.opt.admin)) {
    fail(
      `Error: '${ctx.opt.deploymentId}' was sealed for a different admin.`,
      `         sealed: ${manifest.admin}`,
      `         --admin ${ctx.opt.admin}`,
      '       Continuing would offer ownership of the ACLOwner - root over the whole stack - to an',
      "       address this deployment's seal never named. Rotating the admin after the run is the",
      "       standing admin's own transferOwnership call, not a re-run with a different --admin.",
    );
  }

  // `compute` itself reseals, so it is the one stage these two must not block: it is how a seal that no
  // longer matches gets replaced, as long as nothing has been sent (it refuses otherwise).
  if (ctx.opt.stage === 'compute') return;

  // The pauser moves no address, but it is who step A' registers — and its predicate is "THIS pauser is
  // registered", so a changed value would quietly register a second one.
  const ZERO = '0x0000000000000000000000000000000000000000';
  if (manifest.pauser0 !== undefined && !sameAddress(manifest.pauser0, ctx.opt.pauser ?? ZERO)) {
    fail(
      `Error: '${ctx.opt.deploymentId}' was sealed with a different pauser.`,
      `         sealed:   ${sameAddress(manifest.pauser0, ZERO) ? '(none)' : manifest.pauser0}`,
      `         --pauser  ${ctx.opt.pauser ?? '(none)'}`,
      '       Restore the sealed value, or reseal with --stage compute if nothing has been sent yet.',
    );
  }

  // The tool moved since the seal. Every address is a hash of the bytecode it compiled.
  const sealedCommit = manifest.toolCommit;
  const currentCommit = toolCommit();
  if (typeof sealedCommit === 'string' && currentCommit !== null && sealedCommit !== currentCommit) {
    const lines = [
      `the tool checkout ${PACKAGE_ROOT} is at ${currentCommit.slice(0, 12)},`,
      `but '${ctx.opt.deploymentId}' was sealed at ${sealedCommit.slice(0, 12)}.`,
      `Check out the sealed commit:  git -C ${PACKAGE_ROOT} checkout ${sealedCommit}`,
      'or, if nothing has been sent yet, reseal with --stage compute and commit the new seal.',
    ];
    const sends =
      ctx.opt.stage === 'all' ||
      ctx.flow.needsDeployerKey(ctx.opt.stage) ||
      ctx.flow.adminSendingStages.includes(ctx.opt.stage);
    // A stage that sends must not run on code the seal was not computed from; a read-only look may.
    if (sends) fail(`Error: ${lines[0] ?? ''}`, ...lines.slice(1).map((line) => `       ${line}`));
    warn(...lines);
  }
}

////////////////////////////////////////////////////////////////////////////////

/**
 * `--admin-account` must resolve to `--admin`.
 *
 * The two are not alternatives and one does not override the other. `--admin` is the ADDRESS that
 * gets root: it is sealed into the manifest, read by every script as FHEVM_ADMIN, and needed at
 * compute time — long before any admin key is involved, and in the multisig case,
 * where no admin keystore exists at all. `--admin-account` is only a signing credential for step F.
 *
 * Checked in preflight rather than inside step F, where it lives conceptually, because step F is the
 * LAST stage: a mismatch would otherwise survive compute, the seal, all creates and steps A-E
 * before surfacing, on a run that may have started days earlier.
 */
export function checkAdminAccount(ctx: Ctx): void {
  // Derived from the signer itself (resolveOptions), so comparing would only compare it with itself.
  if (ctx.opt.adminSigner === null || ctx.opt.adminDerived) return;

  const resolved = signerAddress(ctx.opt.adminSigner);
  if (!sameAddress(resolved, ctx.opt.admin)) {
    fail(
      `Error: the admin signer (${describeSigner(ctx.opt.adminSigner)}) resolves to ${resolved},`,
      `       but --admin is ${ctx.opt.admin}.`,
      '       --admin is the address that gets root and is sealed in the manifest; --admin-account',
      '       only signs step F on its behalf. They have to be the same account.',
    );
  }
}

////////////////////////////////////////////////////////////////////////////////

/**
 * Hard gate. A different contract squatting 0x4e59… on some testnet is the one realistic way
 * a fatal mismatch actually fires, and it would produce addresses nothing was compiled for.
 */
export function checkFactory(ctx: Ctx): void {
  const code = capture('cast', ['code', FACTORY, '--rpc-url', ctx.opt.rpcUrl]);
  if (!code.ok || code.stdout === '0x' || code.stdout === '') {
    fail(
      `Error: no CREATE2 factory at ${FACTORY} on chain ${ctx.chainId}.`,
      '       Fallback is the standard presigned deployment, with two conditions this',
      "       script will not hide: funding goes to the factory's one-time EOA",
      '       0x3fAB184622Dc19b6109349B94811493BF2a45362, not to our deployer; and that',
      '       transaction is PRE-EIP-155 legacy, which some chains reject outright. On such',
      '       a chain the canonical factory can never exist and this path is unavailable.',
    );
  }

  const hash = captureOrFail('cast', ['keccak', code.stdout]);
  if (hash !== FACTORY_CODEHASH) {
    fail(
      `Error: factory runtime code hash mismatch at ${FACTORY}.`,
      `         expected ${FACTORY_CODEHASH}`,
      `         observed ${hash}`,
    );
  }
}

////////////////////////////////////////////////////////////////////////////////

/**
 * Does this chain serve the `finalized` tag?
 *
 * Probed once, rather than discovered mid-run: a chain without it would make waitForBlock loop
 * forever on a query that can never be satisfied. Degrades to the depth floor LOUDLY — silently
 * dropping to a weaker guarantee is the failure mode worth avoiding.
 */
export function probeFinality(ctx: Ctx): string {
  if (!ctx.useFinality) return 'disabled (--no-finality)';

  const r = capture('cast', ['block-number', 'finalized', '--rpc-url', ctx.opt.rpcUrl]);
  if (r.ok && r.stdout !== '') return r.stdout;

  ctx.useFinality = false;
  warn(
    "this chain does not serve the 'finalized' tag.",
    `Falling back to a depth of ${ctx.opt.confirmations} blocks between stages, which is a`,
    'heuristic, not a consensus guarantee.',
  );
  return 'unsupported';
}

////////////////////////////////////////////////////////////////////////////////

/**
 * The half of the --previous-manifest cross-check that needs a chain.
 *
 * loadPreviousManifest already refused a manifest from another deployment; this refuses one from
 * another chain. The id alone cannot catch that: the same deploymentId on a testnet and on mainnet is
 * the NORMAL case, and those two stacks have different addresses.
 */
function checkPreviousManifest(ctx: Ctx): void {
  const previous = ctx.opt.previousManifest;
  if (previous === null) return;

  if (String(previous.chainId) !== ctx.chainId) {
    fail(
      'Error: --previous-manifest was written on a different chain.',
      `         manifest chainId  ${String(previous.chainId)}`,
      `         --rpc-url says    ${ctx.chainId}`,
      '',
      `       ${previous.path}`,
    );
  }
}

/** The --previous-manifest lines of the preflight banner: what it was, and how much of it was used. */
function previousManifestLines(ctx: Ctx): string[] {
  const previous = ctx.opt.previousManifest;
  if (previous === null) return [];
  const supplied = Object.keys(previous.address).length;
  return [
    `  previous         ${previous.path}`,
    `                   chain ${String(previous.chainId)}, id ${previous.deploymentId}, ` +
      `${String(supplied)}/${String(EXISTING_ROLES.length)} roles, sealed by ${previous.deployer ?? '-'}`,
  ];
}

////////////////////////////////////////////////////////////////////////////////

/**
 * Quantified before starting rather than discovered at send time.
 *
 * Deploying via the factory pays initcode as CALLDATA (16 gas per non-zero byte), and the
 * implementations of up to ~24 KB runtime each add materially per create. Faucet-funded deployers
 * run dry mid-run. This prints; measuring a real threshold against a fork is still a gap.
 */
export function preflight(ctx: Ctx): void {
  say('🍖 preflight');

  prepareForgeConfig(ctx);
  ctx.chainId = captureOrFail('cast', ['chain-id', '--rpc-url', ctx.opt.rpcUrl]);
  checkChainAllowed(ctx);
  checkPreviousManifest(ctx);
  checkOutDirIdentity(ctx);
  if (ctx.flow.needsDeployerKey(ctx.opt.stage) || ctx.opt.adminAccount !== null || ctx.opt.stage === 'materialize') {
    checkAdminAccount(ctx);
  }
  checkFactory(ctx);
  reconcileJournal(ctx);

  const finalized = probeFinality(ctx);
  const balanceEth = etherBalance(ctx, ctx.deployer);

  // The admin signs a transaction of its own — step F of a deploy, the atomic upgrade — but only at the
  // END of a run. An empty admin key would surface there, after everything else had been sent and waited
  // for, so it is checked here. Only when this tooling signs for it (a multisig pays its own gas), and
  // only for a stage that actually sends as the admin: a read-only look must not fail on it.
  const adminSigner = ctx.opt.adminSigner;
  const adminBalanceEth = adminSigner === null ? null : etherBalance(ctx, ctx.opt.admin);
  if (adminSigner !== null && adminBalanceEth !== null) {
    const sendsAsAdmin =
      !ctx.opt.dryRun && (ctx.opt.stage === 'all' || ctx.flow.adminSendingStages.includes(ctx.opt.stage));
    if (sendsAsAdmin && /^0(\.0*)?$/.test(adminBalanceEth)) {
      fail(
        `Error: the admin ${ctx.opt.admin} has no ETH on chain ${ctx.chainId}.`,
        `       This run sends a transaction as the admin (${ctx.flow.adminSendingStages.join(', ')}), signed by`,
        `       ${describeSigner(adminSigner)}. Fund it first; nothing has been sent.`,
      );
    }
  }

  say(
    `  chain            ${ctx.chainId}`,
    `  factory          ${FACTORY} (hash pinned, ok)`,
    `  finalized block  ${finalized}`,
    `  deployer         ${ctx.deployer}`,
    `  balance          ${balanceEth} ETH`,
    `  admin            ${ctx.opt.admin}${
      ctx.opt.adminDerived && ctx.opt.adminSigner !== null ? ` (from ${describeSigner(ctx.opt.adminSigner)})` : ''
    }`,
    ...(adminBalanceEth === null ? [] : [`  admin balance    ${adminBalanceEth} ETH`]),
    `  deploymentId     ${ctx.opt.deploymentId} @ v${FHEVM_VERSION}`,
    `  out dir          ${ctx.outDir}`,
    `  config           ${ctx.opt.configPath ?? '(none - all arguments on the command line)'}`,
    ...previousManifestLines(ctx),
    '',
  );
}

/** An account's balance in ether, as `cast to-unit` prints it (e.g. `0`, `1.5`). */
function etherBalance(ctx: Ctx, address: string): string {
  const wei = captureOrFail('cast', ['balance', address, '--rpc-url', ctx.opt.rpcUrl]);
  return captureOrFail('cast', ['to-unit', wei, 'ether']);
}

////////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////////////

export function headBlock(ctx: Ctx): number {
  return Number(captureOrFail('cast', ['block-number', '--rpc-url', ctx.opt.rpcUrl]));
}

////////////////////////////////////////////////////////////////////////////////

export function finalizedBlock(ctx: Ctx): number {
  return Number(captureOrFail('cast', ['block-number', 'finalized', '--rpc-url', ctx.opt.rpcUrl]));
}

////////////////////////////////////////////////////////////////////////////////

/**
 * The newest block this run treats as settled: `finalized` when the chain serves it, otherwise
 * `--confirmations` behind the head. Every chain read that decides something is taken at or before it.
 */
export function settledBlock(ctx: Ctx): number {
  return ctx.useFinality ? finalizedBlock(ctx) : Math.max(0, headBlock(ctx) - ctx.opt.confirmations);
}

/** Does `address` hold code as of `block`? A create is settled when this holds at `settledBlock`. */
export function hasCodeAt(ctx: Ctx, address: string, block: number): boolean {
  const r = capture('cast', ['code', address, '--block', String(block), '--rpc-url', ctx.opt.rpcUrl]);
  return r.ok && r.stdout !== '' && r.stdout !== '0x';
}

////////////////////////////////////////////////////////////////////////////////

/**
 * The reorg gate, shell half.
 *
 * Steps A-F each REQUIRE FHEVM_MIN_BLOCK and refuse to run until the chain has reached it. Every one
 * of them decides what to do by reading state a previous step wrote, so a predicate evaluated one
 * block after the transaction it asks about can be answering from a block about to be orphaned — and
 * these predicates decide whether a step is SKIPPED.
 *
 * Two halves, both needed: this waits so the normal path does not fail; the script refuses so a
 * different orchestrator cannot proceed early just because it did not implement the wait.
 *
 * Depth is a heuristic — ~3 min at 15 blocks vs ~12.8 min to PoS finality — so this waits for the
 * `finalized` tag as well, when the chain serves it. A Solidity script cannot read `finalized`
 * through block.number, which is why the depth floor lives there and the finality wait lives here.
 */
export async function waitForBlock(ctx: Ctx, target: number): Promise<void> {
  // `finalityTarget` is the block the PREVIOUS stage ended in (0 when nothing ran before in this process).
  // Every line names it, so "block X" is never confused with "the chain is at block Y".
  const prev = ctx.finalityTarget;
  let head = headBlock(ctx);
  if (head < target) {
    say(
      prev > 0
        ? `  waiting until block ${target}: the previous stage ended in block ${prev}, and "confirmations" is ${ctx.opt.confirmations} (chain head: ${head})`
        : `  waiting until block ${target} (--min-block; chain head: ${head})`,
    );
    const beat = heartbeat();
    while (head < target) {
      await sleep(4000);
      head = headBlock(ctx);
      if (beat.due()) say(`  … chain head ${head}, ${target - head} block(s) to go (${beat.elapsed()})`);
    }
    say(`  block ${target} reached (chain head: ${head})`);
  }

  if (!ctx.useFinality || prev <= 0) return;

  let fin = finalizedBlock(ctx);
  if (fin < prev) {
    // On an Ethereum testnet finality trails the head by two epochs, ~13 minutes, before EVERY stage: said
    // up front so a long silence is never mistaken for a hang, and repeated once a minute while it lasts.
    say(
      `  waiting for block ${prev}, where the previous stage ended, to be finalized.`,
      `  The chain has finalized up to block ${fin}: ${prev - fin} block(s) to go. This takes ~15 minutes on an`,
      '  Ethereum testnet. Nothing is stuck; Ctrl-C is safe here.',
    );
    const beat = heartbeat();
    while (fin < prev) {
      await sleep(12000);
      fin = finalizedBlock(ctx);
      if (beat.due()) say(`  … finalized up to block ${fin}, ${prev - fin} block(s) to go (${beat.elapsed()})`);
    }
    say(`  block ${prev} is finalized`);
    recordFinality(ctx);
  }
}

////////////////////////////////////////////////////////////////////////////////

/**
 * Refuse to start while `who` has transactions in flight.
 *
 * Every broadcasting stage is idempotent, and re-running one IS the resume path — the predicates are
 * chain queries, so there is no journal to repair. The one case that is NOT safe is aborting while
 * transactions are still in the mempool: `forge script` simulates against a fork at the head, which
 * does not see them, so a re-run's predicates report "not deployed" for creates about to land. It
 * then re-sends them, and those revert — the canonical factory reverts when CREATE2 returns zero.
 * Wasted gas and a burnt nonce; the ADDRESSES are unharmed, so the next run succeeds.
 *
 * A difference between the pending and latest nonce is exactly "this account has work in flight".
 */
export function requireNoPendingTxs(ctx: Ctx, who: string): void {
  const latest = Number(captureOrFail('cast', ['nonce', who, '--block', 'latest', '--rpc-url', ctx.opt.rpcUrl]));
  const pending = Number(captureOrFail('cast', ['nonce', who, '--block', 'pending', '--rpc-url', ctx.opt.rpcUrl]));
  if (pending === latest) return;

  fail(
    `Error: ${who} has ${pending - latest} transaction(s) in the mempool.`,
    '       Starting now would re-send creates for addresses that are about to have code,',
    '       and those transactions would revert. Nothing is corrupted and no address is',
    '       burnt — wait for them to be mined and run the same command again.',
    '       (`--stage log` shows what this run has sent so far.)',
    `         latest nonce  ${latest}`,
    `         pending nonce ${pending}`,
  );
}

////////////////////////////////////////////////////////////////////////////////

/**
 * Distil forge's broadcast records for one stage's script into the journal.
 *
 * Called whether the stage SUCCEEDED OR NOT — a stage that died halfway is precisely when the record
 * matters, and forge has already written what it managed to send.
 *
 * Invents no facts: forge already records every transaction and receipt, and this flattens them into
 * one append-only stream across stages, tagged with which stage sent what. A transaction forge recorded
 * without a receipt is looked up on chain before it is called `unmined`.
 */
export function recordJournal(ctx: Ctx, target: string): void {
  // `?? target` is unreachable in practice — a forge target is always `File.sol:Contract` — but
  // noUncheckedIndexedAccess types index access as possibly-undefined. A target without a colon IS its
  // own file name.
  const file = target.split(':')[0] ?? target;
  const fresh = ingestForgeRuns(ctx, file, ctx.stageLabel, false);

  // A reverted transaction is not fatal on this path — a failed create does not burn its address
  // — but it must never scroll past unnoticed. Counted from what was actually appended, so a
  // re-run of a stage that once reverted does not warn about it again.
  const reverted = fresh.filter((r) => r.status === 'REVERTED').length;
  if (reverted > 0) warn(`${reverted} transaction(s) REVERTED in this stage - see --stage log`);
}

/**
 * Every `run-<time>.json` forge kept for one script, oldest first.
 *
 * Not just `run-latest.json`: that is a copy of the newest run only, so a run that was interrupted and
 * then re-run would otherwise lose the first run's transactions from the journal.
 */
function forgeRunFiles(ctx: Ctx, file: string): string[] {
  const dir = join(ctx.broadcastDir, file, ctx.chainId);
  if (!existsSync(dir)) return [];
  const time = (name: string): number => Number(name.slice('run-'.length, -'.json'.length));
  return readdirSync(dir)
    .filter((name) => /^run-\d+\.json$/.test(name))
    .sort((a, b) => time(a) - time(b))
    .map((name) => join(dir, name));
}

/** A receipt as cast prints it with --json: hex numbers. */
type ChainReceipt = {
  readonly blockNumber?: string;
  readonly blockHash?: string;
  readonly status?: string;
  readonly gasUsed?: string;
};

/** The receipt of `hash`, or null when the chain has none (pending, dropped, reorged out). Never waits. */
function chainReceipt(ctx: Ctx, hash: string): ChainReceipt | null {
  const r = capture('cast', ['receipt', hash, '--async', '--json', '--rpc-url', ctx.opt.rpcUrl]);
  if (!r.ok) return null;
  try {
    return JSON.parse(r.stdout) as ChainReceipt;
  } catch {
    return null;
  }
}

/** The mined fields of a journal line, from a receipt (or `unmined` without one). */
function minedFields(rc: ChainReceipt | null): Pick<JournalEntry, 'block' | 'blockHash' | 'gasUsed' | 'status'> {
  return {
    block: hexToNumber(rc?.blockNumber),
    blockHash: rc?.blockHash?.toLowerCase() ?? null,
    gasUsed: hexToNumber(rc?.gasUsed),
    status: rc === null ? 'unmined' : rc.status === '0x1' ? 'ok' : 'REVERTED',
  };
}

function isTxLine(line: JournalLine): line is JournalEntry {
  return line.kind === undefined || line.kind === 'tx';
}

/** The last journal line per transaction hash: the current knowledge about each one. */
function latestByHash(ctx: Ctx): Map<string, JournalEntry> {
  const latest = new Map<string, JournalEntry>();
  for (const line of readJsonl<JournalLine>(ctx.journalPath)) {
    if (isTxLine(line) && line.hash !== null) latest.set(line.hash, line);
  }
  return latest;
}

/**
 * Append what forge recorded for `file` that the journal does not already know.
 *
 * A transaction with no hash was planned but never signed — nothing happened, so nothing is recorded. A
 * known transaction is appended again only with news: a receipt for one that was `unmined`, or the block
 * hash an older line lacks.
 */
function ingestForgeRuns(ctx: Ctx, file: string, stage: string, recovering: boolean): JournalEntry[] {
  const latest = latestByHash(ctx);
  const out: JournalEntry[] = [];
  for (const path of forgeRunFiles(ctx, file)) {
    const run = readJson<ForgeRun>(path);
    if (run === null) continue;
    const receipts = run.receipts ?? [];
    for (const tx of run.transactions ?? []) {
      if (tx.hash === null) continue;
      const known = latest.get(tx.hash);
      if (known !== undefined && known.status !== 'unmined' && (known.blockHash ?? null) !== null) continue;
      const fromFile = receipts.find((r) => r.transactionHash === tx.hash);
      const rc = fromFile ?? chainReceipt(ctx, tx.hash);
      const entry: JournalEntry = {
        kind: 'tx',
        stage: known?.stage ?? stage,
        script: file,
        hash: tx.hash,
        type: tx.transactionType ?? null,
        contract: tx.contractName ?? null,
        address: tx.contractAddress ?? null,
        function: tx.function ?? null,
        from: tx.transaction?.from?.toLowerCase() ?? null,
        nonce: hexToNumber(tx.transaction?.nonce),
        ...minedFields(rc),
        ...(recovering && known === undefined ? { recovered: 'broadcast-file' as const } : {}),
        ts: run.timestamp ?? null,
      };
      if (known !== undefined && entry.status === 'unmined') continue; // still no news
      out.push(entry);
      latest.set(tx.hash, entry);
    }
  }
  appendJsonl(ctx.journalPath, out);
  return out;
}

/**
 * Record, BEFORE forge starts, who is about to send from which nonce at which block.
 *
 * The one line that survives a kill at any instant: if the run dies after forge sent something but
 * before anything was written, reconcileJournal finds the missing nonces on chain from here.
 */
export function recordStageStart(ctx: Ctx, script: string, from: string, nonce: number): void {
  const anchor: JournalStageStart = {
    kind: 'stage-start',
    stage: ctx.stageLabel,
    script,
    from: from.toLowerCase(),
    nonce,
    head: headBlock(ctx),
    ts: Date.now(),
  };
  appendJsonl(ctx.journalPath, [anchor]);
}

/**
 * Bring the journal up to date with everything that exists, at the start of every run that reaches a
 * node. The journal is an audit trail; this is what makes it complete even after an interruption.
 *
 *   1. forge's broadcast records, every run of every script — a transaction sent before a kill is in
 *      forge's files even when the journal never got the line;
 *   2. older lines without sender, nonce or block hash are completed from the chain;
 *   3. nonces sent after a stage-start anchor but in no record at all are found on chain;
 *   4. finality is recorded for every mined transaction whose block is now settled.
 */
export function reconcileJournal(ctx: Ctx): void {
  if (!existsSync(ctx.journalPath) && !existsSync(ctx.broadcastDir)) return;
  const anchors = readJsonl<JournalLine>(ctx.journalPath).filter(
    (line): line is JournalStageStart => line.kind === 'stage-start',
  );
  const labelFor = (script: string): string =>
    [...anchors].reverse().find((anchor) => anchor.script === script)?.stage ?? script;

  if (existsSync(ctx.broadcastDir)) {
    for (const script of readdirSync(ctx.broadcastDir)) {
      const recovered = ingestForgeRuns(ctx, script, labelFor(script), true);
      if (recovered.length > 0)
        say(`  journal: ${String(recovered.length)} line(s) completed from forge's records of ${script}`);
    }
  }
  completeOldLines(ctx);
  recoverByNonce(ctx, anchors);
  recordFinality(ctx);
}

/** Lines written before sender, nonce and block hash were recorded: completed once, from the chain. */
function completeOldLines(ctx: Ctx): void {
  const updates: JournalEntry[] = [];
  for (const entry of latestByHash(ctx).values()) {
    if (entry.hash === null) continue;
    const needsSender = (entry.from ?? null) === null || (entry.nonce ?? null) === null;
    const needsBlockHash = entry.status !== 'unmined' && (entry.blockHash ?? null) === null;
    if (!needsSender && !needsBlockHash) continue;
    const tx = capture('cast', ['tx', entry.hash, '--json', '--rpc-url', ctx.opt.rpcUrl]);
    let from = entry.from ?? null;
    let nonce = entry.nonce ?? null;
    if (tx.ok) {
      try {
        const parsed = JSON.parse(tx.stdout) as { readonly from?: string; readonly nonce?: string };
        from = parsed.from?.toLowerCase() ?? from;
        nonce = hexToNumber(parsed.nonce) ?? nonce;
      } catch {
        // keep what the line had
      }
    }
    updates.push({ ...entry, kind: 'tx', from, nonce, ...minedFields(chainReceipt(ctx, entry.hash)) });
  }
  appendJsonl(ctx.journalPath, updates);
  if (updates.length > 0)
    say(`  journal: ${String(updates.length)} older line(s) completed (sender, nonce, block hash)`);
}

/** Blocks scanned at most when looking for unrecorded nonces: far more than any stage takes. */
const NONCE_SCAN_LIMIT = 50_000;

/**
 * Case 3: a transaction was sent, then the run was killed before forge or the journal wrote anything.
 *
 * Its sender and its starting nonce are in a stage-start anchor, so the nonces between the first anchor
 * and the sender's current nonce that no journal line accounts for are exactly the lost ones. There is no
 * standard RPC for "transaction by sender and nonce", so the blocks from the anchor on are scanned —
 * forward, stopping as soon as every missing nonce is found.
 */
function recoverByNonce(ctx: Ctx, anchors: readonly JournalStageStart[]): void {
  const senders = [...new Set(anchors.map((anchor) => anchor.from))];
  for (const sender of senders) {
    const mine = anchors.filter((anchor) => anchor.from === sender).sort((a, b) => a.nonce - b.nonce);
    const first = mine[0];
    if (first === undefined) continue;
    const latestNonce = Number(
      captureOrFail('cast', ['nonce', sender, '--block', 'latest', '--rpc-url', ctx.opt.rpcUrl]),
    );
    const accounted = new Set(
      [...latestByHash(ctx).values()]
        .filter((entry) => entry.from === sender && entry.status !== 'unmined')
        .map((entry) => entry.nonce),
    );
    const missing = new Set<number>();
    for (let n = first.nonce; n < latestNonce; n++) if (!accounted.has(n)) missing.add(n);
    if (missing.size === 0) continue;

    const lowest = Math.min(...missing);
    const anchorFor = (nonce: number): JournalStageStart =>
      [...mine].reverse().find((anchor) => anchor.nonce <= nonce) ?? first;
    const fromBlock = anchorFor(lowest).head;
    const head = headBlock(ctx);
    say(
      `  journal: ${String(missing.size)} transaction(s) from ${sender} are on chain but in no record`,
      `           (nonces ${[...missing].sort((a, b) => a - b).join(', ')}); scanning from block ${String(fromBlock)}`,
    );
    const beat = heartbeat();
    const found: JournalEntry[] = [];
    for (let n = fromBlock; n <= head && n < fromBlock + NONCE_SCAN_LIMIT && missing.size > 0; n++) {
      const block = capture('cast', ['block', String(n), '--full', '--json', '--rpc-url', ctx.opt.rpcUrl]);
      if (!block.ok) continue;
      let txs: ReadonlyArray<{ hash?: string; from?: string; nonce?: string; to?: string | null }> = [];
      try {
        txs = (JSON.parse(block.stdout) as { transactions?: typeof txs }).transactions ?? [];
      } catch {
        continue;
      }
      for (const tx of txs) {
        const nonce = hexToNumber(tx.nonce);
        if (tx.hash === undefined || tx.from?.toLowerCase() !== sender || nonce === null || !missing.has(nonce))
          continue;
        const anchor = anchorFor(nonce);
        found.push({
          kind: 'tx',
          stage: anchor.stage,
          script: anchor.script,
          hash: tx.hash,
          address: tx.to ?? null,
          from: sender,
          nonce,
          ...minedFields(chainReceipt(ctx, tx.hash)),
          recovered: 'nonce-scan',
          note: 'found on chain from a stage-start anchor; in no local record',
          ts: Date.now(),
        });
        missing.delete(nonce);
      }
      if (beat.due()) say(`    … scanned up to block ${String(n)} of ${String(head)} (${beat.elapsed()})`);
    }
    appendJsonl(ctx.journalPath, found);
    if (found.length > 0) say(`  journal: recovered ${String(found.length)} transaction(s) from the chain`);
    if (missing.size > 0) {
      warn(
        `nonce(s) ${[...missing].sort((a, b) => a - b).join(', ')} of ${sender} were not found after block ${String(fromBlock)}.`,
        'They may have been sent by something else than this tool. The journal does not list them.',
      );
    }
  }
}

/**
 * Point 1: record the finality of every mined transaction whose block is now settled.
 *
 * Settled is the chain's `finalized` block, or `confirmations` behind the head with --no-finality. A
 * transaction is recorded final only if the block at its height STILL has the recorded hash; otherwise it
 * was reorged, and its line is re-read from the chain instead (and the operator warned).
 */
export function recordFinality(ctx: Ctx): void {
  const finalized = new Set(
    readJsonl<JournalLine>(ctx.journalPath)
      .filter((line): line is JournalFinalized => line.kind === 'finalized')
      .map((line) => line.hash),
  );
  const candidates = [...latestByHash(ctx).values()].filter(
    (entry) => entry.hash !== null && entry.status !== 'unmined' && !finalized.has(entry.hash),
  );
  if (candidates.length === 0) return;

  const settled = settledBlock(ctx);
  const rule = ctx.useFinality ? 'finalized' : `${String(ctx.opt.confirmations)} blocks deep`;
  const hashAtHeight = new Map<number, string | null>();
  const canonicalHash = (height: number): string | null => {
    if (!hashAtHeight.has(height)) {
      const r = capture('cast', ['block', String(height), '--field', 'hash', '--rpc-url', ctx.opt.rpcUrl]);
      hashAtHeight.set(height, r.ok ? r.stdout.toLowerCase() : null);
    }
    return hashAtHeight.get(height) ?? null;
  };

  const lines: JournalLine[] = [];
  for (const entry of candidates) {
    const hash = entry.hash;
    const block = entry.block;
    const blockHash = entry.blockHash ?? null;
    if (hash === null || block === null || blockHash === null || block > settled) continue;
    const atHeight = canonicalHash(block);
    if (atHeight === null) continue;
    if (atHeight !== blockHash.toLowerCase()) {
      const reread: JournalEntry = { ...entry, kind: 'tx', ...minedFields(chainReceipt(ctx, hash)) };
      lines.push(reread);
      warn(
        `reorg: ${hash} is no longer in block ${String(block)}`,
        `(now: ${reread.block === null ? 'not on chain' : `block ${String(reread.block)}`}). The journal is updated.`,
      );
      continue;
    }
    lines.push({ kind: 'finalized', hash, block, blockHash, settledBlock: settled, rule, ts: Date.now() });
  }
  appendJsonl(ctx.journalPath, lines);
  const finals = lines.filter((line) => line.kind === 'finalized').length;
  if (finals > 0)
    say(`  journal: ${String(finals)} transaction(s) recorded as final (${rule}, settled block ${String(settled)})`);
}

////////////////////////////////////////////////////////////////////////////////

/**
 * Record something on chain that this script did NOT send.
 *
 * Only step F's polling path uses it: the admin's acceptOwnership() comes from a key we do not hold,
 * so there is no local receipt to distil — but "the deployment finished at block N" is the single
 * most useful line in the whole journal, and omitting it because we were not the sender would be
 * pedantry.
 */
export function recordObservation(ctx: Ctx, stage: string, note: string, block: number): void {
  const entry: JournalEntry = { kind: 'tx', stage, observed: true, note, block, hash: null, status: 'ok' };
  appendJsonl(ctx.journalPath, [entry]);
}

////////////////////////////////////////////////////////////////////////////////

/**
 * The journal's transactions, one per hash, in the order they were first recorded, with the LAST line's
 * content: a transaction recorded `unmined` and later mined reads as mined.
 *
 * Stage-start anchors and finality records are not transactions and are left out; observations (step F,
 * no hash) are always kept.
 */
export function readJournal(ctx: Ctx): JournalEntry[] {
  const out: JournalEntry[] = [];
  const position = new Map<string, number>();
  for (const line of readJsonl<JournalLine>(ctx.journalPath)) {
    if (!isTxLine(line)) continue;
    if (line.hash === null) {
      out.push(line);
      continue;
    }
    const at = position.get(line.hash);
    if (at === undefined) {
      position.set(line.hash, out.length);
      out.push(line);
    } else {
      const first = out[at];
      out[at] = { ...first, ...line, stage: first?.stage ?? line.stage };
    }
  }
  return out;
}

/** Has this deployment sent anything? A transaction with a hash, not a mere stage-start anchor. */
export function journalHasSentTx(ctx: Ctx): boolean {
  return readJournal(ctx).some((entry) => entry.hash !== null);
}

/** The hashes the journal records as final. */
export function finalizedHashes(ctx: Ctx): Set<string> {
  return new Set(
    readJsonl<JournalLine>(ctx.journalPath)
      .filter((line): line is JournalFinalized => line.kind === 'finalized')
      .map((line) => line.hash),
  );
}

////////////////////////////////////////////////////////////////////////////////

/** What has been executed. The other half of `--stage status`, which says what remains. */
export function showJournal(ctx: Ctx): void {
  const rows = readJournal(ctx);
  if (rows.length === 0) {
    say(`No journal at ${ctx.journalPath} - nothing has been broadcast for this deployment yet.`);
    return;
  }

  const final = finalizedHashes(ctx);
  say(`📜  log  (${ctx.journalPath})`, '');
  say(
    `  ${pad('STAGE', 10)} ${pad('STATUS', 9)} ${pad('BLOCK', 9)} ${pad('FINAL', 6)} ${pad('WHAT', 30)} ADDRESS / TX`,
  );
  for (const r of rows) {
    // WHAT is truncated rather than left to overflow: a full signature would push the address column
    // out of line on one row and not the others.
    const what = r.contract ?? r.function ?? r.note ?? '-';
    const isFinal = r.hash !== null && final.has(r.hash) ? 'yes' : r.status === 'unmined' ? '-' : 'no';
    say(
      `  ${pad(r.stage, 10)} ${pad(r.status, 9)} ${pad(r.block === null ? '-' : String(r.block), 9)} ` +
        `${pad(isFinal, 6)} ${pad(what, 30)} ${r.address ?? r.hash ?? '-'}${r.recovered === undefined ? '' : `  (recovered: ${r.recovered})`}`,
    );
  }

  const reverted = rows.filter((r) => r.status === 'REVERTED').length;
  const finals = rows.filter((r) => r.hash !== null && final.has(r.hash)).length;
  say(
    '',
    `  ${rows.length} entries, ${reverted} reverted, ${finals} final`,
    '  FINAL is as of the last run that reached the node; `--stage status` (or any stage) updates it.',
    `  raw forge records: ${ctx.broadcastDir}`,
  );
}

////////////////////////////////////////////////////////////////////////////////

/**
 * What has been executed for this deployment, step by step, with the transaction that did it.
 *
 * Reads the journal and the manifest, so — like `log` — it needs no network, no keystore and no
 * foundry: this is the view you want when the RPC is down, when the key has been put away, or when
 * someone asks months later what was deployed and when.
 *
 * The three read-only views answer three different questions, and it is worth keeping them apart:
 *
 *   report   which STEPS ran, and which transactions did them        (reads the journal)
 *   log      every transaction in the order it was sent              (reads the journal)
 *   status   what is DONE and what is BLOCKED, right now, and why    (reads the chain)
 *
 * A step can appear more than once. That is not a bug to hide: re-running a stage after a failure is
 * the normal path here, so a report that collapsed the retries would be hiding the interesting
 * part.
 */
export function stageReport(ctx: Ctx): void {
  const manifest = readJson<Manifest>(manifestPath(ctx));
  const rows = readJournal(ctx);
  const final = finalizedHashes(ctx);

  say(`📋  report  ${ctx.opt.deploymentId}`);
  if (manifest === null) {
    say(`  no manifest at ${manifestPath(ctx)} - this deployment has not been computed yet.`);
    return;
  }
  say(
    `  chain      ${manifest.chainId ?? '?'}`,
    `  deployer   ${manifest.deployer ?? '?'}`,
    `  admin      ${manifest.admin ?? '?'}`,
    `  sealed     ${manifestPath(ctx)}`,
    '',
    `  ✅  ${pad('compute', 8)} addresses computed and sealed (no transactions)`,
  );

  let executed = 0;
  for (const step of ctx.flow.reportSteps) {
    const entries = rows.filter((r) => r.stage === step.label);

    // One blank line before every step, so a step and its transactions read as one block rather than
    // as an undifferentiated wall.
    say('');

    // 🍔 rather than ⬜ for "not run": the white square is nearly invisible on a light terminal,
    // which is the opposite of what a status mark is for.
    if (entries.length === 0) {
      say(`  🍔  ${pad(step.label, 8)} ${step.title}`);
      say(`      ${'-'.repeat(RULE_WIDTH)}`);
      say('      <Not yet executed>');
      continue;
    }
    executed++;

    // ❌ means "something in this step reverted", not "this step did not achieve its goal" — those
    // are different questions and only the chain can answer the second one, which is what
    // `--stage status` is for. A revert followed by a successful retry still gets the cross, because
    // the point of the mark is to send you to the lines below it.
    const failed = entries.filter((e) => e.status === 'REVERTED').length;
    const suffix = failed > 0 ? `  (${failed} reverted)` : '';
    say(`  ${failed > 0 ? '❌' : '✅'}  ${pad(step.label, 8)} ${step.title}${suffix}`);

    say(`      ${'-'.repeat(RULE_WIDTH)}`);
    for (const e of entries) say(`      ${reportTxLine(e, final)}`);
  }

  const reverted = rows.filter((r) => r.status === 'REVERTED').length;
  say(
    '',
    `  ${executed}/${ctx.flow.reportSteps.length} steps executed, ${rows.length} transactions, ${reverted} reverted`,
    ...(reverted > 0 ? ['  A reverted create does NOT burn its address - re-run the stage.'] : []),
  );

  reportAddresses(manifest);
}

////////////////////////////////////////////////////////////////////////////////

/**
 * The stack's addresses, from the manifest — the report's conclusion.
 *
 * Read from the seal, not the chain, so this works with no network like the rest of `report`. Which
 * also means it says where the stack IS, not that it is there; `--stage verify` answers that.
 *
 * Split three ways because the three groups answer different questions. The host addresses are what
 * a dApp compiles against and what goes in an SDK config. ACL_OWNER is the trust root — whoever owns
 * it can upgrade any of them. The implementations are what those proxies currently run, and are
 * the only group that changes on an upgrade.
 */
export function reportAddresses(manifest: Manifest): void {
  const addr = manifest.address;
  if (addr === undefined) return;

  const line = (role: string): void => {
    const value = addr[role];
    if (value !== undefined) say(`      ${pad(role, ROLE_WIDTH)} ${value}`);
  };

  say('', '  📇  addresses  the deployed stack, as sealed');
  say(`      ${'-'.repeat(RULE_WIDTH)}`);
  for (const role of HOST_ROLES) line(role);

  say('');
  say(`      ${pad('ACL_OWNER', ROLE_WIDTH)} ${addr.ACL_OWNER ?? '-'}   <- trust root, owned by the admin`);

  say('');
  for (const role of Object.keys(addr)
    .filter((k) => k.startsWith('IMPL_'))
    .sort())
    line(role);
}

////////////////////////////////////////////////////////////////////////////////

/**
 * One transaction in a report: block, status, hash, and what it did.
 *
 * The hash is printed in full rather than abbreviated, because the point of having it here is to
 * paste it into an explorer. Step F's line has no hash when the admin's transaction was merely
 * observed — see recordObservation — and says so rather than printing a misleading blank.
 */
export function reportTxLine(e: JournalEntry, final: ReadonlySet<string> = new Set()): string {
  const block = e.block === null ? 'unmined' : `block ${e.block}`;
  const what = e.contract ?? e.function ?? e.note ?? '-';
  const hash = e.hash ?? '(no local receipt - sent externally)';
  const isFinal = e.hash !== null && final.has(e.hash) ? 'final' : '';
  return `${pad(block, 15)} ${pad(e.status, 9)} ${pad(isFinal, 6)} ${hash}  ${what}`;
}

////////////////////////////////////////////////////////////////////////////////

/**
 * One broadcasting stage.
 *
 * --sender alongside --account: every script requires msg.sender == FHEVM_DEPLOYER, because the whole
 * address set is a function of the deployer and broadcasting from another account produces
 * creates that land where nothing was compiled for.
 *
 * Step F is sent by the ADMIN, not the deployer — that inversion is what Ownable2Step is for — so
 * account and sender are parameters rather than constants.
 */

////////////////////////////////////////////////////////////////////////////////

export async function broadcast(
  ctx: Ctx,
  target: string,
  signer?: Signer,
  sender?: string,
  extraEnv?: NodeJS.ProcessEnv,
): Promise<void> {
  const from = sender ?? ctx.deployer;
  const key = signer ?? ctx.opt.signer;
  if (key === null) {
    fail(`Error: stage '${ctx.opt.stage}' sends transactions but no signer was resolved.`);
  }
  const base = [
    'script',
    `${SCRIPT_DIR}/${target}`,
    '--rpc-url',
    ctx.opt.rpcUrl,
    '--out',
    ctx.buildOut,
    ...ctx.forgeArgs,
    ...traceArgs(ctx),
  ];

  // --dry-run: the same script, simulated, sending nothing.
  //
  // `forge script` WITHOUT --broadcast still simulates the whole run against a fork at the head, so
  // every predicate and precondition executes and reverts exactly as it would for real. That makes
  // it a genuine readiness check rather than a separate code path that can drift from the one that
  // matters. Nothing is signed, so --account is dropped and only --sender is passed.
  //
  // It does not WAIT: a dry run's job is to say whether you are ready now, so a too-early run should
  // fail with the Solidity gate's block countdown rather than block for ten minutes.
  if (ctx.opt.dryRun) {
    say('  (dry run: simulating, nothing will be sent)');
    const env = {
      ...scriptEnv(ctx),
      ...generatedConfigEnv(ctx),
      ...extraEnv,
      FHEVM_MIN_BLOCK: String(ctx.opt.minBlockOverride ?? 0),
    };
    const code = await runLogged('forge', [...base, '--sender', from], env);
    if (code !== 0) process.exit(code);
    return;
  }

  // The seal gate. No-ops unless this is the first transaction of the deployment; never reached by a dry run,
  // which returned above.
  confirmSealed(ctx);

  requireNoPendingTxs(ctx, from);
  const minBlock = ctx.opt.minBlockOverride ?? ctx.nextMinBlock;
  await waitForBlock(ctx, minBlock);

  const env = {
    ...scriptEnv(ctx),
    ...generatedConfigEnv(ctx),
    ...extraEnv,
    FHEVM_MIN_BLOCK: String(minBlock),
  };

  // --slow: one transaction at a time, waiting for each receipt. The two hard edges (impl₁ before
  // the ACL proxy, impl₃ before the rest) are satisfied by nonce ordering alone, but --slow turns a
  // mid-run failure into "stop here" instead of "the rest also fail in the same block".
  //
  // The exit code is captured rather than thrown, so the journal is written even when the stage
  // dies. A half-finished stage is the case the audit trail exists for.
  // Said before forge starts: it sends one transaction at a time and waits for each receipt, so a stage
  // of 20 transactions on a 12-second chain takes minutes. When its output is piped into a transcript,
  // forge shows none of that progress, so a heartbeat reports the sender's nonce instead.
  say(
    `  sending from ${from}: one transaction at a time, each waiting for its receipt.`,
    '  On a public testnet this takes about one block per transaction.',
  );
  const startNonce = captureOrFail('cast', ['nonce', from, '--block', 'latest', '--rpc-url', ctx.opt.rpcUrl]);
  // Before forge can sign anything: if the run is killed the instant after it sends, this line is what
  // lets the next run find the transaction on chain (reconcileJournal).
  recordStageStart(ctx, target.split(':')[0] ?? target, from, Number(startNonce));
  const beat = heartbeat(30_000);
  const code = await runLogged(
    'forge',
    [...base, ...forgeSignerArgs(key), '--sender', from, '--slow', '--broadcast'],
    env,
    transcriptActive()
      ? () => {
          const nonce = capture('cast', ['nonce', from, '--rpc-url', ctx.opt.rpcUrl]).stdout;
          const sent = /^\d+$/.test(nonce) && /^\d+$/.test(startNonce) ? Number(nonce) - Number(startNonce) : '?';
          return `  … forge is still sending (${beat.elapsed()}): ${String(sent)} transaction(s) mined so far`;
        }
      : undefined,
  );

  recordJournal(ctx, target);
  recordFinality(ctx);
  if (code !== 0) {
    console.error(`  stage failed (forge exit ${code}). What was sent is in --stage log.`);
    process.exit(code);
  }

  // Derived from the head AFTER the stage rather than from a receipt: --slow means every transaction
  // is already mined by now, so the head is at or past the last of them. Erring later is the safe
  // direction for a reorg gate.
  ctx.finalityTarget = headBlock(ctx);
  ctx.nextMinBlock = ctx.finalityTarget + ctx.opt.confirmations;
}

////////////////////////////////////////////////////////////////////////////////

/**
 * Refuse to proceed on an out dir that has no artifacts in it.
 *
 * `--no-build` skips the compile, so this is the only thing standing between "reuse what is there"
 * and "compute addresses from nothing". A missing artifact makes `vm.getCode` return empty, and an
 * empty initcode still hashes to something — it just hashes to the wrong thing, silently.
 *
 * Spot-checks the artifacts every pass reads rather than counting files, so a half-written or
 * partially cleaned out dir fails here rather than three passes later.
 */

////////////////////////////////////////////////////////////////////////////////

export function requireBuiltArtifacts(ctx: Ctx): void {
  const required = [
    'ERC1967Proxy.sol/ERC1967Proxy.json',
    'EmptyUUPSProxyACL.sol/EmptyUUPSProxyACL.json',
    'EmptyUUPSProxy.sol/EmptyUUPSProxy.json',
    'PauserSet.sol/PauserSet.json',
    'ACLOwner.sol/ACLOwner.json',
    'ACL.sol/ACL.json',
  ];
  const missing = required.filter((r) => !existsSync(join(ctx.buildOut, r)));
  if (missing.length === 0) return;

  fail(
    `Error: --no-build, but ${ctx.buildOut} is missing ${missing.length} of ${required.length} artifacts:`,
    ...missing.map((m) => `         ${m}`),
    '       Run once without --no-build to populate it.',
  );
}

////////////////////////////////////////////////////////////////////////////////

/**
 * Compute the address set — the three-build pipeline.
 *
 * Each pass is: build, then compute. The build comes FIRST every time, because a pass computes an
 * address by hashing bytecode, and that bytecode has to already contain whatever the previous pass
 * worked out.
 *
 *   pass 1   build, then compute the ACL address and write it into addresses.sol
 *   pass 2   rebuild (contracts now hold the real ACL address), then compute every other address
 *   pass 3   rebuild (implementations now hold every address), check nothing moved, seal
 *
 * An address depends on the bytecode, and the bytecode contains addresses. forge cannot recompile
 * itself mid-run, which is why this stage is here and not in Solidity.
 */

////////////////////////////////////////////////////////////////////////////////

export function confirmSealed(ctx: Ctx): void {
  if (ctx.opt.noConfirm) return;

  // Fires on the CONDITION — "this deployment has never sent a transaction" — rather than on how the
  // run was invoked. It used to hang off the `--stage all` branch, which meant the manual path, the
  // one a real deployment actually uses, was never asked at all. An empty journal is the same signal
  // `compute` uses to decide whether recomputing is still safe.
  if (journalHasSentTx(ctx)) return;

  // `--no-git` / `"git": false` — this deployment does not need a committed seal at all.
  //
  // NOT the same claim as --no-confirm, which asserts the seal HAS been pushed and stays silent.
  // This one says the seal does not matter here, and warns every time, because it is a real loss:
  // without it a failed create cannot be retried at the same address, so a half-finished stack is
  // unfinishable. Legitimate for a throwaway rehearsal, wrong for anything standing.
  if (!ctx.opt.requireGitSeal) {
    warn(
      'no git seal for this deployment (--no-git).',
      'If a stage fails midway there is no committed record of the init-code hashes,',
      'and this stack cannot be resumed. Fine for a rehearsal.',
    );
    return;
  }

  const state = gitSealState(ctx.outDir, ['manifest.json', 'addresses.sol']);
  if (state.ok) {
    say(`  seal: ${state.detail}`);
    return;
  }

  // Relative to the directory the command was launched from — not the package root main() chdir'd to —
  // so the lines below can be pasted straight into that shell.
  const fromLaunch = relative(INVOCATION_DIR, ctx.outDir);
  const dir = fromLaunch === '' ? '.' : fromLaunch;
  fail(
    '',
    `Error: the seal is not safely in git: ${state.reason}.`,
    '',
    '       Nothing has been sent. Before the FIRST transaction the seal must be committed (and pushed,',
    '       when the branch has an upstream): the addresses ARE the init-code hashes, so retrying a failed',
    '       create needs the byte-exact ones. Lose the seal and a half-finished stack cannot be finished.',
    '',
    `         git add -f ${dir}/manifest.json ${dir}/addresses.sol`,
    `         git commit -m "seal: ${ctx.opt.deploymentId}"`,
    '         git push        # only if the branch has an upstream',
    '',
    '       Then run the same command again.',
  );
}

/**
 * Where the seal stands in git, checked rather than asked.
 *
 * Committed means: both files are in HEAD and identical to it. Pushed is required only when the branch
 * HAS an upstream; then the last commit touching them must be an ancestor of it. A local-only repository
 * is accepted as is. Not a git repository at all is refused: the seal would then live in one copy.
 */
export function gitSealState(
  dir: string,
  files: readonly string[],
): { readonly ok: true; readonly detail: string } | { readonly ok: false; readonly reason: string } {
  const git = (...args: string[]) => capture('git', ['-C', dir, ...args]);
  if (!git('rev-parse', '--show-toplevel').ok) return { ok: false, reason: `${dir} is not inside a git repository` };
  for (const file of files) {
    if (!git('cat-file', '-e', `HEAD:./${file}`).ok) return { ok: false, reason: `${file} is not committed` };
    if (!git('diff', '--quiet', 'HEAD', '--', file).ok) {
      return { ok: false, reason: `${file} has changed since it was committed` };
    }
  }
  const last = git('log', '-1', '--format=%H', '--', ...files).stdout;
  const short = last.slice(0, 12);
  const upstream = git('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}');
  if (!upstream.ok) return { ok: true, detail: `committed in ${short} (no upstream branch, nothing to push to)` };
  if (!git('merge-base', '--is-ancestor', last, '@{u}').ok) {
    return { ok: false, reason: `the commit with the seal (${short}) is not pushed to ${upstream.stdout}` };
  }
  return { ok: true, detail: `committed in ${short} and pushed to ${upstream.stdout}` };
}

////////////////////////////////////////////////////////////////////////////////
