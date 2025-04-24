/* eslint-disable @typescript-eslint/no-explicit-any */
//import assert from "assert";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { FhevmEnvironment } from "./src/internal/FhevmEnvironment";
import type { FhevmContext } from "./src/internal/types";

//import { fhevmContext } from "./src/internal/EnvironmentExtender";

// const globalAsAny: any = global as any;
// globalAsAny.__FHEVM_HARDHAT_ENV_EXTENDER = true;

const globalAsAny = global as unknown as {
  __FHEVM_HARDHAT_REGISTER: boolean;
  __fhevmContext: FhevmContext;
  hre: HardhatRuntimeEnvironment;
};
globalAsAny.__FHEVM_HARDHAT_REGISTER = true;

// console.log("   =================================");
// console.log("   globalAsAny.hre = " + globalAsAny.hre);
// console.log("   fhevmContext.rand = " + globalAsAny.__fhevmContext.rand);
// console.log("   fhevmContext.fhevmEnv = " + globalAsAny.__fhevmContext.get());
// console.log("   =================================");

(async () => {
  const hre: HardhatRuntimeEnvironment = globalAsAny.hre;
  const fhevmContext: FhevmContext = globalAsAny.__fhevmContext;
  const fhevmEnv: FhevmEnvironment = fhevmContext.get();
  await fhevmEnv.deploy();
  console.log("--------> fhevmEnv=" + fhevmEnv);
})();

//   const mod = await import("./src/internal/EnvironmentExtender");

//   console.log("-> START Register RAND=" + mod.fhevmContext.rand);

//   if (globalAsAny.__FHEVM_HARDHAT_ENV_EXTENDER === true) {
//     // In Mocha test parallel.
//     // EnvironmentExtender has already been called.
//     assert(mod.fhevmContext !== undefined);
//     const fhevmEnv = mod.fhevmContext.get();
//     assert(fhevmEnv !== undefined);
//     await fhevmEnv.runSetup();
//   }

//   console.log("__FHEVM_HARDHAT_ENV_EXTENDER=" + globalAsAny.__FHEVM_HARDHAT_ENV_EXTENDER);

//   console.log("-> END Register");
// })();

/*
-> START EnvironmentExtender
__FHEVM_HARDHAT_REGISTER=undefined
-> START Register
__FHEVM_HARDHAT_ENV_EXTENDER=true
-> END Register
-> END EnvironmentExtender
*/

// (async () => {
//   console.log("HELLO from register");
//   try {
//     const mod = await import("./src/internal/EnvironmentExtender");

//     // console.log("HELLO from register 1 " + mod.fhevmContext.fhevmEnv);
//     // mod.fhevmContext.useLazyObject = false;

//     // const fhevmEnv = mod.fhevmContext.get();
//     // console.log("HELLO from register 2");
//     // if (!fhevmEnv.isInitialized) {
//     //   console.log("HELLO from register RUN SETUP ENTER");
//     //   await fhevmEnv.runSetup();
//     //   console.log("HELLO from register RUN SETUP EXIT");
//     // }

//     // console.log("HELLO from register DONE useLazyObject=" + mod.fhevmContext.useLazyObject);
//   } catch (e) {
//     console.log("HELLO from register DONE ERROR! " + e);
//   }
// })();
