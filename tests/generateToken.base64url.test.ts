import { generateToken } from "../src/crypto";
import { bytesToBase64Url } from "../src/utils";

describe("bytesToBase64Url", () => {
  it("implements RFC 4648 base64url without padding", () => {
    expect(bytesToBase64Url(new Uint8Array())).toBe("");
    expect(bytesToBase64Url(new Uint8Array([0x66]))).toBe("Zg");
    expect(bytesToBase64Url(new Uint8Array([0x66, 0x6f]))).toBe("Zm8");
    expect(bytesToBase64Url(new Uint8Array([0x66, 0x6f, 0x6f]))).toBe("Zm9v");
    expect(bytesToBase64Url(new Uint8Array([0xff, 0xee, 0xdd]))).toBe("_-7d");
  });
});

describe("generateToken encoding", () => {
  const originalCrypto = globalThis.crypto;

  afterEach(() => {
    Object.defineProperty(globalThis, "crypto", {
      value: originalCrypto,
      configurable: true,
    });
  });

  it("keeps hex as the default encoding", () => {
    const token = generateToken();
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]+$/);
  });

  it("supports explicit hex encoding", () => {
    const token = generateToken("hex");
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]+$/);
  });

  it("returns a 43-character URL-safe base64url token without padding", () => {
    const token = generateToken("base64url");
    expect(token).toHaveLength(43);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token).not.toContain("=");
  });

  it("encodes the same 32 random bytes correctly in either format", () => {
    const getRandomValues = jest.fn((arr: Uint8Array) => {
      arr.fill(0xab);
      return arr;
    });

    Object.defineProperty(globalThis, "crypto", {
      value: { getRandomValues },
      configurable: true,
    });

    const hex = generateToken("hex");
    const base64url = generateToken("base64url");

    expect(hex).toBe("ab".repeat(32));
    expect(base64url).toBe(
      "q6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6s",
    );
    expect(Buffer.from(hex, "hex")).toEqual(Buffer.from(base64url, "base64url"));
  });
});
