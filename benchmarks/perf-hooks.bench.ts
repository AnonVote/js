import { performance } from "node:perf_hooks";
import {
  decryptVote,
  encryptVote,
  generateToken,
  hashToken,
  verifyVoteHash,
} from "../src/crypto";
import { KEY, SAMPLE_OPTION } from "./setup";

interface BenchmarkResult {
  name: string;
  iterations: number;
  totalMs: number;
  meanMs: number;
  minMs: number;
  maxMs: number;
  opsPerSecond: number;
}

function getIterations(): number {
  const parsed = Number.parseInt(process.env.BENCH_ITERATIONS ?? "1000", 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error("BENCH_ITERATIONS must be a positive integer");
  }
  return parsed;
}

function benchmark(
  name: string,
  fn: () => void,
  iterations: number,
): BenchmarkResult {
  const samples: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const startMark = `${name}-start`;
    const endMark = `${name}-end`;
    const measureName = `${name}-measure`;

    performance.mark(startMark);
    fn();
    performance.mark(endMark);

    const measurement = performance.measure(measureName, startMark, endMark);
    samples.push(measurement.duration);

    performance.clearMarks(startMark);
    performance.clearMarks(endMark);
    performance.clearMeasures(measureName);
  }

  const totalMs = samples.reduce((sum, duration) => sum + duration, 0);
  const meanMs = totalMs / iterations;
  const minMs = Math.min(...samples);
  const maxMs = Math.max(...samples);
  const opsPerSecond = totalMs === 0 ? Number.POSITIVE_INFINITY : (iterations / totalMs) * 1000;

  return {
    name,
    iterations,
    totalMs,
    meanMs,
    minMs,
    maxMs,
    opsPerSecond,
  };
}

const iterations = getIterations();
const token = generateToken();
const encryptedVote = encryptVote(SAMPLE_OPTION, KEY);

const results = [
  benchmark("generateToken", () => {
    generateToken();
  }, iterations),
  benchmark("hashToken", () => {
    hashToken(token);
  }, iterations),
  benchmark("encryptVote", () => {
    encryptVote(SAMPLE_OPTION, KEY);
  }, iterations),
  benchmark("decryptVote", () => {
    decryptVote(encryptedVote, KEY);
  }, iterations),
  benchmark("verifyVoteHash", () => {
    verifyVoteHash(SAMPLE_OPTION, encryptedVote, KEY);
  }, iterations),
];

console.table(
  results.map((result) => ({
    function: result.name,
    iterations: result.iterations,
    "total ms": Number(result.totalMs.toFixed(3)),
    "mean ms": Number(result.meanMs.toFixed(6)),
    "min ms": Number(result.minMs.toFixed(6)),
    "max ms": Number(result.maxMs.toFixed(6)),
    "ops/sec": Number(result.opsPerSecond.toFixed(2)),
  })),
);
