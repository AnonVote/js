"use strict";
var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};

// dist/errors.js
var require_errors = __commonJS({
  "dist/errors.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.CryptoError = exports2.ValidationError = exports2.AnonVoteError = void 0;
    var AnonVoteError = class extends Error {
      constructor(message) {
        super(message);
        this.name = this.constructor.name;
        Object.setPrototypeOf(this, new.target.prototype);
      }
    };
    exports2.AnonVoteError = AnonVoteError;
    var ValidationError = class extends AnonVoteError {
    };
    exports2.ValidationError = ValidationError;
    var CryptoError = class extends AnonVoteError {
    };
    exports2.CryptoError = CryptoError;
  }
});

// dist/crypto.js
var require_crypto = __commonJS({
  "dist/crypto.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.decryptVote = exports2.encryptVote = exports2.hashToken = exports2.generateToken = exports2.hashIdentifier = void 0;
    var crypto_1 = require("crypto");
    var errors_1 = require_errors();
    function hashIdentifier2(id2) {
      return (0, crypto_1.createHash)("sha256").update(id2.trim().toLowerCase()).digest("hex");
    }
    exports2.hashIdentifier = hashIdentifier2;
    function generateToken2() {
      return (0, crypto_1.randomBytes)(32).toString("hex");
    }
    exports2.generateToken = generateToken2;
    function hashToken2(token2) {
      return (0, crypto_1.createHash)("sha256").update(token2).digest("hex");
    }
    exports2.hashToken = hashToken2;
    function encryptVote2(option, key2) {
      if (key2.length !== 64) {
        throw new errors_1.ValidationError("encryption key must be a 64-character hex string (32 bytes)");
      }
      const keyBuffer = Buffer.from(key2, "hex");
      const iv = (0, crypto_1.randomBytes)(12);
      const cipher = (0, crypto_1.createCipheriv)("aes-256-gcm", keyBuffer, iv);
      const encrypted2 = Buffer.concat([
        cipher.update(option, "utf8"),
        cipher.final()
      ]);
      const authTag = cipher.getAuthTag();
      return {
        ciphertext: encrypted2.toString("hex"),
        iv: iv.toString("hex"),
        authTag: authTag.toString("hex")
      };
    }
    exports2.encryptVote = encryptVote2;
    function decryptVote2(payload, key2) {
      const keyBuffer = Buffer.from(key2, "hex");
      const iv = Buffer.from(payload.iv, "hex");
      const authTag = Buffer.from(payload.authTag, "hex");
      const ciphertext = Buffer.from(payload.ciphertext, "hex");
      const decipher = (0, crypto_1.createDecipheriv)("aes-256-gcm", keyBuffer, iv);
      decipher.setAuthTag(authTag);
      try {
        return decipher.update(ciphertext).toString("utf8") + decipher.final("utf8");
      } catch {
        throw new errors_1.CryptoError("Failed to decrypt vote: payload has been tampered with or the key is incorrect");
      }
    }
    exports2.decryptVote = decryptVote2;
  }
});

