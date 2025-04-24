import assert from "assert";
import { lazyObject } from "hardhat/plugins";
import { EnvironmentExtender, HardhatRuntimeEnvironment } from "hardhat/types";

import { HardhatFhevmError } from "../error";
import { FhevmEnvironment } from "./FhevmEnvironment";

export const fhevmContext: { fhevmEnv: FhevmEnvironment | undefined; get: () => FhevmEnvironment } = {
  fhevmEnv: undefined,
  get: () => {
    // initialized by the envExtender below.
    if (!fhevmContext.fhevmEnv) {
      throw new HardhatFhevmError("Unable to initialize HardhatFhevmRuntimeEnvironment");
    }
    return fhevmContext.fhevmEnv;
  },
};

/**
 * Hardhat EnvironmentExtender
 * Called at Hardhat initialization
 */
export const envExtender: EnvironmentExtender = (env: HardhatRuntimeEnvironment) => {
  /**
   * Very lightweight
   */
  assert(fhevmContext.fhevmEnv === undefined, "fhevmContext.fhevmEnv already created");
  fhevmContext.fhevmEnv = lazyObject(() => {
    return new FhevmEnvironment(env);
  });

  env.fhevm = lazyObject(() => {
    return fhevmContext.get().externalFhevmAPI;
  });
};
