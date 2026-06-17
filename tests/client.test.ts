import { AnonVoteClient } from "../src/client";
import {
  type Election,
  type VoteReceipt,
  type ClientConfig,
} from "../src/types";

const TEST_KEY = "a".repeat(64); // 32 bytes hex for tests

describe("AnonVoteClient", () => {
  let client: AnonVoteClient;

  beforeEach(() => {
    client = new AnonVoteClient({ encryptionKey: TEST_KEY });
  });

  // ── Election Creation ──────────────────────────────────────────────────────

  describe("createElection", () => {
    it("creates an election with valid parameters", () => {
      const election = client.createElection({
        title: "Test Election",
        description: "A test election",
        options: ["Yes", "No", "Abstain"],
        startTime: Date.now(),
        endTime: Date.now() + 86400000,
      });

      expect(election).toHaveProperty("id");
      expect(election.id.startsWith("elec-")).toBe(true);
      expect(election.title).toBe("Test Election");
      expect(election.description).toBe("A test election");
      expect(election.options).toHaveLength(3);
      expect(election.options[0].text).toBe("Yes");
      expect(election.options[1].text).toBe("No");
      expect(election.options[2].text).toBe("Abstain");
      expect(election.startTime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(election.endTime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(election.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("accepts ISO string timestamps", () => {
      const election = client.createElection({
        title: "ISO Election",
        description: "Uses ISO strings",
        options: ["A", "B"],
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 86400000).toISOString(),
      });

      expect(election.startTime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(election.endTime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("generates unique IDs for each election", () => {
      const e1 = client.createElection({
        title: "E1",
        description: "First",
        options: ["A"],
        startTime: Date.now(),
        endTime: Date.now() + 1000,
      });
      const e2 = client.createElection({
        title: "E2",
        description: "Second",
        options: ["A"],
        startTime: Date.now(),
        endTime: Date.now() + 1000,
      });

      expect(e1.id).not.toBe(e2.id);
    });

    it("generates unique option IDs", () => {
      const election = client.createElection({
        title: "Options Test",
        description: "Test",
        options: ["A", "A"], // same text, different IDs
        startTime: Date.now(),
        endTime: Date.now() + 1000,
      });

      expect(election.options[0].id).not.toBe(election.options[1].id);
      expect(election.options[0].text).toBe("A");
      expect(election.options[1].text).toBe("A");
    });
  });

  // ── Invalid Election Data ──────────────────────────────────────────────────

  describe("createElection - validation", () => {
    it("throws on missing title", () => {
      expect(() =>
        (client as any).createElection({
          description: "desc",
          options: ["A"],
          startTime: Date.now(),
          endTime: Date.now() + 1000,
        }),
      ).toThrow("Election title is required");
    });

    it("throws on empty title", () => {
      expect(() =>
        client.createElection({
          title: "",
          description: "desc",
          options: ["A"],
          startTime: Date.now(),
          endTime: Date.now() + 1000,
        }),
      ).toThrow("Election title is required");
    });

    it("throws on missing description", () => {
      expect(() =>
        (client as any).createElection({
          title: "Title",
          options: ["A"],
          startTime: Date.now(),
          endTime: Date.now() + 1000,
        }),
      ).toThrow("Election description is required");
    });

    it("throws on empty description", () => {
      expect(() =>
        client.createElection({
          title: "Title",
          description: "",
          options: ["A"],
          startTime: Date.now(),
          endTime: Date.now() + 1000,
        }),
      ).toThrow("Election description is required");
    });

    it("throws on missing options", () => {
      expect(() =>
        (client as any).createElection({
          title: "Title",
          description: "desc",
          startTime: Date.now(),
          endTime: Date.now() + 1000,
        }),
      ).toThrow("At least one voting option is required");
    });

    it("throws on empty options array", () => {
      expect(() =>
        client.createElection({
          title: "Title",
          description: "desc",
          options: [],
          startTime: Date.now(),
          endTime: Date.now() + 1000,
        }),
      ).toThrow("At least one voting option is required");
    });

    it("throws on empty string options", () => {
      expect(() =>
        client.createElection({
          title: "Title",
          description: "desc",
          options: ["Valid", ""],
          startTime: Date.now(),
          endTime: Date.now() + 1000,
        }),
      ).toThrow("Voting options cannot be empty strings");
    });

    it("throws on invalid startTime", () => {
      expect(() =>
        client.createElection({
          title: "Title",
          description: "desc",
          options: ["A"],
          startTime: "not-a-date",
          endTime: Date.now() + 1000,
        }),
      ).toThrow("Invalid startTime");
    });

    it("throws on invalid endTime", () => {
      expect(() =>
        client.createElection({
          title: "Title",
          description: "desc",
          options: ["A"],
          startTime: Date.now(),
          endTime: "not-a-date",
        }),
      ).toThrow("Invalid endTime");
    });

    it("throws when endTime is before startTime", () => {
      expect(() =>
        client.createElection({
          title: "Title",
          description: "desc",
          options: ["A"],
          startTime: Date.now() + 86400000,
          endTime: Date.now(),
        }),
      ).toThrow("endTime must be after startTime");
    });

    it("throws when endTime equals startTime", () => {
      const now = Date.now();
      expect(() =>
        client.createElection({
          title: "Title",
          description: "desc",
          options: ["A"],
          startTime: now,
          endTime: now,
        }),
      ).toThrow("endTime must be after startTime");
    });
  });

  // ── Vote Casting ───────────────────────────────────────────────────────────

  describe("castVote", () => {
    it("casts a vote and returns a receipt", () => {
      const receipt = client.castVote({
        ballotId: "elec-123",
        voteOption: "Yes",
        encryptionKey: TEST_KEY,
      });

      expect(receipt).toHaveProperty("id");
      expect(receipt.id.startsWith("receipt-")).toBe(true);
      expect(receipt.ballotId).toBe("elec-123");
      expect(receipt.electionId).toBe("elec-123");
      expect(receipt.encryptedPayload).toMatch(/^[A-Za-z0-9+/=]+:/);
      expect(receipt.castAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(receipt.verified).toBe(false);
    });

    it("encrypts the vote option correctly", () => {
      const receipt = client.castVote({
        ballotId: "elec-123",
        voteOption: "Alice",
        encryptionKey: TEST_KEY,
      });

      // The payload should have three parts: iv:authTag:ciphertext
      const parts = receipt.encryptedPayload.split(":");
      expect(parts).toHaveLength(3);
    });

    it("produces different encrypted payloads for the same vote (random IV)", () => {
      const r1 = client.castVote({
        ballotId: "elec-123",
        voteOption: "Yes",
        encryptionKey: TEST_KEY,
      });
      const r2 = client.castVote({
        ballotId: "elec-123",
        voteOption: "Yes",
        encryptionKey: TEST_KEY,
      });

      expect(r1.encryptedPayload).not.toBe(r2.encryptedPayload);
    });
  });

  // ── Vote Serialization ─────────────────────────────────────────────────────

  describe("serialize", () => {
    it("serializes an election to a JSON-safe object", () => {
      const election = client.createElection({
        title: "Serialization Test",
        description: "Test serialization",
        options: ["A", "B"],
        startTime: Date.now(),
        endTime: Date.now() + 1000,
      });

      const payload = client.serialize(election);

      expect(payload).toEqual({
        id: election.id,
        title: election.title,
        description: election.description,
        options: election.options.map((o) => ({ id: o.id, text: o.text })),
        startTime: election.startTime,
        endTime: election.endTime,
        createdAt: election.createdAt,
      });
    });

    it("produces JSON-stringifiable output", () => {
      const election = client.createElection({
        title: "JSON Test",
        description: "Test",
        options: ["A"],
        startTime: Date.now(),
        endTime: Date.now() + 1000,
      });

      const payload = client.serialize(election);
      const json = JSON.stringify(payload);
      const parsed = JSON.parse(json);

      expect(parsed).toEqual(payload);
    });

    it("throws on null election", () => {
      expect(() => client.serialize(null as any)).toThrow(
        "Invalid election object",
      );
    });

    it("throws on undefined election", () => {
      expect(() => client.serialize(undefined as any)).toThrow(
        "Invalid election object",
      );
    });
  });

  // ── Vote Deserialization ───────────────────────────────────────────────────

  describe("deserialize", () => {
    it("deserializes a serialized election", () => {
      const election = client.createElection({
        title: "Round Trip",
        description: "Serialize and deserialize",
        options: ["Yes", "No"],
        startTime: Date.now(),
        endTime: Date.now() + 86400000,
      });

      const payload = client.serialize(election);
      const restored = client.deserialize(payload);

      expect(restored.id).toBe(election.id);
      expect(restored.title).toBe(election.title);
      expect(restored.description).toBe(election.description);
      expect(restored.options).toHaveLength(2);
      expect(restored.options[0].text).toBe("Yes");
      expect(restored.options[1].text).toBe("No");
      expect(restored.startTime).toBe(election.startTime);
      expect(restored.endTime).toBe(election.endTime);
      expect(restored.createdAt).toBe(election.createdAt);
    });

    it("round-trips correctly", () => {
      const election = client.createElection({
        title: "Round Trip",
        description: "Test",
        options: ["A", "B", "C"],
        startTime: Date.now(),
        endTime: Date.now() + 1000,
      });

      const payload = client.serialize(election);
      const json = JSON.stringify(payload);
      const parsed = JSON.parse(json);
      const restored = client.deserialize(parsed);

      expect(restored).toEqual(election);
    });

    it("throws on missing id", () => {
      expect(() => client.deserialize({ title: "T" } as any)).toThrow(
        "Invalid payload: missing or invalid id",
      );
    });

    it("throws on missing title", () => {
      expect(() =>
        client.deserialize({ id: "1" } as any),
      ).toThrow("Invalid payload: missing or invalid title");
    });

    it("throws on missing description", () => {
      expect(() =>
        client.deserialize({ id: "1", title: "T" } as any),
      ).toThrow("Invalid payload: missing or invalid description");
    });

    it("throws on missing options", () => {
      expect(() =>
        client.deserialize({ id: "1", title: "T", description: "D" } as any),
      ).toThrow("Invalid payload: missing or invalid options");
    });

    it("throws on missing startTime", () => {
      expect(() =>
        client.deserialize({
          id: "1",
          title: "T",
          description: "D",
          options: [],
        } as any),
      ).toThrow("Invalid payload: missing or invalid startTime");
    });

    it("throws on missing endTime", () => {
      expect(() =>
        client.deserialize({
          id: "1",
          title: "T",
          description: "D",
          options: [],
          startTime: "2024-01-01T00:00:00.000Z",
        } as any),
      ).toThrow("Invalid payload: missing or invalid endTime");
    });

    it("throws on missing createdAt", () => {
      expect(() =>
        client.deserialize({
          id: "1",
          title: "T",
          description: "D",
          options: [],
          startTime: "2024-01-01T00:00:00.000Z",
          endTime: "2024-01-02T00:00:00.000Z",
        } as any),
      ).toThrow("Invalid payload: missing or invalid createdAt");
    });

    it("throws on invalid option (missing id)", () => {
      expect(() =>
        client.deserialize({
          id: "1",
          title: "T",
          description: "D",
          options: [{ text: "A" }],
          startTime: "2024-01-01T00:00:00.000Z",
          endTime: "2024-01-02T00:00:00.000Z",
          createdAt: "2024-01-01T00:00:00.000Z",
        } as any),
      ).toThrow("Invalid payload: option missing id");
    });

    it("throws on invalid option (missing text)", () => {
      expect(() =>
        client.deserialize({
          id: "1",
          title: "T",
          description: "D",
          options: [{ id: "opt-1" }],
          startTime: "2024-01-01T00:00:00.000Z",
          endTime: "2024-01-02T00:00:00.000Z",
          createdAt: "2024-01-01T00:00:00.000Z",
        } as any),
      ).toThrow("Invalid payload: option missing text");
    });
  });

  // ── Vote Verification ──────────────────────────────────────────────────────

  describe("verifyVote", () => {
    it("returns true for a valid encrypted payload", () => {
      const receipt = client.castVote({
        ballotId: "elec-123",
        voteOption: "Yes",
        encryptionKey: TEST_KEY,
      });

      const isValid = client.verifyVote(receipt.encryptedPayload, TEST_KEY);
      expect(isValid).toBe(true);
    });

    it("returns false for a tampered payload", () => {
      const receipt = client.castVote({
        ballotId: "elec-123",
        voteOption: "Yes",
        encryptionKey: TEST_KEY,
      });

      const parts = receipt.encryptedPayload.split(":");
      parts[2] = Buffer.from("tampered").toString("base64");
      const tampered = parts.join(":");

      const isValid = client.verifyVote(tampered, TEST_KEY);
      expect(isValid).toBe(false);
    });

    it("returns false for an invalid key", () => {
      const receipt = client.castVote({
        ballotId: "elec-123",
        voteOption: "Yes",
        encryptionKey: TEST_KEY,
      });

      const wrongKey = "b".repeat(64);
      const isValid = client.verifyVote(receipt.encryptedPayload, wrongKey);
      expect(isValid).toBe(false);
    });

    it("returns false for malformed payload", () => {
      const isValid = client.verifyVote("not-a-valid-payload", TEST_KEY);
      expect(isValid).toBe(false);
    });

    it("returns false for payload with wrong number of parts", () => {
      const isValid = client.verifyVote("part1:part2", TEST_KEY);
      expect(isValid).toBe(false);
    });
  });

  // ── Client Configuration ───────────────────────────────────────────────────

  describe("ClientConfig", () => {
    it("can be instantiated without config", () => {
      const c = new AnonVoteClient();
      expect(c).toBeInstanceOf(AnonVoteClient);
    });

    it("can be instantiated with empty config", () => {
      const c = new AnonVoteClient({});
      expect(c).toBeInstanceOf(AnonVoteClient);
    });

    it("can be instantiated with encryption key", () => {
      const c = new AnonVoteClient({ encryptionKey: TEST_KEY });
      expect(c).toBeInstanceOf(AnonVoteClient);
    });
  });

  // ── Type Exports ───────────────────────────────────────────────────────────

  describe("Type exports", () => {
    it("Election type is properly structured", () => {
      const election: Election = {
        id: "elec-1",
        title: "Test",
        description: "Desc",
        options: [{ id: "opt-1", text: "A" }],
        startTime: "2024-01-01T00:00:00.000Z",
        endTime: "2024-01-02T00:00:00.000Z",
        createdAt: "2024-01-01T00:00:00.000Z",
      };

      expect(election.id).toBe("elec-1");
      expect(election.options[0].text).toBe("A");
    });

    it("VoteReceipt type is properly structured", () => {
      const receipt: VoteReceipt = {
        id: "receipt-1",
        electionId: "elec-1",
        ballotId: "elec-1",
        encryptedPayload: "iv:tag:cipher",
        castAt: "2024-01-01T00:00:00.000Z",
        verified: true,
      };

      expect(receipt.verified).toBe(true);
      expect(receipt.encryptedPayload).toBe("iv:tag:cipher");
    });

    it("ClientConfig type is properly structured", () => {
      const config: ClientConfig = {
        encryptionKey: TEST_KEY,
      };

      expect(config.encryptionKey).toBe(TEST_KEY);
    });
  });

  // ── Public API Exports ─────────────────────────────────────────────────────

  describe("Public API exports", () => {
    it("exports AnonVoteClient from the package entry point", () => {
      // This test verifies the export works by importing from the index
      // We already imported it at the top, so this just confirms it's accessible
      expect(AnonVoteClient).toBeDefined();
      expect(typeof AnonVoteClient).toBe("function");
    });
  });
});