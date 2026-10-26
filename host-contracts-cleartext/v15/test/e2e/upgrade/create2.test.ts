// The CREATE2 path, end to end, across a generation boundary: a fresh anvil, a previous-generation stack
// deployed by that generation's own `create2-deploy` coordinator, then this generation's coordinator upgrading
// it in place.
//
// Run: npm run test:upgrade
//
// ## Why this exists separately from test/ts/upgrade/library.test.ts
//
// That test drives the same upgrade through the TypeScript library — `deploy()` then `updateV14ToV15()`
// — from inside one Node process. This drives it through the OPERATOR-FACING path: two CLI coordinators,
// each spawning `forge script`, each broadcasting real transactions and sealing a manifest. The two share
// no code, which is the point. The library path can be correct while the CREATE2 path is broken, and the
// CREATE2 path is the one an operator actually runs against a testnet.
//
// It also exercises the thing neither unit tests nor the library e2e can: that the nine implementations and the
// PaddedInputter and ProtocolConfigReplica proxies this generation's `compute` predicts land beside the eleven live addresses it was handed, and that a `materialize`
// built from a sealed manifest lands on a stack that was deployed by a different package, at a different
// version, in a different process.
//
// ## Deliberately NOT in the fast lane
//
// `test:templates:run` globs `test/*.test.ts`, one level deep, so living in `test/e2e/` keeps this out of
// it. Two forge builds and a full deploy do not belong in a lane meant to run in seconds.
//
// ## Skips rather than fails when a prerequisite is missing
//
// Same policy as `internal/upgrade/runUpgradeE2e.ts`, for the same reason: `anvil`/`forge` may be absent, the
// sibling previous-generation package may not be checked out, and neither is a defect in this package. Every skip names
// what is missing and how to get it. The one thing a skip must never do is look like a pass — each is
// reported by the test runner as a skip, with its reason.

import assert from 'node:assert/strict';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve as resolvePath } from 'node:path';
import test from 'node:test';
import { Contract, HDNodeWallet, Interface, JsonRpcProvider } from 'ethers';
import { PACKAGE_ROOT_ABS_PATH } from '../../../internal/constants.ts';
import { CLEARTEXT_PAD_PRF_INSTANCE } from '@fhevm/sdk-vendored-dev/cleartext-config-v15.ts';
import { assertStampedRecord, sealedManifest } from '../record.ts';

/**
 * The previous generation's DIRECTORY — for work that is not an import: running its scripts as child
 * processes, and cleaning its build output. Declared here because this file is its only caller, and
 * both go when the pair rotates.
 *
 * TypeScript that merely wants the previous generation's code must NOT come through here. It is a workspace
 * member, so it is imported like any dependency — `@fhevm/host-contracts-cleartext-v<N-1>-dev/pkg/ts/index.ts`,
 * resolved through the link npm created, with types and go-to-definition intact. The upgrade e2e used
 * to build the previous generation, pack it and extract it under an alias in `test/ts/node_modules` purely to get an
 * importable copy; a workspace link does that already, and the whole apparatus is gone.
 *
 * A tarball is for testing the PUBLISH CONTRACT — `files` omissions, undeclared deps, stale output —
 * and it is worth its cost only when the packed artifact is what is on trial. Using one to obtain a
 * sibling's source code buys nothing and pays a build, a pack and an install for it.
 */
const PREVIOUS_GENERATION_DIR_ABS_PATH = join(PACKAGE_ROOT_ABS_PATH, '..', 'v14');

/** This generation's upgrade entry point. */
const UPGRADE_CLI = join(PACKAGE_ROOT_ABS_PATH, 'create2-deploy', 'upgrade', 'upgrade-cli');

////////////////////////////////////////////////////////////////////////////////
// Configuration
////////////////////////////////////////////////////////////////////////////////

/**
 * A port well away from 8545.
 *
 * Not a detail: a developer very often has a stack on the default port, and a test that quietly deployed
 * onto it would both corrupt that stack and pass. The port is also checked for occupancy before anvil is
 * started, so a collision is a named skip rather than a confusing deploy failure.
 */
const PORT = 8557;
const RPC_URL = `http://127.0.0.1:${PORT}`;

/**
 * A dedicated out-dir per generation, so a run never touches the `.out-anvil` a developer's manual
 * rehearsal uses. `.out-*` is gitignored in both generations; `.test-*` (the file below) in this one.
 *
 * Both coordinators read `--out-dir` relative to the caller's directory. The previous generation's is run from
 * its `create2-deploy/` with a BARE name, so it lands there (its foundry.toml grants forge write access to
 * exactly that folder); this generation's is passed ABSOLUTE (outDirAbs), so it lands in its own
 * `create2-deploy/` and is cleaned up the same way.
 */
const OUT_DIR_ARG = '.out-test-create2-e2e';
const NEGATIVE_OUT_DIR_ARG = '.out-test-create2-e2e-negative';

/** Where that lands on disk, for reading the manifest and for cleanup. */
function outDirAbs(packageRoot: string, outDir = OUT_DIR_ARG): string {
  return join(packageRoot, 'create2-deploy', outDir);
}

/** Distinct from the GUIDE's `anvil-rehearsal`, so a developer's manual rehearsal state is never reused. */
const DEPLOYMENT_ID = 'create2-e2e';

////////////////////////////////////////////////////////////////////////////////
// Prerequisites
////////////////////////////////////////////////////////////////////////////////

function haveBinary(name: string): boolean {
  return spawnSync(name, ['--version'], { stdio: 'ignore' }).status === 0;
}

/** Why this whole test cannot run, or undefined. `undefined` rather than `null` is what `test`'s `skip`
 *  option accepts, and passing the reason straight through is what makes the runner print it. */
