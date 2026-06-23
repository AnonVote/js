import { randomBytes } from "crypto";
import { encryptVote, decryptVote } from "./crypto";
import { ValidationError } from "./errors";
import type {
  Election,
  ElectionOption,
  VoteReceipt,
  ClientConfig,
  CreateElectionParams,
  CastVoteParams,
  EncryptedPayload,
} from "./types";

/**
 * Serialized election payload suitable for APIs or blockchain transactions.
 */
export interface SerializedElection {
  id: string;
  title: string;
  description: string;
  options: ElectionOption[];
  startTime: string;
  endTime: string;
  createdAt: string;
}

/**
 * AnonVoteClient - The primary SDK interface for interacting with AnonVote.
 *
 * This client provides a minimal, consistent, and framework-agnostic API
 * for creating elections, casting votes, and verifying results. It hides
 * internal implementation details like cryptographic primitives and
 * payload serialization.
 *
 * @example
 * ```typescript
 * const client = new AnonVoteClient({
 *   encryptionKey: process.env.BALLOT_ENCRYPTION_KEY!,
 * });
 *
 * // Create an election
 * const election = client.createElection({
 *   title: "Board Election 2024",
 *   description: "Elect the new board members",
 *   options: ["Alice", "Bob", "Charlie"],
 *   startTime: Date.now(),
 *   endTime: Date.now() + 7 * 24 * 60 * 60 * 1000,
 * });
 *
 * // Cast a vote
 * const receipt = client.castVote({
 *   ballotId: election.id,
 *   voteOption: election.options[0].text,
 *   encryptionKey: process.env.BALLOT_ENCRYPTION_KEY!,
 * });
 *
 * // Verify a vote
 * const isValid = client.verifyVote(receipt.encryptedPayload, process.env.BALLOT_ENCRYPTION_KEY!);
 * ```
 */
export class AnonVoteClient {
  private readonly config: ClientConfig;

  /**
   * Creates a new AnonVoteClient instance.
   *
   * @param config - The client configuration options. If not provided,
   *                 an empty config is used and encryptionKey must be
   *                 provided explicitly in method calls.
   */
  constructor(config: ClientConfig = {}) {
    this.config = config;
  }

  /**
   * Creates a new election object.
   *
   * @param params - The election creation parameters.
   * @returns A strongly typed Election object.
   * @throws Error if the election data is invalid.
   */
  createElection(params: CreateElectionParams): Election {
    // Validate title
    if (!params.title || (typeof params.title === "string" && params.title.trim().length === 0)) {
      throw new ValidationError("Election title is required");
    }

    // Validate description
    if (!params.description || (typeof params.description === "string" && params.description.trim().length === 0)) {
      throw new ValidationError("Election description is required");
    }

    // Validate options
    if (!params.options || !Array.isArray(params.options) || params.options.length === 0) {
      throw new ValidationError("At least one voting option is required");
    }

    // Validate each option is non-empty
    for (const opt of params.options) {
      if (!opt || (typeof opt === "string" && opt.trim().length === 0)) {
        throw new ValidationError("Voting options cannot be empty strings");
      }
    }

    // Validate startTime
    const startTimeMs = this.parseTimestamp(params.startTime);
    if (isNaN(startTimeMs)) {
      throw new ValidationError("Invalid startTime: must be a valid date or timestamp");
    }

    // Validate endTime
    const endTimeMs = this.parseTimestamp(params.endTime);
    if (isNaN(endTimeMs)) {
      throw new ValidationError("Invalid endTime: must be a valid date or timestamp");
    }

    if (endTimeMs <= startTimeMs) {
      throw new ValidationError("endTime must be after startTime");
    }

    const now = new Date();
    const createdAt = now.toISOString();

    // Generate election ID
    const id = this.generateId("elec");

    // Create options with generated IDs
    const electionOptions: ElectionOption[] = params.options.map((text, index) => ({
      id: this.generateId(`option-${index}`),
      text: text.trim(),
    }));

    return {
      id,
      title: typeof params.title === "string" ? params.title.trim() : String(params.title),
      description: typeof params.description === "string" ? params.description.trim() : String(params.description),
      options: electionOptions,
      startTime: new Date(startTimeMs).toISOString(),
      endTime: new Date(endTimeMs).toISOString(),
      createdAt,
    };
  }

  /**
   * Casts a vote for a specific option.
   *
   * This method validates the vote, encrypts it using @anonvote/crypto,
   * and returns the encrypted payload ready for submission.
   *
   * @param params - The vote casting parameters.
   * @returns A VoteReceipt confirming the vote was cast.
   * @throws Error if required parameters are missing.
   */
  castVote(params: CastVoteParams): VoteReceipt {
    if (!params.ballotId || (typeof params.ballotId === "string" && params.ballotId.trim().length === 0)) {
      throw new ValidationError("ballotId is required");
    }

    if (!params.voteOption || (typeof params.voteOption === "string" && params.voteOption.trim().length === 0)) {
      throw new ValidationError("voteOption is required");
    }

    const encryptionKey = params.encryptionKey || this.config.encryptionKey;
    if (!encryptionKey) {
      throw new ValidationError("encryptionKey is required either in params or client config");
    }

    // Encrypt the vote
    const encryptedPayload = encryptVote(params.voteOption.trim(), encryptionKey);

    const id = this.generateId("receipt");
    const castAt = new Date().toISOString();

    return {
      id,
      electionId: params.ballotId,
      ballotId: params.ballotId,
      encryptedPayload,
      castAt,
      verified: false,
    };
  }

