# Enclave Interface Specification

> Canonical docs site: https://github.com/AxiomInfra/axiom-core-docs

**Version:** 1.0  
**Platform:** AMD SEV-SNP  
**Last Updated:** 2026-01-21

**Status:** v1.0 interface for the native runner (simulator available; native runner required for hardware guarantees).

---

## Overview

This document specifies the interface between the Axiom Core (TypeScript) and the native enclave runner (Rust). The interface is designed to be minimal, deterministic, and security-focused.

## Interface Contract

### Input to Enclave

The native runner currently accepts a JSON payload (stringified) with the following structure:

```json
{
  "raw_context": ["..."],        // array of UTF-8 strings
  "task_hint": "optional string",
  "policy": {
    "version": "v1",
    "allow_common_words": true,
    "max_input_size": 10485760
  },
  "session_id": "hex-encoded 16 bytes",
  "config_hash": "hex-encoded 32 bytes",
  "nonce": "hex-encoded 32 bytes",
  "timestamp": 1710000000000
}
```

**Note:** `nonce` is included for forward compatibility; current report binding uses the timestamp instead.

### Output from Enclave

The native runner returns a JSON payload (stringified) with the following structure:

```json
{
  "transformed_context": {
    "entities": [
      { "id": "ENTITY_0000", "role": "Actor", "attributes": { "type": "name" } }
    ],
    "relations": [
      { "relation_type": "related", "from": "ENTITY_0000", "to": "ENTITY_0001" }
    ]
  },
  "output_hash": "hex-encoded sha256",
  "attestation_report": [0, 1, 2, ...],
  "redaction_stats": {
    "entity_count": 4,
    "relation_count": 3,
    "identifiers_replaced": 4
  },
  "measurement": "hex-encoded sha384 or simulator marker",
  "signature": [0, 1, 2, ...]
}
```

---

## Constraints & Properties

### Policy Limits (Native Runner)

| Parameter | Limit | Reason |
|-----------|-------|--------|
| Max input size | 10 MB | Memory safety, DoS prevention |
| Max task hint length | 256 bytes | Metadata only, prevent abuse |
| Session ID size | 128 bits (16 bytes) | Security standard |
| Config hash size | 256 bits (32 bytes) | SHA-256 |
| Output hash size | 256 bits (32 bytes) | SHA-256 |
| Nonce size | 256 bits (32 bytes) | Cryptographic freshness |

### Security Properties

The enclave **MUST**:

1. **No Filesystem Access**
   - All input comes from function parameters
   - All output returns through function results
   - No file open, read, write, or directory operations

2. **No Network Access**
   - No socket creation
   - No DNS lookups
   - No HTTP/HTTPS requests
   - Verified at link time (no network libraries)

3. **Memory Wiping**
   - Best-effort zeroing of sensitive buffers
   - Clear `raw_context` after transformation
   - Clear intermediate entity maps
   - Note: Cannot guarantee complete erasure due to compiler optimizations

4. **Deterministic Execution**
   - Same input → same output (except timestamps in attestation)
   - No randomness in transformation logic
   - Synthetic IDs generated deterministically

5. **Explicit Failure**
   - Return error on constraint violation
   - No silent truncation or degradation
   - Clear error codes

**Note:** These limits are enforced by the native runner; the TypeScript SDK forwards the policy values.

### Execution Environment

The enclave runs with the following environment:

- **No stdin/stdout/stderr** within enclave context
- **No environment variables** accessible
- **No system clock** (uses secure time source)
- **Isolated memory** encrypted by AMD SEV-SNP
- **Measurement** computed over enclave binary

---

## Transformation Pipeline (Internal)

The enclave implements the same semantic transformation as the TypeScript SDK:

```
┌─────────────────────┐
│  Raw Input (UTF-8)  │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│   Normalization     │
│  (clean whitespace) │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ Entity Extraction   │
│  (distiller logic)  │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  Role Assignment    │
│ (abstractor logic)  │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  Identifier Masking │
│   (masker logic)    │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ Canonical Serialize │
│    (no whitespace)  │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  Compute Hash       │
│    (SHA-256)        │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ Generate Attestation│
│  (AMD SEV-SNP API)  │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  Return Output      │
└─────────────────────┘
```

---

## Attestation Binding

### Custom Data in Attestation Report

The attestation report includes custom data binding the execution:

```
report_data = SHA-256(
    session_id || config_hash || output_hash || timestamp
)
```

This 32-byte value is embedded in the `REPORT_DATA` field of the SEV-SNP attestation report; the verifier compares the first 32 bytes of `report_data` to the expected hash.

### Verification Flow

```
1. Verifier receives (transformed_context, attestation_evidence)
2. Verifier parses attestation report
3. Verifier validates report structure/signature presence → platformAuth (chain validation TBD)
4. Verifier checks measurement against registry → validates codeIdentity
5. Verifier recomputes output_hash from transformed_context
6. Verifier extracts report_data from attestation
7. Verifier verifies: report_data == SHA-256(sessionId || configHash || recomputed_output_hash || timestamp)
   → validates sessionBinding
8. Verifier checks timestamp freshness → validates freshness
9. All checks pass → verdict.valid = true
```

---

## Error Handling

### Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| `ENCLAVE_UNAVAILABLE` | AMD SEV-SNP not available | Fail if `enclave: required` |
| `TRANSFORM_FAILED` | Semantic transformation error | Return error with safe details |
| `ATTESTATION_FAILED` | Could not generate attestation | Return error |
| `INPUT_TOO_LARGE` | Input exceeds 10 MB | Reject immediately |
| `INVALID_CONFIG` | Policy or config malformed | Validate before entry |

### Error Response

```rust
struct EnclaveError {
    code: ErrorCode,
    message: String,
    // No raw input data in details
    details: Option<HashMap<String, serde_json::Value>>,
}
```

---

## IPC Protocol (TypeScript ↔ Rust)

### N-API Binding

The enclave runner exposes a single function that may be synchronous or async:

```typescript
// TypeScript side
function transform(requestJson: string): Promise<string> | string;
```

```rust
// Rust side (N-API)
#[napi]
fn transform(request: String) -> Result<String> {
    // Deserialize request
    // Call enclave
    // Serialize response
}
```

### Serialization Format

- **Request:** JSON string (current implementation)
- **Response:** JSON string (current implementation)
- **Attestation Report:** Byte array in JSON (`number[]`)

---

## AMD SEV-SNP Integration

### Platform APIs Used

1. **Guest Attestation Request**
   - `/dev/sev-guest` ioctl on Linux
   - `SNP_GET_REPORT` command
   - Embeds custom `report_data` (32 bytes)

2. **Measurement Retrieval**
   - Read from platform at runtime
   - Compare against expected measurement in registry

3. **Certificate Chain**
   - VCEK (Versioned Chip Endorsement Key)
   - ASK (AMD SEV Key)
   - ARK (AMD Root Key)

### Platform Requirements

- Linux kernel 5.19+ with SEV-SNP guest support
- AMD EPYC 7003 series (Milan) or newer
- SEV-SNP firmware enabled
- Guest OS running in confidential VM

---

## Testing Without Real Hardware

For development and testing, the SDK supports a **simulator mode**:

### Simulator Behavior

- Transformation runs in standard memory (no TEE)
- "Fake" attestation report generated with:
  - Mock measurement (clearly marked)
  - Mock signature (invalid for real verification)
  - Valid structure for parsing tests
- Simulator is detected via report header (`FAKE`) and `simulator_measurement_...`

### Simulator Usage

```typescript
const axiom = new Axiom({
  securityTier: "attested",
  enclave: "auto", // Falls back to simulator if no real TEE
  platform: {
    type: "sev-snp",
    verificationMode: "permissive", // Accept simulator in dev
  },
});
```

**WARNING:** Simulator provides NO security guarantees. For testing only.

---

## Performance Expectations

### Latency

| Input Size | Expected Latency | Notes |
|------------|------------------|-------|
| 1 KB | < 10 ms | Fast path |
| 100 KB | < 50 ms | Typical document |
| 1 MB | < 200 ms | Large document |
| 10 MB | < 2 seconds | Maximum size |

### Throughput

- **Sequential:** ~5-10 requests/sec (single enclave instance)
- **Parallel:** ~20-50 requests/sec (multiple instances, if supported)

### Memory

- **Enclave size:** ~50 MB static + input size
- **Peak memory:** 2x input size during transformation

---

## Version Compatibility

### v1.0 Interface Stability

The v1.0 interface is **stable** for:
- Input/output structure
- Error codes
- Security properties

### Breaking Changes (Future)

Future versions (v2.0+) may add:
- Additional platforms (Intel TDX, Apple SE)
- New policy fields (backwards compatible)
- Enhanced attestation formats

Breaking changes will increment major version.

---

## Security Considerations

### Threat Model

See [security.md](security.md) for full threat model.

**What the enclave protects against:**
- Host OS inspection of transformation
- Network attacker tampering
- Malicious SDK user bypassing boundaries

**What the enclave does NOT protect against:**
- Physical hardware attacks
- Side-channel attacks (baseline mitigations only)
- Fully compromised firmware

### Best Practices

1. **Validate measurement** before trusting output
2. **Check timestamp freshness** (< 5 minutes old)
3. **Verify signature chain** to AMD root (planned; not yet implemented)
4. **Use dedicated hardware** for stronger isolation (preview)
5. **Keep platform updated** (firmware, microcode)

---

## Example Usage

### TypeScript Side

```typescript
import { createEnclaveBridge } from "../src/runtime/enclave-bridge.ts";
import type { EnclaveRequest } from "../src/attestation/types.ts";

const bridge = await createEnclaveBridge(true, true);

const request: EnclaveRequest = {
  rawContext: new TextEncoder().encode("Sensitive data here"),
  taskHint: "analyze",
  policy: {
    version: "v1",
    allowCommonWords: true,
    maxInputSize: 10 * 1024 * 1024,
  },
  sessionId: crypto.getRandomValues(new Uint8Array(16)),
  configHash: "abc123...",
  nonce: crypto.getRandomValues(new Uint8Array(32)),
  timestamp: Date.now(),
};

const response = await bridge.execute(request);

console.log("Output hash:", Buffer.from(response.outputHash).toString("hex"));
console.log("Measurement:", response.measurement);
```

---

**Document Status:** Specification  
**Implementation:** Rust enclave runner (private `axiom-enclave-runner` repo)  
**Review Cycle:** Before any interface changes

