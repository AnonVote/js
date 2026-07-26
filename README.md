# @anonvote/crypto

**The cryptographic primitives and token utilities powering AnonVote.**

This package is the canonical source of all crypto and token logic used across the AnonVote ecosystem. It is framework-agnostic and has zero runtime dependencies. Runtime support varies by function — see [Runtime support](#runtime-support) below.

[![npm](https://img.shields.io/npm/v/@anonvote/crypto)](https://www.npmjs.com/package/@anonvote/crypto)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)

---

## Role in the ecosystem

| Repo                                                        | Depends on this package                  |
| ----------------------------------------------------------- | ---------------------------------------- |
| [AnonVote/core](https://github.com/AnonVote/core)           | Yes — backend imports `@anonvote/crypto` |
| [AnonVote/contracts](https://github.com/AnonVote/contracts) | No — Soroban contracts use native Rust   |
| [AnonVote/docs](https://github.com/AnonVote/docs)           | References this package in spec docs     |

---

## What's in this package

### Cryptographic utilities (`src/crypto.ts`)

| Export                       | Description                                                                                                        | Edge runtime support |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------- |
| `hashIdentifier(id)`         | SHA-256 hash of a voter identifier. Trims and lowercases before hashing. Never store originals — only hashes.      | No — Node.js `crypto` only |
| `generateToken()`            | Generates a 32-byte (256-bit) CSPRNG token as a hex string. Used for one-time voter tokens.                        | Yes |
| `hashToken(token)`           | SHA-256 hash of a raw token. Only the hash is ever persisted — the raw value is given to the voter and discarded.  | No — Node.js `crypto` only |
| `encryptVote(optionId, key)` | AES-256-GCM encryption of a vote option ID. Returns `iv:authTag:ciphertext` in base64. Requires a 32-byte hex key. | No — Node.js `crypto` only |
| `decryptVote(payload, key)`  | Decrypts a vote payload produced by `encryptVote`. Used only by the result tally engine.                           | No — Node.js `crypto` only |

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

## Runtime support

Support differs per export — this package is **not** uniformly edge-compatible:

| Runtime                                                    | `generateToken` | `hashIdentifier` / `hashToken` | `encryptVote` / `decryptVote` |
| ----------------------------------------------------------- | :--------------: | :-----------------------------: | :------------------------------: |
| Node.js                                                      | ✅               | ✅                              | ✅                               |
| Cloudflare Workers / Vercel Edge Functions (no compat flag)  | ✅               | ❌                              | ❌                               |
| Cloudflare Workers with `nodejs_compat`                      | ✅               | ✅                              | ✅                               |

- **`generateToken`** uses the Web Crypto API (`globalThis.crypto.getRandomValues`) when it's available, and falls back to Node's `crypto.randomBytes` otherwise. This makes it work in Node.js and in edge runtimes without any bundler configuration.
- **`hashIdentifier`, `hashToken`, `encryptVote`, and `decryptVote`** call into Node's `crypto` module (`createHash`, `createCipheriv`, `createDecipheriv`) via a lazy `require("crypto")` inside each function body, so importing this package never pulls Node's `crypto` module into an edge bundle at build time. But calling these four functions still requires an environment where Node's `crypto` module actually resolves at runtime — plain Cloudflare Workers or Vercel Edge Functions without a Node.js compatibility layer will throw when they're called.
  - We evaluated replacing the AES-256-GCM cipher calls with the Web Crypto API's `SubtleCrypto.encrypt`/`decrypt`, which is supported across Node.js, browsers, and edge runtimes. However, `SubtleCrypto` methods are Promise-based, while `encryptVote`/`decryptVote` are currently synchronous. Switching would mean an async API — a breaking change for existing callers — so it wasn't done here. If broader edge support for encryption is needed, it would need to ship as a new async API (e.g. `encryptVoteAsync`) rather than changing the existing signatures.
  - The same sync/async constraint applies to `hashIdentifier`/`hashToken`, since `SubtleCrypto.digest` is also async.
- **Bundler note:** `getNodeCrypto()` in `src/crypto.ts` calls `require("crypto")` from inside a function body rather than as a top-level import. Do not change this to a top-level `import` or a top-level `try { require("crypto") }` — either pattern causes some edge bundlers to include Node's `crypto` module in the output even along code paths that never call it.
- Browser bundle support and Deno-specific testing are out of scope for this package.

---

## Privacy guarantees

These primitives enforce AnonVote's structural unlinkability model:

- `hashIdentifier` and `hashToken` are **one-way** — original values are unrecoverable from the database
- `generateToken` uses the Web Crypto API's `getRandomValues` when available, falling back to Node.js `crypto.randomBytes` — cryptographically secure and unpredictable in either case
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

| Command              | Description                          |
| -------------------- | ------------------------------------ |
| `npm run build`      | Compile TypeScript to `dist/`        |
| `npm test`           | Run unit tests with Jest             |
| `npm run lint`       | ESLint check on `src/` and `tests/`  |
| `npm run lint:fix`   | Auto-fix fixable lint issues         |

### Pre-commit checklist

Before committing, run lint and tests manually:

```bash
npm run lint   # must exit 0 — no errors allowed
npm test       # must pass
```

The `no-console` rule is enforced as an error. If lint flags a `console.*` in `src/`, remove it — do not add an eslint-disable comment.

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

## Milestones

AnonVote development is organized into three milestones. Each issue is tagged with which milestone it belongs to.

### Milestone 1 — Foundation

Everything works end-to-end on testnet. A real admin can create a ballot, upload voters, issue tokens, collect votes, tally, and verify the result on Stellar. No manual database steps.

**Status:** In progress
**Focus:** Core voting flow, Soroban integration, vote encryption, public verification

### Milestone 2 — Hardening

The system is production-safe. Per-ballot encryption keys, rate limiting, error handling, retry queues, no raw identifiers anywhere, Soroban fully wired not stubbed.

**Status:** Planned
**Focus:** Security hardening, production readiness, reliability, scalability

### Milestone 3 — Ecosystem

@anonvote/crypto published on npm, docs repo complete, contracts deployed on mainnet, third party developers can build on top of AnonVote using the JS SDK.

**Status:** Planned
**Focus:** SDK release, third-party integrations, documentation

---

## Contributing

Issues are labeled with their corresponding milestone so you can see what stage of development they belong to.

---

## License

[MIT](LICENSE)
