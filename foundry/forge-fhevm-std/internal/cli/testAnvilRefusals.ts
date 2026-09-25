// Verifies what the SDK SAYS when it cannot provision an anvil node.
//
// WHY THIS IS NOT A FORGE TEST. Every case here needs the node in a state a forge test cannot establish:
// a deployer that has already been used, or a node that accepts `anvil_setCode` and does nothing with it.
// Forge owns the fork, caches it per url, and restores it between tests, so a test that tries to set up
// its own node ends up asserting about a fork forge handed it from before the setup ran. Here the node is
// arranged first, from outside, and forge is started afterwards against it.
//
// WHAT IT ASSERTS. That the run FAILS, and that the failure names the cause. Not the whole message -- a
// fragment, so wording can be improved without breaking this -- but a fragment specific enough that a
// different failure cannot satisfy it.
//
//   npm run test:anvil-refusals          # via with-anvil.sh, which owns the real node
import { spawn } from 'node:child_process';
import { createServer, request as httpRequest, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

function nodeUrl(): string {
  const configured = process.env.ANVIL_RPC_URL;
  if (configured === undefined || configured === '') {
    console.error('no ANVIL_RPC_URL: run this through `npm run test:anvil-refusals`, which starts the node.');
    process.exit(1);
  }
  return configured;
}

const NODE_URL = nodeUrl();

/** The account the local stack deploys from — `LocalHostAddresses.DEPLOYER_ADDRESS`. */
const DEPLOYER = '0x8B8f5091f8b9817EF69cFC1E8B2f721BafF60DF4';

type Sabotage = {
  /** The method to interfere with, or undefined for a proxy that only forwards. */
  readonly method?: string;
  /** `refuse`: answer a JSON-RPC error. `swallow`: answer success without forwarding. */
  readonly how?: 'refuse' | 'swallow';
};

async function rpc(url: string, method: string, params: unknown[]): Promise<unknown> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  return ((await response.json()) as { result?: unknown }).result;
}

/**
 * A JSON-RPC proxy in front of the real node. Everything is forwarded except the one method a case wants
 * to break — which is how `anvil_setCode succeeded and did nothing` becomes reproducible at all, rather
 * than a state nobody can produce on purpose.
 */
