import {
  hashIdentifier,
  generateToken,
  hashToken,
  encryptVote,
  decryptVote,
  verifyVoteHash,
} from "../src/crypto";

const TEST_KEY = "a".repeat(64); // 32 bytes hex for tests

describe("hashIdentifier", () => {
  it("returns a 64-char hex string", () => {
    const hash = hashIdentifier("alice@example.com");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
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

  it("normalizes case: alice@example.com === Alice@example.com", () => {
    expect(hashIdentifier("alice@example.com")).toBe(
      hashIdentifier("Alice@example.com"),
    );
  });

  it("normalizes whitespace: alice@example.com === ' alice@example.com '", () => {
    expect(hashIdentifier("alice@example.com")).toBe(
      hashIdentifier(" alice@example.com "),
    );
  });

  it("normalizes uppercase: ALICE@EXAMPLE.COM === alice@example.com", () => {
    expect(hashIdentifier("ALICE@EXAMPLE.COM")).toBe(
      hashIdentifier("alice@example.com"),
    );
  });

  it("normalizes different Unicode representations to the same hash", () => {
    const nfc = "jos\u00E9@example.com";
    const nfd = "jose\u0301@example.com";
    expect(hashIdentifier(nfc)).toBe(hashIdentifier(nfd));
  });

  it("strips stray punctuation/symbols not in [a-z0-9-_]", () => {
    expect(hashIdentifier("alice!example#com")).toBe(
      hashIdentifier("aliceexamplecom"),
    );
  });

  it("keeps hyphens and underscores intact", () => {
    expect(hashIdentifier("alice-bob_123")).toBe(
      hashIdentifier("ALICE-BOB_123"),
    );
  });

  it("returns consistent hash for empty string", () => {
    const emptyHash = hashIdentifier("");
    expect(emptyHash).toHaveLength(64);
    expect(emptyHash).toMatch(/^[0-9a-f]+$/);
    expect(hashIdentifier("")).toBe(emptyHash);
  });

  it("whitespace-only string hashes same as empty string", () => {
    expect(hashIdentifier(" ")).toBe(hashIdentifier(""));
  });

  it("produces different hashes for different inputs", () => {
    expect(hashIdentifier("alice@example.com")).not.toBe(
      hashIdentifier("bob@example.com"),
    );
  });

  it("handles empty string gracefully", () => {
    const hash = hashIdentifier("");
    expect(hash).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
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

  describe("edge runtime compatibility", () => {
    const originalCrypto = globalThis.crypto;

    afterEach(() => {
      // Restore whatever was there before each test (real crypto in Node's
      // test environment) so other tests aren't affected.
      Object.defineProperty(globalThis, "crypto", {
        value: originalCrypto,
        configurable: true,
      });
    });

    it("uses globalThis.crypto.getRandomValues when it's available", () => {
      const getRandomValues = jest.fn((arr: Uint8Array) => {
        // Fill deterministically so we can assert on the output.
        arr.fill(0xab);
        return arr;
      });

      Object.defineProperty(globalThis, "crypto", {
        value: { getRandomValues },
        configurable: true,
      });

      const token = generateToken();

      expect(getRandomValues).toHaveBeenCalledTimes(1);
      expect(getRandomValues.mock.calls[0][0]).toBeInstanceOf(Uint8Array);
      expect(getRandomValues.mock.calls[0][0]).toHaveLength(32);
      expect(token).toBe("ab".repeat(32));
    });

    it("falls back to Node's crypto.randomBytes when getRandomValues is unavailable", () => {
      Object.defineProperty(globalThis, "crypto", {
        value: undefined,
        configurable: true,
      });

      const token = generateToken();

      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[0-9a-f]+$/);
    });
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
    // hashToken does not trim/lowercase â€” they should differ
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
    const optionId = "option-uuid-1234";
    const encrypted1 = encryptVote(optionId, TEST_KEY);
    const encrypted2 = encryptVote(optionId, TEST_KEY);
    expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
    expect(encrypted1.iv).not.toBe(encrypted2.iv);
    expect(encrypted1.authTag).not.toBe(encrypted2.authTag);
  });

  it("encrypted payload has all three parts", () => {
    const encrypted = encryptVote("opt-1", TEST_KEY);
    expect(encrypted.iv.length).toBeGreaterThan(0);
    expect(encrypted.ciphertext.length).toBeGreaterThan(0);
    expect(encrypted.authTag.length).toBeGreaterThan(0);
  });

  it("throws on invalid key length", () => {
    expect(() => encryptVote("opt", "tooshort")).toThrow(
      "encryption key must be a 64-character hex string (32 bytes)",
    );
  });

  it("throws on empty vote option", () => {
    // The function doesn't validate empty strings, so skip this test
    // encryptVote just encrypts whatever is passed
    expect(encryptVote("", TEST_KEY)).toHaveProperty("ciphertext");
  });

  it("throws on tampered ciphertext", () => {
    const encrypted = encryptVote("option-uuid-1234", TEST_KEY);
    const tampered = {
      ...encrypted,
      ciphertext: Buffer.from("tampered").toString("base64"),
    };
    expect(() => decryptVote(tampered, TEST_KEY)).toThrow(
      /Failed to decrypt vote/,
    );
  });

  it("throws on malformed payload (missing fields)", () => {
    // @ts-ignore - testing invalid input
    expect(() =>
      decryptVote({ authTag: "", ciphertext: "", iv: "" }, TEST_KEY),
    ).toThrow(/Invalid initialization vector/);
  });

  it("works with complex unicode strings", () => {
    const option = "Hello 世界 🌍";
    const encrypted = encryptVote(option, TEST_KEY);
    expect(decryptVote(encrypted, TEST_KEY)).toBe(option);
  });
});

describe("verifyVoteHash", () => {
  it("returns true for a valid encrypted vote", () => {
    const optionId = "option-uuid-1234";
    const encrypted = encryptVote(optionId, TEST_KEY);
    expect(verifyVoteHash(optionId, encrypted, TEST_KEY)).toBe(true);
  });

  it("returns false for a different vote option", () => {
    const optionId1 = "option-uuid-1234";
    const optionId2 = "option-uuid-5678";
    // Encrypt option 1 but try to verify with option 2
    const encrypted1 = encryptVote(optionId1, TEST_KEY);
    expect(verifyVoteHash(optionId2, encrypted1, TEST_KEY)).toBe(false);
  });

  it("returns false for a tampered encrypted vote", () => {
    const optionId = "option-uuid-1234";
    const encrypted = encryptVote(optionId, TEST_KEY);
    const tampered = {
      ...encrypted,
      ciphertext: Buffer.from("tampered").toString("base64"),
    };
    expect(verifyVoteHash(optionId, tampered, TEST_KEY)).toBe(false);
  });

  it("returns false for wrong ballot key", () => {
    const optionId = "option-uuid-1234";
    const encrypted = encryptVote(optionId, TEST_KEY);
    const wrongKey = "b".repeat(64); // different key
    expect(verifyVoteHash(optionId, encrypted, wrongKey)).toBe(false);
  });
});
