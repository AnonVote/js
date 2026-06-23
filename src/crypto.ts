import {
  createHash,
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from "crypto";
import type { EncryptedPayload } from "./types";
import { CryptoError, ValidationError } from "./errors";

/**
 * SHA-256 hash of a voter identifier.
 *
 * Used to store eligibility entries without retaining the original identifier.
 * Input is trimmed and lowercased before hashing for consistency.
 *
 * @warning This is a breaking change for any existing hashed data. Any eligibility
 * data hashed with the unnormalized version will no longer match after this fix.
 * Test fixtures and seeded eligibility data must be regenerated.
 *
 * @example
 * const hash = hashIdentifier("alice@example.com");
 */
export function hashIdentifier(id: string): string {
  return createHash("sha256").update(id.trim().toLowerCase()).digest("hex");
}

/**
 * Generate a cryptographically secure random voter token.
 *
 * 32 bytes = 256 bits of entropy, hex encoded.
 * The raw value is given to the voter — never persisted server-side.
 * Use {@link hashToken} to store the server-side reference.
 *
 * @example
 * const rawToken = generateToken(); // give to voter
 * const storedHash = hashToken(rawToken); // store this
 */
export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * SHA-256 hash of a raw voter token.
 *
 * Only the hash is stored in the database — the raw token is never persisted.
 * This enforces structural unlinkability between token issuance and vote submission.
 *
 * @example
 * const hash = hashToken(rawToken);
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Encrypt a vote option using AES-256-GCM.
 *
 * The encrypted payload stores only the selected option — no voter identity,
 * no token value. Authenticated encryption ensures tampering is detectable.
 *
 * @param option - The raw vote option string to encrypt
 * @param key    - 64-char hex string (32 bytes), from BALLOT_ENCRYPTION_KEY env var
 * @returns an {@link EncryptedPayload} with ciphertext, iv, and authTag as hex strings
 *
 * @example
 * const encrypted = encryptVote("Yes", process.env.BALLOT_ENCRYPTION_KEY!);
 */
export function encryptVote(option: string, key: string): EncryptedPayload {
  if (key.length !== 64) {
    throw new ValidationError(
      "encryption key must be a 64-character hex string (32 bytes)",
    );
  }

  const keyBuffer = Buffer.from(key, "hex");
  const iv = randomBytes(12); // 96-bit IV for GCM
  const cipher = createCipheriv("aes-256-gcm", keyBuffer, iv);

  const encrypted = Buffer.concat([
    cipher.update(option, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: encrypted.toString("hex"),
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
  };
}

/**
 * Decrypt a vote payload encrypted with {@link encryptVote}.
 *
 * Should only be called by the result tally engine. Any payload tampering
 * is detected and rejected by GCM authentication tag verification.
 *
 * @param payload - the {@link EncryptedPayload} to decrypt
 * @param key     - 64-char hex string (32 bytes)
 * @returns the original option string
 *
 * @example
 * const option = decryptVote(encryptedPayload, process.env.BALLOT_ENCRYPTION_KEY!);
 */
export function decryptVote(payload: EncryptedPayload, key: string): string {
  const keyBuffer = Buffer.from(key, "hex");
  const iv = Buffer.from(payload.iv, "hex");
  const authTag = Buffer.from(payload.authTag, "hex");
  const ciphertext = Buffer.from(payload.ciphertext, "hex");

  const decipher = createDecipheriv("aes-256-gcm", keyBuffer, iv);
  decipher.setAuthTag(authTag);

  try {
    return (
      decipher.update(ciphertext).toString("utf8") +
      decipher.final("utf8")
    );
  } catch {
    throw new CryptoError(
      "Failed to decrypt vote: payload has been tampered with or the key is incorrect",
    );
  }
}