function blockedReason(): string | undefined {
  for (const bin of ['anvil', 'forge'] as const) {
    if (!haveBinary(bin)) return `${bin} not found — install foundry (https://getfoundry.sh)`;
  }
  if (!existsSync(join(PREVIOUS_GENERATION_DIR_ABS_PATH, 'create2-deploy', 'deploy-cli'))) {
    return `the sibling previous-generation package has no create2-deploy coordinator at ${PREVIOUS_GENERATION_DIR_ABS_PATH}`;
  }
  return undefined;
}

////////////////////////////////////////////////////////////////////////////////
// Harness
////////////////////////////////////////////////////////////////////////////////

async function portIsOpen(): Promise<boolean> {
  try {
    await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
      signal: AbortSignal.timeout(500),
    });
    return true;
  } catch {
    return false;
  }
}

async function waitForNode(deadlineMs: number): Promise<void> {
  const until = Date.now() + deadlineMs;
  while (Date.now() < until) {
    if (await portIsOpen()) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`anvil did not answer on ${RPC_URL} within ${deadlineMs}ms`);
}

/**
 * Runs a coordinator and returns its combined output.
 *
 * Output is captured rather than inherited so a failure can be quoted INTO the assertion message. A
 * coordinator prints a long preflight; "exit code 1" on its own would send the reader hunting through
 * scrollback for the line that mattered.
 */

////////////////////////////////////////////////////////////////////////////////
// Progress
//
// The coordinator runs for a minute or more with two forge builds inside it. Its output is streamed as it
// happens, so the run is never silent, and each phase is announced first — the reporter's own tick only
// appears when a subtest ends. CREATE2_E2E_QUIET=1 keeps the streaming out of a CI log.
////////////////////////////////////////////////////////////////////////////////

const QUIET = process.env.CREATE2_E2E_QUIET === '1';
const STARTED_AT = Date.now();

function announce(n: number, total: number, what: string): void {
  const elapsed = ((Date.now() - STARTED_AT) / 1000).toFixed(0);
  process.stderr.write(`\n[${String(n)}/${String(total)}] ${what}  (+${elapsed}s)\n`);
}

function note(what: string): void {
  process.stderr.write(`    ${what}\n`);
}

/**
 * Runs a coordinator, streaming its output live AND capturing it, so the operator sees progress and a
 * failure can still be quoted into the assertion.
 *
 * The coordinators use anvil's public mnemonic when they detect anvil (via anvil_nodeInfo), so no
 * keystore and no password prompt. FHEVM_* env is left untouched: the config file carries everything.
 */
function runCoordinator(
  cwd: string,
  command: string,
  args: readonly string[],
): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    const onData = (chunk: Buffer): void => {
      const text = chunk.toString();
      output += text;
      if (!QUIET) process.stderr.write(text.replace(/\n(?!$)/g, '\n    │ ').replace(/^/, '    │ '));
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('close', (code) => {
      resolve({ ok: code === 0, output });
    });
  });
}

const STEPS = 11;

/** `.address.<ROLE>` out of a sealed manifest. */
function manifestAddresses(packageRoot: string): Readonly<Record<string, string>> {
  const path = join(outDirAbs(packageRoot), 'manifest.json');
  assert.ok(existsSync(path), `no manifest sealed at ${path}`);
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as { address?: Record<string, string> };
  const addresses = parsed.address;
  assert.ok(addresses, `manifest at ${path} has no "address" object`);
  return addresses;
}

/**
 * `CONTRACT_VERSIONS` read as TEXT from a generation's generated `pkg/ts/versions.ts`.
 *
 * Text rather than an import for two reasons. `test/tsconfig.json` sets `rootDir: ".."`, so nothing here
 * may import from the sibling generation at all — and reading the generated file is the stronger check
 * anyway: it asserts against what the build actually produced rather than against whatever a compiled
 * copy in this process happens to hold.
 */
function contractVersions(packageRoot: string): Readonly<Record<string, string>> {
  const path = join(packageRoot, 'pkg', 'ts', 'versions.ts');
  assert.ok(existsSync(path), `no generated versions table at ${path} — run: make generate`);
  const src = readFileSync(path, 'utf8');
  const out: Record<string, string> = {};
  for (const [, key, value] of src.matchAll(/^\s{2}([a-zA-Z][a-zA-Z0-9]*): '([^']+)',$/gm)) {
    if (key === undefined || value === undefined) continue;
    out[key] = value;
  }
  assert.ok(Object.keys(out).length >= 5, `parsed only ${Object.keys(out).length} versions from ${path}`);
  return out;
}

/**
 * A contract as a plain typed object.
 *
 * ethers' `Contract` exposes methods through a proxy, so every call site would otherwise need a non-null
 * assertion that the linter forbids — and rightly: `contract.owner!()` asserts something the type system
 * genuinely does not know. Casting once, here, to the shape the ABI describes puts the claim in one place
 * where the ABI sits beside it.
 */
function view<T>(address: string, abi: readonly string[], provider: JsonRpcProvider): T {
  return new Contract(address, abi, provider) as unknown as T;
}

type VersionedView = { getVersion(): Promise<string> };
type OwnableView = { owner(): Promise<string>; pendingOwner(): Promise<string> };
type AclView = OwnableView & {
  getPauserSetAddress(): Promise<string>;
  IS_CLEARTEXT(): Promise<boolean>;
  CLEARTEXT_PROTOCOL_VERSION(): Promise<bigint>;
};
type PauserSetView = { isPauser(account: string): Promise<boolean> };
type WiredExecutorView = { getPaddedInputterAddress(): Promise<string> };
type TrivialEncryptWriter = {
  trivialEncrypt(pt: bigint, toType: number): Promise<{ wait(): Promise<{ logs: readonly unknown[] } | null> }>;
};

