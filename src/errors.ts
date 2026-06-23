/**
 * Base class for all SDK errors.
 * Allows callers to catch any SDK error with `instanceof AnonVoteError`.
 */
export class AnonVoteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    // Restore prototype chain (required when targeting ES5/commonjs)
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a caller supplies an argument that fails validation
 * (e.g. missing required field, wrong format).
 */
export class ValidationError extends AnonVoteError {}

/**
 * Thrown when a cryptographic operation fails
 * (e.g. invalid key length, decryption authentication failure).
 */
export class CryptoError extends AnonVoteError {}
