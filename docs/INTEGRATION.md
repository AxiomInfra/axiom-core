# Axiom Core Integration Guide

> Canonical docs site: https://github.com/AxiomInfra/axiom-core-docs

**Version:** 1.0  
**Last Updated:** 2026-01-21  
**Audience:** Developers integrating Axiom Core into applications

**Note:** Attested execution is opt-in and requires the native enclave runner. Simulator mode provides no security guarantees.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Installation](#installation)
3. [Basic Usage](#basic-usage)
4. [Configuration Options](#configuration-options)
5. [Security Tiers](#security-tiers)
6. [Attestation & Verification](#attestation--verification)
7. [LLM Integration Patterns](#llm-integration-patterns)
8. [Error Handling](#error-handling)
9. [Testing Strategies](#testing-strategies)
10. [Deployment Patterns](#deployment-patterns)
11. [Performance Considerations](#performance-considerations)
12. [Troubleshooting](#troubleshooting)
13. [Best Practices](#best-practices)

---

## Quick Start

### 30-Second Example

```typescript
import { Axiom } from "@axiom-infra/core";

// Initialize SDK
const axiom = new Axiom({
  securityTier: "standard",
  enclave: "none",
  policyVersion: "v1"
});

// Transform sensitive context
const result = await axiom.reason({
  context: "John Doe signed a $50,000 contract with Acme Corp on 2026-01-15",
  task: "Analyze this business transaction"
});

// Use transformed context (no personal identifiers)
console.log(result.transformedContext);
// {
//   entities: [
//     { syntheticId: "ENTITY_0000", role: "Actor", attributes: { type: "name", position: 0 } },
//     { syntheticId: "ENTITY_0001", role: "Actor", attributes: { type: "name", position: 38 } },
//     { syntheticId: "ENTITY_0002", role: "Value", attributes: { type: "currency", position: 20, numericValue: 50000 } },
//     { syntheticId: "ENTITY_0003", role: "Temporal", attributes: { type: "date", position: 62 } }
//   ],
//   relations: [
//     { type: "related", from: "ENTITY_0000", to: "ENTITY_0001" },
//     { type: "owns", from: "ENTITY_0000", to: "ENTITY_0002" },
//     { type: "dated", from: "ENTITY_0002", to: "ENTITY_0003" }
//   ],
//   task: "Analyze this business transaction"
// }
```

---

## Installation

### NPM

```bash
npm install @axiom-infra/core
```

### Yarn

```bash
yarn add @axiom-infra/core
```

### From Source

```bash
git clone https://github.com/Axiom-Infra/axiom-core.git
cd axiom-core
npm install
npm run build
```

---

## Basic Usage

### 1. Import and Initialize

```typescript
import { Axiom } from "@axiom-infra/core";
import type { AxiomConfig, ReasonInput, ReasonResult } from "@axiom-infra/core";

const config: AxiomConfig = {
  securityTier: "standard",
  enclave: "none",
  policyVersion: "v1"
};

const axiom = new Axiom(config);
```

### 2. Transform Context

```typescript
const input: ReasonInput = {
  context: "Your sensitive data here",
  task: "What you want to do with it",
  model: "gpt-4" // Optional hint (SDK doesn't call model)
};

try {
  const result: ReasonResult = await axiom.reason(input);
  
  // Use result.transformedContext
  console.log("Entities:", result.transformedContext.entities);
  console.log("Relations:", result.transformedContext.relations);
} catch (error) {
  // Handle errors (see Error Handling section)
}
```

### 3. Multiple Contexts

```typescript
const result = await axiom.reason({
  context: [
    "First document with sensitive data",
    "Second document with more data",
    "Third document..."
  ],
  task: "Aggregate analysis"
});
```

---

## Configuration Options

### Security Tiers

| Tier | Description | Enclave Required | Attestation | Use Case |
|---|---|---|---|---|
| `"standard"` | Software boundary only | No | No | Development, non-sensitive |
| `"attested"` | Hardware-backed TEE (preview) | Yes | Yes | Hardware testing, sensitive data (preview) |

### Enclave Modes

| Mode | Behavior | Standard Tier | Attested Tier |
|---|---|---|---|
| `"none"` | Never use enclave | Always software-only | Invalid config |
| `"auto"` | Prefer native enclave; fallback to simulator | Always software-only | Native if available, otherwise simulator |
| `"required"` | Must use native enclave | Always software-only | Fail if native unavailable |

**Note:** In the current implementation, `enclave` is only used when `securityTier` is `"attested"`. Standard tier always runs the software pipeline.

**Native runner:** The native enclave path requires the optional dependency `@axiom-infra/enclave-runner` to be installed.

### Platform Options

```typescript
const config: AxiomConfig = {
  securityTier: "attested",
  enclave: "required",
  policyVersion: "v1",
  platform: {
    type: "sev-snp",              // Currently only SEV-SNP supported
    verificationMode: "strict"    // or "permissive" (consumer policy)
  }
};
```

**Verification Modes:**
- `"strict"`: All claims must pass (stricter verification; preview)
- `"permissive"`: Allow warnings (development, simulator)

**Note:** `platform.verificationMode` is a configuration hint for consumers; it is not enforced by the SDK.

---

## Security Tiers

### Standard Tier (Software Boundary)

**When to Use:**
- Development and testing
- Non-sensitive data
- Environments without TEE hardware

**Properties:**
- Software boundary enforcement
- Raw text detection
- Deterministic output
- No hardware isolation
- No attestation

**Example:**

```typescript
const axiom = new Axiom({
  securityTier: "standard",
  enclave: "none",
  policyVersion: "v1"
});

const result = await axiom.reason({
  context: "User data",
  task: "Process"
});

// No attestation evidence
console.log(result.attestationEvidence); // undefined
```

### Attested Tier (Hardware-Backed)

**When to Use:**
- Hardware-backed testing with sensitive data (preview)
- Customer-controlled confidential VMs (preview)

**Properties (preview):**
- TEE isolation (AMD SEV-SNP)
- Cryptographic attestation
- Verifiable execution
- Hardware boundary enforcement

**Simulator fallback (auto mode):**
- If the native enclave runner is unavailable and `enclave: "auto"`, the SDK uses a simulator.
- Simulator reports are marked and should only be accepted in permissive verification.

**Example:**

```typescript
const axiom = new Axiom({
  securityTier: "attested",
  enclave: "required",
  policyVersion: "v1",
  platform: {
    type: "sev-snp",
    verificationMode: "strict"
  }
});

const result = await axiom.reason({
  context: "Sensitive user data",
  task: "Process securely"
});

// Attestation evidence available
console.log(result.attestationEvidence.measurement);
console.log(result.attestationEvidence.sessionId);
console.log(result.attestationEvidence.outputHash);
```

---

## Attestation & Verification

### Producing Evidence

```typescript
import { Axiom } from "@axiom-infra/core";

const axiom = new Axiom({
  securityTier: "attested",
  enclave: "required",
  policyVersion: "v1"
});

const result = await axiom.reason({
  context: "Sensitive data",
  task: "Transform"
});

if (result.attestationEvidence) {
  // Send both to consumer/cloud
  const payload = {
    transformedContext: result.transformedContext,
    evidence: {
      platform: result.attestationEvidence.platform,
      measurement: result.attestationEvidence.measurement,
      sessionId: result.attestationEvidence.sessionId,
      outputHash: result.attestationEvidence.outputHash,
      configHash: result.attestationEvidence.configHash,
      timestamp: result.attestationEvidence.timestamp,
      version: result.attestationEvidence.version,
      report: Buffer.from(result.attestationEvidence.report).toString("base64"),
      signature: result.attestationEvidence.signature
        ? Buffer.from(result.attestationEvidence.signature).toString("base64")
        : undefined
    },
    verificationHint: result.verificationHint
  };
  
  // Send payload to cloud service
  await sendToCloud(payload);
}
```

### Verifying Evidence

```typescript
import { AttestationVerifier } from "@axiom-infra/core";
import type { AttestationEvidence, TransformedContext } from "@axiom-infra/core";

// Receiver side (cloud service or customer)
async function verifyAndProcess(payload: any) {
  const verifier = new AttestationVerifier();
  
  // Reconstruct evidence
  const evidence: AttestationEvidence = {
    platform: payload.evidence.platform,
    measurement: payload.evidence.measurement,
    sessionId: payload.evidence.sessionId,
    outputHash: payload.evidence.outputHash,
    timestamp: payload.evidence.timestamp,
    report: Uint8Array.from(Buffer.from(payload.evidence.report, "base64")),
    configHash: payload.evidence.configHash,
    signature: payload.evidence.signature
      ? Uint8Array.from(Buffer.from(payload.evidence.signature, "base64"))
      : undefined,
    version: "1.0"
  };
  
  const context: TransformedContext = payload.transformedContext;
  
  // Verify attestation
  const verdict = await verifier.verify(evidence, context, {
    expectedMeasurement: payload.verificationHint.expectedMeasurement,
    maxAge: 5 * 60 * 1000, // 5 minutes
    mode: "strict"
  });
  
  if (verdict.valid) {
    console.log("Attestation verified");
    console.log("  Code Identity:", verdict.claims.codeIdentity);
    console.log("  Platform Auth:", verdict.claims.platformAuth);
    console.log("  Session Binding:", verdict.claims.sessionBinding);
    console.log("  Freshness:", verdict.claims.freshness);
    
    // Safe to process transformed context
    await processTransformedContext(context);
  } else {
    console.error("Attestation verification failed");
    console.error("Errors:", verdict.errors);
    throw new Error("Untrusted transformation");
  }
}
```

**Simulator detection:** Simulator reports are marked with a `FAKE` report header and a `simulator_measurement_...` value. Treat simulator evidence as non-production and verify only in permissive mode.

### Verification Options

```typescript
const verdict = await verifier.verify(evidence, context, {
  // Required: Expected measurement from trusted registry
  expectedMeasurement: "abc123...",
  
  // Optional: Expected config hash
  expectedConfigHash: "def456...",
  
  // Optional: Maximum age (default 5 minutes)
  maxAge: 10 * 60 * 1000,
  
  // Optional: Verification mode (default "strict")
  mode: "strict",
  
  // Optional: Custom nonce for freshness (not yet implemented)
  nonce: "custom_nonce_value",
  
  // Optional: Skip signature chain validation
  validateSignatureChain: false
});
```

**Note:** Signature chain validation is a placeholder in the current verifier implementation; it checks report structure but does not yet validate the full AMD certificate chain.

---

## LLM Integration Patterns

### Pattern 1: Direct Integration

```typescript
import { Axiom } from "@axiom-infra/core";
import { OpenAI } from "openai";

const axiom = new Axiom({
  securityTier: "attested",
  enclave: "required",
  policyVersion: "v1"
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function secureReasoning(userInput: string) {
  // Transform sensitive context
  const result = await axiom.reason({
    context: userInput,
    task: "Analyze and provide insights"
  });
  
  // Build prompt from transformed context
  const prompt = buildPrompt(result.transformedContext);
  
  // Call LLM with de-identified context
  const completion = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      { role: "system", content: "You are analyzing de-identified semantic data." },
      { role: "user", content: prompt }
    ]
  });
  
  return {
    response: completion.choices[0].message.content,
    attestation: result.attestationEvidence
  };
}

function buildPrompt(context: TransformedContext): string {
  // Convert transformed context to natural language prompt
  const entityDescriptions = context.entities.map(e => 
    `${e.syntheticId} (${e.role}): ${JSON.stringify(e.attributes)}`
  ).join("\n");
  
  const relationDescriptions = context.relations.map(r =>
    `${r.from} ${r.type} ${r.to}`
  ).join("\n");
  
  return `
Task: ${context.task}

Entities:
${entityDescriptions}

Relations:
${relationDescriptions}

Analyze these relationships and provide insights.
  `.trim();
}
```

### Pattern 2: Middleware Wrapper

```typescript
import { Axiom } from "@axiom-infra/core";

class SecureAIClient {
  private axiom: Axiom;
  private llmClient: any;
  
  constructor(llmClient: any, axiomConfig: AxiomConfig) {
    this.axiom = new Axiom(axiomConfig);
    this.llmClient = llmClient;
  }
  
  async chat(messages: Array<{role: string; content: string}>) {
    // Extract user content
    const userContent = messages
      .filter(m => m.role === "user")
      .map(m => m.content)
      .join("\n");
    
    // Transform via Axiom
    const result = await this.axiom.reason({
      context: userContent,
      task: "General chat"
    });
    
    // Replace user content with transformed version
    const transformedMessages = messages.map(msg => {
      if (msg.role === "user") {
        return {
          role: msg.role,
          content: this.renderTransformedContext(result.transformedContext)
        };
      }
      return msg;
    });
    
    // Call LLM
    const response = await this.llmClient.chat(transformedMessages);
    
    return {
      response,
      attestation: result.attestationEvidence
    };
  }
  
  private renderTransformedContext(context: TransformedContext): string {
    // Custom rendering logic
    return JSON.stringify(context, null, 2);
  }
}

// Usage
const secureClient = new SecureAIClient(openai, {
  securityTier: "attested",
  enclave: "required",
  policyVersion: "v1"
});

const result = await secureClient.chat([
  { role: "user", content: "John Doe owes $5000 to Jane Smith" }
]);
```

### Pattern 3: Batch Processing

```typescript
async function batchSecureProcessing(documents: string[]) {
  const axiom = new Axiom({
    securityTier: "attested",
    enclave: "required",
    policyVersion: "v1"
  });
  
  // Transform all documents
  const results = await Promise.all(
    documents.map(doc => 
      axiom.reason({
        context: doc,
        task: "Extract key information"
      })
    )
  );
  
  // Aggregate transformed contexts
  const aggregated = {
    entities: results.flatMap(r => r.transformedContext.entities),
    relations: results.flatMap(r => r.transformedContext.relations),
    attestations: results.map(r => r.attestationEvidence)
  };
  
  return aggregated;
}
```

---

## Error Handling

### Error Types

```typescript
import {
  BoundaryViolationError,
  TransformationError,
  ConfigurationError,
  SecurityInvariantError
} from "@axiom-infra/core";

try {
  const result = await axiom.reason({ context, task });
} catch (error) {
  if (error instanceof BoundaryViolationError) {
    // Raw data leaked through masking
    console.error("Security boundary violated:", error.message);
    // Log incident, alert security team
    
  } else if (error instanceof TransformationError) {
    // Semantic transformation failed
    console.error("Transformation failed:", error.message);
    // Retry with simplified input or different approach
    
  } else if (error instanceof ConfigurationError) {
    // Invalid SDK configuration
    console.error("Configuration error:", error.message);
    // Fix configuration and retry
    
  } else if (error instanceof SecurityInvariantError) {
    // Critical security assumption violated
    console.error("Security invariant violated:", error.message);
    // Stop processing, investigate immediately
    
  } else {
    // Unexpected error
    console.error("Unexpected error:", error);
    throw error;
  }
}
```

### Verification Errors

```typescript
const verdict = await verifier.verify(evidence, context, options);

if (!verdict.valid) {
  console.error("Verification failed:");
  
  if (!verdict.claims.codeIdentity) {
    console.error("  Code measurement mismatch");
    // Possible tampering or wrong binary version
  }
  
  if (!verdict.claims.platformAuth) {
    console.error("  Platform authentication failed");
    // Invalid signature chain or compromised platform
  }
  
  if (!verdict.claims.sessionBinding) {
    console.error("  Output not bound to session");
    // Output was tampered with after transformation
  }
  
  if (!verdict.claims.freshness) {
    console.error("  Attestation too old");
    // Possible replay attack
  }
  
  verdict.errors.forEach(err => console.error("  -", err));
  
  // Reject processing
  throw new Error("Attestation verification failed");
}
```

---

## Testing Strategies

### Unit Testing

```typescript
import { describe, it, expect } from "your-test-framework";
import { Axiom } from "@axiom-infra/core";

describe("Axiom Integration", () => {
  it("should transform context without leaking identifiers", async () => {
    const axiom = new Axiom({
      securityTier: "standard",
      enclave: "none",
      policyVersion: "v1"
    });
    
    const result = await axiom.reason({
      context: "Alice sent $100 to Bob",
      task: "Analyze transaction"
    });
    
    const output = JSON.stringify(result.transformedContext);
    
    // Verify no raw identifiers in output
    expect(output).not.toContain("Alice");
    expect(output).not.toContain("Bob");
    
    // Verify entities present
    expect(result.transformedContext.entities.length).toBeGreaterThan(0);
  });
});
```

### Integration Testing (Simulator Mode)

```typescript
describe("Attested Tier (Simulator)", () => {
  it("should produce attestation evidence", async () => {
    const axiom = new Axiom({
      securityTier: "attested",
      enclave: "auto",
      policyVersion: "v1",
      platform: {
        type: "sev-snp",
        verificationMode: "permissive" // Allow simulator
      }
    });
    
    const result = await axiom.reason({
      context: "Sensitive data",
      task: "Transform"
    });
    
    expect(result.attestationEvidence).toBeDefined();
    expect(result.attestationEvidence?.platform).toBe("sev-snp");
    expect(result.attestationEvidence?.measurement).toBeTruthy();
    expect(result.attestationEvidence?.sessionId).toBeTruthy();
    expect(result.attestationEvidence?.outputHash).toBeTruthy();
  });
  
  it("should verify attestation in permissive mode", async () => {
    const axiom = new Axiom({
      securityTier: "attested",
      enclave: "auto",
      policyVersion: "v1",
      platform: { type: "sev-snp", verificationMode: "permissive" }
    });
    
    const result = await axiom.reason({
      context: "Data",
      task: "Transform"
    });
    
    const verifier = new AttestationVerifier();
    const verdict = await verifier.verify(
      result.attestationEvidence!,
      result.transformedContext,
      {
        expectedMeasurement: result.verificationHint!.expectedMeasurement,
        mode: "permissive"
      }
    );
    
    expect(verdict.valid).toBe(true);
    expect(verdict.warnings).toContain(expect.stringContaining("Simulator"));
  });
});
```

### End-to-End Testing

```typescript
describe("LLM Integration E2E", () => {
  it("should complete full secure reasoning flow", async () => {
    const axiom = new Axiom({
      securityTier: "standard",
      enclave: "none",
      policyVersion: "v1"
    });
    
    // Transform
    const result = await axiom.reason({
      context: "John Doe signed a contract for $50,000 with Acme Corp",
      task: "Summarize key points"
    });
    
    // Build prompt
    const prompt = `Entities: ${JSON.stringify(result.transformedContext.entities)}`;
    
    // Mock LLM call
    const mockLLMResponse = await mockLLM.complete(prompt);
    
    // Verify no leakage in LLM prompt
    expect(prompt).not.toContain("John Doe");
    expect(prompt).not.toContain("Acme Corp");
    
    // Verify response
    expect(mockLLMResponse).toBeTruthy();
  });
});
```

---

## Deployment Patterns

### Pattern 1: Confidential VM (Enterprise)

**Architecture:**
```
[Client App] → [Axiom Core] → [Enclave Runner in SEV-SNP VM]
                    ↓
            [Transformed Context + Evidence]
                    ↓
         [Cloud LLM] ← [Customer Verifies Evidence]
```

**Setup:**

1. **Provision SEV-SNP VM** (Azure, AWS, or on-premise)
   ```bash
   # Example: Azure Confidential VM
   az vm create \
     --resource-group myResourceGroup \
     --name axiom-sev-vm \
     --image "Canonical:0001-com-ubuntu-confidential-vm-focal:20_04-lts-cvm:latest" \
     --size Standard_DC4as_v5 \
     --security-type ConfidentialVM
   ```

2. **Install Axiom Core**
   ```bash
   npm install @axiom-infra/core
   ```

3. **Configure for Attested Tier**
   ```typescript
   const axiom = new Axiom({
     securityTier: "attested",
     enclave: "required",
     policyVersion: "v1",
     platform: {
       type: "sev-snp",
       verificationMode: "strict"
     }
   });
   ```

4. **Deploy Application**
   ```bash
   # Build and deploy
   npm run build
   node dist/app.js
   ```

### Pattern 2: Serverless (Standard Tier)

**Architecture:**
```
[API Gateway] → [Lambda Function with Axiom] → [LLM API]
```

**Example (AWS Lambda):**

```typescript
// lambda/handler.ts
import { Axiom } from "@axiom-infra/core";

const axiom = new Axiom({
  securityTier: "standard",
  enclave: "none",
  policyVersion: "v1"
});

export const handler = async (event: any) => {
  try {
    const { userInput, task } = JSON.parse(event.body);
    
    const result = await axiom.reason({
      context: userInput,
      task
    });
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        transformedContext: result.transformedContext
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
```

### Pattern 3: Microservice

**Docker Compose:**

```yaml
version: '3.8'
services:
  axiom-service:
    build: .
    environment:
      - AXIOM_SECURITY_TIER=standard
      - AXIOM_ENCLAVE=none
    ports:
      - "3000:3000"
    volumes:
      - ./config:/app/config
```

**Express Service:**

```typescript
import express from "express";
import { Axiom } from "@axiom-infra/core";

const app = express();
app.use(express.json());

const axiom = new Axiom({
  securityTier: process.env.AXIOM_SECURITY_TIER as any || "standard",
  enclave: process.env.AXIOM_ENCLAVE as any || "none",
  policyVersion: "v1"
});

app.post("/transform", async (req, res) => {
  try {
    const { context, task } = req.body;
    const result = await axiom.reason({ context, task });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => console.log("Axiom service running on :3000"));
```

---

## Performance Considerations

### Expected Latencies (v1.0)

| Operation | Latency | Notes |
|---|---|---|
| Configuration | <1ms | One-time cost |
| Local transformation (100 entities) | ~10ms | Pure JS/TS |
| Canonical serialization | ~2ms | SHA-256 hashing |
| Session creation | <1ms | Random generation |
| Enclave IPC (simulator) | ~50ms | Development mode |
| Attestation verification | ~20ms | Signature validation |

### Optimization Tips

1. **Reuse Axiom Instance**
   ```typescript
   // Good: Reuse
   const axiom = new Axiom(config);
   const result1 = await axiom.reason(input1);
   const result2 = await axiom.reason(input2);
   
   // Bad: Recreate each time
   const result1 = await new Axiom(config).reason(input1);
   const result2 = await new Axiom(config).reason(input2);
   ```

2. **Batch Related Contexts**
   ```typescript
   // Better for multiple related documents
   const result = await axiom.reason({
     context: [doc1, doc2, doc3],
     task: "Aggregate analysis"
   });
   ```

3. **Async Verification**
   ```typescript
   // Don't block on verification if not critical path
   const verificationPromise = verifier.verify(evidence, context, options);
   
   // Do other work
   const processed = await processTransformedContext(context);
   
   // Check verification when needed
   const verdict = await verificationPromise;
   ```

---

## Troubleshooting

### Issue: Configuration Error

**Error:**
```
ConfigurationError: Invalid configuration: securityTier "attested" requires enclave to be "auto" or "required"
```

**Solution:**
```typescript
// Invalid
const axiom = new Axiom({
  securityTier: "attested",
  enclave: "none",  // ← Error
  policyVersion: "v1"
});

// Valid
const axiom = new Axiom({
  securityTier: "attested",
  enclave: "required",  // ← Fixed
  policyVersion: "v1"
});
```

### Issue: Boundary Violation

**Error:**
```
BoundaryViolationError: Raw identifier leaked through masking: detected in output
```

**Cause:** Raw identifiers not properly masked (possible bug in masking logic)

**Solution:**
- Report issue with example input
- Use standard tier for development
- Verify input doesn't contain extremely unusual patterns

### Issue: Verification Fails

**Error:**
```
Verdict: { valid: false, errors: ["Measurement mismatch: ..."] }
```

**Debugging:**
1. Check expected measurement matches actual
   ```typescript
   console.log("Expected:", options.expectedMeasurement);
   console.log("Actual:", evidence.measurement);
   ```

2. Verify measurement registry is up-to-date
   ```bash
   cat measurements.json
   ```

3. Use permissive mode for debugging
   ```typescript
   const verdict = await verifier.verify(evidence, context, {
     mode: "permissive"
   });
   console.log("Warnings:", verdict.warnings);
   ```

### Issue: Enclave Unavailable

**Error:**
```
ConfigurationError: Enclave execution required but not available
```

**Solutions:**

1. Check enclave runner is installed (for native mode)
  ```bash
  ls node_modules/@axiom-infra/enclave-runner/
  ```

2. Use simulator mode for development (auto mode)
   ```typescript
   const axiom = new Axiom({
     securityTier: "attested",
     enclave: "auto",
     policyVersion: "v1",
     platform: {
       type: "sev-snp",
       verificationMode: "permissive"  // Allow simulator
     }
   });
   ```

3. Fall back to standard tier
   ```typescript
   const axiom = new Axiom({
     securityTier: "standard",
     enclave: "none",
     policyVersion: "v1"
   });
   ```

---

## Best Practices

### 1. Configuration Management

```typescript
// config/axiom.ts
import type { AxiomConfig } from "@axiom-infra/core";

export function getAxiomConfig(): AxiomConfig {
  const env = process.env.NODE_ENV;
  
  if (env === "attested-preview") {
    return {
      securityTier: "attested",
      enclave: "required",
      policyVersion: "v1",
      platform: {
        type: "sev-snp",
        verificationMode: "strict"
      }
    };
  } else {
    return {
      securityTier: "standard",
      enclave: "none",
      policyVersion: "v1"
    };
  }
}
```

### 2. Error Logging (Safe)

```typescript
import { BoundaryViolationError } from "@axiom-infra/core";

try {
  const result = await axiom.reason({ context, task });
} catch (error) {
  if (error instanceof BoundaryViolationError) {
    // NEVER log the actual context or identifiers
    console.error("Boundary violation detected", {
      timestamp: Date.now(),
      task: task, // Safe to log (no PII)
      errorType: error.name
      // DO NOT log: context, error.message (may contain identifiers)
    });
    
    // Alert security team
    await alertSecurityTeam({
      incident: "boundary_violation",
      timestamp: Date.now()
    });
  }
}
```

### 3. Attestation Evidence Handling

```typescript
// DO: Store evidence securely
async function storeEvidence(evidence: AttestationEvidence) {
  await database.secureStore({
    sessionId: evidence.sessionId,
    measurement: evidence.measurement,
    outputHash: evidence.outputHash,
    timestamp: evidence.timestamp,
    // Store report as encrypted blob
    report: await encrypt(evidence.report)
  });
}

// DON'T: Log full evidence (contains sensitive report data)
// console.log("Evidence:", evidence); // ← BAD
```

### 4. Input Validation

```typescript
function validateInput(context: string | string[]): void {
  const maxSize = 10 * 1024 * 1024; // 10 MB
  
  const totalSize = Array.isArray(context)
    ? context.join("").length
    : context.length;
  
  if (totalSize > maxSize) {
    throw new Error(`Input too large: ${totalSize} bytes (max: ${maxSize})`);
  }
  
  if (totalSize === 0) {
    throw new Error("Input cannot be empty");
  }
}

// Usage
validateInput(userInput);
const result = await axiom.reason({ context: userInput, task });
```

### 5. Measurement Updates

```typescript
// Load expected measurements from trusted registry
async function getExpectedMeasurement(version: string): Promise<string> {
  // Fetch from your secure measurement registry
  const response = await fetch(`https://measurements.yourcompany.com/axiom/${version}`);
  const data = await response.json();
  
  // Verify signature on measurement manifest
  await verifyManifestSignature(data);
  
  return data.measurement;
}

// Use in verification
const expectedMeasurement = await getExpectedMeasurement("1.0.0");
const verdict = await verifier.verify(evidence, context, {
  expectedMeasurement
});
```

---

## Support & Resources

- **Documentation:** [https://docs.axiominfra.cloud](https://docs.axiominfra.cloud)
- **GitHub:** [https://github.com/Axiom-Infra](https://github.com/Axiom-Infra)
- **Issues:** [https://github.com/Axiom-Infra/axiom-core/issues](https://github.com/Axiom-Infra/axiom-core/issues)
- **Security:** security@axiominfra.cloud
- **Enterprise:** enterprise@axiominfra.cloud

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-21

