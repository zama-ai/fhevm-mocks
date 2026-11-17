// What the create2 coordinators tell an operator while a stage runs, where a misleading line has cost real time.
// A send with a keystore signer: forge asks for the password on the terminal before it sends anything, and the
// heartbeat (printed while forge's output is piped into the transcript) must not read as progress meanwhile. On
// Sepolia it printed "forge is still sending: 0 transaction(s) mined" for eight minutes over forge's
// "Enter keystore password:". Pure message helpers: no chain, no forge.

import assert from 'node:assert/strict';
import test from 'node:test';
import { keystorePromptNotice, sendProgressLine } from '../create2-deploy/ts/common.ts';

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
