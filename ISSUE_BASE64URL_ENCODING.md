# Issue: generateToken output is not URL-safe — add optional base64url encoding variant

## Summary

The `generateToken()` function in `js/src/crypto.ts` generates a random 32-byte token and returns it as a 64-character hexadecimal string. While hex strings are technically URL-safe, they are unnecessarily long. A base64url encoding variant would reduce size from 64 characters (hex) to 43 characters (base64url) for more compact URL usage. An optional parameter must be added to support both hex (current, default) and base64url encoding variants to provide flexibility for different use cases.

## Background

The `generateToken()` function is used to create voter tokens for the voting system. Tokens are passed to voters via email or URL parameters. Currently:

- Output format: 64-character lowercase hex string (32 bytes × 2)
- Encoding: Hexadecimal only
- URL usage: Works in URLs but unnecessarily long
- No variant for compact representations

Current implementation:

```typescript
export function generateToken(): string {
  return bytesToHex(getRandomBytes(32));
}
```

## Scope

### Optional Encoding Parameter

- Add optional `encoding` parameter to `generateToken()` function
- Support two encoding variants:
  1. `'hex'` (default) — Current behavior (64 chars)
  2. `'base64url'` — URL-safe base64 without padding (43 chars)
- Maintain backward compatibility (default to hex)

### Base64url Implementation

- Create `bytesToBase64Url()` helper function in utils
- Use RFC 4648 base64url encoding (replaces `+` with `-`, `/` with `_`)
- Remove padding (`=` characters)
- Implementation uses Node.js `Buffer.toString('base64url')` if available

### Function Signature

```typescript
export function generateToken(encoding?: "hex" | "base64url"): string {
  const bytes = getRandomBytes(32);
  if (encoding === "base64url") {
    return bytesToBase64Url(bytes);
  }
  return bytesToHex(bytes); // default
}
```

### URL Safety Verification

- Hex output: Only lowercase a-z, 0-9 (URL-safe)
- Base64url output: a-zA-Z0-9, `-`, `_` (URL-safe per RFC 4648)
- Both variants safe for query parameters, path segments, and fragments

## Files Involved

- `js/src/crypto.ts` (update `generateToken()` function)
- `js/src/utils.ts` (add `bytesToBase64Url()` helper)
- `js/src/index.ts` (ensure exports if public API)

## Implementation Details

```typescript
// In utils.ts
export function bytesToBase64Url(bytes: Uint8Array): string {
  const base64 = Buffer.from(bytes).toString("base64");
  // Replace + with -, / with _, remove trailing =
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// In crypto.ts
export function generateToken(encoding?: "hex" | "base64url"): string {
  const bytes = getRandomBytes(32);
  if (encoding === "base64url") {
    return bytesToBase64Url(bytes);
  }
  return bytesToHex(bytes);
}
```

## Testing

- Hex tokens: 64 characters, lowercase a-z0-9
- Base64url tokens: ~43 characters, a-zA-Z0-9-\_
- Both encodings: decode back to identical 32 bytes
- Backward compatibility: `generateToken()` defaults to hex
- URL safety: Both can be used in URLs without encoding
- No output differences when encoding not specified

## Relevant Files

- `js/src/crypto.ts` (main implementation)
- `js/src/utils.ts` (helper functions)
- `js/README.md` (documentation update)

## Acceptance Criteria

- `generateToken()` accepts optional `encoding` parameter
- Default behavior unchanged (returns hex, 64 chars)
- `generateToken('base64url')` returns base64url encoded token (~43 chars)
- Both outputs URL-safe
- Both decode to identical 32-byte values
- Backward compatible (no breaking changes)
- No compilation warnings
- Tests pass for both encoding variants

## Out of Scope

- Changing default encoding (keep hex as default)
- Other encoding formats (base64 with padding, etc.)
- Changing random byte generation (keep 32 bytes)
- Token hashing or validation

## Note for Contributors

This is a feature enhancement to an existing function. Modify `generateToken()` to accept an optional `encoding` parameter ('hex' | 'base64url'). Create a `bytesToBase64Url()` helper using RFC 4648 base64url encoding (replace + with -, / with \_, remove padding). Keep hex as the default to maintain backward compatibility. Add comprehensive tests for both encoding variants. This should take 30-45 minutes including tests and verification.