// dist/client.js
var require_client = __commonJS({
  "dist/client.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.AnonVoteClient = void 0;
    var crypto_1 = require("crypto");
    var crypto_2 = require_crypto();
    var errors_1 = require_errors();
    var AnonVoteClient = class {
      /**
       * Creates a new AnonVoteClient instance.
       *
       * @param config - The client configuration options. If not provided,
       *                 an empty config is used and encryptionKey must be
       *                 provided explicitly in method calls.
       */
      constructor(config = {}) {
        this.config = config;
      }
      /**
       * Creates a new election object.
       *
       * @param params - The election creation parameters.
       * @returns A strongly typed Election object.
       * @throws Error if the election data is invalid.
       */
      createElection(params) {
        if (!params.title || typeof params.title === "string" && params.title.trim().length === 0) {
          throw new errors_1.ValidationError("Election title is required");
        }
        if (!params.description || typeof params.description === "string" && params.description.trim().length === 0) {
          throw new errors_1.ValidationError("Election description is required");
        }
        if (!params.options || !Array.isArray(params.options) || params.options.length === 0) {
          throw new errors_1.ValidationError("At least one voting option is required");
        }
        for (const opt of params.options) {
          if (!opt || typeof opt === "string" && opt.trim().length === 0) {
            throw new errors_1.ValidationError("Voting options cannot be empty strings");
          }
        }
        const startTimeMs = this.parseTimestamp(params.startTime);
        if (isNaN(startTimeMs)) {
          throw new errors_1.ValidationError("Invalid startTime: must be a valid date or timestamp");
        }
        const endTimeMs = this.parseTimestamp(params.endTime);
        if (isNaN(endTimeMs)) {
          throw new errors_1.ValidationError("Invalid endTime: must be a valid date or timestamp");
        }
        if (endTimeMs <= startTimeMs) {
          throw new errors_1.ValidationError("endTime must be after startTime");
        }
        const now = /* @__PURE__ */ new Date();
        const createdAt = now.toISOString();
        const id2 = this.generateId("elec");
        const electionOptions = params.options.map((text, index) => ({
          id: this.generateId(`option-${index}`),
          text: text.trim()
        }));
        return {
          id: id2,
          title: typeof params.title === "string" ? params.title.trim() : String(params.title),
          description: typeof params.description === "string" ? params.description.trim() : String(params.description),
          options: electionOptions,
          startTime: new Date(startTimeMs).toISOString(),
          endTime: new Date(endTimeMs).toISOString(),
          createdAt
        };
      }
      /**
       * Casts a vote for a specific option.
       *
       * This method validates the vote, encrypts it using @anonvote/crypto,
       * and returns the encrypted payload ready for submission.
       *
       * @param params - The vote casting parameters.
       * @returns A VoteReceipt confirming the vote was cast.
       * @throws Error if required parameters are missing.
       */
      castVote(params) {
        if (!params.ballotId || typeof params.ballotId === "string" && params.ballotId.trim().length === 0) {
          throw new errors_1.ValidationError("ballotId is required");
        }
        if (!params.voteOption || typeof params.voteOption === "string" && params.voteOption.trim().length === 0) {
          throw new errors_1.ValidationError("voteOption is required");
        }
        const encryptionKey = params.encryptionKey || this.config.encryptionKey;
        if (!encryptionKey) {
          throw new errors_1.ValidationError("encryptionKey is required either in params or client config");
        }
        const encryptedPayload = (0, crypto_2.encryptVote)(params.voteOption.trim(), encryptionKey);
        const id2 = this.generateId("receipt");
        const castAt = (/* @__PURE__ */ new Date()).toISOString();
        return {
          id: id2,
          electionId: params.ballotId,
          ballotId: params.ballotId,
          encryptedPayload,
          castAt,
          verified: false
        };
      }
      /**
       * Verifies an encrypted vote payload.
       *
       * This method attempts to decrypt and validate the payload,
       * returning a boolean indicating whether the payload is valid.
       *
       * @param encryptedPayload - The encrypted vote payload to verify.
       * @param encryptionKey - The encryption key to use for verification.
       *                        If not provided, uses the client config key.
       * @returns true if the payload can be successfully decrypted and validated.
       */
      verifyVote(encryptedPayload, encryptionKey) {
        if (!encryptedPayload || !encryptedPayload.ciphertext || !encryptedPayload.iv || !encryptedPayload.authTag) {
          return false;
        }
        const key2 = encryptionKey || this.config.encryptionKey;
        if (!key2) {
          return false;
        }
        try {
          const decrypted2 = (0, crypto_2.decryptVote)(encryptedPayload, key2);
          return typeof decrypted2 === "string" && decrypted2.length > 0;
        } catch {
          return false;
        }
      }
      /**
       * Serializes an Election object to a JSON-safe payload.
       *
       * @param election - The Election object to serialize.
       * @returns A serialized payload suitable for APIs or blockchain transactions.
       * @throws Error if the election is invalid.
       */
      serialize(election) {
        if (!election || typeof election !== "object") {
          throw new errors_1.ValidationError("Invalid election object");
        }
        return {
          id: election.id,
          title: election.title,
          description: election.description,
          options: election.options,
          startTime: election.startTime,
          endTime: election.endTime,
          createdAt: election.createdAt
        };
      }
      /**
       * Deserializes an Election object from a JSON payload.
       *
       * @param payload - The serialized election payload.
       * @returns A strongly typed Election object.
       * @throws Error if the payload is invalid.
       */
      deserialize(payload) {
        if (!payload || typeof payload !== "object") {
          throw new errors_1.ValidationError("Invalid election object");
        }
        if (!payload.id || typeof payload.id !== "string") {
          throw new errors_1.ValidationError("Invalid payload: missing or invalid id");
        }
        if (!payload.title || typeof payload.title !== "string") {
          throw new errors_1.ValidationError("Invalid payload: missing or invalid title");
        }
        if (!payload.description || typeof payload.description !== "string") {
          throw new errors_1.ValidationError("Invalid payload: missing or invalid description");
        }
        if (!Array.isArray(payload.options)) {
          throw new errors_1.ValidationError("Invalid payload: missing or invalid options");
        }
        for (const opt of payload.options) {
          if (!opt.id || typeof opt.id !== "string") {
            throw new errors_1.ValidationError("Invalid payload: option missing id");
          }
          if (!opt.text || typeof opt.text !== "string") {
            throw new errors_1.ValidationError("Invalid payload: option missing text");
          }
        }
        if (!payload.startTime || typeof payload.startTime !== "string") {
          throw new errors_1.ValidationError("Invalid payload: missing or invalid startTime");
        }
        if (!payload.endTime || typeof payload.endTime !== "string") {
          throw new errors_1.ValidationError("Invalid payload: missing or invalid endTime");
        }
        if (!payload.createdAt || typeof payload.createdAt !== "string") {
          throw new errors_1.ValidationError("Invalid payload: missing or invalid createdAt");
        }
        return {
          id: payload.id,
          title: payload.title,
          description: payload.description,
          options: payload.options,
          startTime: payload.startTime,
          endTime: payload.endTime,
          createdAt: payload.createdAt
        };
      }
      /**
       * Parses a timestamp value (string or number) into milliseconds.
       *
       * @param value - The timestamp value to parse.
       * @returns The timestamp in milliseconds, or NaN if invalid.
       */
      parseTimestamp(value) {
        if (typeof value === "number") {
          return value;
        }
        if (typeof value === "string") {
          const parsed = Date.parse(value);
          if (!isNaN(parsed)) {
            return parsed;
          }
          const numValue = Number(value);
          if (!isNaN(numValue)) {
            return numValue;
          }
        }
        return NaN;
      }
      /**
       * Generates a unique identifier with an optional prefix.
       *
       * @param prefix - Optional prefix for the ID.
       * @returns A unique ID string.
       */
      generateId(prefix) {
        const bytes = (0, crypto_1.randomBytes)(16);
        const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
        const uuid = [
          hex.slice(0, 8),
          hex.slice(8, 12),
          hex.slice(12, 16),
          hex.slice(16, 20),
          hex.slice(20, 32)
        ].join("-");
        return `${prefix}-${uuid}`;
      }
    };
    exports2.AnonVoteClient = AnonVoteClient;
  }
});

