import { scope } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { HardhatFhevmError } from "../error";
import { fhevmContext } from "../internal/EnvironmentExtender";
import { SCOPE_FHEVM, SCOPE_FHEVM_TASK_INSTALL_SOLIDITY } from "../task-names";

const fhevmScope = scope(SCOPE_FHEVM, "Fhevm related commands");

fhevmScope
  .task(SCOPE_FHEVM_TASK_INSTALL_SOLIDITY)
  .setDescription("Install all the required fhevm solidity files associated with the selected network.")
  .addFlag("ignoreCache", "Force recompute addresses.")
  .setAction(
    async (
      {
        ignoreCache,
      }: {
        ignoreCache: boolean;
      },
      hre: HardhatRuntimeEnvironment,
    ) => {
      if (hre.network.name !== "hardhat") {
        throw new HardhatFhevmError(
          `Please run 'npx hardhat ${SCOPE_FHEVM} ${SCOPE_FHEVM_TASK_INSTALL_SOLIDITY}' using the '--network hardhat' option. The current network is '${hre.network.name}'`,
        );
      }

      const fhevmEnv = fhevmContext.get();
      if (fhevmEnv.isRunningInHHFHEVMInstallSolidity) {
        throw new HardhatFhevmError(
          `Command hardhat ${SCOPE_FHEVM} ${SCOPE_FHEVM_TASK_INSTALL_SOLIDITY} is already running`,
        );
      }

      fhevmEnv.setRunningInHHFHEVMInstallSolidity();

      try {
        await fhevmEnv.minimalInit();
        await fhevmEnv.initializeAddresses(ignoreCache);
      } finally {
        try {
          fhevmEnv.unsetRunningInHHFHEVMInstallSolidity();
        } catch {
          // Intentionally ignore errors
        }
      }
    },
  );
