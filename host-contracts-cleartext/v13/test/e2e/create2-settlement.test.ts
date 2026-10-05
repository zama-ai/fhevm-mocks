// The CREATE2 deploy's safety between stages, and its journal, against a chain that actually advances.
//
// Run: npm run test:create2-deploy-e2e
//
// The sibling `create2-deploy.test.ts` runs with `confirmations: 0` on an anvil that mines only when sent
// a transaction, so every prerequisite is settled the instant it is mined and nothing ever waits. This one
// mines a block every second and settles 3 blocks deep, so the decisions it is about are real ones:
//
//   - a stage starts only once what it depends on holds at the SETTLED block, waits when it holds only at
//     the head, and refuses when it does not hold at all;
//   - a resumed run decides from the chain alone: no waits, nothing re-sent;
//   - the journal records block hash, sender, nonce, stage-start anchors and finality, and completes
//     itself after an interruption — from forge's own records, or from the chain by nonce.
//
// Same policies as the sibling: a private port checked for occupancy, an operator folder outside the
// repository, skips that name what is missing, a cleanup that leaves nothing behind.

import assert from 'node:assert/strict';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { PACKAGE_ROOT_ABS_PATH } from '../../internal/constants.ts';

////////////////////////////////////////////////////////////////////////////////
// Configuration
////////////////////////////////////////////////////////////////////////////////

/** Away from 8557 (upgrade) and 8558 (fresh deploy), and from every `startAnvil` port (86xx). */
const PORT = 8559;
const RPC_URL = `http://127.0.0.1:${PORT}`;
const CONFIRMATIONS = 3;

const OPERATOR_DIR = mkdtempSync(join(tmpdir(), 'create2-settlement-e2e-'));
const DEPLOY_CLI = join(PACKAGE_ROOT_ABS_PATH, 'create2-deploy', 'deploy-cli');

/** The main deployment: `out/`, from `deploy.config.json`. A second one, `out2/`, is driven by flags. */
const OUT = join(OPERATOR_DIR, 'out');
const OUT2_ARGS = ['--deployment-id', 'settlement-e2e-2', '--out-dir', 'out2'] as const;

////////////////////////////////////////////////////////////////////////////////
// Harness
////////////////////////////////////////////////////////////////////////////////

function haveBinary(name: string): boolean {
  return spawnSync(name, ['--version'], { stdio: 'ignore' }).status === 0;
}

function blockedReason(): string | undefined {
  for (const bin of ['anvil', 'forge'] as const) {
    if (!haveBinary(bin)) return `${bin} not found — install foundry (https://getfoundry.sh)`;
  }
  return undefined;
}

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

const QUIET = process.env.CREATE2_E2E_QUIET === '1';
const STARTED_AT = Date.now();

function announce(what: string): void {
  process.stderr.write(`\n[settlement] ${what}  (+${((Date.now() - STARTED_AT) / 1000).toFixed(0)}s)\n`);
}

/** Runs deploy-cli from the operator folder, streaming AND capturing its output. */
function deployCli(args: readonly string[]): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(DEPLOY_CLI, args, { cwd: OPERATOR_DIR, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
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

type Line = {
  readonly kind?: string;
  readonly stage?: string;
  readonly hash?: string | null;
  readonly blockHash?: string | null;
  readonly from?: string | null;
  readonly nonce?: number | null;
  readonly status?: string;
  readonly recovered?: string;
};

function journalPath(out = OUT): string {
  return join(out, 'journal.jsonl');
}

function journal(out = OUT): Line[] {
  if (!existsSync(journalPath(out))) return [];
  return readFileSync(journalPath(out), 'utf8')
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l) as Line);
}

function writeJournal(lines: readonly Line[], out = OUT): void {
  writeFileSync(journalPath(out), lines.map((l) => `${JSON.stringify(l)}\n`).join(''));
}

/** The transaction lines with a hash, one per hash: the last line wins, as the coordinator reads them. */
function transactions(out = OUT): Line[] {
  const byHash = new Map<string, Line>();
  for (const line of journal(out)) {
    if ((line.kind ?? 'tx') === 'tx' && typeof line.hash === 'string') byHash.set(line.hash, line);
  }
  return [...byHash.values()];
}

