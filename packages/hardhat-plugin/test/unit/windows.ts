import { expect } from "chai";

import { toUnixRelPath } from "../../src/internal/utils/path";

describe("Windows", function () {
  it("path", async function () {
    // Invalid import fhevmTemp\@fhevm\solidity\config/ZamaConfig.sol from contracts/FHECounter.sol. Imports must use / instead of \, even in Windows
    const str = "fhevmTemp\\@fhevm\\solidity\\config/ZamaConfig.sol";
    expect(toUnixRelPath(str) === "fhevmTemp/@fhevm/solidity/config/ZamaConfig.sol");
  });
});