  /**
   * Verifies an encrypted vote payload.
   *
   * This method attempts to decrypt and validate the payload,
   * returning a boolean indicating whether the payload is valid.
   *
   * @param encryptedPayload - The encrypted vote payload to verify.
   * @param encryptionKey - The encryption key to use for verification.
   *                        If not provided, uses the client config key.
   * @returns true if the payload can be successfully decrypted and validated.
   */
  verifyVote(encryptedPayload: EncryptedPayload, encryptionKey?: string): boolean {
    if (
      !encryptedPayload ||
      !encryptedPayload.ciphertext ||
      !encryptedPayload.iv ||
      !encryptedPayload.authTag
    ) {
      return false;
    }

    const key = encryptionKey || this.config.encryptionKey;
    if (!key) {
      return false;
    }

    try {
      const decrypted = decryptVote(encryptedPayload, key);
      // If decryption succeeded, the payload is valid
      return typeof decrypted === "string" && decrypted.length > 0;
    } catch {
      // Decryption failed - invalid payload
      return false;
    }
  }

  /**
   * Serializes an Election object to a JSON-safe payload.
   *
   * @param election - The Election object to serialize.
   * @returns A serialized payload suitable for APIs or blockchain transactions.
   * @throws Error if the election is invalid.
   */
  serialize(election: Election): SerializedElection {
    if (!election || typeof election !== "object") {
      throw new ValidationError("Invalid election object");
    }

    return {
      id: election.id,
      title: election.title,
      description: election.description,
      options: election.options,
      startTime: election.startTime,
      endTime: election.endTime,
      createdAt: election.createdAt,
    };
  }

  /**
   * Deserializes an Election object from a JSON payload.
   *
   * @param payload - The serialized election payload.
   * @returns A strongly typed Election object.
   * @throws Error if the payload is invalid.
   */
  deserialize(payload: SerializedElection): Election {
    if (!payload || typeof payload !== "object") {
      throw new ValidationError("Invalid election object");
    }

    // Validate required fields
    if (!payload.id || typeof payload.id !== "string") {
      throw new ValidationError("Invalid payload: missing or invalid id");
    }

    if (!payload.title || typeof payload.title !== "string") {
      throw new ValidationError("Invalid payload: missing or invalid title");
    }

    if (!payload.description || typeof payload.description !== "string") {
      throw new ValidationError("Invalid payload: missing or invalid description");
    }

    if (!Array.isArray(payload.options)) {
      throw new ValidationError("Invalid payload: missing or invalid options");
    }

    // Validate each option has id and text
    for (const opt of payload.options) {
      if (!opt.id || typeof opt.id !== "string") {
        throw new ValidationError("Invalid payload: option missing id");
      }
      if (!opt.text || typeof opt.text !== "string") {
        throw new ValidationError("Invalid payload: option missing text");
      }
    }

    if (!payload.startTime || typeof payload.startTime !== "string") {
      throw new ValidationError("Invalid payload: missing or invalid startTime");
    }

    if (!payload.endTime || typeof payload.endTime !== "string") {
      throw new ValidationError("Invalid payload: missing or invalid endTime");
    }

    if (!payload.createdAt || typeof payload.createdAt !== "string") {
      throw new ValidationError("Invalid payload: missing or invalid createdAt");
    }

    return {
      id: payload.id,
      title: payload.title,
      description: payload.description,
      options: payload.options,
      startTime: payload.startTime,
      endTime: payload.endTime,
      createdAt: payload.createdAt,
    };
  }

  /**
   * Parses a timestamp value (string or number) into milliseconds.
   *
   * @param value - The timestamp value to parse.
   * @returns The timestamp in milliseconds, or NaN if invalid.
   */
  private parseTimestamp(value: string | number): number {
    if (typeof value === "number") {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Date.parse(value);
      if (!isNaN(parsed)) {
        return parsed;
      }
      // Try parsing as a number string
      const numValue = Number(value);
      if (!isNaN(numValue)) {
        return numValue;
      }
    }
    return NaN;
  }

  /**
   * Generates a unique identifier with an optional prefix.
   *
   * @param prefix - Optional prefix for the ID.
   * @returns A unique ID string.
   */
  private generateId(prefix: string): string {
    const bytes = randomBytes(16);
    const hex = Array.from(bytes as unknown as number[])
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const uuid = [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20, 32),
    ].join("-");

    return `${prefix}-${uuid}`;
  }
}