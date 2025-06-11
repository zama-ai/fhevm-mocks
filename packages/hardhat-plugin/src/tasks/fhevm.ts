import {
  FhevmMockProviderType,
  FhevmType,
  isFhevmEaddress,
  isFhevmEbool,
  isFhevmEuint,
  tryParseFhevmType,
} from "@fhevm/mock-utils";
import { scope } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { HardhatFhevmError } from "../error";
import { fhevmContext } from "../internal/EnvironmentExtender";
import { SCOPE_FHEVM, SCOPE_FHEVM_TASK_INSTALL_SOLIDITY, SCOPE_FHEVM_TASK_USER_DECRYPT } from "../task-names";

const fhevmScope = scope(SCOPE_FHEVM, "Fhevm related commands");

fhevmScope
  .subtask(SCOPE_FHEVM_TASK_INSTALL_SOLIDITY)
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

async function initializeFhevmCLI(hre: HardhatRuntimeEnvironment) {
  const fhevmEnv = fhevmContext.get();
  if (fhevmEnv.isDeployed) {
    return;
  }

  if (hre.network.name !== "localhost") {
    throw new HardhatFhevmError(
      `The FHEVM mock CLI environment only supports Hardhat Node. Use parameter '--network localhost' to select the Hardhat Node network. (selected network: '${hre.network.name}')`,
    );
  }

  await fhevmEnv.minimalInit();

  // Only Hardhat Node or Sepolia (TODO)
  if (fhevmEnv.mockProvider.info.type !== FhevmMockProviderType.HardhatNode) {
    throw new HardhatFhevmError(
      `The FHEVM mock CLI environment only supports Hardhat Node. Use parameter '--network localhost' to select the Hardhat Node network. (selected network: '${hre.network.name}')`,
    );
  }

  await fhevmEnv.deploy();
}

fhevmScope
  .task(SCOPE_FHEVM_TASK_USER_DECRYPT)
  .setDescription("Performs a user decryption of the specified byte-32 handle")
  .addParam("type", "Specify the FHEVM primitive type name (e.g. ebool, euint8, euint16, etc.)")
  .addParam("handle", "Specify the byte-32 handle to decrypt")
  .addParam("user", "Specify which user account index")
  .addParam("contract", "Specify the contract address")
  .setAction(
    async (
      {
        type,
        handle,
        user,
        contract,
      }: {
        type: string;
        handle: string;
        user: string;
        contract: string;
      },
      hre: HardhatRuntimeEnvironment,
    ) => {
      // Can only run with --network localhost or --network sepolia or if called from another task (like 'test').
      // Because the --handle argument never exists in every other situation
      await initializeFhevmCLI(hre);

      const t: FhevmType | undefined = tryParseFhevmType(type);
      if (t === undefined) {
        throw new HardhatFhevmError(`Unknown FHEVM primitive type name ${type}`);
      }

      let accountIndex: number;
      accountIndex = Number.parseInt(user);
      if (Number.isNaN(accountIndex) || !Number.isInteger(accountIndex) || accountIndex < 0) {
        throw new HardhatFhevmError(`Invalid account index '${user}', expecting a positive integer.`);
      }

      const signers = await hre.ethers.getSigners();
      if (accountIndex >= signers.length) {
        throw new HardhatFhevmError(
          `Invalid account index '${user}', expecting a positive integer between 0 and ${signers.length - 1}.`,
        );
      }

      if (isFhevmEuint(t)) {
        try {
          const clearUint = await hre.fhevm.userDecryptEuint(t, handle, contract, signers[accountIndex]);
          console.log(clearUint);
        } catch (e) {
          if (e instanceof Error) {
            throw new HardhatFhevmError(e.message, e);
          } else {
            throw e;
          }
        }
      } else if (isFhevmEbool(t)) {
        try {
          const clearBool = await hre.fhevm.userDecryptEbool(handle, contract, signers[accountIndex]);
          console.log(clearBool);
        } catch (e) {
          if (e instanceof Error) {
            throw new HardhatFhevmError(e.message, e);
          } else {
            throw e;
          }
        }
      } else if (isFhevmEaddress(t)) {
        try {
          const clearAddress = await hre.fhevm.userDecryptEaddress(handle, contract, signers[accountIndex]);
          console.log(clearAddress);
        } catch (e) {
          if (e instanceof Error) {
            throw new HardhatFhevmError(e.message, e);
          } else {
            throw e;
          }
        }
      } else {
        throw new HardhatFhevmError(`Unsupported FHEVM type: ${t}`);
      }
    },
  );
