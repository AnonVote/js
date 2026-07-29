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

// Crypto-primitive types (canonical, required by the issue)
export type {
  EncryptedPayload,
  Token,
  Vote,
  ElectionResult,
  BallotEvent,
} from "./types";
export { AnonVoteCryptoError } from "./types";

// Core / ecosystem types
export type {
  BallotStatus,
  Option,
  Ballot,
  EligibilityList,
  EligibilityEntry,
  VoterToken,
  VoteRecord,
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
