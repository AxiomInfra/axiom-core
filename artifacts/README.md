# Axiom Core Example Artifacts

This directory contains example outputs from the Axiom Core v1.0 to demonstrate the attestation and verification workflow.

## Files

### 1. `example-evidence.json`

Complete example of a successful transformation with attestation evidence in simulator mode.

**Contains:**
- Original raw input (for demonstration only - avoid exposing in any environment)
- Transformed context with synthetic entities and relations
- Attestation evidence structure
- Verification hint
- Transformation statistics

**Use Case:** Understanding the full data flow from raw input to attested output.

### 2. `example-verdict.json`

Example of a **successful** verification verdict.

**Contains:**
- Overall verdict (valid: true)
- Individual claim results (all passing)
- Verification details for each claim
- Warnings (simulator mode)
- Recommended action (ACCEPT)

**Use Case:** Understanding what a valid attestation looks like.

### 3. `example-verdict-failure.json`

Example of a **failed** verification verdict showing multiple security failures.

**Contains:**
- Overall verdict (valid: false)
- Failed claims (measurement mismatch, binding failure, staleness)
- Detailed error messages
- Severity levels
- Recommended actions (REJECT + investigate)

**Use Case:** Understanding failure modes and how to respond to compromised attestations.

## How to Use These Examples

### Testing Integration

```typescript
import fs from 'fs';
import { AttestationVerifier } from '@axiom-infra/core';

// Load example evidence
const exampleData = JSON.parse(
  fs.readFileSync('artifacts/example-evidence.json', 'utf-8')
);

const verifier = new AttestationVerifier();

// Verify the evidence
const verdict = await verifier.verify(
  exampleData.attestationEvidence,
  exampleData.transformedContext,
  {
    expectedMeasurement: exampleData.verificationHint.expectedMeasurement,
    mode: 'permissive' // Allow simulator
  }
);

console.log('Verdict:', verdict.valid);
console.log('Claims:', verdict.claims);
```

### Understanding the Workflow

1. **Raw Input → Transformation**
   ```
   "John Doe signed a $50,000 contract..."
   
   ↓ (Axiom Core)
   
   ENTITY_0001 (Actor), ENTITY_0002 (Value), ...
   Relation: related(ENTITY_0001, ENTITY_0002)
   ```

2. **Transformation → Evidence**
   ```
   transformedContext + attestation report
   
   ↓ (Enclave)
   
   measurement, sessionId, outputHash, report
   ```

3. **Evidence → Verification**
   ```
   evidence + transformedContext + expectedMeasurement
   
   ↓ (AttestationVerifier)
   
   verdict with claims and recommendation
   ```

## Simulated vs. Real Attestation

### Simulator Mode (These Examples)

**Characteristics:**
- No real TEE execution
- Fake attestation reports
- Warnings in verification
- For development only

**Verdict Example:**
```json
{
  "valid": true,
  "warnings": ["Simulator report detected - no real platform authentication"],
  "security_level": "DEVELOPMENT_SIMULATOR"
}
```

### Real Hardware Mode (Preview)

**Characteristics:**
- Real TEE isolation
- Cryptographic attestation reports
- Hardware-backed isolation (preview)
- No warnings (if valid)

**Verdict Example:**
```json
{
  "valid": true,
  "warnings": [],
  "security_level": "PREVIEW_TEE"
}
```

## Security Notes

1. **Avoid Logging Raw Input**
   - `example-evidence.json` shows raw input for educational purposes only
- In real hardware runs, raw input is not expected to leave the enclave

2. **Verify Measurements from Trusted Source**
   - Always fetch `expectedMeasurement` from your secure registry
   - Never hardcode measurements in application code

3. **Handle Failures Appropriately**
   - Failed attestation = reject processing
   - Log incidents for security review
   - Never silently downgrade security

4. **Respect Freshness Limits**
   - Default: 5 minutes
   - Adjust based on your threat model
   - Expired attestations may indicate replay attacks

## Example Scenarios

### Scenario 1: Valid Attestation (Success)

```typescript
// Producer
const result = await axiom.reason({ context: sensitiveData, task });
await sendToCloud(result.transformedContext, result.attestationEvidence);

// Consumer
const verdict = await verifier.verify(evidence, context, options);
if (verdict.valid) {
  // ✓ Process data safely
  await processData(context);
}
```

**Outcome:** All claims pass, data is processed.

### Scenario 2: Measurement Mismatch (Failure)

```typescript
const verdict = await verifier.verify(evidence, context, {
  expectedMeasurement: "correct_measurement_abc123"
});

if (!verdict.valid && !verdict.claims.codeIdentity) {
  // ✗ Wrong binary or tampered enclave
  throw new Error("Untrusted execution environment");
}
```

**Outcome:** Reject data, investigate enclave integrity.

### Scenario 3: Output Tampering (Failure)

```typescript
// Attacker modifies transformedContext after transformation
const tamperedContext = { ...originalContext, entities: modified };

const verdict = await verifier.verify(evidence, tamperedContext, options);

if (!verdict.claims.sessionBinding) {
  // ✗ Output hash doesn't match evidence
  throw new Error("Data integrity violation detected");
}
```

**Outcome:** Tampering detected, reject data.

### Scenario 4: Replay Attack (Failure)

```typescript
// Attacker reuses old evidence with new context
const oldEvidence = { ...evidence, timestamp: Date.now() - 20 * 60 * 1000 };

const verdict = await verifier.verify(oldEvidence, context, {
  maxAge: 5 * 60 * 1000
});

if (!verdict.claims.freshness) {
  // ✗ Evidence is too old
  throw new Error("Stale attestation - possible replay attack");
}
```

**Outcome:** Replay detected, reject data.

## Generating Your Own Examples

### Demo Script (Standard + Attested Simulator)

```bash
npm install
npm run demo
# Outputs to artifacts/demo-output.json
```

If your shell blocks npm scripts:

```bash
node --experimental-strip-types demo/demo.js
```

### Attested Tier (Real SEV-SNP, Preview)

- Install the native enclave runner (`@axiom-infra/enclave-runner`).
- Update the demo config to `enclave: "required"`.
- Run the demo as above in a SEV-SNP VM.

## Questions?

- **Documentation:** See `docs/INTEGRATION.md` for integration guide
- **Issues:** https://github.com/Axiom-Infra/axiom-core/issues
- **Security:** security@axiominfra.cloud

---

**Last Updated:** 2026-01-21  
**Version:** 1.0.0

