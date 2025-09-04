import setupDebug from "debug";
import * as fs from "fs";
import {
  TASK_CLEAN,
  TASK_COMPILE_GET_REMAPPINGS,
  TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS,
  TASK_NODE_GET_PROVIDER,
  TASK_NODE_SERVER_READY,
  TASK_TEST,
} from "hardhat/builtin-tasks/task-names";
import { subtask, task } from "hardhat/config";
import { HardhatRuntimeEnvironment, TaskArguments } from "hardhat/types";
import * as picocolors from "picocolors";

import { HardhatFhevmError } from "../error";
import { fhevmContext } from "../internal/EnvironmentExtender";
import constants from "../internal/constants";
import { assertHHFhevm } from "../internal/error";
import { checkSolidityCoverageSettings } from "../internal/utils/solidityCoverage";

const debug = setupDebug("@fhevm/hardhat:builtin-tasks");

task(TASK_TEST, async (taskArgs: TaskArguments, hre: HardhatRuntimeEnvironment, runSuper) => {
  // Not supported for the moment. Much too tricky. This would generate tons of support.
  if (taskArgs.parallel === true && hre.network.name === "hardhat") {
    throw new HardhatFhevmError(
      "The fhevm hardhat plugin does not support parallel testing when running in mock mode.",
    );
  }

  await checkSolidityCoverageSettings(hre);

  const fhevmEnv = fhevmContext.get();
  fhevmEnv.setRunningInHHTest();

  await fhevmEnv.deploy();
  assertHHFhevm(fhevmEnv.isDeployed, "FhevmEnvironment is not initialized");

  const res = await runSuper();
  return res;
});

task(TASK_CLEAN, async (_taskArgs: TaskArguments, _hre: HardhatRuntimeEnvironment, runSuper) => {
  debug(`execute TASK_CLEAN`);

  // no 'minimalInit' needed here. We only need paths.
  const fhevmEnv = fhevmContext.get();

  // Should not block the whole thing...
  try {
    if (fs.existsSync(fhevmEnv.paths.cacheDir)) {
      fs.rmSync(fhevmEnv.paths.cacheDir, { force: true, recursive: true });

      debug(`${picocolors.greenBright(TASK_CLEAN)} remove directory ${fhevmEnv.paths.cacheDir}`);
    } else {
      debug(`${picocolors.greenBright(TASK_CLEAN)} directory ${fhevmEnv.paths.cacheDir} already removed.`);
    }
  } catch {
    console.log(`${constants.HARDHAT_PLUGIN_NAME}: Unable to remove directory '${fhevmEnv.paths.cacheDir}'.`);
  }

  const res = await runSuper();
  return res;
});

subtask(TASK_COMPILE_GET_REMAPPINGS).setAction(async (_taskArgs, _hre, runSuper): Promise<Record<string, string>> => {
  debug(`execute TASK_COMPILE_GET_REMAPPINGS`);

  const fhevmEnv = fhevmContext.get();
  await fhevmEnv.minimalInit();

  // run super first.
  const res = (await runSuper()) as Record<string, string>;

  // apply our remapping
  const remappings = fhevmEnv.getRemappings();
  Object.entries(remappings).forEach(([k, v]) => {
    debug(`${picocolors.greenBright("remapping:")} ${k} => ${v}`);
    res[k] = v;
  });

  return res;
});

subtask(TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS).setAction(
  async (/*{ sourcePath }: { sourcePath?: string }*/ _taskArgs: TaskArguments, _hre, runSuper): Promise<string[]> => {
    debug(`execute TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS`);

    const fhevmEnv = fhevmContext.get();
    await fhevmEnv.minimalInit();
    await fhevmEnv.initializeAddresses(false /* ignoreCache */);

    // run super first.
    const filePaths: string[] = await runSuper();

    // append our solidity files.
    const fhevmSourcePaths = fhevmEnv.getSoliditySourcePaths();
    for (let i = 0; i < fhevmSourcePaths.length; ++i) {
      filePaths.push(fhevmSourcePaths[i]);
    }

    return filePaths;
  },
);

subtask(TASK_NODE_GET_PROVIDER).setAction(async (_taskArgs: TaskArguments, _hre, runSuper) => {
  // This task is not supposed to be called multiple times.
  const fhevmEnv = fhevmContext.get();

  if (!fhevmEnv.isDeployed) {
    fhevmEnv.setRunningInHHNode();
    await fhevmEnv.deploy();
    assertHHFhevm(fhevmEnv.isDeployed, "FhevmEnvironment is not initialized");
  }

  const res = await runSuper();
  return res;
});

subtask(TASK_NODE_SERVER_READY).setAction(
  async (
    _taskArgs: TaskArguments,
    // {
    //   address,
    //   port,
    //   provider,
    //   server,
    // }: {
    //   address: string;
    //   port: number;
    //   provider: EthereumProvider;
    //   server: JsonRpcServer;
    // },
    _hre,
    runSuper,
  ) => {
    // This task is not supposed to be called multiple times.
    const fhevmEnv = fhevmContext.get();

    if (!fhevmEnv.isDeployed) {
      fhevmEnv.setRunningInHHNode();
      await fhevmEnv.deploy();
      assertHHFhevm(fhevmEnv.isDeployed, "FhevmEnvironment is not initialized");
    }

    const res = await runSuper();
    return res;
  },
);
