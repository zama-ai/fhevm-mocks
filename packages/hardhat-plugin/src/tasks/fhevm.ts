import {
  FhevmType,
  contracts,
  getCoprocessorConfig,
  isFhevmEaddress,
  isFhevmEbool,
  isFhevmEuint,
  tryParseFhevmType,
} from "@fhevm/mock-utils";
import { assertIsAddress } from "@fhevm/mock-utils/utils";
import { scope } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { HardhatFhevmError } from "../error";
import { fhevmContext } from "../internal/EnvironmentExtender";
import constants from "../internal/constants";
import { jsonStringifyBigInt } from "../internal/utils/log";
import {
  SCOPE_FHEVM,
  SCOPE_FHEVM_TASK_CHECK_FHEVM_COMPATIBILITY,
  SCOPE_FHEVM_TASK_INSTALL_SOLIDITY,
  SCOPE_FHEVM_TASK_PUBLIC_DECRYPT,
  SCOPE_FHEVM_TASK_RESOLVE_FHEVM_CONFIG,
  SCOPE_FHEVM_TASK_USER_DECRYPT,
} from "../task-names";

import picocolors = require("picocolors");

const fhevmScope = scope(SCOPE_FHEVM, "Fhevm related commands");

// This is an internal fhevm subtask.
// It is exclusively used by `packages/hardhat-plugin/src/internal/deploy/PrecompiledFhevmHostContracts.ts`
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
        await fhevmEnv.minimalInitWithAddresses(ignoreCache);
        //await fhevmEnv.initializeAddresses(ignoreCache);
      } finally {
        try {
          fhevmEnv.unsetRunningInHHFHEVMInstallSolidity();
        } catch {
          // Intentionally ignore errors
        }
      }
    },
  );

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
      const fhevmEnv = fhevmContext.get();
      await fhevmEnv.initializeCLIApi();

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
      //npx hardhat fhevm user-decrypt --type euint32 --handle 0x9b01877d34a170d07905d4a4224a6ca6f7bc1f5695ff0000000000aa36a70400 --user 0 --contract 0x2C6A7e015B77E7c984c0a9280b89aa70721DEeCe
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

fhevmScope
  .task(SCOPE_FHEVM_TASK_PUBLIC_DECRYPT)
  .setDescription("Performs a public decryption of the specified byte-32 handle")
  .addParam("type", "Specify the FHEVM primitive type name (e.g. ebool, euint8, euint16, etc.)")
  .addParam("handle", "Specify the byte-32 handle to decrypt")
  .setAction(
    async (
      {
        type,
        handle,
      }: {
        type: string;
        handle: string;
      },
      hre: HardhatRuntimeEnvironment,
    ) => {
      const fhevmEnv = fhevmContext.get();
      await fhevmEnv.initializeCLIApi();

      const t: FhevmType | undefined = tryParseFhevmType(type);
      if (t === undefined) {
        throw new HardhatFhevmError(`Unknown FHEVM primitive type name ${type}`);
      }

      if (isFhevmEuint(t)) {
        try {
          const clearUint = await hre.fhevm.publicDecryptEuint(t, handle);
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
          const clearBool = await hre.fhevm.publicDecryptEbool(handle);
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
          const clearAddress = await hre.fhevm.publicDecryptEaddress(handle);
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
  .task(SCOPE_FHEVM_TASK_CHECK_FHEVM_COMPATIBILITY)
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
      if (!hre.ethers.isAddress(address)) {
        throw new HardhatFhevmError(`Invalid --address parameter value. '${address}' is not a valid address.`);
      }
      const fhevmEnv = fhevmContext.get();
      await fhevmEnv.minimalInit();

      const coprocessorConfig = await getCoprocessorConfig(hre.ethers.provider, address);
      if (
        coprocessorConfig.ACLAddress === hre.ethers.ZeroAddress &&
        coprocessorConfig.CoprocessorAddress === hre.ethers.ZeroAddress &&
        coprocessorConfig.KMSVerifierAddress === hre.ethers.ZeroAddress
      ) {
        const deployedCode = await fhevmEnv.mockProvider.getCodeAt(address);
        if (deployedCode === undefined || deployedCode === "0x") {
          throw new HardhatFhevmError(`The address '${address}' does not correspond to a deployed contract.`);
        }
      }

      try {
        const repo = await contracts.FhevmContractsRepository.create(hre.ethers.provider, {
          aclContractAddress: coprocessorConfig.ACLAddress,
          kmsContractAddress: coprocessorConfig.KMSVerifierAddress,
        });

        const o = {
          address,
          coprocessorConfig,
          FhevmInstanceConfig: repo.getFhevmInstanceConfig({
            chainId: fhevmEnv.chainId,
            relayerUrl: constants.ZAMA_FHE_RELAYER_SDK_PACKAGE.sepolia.relayerUrl,
          }),
        };

        console.log(JSON.stringify(o, null, 2));
      } catch {
        console.log(picocolors.red("Invalid Coprocessor Configuration:"));
        console.log(JSON.stringify(coprocessorConfig, null, 2));
        throw new HardhatFhevmError(
          `The contract deployed at ${address} is not using a valid Coprocessor configuration`,
        );
      }
    },
  );

// npx hardhat --network sepolia fhevm resolve-fhevm-config --acl 0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D --kms 0xbE0E383937d564D7FF0BC3b46c51f0bF8d5C311A
// npx hardhat --network sepolia fhevm resolve-fhevm-config --acl 0xBCA6F8De823a399Dc431930FD5EE550Bf1C0013e --kms 0x3F3819BeBE4bD0EFEf8078Df6f9B574ADa80CCA4
fhevmScope
  .task(SCOPE_FHEVM_TASK_RESOLVE_FHEVM_CONFIG)
  .setDescription("Resolve full FHEVM configuration")
  .addOptionalParam("acl", "Specify the acl contract address")
  .addOptionalParam("kms", "Specify the kms contract address")
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

      if (!acl) {
        acl = constants.ZAMA_FHE_RELAYER_SDK_PACKAGE.sepolia.ACLAddress;
      }
      if (!kms) {
        kms = constants.ZAMA_FHE_RELAYER_SDK_PACKAGE.sepolia.KMSVerifierAddress;
      }

      assertIsAddress(acl, "acl");
      assertIsAddress(kms, "kms");

      const repo = await contracts.FhevmContractsRepository.create(hre.ethers.provider, {
        aclContractAddress: acl,
        kmsContractAddress: kms,
      });

      const cfg = repo.getFhevmInstanceConfig({
        chainId: fhevmEnv.chainId,
        relayerUrl: constants.ZAMA_FHE_RELAYER_SDK_PACKAGE.sepolia.relayerUrl,
      });

      const inputEIP712 = repo.inputVerifier.eip712Domain;
      const kmsEIP712 = repo.kmsVerifier.eip712Domain;

      const res = {
        config: cfg,
        inputVerifierEIP712: inputEIP712,
        kmsVerifierEIP712: kmsEIP712,
        HCULimit: repo.hcuLimit.address,
      };

      console.log(jsonStringifyBigInt(res, 2));
    },
  );

fhevmScope.task("pipo").setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
  console.log(taskArgs ? "hello" : "byte");
  console.log(hre ? "hello" : "byte");

  const fhevmEnv = fhevmContext.get();
  await fhevmEnv.initializeCLIApi();
});
