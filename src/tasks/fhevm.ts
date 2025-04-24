import { scope, types } from "hardhat/config";

import { fhevmContext } from "../internal/EnvironmentExtender";
import { SCOPE_FHEVM, SCOPE_FHEVM_TASK_INSTALL_SOLIDITY } from "../task-names";
import { HardhatFhevmMockType } from "../types";

const fhevmScope = scope(SCOPE_FHEVM, "Fhevm related commands");

fhevmScope
  .task(SCOPE_FHEVM_TASK_INSTALL_SOLIDITY)
  .setDescription("Install all the required fhevm solidity files associated with the selected network.")
  .addOptionalParam("repoDir", "Directory where the fhevm solidity files will be copied from", undefined, types.string)
  .addOptionalParam("dstDir", "Directory where the fhevm solidity files will be copied to", undefined, types.string)
  .addOptionalParam("mockType", "Type mock|onchain", undefined, types.string)
  .addFlag("extTfheLib", "Deploy MockPrecompile contract at address EXT_TFHE_LIBRARY.")
  .setAction(
    async ({
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      repoDir,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      dstDir,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      fhevmType,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      extTfheLib,
    }: {
      repoDir: string | undefined;
      dstDir: string | undefined;
      fhevmType: HardhatFhevmMockType;
      extTfheLib: boolean;
    }) => {
      const fhevmEnv = fhevmContext.get();
      console.log("fhevmEnv=" + fhevmEnv);
    },
  );
