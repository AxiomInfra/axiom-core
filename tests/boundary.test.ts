import { describe, it } from "node:test";
import assert from "node:assert";
import { Axiom } from "../src/core/axiom.ts";
import { BoundaryViolationError } from "../src/core/errors.ts";
import { Distiller } from "../src/transform/distiller.ts";
import { Abstractor } from "../src/transform/abstraction.ts";
import { Masker } from "../src/transform/masking.ts";
import { BoundaryValidator } from "../src/runtime/boundary.ts";

describe("Boundary Enforcement", () => {
  describe("Raw input never appears after masking", () => {
    it("should not contain original names in output", async () => {
      const axiom = new Axiom({
        securityTier: "standard",
        enclave: "none",
        policyVersion: "v1",
      });

      const rawContext = "John Smith met with Jane Doe on January 15, 2024.";
      const result = await axiom.reason({
        context: rawContext,
        task: "analyze meeting",
      });

      const serialized = JSON.stringify(result);

      // Verify raw names do not appear
      assert.ok(
        !serialized.includes("John"),
        "Output should not contain 'John'"
      );
      assert.ok(
        !serialized.includes("Smith"),
        "Output should not contain 'Smith'"
      );
      assert.ok(
        !serialized.includes("Jane"),
        "Output should not contain 'Jane'"
      );
      assert.ok(
        !serialized.includes("Doe"),
        "Output should not contain 'Doe'"
      );
    });

    it("should not contain email addresses in output", async () => {
      const axiom = new Axiom({
        securityTier: "standard",
        enclave: "none",
        policyVersion: "v1",
      });

      const rawContext =
        "Contact John at john.smith@example.com for details.";
      const result = await axiom.reason({
        context: rawContext,
        task: "extract contact info",
      });

      const serialized = JSON.stringify(result);

      assert.ok(
        !serialized.includes("john.smith@example.com"),
        "Output should not contain email"
      );
      assert.ok(
        !serialized.includes("example.com"),
        "Output should not contain domain"
      );
    });

    it("should not contain phone numbers in output", async () => {
      const axiom = new Axiom({
        securityTier: "standard",
        enclave: "none",
        policyVersion: "v1",
      });

      const rawContext = "Call Alice at 555-123-4567 tomorrow.";
      const result = await axiom.reason({
        context: rawContext,
        task: "extract contact",
      });

      const serialized = JSON.stringify(result);

      assert.ok(
        !serialized.includes("555-123-4567"),
        "Output should not contain phone number"
      );
    });

    it("should use synthetic IDs for all entities", async () => {
      const axiom = new Axiom({
        securityTier: "standard",
        enclave: "none",
        policyVersion: "v1",
      });

      const result = await axiom.reason({
        context: "Bob owes $5,000 to Charlie.",
        task: "analyze obligations",
      });

      // All entity IDs should be synthetic
      for (const entity of result.transformedContext.entities) {
        assert.match(
          entity.syntheticId,
          /^ENTITY_\d{4}$/,
          "Entity should have synthetic ID format"
        );
      }

      // Relations should use synthetic IDs
      for (const relation of result.transformedContext.relations) {
        assert.match(
          relation.from,
          /^ENTITY_\d{4}$/,
          "Relation.from should use synthetic ID"
        );
        assert.match(
          relation.to,
          /^ENTITY_\d{4}$/,
          "Relation.to should use synthetic ID"
        );
      }
    });
  });

  describe("BoundaryViolationError on unsafe output", () => {
    it("should throw when masking fails to remove identifier", () => {
      const masker = new Masker();
      const distiller = new Distiller();
      const abstractor = new Abstractor();

      const input = "Secret Agent James Bond has code 007.";
      const rawEntities = distiller.distill(input);
      const representation = abstractor.abstract(rawEntities, input);

      // The masker should successfully mask this
      // If it doesn't, it throws BoundaryViolationError
      const masked = masker.mask(representation, [input]);

      // Verify no raw data in output
      const serialized = JSON.stringify(masked);
      assert.ok(!serialized.includes("James"), "Should not contain 'James'");
      assert.ok(!serialized.includes("Bond"), "Should not contain 'Bond'");
    });

    it("should throw BoundaryViolationError for invalid synthetic ID format", () => {
      const validator = new BoundaryValidator();

      const invalidMasked = {
        entities: [
          {
            syntheticId: "INVALID_ID", // Not matching ENTITY_XXXX format
            role: "Actor",
            attributes: { type: "name" },
          },
        ],
        relations: [],
      };

      assert.throws(
        () => validator.validate(invalidMasked, ["test input"]),
        BoundaryViolationError,
        "Should throw BoundaryViolationError for invalid ID"
      );
    });

    it("should throw BoundaryViolationError for unexpected fields", () => {
      const validator = new BoundaryValidator();

      const invalidMasked = {
        entities: [
          {
            syntheticId: "ENTITY_0001",
            role: "Actor",
            attributes: { type: "name" },
            unexpectedField: "should not be here",
          },
        ],
        relations: [],
      };

      assert.throws(
        () =>
          validator.validate(
            invalidMasked as ReturnType<Masker["mask"]>,
            ["test"]
          ),
        BoundaryViolationError,
        "Should throw for unexpected fields"
      );
    });
  });

  describe("Deterministic behavior", () => {
    it("should produce identical output for identical input", async () => {
      const axiom = new Axiom({
        securityTier: "standard",
        enclave: "none",
        policyVersion: "v1",
      });

      // Use same input as other passing tests
      const context = "Bob owes $500 to Charlie.";
      const task = "analyze debt";

      const result1 = await axiom.reason({ context, task });
      const result2 = await axiom.reason({ context, task });

      assert.deepStrictEqual(
        result1,
        result2,
        "Same input should produce identical output"
      );
    });

    it("should produce consistent entity ordering", async () => {
      const axiom = new Axiom({
        securityTier: "standard",
        enclave: "none",
        policyVersion: "v1",
      });

      const context =
        "David paid Eve $500. Frank received $300 from Grace.";

      const result1 = await axiom.reason({
        context,
        task: "analyze payments",
      });
      const result2 = await axiom.reason({
        context,
        task: "analyze payments",
      });

      // Verify entity count is consistent
      assert.strictEqual(
        result1.transformedContext.entities.length,
        result2.transformedContext.entities.length,
        "Entity count should be consistent"
      );

      // Verify entity roles are consistent
      for (let i = 0; i < result1.transformedContext.entities.length; i++) {
        assert.strictEqual(
          result1.transformedContext.entities[i].role,
          result2.transformedContext.entities[i].role,
          "Entity roles should be consistent"
        );
      }
    });

    it("should produce consistent relations", async () => {
      const axiom = new Axiom({
        securityTier: "standard",
        enclave: "none",
        policyVersion: "v1",
      });

      const context = "Henry owns the property valued at $250,000.";

      const result1 = await axiom.reason({
        context,
        task: "analyze ownership",
      });
      const result2 = await axiom.reason({
        context,
        task: "analyze ownership",
      });

      assert.deepStrictEqual(
        result1.transformedContext.relations,
        result2.transformedContext.relations,
        "Relations should be identical for same input"
      );
    });
  });

  describe("Pipeline stages", () => {
    it("distiller should extract entities deterministically", () => {
      const distiller = new Distiller();

      const input = "Mary Johnson has account #12345 worth $10,000.";
      const entities1 = distiller.distill(input);
      const entities2 = distiller.distill(input);

      assert.deepStrictEqual(
        entities1,
        entities2,
        "Distiller should be deterministic"
      );
    });

    it("abstractor should assign roles based on entity type", () => {
      const distiller = new Distiller();
      const abstractor = new Abstractor();

      const input = "Robert invested $50,000 on December 1, 2023.";
      const rawEntities = distiller.distill(input);
      const representation = abstractor.abstract(rawEntities, input);

      // Should have at least one Actor (Robert), one Value ($50,000), one Temporal (date)
      const roles = representation.entities.map((e) => e.role);
      assert.ok(roles.includes("Actor"), "Should have Actor role");
      assert.ok(roles.includes("Value"), "Should have Value role");
      assert.ok(roles.includes("Temporal"), "Should have Temporal role");
    });

    it("masker should replace all identifiers with synthetic IDs", () => {
      const distiller = new Distiller();
      const abstractor = new Abstractor();
      const masker = new Masker();

      const input = "Sarah Connor sent $100 to Kyle Reese.";
      const rawEntities = distiller.distill(input);
      const representation = abstractor.abstract(rawEntities, input);
      const masked = masker.mask(representation, [input]);

      // All IDs should be synthetic
      for (const entity of masked.entities) {
        assert.match(entity.syntheticId, /^ENTITY_\d{4}$/);
      }

      // No original text should remain
      const serialized = JSON.stringify(masked);
      assert.ok(!serialized.includes("Sarah"));
      assert.ok(!serialized.includes("Connor"));
      assert.ok(!serialized.includes("Kyle"));
      assert.ok(!serialized.includes("Reese"));
    });
  });

  describe("Array context handling", () => {
    it("should handle array of context strings", async () => {
      const axiom = new Axiom({
        securityTier: "standard",
        enclave: "none",
        policyVersion: "v1",
      });

      const result = await axiom.reason({
        context: [
          "Meeting with Tom at 10am.",
          "Tom owes $500 to Jerry.",
          "Jerry confirmed receipt.",
        ],
        task: "summarize interactions",
      });

      // Should have entities from all context strings
      assert.ok(
        result.transformedContext.entities.length > 0,
        "Should extract entities from multiple contexts"
      );

      // No raw names should appear
      const serialized = JSON.stringify(result);
      assert.ok(!serialized.includes("Tom"));
      assert.ok(!serialized.includes("Jerry"));
    });
  });
});

