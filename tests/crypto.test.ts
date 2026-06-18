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

  it("produces 1000 unique values across consecutive calls", () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      tokens.add(generateToken());
    }
    expect(tokens.size).toBe(1000);
  });
});

describe("hashToken", () => {
  it("returns a 64-char hex string", () => {
    expect(hashToken("mytoken")).toHaveLength(64);
    expect(hashToken("mytoken")).toMatch(/^[0-9a-f]+$/);
  });

  it("is deterministic", () => {
    expect(hashToken("mytoken")).toBe(hashToken("mytoken"));
  });

  it("produces different hashes for different tokens", () => {
    expect(hashToken("token-a")).not.toBe(hashToken("token-b"));
  });

  it("differs from hashIdentifier for the same input", () => {
    // hashToken does not trim/lowercase — they should differ
    expect(hashToken("ALICE")).not.toBe(hashIdentifier("ALICE"));
  });
});

describe("encryptVote / decryptVote", () => {
  it("round-trips correctly", () => {
    const option = "Yes";
    const encrypted = encryptVote(option, TEST_KEY);
    expect(decryptVote(encrypted, TEST_KEY)).toBe(option);
  });

  it("produces different ciphertexts for the same input (random IV)", () => {
    const option = "Yes";
    const first = encryptVote(option, TEST_KEY);
    const second = encryptVote(option, TEST_KEY);
    expect(first.ciphertext).not.toBe(second.ciphertext);
    expect(first.iv).not.toBe(second.iv);
  });

  it("returns an EncryptedPayload with hex-encoded ciphertext, iv, and authTag", () => {
    const encrypted = encryptVote("Yes", TEST_KEY);
    expect(encrypted.ciphertext).toMatch(/^[0-9a-f]+$/);
    expect(encrypted.iv).toMatch(/^[0-9a-f]+$/);
    expect(encrypted.authTag).toMatch(/^[0-9a-f]+$/);
  });

  it("throws on invalid key length", () => {
    expect(() => encryptVote("Yes", "tooshort")).toThrow();
  });

  it("throws on tampered ciphertext", () => {
    const encrypted = encryptVote("Yes", TEST_KEY);
    const tampered = { ...encrypted, ciphertext: "00".repeat(8) };
    expect(() => decryptVote(tampered, TEST_KEY)).toThrow();
  });

  it("throws on tampered auth tag", () => {
    const encrypted = encryptVote("Yes", TEST_KEY);
    const tampered = { ...encrypted, authTag: "00".repeat(16) };
    expect(() => decryptVote(tampered, TEST_KEY)).toThrow();
  });
});
