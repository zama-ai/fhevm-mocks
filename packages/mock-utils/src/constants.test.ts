import { describe, expect, it } from "vitest";

import constants from "./constants.js";

describe("Constants", () => {
  it("decryption eip712 domain name", () => {
    const domain = constants.DECRYPTION_EIP712_DOMAIN;
    expect(domain.name).toBe("Decryption");
  });

  it("decryption eip712 domain version", () => {
    const domain = constants.DECRYPTION_EIP712_DOMAIN;
    expect(domain.version).toBe("1");
  });
});
