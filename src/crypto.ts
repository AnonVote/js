import {
  createHash,
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from "crypto";
import { EncryptedPayload, AnonVoteCryptoError } from "./types";

/**
 * SHA-256 hash of a voter identifier.
 *
 * Input is normalised — trimmed and lowercased — before hashing so that
 * "alice@example.com", "Alice@example.com", and " alice@example.com "
 * all produce the same hash. Without this, the one-person-one-vote
 * guarantee breaks silently.
 *
 * An empty string and a whitespace-only string both normalise to "" and
 * therefore produce the same hash. This is intentional.
 *
 * @returns 64-character lowercase hex string (SHA-256 digest)
 *
 * @example
 * const hash = hashIdentifier("alice@example.com");
 */
export function hashIdentifier(identifier: string): string {
  return createHash("sha256")
    .update(identifier.trim().toLowerCase())
    .digest("hex");
}

/**
 * Generate a cryptographically secure random voter token.
 *
 * Uses 32 bytes (256 bits) from Node.js `crypto.randomBytes`.
 * The raw value is given to the voter — never persist it.
 * Use {@link hashToken} to obtain the server-side reference to store.
 *
 * @warning Call this function fresh for every token.
 *          Do not store the return value and reuse it.
 *
 * @returns 64-character lowercase hex string
 *
 * @example
 * const rawToken = generateToken(); // give to voter
 * const storedHash = hashToken(rawToken); // store only this
 */
export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * SHA-256 hash of a raw voter token.
 *
 * Only the hash is persisted server-side — the raw token is given to the
 * voter and never stored. This enforces structural unlinkability between
 * token issuance and vote submission.
 *
 * Token values are produced by {@link generateToken} and are already in
 * canonical form — no normalisation is applied here. This function exists
 * as a distinct export from {@link hashIdentifier} to make the two-step
 * token design explicit and independently testable.
 *
 * @returns 64-character lowercase hex string (SHA-256 digest)
 *
 * @example
 * const hash = hashToken(rawToken);
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Encrypt a vote option ID using AES-256-GCM.
 *
 * A fresh 12-byte IV is generated on every call — passing an IV as a
 * parameter is intentionally not supported. A reused IV with the same
 * key would break AES-GCM security completely and silently.
 *
 * The key must be exactly 64 hex characters (representing 32 bytes).
 * Any other key throws {@link AnonVoteCryptoError} with code `INVALID_KEY`
 * before any cipher operation begins.
 *
 * All three output fields are lowercase hex strings.
 * See DECISIONS.md ADR-001 for the rationale for hex over base64.
 *
 * @param optionId - The ballot option UUID to encrypt
 * @param key      - 64-character hex string representing 32 bytes
 * @returns {@link EncryptedPayload} with hex-encoded ciphertext, iv, and authTag
 *
 * @throws {AnonVoteCryptoError} code `INVALID_KEY` if key is not 64 hex characters
 *
 * @example
 * const payload = encryptVote("option-uuid", process.env.BALLOT_ENCRYPTION_KEY!);
 */
export function encryptVote(optionId: string, key: string): EncryptedPayload {
  if (!/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new AnonVoteCryptoError(
      "INVALID_KEY",
      "key must be a 64-character hex string representing 32 bytes",
    );
  }

  const keyBuffer = Buffer.from(key, "hex");
  const iv = randomBytes(12); // 96-bit IV for GCM
  const cipher = createCipheriv("aes-256-gcm", keyBuffer, iv);

  const ciphertext = Buffer.concat([
    cipher.update(optionId, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString("hex"),
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
  };
}

/**
 * Decrypt a vote payload produced by {@link encryptVote}.
 *
 * Should only be called by the result tally engine.
 *
 * GCM authentication tag verification is mandatory and is never swallowed.
 * If `decipher.final()` throws (tampered ciphertext, wrong key, or wrong IV),
 * the error propagates as an {@link AnonVoteCryptoError} with code
 * `DECRYPTION_FAILED`. There is no silent failure mode — an exception is
 * the only outcome when verification fails.
 *
 * @param payload - {@link EncryptedPayload} produced by {@link encryptVote}
 * @param key     - 64-character hex string representing 32 bytes
 * @returns the original optionId
 *
 * @throws {AnonVoteCryptoError} code `INVALID_PAYLOAD` if any payload field is missing or empty
 * @throws {AnonVoteCryptoError} code `DECRYPTION_FAILED` if auth tag verification fails
 *
 * @example
 * const optionId = decryptVote(payload, process.env.BALLOT_ENCRYPTION_KEY!);
 */
export function decryptVote(payload: EncryptedPayload, key: string): string {
  if (
    !payload.ciphertext ||
    !payload.iv ||
    !payload.authTag
  ) {
    throw new AnonVoteCryptoError(
      "INVALID_PAYLOAD",
      "payload must have non-empty ciphertext, iv, and authTag fields",
    );
  }

  const keyBuffer = Buffer.from(key, "hex");
  const ivBuffer = Buffer.from(payload.iv, "hex");
  const authTagBuffer = Buffer.from(payload.authTag, "hex");
  const ciphertextBuffer = Buffer.from(payload.ciphertext, "hex");

  const decipher = createDecipheriv("aes-256-gcm", keyBuffer, ivBuffer);
  decipher.setAuthTag(authTagBuffer);

  try {
    return (
      decipher.update(ciphertextBuffer).toString("utf8") +
      decipher.final("utf8")
    );
  } catch {
    throw new AnonVoteCryptoError(
      "DECRYPTION_FAILED",
      "decryption failed — ciphertext may have been tampered with",
    );
  }
}
