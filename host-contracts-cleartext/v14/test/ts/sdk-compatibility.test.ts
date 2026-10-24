// Golden rule 5: cleartext v(N) serves every sdk line from v(N-2) to v(N). The same scenarios run against each line
// this package declares (utils/sdkLines.ts).
//
// A known gap is DATA, not a branch: `GAPS` predicts it from what the sdk builds and what the host serves, both read
// at run time, and the test asserts the failure. The day a fixed sdk is pinned, the call succeeds, the test fails, and
// the gap is removed on purpose.
//
// The second suite keeps ONE process across a KMS rotation, like a long-running app: the sdk caches the KMS context
// per process, so what it shows is how that app fares. sdk-kms-rotation.test.ts is the app that starts after it.
import type { Address, Hex } from 'viem';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { MNEMONIC, startAnvil, stopAnvil } from '@fhevm/sdk-common-dev';
import {
  ACL_ABI,
  DAY,
  type Env,
  type GapContext,
  type Permit,
  SDK_LINES,
  type Scenario,
  UPGRADES,
  type SdkClient,
  type SdkLine,
  alice,
  bob,
  clearValueOf,
  connect,
  expectOutcome,
  loadPermit,
  makePubliclyDecryptable,
  publicDecryptAndVerify,
  rotateKms,
  send,
  signPermit,
  startEnv,
  storePermit,
  submitToNewProbe,
  userDecryptWith,
} from './utils/sdkLines.ts';

describe.skipIf(SDK_LINES.length === 0)('one KMS context', () => {
  let env: Env | undefined;
  const started = (): Env => {
    if (env === undefined) throw new Error('the stack did not start');
    return env;
  };

  beforeAll(async () => {
    env = await startEnv(startAnvil({ port: 8660, mnemonic: MNEMONIC }));
  }, 120_000);

  afterAll(async () => {
    if (env !== undefined) await stopAnvil(env.anvil.process);
  });

  describe.each(SDK_LINES)('%s', (sdkName) => {
    let sdk: SdkLine;
    let client: SdkClient;
    let probeAddress: Address;
    let handle: Hex;
    const clear = clearValueOf(sdkName, 0);
    const context = (scenario: Scenario): GapContext => ({
      sdk,
      kmsVerifierVersion: started().kmsVerifierVersion,
      scenario,
    });

    beforeAll(async () => {
      ({ sdk, client } = await connect(started(), sdkName));
    });

    test('encrypts an input the host verifies on chain', async () => {
      await expectOutcome(context('encrypt'), async () => {
        ({ probeAddress, handle } = await submitToNewProbe(started(), client, clear));
      });
    });

    test('user-decrypts with a permit signed now', async () => {
      await expectOutcome(context('userDecrypt'), async () => {
        const permit = await signPermit(started(), client, alice, probeAddress);
        expect(await userDecryptWith(client, permit, handle, probeAddress)).toBe(clear);
      });
    });

    test('user-decrypts on behalf of a delegator', async () => {
      await expectOutcome(context('delegatedUserDecrypt'), async () => {
        const e = started();
        const { timestamp } = await e.publicClient.getBlock();
        await send(e, alice, e.stack.fhevmAddresses.aclAddress as Address, ACL_ABI, 'delegateForUserDecryption', [
          bob.address,
          probeAddress,
          timestamp + BigInt(DAY),
        ]);
        const permit = await signPermit(e, client, bob, probeAddress, alice.address);
        expect(await userDecryptWith(client, permit, handle, probeAddress)).toBe(clear);
      });
    });

    test('public-decrypts, and the KMSVerifier accepts the proof on chain', async () => {
      await makePubliclyDecryptable(started(), probeAddress);
      await expectOutcome(context('publicDecrypt'), async () => {
        expect(await publicDecryptAndVerify(started(), client, handle)).toBe(clear);
      });
    });
  });
});

