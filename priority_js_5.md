# Issue: Add benchmarks for all five crypto functions using Node.js perf_hooks

## Summary

The JavaScript package includes benchmarks for crypto functions using the `tinybench` third-party library, but the requirement specifies Node.js native `perf_hooks` module. Benchmarks must be added for all five cryptographic functions using `perf_hooks` to provide fine-grained performance measurement without external dependencies. This enables portable, reproducible performance testing across all environments.

## Background

The `js/src/crypto.ts` module provides five core cryptographic functions:

1. `generateToken()` — Generates 32-byte random token as hex string
2. `hashToken()` — SHA-256 hash of voter token
3. `encryptVote()` — AES-256-GCM encryption of vote option
4. `decryptVote()` — Decrypt encrypted vote payload
5. `verifyVoteProof()` — Verify Merkle proof of vote inclusion

Currently:

- Benchmarks exist in `js/benchmarks/` using tinybench library
- Files: `encrypt.bench.ts`, `decrypt.bench.ts`, `generateToken.bench.ts`, `hash.bench.ts`
- No native `perf_hooks` benchmarks exist
- Users must install additional dependencies to run benchmarks
- Performance results may vary across benchmark libraries

## Scope

### Benchmark Suite with perf_hooks

- Create `js/benchmarks/perf-hooks.bench.ts` file
- Implement benchmarks for all five crypto functions:
  1. `generateToken()` benchmark
  2. `hashToken()` benchmark
  3. `encryptVote()` benchmark
  4. `decryptVote()` benchmark
  5. `verifyVoteProof()` benchmark

### Performance Metrics

Each benchmark should measure:

- Execution time with `performance.mark()` and `performance.measure()`
- Multiple iterations (e.g., 1000-10000 iterations)
- Calculate mean, min, max, and operations per second (ops/sec)
- Output results in standardized format

### Integration

- Add `npm run bench:perf-hooks` script to `js/package.json`
- Benchmarks should run independently without additional dependencies
- Output format: JSON or human-readable table
- Compare against tinybench results if needed

### Test Data

- Use consistent test data across all benchmarks:
  - Token: 64-char hex string (32 bytes)
  - Encryption key: 64-char hex string (32 bytes)
  - Vote option: "Yes"/"No"/etc (varies by test)
  - Merkle proof: standard test proof structure

## Files Involved

- `js/benchmarks/perf-hooks.bench.ts` (to be created)
- `js/package.json` (add bench:perf-hooks script)
- `js/tsconfig.json` (if needed)

## Implementation Details

```typescript
// Example structure
import { performance } from "perf_hooks";
import {
  generateToken,
  hashToken,
  encryptVote,
  decryptVote,
  verifyVoteProof,
} from "../src/crypto";

// Helper function
function benchmark(name: string, fn: () => void, iterations: number = 1000) {
  performance.mark(`${name}-start`);
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  performance.mark(`${name}-end`);
  const measure = performance.measure(name, `${name}-start`, `${name}-end`);

  const opsPerSecond = (iterations / measure.duration) * 1000;
  console.log(
    `${name}: ${measure.duration.toFixed(2)}ms, ${opsPerSecond.toFixed(0)} ops/sec`,
  );
}
```

## Testing

- npm run bench:perf-hooks should execute without errors
- Results should be consistent across runs
- Performance within expected ranges for cryptographic operations
- No memory leaks across iterations

## Relevant Files

- `js/benchmarks/perf-hooks.bench.ts` (to be created)
- `js/src/crypto.ts` (reference implementation)
- `js/package.json` (script configuration)

## Acceptance Criteria

- perf_hooks benchmark file created
- Benchmarks for all five crypto functions
- npm run bench:perf-hooks executes successfully
- Results output in clear format
- No external dependencies required
- All functions measured with multiple iterations
- Performance metrics calculated (ops/sec, mean, min, max)
- Consistent results across runs
- No compilation warnings

## Out of Scope

- Removing tinybench benchmarks (keep both)
- Benchmarking non-crypto functions
- Async/Promise-based benchmarks (keep sync only)
- Integration with CI/CD performance tracking

## Note for Contributors

This is a performance testing implementation task. Create a new benchmark file using Node.js's native `perf_hooks` module. Implement benchmarks for all five crypto functions (generateToken, hashToken, encryptVote, decryptVote, verifyVoteProof) with multiple iterations (1000-10000). Use `performance.mark()` and `performance.measure()` to calculate metrics (mean, min, max, ops/sec). Add an npm script `bench:perf-hooks` to package.json. Compare results against existing tinybench benchmarks for consistency. This should take 1-2 hours including testing and validation.
