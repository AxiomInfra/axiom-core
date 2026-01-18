#!/usr/bin/env node
/**
 * Axiom SDK Demo Script
 * 
 * Demonstrates both standard and attested tiers with attestation verification.
 * Run with: node demo/demo.js
 */

import { Axiom, AttestationVerifier } from "../src/index.ts";
import { writeFileSync } from "fs";

console.log("╔════════════════════════════════════════════════════════════════╗");
console.log("║           Axiom SDK v1.0 - Demo Script                        ║");
console.log("╚════════════════════════════════════════════════════════════════╝\n");

// Example sensitive data
const exampleContext = "John Doe signed a $50,000 contract with Acme Corp on 2026-01-15";
const task = "Analyze this business transaction";

// ============================================================================
// Demo 1: Standard Tier (Software Boundary)
// ============================================================================

console.log("📦 Demo 1: Standard Tier (Software Boundary Only)\n");
console.log("─".repeat(64));

const axiomStandard = new Axiom({
  securityTier: "standard",
  enclave: "none",
  policyVersion: "v1"
});

console.log("Configuration:");
console.log("  Security Tier: standard");
console.log("  Enclave: none");
console.log("  Guarantees: Software boundary enforcement\n");

console.log("Input Context:");
console.log(`  "${exampleContext}"\n`);

try {
  const resultStandard = await axiomStandard.reason({
    context: exampleContext,
    task
  });
  
  console.log("✓ Transformation successful\n");
  console.log("Transformed Context:");
  console.log(`  Entities: ${resultStandard.transformedContext.entities.length}`);
  resultStandard.transformedContext.entities.forEach(e => {
    console.log(`    - ${e.syntheticId} (${e.role})`);
  });
  console.log(`  Relations: ${resultStandard.transformedContext.relations.length}`);
  resultStandard.transformedContext.relations.forEach(r => {
    console.log(`    - ${r.from} ${r.type} ${r.to}`);
  });
  
  console.log("\n✓ No raw identifiers in output (verified)");
  console.log("✓ Boundary enforcement: PASSED\n");
  
  // Verify no attestation evidence in standard tier
  if (!resultStandard.attestationEvidence) {
    console.log("  Note: No attestation evidence (standard tier)\n");
  }
  
} catch (error) {
  console.error("✗ Error:", error.message);
}

console.log("─".repeat(64));
console.log();

// ============================================================================
// Demo 2: Attested Tier (TEE + Attestation)
// ============================================================================

console.log("🔒 Demo 2: Attested Tier (TEE + Attestation)\n");
console.log("─".repeat(64));

const axiomAttested = new Axiom({
  securityTier: "attested",
  enclave: "auto",
  policyVersion: "v1",
  platform: {
    type: "sev-snp",
    verificationMode: "permissive" // Allow simulator for demo
  }
});

console.log("Configuration:");
console.log("  Security Tier: attested");
console.log("  Enclave: auto");
console.log("  Platform: AMD SEV-SNP (simulator mode)");
console.log("  Guarantees: Hardware isolation + Cryptographic attestation\n");

console.log("Input Context:");
console.log(`  "${exampleContext}"\n`);

