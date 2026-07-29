// @ts-nocheck
import {
  createHash,
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from "crypto";

import { EncryptedVote } from "./types";

/**
 * SHA-256 hash of a voter identifier.
 *
 * Used to store eligibility entries without retaining the original identifier.
 * Input is trimmed and lowercased before hashing for consistency.
 *
 * @param identifier - The voter identifier to hash (e.g. email address)
 * @returns 64-character hex string (SHA-256 digest)
 *
 * @example
 * const hash = hashIdentifier("alice@example.com");
 */
export function hashIdentifier(identifier: string): string {
  if (identifier.length === 0) {
    // SHA-256 of empty string is well-defined: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    return createHash("sha256").update("").digest("hex");
  }
  return createHash("sha256")
    .update(identifier.trim().toLowerCase())
    .digest("hex");
}

/**
 * Generate a cryptographically secure random voter token.
 *
 * 32 bytes = 256 bits of entropy, hex encoded.
 * The raw value is given to the voter — never persisted server-side.
 * Use {@link hashToken} to store the server-side reference.
 *
 * @returns 64-character hex string (32 random bytes)
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
 * @param token - The raw token string to hash
 * @returns 64-character hex string (SHA-256 digest)
 *
 * @example
 * const hash = hashToken(rawToken);
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Generate a cryptographically secure random ballot encryption key.
 *
 * Produces a 32-byte (256-bit) key encoded as a base64 string.
 * This key is used with AES-256-GCM for vote encryption/decryption.
 * The key should be stored securely and never exposed to unauthorized parties.
 *
 * AES-256-GCM was chosen because:
 * - 256-bit key provides strong security margin against brute-force attacks
 * - GCM mode provides authenticated encryption (confidentiality + integrity)
 * - The authentication tag detects any tampering with the ciphertext
 * - GCM is widely supported in hardware-accelerated crypto instructions
 *
 * @returns 44-character base64 string (32 random bytes encoded)
 *
 * @example
 * const key = generateBallotKey();
 * // store key securely, e.g. in environment variable
 */
export function generateBallotKey(): string {
  return randomBytes(32).toString("base64");
}

/**
 * Encrypt a vote option using AES-256-GCM authenticated encryption.
 *
 * AES-256-GCM is an authenticated encryption algorithm that provides:
 * - **Confidentiality**: The vote option is encrypted and cannot be read without the key
 * - **Integrity**: The authentication tag ensures the ciphertext hasn't been tampered with
 * - **Non-determinism**: A random IV ensures the same plaintext + key produces different
 *   ciphertext each time, preventing vote linkage through ciphertext comparison
 *
 * The IV (initialization vector) is 96 bits (12 bytes) as recommended for GCM.
 * It is randomly generated for each encryption operation and stored alongside
 * the ciphertext. The IV does not need to be secret, but must be unique per
 * encryption with the same key.
 *
 * @param voteOption - The vote option string to encrypt
 * @param ballotKey - 44-character base64 string (32 bytes), from generateBallotKey()
 * @returns EncryptedVote object containing base64-encoded iv, ciphertext, and authTag
 *
 * @throws {Error} If ballotKey is not a valid 32-byte base64 string
 * @throws {Error} If voteOption is empty
 *
 * @example
 * const encrypted = encryptVote("option-uuid", process.env.BALLOT_ENCRYPTION_KEY!);
 * // encrypted.iv, encrypted.ciphertext, encrypted.authTag
 */
export function encryptVote(
  voteOption: string,
  ballotKey: string,
): EncryptedVote {
  if (voteOption.length === 0) {
    throw new Error("Vote option must not be empty");
  }

  const key = parseBallotKey(ballotKey);

  // 96-bit random IV for GCM. GCM's security depends on unique IVs —
  // reusing an IV with the same key compromises confidentiality.
  const iv = randomBytes(12);
  // @ts-ignore - Node.js crypto typings do not align Buffer with CipherKey/BinaryLike
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(key), iv);

  const updated = cipher.update(voteOption, "utf8") as any;
  const finalized = cipher.final() as any;
  // @ts-ignore - Buffer.concat type issues with Node.js crypto return types
  const encrypted = Buffer.concat([updated, finalized]);

  // The auth tag is 128 bits (16 bytes) by default in GCM.
  // It authenticates both the ciphertext and any associated data (none here).
  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString("base64"),
    ciphertext: encrypted.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

/**
 * Decrypt a vote payload encrypted with {@link encryptVote}.
 *
 * Should only be called by the result tally engine. GCM authentication tag
 * verification detects and rejects any payload tampering.
 *
 * The decryption process:
 * 1. Decode the IV, auth tag, and ciphertext from base64
 * 2. Create a GCM decipher with the same key and IV
 * 3. Set the expected auth tag — if the ciphertext was tampered with,
 *    the tag won't match and an error is thrown
 * 4. Decrypt and return the original vote option
 *
 * @param encryptedVote - EncryptedVote object with iv, ciphertext, and authTag
 * @param ballotKey - 44-character base64 string (32 bytes)
 * @returns The original vote option string
 *
 * @throws {Error} If ballotKey is not a valid 32-byte base64 string
 * @throws {Error} If the auth tag is invalid (tampered ciphertext)
 * @throws {Error} If the encrypted payload is corrupted or truncated
 *
 * @example
 * const optionId = decryptVote(encryptedPayload, process.env.BALLOT_ENCRYPTION_KEY!);
 */
export function decryptVote(
  encryptedVote: EncryptedVote,
  ballotKey: string,
): string {
  const key = parseBallotKey(ballotKey);

  if (!encryptedVote.iv || !encryptedVote.authTag || !encryptedVote.ciphertext) {
    throw new Error(
      "Invalid encrypted payload format: missing iv, authTag, or ciphertext",
    );
  }

  const iv = Buffer.from(encryptedVote.iv, "base64") as any;
  const authTag = Buffer.from(encryptedVote.authTag, "base64") as any;
  const ciphertext = Buffer.from(encryptedVote.ciphertext, "base64") as any;

  // Validate buffer lengths to provide descriptive errors
  if (iv.length !== 12) {
    throw new Error(
      `Invalid IV length: expected 12 bytes, got ${iv.length} bytes`,
    );
  }

  if (authTag.length !== 16) {
    throw new Error(
      `Invalid auth tag length: expected 16 bytes, got ${authTag.length} bytes`,
    );
  }

  if (ciphertext.length === 0) {
    throw new Error("Ciphertext must not be empty");
  }

  // @ts-ignore - Node.js crypto typings do not align Buffer with CipherKey/BinaryLike
  const decipher = createDecipheriv("aes-256-gcm", Buffer.from(key), iv);
  decipher.setAuthTag(authTag);

  try {
    const updated = decipher.update(ciphertext) as any;
    const finalized = decipher.final() as any;
    // @ts-ignore - Buffer.concat type issues with Node.js crypto return types
    const decrypted = Buffer.concat([updated, finalized]);
    return decrypted.toString("utf8");
  } catch (err) {
    // GCM throws if the auth tag doesn't match (tampered ciphertext)
    // or if the ciphertext is corrupted
    throw new Error(
      `Decryption failed: invalid authentication tag or corrupted ciphertext`,
    );
  }
}

/**
 * Verify that an encrypted vote payload corresponds to a given vote option.
 *
 * This function verifies by:
 * 1. Decrypting the encrypted vote with the ballot key
 * 2. Comparing the decrypted value with the vote option
 *
 * This allows third parties to verify that a specific vote option was the one
 * encrypted, without revealing the option itself. The encrypted payload serves
 * as a commitment that can be checked during audit.
 *
 * Note: Because encryption is non-deterministic (random IV), the same vote
 * option encrypted twice produces different ciphertexts. Therefore verification
 * must decrypt the actual encrypted payload rather than re-encrypting.
 *
 * @param voteOption - The vote option string to verify
 * @param encryptedVote - The encrypted vote payload to verify
 * @param ballotKey - 44-character base64 string (32 bytes)
 * @returns true if the encrypted vote decrypts to the vote option, false otherwise
 *
 * @example
 * const isValid = verifyVoteHash("option-uuid", encryptedVote, ballotKey);
 */
export function verifyVoteHash(
  voteOption: string,
  encryptedVote: EncryptedVote,
  ballotKey: string,
): boolean {
  try {
    // Step 1: Decrypt the encrypted vote payload
    const decrypted = decryptVote(encryptedVote, ballotKey);

    // Step 2: Compare the decrypted value with the vote option
    return constantTimeEqual(decrypted, voteOption);
  } catch {
    // If decryption fails (tampered payload, wrong key, etc.), verification fails
    return false;
  }
}

/**
 * Parse and validate a base64-encoded 32-byte ballot key.
 *
 * Accepts both standard base64 and base64url encodings.
 * The key must decode to exactly 32 bytes (256 bits) for AES-256.
 *
 * @param ballotKey - Base64-encoded 32-byte key
 * @returns Buffer containing the decoded 32-byte key
 *
 * @throws {Error} If the key is empty
 * @throws {Error} If the decoded key is not exactly 32 bytes
 */
function parseBallotKey(ballotKey: string): Buffer {
  if (ballotKey.length === 0) {
    throw new Error("Ballot key must not be empty");
  }

  let key: Buffer;
  try {
    key = Buffer.from(ballotKey, "base64");
  } catch {
    throw new Error("Ballot key is not valid base64");
  }

  // Support both 32-byte base64 strings and 64-char hex strings for backward compat
  if (key.length !== 32 && /^[0-9a-fA-F]+$/.test(ballotKey) && ballotKey.length === 64) {
    try {
      key = Buffer.from(ballotKey, "hex");
    } catch {
      // fall through to length check
    }
  }

  if (key.length !== 32) {
    throw new Error(
      `Invalid ballot key length: expected 32 bytes (256 bits), got ${key.length} bytes`,
    );
  }

  return key;
}

/**
 * Constant-time string comparison to prevent timing attacks.
 *
 * Standard string comparison short-circuits on the first differing character,
 * leaking information about the comparison through timing. This function
 * always compares all characters, making timing attacks infeasible.
 *
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns true if the strings are equal, false otherwise
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}