// dist/index.js
var require_dist = __commonJS({
  "dist/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.CryptoError = exports2.ValidationError = exports2.AnonVoteError = exports2.AnonVoteClient = exports2.decryptVote = exports2.encryptVote = exports2.hashToken = exports2.generateToken = exports2.hashIdentifier = void 0;
    var crypto_1 = require_crypto();
    Object.defineProperty(exports2, "hashIdentifier", { enumerable: true, get: function() {
      return crypto_1.hashIdentifier;
    } });
    Object.defineProperty(exports2, "generateToken", { enumerable: true, get: function() {
      return crypto_1.generateToken;
    } });
    Object.defineProperty(exports2, "hashToken", { enumerable: true, get: function() {
      return crypto_1.hashToken;
    } });
    Object.defineProperty(exports2, "encryptVote", { enumerable: true, get: function() {
      return crypto_1.encryptVote;
    } });
    Object.defineProperty(exports2, "decryptVote", { enumerable: true, get: function() {
      return crypto_1.decryptVote;
    } });
    var client_1 = require_client();
    Object.defineProperty(exports2, "AnonVoteClient", { enumerable: true, get: function() {
      return client_1.AnonVoteClient;
    } });
    var errors_1 = require_errors();
    Object.defineProperty(exports2, "AnonVoteError", { enumerable: true, get: function() {
      return errors_1.AnonVoteError;
    } });
    Object.defineProperty(exports2, "ValidationError", { enumerable: true, get: function() {
      return errors_1.ValidationError;
    } });
    Object.defineProperty(exports2, "CryptoError", { enumerable: true, get: function() {
      return errors_1.CryptoError;
    } });
  }
});

// tests/bundler-compat/esbuild/app.js
var {
  hashIdentifier,
  generateToken,
  hashToken,
  encryptVote,
  decryptVote
} = require_dist();
var id = "Voter@Example.com";
var idHash = hashIdentifier(id);
console.log("hashIdentifier:", idHash);
var token = generateToken();
console.log("generateToken length:", token.length);
var tokenHash = hashToken(token);
console.log("hashToken:", tokenHash);
var key = "a".repeat(64);
var encrypted = encryptVote("Yes", key);
console.log("encryptVote:", encrypted);
var decrypted = decryptVote(encrypted, key);
console.log("decryptVote:", decrypted);
if (decrypted !== "Yes") {
  console.error("MISMATCH: decrypted value does not match original vote");
  process.exit(1);
}
if (idHash.length !== 64 || tokenHash.length !== 64) {
  console.error("MISMATCH: hash length is not 64 hex chars (sha256)");
  process.exit(1);
}
console.log("ESBUILD BUNDLE TEST: ALL CHECKS PASSED");
