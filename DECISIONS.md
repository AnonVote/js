# Architecture Decisions

## ADR-001: AnonVoteClient SDK — Subpath Export (Option B)

**Status:** Accepted  
**Date:** 2026-07-28

### Context

`@anonvote/crypto` exports five low-level cryptographic primitives. A higher-level
`AnonVoteClient` SDK needed to be added. Two placement options were considered:

**Option A** — Add `src/client.ts` to the existing package and export `AnonVoteClient`
alongside the primitives from `src/index.ts`. One package, one entry point.

**Option B** — Create `src/client/` with its own entry point and expose it as the
subpath export `@anonvote/crypto/client`. Primitives and client are imported separately.

### Decision

**Option B — subpath export** was chosen.

Rationale:

- **Tree-shaking.** Consumers who only need the raw primitives (`encryptVote`,
  `hashToken`, etc.) do not pay the cost of importing the client code. The subpath
  makes the import graph explicit.
- **Separation of concerns.** The SDK layer has different stability guarantees and
  a different change cadence than the primitives. A separate entry point makes that
  boundary clear.
- **Node.js 12+ subpath exports** are already a standard pattern and the package is
  already in a TypeScript + CommonJS configuration that supports them with no extra
  tooling.
- **Explicit API surface.** Developers importing `@anonvote/crypto/client` signal
  intent — they want the SDK, not just the primitives.

### Consequences

`package.json` gains an `exports` field:

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./client": "./dist/client/index.js"
  }
}
```

`tsconfig.json` `include` must cover `src/client/`.

New files created:
- `src/client/types.ts` — domain-level SDK types
- `src/client/index.ts` — `AnonVoteClient` class

The existing `src/client.ts` (lower-level, retry-focused) is preserved and continues
to be exported from the root entry point. The new `src/client/index.ts` is the
developer-facing SDK.
