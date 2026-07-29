import {
  hashIdentifier,
  generateToken,
  hashToken,
  generateBallotKey,
  encryptVote,
  decryptVote,
  verifyVoteHash,
} from "../src/crypto";
import { AnonVoteCryptoError, EncryptedPayload } from "../src/types";

/** A valid 64-character hex key representing 32 bytes — used across encrypt/decrypt tests. */
const TEST_KEY = "a".repeat(64);

// ── hashIdentifier ────────────────────────────────────────────────────────────

describe("hashIdentifier", () => {
  it("returns a 64-character lowercase hex string", () => {
    const result = hashIdentifier("alice@example.com");
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  it("returns a 64-char hex string", () => {
    const hash = hashIdentifier("alice@example.com");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it("is deterministic — same input always produces same output", () => {
    expect(hashIdentifier("alice@example.com")).toBe(
      hashIdentifier("alice@example.com"),
    );
  });

  it("normalises casing — Alice@example.com equals alice@example.com", () => {
    expect(hashIdentifier("Alice@example.com")).toBe(
      hashIdentifier("alice@example.com"),
    );
  });

  it("normalises whitespace — leading and trailing spaces are stripped", () => {
    expect(hashIdentifier("  alice@example.com  ")).toBe(
      hashIdentifier("alice@example.com"),
    );
  });

  it("normalises both — uppercase with spaces equals lowercase", () => {
    expect(hashIdentifier("  Alice@Example.COM  ")).toBe(
      hashIdentifier("alice@example.com"),
    );
  });

  it("empty string and whitespace-only string produce the same hash", () => {
    expect(hashIdentifier("")).toBe(hashIdentifier("   "));
  });

  it("two meaningfully different inputs produce different hashes", () => {
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

// ── generateToken ─────────────────────────────────────────────────────────────

describe("generateToken", () => {
  it("returns a 64-character lowercase hex string", () => {
    const token = generateToken();
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces unique values — 1000 consecutive calls produce 1000 distinct tokens", () => {
    const tokens = Array.from({ length: 1000 }, () => generateToken());
    const unique = new Set(tokens);
    expect(unique.size).toBe(1000);
  });

  it("output contains only valid hex characters", () => {
    for (let i = 0; i < 20; i++) {
      expect(generateToken()).toMatch(/^[0-9a-f]+$/);
    }
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

// ── hashToken ─────────────────────────────────────────────────────────────────

describe("hashToken", () => {
  it("returns a 64-character lowercase hex string", () => {
    const result = hashToken("mytoken");
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic", () => {
    expect(hashToken("mytoken")).toBe(hashToken("mytoken"));
  });

  it("different tokens produce different hashes", () => {
    expect(hashToken("token-a")).not.toBe(hashToken("token-b"));
  });

  it("output is distinct from hashIdentifier output for the same input", () => {
    // hashToken does not normalise — hashIdentifier("ALICE") lowercases first
    // so they hash different byte sequences and must differ
  it("produces different hashes for different tokens", () => {
    expect(hashToken("token-a")).not.toBe(hashToken("token-b"));
  });

  it("differs from hashIdentifier for the same input", () => {
    // hashToken does not trim/lowercase â€” they should differ
    expect(hashToken("ALICE")).not.toBe(hashIdentifier("ALICE"));
  });
});

// ── encryptVote ───────────────────────────────────────────────────────────────

describe("encryptVote", () => {
  it("returns an EncryptedPayload with ciphertext, iv, and authTag as hex strings", () => {
    const payload = encryptVote("option-uuid-1234", TEST_KEY);
    expect(payload).toHaveProperty("ciphertext");
    expect(payload).toHaveProperty("iv");
    expect(payload).toHaveProperty("authTag");
    expect(payload.ciphertext).toMatch(/^[0-9a-f]+$/);
    expect(payload.iv).toMatch(/^[0-9a-f]+$/);
    expect(payload.authTag).toMatch(/^[0-9a-f]+$/);
describe("generateBallotKey", () => {
  it("returns a 44-char base64 string (32 bytes)", () => {
    const key = generateBallotKey();
    expect(key).toHaveLength(44);
  });

  it("can be decoded to 32 bytes", () => {
    const key = generateBallotKey();
    const decoded = Buffer.from(key, "base64");
    expect(decoded).toHaveLength(32);
  });

  it("returns a different key each call", () => {
    expect(generateBallotKey()).not.toBe(generateBallotKey());
  });
});

describe("encryptVote / decryptVote", () => {
  it("round-trips correctly", () => {
    const option = "Yes";
    const encrypted = encryptVote(option, TEST_KEY);
    expect(decryptVote(encrypted, TEST_KEY)).toBe(option);
  });

  it("generates a unique IV on every call — same option and key produce different ciphertexts", () => {
    const a = encryptVote("option-uuid-1234", TEST_KEY);
    const b = encryptVote("option-uuid-1234", TEST_KEY);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it("throws AnonVoteCryptoError INVALID_KEY for a 32-character key", () => {
    expect(() => encryptVote("opt", "a".repeat(32))).toThrow(AnonVoteCryptoError);
    try {
      encryptVote("opt", "a".repeat(32));
    } catch (err) {
      expect((err as AnonVoteCryptoError).code).toBe("INVALID_KEY");
    }
  });

  it("throws AnonVoteCryptoError INVALID_KEY for a 128-character key", () => {
    expect(() => encryptVote("opt", "a".repeat(128))).toThrow(AnonVoteCryptoError);
    try {
      encryptVote("opt", "a".repeat(128));
    } catch (err) {
      expect((err as AnonVoteCryptoError).code).toBe("INVALID_KEY");
    }
  });

  it("throws AnonVoteCryptoError INVALID_KEY for a non-hex key", () => {
    // 64 characters but contains non-hex chars
    const nonHexKey = "z".repeat(64);
    expect(() => encryptVote("opt", nonHexKey)).toThrow(AnonVoteCryptoError);
    try {
      encryptVote("opt", nonHexKey);
    } catch (err) {
      expect((err as AnonVoteCryptoError).code).toBe("INVALID_KEY");
    }
  });

  it("ciphertext length varies with input length", () => {
    const short = encryptVote("a", TEST_KEY);
    const long = encryptVote("a".repeat(200), TEST_KEY);
    expect(long.ciphertext.length).toBeGreaterThan(short.ciphertext.length);
  });
});

// ── decryptVote ───────────────────────────────────────────────────────────────

describe("decryptVote", () => {
  it("roundtrip — encryptVote then decryptVote returns the original optionId", () => {
    const optionId = "option-uuid-1234";
    const payload = encryptVote(optionId, TEST_KEY);
    expect(decryptVote(payload, TEST_KEY)).toBe(optionId);
  });

  it("roundtrip is stable across multiple encrypt-decrypt cycles", () => {
    const optionId = "stable-option-id";
    for (let i = 0; i < 10; i++) {
      const payload = encryptVote(optionId, TEST_KEY);
      expect(decryptVote(payload, TEST_KEY)).toBe(optionId);
    }
  });

  it("throws on a tampered ciphertext — single byte modification", () => {
    const payload = encryptVote("option-uuid-1234", TEST_KEY);
    // Flip the first byte of ciphertext
    const tamperedCiphertext =
      (parseInt(payload.ciphertext[0], 16) ^ 1).toString(16) +
      payload.ciphertext.slice(1);
    const tampered: EncryptedPayload = {
      ...payload,
      ciphertext: tamperedCiphertext,
    };
    expect(() => decryptVote(tampered, TEST_KEY)).toThrow();
  });

  it("throws on a tampered authTag — single byte modification", () => {
    const payload = encryptVote("option-uuid-1234", TEST_KEY);
    const tamperedAuthTag =
      (parseInt(payload.authTag[0], 16) ^ 1).toString(16) +
      payload.authTag.slice(1);
    const tampered: EncryptedPayload = { ...payload, authTag: tamperedAuthTag };
    expect(() => decryptVote(tampered, TEST_KEY)).toThrow();
  });

  it("throws on a tampered iv — single byte modification", () => {
    const payload = encryptVote("option-uuid-1234", TEST_KEY);
    const tamperedIv =
      (parseInt(payload.iv[0], 16) ^ 1).toString(16) + payload.iv.slice(1);
    const tampered: EncryptedPayload = { ...payload, iv: tamperedIv };
    expect(() => decryptVote(tampered, TEST_KEY)).toThrow();
  });

  it("throws AnonVoteCryptoError INVALID_PAYLOAD for missing ciphertext field", () => {
    const payload = encryptVote("option-uuid-1234", TEST_KEY);
    const broken = { ...payload, ciphertext: "" };
    expect(() => decryptVote(broken, TEST_KEY)).toThrow(AnonVoteCryptoError);
    try {
      decryptVote(broken, TEST_KEY);
    } catch (err) {
      expect((err as AnonVoteCryptoError).code).toBe("INVALID_PAYLOAD");
    }
  });

  it("throws AnonVoteCryptoError INVALID_PAYLOAD for empty authTag", () => {
    const payload = encryptVote("option-uuid-1234", TEST_KEY);
    const broken = { ...payload, authTag: "" };
    expect(() => decryptVote(broken, TEST_KEY)).toThrow(AnonVoteCryptoError);
    try {
      decryptVote(broken, TEST_KEY);
    } catch (err) {
      expect((err as AnonVoteCryptoError).code).toBe("INVALID_PAYLOAD");
    }
  });

  it("never returns wrong output silently — all failure modes throw", () => {
    // Verify that a wrong key causes a throw, not a wrong decryption result
    const payload = encryptVote("option-uuid-1234", TEST_KEY);
    const wrongKey = "b".repeat(64);
    expect(() => decryptVote(payload, wrongKey)).toThrow();
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
      "Invalid ballot key length: expected 32 bytes (256 bits), got 6 bytes",
    );
  });

  it("throws on empty vote option", () => {
    expect(() => encryptVote("", TEST_KEY)).toThrow("Vote option must not be empty");
  });

  it("throws on tampered ciphertext", () => {
    const encrypted = encryptVote("option-uuid-1234", TEST_KEY);
    const tampered = {
      ...encrypted,
      ciphertext: Buffer.from("tampered").toString("base64"),
    };
    expect(() => decryptVote(tampered, TEST_KEY)).toThrow(
      /Decryption failed/,
    );
  });

  it("throws on malformed payload (missing fields)", () => {
    // @ts-ignore - testing invalid input
    expect(() => decryptVote({ authTag: "", ciphertext: "" }, TEST_KEY)).toThrow(
      /Invalid encrypted payload format/,
    );
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
