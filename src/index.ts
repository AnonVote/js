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
} from "./crypto";

// Retry utility
export { withRetry, resolveRetryConfig, calculateDelay, HttpError, DEFAULT_RETRY_CONFIG } from "./retry";
export type { RetryConfig } from "./types";

// Client SDK (low-level retry-aware client)
export { AnonVoteClient } from "./client";

// AnonVoteClient HTTP SDK
export { AnonVoteClient as AnonVoteHttpClient } from "./client/AnonVoteClient";
export type { AnonVoteClientConfig, UploadResult, TokenBatch, VoteResult, BallotResults, OptionResult, VerificationReport } from "./client/AnonVoteClient";
export { InvalidTokenError, BallotClosedError, BallotNotFoundError, AuthError, TimeoutError, ApiError } from "./client/errors";

// Errors
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
  // Client SDK types
  ClientConfig,
  CreateElectionParams,
  CastVoteParams,
  Election,
  ElectionOption,
  VoteReceipt,
} from "./types";