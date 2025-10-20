import { HardhatFhevmRuntimeEnvironment } from "./types";

// declare module "hardhat/types/config" {
//   export interface HardhatConfig {}

//   export interface HardhatUserConfig {}
// }

declare module "hardhat/types/runtime" {
  export interface HardhatRuntimeEnvironment {
    fhevm: HardhatFhevmRuntimeEnvironment;
  }
}
