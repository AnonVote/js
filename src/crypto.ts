import {
  createHash,
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from "crypto";

/**
 * SHA-256 hash of a voter identifier.
 *
 * Used to store eligibility entries without retaining the original identifier.
 * Input is trimmed and lowercased before hashing for consistency.
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
 * Encrypt a vote option ID using AES-256-GCM.
 *
 * The encrypted payload stores only the selected option — no voter identity,
 * no token value. Authenticated encryption ensures tampering is detectable.
 *
 * @param optionId   - The ballot option UUID to encrypt
 * @param ballotKey  - 64-char hex string (32 bytes), from BALLOT_ENCRYPTION_KEY env var
 * @returns base64 string in format: `iv:authTag:ciphertext`
 *
 * @example
 * const encrypted = encryptVote("option-uuid", process.env.BALLOT_ENCRYPTION_KEY!);
 */
export function encryptVote(optionId: string, ballotKey: string): string {
  if (ballotKey.length !== 64) {
    throw new Error(
      "BALLOT_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)",
    );
  }

  const key = Buffer.from(ballotKey, "hex");
  const iv = randomBytes(12); // 96-bit IV for GCM
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([
    cipher.update(optionId, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

/**
 * Decrypt a vote payload encrypted with {@link encryptVote}.
 *
 * Should only be called by the result tally engine. Any payload tampering
 * is detected and rejected by GCM authentication tag verification.
 *
 * @param payload    - base64 string in format: `iv:authTag:ciphertext`
 * @param ballotKey  - 64-char hex string (32 bytes)
 * @returns the original optionId
 *
 * @example
 * const optionId = decryptVote(encryptedPayload, process.env.BALLOT_ENCRYPTION_KEY!);
 */
export function decryptVote(payload: string, ballotKey: string): string {
  const parts = payload.split(":");
  if (parts.length !== 3) {
    throw new Error(
      "Invalid encrypted payload format. Expected iv:authTag:ciphertext",
    );
  }

  const [ivB64, authTagB64, ciphertextB64] = parts;
  const key = Buffer.from(ballotKey, "hex");
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  return decipher.update(ciphertext).toString("utf8") + decipher.final("utf8");
}