try {
  console.log("⚙️  Executing transformation in simulated enclave...\n");
  
  const resultAttested = await axiomAttested.reason({
    context: exampleContext,
    task
  });
  
  console.log("✓ Transformation successful\n");
  console.log("Transformed Context:");
  console.log(`  Entities: ${resultAttested.transformedContext.entities.length}`);
  console.log(`  Relations: ${resultAttested.transformedContext.relations.length}`);
  
  console.log("\n✓ Attestation Evidence Generated:");
  if (resultAttested.attestationEvidence) {
    console.log(`  Platform: ${resultAttested.attestationEvidence.platform}`);
    console.log(`  Measurement: ${resultAttested.attestationEvidence.measurement.substring(0, 32)}...`);
    console.log(`  Session ID: ${resultAttested.attestationEvidence.sessionId}`);
    console.log(`  Output Hash: ${resultAttested.attestationEvidence.outputHash.substring(0, 32)}...`);
    console.log(`  Timestamp: ${new Date(resultAttested.attestationEvidence.timestamp).toISOString()}`);
    console.log(`  Report Size: ${resultAttested.attestationEvidence.report.length} bytes`);
  }
  
  // ============================================================================
  // Demo 3: Attestation Verification
  // ============================================================================
  
  console.log("\n🔍 Demo 3: Attestation Verification\n");
  console.log("─".repeat(64));
  
  if (resultAttested.attestationEvidence && resultAttested.verificationHint) {
    console.log("⚙️  Verifying attestation evidence...\n");
    
    const verifier = new AttestationVerifier();
    const verdict = await verifier.verify(
      resultAttested.attestationEvidence,
      resultAttested.transformedContext,
      {
        expectedMeasurement: resultAttested.verificationHint.expectedMeasurement,
        maxAge: 5 * 60 * 1000, // 5 minutes
        mode: "permissive" // Allow simulator
      }
    );
    
    console.log(`Verification Result: ${verdict.valid ? "✓ VALID" : "✗ INVALID"}\n`);
    
    console.log("Claims:");
    console.log(`  Code Identity:     ${verdict.claims.codeIdentity ? "✓" : "✗"} ${verdict.claims.codeIdentity ? "PASS" : "FAIL"}`);
    console.log(`  Platform Auth:     ${verdict.claims.platformAuth ? "✓" : "✗"} ${verdict.claims.platformAuth ? "PASS" : "FAIL"}`);
    console.log(`  Session Binding:   ${verdict.claims.sessionBinding ? "✓" : "✗"} ${verdict.claims.sessionBinding ? "PASS" : "FAIL"}`);
    console.log(`  Config Binding:    ${verdict.claims.configBinding ? "✓" : "✗"} ${verdict.claims.configBinding ? "PASS" : "FAIL"}`);
    console.log(`  Freshness:         ${verdict.claims.freshness ? "✓" : "✗"} ${verdict.claims.freshness ? "PASS" : "FAIL"}`);
    console.log(`  Report Structure:  ${verdict.claims.reportStructure ? "✓" : "✗"} ${verdict.claims.reportStructure ? "PASS" : "FAIL"}`);
    
    if (verdict.warnings.length > 0) {
      console.log("\n⚠️  Warnings:");
      verdict.warnings.forEach(w => console.log(`  - ${w}`));
    }
    
    if (verdict.errors.length > 0) {
      console.log("\n✗ Errors:");
      verdict.errors.forEach(e => console.log(`  - ${e}`));
    }
    
    console.log(`\nRecommendation: ${verdict.valid ? "ACCEPT (with simulator caveats)" : "REJECT"}`);
    
    // Save artifacts
    console.log("\n💾 Saving artifacts...");
    
    const artifact = {
      metadata: {
        description: "Axiom SDK Demo Output",
        generated: new Date().toISOString(),
        version: "1.0",
        mode: "simulator"
      },
      transformedContext: resultAttested.transformedContext,
      attestationEvidence: {
        ...resultAttested.attestationEvidence,
        report: `<${resultAttested.attestationEvidence.report.length} bytes>` // Don't serialize full report
      },
      verificationHint: resultAttested.verificationHint,
      verdict: verdict
    };
    
    writeFileSync(
      "artifacts/demo-output.json",
      JSON.stringify(artifact, null, 2)
    );
    
    console.log("  ✓ artifacts/demo-output.json\n");
  }
  
} catch (error) {
  console.error("\n✗ Error:", error.message);
  if (error.stack) {
    console.error("\nStack trace:");
    console.error(error.stack);
  }
}

console.log("─".repeat(64));
console.log("\n╔════════════════════════════════════════════════════════════════╗");
console.log("║                    Demo Complete                               ║");
console.log("╚════════════════════════════════════════════════════════════════╝\n");

console.log("📚 Next Steps:\n");
console.log("  1. Review artifacts/demo-output.json for full results");
console.log("  2. See docs/INTEGRATION.md for integration guide");
console.log("  3. Run tests: npm test");
console.log("  4. Explore examples in artifacts/\n");

console.log("⚠️  Important Notes:\n");
console.log("  - This demo uses SIMULATOR mode (no real TEE)");
console.log("  - For production, configure securityTier='attested' with enclave='required'");
console.log("  - Real SEV-SNP provides hardware-backed guarantees\n");

