import { HardhatFhevmError } from "../error";

export function assertFhevm(cond: boolean, message?: string) {
  if (!cond) {
    throw new HardhatFhevmError(message ?? "Fhevm assertion failed.");
  }
}
