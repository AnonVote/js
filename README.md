# @anonvote/crypto

**The cryptographic primitives and token utilities powering AnonVote.**

This package is the canonical source of all crypto and token logic used across the AnonVote ecosystem. It is framework-agnostic, has zero runtime dependencies, and runs in Node.js and edge runtimes.

[![npm](https://img.shields.io/npm/v/@anonvote/crypto)](https://www.npmjs.com/package/@anonvote/crypto)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)

---

## Installation

```bash
npm install @anonvote/crypto
```

---

## Usage: Cryptographic primitives

```typescript
import {
  hashIdentifier,
  generateToken,
  hashToken,
  encryptVote,
  decryptVote,
} from "@anonvote/crypto";

// Hash a voter identifier before storing — never store the original
const identifierHash = hashIdentifier("alice@example.com");

// Issue a one-time anonymous token
const rawToken = generateToken();    // give this to the voter
const storedHash = hashToken(rawToken); // store only this; discard rawToken

// Encrypt a vote option (requires a 64-char hex key)
const BALLOT_KEY = process.env.BALLOT_ENCRYPTION_KEY!;
const encrypted = encryptVote("option-uuid-here", BALLOT_KEY);
// encrypted === { ciphertext: "...", iv: "...", authTag: "..." }

// Decrypt during result tally (tally engine only)
const optionId = decryptVote(encrypted, BALLOT_KEY);
```

---

## Usage: AnonVoteClient

```typescript
import { AnonVoteClient } from "@anonvote/crypto";

const client = new AnonVoteClient({
  encryptionKey: process.env.BALLOT_ENCRYPTION_KEY!,
});

// Create an election
const election = client.createElection({
  title: "Board Election 2024",
  description: "Elect the new board members",
  options: ["Alice", "Bob", "Charlie"],
  startTime: Date.now(),
  endTime: Date.now() + 7 * 24 * 60 * 60 * 1000,
});

// Cast a vote using the election returned above
const receipt = client.castVote({
  ballotId: election.id,
  voteOption: election.options[0].text,
});

// Verify the receipt returned by castVote
const isValid = client.verifyVote(receipt.encryptedPayload);
console.log(isValid); // true
```

---

## Environment variables

| Variable               | Format              | Description                                                     |
| ---------------------- | ------------------- | --------------------------------------------------------------- |
| `BALLOT_ENCRYPTION_KEY` | 64-character hex string (32 bytes) | AES-256-GCM key used to encrypt and decrypt vote payloads. **Required** for `encryptVote`, `decryptVote`, and `AnonVoteClient` vote operations. |

Generate a key with:

```bash
openssl rand -hex 32
```

Never log or commit this value. Store it as a secret in your deployment environment.

---

## API Reference

### Cryptographic functions

| Export | Description |
| ------ | ----------- |
| `hashIdentifier(id)` | Returns the SHA-256 hash of a voter identifier. Trims and lowercases before hashing. |
| `generateToken()` | Generates a 32-byte (256-bit) CSPRNG token as a hex string. Used for one-time voter tokens. |
| `hashToken(token)` | Returns the SHA-256 hash of a raw token. Only the hash is ever persisted. |
| `encryptVote(option, key)` | AES-256-GCM encryption of a vote option. Returns an `EncryptedPayload`. Requires a 64-char hex key. |
| `decryptVote(payload, key)` | Decrypts a payload produced by `encryptVote`. Used only by the result tally engine. |

### AnonVoteClient

| Export | Description |
| ------ | ----------- |
| `AnonVoteClient` | The primary SDK class. Wraps crypto primitives and provides a high-level API for elections and votes. |
| `AnonVoteClient.createElection(params)` | Validates inputs and returns a new `Election` object with generated IDs. |
| `AnonVoteClient.castVote(params)` | Encrypts a vote option and returns a `VoteReceipt`. |
| `AnonVoteClient.verifyVote(payload, key?)` | Attempts to decrypt a payload; returns `true` if valid. |
| `AnonVoteClient.serialize(election)` | Converts an `Election` to a JSON-safe `SerializedElection`. |
| `AnonVoteClient.deserialize(payload)` | Reconstructs an `Election` from a `SerializedElection` payload. |

### Error classes

| Export | Description |
| ------ | ----------- |
| `AnonVoteError` | Base class for all SDK errors. Catch with `instanceof AnonVoteError`. |
| `ValidationError` | Thrown when an input fails validation (missing field, wrong format, logical constraint). Extends `AnonVoteError`. |
| `CryptoError` | Thrown when a cryptographic operation fails at runtime (e.g. tampered ciphertext, wrong key). Extends `AnonVoteError`. |

### Types

| Export | Description |
| ------ | ----------- |
| `BallotStatus` | `"OPEN" \| "CLOSED"` — the status of a ballot. |
| `Option` | A ballot option with `id`, `ballotId`, and `text`. |
| `Ballot` | A full ballot record including options, eligibility, and status. |
| `EligibilityList` | A list of eligible voters, identified by its `id`. |
| `EligibilityEntry` | A single entry in an eligibility list; stores `identifierHash`, not the raw identifier. |
| `Token` | A raw token value paired with its SHA-256 hash. |
| `VoterToken` | A persisted one-time voter token record (stores only `tokenHash`). |
| `Vote` | A raw vote before encryption: `ballotId`, `option`, `timestamp`. |
| `EncryptedPayload` | AES-256-GCM ciphertext with `ciphertext`, `iv`, and `authTag` as hex strings. |
| `Organization` | An organization record with `id`, `name`, `email`, and `createdAt`. |
| `Result` | A published tally result including `tallyJson` and optional `stellarTxId`. |
| `AuditEventType` | Union of audit event type strings (e.g. `"VOTE_CAST"`, `"TOKEN_ISSUED"`). |
| `AuditEvent` | A single audit event record with `eventType` and optional `stellarTxId`. |
| `AuditCounts` | Aggregate audit counts and event list for a ballot. |
| `ApiResponse<T>` | Generic wrapper `{ data: T }` for API responses. |
| `TokenResponse` | Response shape for token issuance: `token` and `weight`. |
| `LoginResponse` | Response shape for login: `organizationId` and `name`. |
| `ClientConfig` | Configuration for `AnonVoteClient`: optional `encryptionKey`. |
| `ElectionOption` | An option within an `Election`: `id` and `text`. |
| `CreateElectionParams` | Input parameters for `AnonVoteClient.createElection`. |
| `CastVoteParams` | Input parameters for `AnonVoteClient.castVote`. |
| `Election` | A fully formed election object returned by `AnonVoteClient.createElection`. |
| `VoteReceipt` | A receipt returned by `AnonVoteClient.castVote`, containing the encrypted payload. |

---

## Privacy guarantees

These primitives enforce AnonVote's structural unlinkability model:

- `hashIdentifier` and `hashToken` are **one-way** — original values are unrecoverable from the database
- `generateToken` uses Node.js `crypto.randomBytes` — cryptographically secure and unpredictable
- `encryptVote` uses **AES-256-GCM** — authenticated encryption; tampered ciphertexts are rejected at decryption
- No identifier is ever stored alongside a token — the hash functions operate independently on different data

---

## Security notes

- `BALLOT_ENCRYPTION_KEY` must be a 64-character hex string (32 bytes). Generate one with `openssl rand -hex 32`.
- Never log raw voter identifiers or raw tokens.
- `decryptVote` should only be called by the result tally engine.

---

## Role in the ecosystem

| Repo | Depends on this package |
| ---- | ----------------------- |
| [AnonVote/core](https://github.com/AnonVote/core) | Yes — backend imports `@anonvote/crypto` |
| [AnonVote/contracts](https://github.com/AnonVote/contracts) | No — Soroban contracts use native Rust |
| [AnonVote/docs](https://github.com/AnonVote/docs) | References this package in spec docs |

---

## Development

```bash
git clone https://github.com/anon/core.git
cd js
npm install
npm test
npm run build
```

### Scripts

| Command | Description |
| ------- | ----------- |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm test` | Run unit tests with Jest |
| `npm run lint` | ESLint check |

---

## Repository structure

```
js/
├── src/
│   ├── crypto.ts     # Core cryptographic functions
│   ├── client.ts     # AnonVoteClient SDK
│   ├── errors.ts     # Error classes
│   ├── types.ts      # Shared TypeScript types
│   └── index.ts      # Public API re-exports
├── tests/
│   ├── crypto.test.ts
│   ├── client.test.ts
│   └── errors.test.ts
├── package.json
└── tsconfig.json
```

---

## Milestones

### Milestone 1 — Foundation
Everything works end-to-end on testnet. A real admin can create a ballot, upload voters, issue tokens, collect votes, tally, and verify the result on Stellar.

### Milestone 2 — Hardening
Per-ballot encryption keys, rate limiting, error handling, retry queues, no raw identifiers anywhere, Soroban fully wired.

### Milestone 3 — Ecosystem
`@anonvote/crypto` published on npm, docs repo complete, contracts deployed on mainnet, third-party developers can build on top of AnonVote using the JS SDK.

---

## License

[MIT](LICENSE)
