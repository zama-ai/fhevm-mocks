// Golden rule 5 across a KMS rotation, for an app that starts after it: every sdk line this package declares
// (utils/sdkLines.ts) decrypts values made under the previous KMS committee.
//
// Its own file, so its own process: the sdk caches the KMS context and its signers per process, and every client of
// one sdk copy shares that cache, so a new client is not enough — only a process that has never used the sdk reads the
// committee afresh. NOTHING here may touch the sdk before the rotation: the values are made by SdkProbe itself
// (trivial encryption), and the first client is created after it. sdk-compatibility.test.ts covers the process that
// carries on across the rotation.
import type { Address, Hex } from 'viem';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { MNEMONIC, startAnvil, stopAnvil } from '@fhevm/sdk-common-dev';
import {
  type Env,
  type GapContext,
  SDK_LINES,
  type Scenario,
  type SdkClient,
  type SdkLine,
  alice,
  clearValueOf,
  connect,
  expectOutcome,
  makePubliclyDecryptable,
  publicDecryptAndVerify,
  rotateKms,
  signPermit,
  startEnv,
  trivialToNewProbe,
  userDecryptWith,
} from './utils/sdkLines.ts';

describe.skipIf(SDK_LINES.length === 0)('after a KMS rotation, in a process that starts after it', () => {
  let env: Env | undefined;
  const started = (): Env => {
    if (env === undefined) throw new Error('the stack did not start');
    return env;
  };
  type Made = { probeAddress: Address; handle: Hex };
  const made = new Map<string, Made>();

  beforeAll(async () => {
    const e = await startEnv(startAnvil({ port: 8662, mnemonic: MNEMONIC }));
    env = e;
    for (const sdkName of SDK_LINES) {
      const { probeAddress, handle } = await trivialToNewProbe(e, clearValueOf(sdkName, 200));
      await makePubliclyDecryptable(e, probeAddress);
      made.set(sdkName, { probeAddress, handle });
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
    const clear = clearValueOf(sdkName, 200);
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

    test('public-decrypts with the new committee, and the KMSVerifier accepts the proof on chain', async () => {
      await expectOutcome(context('publicDecrypt'), async () => {
        expect(await publicDecryptAndVerify(started(), client, earlier.handle)).toBe(clear);
      });
    });

    test('user-decrypts with a permit signed under the new committee', async () => {
      await expectOutcome(context('userDecrypt'), async () => {
        const permit = await signPermit(started(), client, alice, earlier.probeAddress);
        expect(await userDecryptWith(client, permit, earlier.handle, earlier.probeAddress)).toBe(clear);
      });
    });
  });
});
