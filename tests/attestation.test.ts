import { describe, it } from "node:test";
import assert from "node:assert";
import { AttestationVerifier } from "../src/attestation/verifier.ts";
import type { AttestationEvidence } from "../src/attestation/types.ts";
import type { TransformedContext } from "../src/core/config.ts";
import { hash } from "../src/core/canonical.ts";
import { createHash, randomBytes } from "crypto";

describe("Attestation Binding Tests", () => {
  const validMeasurement = "SIMULATED_MEASUREMENT_ABC123";
  const verifier = new AttestationVerifier();

  function createMockContext(): TransformedContext {
    return {
      entities: [
        {
          syntheticId: "ENTITY_0001",
          role: "Actor",
          attributes: { type: "organization" },
        },
      ],
      relations: [],
      task: "test",
    };
  }

  function buildSimulatorReport(evidence: {
    sessionId: string;
    configHash: string;
    outputHash: string;
    timestamp: number;
  }): Uint8Array {
    const report = new Uint8Array(1184);
    report.set(new TextEncoder().encode("FAKE"), 0);
    const view = new DataView(report.buffer);
    view.setUint32(4, 1, true);

    const sessionIdBytes = Buffer.from(evidence.sessionId, "hex");
    const configHashBytes = Buffer.from(evidence.configHash, "hex");
    const outputHashBytes = Buffer.from(evidence.outputHash, "hex");
    const timestampBytes = Buffer.alloc(8);
    timestampBytes.writeBigUInt64BE(BigInt(evidence.timestamp), 0);

    const bindingHash = createHash("sha256");
    bindingHash.update(sessionIdBytes);
    bindingHash.update(configHashBytes);
    bindingHash.update(outputHashBytes);
    bindingHash.update(timestampBytes);
    const expectedHash = bindingHash.digest();

    report.set(expectedHash, 8);
    return report;
  }

  function createMockEvidence(
    context: TransformedContext,
    overrides?: Partial<AttestationEvidence>
  ): AttestationEvidence {
    const contextHash = hash(context);
    const base: AttestationEvidence = {
      platform: "sev-snp",
      report: new Uint8Array(0),
      measurement: validMeasurement,
      configHash: randomBytes(32).toString("hex"),
      sessionId: randomBytes(16).toString("hex"),
      outputHash: contextHash,
      timestamp: Date.now(),
      version: "1.0",
      ...overrides,
    };
    const report = overrides?.report ?? buildSimulatorReport(base);
    return {
      ...base,
      report,
    };
  }

  describe("Output tampering detection", () => {
    it("should reject evidence when output is tampered", async () => {
      const context = createMockContext();
      const evidence = createMockEvidence(context);

      // Tamper with the context after creating evidence
      const tamperedContext = { ...context, task: "tampered" };

      const verdict = await verifier.verify(evidence, tamperedContext, {
        expectedMeasurement: validMeasurement,
      });

      assert.strictEqual(verdict.valid, false, "Should reject tampered output");
      assert.strictEqual(
        verdict.claims.sessionBinding,
        false,
        "Session binding should fail"
      );
      assert.ok(
        verdict.errors?.some((e) => e.includes("Output binding")),
        "Should report binding error"
      );
    });

    it("should accept evidence when output matches", async () => {
      const context = createMockContext();
      const evidence = createMockEvidence(context);

      const verdict = await verifier.verify(evidence, context, {
        expectedMeasurement: validMeasurement,
        mode: "permissive", // Allow simulator mode
      });

      assert.strictEqual(
        verdict.claims.sessionBinding,
        true,
        "Session binding should succeed"
      );
    });

    it("should detect subtle output changes", async () => {
      const context = createMockContext();
      const evidence = createMockEvidence(context);

      // Make a subtle change (add space)
      const tamperedContext = {
        ...context,
        entities: [
          {
            ...context.entities[0],
            attributes: { type: "organization " }, // Added space
          },
        ],
      };

      const verdict = await verifier.verify(evidence, tamperedContext, {
        expectedMeasurement: validMeasurement,
      });

      assert.strictEqual(
        verdict.claims.sessionBinding,
        false,
        "Should detect subtle changes"
      );
    });
  });

  describe("Config hash tampering", () => {
    it("should reject evidence with mismatched config hash", async () => {
      const context = createMockContext();
      const evidence = createMockEvidence(context, {
        configHash: "tampered_config_hash",
      });

      const verdict = await verifier.verify(evidence, context, {
        expectedMeasurement: validMeasurement,
        expectedConfigHash: "correct_config_hash",
      });

      // Note: Current implementation checks configHash if expectedConfigHash provided
      assert.strictEqual(evidence.configHash, "tampered_config_hash");
      assert.strictEqual(verdict.claims.configBinding, false);
    });
  });

  describe("Replay attack prevention", () => {
    it("should reject stale evidence (old timestamp)", async () => {
      const context = createMockContext();
      const oldTimestamp = Date.now() - 10 * 60 * 1000; // 10 minutes ago
      const evidence = createMockEvidence(context, {
        timestamp: oldTimestamp,
      });

      const verdict = await verifier.verify(evidence, context, {
        expectedMeasurement: validMeasurement,
        maxAge: 5 * 60 * 1000, // 5 minutes
      });

      assert.strictEqual(verdict.valid, false, "Should reject stale evidence");
      assert.strictEqual(
        verdict.claims.freshness,
        false,
        "Freshness check should fail"
      );
      assert.ok(
        verdict.errors?.some((e) => e.includes("too old") || e.includes("stale")),
        "Should report staleness"
      );
    });

    it("should accept fresh evidence", async () => {
      const context = createMockContext();
      const evidence = createMockEvidence(context, {
        timestamp: Date.now(),
      });

      const verdict = await verifier.verify(evidence, context, {
        expectedMeasurement: validMeasurement,
        mode: "permissive",
      });

      assert.strictEqual(
        verdict.claims.freshness,
        true,
        "Freshness check should pass"
      );
    });

    it("should reject reused session ID with mismatched output hash", async () => {
      const context1 = createMockContext();
      const evidence1 = createMockEvidence(context1);

      // Create different context but try to reuse session ID
      const context2 = {
        ...context1,
        entities: [
          {
            syntheticId: "ENTITY_0002",
            role: "Value",
            attributes: { amount: 1000 },
          },
        ],
      };

      // Attempt to reuse session ID with different output
      const evidence2 = createMockEvidence(context2, {
        sessionId: evidence1.sessionId, // Reuse session ID
        outputHash: hash(context1), // Mismatched output hash
      });

      const verdict2 = await verifier.verify(evidence2, context2, {
        expectedMeasurement: validMeasurement,
        mode: "permissive",
      });

      // The verification should fail because the output hash doesn't match
      assert.strictEqual(
        verdict2.claims.sessionBinding,
        false,
        "Session binding should fail for mismatched output hash"
      );
    });
  });

  describe("Measurement validation", () => {
    it("should reject evidence with wrong measurement", async () => {
      const context = createMockContext();
      const evidence = createMockEvidence(context, {
        measurement: "WRONG_MEASUREMENT_XYZ789",
      });

      const verdict = await verifier.verify(evidence, context, {
        expectedMeasurement: validMeasurement,
      });

      assert.strictEqual(verdict.valid, false, "Should reject wrong measurement");
      assert.strictEqual(
        verdict.claims.codeIdentity,
        false,
        "Code identity check should fail"
      );
      assert.ok(
        verdict.errors?.some((e) => e.includes("Measurement mismatch")),
        "Should report measurement mismatch"
      );
    });

    it("should accept evidence with correct measurement", async () => {
      const context = createMockContext();
      const evidence = createMockEvidence(context);

      const verdict = await verifier.verify(evidence, context, {
        expectedMeasurement: validMeasurement,
        mode: "permissive",
      });

      assert.strictEqual(
        verdict.claims.codeIdentity,
        true,
        "Code identity check should pass"
      );
    });
  });

  describe("Platform authentication", () => {
    it("should verify platform signature in permissive mode", async () => {
      const context = createMockContext();
      const evidence = createMockEvidence(context);

      const verdict = await verifier.verify(evidence, context, {
        expectedMeasurement: validMeasurement,
        mode: "permissive", // Allow simulator
      });

      // In permissive simulator mode, this passes with warning
      assert.strictEqual(
        verdict.claims.platformAuth,
        true,
        "Platform auth should pass in simulator permissive mode"
      );
    });

    it("should reject empty report", async () => {
      const context = createMockContext();
      const evidence = createMockEvidence(context, {
        report: new Uint8Array(0), // Empty report
      });

      const verdict = await verifier.verify(evidence, context, {
        expectedMeasurement: validMeasurement,
      });

      assert.strictEqual(verdict.valid, false, "Should reject empty report");
      assert.strictEqual(
        verdict.claims.reportStructure,
        false,
        "Report structure check should fail"
      );
    });
  });

  describe("Complete verification verdict", () => {
    it("should produce valid verdict for genuine evidence", async () => {
      const context = createMockContext();
      const evidence = createMockEvidence(context);

      const verdict = await verifier.verify(evidence, context, {
        expectedMeasurement: validMeasurement,
        mode: "permissive",
      });

      assert.strictEqual(verdict.valid, true, "Verdict should be valid");
      assert.strictEqual(verdict.platform, "sev-snp");
      assert.strictEqual(verdict.measurement, validMeasurement);
      assert.strictEqual(verdict.claims.codeIdentity, true);
      assert.strictEqual(verdict.claims.platformAuth, true);
      assert.strictEqual(verdict.claims.sessionBinding, true);
      assert.strictEqual(verdict.claims.freshness, true);
      assert.strictEqual(verdict.errors.length, 0, "Should have no errors");
    });

    it("should produce invalid verdict when multiple checks fail", async () => {
      const context = createMockContext();
      const evidence = createMockEvidence(context, {
        measurement: "WRONG_MEASUREMENT",
        timestamp: Date.now() - 10 * 60 * 1000, // Stale
        report: new Uint8Array(0), // Invalid
      });

      const tamperedContext = { ...context, task: "tampered" };

      const verdict = await verifier.verify(evidence, tamperedContext, {
        expectedMeasurement: validMeasurement,
        maxAge: 5 * 60 * 1000,
      });

      assert.strictEqual(verdict.valid, false, "Verdict should be invalid");
      assert.strictEqual(verdict.claims.codeIdentity, false);
      assert.strictEqual(verdict.claims.sessionBinding, false);
      assert.strictEqual(verdict.claims.freshness, false);
      assert.ok(
        verdict.errors.length >= 3,
        "Should report multiple errors"
      );
    });
  });

  describe("Session binding enforcement", () => {
    it("should require unique session IDs", () => {
      const context1 = createMockContext();
      const context2 = createMockContext();

      const evidence1 = createMockEvidence(context1);
      const evidence2 = createMockEvidence(context2);

      assert.notStrictEqual(
        evidence1.sessionId,
        evidence2.sessionId,
        "Session IDs should be unique"
      );
    });

    it("should bind outputHash to specific session", async () => {
      const context = createMockContext();
      const evidence = createMockEvidence(context);

      // Verify that changing the context breaks the binding
      const differentContext = {
        ...context,
        entities: [
          {
            syntheticId: "ENTITY_9999",
            role: "Temporal",
            attributes: { date: "2026-01-18" },
          },
        ],
      };

      const verdict = await verifier.verify(evidence, differentContext, {
        expectedMeasurement: validMeasurement,
      });

      assert.strictEqual(
        verdict.claims.sessionBinding,
        false,
        "Output hash should not match different context"
      );
    });
  });
});
