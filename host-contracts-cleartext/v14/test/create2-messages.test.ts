// What the create2 coordinators tell an operator while a stage runs, where a misleading line has cost real time.
// A send with a keystore signer: forge asks for the password on the terminal before it sends anything, and the
// heartbeat (printed while forge's output is piped into the transcript) must not read as progress meanwhile. On
// Sepolia it printed "forge is still sending: 0 transaction(s) mined" for eight minutes over forge's
// "Enter keystore password:". And a step that fails on the RPC (a lagging backend, a rate limit) must not read as
// a failed check. Pure message helpers: no chain, no forge.

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import test from 'node:test';
import { keystorePromptNotice, sendProgressLine } from '../create2-deploy/ts/common.ts';
import { capture, rpcFailure, rpcFailureLines } from '../create2-deploy/ts/utils.ts';

void test('before forge starts with a keystore signer, the operator is told it will ask for the password', () => {
  const notice = keystorePromptNotice('my-deployer').join('\n');
  assert.match(notice, /forge will now ask for the password of keystore 'my-deployer'/);
  assert.match(notice, /Nothing is sent until you type it/);
});

void test('while nothing is sent, the heartbeat says so, on a fresh line, and names the keystore', () => {
  const line = sendProgressLine('1m00s', 0, 0, 'my-deployer');
  assert.ok(line.startsWith('\n'), 'starts on a fresh line, not after the password prompt');
  assert.match(line, /waiting \(1m00s\): forge has sent nothing yet/);
  assert.match(line, /password of keystore 'my-deployer', type it/);
  assert.doesNotMatch(line, /sending|mined/);
});

void test('without a keystore there is no prompt to point at, nor a line to break', () => {
  const line = sendProgressLine('30s', 0, 0, null);
  assert.equal(line, '  … waiting (30s): forge has sent nothing yet');
});

void test('once something is sent, the heartbeat counts what is sent and what is mined', () => {
  assert.equal(
    sendProgressLine('2m30s', 3, 2, 'my-deployer'),
    '  … forge is sending (2m30s): 3 transaction(s) sent, 2 mined so far',
  );
  // An unanswered nonce read is not progress either.
  assert.doesNotMatch(sendProgressLine('30s', null, null, null), /sending|sent/);
});

// A forge or cast step that fails on the RPC is reported as the RPC, not as a failed check. The outputs below
// are the three real failures on Sepolia (trimmed to the lines that matter), and two that are checks.
const COMPUTE_BLOCK_NOT_FOUND = [
  '2026-11-17T16:02:11.120Z ERROR sharedbackend: Failed to send/recv `basic` err=failed to get account for',
  '0x1804c8AB1F12E6bbf3894d4083f33e07309d1f38: server returned an error response: error code -32001: block not',
  'found: 0xb97989 address=0x1804c8AB1F12E6bbf3894d4083f33e07309d1f38',
  'Error: script failed: <empty revert data>',
].join(' ');
const PRECHECK_429 = [
  'Error: Failed to get EIP-1559 fees',
  '',
  'Context:',
  '- Error #0: HTTP error 429 with body: {"jsonrpc":"2.0","id":3,"error":{"code":-32005,"message":"Too Many Requests",',
  '"data":{"see":"https://infura.io/dashboard"}}}',
].join('\n');
const SCAN_BEYOND_HEAD =
  'Error: server returned an error response: error code -32602: block range extends beyond current head block: ' +
  'requested 12155843, head 12155842';
const CHECK_FAILED = [
  '== Logs ==',
  '  ok   ACLOwner owns the ACL',
  '  FAIL KMSVerifier runs the sealed implementation',
  '  ok   no pending ownership transfer',
  'Error: script failed: 1 check(s) failed',
].join('\n');
const CHECK_REVERTED = 'Error: script failed: FhevmRepoint: ACL_OWNER holds no code at the settled block';

void test('the three RPC failures seen on Sepolia are classified as the RPC', () => {
  assert.match(rpcFailure(COMPUTE_BLOCK_NOT_FOUND) ?? '', /did not have a block/);
  assert.match(rpcFailure(PRECHECK_429) ?? '', /rate-limited/);
  assert.match(rpcFailure(SCAN_BEYOND_HEAD) ?? '', /behind the head/);
  assert.match(rpcFailure('Error: error sending request for url (http://127.0.0.1:8545/)') ?? '', /connection/);
});

void test('a failed check is never classified as the RPC, even next to an RPC error', () => {
  assert.equal(rpcFailure(CHECK_FAILED), null);
  assert.equal(rpcFailure(CHECK_REVERTED), null);
  assert.equal(rpcFailure(`${CHECK_FAILED}\n${PRECHECK_429}`), null);
  assert.equal(rpcFailure(''), null);
});

void test('the RPC error says it is not a check, what was sent, and what to do; never "read the FAIL lines"', () => {
  const lines = rpcFailureLines('the pre-materialize check', 'the node rate-limited this run', 'Nothing was sent.');
  const text = lines.join('\n');
  assert.match(lines[0] ?? '', /^Error: the pre-materialize check failed on an RPC error, not on a check: the node/);
  assert.match(text, /Nothing was sent\./);
  assert.match(text, /Run the same command again/);
  assert.match(text, /single,\s+non-load-balanced archive node/);
  assert.doesNotMatch(text, /FAIL lines/);
});

// A JSON-RPC node, in a process of its own (capture is synchronous: an in-process server could not answer), that
// refuses its first two requests as a backend one block behind would, then answers. It prints its port, and
// how many requests it has seen on each `count` request.
const LAGGING_NODE = `
let seen = 0;
const server = require('node:http').createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const calls = [].concat(JSON.parse(body));
    const answer = calls.map(({ id, method }) => {
      if (method === 'count') return { jsonrpc: '2.0', id, result: seen };
      seen += 1;
      return seen <= 2
        ? { jsonrpc: '2.0', id, error: { code: -32602, message: 'block range extends beyond current head block' } }
        : { jsonrpc: '2.0', id, result: '0xaa36a7' };
    });
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(Array.isArray(JSON.parse(body)) ? answer : answer[0]));
  });
});
// process.stdout.write, not console.log: console.log colors a number when FORCE_COLOR is set in the environment,
// and the colored digits would end up in the RPC URL.
server.listen(0, '127.0.0.1', () => process.stdout.write(server.address().port + '\\n'));
`;

void test('a cast read that hits an RPC error is asked again; anything else is not', async (t) => {
  const node = spawn(process.execPath, ['-e', LAGGING_NODE], { stdio: ['ignore', 'pipe', 'inherit'] });
  t.after(() => node.kill());
  const port = await new Promise<string>((resolvePort) => {
    node.stdout.once('data', (chunk: Buffer) => {
      resolvePort(chunk.toString().trim());
    });
  });
  const url = `http://127.0.0.1:${port}`;

  // `cast rpc` is never retried: the first refusal is the answer.
  const raw = capture('cast', ['rpc', 'eth_chainId', '--rpc-url', url]);
  assert.equal(raw.ok, false);
  assert.match(raw.stderr, /beyond current head block/);

  // A read is: the second refusal is retried after a second, the third request is answered.
  const read = capture('cast', ['chain-id', '--rpc-url', url]);
  assert.equal(read.ok, true, read.stderr);
  assert.equal(read.stdout, '11155111');
  assert.equal(capture('cast', ['rpc', 'count', '--rpc-url', url]).stdout, '3');
});
