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
 * Input is trimmed and lowercased before hashing for consistency — always
 * normalize before hashing to avoid duplicate entries for the same voter.
 *
 * @param id - The voter identifier to hash (e.g. an email address). Trimmed
 *             and lowercased before hashing.
 * @returns A 64-character lowercase hex string (SHA-256 digest).
 *
 * @example
 * const hash = hashIdentifier("alice@example.com");
 * // hash === "3d0a9f2e..." (deterministic for the same input)
 */
export function hashIdentifier(id: string): string {
  return createHash("sha256").update(id.trim().toLowerCase()).digest("hex");
}

/**
 * Generate a cryptographically secure random voter token.
 *
 * Produces 32 bytes (256 bits) of entropy via Node.js `crypto.randomBytes`,
 * encoded as a 64-character hex string. The raw value is given to the voter —
 * never persisted server-side. Use {@link hashToken} to store the server-side
 * reference.
 *
 * @returns A 64-character hex string representing a 256-bit random token.
 *
 * @example
 * const rawToken = generateToken(); // give this to the voter
 * const storedHash = hashToken(rawToken); // store only this
 */
export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * SHA-256 hash of a raw voter token.
 *
 * Only the hash is stored in the database — the raw token is never persisted.
 * This enforces structural unlinkability between token issuance and vote
 * submission. The raw token should be discarded after hashing.
 *
 * @param token - The raw hex token string produced by {@link generateToken}.
 * @returns A 64-character lowercase hex string (SHA-256 digest of the token).
 *
 * @example
 * const rawToken = generateToken();
 * const storedHash = hashToken(rawToken);
 * // Store storedHash in the database; discard rawToken after giving it to the voter.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Encrypt a vote option using AES-256-GCM.
 *
 * The encrypted payload stores only the selected option — no voter identity,
 * no token value. Authenticated encryption (GCM mode) ensures any tampering
 * is detectable at decryption time.
 *
 * @param option - The raw vote option string to encrypt (e.g. `"Yes"` or an
 *                 option UUID).
 * @param key    - A 64-character hex string (32 bytes) used as the AES-256
 *                 encryption key. Typically sourced from the
 *                 `BALLOT_ENCRYPTION_KEY` environment variable.
 * @returns An {@link EncryptedPayload} containing `ciphertext`, `iv`, and
 *          `authTag` as hex strings.
 * @throws {@link ValidationError} if `key` is not exactly 64 characters long.
 *
 * @example
 * const encrypted = encryptVote("Yes", process.env.BALLOT_ENCRYPTION_KEY!);
 * // encrypted === { ciphertext: "...", iv: "...", authTag: "..." }
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
 * Should only be called by the result tally engine. GCM authentication tag
 * verification detects and rejects any payload that has been tampered with.
 *
 * @param payload - The {@link EncryptedPayload} to decrypt, as returned by
 *                  {@link encryptVote}.
 * @param key     - A 64-character hex string (32 bytes) — must be the same
 *                  key that was used to encrypt the payload.
 * @returns The original option string that was encrypted.
 * @throws {@link CryptoError} if decryption fails because the payload has been
 *         tampered with or the key does not match the one used for encryption.
 *
 * @example
 * const option = decryptVote(encryptedPayload, process.env.BALLOT_ENCRYPTION_KEY!);
 * // option === "Yes"
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
