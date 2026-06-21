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

// Client SDK
export { AnonVoteClient } from "./client";

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