const VERSIONED_ABI = ['function getVersion() view returns (string)'];
const OWNABLE_ABI = ['function owner() view returns (address)', 'function pendingOwner() view returns (address)'];
const ACL_ABI = [
  ...OWNABLE_ABI,
  'function getPauserSetAddress() view returns (address)',
  // Only `CleartextACL` answers these; the upstream `ACL` has no such selectors.
  'function IS_CLEARTEXT() view returns (bool)',
  'function CLEARTEXT_PROTOCOL_VERSION() view returns (uint256)',
];
const PAUSER_SET_ABI = ['function isPauser(address) view returns (bool)'];
const WIRED_EXECUTOR_ABI = ['function getPaddedInputterAddress() view returns (address)'];
/** OpenZeppelin `Initializable`'s namespaced storage: the low 8 bytes are the proxy's initialized version. */
const INITIALIZABLE_STORAGE = '0xf0c57e16840df040f15088dc2f81fe391c3923bec73e23a9662efc9c229c6a00';
/** The ERC-1967 implementation slot. */
const IMPLEMENTATION_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
const TRIVIAL_ENCRYPT_ABI = [
  'function trivialEncrypt(uint256,uint8) returns (bytes32)',
  'event TrivialEncrypt(address indexed caller,uint256 pt,uint8 toType,bytes32 result)',
];

const ZERO = `0x${'0'.repeat(40)}`;

/**
 * One role out of a manifest, validated.
 *
 * Folds the "is it there" and "does it look like an address" checks into the read itself. A role that is
 * absent would otherwise flow onward as `undefined` and be reported by whatever call happened to use it,
 * which is a long way from the manifest that failed to seal it.
 */
function addressOf(manifest: Readonly<Record<string, string>>, role: string): string {
  const a = manifest[role];
  assert.ok(a !== undefined && /^0x[0-9a-fA-F]{40}$/.test(a), `manifest has no usable ${role}`);
  return a;
}

async function versionOf(provider: JsonRpcProvider, address: string): Promise<string> {
  return await view<VersionedView>(address, VERSIONED_ABI, provider).getVersion();
}

/** A generation's version table, keyed the way `CONTRACT_VERSIONS` keys it. */
function expectVersion(table: Readonly<Record<string, string>>, key: string): string {
  const want = table[key];
  assert.ok(want !== undefined, `the generated versions table has no "${key}"`);
  return want;
}

////////////////////////////////////////////////////////////////////////////////
// The test
////////////////////////////////////////////////////////////////////////////////

/** The eleven live roles this generation's upgrade is handed as arguments. */
const LIVE_ROLES = [
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
] as const;

/**
 * `--acl 0x… --fhevm-executor 0x… …` — the eleven live addresses as the upgrade's arguments.
 *
 * The flag is DERIVED from the role name rather than copied from `common.ts`'s `EXISTING_FLAGS`: drop a
 * trailing `_ADDRESS`, lowercase, and turn `_` into `-`. That rule reproduces all eleven exactly, including
 * `ACL_OWNER` -> `--acl-owner`, which has no `_ADDRESS` to drop.
 *
 * Derived rather than imported because `test/tsconfig.json` does not include `create2-deploy/` — and
 * derived rather than listed because a second list of flags is a second thing to update. If the
 * coordinator ever renames one, it rejects the unknown flag and this test fails loudly, which is the
 * behaviour a hand-copied list would not have.
 */
function existingAddressArgs(manifest: Readonly<Record<string, string>>): string[] {
  return LIVE_ROLES.flatMap((role) => [
    `--${role
      .replace(/_ADDRESS$/, '')
      .toLowerCase()
      .replaceAll('_', '-')}`,
    addressOf(manifest, role),
  ]);
}