function startProxy(sabotage: Sabotage): Promise<{ url: string; close: () => Promise<void> }> {
  const upstream = new URL(NODE_URL);
  const server: Server = createServer((incoming, outgoing) => {
    let body = '';
    incoming.on('data', (chunk) => {
      body += String(chunk);
    });
    incoming.on('end', () => {
      const parsed = JSON.parse(body) as { id?: unknown; method?: string };
      if (sabotage.method !== undefined && parsed.method === sabotage.method) {
        const answer =
          sabotage.how === 'refuse'
            ? { jsonrpc: '2.0', id: parsed.id, error: { code: -32601, message: `${sabotage.method} is not available` } }
            : { jsonrpc: '2.0', id: parsed.id, result: null };
        outgoing.writeHead(200, { 'content-type': 'application/json' });
        outgoing.end(JSON.stringify(answer));
        return;
      }
      const forward = httpRequest(
        { hostname: upstream.hostname, port: upstream.port, path: upstream.pathname, method: 'POST',
          headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } },
        (answer) => {
          outgoing.writeHead(answer.statusCode ?? 200, { 'content-type': 'application/json' });
          answer.pipe(outgoing);
        },
      );
      forward.on('error', () => outgoing.destroy());
      forward.end(body);
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${String(port)}`,
        close: () =>
          new Promise<void>((done) => {
            server.close(() => {
              done();
            });
          }),
      });
    });
  });
}

/**
 * Runs the fixture against `url` and returns what forge printed, with whether it failed.
 *
 * NOT `spawnSync`. The proxy above lives in THIS process, and a synchronous spawn blocks the event loop
 * for as long as forge runs -- so the proxy never answers, forge times out after 45s, and every case
 * fails for a reason that has nothing to do with what it tests.
 */
function runFixture(url: string): Promise<{ failed: boolean; output: string }> {
  return new Promise((resolve) => {
    const forge = spawn('forge', ['test', '--match-path', 'test/anvilRefusal/*', '--threads', '1'], {
      // NO STORAGE CACHING, and it is not an optimisation. Forge keys its fork cache by chain id and
      // block, and every case here forks a freshly reset anvil: chain 31337 at block 0, the same key
      // each time. Cached, the second case reads the FIRST case's accounts -- a deployer at nonce 3 in
      // a run that never set one -- and fails saying something true about state nobody arranged.
      env: { ...process.env, ANVIL_RPC_URL: url, FOUNDRY_NO_STORAGE_CACHING: 'true' },
    });
    let output = '';
    forge.stdout.on('data', (chunk) => {
      output += String(chunk);
    });
    forge.stderr.on('data', (chunk) => {
      output += String(chunk);
    });
    forge.on('close', (status) => {
      resolve({ failed: status !== 0, output });
    });
  });
}

type Case = {
  readonly name: string;
  /** Puts the node in the state the case needs, when it needs one. The node is at genesis first. */
  readonly arrange?: () => Promise<void>;
  readonly sabotage: Sabotage;
  /** A fragment the failure must contain, specific enough that another failure cannot satisfy it. */
  readonly expect: string;
  readonly because: string;
};

const CASES: readonly Case[] = [
  {
    name: 'a deployer that has already been used',
    arrange: async () => {
      await rpc(NODE_URL, 'anvil_setNonce', [DEPLOYER, '0x3']);
    },
    sabotage: {},
    expect: 'LOCAL STACK CANNOT DEPLOY HERE',
    because: 'every address is derived from that account at nonce 0, so a used deployer is unrecoverable',
  },
  {
    name: 'a node that refuses anvil_setCode',
    sabotage: { method: 'anvil_setCode', how: 'refuse' },
    expect: 'the node refused anvil_setCode',
    because: 'a refused setter used to be swallowed and became one anonymous false, several frames later',
  },
  {
    name: 'a node that accepts anvil_setCode and does nothing',
    sabotage: { method: 'anvil_setCode', how: 'swallow' },
    expect: 'a contract the deploy created is not on the node',
    because: 'the readback asked about one address, so nine contracts out of ten missing answered true',
  },
  {
    name: 'a node that accepts anvil_setNonce and does nothing',
    sabotage: { method: 'anvil_setNonce', how: 'swallow' },
    expect: "the node's deployer is not where the fork left it",
    because: 'a deploy against such a node lands at addresses the stack does not use',
  },
];

let failures = 0;

for (const testCase of CASES) {
  await rpc(NODE_URL, 'anvil_reset', []); // each case starts from genesis
  await testCase.arrange?.();

  const proxy = await startProxy(testCase.sabotage);
  const { failed, output } = await runFixture(proxy.url);
  await proxy.close();

  const said = output.includes(testCase.expect);
  if (failed && said) {
    console.log(`  ok    ${testCase.name}`);
    continue;
  }

  failures++;
  console.log(`  FAIL  ${testCase.name}`);
  console.log(`        expected the run to fail saying: ${testCase.expect}`);
  console.log(`        because: ${testCase.because}`);
  console.log(`        it ${failed ? 'failed, but said something else' : 'did not fail at all'}`);
  console.log(
    output
      .split('\n')
      .filter((line) => line.trim() !== '')
      .slice(-12)
      .map((line) => `        | ${line}`)
      .join('\n'),
  );
}

await rpc(NODE_URL, 'anvil_reset', []); // leave the node as it was found

console.log(`\n${String(CASES.length - failures)}/${String(CASES.length)} refusal paths verified`);
process.exit(failures === 0 ? 0 : 1);
