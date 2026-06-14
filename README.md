# @anonvote/crypto

**The cryptographic primitives and token utilities powering AnonVote.**

This package is the canonical source of all crypto and token logic used across the AnonVote ecosystem. It is framework-agnostic, has zero runtime dependencies, and runs in Node.js and edge runtimes.

[![npm](https://img.shields.io/npm/v/@anonvote/crypto)](https://www.npmjs.com/package/@anonvote/crypto)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)

---

## Role in the ecosystem

| Repo                                                        | Depends on this package                  |
| ----------------------------------------------------------- | ---------------------------------------- |
| [AnonVote/core](https://github.com/AnonVote/core)           | Yes — backend imports `@anonvote/crypto` |
| [AnonVote/contracts](https://github.com/AnonVote/contracts) | No — Soroban contracts use native Rust   |
| [AnonVote/protocol](https://github.com/AnonVote/protocol)   | References this package in spec docs     |

---

## What's in this package

### Cryptographic utilities (`src/crypto.ts`)

| Export                       | Description                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `hashIdentifier(id)`         | SHA-256 hash of a voter identifier. Trims and lowercases before hashing. Never store originals — only hashes.      |
| `generateToken()`            | Generates a 32-byte (256-bit) CSPRNG token as a hex string. Used for one-time voter tokens.                        |
| `hashToken(token)`           | SHA-256 hash of a raw token. Only the hash is ever persisted — the raw value is given to the voter and discarded.  |
| `encryptVote(optionId, key)` | AES-256-GCM encryption of a vote option ID. Returns `iv:authTag:ciphertext` in base64. Requires a 32-byte hex key. |
| `decryptVote(payload, key)`  | Decrypts a vote payload produced by `encryptVote`. Used only by the result tally engine.                           |

### Types (`src/types.ts`)

Core shared TypeScript types for votes, tokens, ballots, and audit events — used by both the backend API and any future client SDKs.

---

## Installation

```bash
npm install @anonvote/crypto
```

---

## Usage

```typescript
import {
  hashIdentifier,
  generateToken,
  hashToken,
  encryptVote,
  decryptVote,
} from "@anonvote/crypto";

// Hash a voter identifier before storing
const identifierHash = hashIdentifier("alice@example.com");

// Issue a one-time anonymous token
const rawToken = generateToken(); // give this to the voter
const storedHash = hashToken(rawToken); // store only this

// Encrypt a vote option
const BALLOT_KEY = process.env.BALLOT_ENCRYPTION_KEY!; // 64-char hex
const encrypted = encryptVote("option-uuid-here", BALLOT_KEY);

// Decrypt during result tally
const optionId = decryptVote(encrypted, BALLOT_KEY);
```

---

## Privacy guarantees

These primitives enforce AnonVote's structural unlinkability model:

- `hashIdentifier` and `hashToken` are **one-way** — original values are unrecoverable from the database
- `generateToken` uses Node.js `crypto.randomBytes` — cryptographically secure and unpredictable
- `encryptVote` uses **AES-256-GCM** — authenticated encryption; tampered ciphertexts are rejected at decryption
- No identifier is ever stored alongside a token — the hash functions operate independently on different data

---

## Security notes

- `BALLOT_ENCRYPTION_KEY` must be a 64-character hex string (32 bytes). Generate one with: `openssl rand -hex 32`
- Never log raw voter identifiers or raw tokens
- The result tally is the only place `decryptVote` should be called

---

## Development

```bash
git clone https://github.com/AnonVote/js.git
cd js
npm install
npm test
npm run build
```

### Scripts

| Command         | Description                   |
| --------------- | ----------------------------- |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm test`      | Run unit tests with Jest      |
| `npm run lint`  | ESLint check                  |

---

## Repository structure

```
js/
├── src/
│   ├── crypto.ts     # Core cryptographic functions
│   ├── types.ts      # Shared TypeScript types
│   └── index.ts      # Public API re-exports
├── tests/
│   └── crypto.test.ts
├── package.json
└── tsconfig.json
```

---

## License

[MIT](LICENSE)
