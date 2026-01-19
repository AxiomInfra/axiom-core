# Enclave Interface Specification

**Version:** 1.0.0  
**Platform:** AMD SEV-SNP  
**Last Updated:** 2026-01-18

---

## Overview

This document specifies the interface between the Axiom SDK (TypeScript) and the native enclave runner (Rust). The interface is designed to be minimal, deterministic, and security-focused.

## Interface Contract

### Input to Enclave

The enclave accepts the following inputs:

```rust
struct EnclaveInput {
    /// Raw context to transform (UTF-8 encoded)
    /// Max size: 10 MB (10,485,760 bytes)
    raw_context: Vec<u8>,
    
    /// Task hint (optional, should be non-sensitive)
    /// Max length: 256 bytes
    task_hint: Option<String>,
    
    /// Masking policy parameters
    policy: MaskingPolicy,
    
    /// Session ID for this execution (128-bit random)
    session_id: [u8; 16],
    
    /// Configuration hash (SHA-256)
    config_hash: [u8; 32],
    
    /// Random nonce for freshness (256-bit)
    nonce: [u8; 32],
}

struct MaskingPolicy {
    /// Policy version (must be "v1")
    version: String,
    
    /// Whether to allow common words in output
    allow_common_words: bool,
    
    /// Maximum input size enforcement
    max_input_size: usize,
}
```

### Output from Enclave

The enclave produces the following outputs:

```rust
struct EnclaveOutput {
    /// Transformed context (canonical JSON, UTF-8 encoded)
    transformed_context: Vec<u8>,
    
    /// SHA-256 hash of transformed_context
    output_hash: [u8; 32],
    
    /// Raw AMD SEV-SNP attestation report
    attestation_report: Vec<u8>,
    
    /// Redaction statistics (counts only, no content)
    redaction_stats: RedactionStats,
    
    /// Measurement of this enclave binary (SHA-384)
    measurement: String,
    
    /// Optional ECDSA signature over (session_id || config_hash || output_hash)
    signature: Option<Vec<u8>>,
}

struct RedactionStats {
    /// Number of entities extracted
    entity_count: usize,
    
    /// Number of relations built
    relation_count: usize,
    
    /// Number of identifiers replaced with synthetic IDs
    identifiers_replaced: usize,
}
```

---

## Constraints & Guarantees

### Hard Limits

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

This 32-byte value is embedded in the `REPORT_DATA` field of the SEV-SNP attestation report.

### Verification Flow

```
1. Verifier receives (transformed_context, attestation_evidence)
2. Verifier parses attestation report
3. Verifier validates AMD signature chain → validates platformAuth
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
    details: Option<HashMap<String, String>>,
}
```

---

## IPC Protocol (TypeScript ↔ Rust)

### N-API Binding

The enclave runner exposes a single synchronous function:

```typescript
// TypeScript side
function nativeTransform(request: EnclaveRequest): EnclaveResponse;
```

```rust
// Rust side (N-API)
#[napi]
fn native_transform(request: Buffer) -> Result<Buffer> {
    // Deserialize request
    // Call enclave
    // Serialize response
}
```

### Serialization Format

- **Request:** MessagePack or JSON (compact binary preferred)
- **Response:** MessagePack or JSON
- **Attestation Report:** Raw bytes (no encoding)

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
- Explicitly labeled `"platform": "sev-snp-simulator"`

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
- Security guarantees

### Breaking Changes (Future)

Future versions (v2.0+) may add:
- Additional platforms (Intel TDX, Apple SE)
- New policy fields (backwards compatible)
- Enhanced attestation formats

Breaking changes will increment major version.

---

## Security Considerations

### Threat Model

See [SECURITY.md](../SECURITY.md) for full threat model.

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
3. **Verify signature chain** to AMD root
4. **Use dedicated hardware** for production
5. **Keep platform updated** (firmware, microcode)

---

## Example Usage

### TypeScript Side

```typescript
import { EnclaveRunner } from "./runtime/enclave-bridge.ts";

const runner = new EnclaveRunner();

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
};

const response = await runner.execute(request);

console.log("Output hash:", Buffer.from(response.outputHash).toString("hex"));
console.log("Measurement:", response.measurement);
```

---

**Document Status:** Specification  
**Implementation:** Rust enclave runner (enclave-runner/ directory)  
**Review Cycle:** Before any interface changes

