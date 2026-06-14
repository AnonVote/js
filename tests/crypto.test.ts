import {
  hashIdentifier,
  generateToken,
  hashToken,
  encryptVote,
  decryptVote,
} from "../src/crypto";

const TEST_KEY = "a".repeat(64); // 32 bytes hex for tests

describe("hashIdentifier", () => {
  it("returns a 64-char hex string", () => {
    expect(hashIdentifier("alice@example.com")).toHaveLength(64);
    expect(hashIdentifier("alice@example.com")).toMatch(/^[0-9a-f]+$/);
  });

  it("is deterministic", () => {
    expect(hashIdentifier("alice@example.com")).toBe(
      hashIdentifier("alice@example.com"),
    );
  });

  it("trims and lowercases before hashing", () => {
    expect(hashIdentifier("  Alice@Example.COM  ")).toBe(
      hashIdentifier("alice@example.com"),
    );
  });

  it("produces different hashes for different inputs", () => {
    expect(hashIdentifier("alice@example.com")).not.toBe(
      hashIdentifier("bob@example.com"),
    );
  });
});

describe("generateToken", () => {
  it("returns a 64-char hex string (32 bytes)", () => {
    const token = generateToken();
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]+$/);
  });

  it("returns a different token each call", () => {
    expect(generateToken()).not.toBe(generateToken());
  });
});

describe("hashToken", () => {
  it("returns a 64-char hex string", () => {
    expect(hashToken("mytoken")).toHaveLength(64);
  });

  it("is deterministic", () => {
    expect(hashToken("mytoken")).toBe(hashToken("mytoken"));
  });

  it("differs from hashIdentifier for the same input", () => {
    // hashToken does not trim/lowercase — they should differ
    expect(hashToken("ALICE")).not.toBe(hashIdentifier("ALICE"));
  });
});

describe("encryptVote / decryptVote", () => {
  it("round-trips correctly", () => {
    const optionId = "option-uuid-1234";
    const encrypted = encryptVote(optionId, TEST_KEY);
    expect(decryptVote(encrypted, TEST_KEY)).toBe(optionId);
  });

  it("produces different ciphertexts for the same input (random IV)", () => {
    const optionId = "option-uuid-1234";
    expect(encryptVote(optionId, TEST_KEY)).not.toBe(
      encryptVote(optionId, TEST_KEY),
    );
  });

  it("encrypted payload has three base64 segments (iv:authTag:ciphertext)", () => {
    const parts = encryptVote("opt-1", TEST_KEY).split(":");
    expect(parts).toHaveLength(3);
    parts.forEach((p) => expect(p.length).toBeGreaterThan(0));
  });

  it("throws on invalid key length", () => {
    expect(() => encryptVote("opt", "tooshort")).toThrow();
  });

  it("throws on tampered ciphertext", () => {
    const encrypted = encryptVote("option-uuid-1234", TEST_KEY);
    const parts = encrypted.split(":");
    parts[2] = Buffer.from("tampered").toString("base64");
    expect(() => decryptVote(parts.join(":"), TEST_KEY)).toThrow();
  });

  it("throws on malformed payload", () => {
    expect(() => decryptVote("notvalid", TEST_KEY)).toThrow();
  });
});
