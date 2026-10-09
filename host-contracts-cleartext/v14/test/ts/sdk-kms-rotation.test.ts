// Golden rule 5 across a KMS rotation, for an app that starts after it: every sdk line this package declares
// (utils/sdkLines.ts) decrypts values made under the previous KMS committee.
//
// Its own file, so its own process: the sdk caches the KMS context and its signers per process, and every client of
// one sdk copy shares that cache, so a new client is not enough — only a process that has never used the sdk reads the
// committee afresh. NOTHING in this process may touch the sdk before the rotation: the values are made by SdkProbe
// itself (trivial encryption), the permits signed before it are signed in another process and stored as an app stores
// them, and the first client is created after it. sdk-compatibility.test.ts covers the process that carries on across
// the rotation.
import type { Address, Hex } from 'viem';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { MNEMONIC, startAnvil, stopAnvil } from '@fhevm/sdk-common-dev';
import {
  COMBINATIONS,
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
  type StoredPermit,
  loadPermit,
  rotateKms,
  signPermit,
  signPermitInAnotherProcess,
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
  type Made = { probeAddress: Address; handle: Hex; storedPermit: StoredPermit };
  const made = new Map<string, Made>();
  const key = (sdkName: string, variantName: string) => `${sdkName}|${variantName}`;

  beforeAll(async () => {
    const e = await startEnv(startAnvil({ port: 8662, mnemonic: MNEMONIC }));
    env = e;
    for (const { sdkName, variant } of COMBINATIONS) {
      const { probeAddress, handle } = await trivialToNewProbe(e, clearValueOf(sdkName, variant, 200));
      await makePubliclyDecryptable(e, probeAddress);
      const storedPermit = await signPermitInAnotherProcess(e, sdkName, variant, probeAddress);
      made.set(key(sdkName, variant.name), { probeAddress, handle, storedPermit });
    }
    await rotateKms(e);
  }, 180_000);

  afterAll(async () => {
    if (env !== undefined) await stopAnvil(env.anvil.process);
  });

  describe.each(COMBINATIONS)('$sdkName, $variant.name', ({ sdkName, variant }) => {
    let sdk: SdkLine;
    let client: SdkClient;
    let earlier: Made;
    const clear = clearValueOf(sdkName, variant, 200);
    const context = (scenario: Scenario): GapContext => ({
      sdk,
      variant,
      kmsVerifierVersion: started().kmsVerifierVersion,
      scenario,
    });

    beforeAll(async () => {
      ({ sdk, client } = await connect(started(), sdkName, variant));
      const entry = made.get(key(sdkName, variant.name));
      if (entry === undefined) throw new Error(`nothing was made for ${sdkName}, ${variant.name}`);
      earlier = entry;
    });

    test('user-decrypts with a stored permit signed before the rotation', async () => {
      await expectOutcome(context('permitFromAnEarlierKmsContext'), async () => {
        const permit = await loadPermit(client, earlier.storedPermit);
        expect(await userDecryptWith(client, permit, earlier.handle, earlier.probeAddress)).toBe(clear);
      });
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
