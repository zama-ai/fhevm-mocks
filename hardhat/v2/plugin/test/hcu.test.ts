// FheMulDiv in the HCU engine, over a synthetic receipt. No e2e contract can emit the event: `@fhevm/solidity` does
// not expose `FHE.mulDiv` yet. The executor ABI comes from the host package this plugin is built against, and the
// test skips itself when that ABI has no FheMulDiv (it arrives with the 0.14 protocol line).
//
// It imports the BUILT payload (pkg/_cjs), so run it after a build, like node10-cjs-resolution.test.ts.

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import test from 'node:test';
import { PKG_DIR_ABS_PATH } from '../internal/constants.ts';

type Hex = `0x${string}`;
type EventFragment = { type: string; name?: string };
type Log = { address: string; topics: readonly string[]; data: string };
type HCUInfo = { globalHCU: number; maxHCUDepth: number; HCUDepthByHandle: Record<Hex, number> };
type Interface = { encodeEventLog(name: string, values: readonly unknown[]): { data: string; topics: string[] } };
type Prices = Record<string, { scalar?: Record<string, number>; nonScalar?: Record<string, number> } | undefined>;

// Resolved from pkg/, where the payload's own dependencies (ethers, the host package) are visible.
const requireFromPkg = createRequire(join(PKG_DIR_ABS_PATH, 'package.json'));
const { ethers } = requireFromPkg('ethers') as { ethers: { Interface: new (abi: unknown) => Interface } };
const { getTxHCUFromTxReceipt } = requireFromPkg('./_cjs/internal/hcu/hcu.js') as {
  getTxHCUFromTxReceipt: (address: Hex, iface: Interface, receipt: unknown) => HCUInfo;
};
const { ALL_OPERATORS_PRICES } = requireFromPkg('./_cjs/internal/vendored/operatorsPrices.js') as {
  ALL_OPERATORS_PRICES: Prices;
};
const executorAbi = requireFromPkg(
  '@fhevm/host-contracts-cleartext/abi/CleartextFHEVMExecutor.json',
) as EventFragment[];

const EXECUTOR: Hex = `0x${'11'.repeat(20)}`;
const ALICE: Hex = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const TX_HASH: Hex = `0x${'22'.repeat(32)}`;
const EUINT32 = 4; // FhevmType.euint32, the on-chain FheType id

/** A computed handle of `fhevmType` on chain 31337, hash bytes taken from `seed`. */
function handle(seed: number, fhevmType: number): Hex {
  const hash = seed.toString(16).padStart(2, '0').repeat(21);
  const chainId = (31337).toString(16).padStart(16, '0');
  return `0x${hash}ff${chainId}${fhevmType.toString(16).padStart(2, '0')}00`;
}

void test('FheMulDiv is priced on factor2 alone, in its own scalar encoding', (t) => {
  if (!executorAbi.some((item) => item.type === 'event' && item.name === 'FheMulDiv')) {
    t.skip('this executor has no FheMulDiv event (it arrives with the 0.14 protocol line)');
    return;
  }
  const iface = new ethers.Interface(executorAbi);
  const log = (name: string, values: readonly unknown[]): Log => ({
    address: EXECUTOR,
    ...iface.encodeEventLog(name, values),
  });
  const receipt = (...logs: Log[]) => ({ status: 1, hash: TX_HASH, logs });
  const price = (scalar: boolean): number => {
    const column = scalar ? ALL_OPERATORS_PRICES.fheMulDiv?.scalar : ALL_OPERATORS_PRICES.fheMulDiv?.nonScalar;
    return column?.Uint32 ?? -1;
  };
  const addPrice = ALL_OPERATORS_PRICES.fheAdd?.nonScalar?.Uint32 ?? -1;
  assert.notEqual(price(true), price(false), 'the two columns must differ for this test to mean anything');

  // f1 is the result of an FheAdd in the same receipt, so the FheMulDiv result's depth carries it.
  const [a, b, f1, f2] = [1, 2, 3, 4].map((seed) => handle(seed, EUINT32)) as [Hex, Hex, Hex, Hex];
  const divisor: Hex = `0x${'00'.repeat(31)}07`;
  const add = log('FheAdd', [ALICE, a, b, '0x00', f1]);
  const mulDiv = (scalarByte: Hex, result: Hex) => log('FheMulDiv', [ALICE, f1, f2, divisor, scalarByte, result]);

  // 0x03: factor2 is a plain value.
  const r5 = handle(5, EUINT32);
  const scalar = getTxHCUFromTxReceipt(EXECUTOR, iface, receipt(add, mulDiv('0x03', r5)));
  assert.equal(scalar.globalHCU, addPrice + price(true));
  assert.equal(scalar.HCUDepthByHandle[r5], addPrice + price(true));

  // 0x01: factor2 is encrypted — the usual "scalar" flag, which must NOT be read as scalar here.
  const r6 = handle(6, EUINT32);
  const encrypted = getTxHCUFromTxReceipt(EXECUTOR, iface, receipt(add, mulDiv('0x01', r6)));
  assert.equal(encrypted.globalHCU, addPrice + price(false));
  assert.equal(encrypted.HCUDepthByHandle[r6], addPrice + price(false));

  // Any other flag is a malformed log.
  assert.throws(() => getTxHCUFromTxReceipt(EXECUTOR, iface, receipt(mulDiv('0x00', handle(7, EUINT32)))), /FheMulDiv/);
});
