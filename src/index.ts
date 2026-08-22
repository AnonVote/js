/**
 * @anonvote/crypto
 *
 * Public API for the AnonVote cryptographic primitives, shared types,
 * and the AnonVoteClient SDK.
 */

// Crypto primitives
export {
  hashIdentifier,
  generateToken,
  hashToken,
  encryptVote,
  decryptVote,
  verifyVoteHash,
  verifyVoteProof,
} from "./crypto";

// Helper utilities
export { bytesToBase64Url } from "./utils";

// Retry utility
export {
  withRetry,
  resolveRetryConfig,
  calculateDelay,
  HttpError,
  DEFAULT_RETRY_CONFIG,
} from "./retry";
export type { RetryConfig } from "./types";

// Client SDK (local election/vote operations)
export { AnonVoteClient } from "./client";
export type { SerializedElection } from "./client";

// HTTP API Client SDK (full backend integration)
export { AnonVoteClient as AnonVoteHttpClient } from "./client/AnonVoteClient";
export type {
  AnonVoteClientConfig as HttpClientConfig,
  UploadResult,
  TokenBatch,
  VoteResult,
  OptionResult,
  BallotResults,
  VerificationReport,
} from "./client/AnonVoteClient";

// HTTP Client error types
export {
  InvalidTokenError,
  BallotClosedError,
  BallotNotFoundError,
  AuthError,
  TimeoutError,
  ApiError,
} from "./client/errors";

// Error types
export { AnonVoteError, ValidationError, CryptoError } from "./errors";

// Core types
export type {
  BallotStatus,
  Option,
  Ballot,
  EligibilityList,
  EligibilityEntry,
  Token,
  VoterToken,
  EncryptedVote,
  Vote,
  EncryptedPayload,
  Organization,
  Result,
  AuditEventType,
  AuditEvent,
  AuditCounts,
  ApiResponse,
  TokenResponse,
  LoginResponse,
  ClientConfig,
  ElectionOption,
  CreateElectionParams,
  Election,
  CastVoteParams,
  VoteReceipt,
} from "./types";
