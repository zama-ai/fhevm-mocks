// A hotfix, as it happens in real life: the stack is deployed by the current release, and the NEXT release
// (a patch of the same generation) hotfixes it.
//
//   1. a fresh anvil; this package's deploy-cli deploys the stack, archived as `00-deploy-v<N>.<p>-<day>`
//   2. a copy of this package becomes the next patch: package version +1, and CleartextDB hotfixed —
//      MINOR_VERSION +1, REINITIALIZER_VERSION +1 with its no-argument `reinitializeV<old>()`, and a new
//      `helloWorld()`; its version table regenerated. This checkout is never edited.
//   3. the copy's hotfix-cli, given the stack folder, re-points exactly CleartextDB in one ACLOwner.upgrade
//      calling `reinitializeV<old>()`, after a rehearsal on a fork
//   4. checks: only CleartextDB moved; it reports the new version, is initialized at the new reinitializer,
//      answers `helloWorld()`; the record is archived as `01-hotfix-…` and `check deployments` accepts the
//      stack's history; a second run is refused (nothing newer than the latest record)
//
// Run: npm run test:create2-hotfix-e2e (also the last step of the package's `test`): a deploy, a second
// build in the copy and a hotfix take a few minutes.

import assert from 'node:assert/strict';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  readdirSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative } from 'node:path';
import test from 'node:test';
import { PACKAGE_ROOT_ABS_PATH, WORKSPACE_ROOT_ABS_PATH } from '../../internal/constants.ts';

/** Away from the other e2e anvils (8557 upgrade, 8558 create2-deploy). */
const PORT = 8559;
const RPC_URL = `http://127.0.0.1:${String(PORT)}`;
const CHAIN_FOLDER = 'anvil';
const STACK = 'create2-hotfix-e2e';
const INITIALIZABLE_STORAGE = '0xf0c57e16840df040f15088dc2f81fe391c3923bec73e23a9662efc9c229c6a00';
const PROXY_ROLES = [
  'ACL_ADDRESS',
  'FHEVM_EXECUTOR_ADDRESS',
  'KMS_VERIFIER_ADDRESS',
  'INPUT_VERIFIER_ADDRESS',
  'HCU_LIMIT_ADDRESS',
  'PROTOCOL_CONFIG_ADDRESS',
  'KMS_GENERATION_ADDRESS',
  'CLEARTEXT_ARITHMETIC_ADDRESS',
  'CLEARTEXT_DB_ADDRESS',
] as const;
/** What the record folders must not keep: forge scratch (check deployments refuses it). */
const SCRATCH = ['build', 'build-check', 'broadcast', 'cache', '.foundry', 'pass2.json', 'rehearsal'];

const ROOT = realpathSync(mkdtempSync(join(tmpdir(), 'create2-hotfix-e2e-')));
/** A workspace holding only the stack's records, for `fhevm-npm check deployments --root`. */
const WS = join(ROOT, 'ws');
const STACK_DIR = join(WS, 'deployments', CHAIN_FOLDER, STACK);
/** The copy of this repository that becomes the next patch. */
const COPY_REPO = join(ROOT, 'repo');
const COPY = join(COPY_REPO, relative(WORKSPACE_ROOT_ABS_PATH, PACKAGE_ROOT_ABS_PATH));

////////////////////////////////////////////////////////////////////////////////
// Harness
////////////////////////////////////////////////////////////////////////////////

function blockedReason(): string | undefined {
  for (const bin of ['anvil', 'forge', 'cast'] as const) {
    if (spawnSync(bin, ['--version'], { stdio: 'ignore' }).status !== 0) return `${bin} not found — install foundry`;
  }
  return undefined;
}

async function nodeAnswers(): Promise<boolean> {
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

/** A coordinator run, its output captured (and streamed unless CREATE2_E2E_QUIET=1). */
function run(command: string, args: readonly string[], cwd: string): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, [...args], { cwd, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    const onData = (chunk: Buffer): void => {
      output += chunk.toString();
      if (process.env.CREATE2_E2E_QUIET !== '1') process.stderr.write(chunk.toString().replace(/^/gm, '    │ '));
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('close', (code) => {
      resolve({ ok: code === 0, output });
    });
  });
}

