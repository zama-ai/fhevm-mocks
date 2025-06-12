import {
  FhevmMockProviderType,
  FhevmType,
  contracts,
  getFHEVMConfig,
  isFhevmEaddress,
  isFhevmEbool,
  isFhevmEuint,
  tryParseFhevmType,
} from "@fhevm/mock-utils";
import { scope } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import constants from "../constants";
import { HardhatFhevmError } from "../error";
import { fhevmContext } from "../internal/EnvironmentExtender";
import {
  SCOPE_FHEVM,
  SCOPE_FHEVM_TASK_CHECK_CONTRACT,
  SCOPE_FHEVM_TASK_INSTALL_SOLIDITY,
  SCOPE_FHEVM_TASK_RESOLVE_FHEVM_CONFIG,
  SCOPE_FHEVM_TASK_USER_DECRYPT,
} from "../task-names";

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

// npx hardhat --network sepolia fhevm check-contract --address 0x8D94d6f1593A50DDF52D317016e3dD1af1EE1292
fhevmScope
  .task(SCOPE_FHEVM_TASK_CHECK_CONTRACT)
  .setDescription("Checks if a FHEVM contract is well configured to perform FHEVM operations")
  .addParam("address", "Specify the contract address")
  .setAction(
    async (
      {
        address,
      }: {
        address: string;
      },
      hre: HardhatRuntimeEnvironment,
    ) => {
      const fhevmEnv = fhevmContext.get();
      await fhevmEnv.minimalInit();

      const fhevmConfig = await getFHEVMConfig(hre.ethers.provider, address);

      const repo = await contracts.FhevmContractsRepository.create(hre.ethers.provider, {
        aclContractAddress: fhevmConfig.ACLAddress,
        kmsContractAddress: fhevmConfig.KMSVerifierAddress,
      });

      const o = {
        address,
        FHEVMConfigStruct: fhevmConfig,
        FhevmInstanceConfig: repo.getFhevmInstanceConfig({
          chainId: fhevmEnv.chainId,
          relayerUrl: constants.RELAYER_URL,
        }),
      };

      console.log(JSON.stringify(o, null, 2));
    },
  );

// npx hardhat --network sepolia fhevm resolve-fhevm-config --acl 0x687820221192C5B662b25367F70076A37bc79b6c --kms 0x1364cBBf2cDF5032C47d8226a6f6FBD2AFCDacAC
fhevmScope
  .task(SCOPE_FHEVM_TASK_RESOLVE_FHEVM_CONFIG)
  .setDescription("Resolve full FHEVM configuration")
  .addParam("acl", "Specify the acl contract address")
  .addParam("kms", "Specify the kms contract address")
  .setAction(
    async (
      {
        acl,
        kms,
      }: {
        acl: string;
        kms: string;
      },
      hre: HardhatRuntimeEnvironment,
    ) => {
      const fhevmEnv = fhevmContext.get();
      await fhevmEnv.minimalInit();

      const repo = await contracts.FhevmContractsRepository.create(hre.ethers.provider, {
        aclContractAddress: acl,
        kmsContractAddress: kms,
      });

      const cfg = repo.getFhevmInstanceConfig({ chainId: fhevmEnv.chainId, relayerUrl: constants.RELAYER_URL });

      console.log(JSON.stringify(cfg, null, 2));
    },
  );