void test(
  'create2-deploy: fresh anvil, previous-generation stack, then the upgrade',
  { skip: blockedReason() },
  async (t) => {
    if (await portIsOpen()) {
      t.skip(`something is already listening on ${RPC_URL} — refusing to deploy onto it`);
      return;
    }

    const prevRoot = PREVIOUS_GENERATION_DIR_ABS_PATH;
    const curRoot = PACKAGE_ROOT_ABS_PATH;

    // anvil's DEFAULT mnemonic on purpose: it is `test test … junk`, whose accounts 0 and 1 are what both
    // coordinators fall back to when they detect anvil. Passing our own would bypass that fallback, which is
    // the path an operator rehearsing without a keystore actually uses.
    let node: ChildProcess | undefined;
    let provider: JsonRpcProvider | undefined;

    /**
     * Why anvil is gone, or undefined while it is running.
     *
     * A coordinator that outlives its node reports the loss as `Connection refused` from deep inside forge's
     * output, which reads as a deploy bug. Recording the exit here lets the assertion name the real cause.
     */
    let nodeGone: string | undefined;

    const killNode = (): void => {
      if (node?.exitCode === null && node.signalCode === null) {
        node.kill('SIGTERM');
      }
    };

    try {
      announce(1, STEPS, `start a fresh anvil on ${RPC_URL}`);
      node = spawn('anvil', ['--silent', '--host', '127.0.0.1', '--port', String(PORT)], { stdio: 'ignore' });
      node.on('exit', (code, signal) => {
        nodeGone = `the anvil on ${RPC_URL} exited mid-run (code ${String(code)}, signal ${String(signal)})`;
      });
      // Killed on the way out even if this process dies abnormally, so a crashed run cannot leave an
      // orphaned node holding the port for the next one.
      process.on('exit', killNode);
      await waitForNode(60_000);
      provider = new JsonRpcProvider(RPC_URL, undefined, { staticNetwork: true });

      let prev: Readonly<Record<string, string>> = {};
      /** Whether the deploy sealed a manifest — the subtests below all read one. */
      let prevDeployed = false;

      await t.test('the previous generation deploys from scratch through its own CREATE2 coordinator', async () => {
        announce(
          2,
          STEPS,
          'deploy the previous generation with its deploy-cli --stage all (3 forge builds, 22 creates, steps A-F)',
        );
        rmSync(outDirAbs(prevRoot), { recursive: true, force: true });
        // The previous generation's operator entry point (`deploy-cli`), run from its create2-deploy/ folder, where
        // its relative --out-dir lands.
        const { ok, output } = await runCoordinator(
          join(prevRoot, 'create2-deploy'),
          join(prevRoot, 'create2-deploy', 'deploy-cli'),
          [
            '--config',
            'anvil-config.json',
            // --rpc-url beats the config file (common.ts resolveOptions), which is what lets this run on a
            // private port while reusing the checked-in rehearsal config for everything else.
            '--rpc-url',
            RPC_URL,
            '--out-dir',
            OUT_DIR_ARG,
            '--deployment-id',
            DEPLOYMENT_ID,
            '--stage',
            'all',
          ],
        );
        if (!ok) {
          // The node is PROBED rather than judged from `nodeGone` alone: the probe says whether it answers
          // right now, whatever order the child-process events arrived in.
          const detail = (await portIsOpen()) ? '' : ` — ${nodeGone ?? `the anvil on ${RPC_URL} stopped answering`}`;
          assert.fail(`previous-generation create2 deploy failed${detail}:\n${output.slice(-4000)}`);
        }
        prev = manifestAddresses(prevRoot);
        // Asserted here so a role the deploy failed to seal is reported against the deploy, rather than
        // later as an unhelpful "bad argument" from the upgrade.
        for (const role of LIVE_ROLES) addressOf(prev, role);
        prevDeployed = true;
      });

      /**
       * Why the subtests below cannot run, or undefined. They all read the manifest the deploy sealed, so
       * without one they report `manifest has no usable ACL_ADDRESS` — three failures for a single cause,
       * none of them naming it. Skipping leaves exactly one failure to read.
       */
      const noStackReason = (): string | undefined =>
        prevDeployed ? undefined : 'the previous-generation deploy above failed, so there is no stack to inspect';

      /** Skips `st` when there is no stack, and reports whether it did. */
      const needsPrev = (st: { skip: (reason: string) => void }): boolean => {
        const reason = noStackReason();
        if (reason === undefined) return false;
        st.skip(reason);
        return true;
      };

      // Captured BEFORE the upgrade: the invariants are about what did NOT change, and the
      // pre-upgrade values are gone by the time the upgrade has run.
      let ownerBefore = '';
      let adminBefore = '';
      let pauserSetBefore = '';
      let handleBefore = '';

      await t.test('every deployed contract reports its previous-generation version', async (st) => {
        if (needsPrev(st)) return;
        announce(3, STEPS, 'read the previous-generation versions back');
        assert.ok(provider);
        const table = contractVersions(prevRoot);
        for (const [role, key] of [
          ['ACL_ADDRESS', 'acl'],
          ['FHEVM_EXECUTOR_ADDRESS', 'fhevmExecutor'],
          ['KMS_VERIFIER_ADDRESS', 'kmsVerifier'],
          ['INPUT_VERIFIER_ADDRESS', 'inputVerifier'],
          ['HCU_LIMIT_ADDRESS', 'hcuLimit'],
          ['PROTOCOL_CONFIG_ADDRESS', 'protocolConfig'],
          ['KMS_GENERATION_ADDRESS', 'kmsGeneration'],
          ['CLEARTEXT_ARITHMETIC_ADDRESS', 'cleartextArithmetic'],
          ['PAUSER_SET_ADDRESS', 'pauserSet'],
        ] as const) {
          assert.equal(await versionOf(provider, addressOf(prev, role)), expectVersion(table, key), role);
        }
      });

      await t.test('the freshly deployed ACL is a CleartextACL reporting the previous generation', async (st) => {
        if (needsPrev(st)) return;
        assert.ok(provider);
        const acl = view<AclView>(addressOf(prev, 'ACL_ADDRESS'), ACL_ABI, provider);
        assert.equal(await acl.IS_CLEARTEXT(), true, 'the previous-generation ACL must advertise IS_CLEARTEXT');
        assert.equal(await acl.CLEARTEXT_PROTOCOL_VERSION(), 14n, 'the previous-generation ACL must report 14');
      });

      await t.test('the previous-generation stack is owned through ACLOwner, with nothing dangling', async (st) => {
        if (needsPrev(st)) return;
        announce(4, STEPS, 'snapshot ownership and pausers');
        assert.ok(provider);
        const acl = view<AclView>(addressOf(prev, 'ACL_ADDRESS'), ACL_ABI, provider);
        const aclOwner = view<OwnableView>(addressOf(prev, 'ACL_OWNER'), OWNABLE_ABI, provider);

        ownerBefore = await acl.owner();
        adminBefore = await aclOwner.owner();
        pauserSetBefore = await acl.getPauserSetAddress();

        assert.equal(ownerBefore.toLowerCase(), addressOf(prev, 'ACL_OWNER').toLowerCase(), 'ACL.owner() is ACLOwner');
        // A dangling pending owner on either contract is a latent takeover: whoever holds that key can
        // accept at any later moment. It is a completion condition, not tidiness.
        assert.equal(await acl.pendingOwner(), ZERO, 'ACL.pendingOwner() == 0');
        assert.equal(await aclOwner.pendingOwner(), ZERO, 'ACLOwner.pendingOwner() == 0');
        assert.equal(
          pauserSetBefore.toLowerCase(),
          addressOf(prev, 'PAUSER_SET_ADDRESS').toLowerCase(),
          'the ACL points at the sealed PauserSet',
        );
        const pauserSet = view<PauserSetView>(pauserSetBefore, PAUSER_SET_ABI, provider);
        assert.equal(await pauserSet.isPauser(addressOf(prev, 'ACL_OWNER')), true, 'ACLOwner is a pauser');
      });

      await t.test('a cleartext handle exists before the upgrade', async (st) => {
        if (needsPrev(st)) return;
        announce(5, STEPS, 'write a cleartext handle through the previous executor (it must survive the upgrade)');
        assert.ok(provider);
        const wallet = HDNodeWallet.fromPhrase(
          'test test test test test test test test test test test junk',
          undefined,
          "m/44'/60'/0'/0/0",
        ).connect(provider);
        // Cast once, like `view()`: ethers' proxy methods are typed as possibly undefined.
        const executor = new Contract(
          addressOf(prev, 'FHEVM_EXECUTOR_ADDRESS'),
          TRIVIAL_ENCRYPT_ABI,
          wallet,
        ) as unknown as TrivialEncryptWriter;
        const receipt = await (await executor.trivialEncrypt(42n, 5)).wait();
        assert.ok(receipt, 'trivialEncrypt receipt');
        const iface = new Interface(TRIVIAL_ENCRYPT_ABI);
        for (const log of receipt.logs) {
          try {
            const parsed = iface.parseLog(log as Parameters<Interface['parseLog']>[0]);
            if (parsed?.name === 'TrivialEncrypt') handleBefore = String(parsed.args.result);
          } catch {
            // Receipt also contains ACL/CleartextDB logs; only the executor event is relevant.
          }
        }
        assert.match(handleBefore, /^0x[0-9a-fA-F]{64}$/, 'TrivialEncrypt result handle');
      });

      await t.test('a wrong supplied live address is rejected before upgrade transactions', async (st) => {
        if (needsPrev(st)) return;
        announce(6, STEPS, 'negative: compute with a wrong ACL address must refuse (expect an Error below)');
        const wrong = { ...prev, ACL_ADDRESS: ZERO };
        rmSync(outDirAbs(curRoot, NEGATIVE_OUT_DIR_ARG), { recursive: true, force: true });
        const { ok, output } = await runCoordinator(curRoot, UPGRADE_CLI, [
          '--config',
          'create2-deploy/anvil-config.json',
          '--rpc-url',
          RPC_URL,
          '--out-dir',
          outDirAbs(curRoot, NEGATIVE_OUT_DIR_ARG),
          '--deployment-id',
          `${DEPLOYMENT_ID}-wrong-address`,
          '--stage',
          'compute',
          ...existingAddressArgs(wrong),
        ]);
        assert.equal(ok, false, 'compute accepted an address with no deployed previous-generation contract');
        assert.match(output, /ACL_ADDRESS|no code|address/i, output.slice(-4000));
      });

      await t.test('a proxy running an implementation its record does not show is refused', async (st) => {
        if (needsPrev(st)) return;
        announce(7, STEPS, 'negative: a proxy re-pointed behind the record must refuse (expect an Error below)');
        // InputVerifier re-pointed to an exact copy of its own implementation, at another address: the stack
        // behaves the same, so every other check passes, and only the record comparison can tell.
        const cast = (...args: string[]): string => {
          const run = spawnSync('cast', [...args, '--rpc-url', RPC_URL], { encoding: 'utf8' });
          assert.equal(run.status, 0, `cast ${args.join(' ')}: ${run.stderr}`);
          return run.stdout.trim();
        };
        const slot = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
        const proxy = addressOf(prev, 'INPUT_VERIFIER_ADDRESS');
        const original = cast('storage', proxy, slot);
        const recorded = `0x${original.slice(-40)}`;
        const copy = `0x${'1c'.repeat(20)}`;
        cast('rpc', 'anvil_setCode', copy, cast('code', recorded));
        cast('rpc', 'anvil_setStorageAt', proxy, slot, `0x${'0'.repeat(24)}${copy.slice(2)}`);
        try {
          rmSync(outDirAbs(curRoot, NEGATIVE_OUT_DIR_ARG), { recursive: true, force: true });
          const { ok, output } = await runCoordinator(curRoot, UPGRADE_CLI, [
            '--config',
            'create2-deploy/anvil-config.json',
            '--rpc-url',
            RPC_URL,
            '--out-dir',
            outDirAbs(curRoot, NEGATIVE_OUT_DIR_ARG),
            '--deployment-id',
            DEPLOYMENT_ID,
            '--previous-manifest',
            join(outDirAbs(prevRoot), 'manifest.json'),
            '--stage',
            'compute',
            ...existingAddressArgs(prev),
          ]);
          assert.equal(ok, false, 'compute accepted a proxy running an unrecorded implementation');
          assert.match(output, new RegExp(`FAIL INPUT_VERIFIER_ADDRESS\\s+runs ${copy}`, 'i'), output.slice(-4000));
          assert.match(output, /the live stack is not the recorded one/, output.slice(-4000));
        } finally {
          cast('rpc', 'anvil_setStorageAt', proxy, slot, original);
          assert.equal(cast('storage', proxy, slot), original, 'the InputVerifier slot is restored');
        }
      });

      const upgradeSkip = noStackReason();
      let curUpgraded = false;

      await t.test(
        'this generation upgrades the live stack through its own CREATE2 coordinator',
        { skip: upgradeSkip },
        async () => {
          announce(
            8,
            STEPS,
            'upgrade with upgrade-cli --stage all (compute, creates, rehearse on a fork, materialize, verify)',
          );
          rmSync(outDirAbs(curRoot), { recursive: true, force: true });
          const { ok, output } = await runCoordinator(curRoot, UPGRADE_CLI, [
            '--config',
            'create2-deploy/anvil-config.json',
            '--rpc-url',
            RPC_URL,
            '--out-dir',
            outDirAbs(curRoot),
            // The SAME deployment id as the deploy, deliberately: `_salt` mixes `cfg.version`, so this
            // generation's against the deploy's already yields a disjoint salt namespace for the same role
            // names. Reusing the id is therefore correct and preferred.
            '--deployment-id',
            DEPLOYMENT_ID,
            // The deploy's own seal, so the upgrade's links to it (the explicit addresses below still win).
            '--previous-manifest',
            join(outDirAbs(prevRoot), 'manifest.json'),
            '--stage',
            'all',
            '--handle',
            handleBefore,
            ...existingAddressArgs(prev),
          ]);
          assert.ok(ok, `create2 upgrade failed:\n${output.slice(-4000)}`);
          curUpgraded = true;
        },
      );

      const needsCur = (st: { skip: (reason: string) => void }): boolean => {
        if (curUpgraded) return false;
        st.skip(upgradeSkip ?? 'the upgrade above failed');
        return true;
      };

      await t.test(
        'the upgrade record links to the deploy by sha256, and is dated by its ACLOwner.upgrade',
        { skip: upgradeSkip },
        (st) => {
          if (needsCur(st)) return;
          const outDir = outDirAbs(curRoot);
          const before = join(outDirAbs(prevRoot), 'manifest.json');
          const previous = sealedManifest(outDir).previous as Record<string, unknown> | undefined;
          assert.ok(previous, 'the upgrade seal has a previous block');
          assert.equal(resolvePath(outDir, String(previous.path)), before, 'previous.path resolves to the deploy seal');
          assert.equal(previous.sha256, createHash('sha256').update(readFileSync(before)).digest('hex'));
          assert.equal(previous.deploymentId, DEPLOYMENT_ID);
          assert.equal(previous.version, sealedManifest(outDirAbs(prevRoot)).version);
          const event = assertStampedRecord(outDir, curRoot, 'upgrade');
          const report = JSON.parse(readFileSync(join(outDir, 'verify-report.json'), 'utf8')) as {
            materializeTx?: string;
          };
          assert.equal(event.defining.hash, report.materializeTx, 'dated by the ACLOwner.upgrade verify found');
        },
      );

      await t.test(
        "the nine re-pointed contracts now report this generation's versions",
        { skip: upgradeSkip },
        async (st) => {
          if (needsCur(st)) return;
          announce(9, STEPS, 'read the new versions back, and HCULimit/CleartextDB unchanged');
          assert.ok(provider);
          const table = contractVersions(curRoot);
          const cur = manifestAddresses(curRoot);
          for (const [role, key] of [
            ['ACL_ADDRESS', 'acl'],
            ['FHEVM_EXECUTOR_ADDRESS', 'fhevmExecutor'],
            ['KMS_VERIFIER_ADDRESS', 'kmsVerifier'],
            ['INPUT_VERIFIER_ADDRESS', 'inputVerifier'],
            ['PROTOCOL_CONFIG_ADDRESS', 'protocolConfig'],
            ['KMS_GENERATION_ADDRESS', 'kmsGeneration'],
            ['CLEARTEXT_ARITHMETIC_ADDRESS', 'cleartextArithmetic'],
            ['PADDED_INPUTTER_ADDRESS', 'paddedInputter'],
            ['PROTOCOL_CONFIG_REPLICA_ADDRESS', 'protocolConfigReplica'],
          ] as const) {
            assert.equal(
              await versionOf(provider, addressOf(cur, role)),
              expectVersion(table, key),
              `${role} -> this generation`,
            );
          }
          // The negative half, which a list of positive expectations cannot give: HCULimit and CleartextDB are
          // deliberately absent from the op list, so a moved version there means something re-pointed a proxy
          // nobody intended to touch. This generation's table holds the previous value, which is what "unchanged"
          // means here.
          const before = contractVersions(prevRoot);
          for (const [role, key] of [
            ['HCU_LIMIT_ADDRESS', 'hcuLimit'],
            ['CLEARTEXT_DB_ADDRESS', 'cleartextDB'],
          ] as const) {
            assert.equal(
              expectVersion(table, key),
              expectVersion(before, key),
              `${key} did not move between generations`,
            );
            assert.equal(
              await versionOf(provider, addressOf(prev, role)),
              expectVersion(before, key),
              `${role} is untouched`,
            );
          }
        },
      );

      await t.test(
        'two proxies were created, PaddedInputter wired into the executor and ProtocolConfigReplica; the rest is the live address set',
        { skip: upgradeSkip },
        async (st) => {
          if (needsCur(st)) return;
          announce(10, STEPS, 'check the sealed address set, the nine implementations, the two created proxies');
          assert.ok(provider);
          const cur = manifestAddresses(curRoot);
          for (const live of LIVE_ROLES) {
            assert.equal(
              addressOf(cur, live).toLowerCase(),
              addressOf(prev, live).toLowerCase(),
              `${live} was re-sealed as is`,
            );
          }
          // The implementations, the created proxy and its empty implementation are the only addresses in this
          // flow that were PREDICTED rather than supplied, so this is where a colliding or wrongly derived salt
          // would show up.
          const predicted = [
            'IMPL_ACL_ADDRESS',
            'IMPL_FHEVM_EXECUTOR_ADDRESS',
            'IMPL_KMS_VERIFIER_ADDRESS',
            'IMPL_INPUT_VERIFIER_ADDRESS',
            'IMPL_PROTOCOL_CONFIG_ADDRESS',
            'IMPL_KMS_GENERATION_ADDRESS',
            'IMPL_CLEARTEXT_ARITHMETIC_ADDRESS',
            'IMPL_PADDED_INPUTTER_ADDRESS',
            'PADDED_INPUTTER_ADDRESS',
            'IMPL_PROTOCOL_CONFIG_REPLICA_ADDRESS',
            'PROTOCOL_CONFIG_REPLICA_ADDRESS',
            'UPGRADE_EMPTY_UUPS_PROXY',
          ] as const;
          for (const role of predicted) {
            const address = addressOf(cur, role);
            assert.notEqual(await provider.getCode(address), '0x', `no code at IMPL_${role}`);
            for (const live of LIVE_ROLES) {
              assert.notEqual(
                address.toLowerCase(),
                addressOf(prev, live).toLowerCase(),
                `${role} collides with ${live}`,
              );
            }
          }

          // The created proxy: past its empty implementation, initialized once by PaddedInputter's own
          // initializer, and the one the new executor bakes.
          const padded = addressOf(cur, 'PADDED_INPUTTER_ADDRESS');
          const slot = await provider.getStorage(padded, IMPLEMENTATION_SLOT);
          assert.equal(
            `0x${slot.slice(-40)}`,
            addressOf(cur, 'IMPL_PADDED_INPUTTER_ADDRESS').toLowerCase(),
            'PaddedInputter runs its sealed implementation',
          );
          const initialized = BigInt(await provider.getStorage(padded, INITIALIZABLE_STORAGE)) & ((1n << 64n) - 1n);
          assert.equal(initialized, 2n, 'PaddedInputter is initialized at reinitializer(2)');
          const executor = view<WiredExecutorView>(
            addressOf(prev, 'FHEVM_EXECUTOR_ADDRESS'),
            WIRED_EXECUTOR_ABI,
            provider,
          );
          assert.equal(
            (await executor.getPaddedInputterAddress()).toLowerCase(),
            padded.toLowerCase(),
            'the upgraded executor calls the created PaddedInputter',
          );

          // The created replica: past its empty implementation, initialized once by `initializeFromCanonical`,
          // which runs at its reinitializer(4).
          const replica = addressOf(cur, 'PROTOCOL_CONFIG_REPLICA_ADDRESS');
          assert.equal(
            `0x${(await provider.getStorage(replica, IMPLEMENTATION_SLOT)).slice(-40)}`,
            addressOf(cur, 'IMPL_PROTOCOL_CONFIG_REPLICA_ADDRESS').toLowerCase(),
            'ProtocolConfigReplica runs its sealed implementation',
          );
          assert.equal(
            BigInt(await provider.getStorage(replica, INITIALIZABLE_STORAGE)) & ((1n << 64n) - 1n),
            4n,
            'ProtocolConfigReplica is initialized at reinitializer(4)',
          );
        },
      );

      await t.test(
        'the upgraded ACL is still a CleartextACL, now reporting this generation',
        { skip: upgradeSkip },
        async (st) => {
          if (needsCur(st)) return;
          assert.ok(provider);
          // The upgrade deploys a fresh ACL implementation of its own. If it ever reinstated the upstream
          // `ACL`, an upgraded stack would silently stop advertising itself and these calls would revert.
          const acl = view<AclView>(addressOf(prev, 'ACL_ADDRESS'), ACL_ABI, provider);
          assert.equal(await acl.IS_CLEARTEXT(), true, 'the upgraded ACL must still advertise IS_CLEARTEXT');
          assert.equal(await acl.CLEARTEXT_PROTOCOL_VERSION(), 15n, 'the upgraded ACL must report 15');
        },
      );

      await t.test(
        '--deployment takes the latest event of the stack folder, so the next upgrade starts from this record',
        { skip: upgradeSkip },
        async (st) => {
          if (needsCur(st)) return;
          // The two records as they would be archived: a stack folder, one numbered folder per event.
          const root = mkdtempSync(join(tmpdir(), 'create2-stack-'));
          try {
            const stack = join(root, DEPLOYMENT_ID);
            const archive = (event: string, kind: string, outDir: string): void => {
              mkdirSync(join(stack, event), { recursive: true });
              for (const file of ['manifest.json', 'addresses.sol', 'journal.jsonl']) {
                cpSync(join(outDir, file), join(stack, event, 'record', file), { recursive: true });
              }
              const config = { deploymentId: DEPLOYMENT_ID, admin: sealedManifest(outDir).admin, outDir: 'record' };
              writeFileSync(join(stack, event, `${kind}.config.json`), JSON.stringify(config));
            };
            archive('00-deploy-v0.0-2026-01-01', 'deploy', outDirAbs(prevRoot));
            archive('01-upgrade-v1.0-2026-01-02', 'upgrade', outDirAbs(curRoot));
            const latest = join(stack, '01-upgrade-v1.0-2026-01-02', 'record', 'manifest.json');

            const { ok, output } = await runCoordinator(curRoot, UPGRADE_CLI, [
              '--deployment',
              stack,
              '--rpc-url',
              RPC_URL,
              '--out-dir',
              join(root, 'next', 'record'),
              '--stage',
              'compute',
            ]);
            // Accepted as the previous manifest, all eleven roles from it...
            assert.ok(
              output.includes(`previous         ${latest}`),
              `the latest event's seal is the previous:\n${output.slice(-3000)}`,
            );
            assert.match(output, /11\/11 roles/);
            // ...and then refused: the live stack is already the generation this tool upgrades to.
            assert.ok(!ok, 'compute must refuse a stack that is already upgraded');
          } finally {
            rmSync(root, { recursive: true, force: true });
          }
        },
      );

      await t.test('ownership and the pauser set survived the upgrade', { skip: upgradeSkip }, async (st) => {
        if (needsCur(st)) return;
        assert.ok(provider);
        // The invariant that makes the whole operation safe, and the one every version check above would
        // pass without noticing: an upgrade may move code, never authority.
        const acl = view<AclView>(addressOf(prev, 'ACL_ADDRESS'), ACL_ABI, provider);
        const aclOwner = view<OwnableView>(addressOf(prev, 'ACL_OWNER'), OWNABLE_ABI, provider);

        assert.equal(await acl.owner(), ownerBefore, 'ACL.owner() unchanged');
        assert.equal(await aclOwner.owner(), adminBefore, 'ACLOwner.owner() unchanged');
        assert.equal(await acl.pendingOwner(), ZERO, 'no ACL transfer was even started');
        assert.equal(await aclOwner.pendingOwner(), ZERO, 'no ACLOwner transfer was even started');
        assert.equal(
          (await acl.getPauserSetAddress()).toLowerCase(),
          pauserSetBefore.toLowerCase(),
          'the ACL still points at the same PauserSet',
        );
        const pauserSet = view<PauserSetView>(pauserSetBefore, PAUSER_SET_ABI, provider);
        assert.equal(await pauserSet.isPauser(addressOf(prev, 'ACL_OWNER')), true, 'ACLOwner is still a pauser');
      });

      /**
       * The already-upgraded path. An interrupted run is resumed by re-running the same command, so every
       * stage must recognize a stack that has already been upgraded and finish rather than fail — and the
       * one stage that would be dangerous to repeat, `compute`, must refuse.
       */
      await t.test(
        'an already-upgraded stack is recognized: all resumes, compute refuses',
        { skip: upgradeSkip },
        async (st) => {
          if (needsCur(st)) return;
          const common = [
            '--config',
            'create2-deploy/anvil-config.json',
            '--rpc-url',
            RPC_URL,
            '--out-dir',
            outDirAbs(curRoot),
            '--deployment-id',
            DEPLOYMENT_ID,
            ...existingAddressArgs(prev),
          ];

          announce(
            11,
            STEPS,
            're-run --stage all on the upgraded stack (must resume and send nothing), status, compute must refuse',
          );
          const again = await runCoordinator(curRoot, UPGRADE_CLI, [
            ...common,
            '--stage',
            'all',
            '--handle',
            handleBefore,
          ]);
          assert.ok(again.ok, `second --stage all failed:\n${again.output.slice(-4000)}`);
          assert.match(again.output, /Compute: already sealed .* skipping/, 'compute is skipped, from the chain');
          assert.match(again.output, /already present 12/, 'no create is re-sent');
          assert.match(again.output, /already materialized; run verify/, 'the gate recognizes the upgraded stack');
          assert.match(again.output, /nothing left to rehearse/, 'the rehearsal steps aside');
          assert.match(again.output, /materialize already complete/, 'the atomic call is not repeated');
          assert.match(again.output, /OK - every terminal condition for the upgrade/, 'verify still holds');

          note('status');
          const status = await runCoordinator(curRoot, UPGRADE_CLI, [...common, '--stage', 'status']);
          assert.ok(status.ok, status.output.slice(-2000));
          assert.match(status.output, /materialize: done/, status.output.slice(-2000));

          // The init calls: seven no-argument reinitializers, then PaddedInputter's initializer with the sealed PRFs,
          // then the replica's with its sealed seed.
          note('params');
          const params = await runCoordinator(curRoot, UPGRADE_CLI, [...common, '--stage', 'params']);
          assert.ok(params.ok, params.output.slice(-2000));
          for (const call of [
            'ACL.reinitializeV6()',
            'FHEVMExecutor.reinitializeV7()',
            'KMSVerifier.reinitializeV5()',
            'InputVerifier.reinitializeV3()',
            'ProtocolConfig.reinitializeV3()',
            'KMSGeneration.reinitializeV3()',
            'CleartextArithmetic.reinitializeV4()',
            'PaddedInputter.initializeFromEmptyProxy(uint16[] initialPrfInstances)',
            'ProtocolConfigReplica.initializeFromCanonical(',
          ]) {
            assert.ok(params.output.includes(call), `params lists ${call}:\n${params.output.slice(-2000)}`);
          }
          assert.ok(
            params.output.includes(`initialPrfInstances: [${String(CLEARTEXT_PAD_PRF_INSTANCE)}]`),
            `params shows the default PRF instance:\n${params.output.slice(-2000)}`,
          );

          note('compute must refuse (expect an Error below)');
          const recompute = await runCoordinator(curRoot, UPGRADE_CLI, [...common, '--stage', 'compute']);
          assert.equal(recompute.ok, false, 'compute must refuse once contracts are on chain');
          assert.match(recompute.output, /already put contracts on chain/, recompute.output.slice(-2000));
        },
      );
    } finally {
      provider?.destroy();
      killNode();
      process.off('exit', killNode);
      rmSync(outDirAbs(PREVIOUS_GENERATION_DIR_ABS_PATH), { recursive: true, force: true });
      rmSync(outDirAbs(PACKAGE_ROOT_ABS_PATH), { recursive: true, force: true });
      rmSync(outDirAbs(PACKAGE_ROOT_ABS_PATH, NEGATIVE_OUT_DIR_ARG), { recursive: true, force: true });
    }
  },
);