function cast(...args: string[]): string {
  const r = spawnSync('cast', [...args, '--rpc-url', RPC_URL], { encoding: 'utf8' });
  assert.equal(r.status, 0, `cast ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
}

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;
const implementationOf = (proxy: string): string =>
  `0x${cast('storage', proxy, '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc').slice(-40)}`;
const initializedVersionOf = (proxy: string): number =>
  Number(BigInt(`0x${cast('storage', proxy, INITIALIZABLE_STORAGE).slice(-16)}`));

type Manifest = {
  readonly packageVersion?: string;
  readonly address: Readonly<Record<string, string>>;
  readonly repointed?: readonly string[];
  readonly reinitialize?: Readonly<Record<string, { call: string; from: number; to: number }>>;
  readonly toolCommit?: string | null;
};

/** `<seq>-<kind>-v<N>.<p>-<UTC day of the defining transaction's block>` for an operator folder. */
function eventFolderName(operator: string, seq: string, kind: string): string {
  const manifest = readJson<Manifest>(join(operator, 'record', 'manifest.json'));
  const event = readJson<{ defining: { blockTimestamp: number } }>(join(operator, 'record', 'event.json'));
  const [, generation, patch] = /^0\.(\d+)\.(\d+)$/.exec(manifest.packageVersion ?? '') ?? [];
  assert.ok(generation !== undefined && patch !== undefined, `no packageVersion in ${operator}`);
  const day = new Date(event.defining.blockTimestamp * 1000).toISOString().slice(0, 10);
  return `${seq}-${kind}-v${generation}.${patch}-${day}`;
}

/** Copy an operator folder into the stack as an event folder: no scratch, the tool commit written. */
function archive(operator: string, name: string, toolCommit: string): string {
  const target = join(STACK_DIR, name);
  cpSync(operator, target, { recursive: true });
  for (const scratch of SCRATCH) rmSync(join(target, 'record', scratch), { recursive: true, force: true });
  writeFileSync(join(target, 'tool-commit.txt'), `${toolCommit}\n`);
  return target;
}

/**
 * This package's sources, copied; the heavy or shared folders linked, never copied. The repository root keeps
 * only its package.json (the workspace marker the package's own constants look for), foundry.base.toml (which
 * the package's foundry.toml extends) and node_modules.
 */
function copyPackage(): void {
  const skip = new Set(['node_modules', 'dependencies', 'out', 'out-create2', 'out-forgefhevmcore', 'cache']);
  mkdirSync(dirname(COPY), { recursive: true });
  cpSync(PACKAGE_ROOT_ABS_PATH, COPY, {
    recursive: true,
    filter: (source) => {
      const name = basename(source);
      if (source === PACKAGE_ROOT_ABS_PATH) return true;
      if (dirname(source) === PACKAGE_ROOT_ABS_PATH && skip.has(name)) return false;
      return !name.startsWith('.out') && name !== 'node_modules';
    },
  });
  symlinkSync(join(PACKAGE_ROOT_ABS_PATH, 'dependencies'), join(COPY, 'dependencies'));
  symlinkSync(join(WORKSPACE_ROOT_ABS_PATH, 'node_modules'), join(COPY_REPO, 'node_modules'));
  cpSync(join(WORKSPACE_ROOT_ABS_PATH, 'package.json'), join(COPY_REPO, 'package.json'));
  // The shared forge settings the package's foundry.toml extends.
  cpSync(join(WORKSPACE_ROOT_ABS_PATH, 'foundry.base.toml'), join(COPY_REPO, 'foundry.base.toml'));
  // The other generations beside it: the previous one is a workspace dependency, and forge's remapping reaches it.
  for (const sibling of readdirSync(dirname(PACKAGE_ROOT_ABS_PATH))) {
    if (sibling === basename(PACKAGE_ROOT_ABS_PATH)) continue;
    symlinkSync(join(dirname(PACKAGE_ROOT_ABS_PATH), sibling), join(dirname(COPY), sibling));
  }
}

/** What the next patch changes in CleartextDB, from the numbers it has now. */
type Hotfix = { minorFrom: number; reinitFrom: number; packageFrom: string; packageTo: string };

/** Turn the copy into the next patch: package version +1 and the CleartextDB hotfix; versions regenerated. */
function makeNextPatch(): Hotfix {
  const pkgPath = join(COPY, 'pkg', 'package.json');
  const pkg = readJson<{ version: string }>(pkgPath);
  const [, generation, patch] = /^0\.(\d+)\.(\d+)$/.exec(pkg.version) ?? [];
  assert.ok(generation !== undefined && patch !== undefined, `pkg version ${pkg.version}`);
  const packageTo = `0.${generation}.${String(Number(patch) + 1)}`;
  writeFileSync(
    pkgPath,
    readFileSync(pkgPath, 'utf8').replace(`"version": "${pkg.version}"`, `"version": "${packageTo}"`),
  );

  const dbPath = join(COPY, 'pkg', 'src', 'cleartext', 'CleartextDB.sol');
  let db = readFileSync(dbPath, 'utf8');
  const minor = /uint256 private constant MINOR_VERSION = (\d+);/.exec(db);
  const reinit = /uint64 private constant REINITIALIZER_VERSION = (\d+);/.exec(db);
  assert.ok(minor?.[1] !== undefined && reinit?.[1] !== undefined, 'CleartextDB declares MINOR and REINITIALIZER');
  const minorFrom = Number(minor[1]);
  const reinitFrom = Number(reinit[1]);
  db = db
    .replace(minor[0], `uint256 private constant MINOR_VERSION = ${String(minorFrom + 1)};`)
    .replace(reinit[0], `uint64 private constant REINITIALIZER_VERSION = ${String(reinitFrom + 1)};`);
  const end = db.lastIndexOf('}');
  db = `${db.slice(0, end)}
    /**
     * @notice Re-initializes the contract from V${String(reinitFrom)}.
     */
    /// @custom:oz-upgrades-unsafe-allow missing-initializer-call
    /// @custom:oz-upgrades-validate-as-initializer
    function reinitializeV${String(reinitFrom)}() public virtual reinitializer(REINITIALIZER_VERSION) {}

    /// @notice New in this patch: what the previous CleartextDB did not have.
    function helloWorld() external pure returns (string memory) {
        return "hello world";
    }
${db.slice(end)}`;
  writeFileSync(dbPath, db);

  const regenerated = spawnSync('node', ['internal/cli/generateContractVersions.ts'], { cwd: COPY, encoding: 'utf8' });
  assert.equal(regenerated.status, 0, `regenerating the copy's versions: ${regenerated.stderr}`);
  return { minorFrom, reinitFrom, packageFrom: pkg.version, packageTo };
}

function gitHead(): string {
  return spawnSync('git', ['-C', PACKAGE_ROOT_ABS_PATH, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
}

////////////////////////////////////////////////////////////////////////////////
// The test
////////////////////////////////////////////////////////////////////////////////

void test(
  'a hotfix of CleartextDB by the next patch, on a stack the current release deployed',
  { skip: blockedReason() },
  async (t) => {
    if (await nodeAnswers()) {
      t.skip(`port ${String(PORT)} is in use; stop whatever holds it`);
      return;
    }
    const anvil: ChildProcess = spawn('anvil', ['--port', String(PORT), '--silent'], { stdio: 'ignore' });
    t.after(() => {
      anvil.kill('SIGTERM');
      rmSync(ROOT, { recursive: true, force: true });
    });
    for (let i = 0; i < 100 && !(await nodeAnswers()); i++) await new Promise((r) => setTimeout(r, 200));
    assert.ok(await nodeAnswers(), `anvil did not answer on ${RPC_URL}`);

    mkdirSync(STACK_DIR, { recursive: true });
    writeFileSync(
      join(WS, 'fhevm-chains.config.json'),
      JSON.stringify({ networks: { local: { hosts: { [CHAIN_FOLDER]: { id: 31337 } } } } }),
    );

    // 1. The current release deploys the stack; archived as the stack's first event.
    const deployOps = join(ROOT, 'ops', 'deploy');
    mkdirSync(deployOps, { recursive: true });
    writeFileSync(
      join(deployOps, 'deploy.config.json'),
      JSON.stringify({
        rpcUrl: RPC_URL,
        deploymentId: STACK,
        outDir: 'record',
        confirmations: 0,
        finality: false,
        git: false,
      }),
    );
    const deployed = await run(
      join(PACKAGE_ROOT_ABS_PATH, 'create2-deploy', 'deploy-cli'),
      ['--stage', 'all'],
      deployOps,
    );
    assert.ok(deployed.ok, `deploy failed:\n${deployed.output.slice(-3000)}`);
    const deployManifest = readJson<Manifest>(join(deployOps, 'record', 'manifest.json'));
    const deployFolder = archive(
      deployOps,
      eventFolderName(deployOps, '00', 'deploy'),
      deployManifest.toolCommit ?? gitHead(),
    );

    // 2. The next patch, in a copy: CleartextDB hotfixed, versions regenerated.
    copyPackage();
    const fix = makeNextPatch();

    // 3. The next patch's hotfix-cli, from the stack folder.
    const hotfixCli = join(COPY, 'create2-deploy', 'hotfix-cli');
    const hotfixArgs = ['--deployment', STACK_DIR, '--confirmations', '0', '--no-finality', '--no-git'];
    const hotfixOps = join(ROOT, 'ops', 'hotfix');
    // Run from ANOTHER folder than the operator's, as an operator often does (from the repository root): the
    // operator's folder is the out dir's parent, where the event's config and `previous.path` must point.
    const hotfixed = await run(
      hotfixCli,
      [...hotfixArgs, '--out-dir', join(hotfixOps, 'record'), '--no-confirm', '--stage', 'all'],
      ROOT,
    );
    assert.ok(hotfixed.ok, `hotfix failed:\n${hotfixed.output.slice(-4000)}`);
    assert.match(hotfixed.output, /REHEARSAL PASSED/);

    // 4. Exactly CleartextDB moved, running the new code.
    const manifest = readJson<Manifest>(join(hotfixOps, 'record', 'manifest.json'));
    assert.deepEqual(manifest.repointed, ['CLEARTEXT_DB_ADDRESS'], 'only CleartextDB is re-pointed');
    assert.deepEqual(manifest.reinitialize, {
      CLEARTEXT_DB_ADDRESS: {
        call: `reinitializeV${String(fix.reinitFrom)}()`,
        from: fix.reinitFrom,
        to: fix.reinitFrom + 1,
      },
    });
    const db = deployManifest.address.CLEARTEXT_DB_ADDRESS ?? '';
    assert.equal(implementationOf(db).toLowerCase(), (manifest.address.IMPL_CLEARTEXT_DB_ADDRESS ?? '').toLowerCase());
    assert.equal(cast('call', db, 'getVersion()(string)'), `"CleartextDB v0.${String(fix.minorFrom + 1)}.0"`);
    assert.equal(initializedVersionOf(db), fix.reinitFrom + 1, 'the proxy is initialized at the new reinitializer');
    assert.equal(cast('call', db, 'helloWorld()(string)'), '"hello world"');
    for (const role of PROXY_ROLES.filter((r) => r !== 'CLEARTEXT_DB_ADDRESS')) {
      assert.equal(
        implementationOf(deployManifest.address[role] ?? '').toLowerCase(),
        (deployManifest.address[`IMPL_${role}`] ?? '').toLowerCase(),
        `${role} still runs what the deploy installed`,
      );
    }
    assert.equal(readJson<{ kind: string }>(join(hotfixOps, 'record', 'event.json')).kind, 'hotfix');
    assert.ok(existsSync(join(hotfixOps, 'hotfix.config.json')), "the event's config is in the operator's folder");

    // The record: archived next to the deploy, and the stack's history accepted, link by link.
    archive(hotfixOps, eventFolderName(hotfixOps, '01', 'hotfix'), gitHead());
    assert.ok(existsSync(deployFolder));
    const checked = spawnSync(
      'node',
      [join(WORKSPACE_ROOT_ABS_PATH, 'fhevm-npm', 'fhevm-npm.ts'), 'check', 'deployments', '--root', WS],
      {
        encoding: 'utf8',
      },
    );
    assert.equal(checked.status, 0, `check deployments refused the stack:\n${checked.stdout}${checked.stderr}`);

    // A second hotfix from the same patch: the latest record is that patch now, nothing newer to bring.
    const againOps = join(ROOT, 'ops', 'hotfix-again');
    mkdirSync(againOps, { recursive: true });
    const again = await run(
      hotfixCli,
      [...hotfixArgs, '--out-dir', join(againOps, 'record'), '--no-confirm', '--stage', 'compute'],
      againOps,
    );
    assert.equal(again.ok, false, 'a second hotfix by the same patch must be refused');
    assert.match(
      again.output,
      new RegExp(
        `is not newer than the one the latest record was made with \\(${fix.packageTo.replace(/\./g, '\\.')}\\)`,
      ),
    );
  },
);
