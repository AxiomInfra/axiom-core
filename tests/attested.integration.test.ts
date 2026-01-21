import { describe, it } from "node:test";
import assert from "node:assert";
import { Axiom } from "../src/core/axiom.ts";
import { AttestationVerifier } from "../src/attestation/verifier.ts";

describe("Attested end-to-end (simulator)", () => {
  it("should produce verifiable attestation evidence", async () => {
    const axiom = new Axiom({
      securityTier: "attested",
      enclave: "auto",
      policyVersion: "v1",
      platform: {
        type: "sev-snp",
        verificationMode: "permissive",
      },
    });

    const result = await axiom.reason({
      context: "Alice paid Bob $100 on Monday.",
      task: "summarize payment",
    });

    assert.ok(result.attestationEvidence, "Attestation evidence should be present");
    assert.ok(result.verificationHint?.expectedMeasurement, "Verification hint should be present");

    const verifier = new AttestationVerifier();
    const verdict = await verifier.verify(
      result.attestationEvidence,
      result.transformedContext,
      {
        expectedMeasurement: result.verificationHint?.expectedMeasurement,
        mode: "permissive",
      }
    );

    assert.strictEqual(verdict.valid, true, "Attestation should verify in simulator mode");
    assert.strictEqual(verdict.claims.sessionBinding, true);
  });
});

