import { describe, it } from "node:test";
import assert from "node:assert";
import { canonicalize, hash, verifyEquivalence, createDigest } from "../src/core/canonical.ts";
import type { TransformedContext } from "../src/core/config.ts";

describe("Canonical Serialization", () => {
  describe("Deterministic hashing", () => {
    it("should produce identical hash for identical input", () => {
      const context: TransformedContext = {
        entities: [
          {
            syntheticId: "ENTITY_0001",
            role: "Actor",
            attributes: { type: "name", position: 10 },
          },
        ],
        relations: [
          { type: "owns", from: "ENTITY_0001", to: "ENTITY_0002" },
        ],
        task: "analyze",
      };

      const hash1 = hash(context);
      const hash2 = hash(context);

      assert.strictEqual(hash1, hash2, "Same input should produce same hash");
    });

    it("should produce different hash for different input", () => {
      const context1: TransformedContext = {
        entities: [
          { syntheticId: "ENTITY_0001", role: "Actor", attributes: {} },
        ],
        relations: [],
        task: "task1",
      };

      const context2: TransformedContext = {
        entities: [
          { syntheticId: "ENTITY_0002", role: "Actor", attributes: {} },
        ],
        relations: [],
        task: "task2",
      };

      const hash1 = hash(context1);
      const hash2 = hash(context2);

      assert.notStrictEqual(
        hash1,
        hash2,
        "Different inputs should produce different hashes"
      );
    });

    it("should be sensitive to entity order after normalization", () => {
      // Note: Canonical serialization sorts entities, so order doesn't matter
      const context1: TransformedContext = {
        entities: [
          { syntheticId: "ENTITY_0001", role: "Actor", attributes: {} },
          { syntheticId: "ENTITY_0002", role: "Value", attributes: {} },
        ],
        relations: [],
        task: "test",
      };

      const context2: TransformedContext = {
        entities: [
          { syntheticId: "ENTITY_0002", role: "Value", attributes: {} },
          { syntheticId: "ENTITY_0001", role: "Actor", attributes: {} },
        ],
        relations: [],
        task: "test",
      };

      const hash1 = hash(context1);
      const hash2 = hash(context2);

      // Should be SAME because canonical serialization sorts
      assert.strictEqual(
        hash1,
        hash2,
        "Entity order should not affect hash after canonicalization"
      );
    });
  });

  describe("Stable entity ordering", () => {
    it("should sort entities by syntheticId", () => {
      const context: TransformedContext = {
        entities: [
          { syntheticId: "ENTITY_0003", role: "Actor", attributes: {} },
          { syntheticId: "ENTITY_0001", role: "Actor", attributes: {} },
          { syntheticId: "ENTITY_0002", role: "Actor", attributes: {} },
        ],
        relations: [],
        task: "test",
      };

      const canonical = canonicalize(context);
      const parsed = JSON.parse(canonical);

      assert.strictEqual(parsed.entities[0].syntheticId, "ENTITY_0001");
      assert.strictEqual(parsed.entities[1].syntheticId, "ENTITY_0002");
      assert.strictEqual(parsed.entities[2].syntheticId, "ENTITY_0003");
    });
  });

  describe("Stable relation ordering", () => {
    it("should sort relations by (from, to, type)", () => {
      const context: TransformedContext = {
        entities: [],
        relations: [
          { type: "owns", from: "ENTITY_0002", to: "ENTITY_0003" },
          { type: "owns", from: "ENTITY_0001", to: "ENTITY_0002" },
          { type: "references", from: "ENTITY_0001", to: "ENTITY_0003" },
        ],
        task: "test",
      };

      const canonical = canonicalize(context);
      const parsed = JSON.parse(canonical);

      // Should be sorted by from, then to, then type
      assert.strictEqual(parsed.relations[0].from, "ENTITY_0001");
      assert.strictEqual(parsed.relations[0].to, "ENTITY_0002");
      assert.strictEqual(parsed.relations[1].from, "ENTITY_0001");
      assert.strictEqual(parsed.relations[1].to, "ENTITY_0003");
    });
  });

  describe("Number normalization", () => {
    it("should normalize -0 to 0", () => {
      const context1: TransformedContext = {
        entities: [
          {
            syntheticId: "ENTITY_0001",
            role: "Value",
            attributes: { value: -0 },
          },
        ],
        relations: [],
        task: "test",
      };

      const context2: TransformedContext = {
        entities: [
          {
            syntheticId: "ENTITY_0001",
            role: "Value",
            attributes: { value: 0 },
          },
        ],
        relations: [],
        task: "test",
      };

      assert.strictEqual(hash(context1), hash(context2));
    });

    it("should handle floating point precision consistently", () => {
      const context: TransformedContext = {
        entities: [
          {
            syntheticId: "ENTITY_0001",
            role: "Value",
            attributes: { value: 1.23456789012345 },
          },
        ],
        relations: [],
        task: "test",
      };

      const hash1 = hash(context);
      const hash2 = hash(context);

      assert.strictEqual(hash1, hash2);
    });
  });

  describe("Canonical JSON format", () => {
    it("should have no whitespace", () => {
      const context: TransformedContext = {
        entities: [
          { syntheticId: "ENTITY_0001", role: "Actor", attributes: {} },
        ],
        relations: [],
        task: "test",
      };

      const canonical = canonicalize(context);

      assert.ok(!canonical.includes(" "), "Should not contain spaces");
      assert.ok(!canonical.includes("\n"), "Should not contain newlines");
      assert.ok(!canonical.includes("\t"), "Should not contain tabs");
    });

    it("should have alphabetically sorted keys", () => {
      const context: TransformedContext = {
        entities: [
          {
            syntheticId: "ENTITY_0001",
            role: "Actor",
            attributes: { z: "last", a: "first", m: "middle" },
          },
        ],
        relations: [],
        task: "test",
      };

      const canonical = canonicalize(context);
      const parsed = JSON.parse(canonical);

      const keys = Object.keys(parsed.entities[0].attributes);
      assert.deepStrictEqual(keys, ["a", "m", "z"]);
    });
  });

  describe("verifyEquivalence", () => {
    it("should return true for identical contexts", () => {
      const context: TransformedContext = {
        entities: [
          { syntheticId: "ENTITY_0001", role: "Actor", attributes: {} },
        ],
        relations: [],
        task: "test",
      };

      assert.strictEqual(verifyEquivalence(context, context), true);
    });

    it("should return true for semantically identical contexts", () => {
      const context1: TransformedContext = {
        entities: [
          { syntheticId: "ENTITY_0002", role: "Value", attributes: {} },
          { syntheticId: "ENTITY_0001", role: "Actor", attributes: {} },
        ],
        relations: [],
        task: "test",
      };

      const context2: TransformedContext = {
        entities: [
          { syntheticId: "ENTITY_0001", role: "Actor", attributes: {} },
          { syntheticId: "ENTITY_0002", role: "Value", attributes: {} },
        ],
        relations: [],
        task: "test",
      };

      assert.strictEqual(verifyEquivalence(context1, context2), true);
    });

    it("should return false for different contexts", () => {
      const context1: TransformedContext = {
        entities: [
          { syntheticId: "ENTITY_0001", role: "Actor", attributes: {} },
        ],
        relations: [],
        task: "test1",
      };

      const context2: TransformedContext = {
        entities: [
          { syntheticId: "ENTITY_0001", role: "Actor", attributes: {} },
        ],
        relations: [],
        task: "test2",
      };

      assert.strictEqual(verifyEquivalence(context1, context2), false);
    });
  });

  describe("createDigest", () => {
    it("should create digest with hash and metadata", () => {
      const context: TransformedContext = {
        entities: [
          { syntheticId: "ENTITY_0001", role: "Actor", attributes: {} },
          { syntheticId: "ENTITY_0002", role: "Value", attributes: {} },
        ],
        relations: [{ type: "owns", from: "ENTITY_0001", to: "ENTITY_0002" }],
        task: "test",
      };

      const digest = createDigest(context);

      assert.ok(digest.hash);
      assert.strictEqual(digest.entityCount, 2);
      assert.strictEqual(digest.relationCount, 1);
      assert.ok(digest.timestamp > 0);
    });

    it("should produce consistent hashes in digest", () => {
      const context: TransformedContext = {
        entities: [
          { syntheticId: "ENTITY_0001", role: "Actor", attributes: {} },
        ],
        relations: [],
        task: "test",
      };

      const digest1 = createDigest(context);
      const digest2 = createDigest(context);

      assert.strictEqual(digest1.hash, digest2.hash);
      assert.strictEqual(digest1.entityCount, digest2.entityCount);
      assert.strictEqual(digest1.relationCount, digest2.relationCount);
    });
  });

  describe("Hash format", () => {
    it("should produce 64-character hex string", () => {
      const context: TransformedContext = {
        entities: [],
        relations: [],
        task: "test",
      };

      const h = hash(context);

      assert.strictEqual(h.length, 64, "SHA-256 should be 64 hex characters");
      assert.match(h, /^[0-9a-f]{64}$/, "Should be lowercase hex");
    });
  });
});