// An app that upgrades its sdk keeps the permits it stored: one signed by an older line, then loaded and used by a
// newer one, on the same host and the same KMS committee.
describe.skipIf(UPGRADES.length === 0)('a permit signed by an older sdk line, used by a newer one', () => {
  let env: Env | undefined;
  const started = (): Env => {
    if (env === undefined) throw new Error('the stack did not start');
    return env;
  };

  beforeAll(async () => {
    env = await startEnv(startAnvil({ port: 8663, mnemonic: MNEMONIC }));
  }, 120_000);

  afterAll(async () => {
    if (env !== undefined) await stopAnvil(env.anvil.process);
  });

  describe.each(UPGRADES)('signed by $olderName, used by $newerName', ({ olderName, newerName }) => {
    test('user-decrypts with the stored permit', async () => {
      const e = started();
      const clear = 42n;
      const older = await connect(e, olderName);
      const { probeAddress, handle } = await submitToNewProbe(e, older.client, clear);
      const stored = await storePermit(older.client, await signPermit(e, older.client, alice, probeAddress));
      const newer = await connect(e, newerName);
      await expectOutcome(
        { sdk: newer.sdk, kmsVerifierVersion: e.kmsVerifierVersion, scenario: 'permitFromAnOlderSdkLine' },
        async () => {
          const permit = await loadPermit(newer.client, stored);
          expect(await userDecryptWith(newer.client, permit, handle, probeAddress)).toBe(clear);
        },
      );
    });
  });
});

// Every value and permit is made with the sdk under the first KMS context, then the committee is replaced, then each
// line carries on in the SAME process — a new client included, since all clients of one sdk copy share its cache.
describe.skipIf(SDK_LINES.length === 0)('across a KMS rotation, in a process that used the sdk before it', () => {
  let env: Env | undefined;
  const started = (): Env => {
    if (env === undefined) throw new Error('the stack did not start');
    return env;
  };
  type Made = { probeAddress: Address; handle: Hex; permit: Permit };
  const made = new Map<string, Made>();

  beforeAll(async () => {
    const e = await startEnv(startAnvil({ port: 8661, mnemonic: MNEMONIC }));
    env = e;
    for (const sdkName of SDK_LINES) {
      const { client } = await connect(e, sdkName);
      const { probeAddress, handle } = await submitToNewProbe(e, client, clearValueOf(sdkName, 100));
      await makePubliclyDecryptable(e, probeAddress);
      const permit = await signPermit(e, client, alice, probeAddress);
      made.set(sdkName, { probeAddress, handle, permit });
    }
    await rotateKms(e);
  }, 180_000);

  afterAll(async () => {
    if (env !== undefined) await stopAnvil(env.anvil.process);
  });

  describe.each(SDK_LINES)('%s', (sdkName) => {
    let sdk: SdkLine;
    let client: SdkClient;
    let earlier: Made;
    const clear = clearValueOf(sdkName, 100);
    const context = (scenario: Scenario): GapContext => ({
      sdk,
      kmsVerifierVersion: started().kmsVerifierVersion,
      scenario,
    });

    beforeAll(async () => {
      ({ sdk, client } = await connect(started(), sdkName));
      const entry = made.get(sdkName);
      if (entry === undefined) throw new Error(`nothing was made for ${sdkName}`);
      earlier = entry;
    });

    test('user-decrypts with a permit signed before the rotation', async () => {
      await expectOutcome(context('permitFromAnEarlierKmsContext'), async () => {
        expect(await userDecryptWith(client, earlier.permit, earlier.handle, earlier.probeAddress)).toBe(clear);
      });
    });

    test('public-decrypts, and the KMSVerifier accepts the proof on chain', async () => {
      await expectOutcome(context('publicDecryptWithAStaleKmsContext'), async () => {
        expect(await publicDecryptAndVerify(started(), client, earlier.handle)).toBe(clear);
      });
    });

    test('user-decrypts with a permit signed after the rotation', async () => {
      await expectOutcome(context('userDecryptWithAStaleKmsContext'), async () => {
        const permit = await signPermit(started(), client, alice, earlier.probeAddress);
        expect(await userDecryptWith(client, permit, earlier.handle, earlier.probeAddress)).toBe(clear);
      });
    });
  });
});
