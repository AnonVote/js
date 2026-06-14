/**
 * Shared TypeScript types for the AnonVote ecosystem.
 *
 * These types are the single source of truth for ballot, token, vote,
 * result, and audit data shapes used across core, client SDKs, and
 * any future consumer of the AnonVote protocol.
 */

// ── Ballot ────────────────────────────────────────────────────────────────────

export type BallotStatus = "OPEN" | "CLOSED";

export interface Option {
  id: string;
  ballotId: string;
  text: string;
}

export interface Ballot {
  id: string;
  organizationId: string;
  topic: string;
  status: BallotStatus;
  deadline: string;
  eligibilityListId: string;
  allowWeightedVoting: boolean;
  allowRankedChoice: boolean;
  maxRankings?: number;
  createdAt: string;
  options: Option[];
  votesCast?: number;
  tokensIssued?: number;
  eligibleVoters?: number;
}

// ── Eligibility ───────────────────────────────────────────────────────────────

export interface EligibilityList {
  id: string;
  createdAt: string;
}

/**
 * An entry in an eligibility list.
 * `identifierHash` is the SHA-256 hash of the voter identifier — the original
 * is never stored. See {@link hashIdentifier}.
 */
export interface EligibilityEntry {
  id: string;
  eligibilityListId: string;
  identifierHash: string;
  weight: number;
  tokenIssued: boolean;
}

// ── Token ─────────────────────────────────────────────────────────────────────

/**
 * A one-time voter token record.
 * `tokenHash` is the SHA-256 hash of the raw token — the raw value is never
 * stored. See {@link generateToken} and {@link hashToken}.
 */
export interface VoterToken {
  id: string;
  tokenHash: string;
  ballotId: string;
  used: boolean;
  issuedAt: string;
  usedAt?: string;
  /** If set, this token was the recipient of a delegation. */
  delegatedFrom?: string;
  /** If set, this token delegates its vote to another token. */
  delegatedTo?: string;
}

// ── Vote ──────────────────────────────────────────────────────────────────────

/**
 * A submitted vote.
 * `encryptedPayload` is the AES-256-GCM encrypted option ID.
 * See {@link encryptVote} and {@link decryptVote}.
 */
export interface Vote {
  id: string;
  ballotId: string;
  optionId: string;
  encryptedPayload: string;
  weight: number;
  rank?: number;
  stellarTxId?: string;
  submittedAt: string;
}

// ── Organization ──────────────────────────────────────────────────────────────

export interface Organization {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

// ── Results ───────────────────────────────────────────────────────────────────

export interface Result {
  id: string;
  ballotId: string;
  tallyJson: string;
  totalVotes: number;
  isConsistent: boolean;
  stellarTxId?: string;
  publishedAt: string;
}

// ── Audit ─────────────────────────────────────────────────────────────────────

export type AuditEventType =
  | "TOKEN_ISSUED"
  | "VOTE_CAST"
  | "RESULT_PUBLISHED"
  | "DUPLICATE_TOKEN_ATTEMPT"
  | "DUPLICATE_VOTE_ATTEMPT";

export interface AuditEvent {
  id: string;
  ballotId: string;
  eventType: AuditEventType;
  stellarTxId?: string;
  createdAt: string;
}

export interface AuditCounts {
  tokensIssued: number;
  votesCast: number;
  events: AuditEvent[];
}

// ── API helpers ───────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
}

export interface TokenResponse {
  token: string;
  weight: number;
}

export interface LoginResponse {
  organizationId: string;
  name: string;
}
