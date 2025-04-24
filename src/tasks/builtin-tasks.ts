import assert from "assert";
import {
  TASK_COMPILE_GET_REMAPPINGS,
  TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS,
  TASK_TEST,
} from "hardhat/builtin-tasks/task-names";
import { subtask, task } from "hardhat/config";
import { HardhatRuntimeEnvironment, TaskArguments } from "hardhat/types";

import { HardhatFhevmError } from "../error";
import { fhevmContext } from "../internal/EnvironmentExtender";

task(TASK_TEST, async (taskArgs: TaskArguments, hre: HardhatRuntimeEnvironment, runSuper) => {
  const fhevmEnv = fhevmContext.get();

  // Not supported for the moment. Much too tricky. This would generate tons of support.
  if (taskArgs.parallel === true && hre.network.name === "hardhat") {
    throw new HardhatFhevmError(
      "The fhevm hardhat plugin does not support parallel testing when running in mock mode.",
    );
  }

  await fhevmEnv.deploy();
  assert(fhevmEnv.isDeployed, "FhevmEnvironment is not initialized");

  const res = await runSuper();
  return res;
});

subtask(TASK_COMPILE_GET_REMAPPINGS).setAction(async (taskArgs, hre, runSuper): Promise<Record<string, string>> => {
  const fhevmEnv = fhevmContext.get();

  // run super first.
  const res = (await runSuper()) as Record<string, string>;

  // apply our remapping
  const remappings = fhevmEnv.getRemappings();
  Object.entries(remappings).forEach(([k, v]) => {
    console.log(`remapping: ${k} => ${v}`);
    res[k] = v;
  });

  return res;
});

subtask(TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS).setAction(
  /* eslint-disable @typescript-eslint/no-unused-vars */
  async ({ sourcePath }: { sourcePath?: string }, hre, runSuper): Promise<string[]> => {
    const fhevmEnv = fhevmContext.get();

    await fhevmEnv.runSetupAddresses();

    // run super first.
    const filePaths: string[] = await runSuper();

    // append our solidity files.
    const fhevmSourcePaths = await fhevmEnv.getSoliditySourcePaths();
    for (let i = 0; i < fhevmSourcePaths.length; ++i) {
      filePaths.push(fhevmSourcePaths[i]);
    }

    return filePaths;
  },
);