////////////////////////////////////////////////////////////////////////////////
// The test
////////////////////////////////////////////////////////////////////////////////

void test(
  'create2-deploy: settled prerequisites and a complete journal, on a chain that advances',
  { skip: blockedReason() },
  async (t) => {
    if (await portIsOpen()) {
      t.skip(`something is already listening on ${RPC_URL} — refusing to deploy onto it`);
      return;
    }

    let node: ChildProcess | undefined;
    const killNode = (): void => {
      if (node?.exitCode === null && node.signalCode === null) node.kill('SIGTERM');
    };

    try {
      announce(`start anvil on ${RPC_URL}, one block per second`);
      node = spawn('anvil', ['--silent', '--host', '127.0.0.1', '--port', String(PORT), '--block-time', '1'], {
        stdio: 'ignore',
      });
      process.on('exit', killNode);
      await waitForNode(60_000);
      writeFileSync(
        join(OPERATOR_DIR, 'deploy.config.json'),
        `${JSON.stringify({
          rpcUrl: RPC_URL,
          deploymentId: 'settlement-e2e',
          outDir: 'out',
          confirmations: CONFIRMATIONS,
          finality: false,
          git: false,
        })}\n`,
      );

      let deployed = false;
      const needsStack = (st: { skip: (reason: string) => void }): boolean => {
        if (deployed) return false;
        st.skip('the deploy above failed, so there is nothing to inspect');
        return true;
      };

      await t.test('every stage waits until what it depends on is settled', async () => {
        announce('deploy-cli --stage all, 3 blocks deep');
        const { ok, output } = await deployCli(['--stage', 'all']);
        assert.ok(ok, `the deploy failed:\n${output.slice(-4000)}`);
        assert.match(output, /OK - every terminal condition/);
        // On a chain that advances, the stage right after a sending stage finds its prerequisites mined but
        // not yet 3 deep: it must wait, then go.
        assert.match(output, /waiting for \d+ prerequisite\(s\) of C to be settled/, 'C waited for A and B');
        assert.match(output, /✔ C: every prerequisite is settled/, 'then C went');
        assert.match(output, /✔ verify: /, 'verify read a settled step F');
        deployed = true;
      });

      await t.test('the journal records block hash, sender, nonce, anchors and finality', (st) => {
        if (needsStack(st)) return;
        const txs = transactions();
        assert.equal(txs.length, 28, '22 creates + steps A to F');
        for (const tx of txs) {
          assert.match(tx.blockHash ?? '', /^0x[0-9a-f]{64}$/, `${tx.hash ?? '?'}: block hash`);
          assert.match(tx.from ?? '', /^0x[0-9a-f]{40}$/, `${tx.hash ?? '?'}: sender`);
          assert.equal(typeof tx.nonce, 'number', `${tx.hash ?? '?'}: nonce`);
          assert.equal(tx.status, 'ok', `${tx.hash ?? '?'}: status`);
        }
        const lines = journal();
        assert.equal(lines.filter((l) => l.kind === 'stage-start').length, 7, 'one anchor per sending stage');
        // The last transaction (F) may still be inside the 3-block margin when the run ends; every other is final.
        assert.ok(lines.filter((l) => l.kind === 'finalized').length >= 27, 'finality recorded');
      });

      await t.test('a resumed run decides from the chain: no wait, nothing sent', async (st) => {
        if (needsStack(st)) return;
        announce('deploy-cli --stage all again');
        const before = transactions().length;
        const { ok, output } = await deployCli(['--stage', 'all']);
        assert.ok(ok, output.slice(-4000));
        assert.match(output, /already present 22/);
        assert.doesNotMatch(output, /waiting for \d+ prerequisite/, 'everything was settled: no stage may wait');
        assert.equal(transactions().length, before, 'nothing may be sent');
      });

      await t.test("journal lines lost before they were written come back from forge's records", async (st) => {
        if (needsStack(st)) return;
        announce('case 2: the creates lines removed, forge files kept');
        writeJournal(journal().filter((l) => (l.stage !== 'creates' || l.kind === 'stage-start') && l.kind !== 'finalized'));
        const { ok, output } = await deployCli(['--stage', 'status']);
        assert.ok(ok, output.slice(-3000));
        const creates = transactions().filter((tx) => tx.stage === 'creates');
        assert.equal(creates.length, 22);
        assert.ok(creates.every((tx) => tx.recovered === 'broadcast-file'));
      });

      await t.test('a transaction with no record at all is found on chain by nonce', async (st) => {
        if (needsStack(st)) return;
        announce("case 3: step A's line AND its forge files removed, its anchor kept");
        const stepAHash = transactions().find((tx) => tx.stage === "A/A'")?.hash;
        assert.ok(typeof stepAHash === 'string', 'step A has a transaction');
        writeJournal(journal().filter((l) => l.hash !== stepAHash));
        rmSync(join(OUT, 'broadcast', 'FhevmRegisterPausers.s.sol'), { recursive: true, force: true });
        const { ok, output } = await deployCli(['--stage', 'status']);
        assert.ok(ok, output.slice(-3000));
        const recovered = transactions().find((tx) => tx.recovered === 'nonce-scan');
        assert.equal(recovered?.hash, stepAHash, 'the very same transaction');
        assert.equal(recovered.stage, "A/A'", 'attributed to its stage from the anchor');
      });

      await t.test('a no-hash line is shown only when it is an observation', async (st) => {
        if (needsStack(st)) return;
        // Older journals hold no-hash `unmined` lines for transactions forge planned and never signed.
        appendFileSync(
          journalPath(),
          `${JSON.stringify({ stage: "A/A'", hash: null, function: 'addPauser(address)', block: null, status: 'unmined' })}\n` +
            `${JSON.stringify({ stage: 'F', observed: true, note: 'admin accepted (observed)', block: 1, hash: null, status: 'ok' })}\n`,
        );
        const log = await deployCli(['--stage', 'log']);
        assert.ok(log.ok, log.output);
        assert.doesNotMatch(log.output, /A\/A'\s+unmined/, 'a planned-but-never-sent line is not a transaction');
        assert.match(log.output, /admin accepted \(observed\)/, 'an observation still is');
        const report = await deployCli(['--stage', 'report']);
        assert.ok(report.ok, report.output);
        assert.doesNotMatch(report.output, /unmined/);
      });

      await t.test('a stage whose prerequisites are not on chain at all is refused', async (st) => {
        if (needsStack(st)) return;
        announce('a second deployment: compute and creates only, then step C');
        const compute = await deployCli([...OUT2_ARGS, '--stage', 'compute']);
        assert.ok(compute.ok, compute.output.slice(-3000));
        const creates = await deployCli([...OUT2_ARGS, '--stage', 'creates']);
        assert.ok(creates.ok, creates.output.slice(-3000));
        const early = await deployCli([...OUT2_ARGS, '--stage', 'accept-acl']);
        assert.equal(early.ok, false, 'C must not start before A and B');
        assert.match(early.output, /C cannot start: not done on chain yet/);
        assert.match(early.output, /A: PauserSet\.isPauser\(ACLOwner\)/);
        assert.match(early.output, /B: ACL ownership offered/);
      });

      await t.test('a dry run reports what is not settled yet, and does not wait', async (st) => {
        if (needsStack(st)) return;
        for (const stage of ['pausers', 'offer-acl']) {
          const r = await deployCli([...OUT2_ARGS, '--stage', stage]);
          assert.ok(r.ok, r.output.slice(-3000));
        }
        // 60 blocks deep: whatever A and B just wrote cannot be settled yet, however slow this machine is.
        const dry = await deployCli([...OUT2_ARGS, '--stage', 'accept-acl', '--dry-run', '--confirmations', '60']);
        assert.ok(dry.ok, dry.output.slice(-3000));
        assert.match(dry.output, /done at the head but not yet settled/);
        assert.match(dry.output, /A real run would wait for them/);
      });
    } finally {
      killNode();
      process.off('exit', killNode);
      rmSync(OPERATOR_DIR, { recursive: true, force: true });
    }
  },
);
