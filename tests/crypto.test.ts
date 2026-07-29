import {
  hashIdentifier,
  generateToken,
  hashToken,
  encryptVote,
  decryptVote,
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
    expect(hashIdentifier("alice@example.com")).not.toBe(
      hashIdentifier("bob@example.com"),
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
  });
});
