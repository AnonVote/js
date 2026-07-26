import type { EncryptedPayload } from "./types";
import { CryptoError, ValidationError } from "./errors";

/**
 * Minimal shape of the Web Crypto API's `crypto` global that this module
 * relies on. Declared locally instead of pulling in `lib.dom` so the
 * package's TypeScript config doesn't have to assume a browser-like `lib`.
 */
interface MinimalWebCrypto {
  getRandomValues<T extends ArrayBufferView>(array: T): T;
}

/**
 * Returns the Web Crypto API's `crypto` global when it exposes
 * `getRandomValues`. This is present in browsers, Deno, Cloudflare Workers,
 * Vercel Edge Functions, and Node.js 19+ (as `globalThis.crypto`).
 *
 * Returns `undefined` in older Node.js runtimes that don't expose a global
 * `crypto`, in which case callers should fall back to {@link getNodeCrypto}.
 */
function getWebCrypto(): MinimalWebCrypto | undefined {
  const g = globalThis as { crypto?: MinimalWebCrypto };
  if (g.crypto && typeof g.crypto.getRandomValues === "function") {
    return g.crypto;
  }
  return undefined;
}

/**
 * Lazily loads Node's built-in `crypto` module.
 *
 * This must only ever be called from inside a function body, never at
 * module load time. Bundlers targeting edge runtimes (Cloudflare Workers,
 * Vercel Edge) resolve top-level imports eagerly, so a top-level
 * `import "crypto"` — or even a top-level `try { require("crypto") }` —
 * causes them to bundle Node's crypto module into edge output even when
 * it's never called. A `require()` inside a function body is only
 * evaluated if that function actually runs, which keeps edge bundles free
 * of Node's `crypto` module for the paths that don't need it.
 */
function getNodeCrypto(): typeof import("crypto") {
  return require("crypto");
}

/**
 * Cross-runtime cryptographically secure random bytes.
 *
 * Prefers the Web Crypto API (`globalThis.crypto.getRandomValues`), which
 * works in Node.js, browsers, Deno, Cloudflare Workers, and Vercel Edge
 * Functions without any bundler configuration. Falls back to Node's
 * `crypto.randomBytes` only when no global Web Crypto is available.
 */
function getRandomBytes(size: number): Uint8Array {
  const webCrypto = getWebCrypto();
  if (webCrypto) {
    return webCrypto.getRandomValues(new Uint8Array(size));
  }
  return new Uint8Array(getNodeCrypto().randomBytes(size));
}

/** Hex-encodes bytes without relying on Node's `Buffer`, which isn't
 * guaranteed to exist in edge runtimes. */
function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

/**
 * SHA-256 hash of a voter identifier.
 *
 * Used to store eligibility entries without retaining the original identifier.
 * Input is trimmed and lowercased before hashing for consistency.
 *
 * Requires Node.js's `crypto` module (or an edge runtime with a Node.js
 * compatibility layer, e.g. Cloudflare Workers' `nodejs_compat` flag) —
 * see the "Runtime support" section of the README.
 *
 * @warning This is a breaking change for any existing hashed data. Any eligibility
 * data hashed with the unnormalized version will no longer match after this fix.
 * Test fixtures and seeded eligibility data must be regenerated.
 *
 * @example
 * const hash = hashIdentifier("alice@example.com");
 */
export function hashIdentifier(id: string): string {
  return getNodeCrypto()
    .createHash("sha256")
    .update(id.trim().toLowerCase())
    .digest("hex");
}

/**
 * Generate a cryptographically secure random voter token.
 *
 * 32 bytes = 256 bits of entropy, hex encoded.
 * The raw value is given to the voter — never persisted server-side.
 * Use {@link hashToken} to store the server-side reference.
 *
 * Works in Node.js and in edge runtimes (Cloudflare Workers, Vercel Edge
 * Functions) via the Web Crypto API — see the "Runtime support" section
 * of the README.
 *
 * @example
 * const rawToken = generateToken(); // give to voter
 * const storedHash = hashToken(rawToken); // store this
 */
export function generateToken(): string {
  return bytesToHex(getRandomBytes(32));
}

/**
 * SHA-256 hash of a raw voter token.
 *
 * Only the hash is stored in the database — the raw token is never persisted.
 * This enforces structural unlinkability between token issuance and vote submission.
 *
 * Requires Node.js's `crypto` module (or an edge runtime with a Node.js
 * compatibility layer) — see the "Runtime support" section of the README.
 *
 * @example
 * const hash = hashToken(rawToken);
 */
export function hashToken(token: string): string {
  return getNodeCrypto().createHash("sha256").update(token).digest("hex");
}

/**
 * Encrypt a vote option using AES-256-GCM.
 *
 * The encrypted payload stores only the selected option — no voter identity,
 * no token value. Authenticated encryption ensures tampering is detectable.
 *
 * The IV is generated via the cross-runtime {@link getRandomBytes} helper,
 * but the AES-256-GCM cipher itself uses Node's `crypto.createCipheriv`.
 * Node's cipher API is synchronous, while the Web Crypto equivalent
 * (`SubtleCrypto.encrypt`) is Promise-based — swapping to it would change
 * this function's signature from sync to async, a breaking change that's
 * out of scope here. So `encryptVote`/`decryptVote` still require Node.js's
 * `crypto` module (or an edge runtime with a Node.js compatibility layer)
 * — see the "Runtime support" section of the README.
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

  const { createCipheriv } = getNodeCrypto();
  const keyBuffer = Buffer.from(key, "hex");
  const iv = Buffer.from(getRandomBytes(12)); // 96-bit IV for GCM
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
 * Requires Node.js's `crypto` module (or an edge runtime with a Node.js
 * compatibility layer) — see the "Runtime support" section of the README.
 *
 * @param payload - the {@link EncryptedPayload} to decrypt
 * @param key     - 64-char hex string (32 bytes)
 * @returns the original option string
 *
 * @example
 * const option = decryptVote(encryptedPayload, process.env.BALLOT_ENCRYPTION_KEY!);
 */
export function decryptVote(payload: EncryptedPayload, key: string): string {
  const { createDecipheriv } = getNodeCrypto();
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
