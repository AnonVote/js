# Architecture Decisions

## ADR-001 — `encryptVote` output format: hex

**Date:** 2026-07-28  
**Status:** Accepted

### Context

`encryptVote` must return an `EncryptedPayload` object with three fields: `ciphertext`, `iv`, and `authTag`. When the original implementation was written, the README documented these as base64-encoded strings. The AnonVote/core backend, however, was written to consume hex-encoded strings for all three fields. This created a silent wire-format mismatch that would cause every tally operation to fail the first time a real ballot was run.

### Decision

All three fields of `EncryptedPayload` (`ciphertext`, `iv`, `authTag`) are **lowercase hex strings**. Base64 is not used anywhere in the cryptographic output surface of this package.

### Rationale

1. **Consistency with the rest of the package.** `hashIdentifier` and `hashToken` both return lowercase hex strings. Using hex for `encryptVote` output means every value that leaves this package is in the same encoding. A consumer reading stored values can tell immediately what encoding they are in.

2. **AnonVote/core expects hex.** Changing this package to emit hex requires editing one file (`src/crypto.ts`) and its tests. Changing core to accept base64 would require updating multiple layers of the tally engine, the Stellar audit trail writer, and the storage schema. The smaller change surface is the correct choice.

3. **Hex is self-describing.** A developer inspecting a stored row in the database can see a 24-character hex string and know it is a 12-byte IV. A base64 string requires knowing the encoding to interpret its length.

4. **No information density benefit from base64 at this scale.** Vote payloads are small (a UUID option ID). The 33% storage overhead difference between hex and base64 is immaterial at any realistic ballot size.

### Consequences

- The README's description of `encryptVote` returning `iv:authTag:ciphertext` as a single base64 string is superseded. The function now returns a structured `EncryptedPayload` object with three hex fields.
- `decryptVote` accepts an `EncryptedPayload` object (not a colon-delimited string) and a hex key.
- Any consumer that was relying on the old base64 colon-delimited format must migrate to the `EncryptedPayload` object interface.
- All existing tests have been rewritten to reflect this format.
