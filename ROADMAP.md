# Axiom SDK Roadmap

## Overview

This roadmap outlines the evolution from software-only boundary enforcement (v0) to hardware-backed attestation (v1.0) and future privacy guarantees (v2.0+). It is directional and may change based on hardware availability and integration feedback.

---

## v0.1 (Completed) - Software Boundary MVP

**Status:** Complete  
**Release:** January 2026

### Delivered
- Deterministic entity extraction and role assignment
- Synthetic ID masking and boundary validation
- Canonical serialization and hashing
- TypeScript SDK API
- Boundary and determinism test suites

---

## v1.0 (Current) - TEE Integration & Attestation

**Status:** In progress (TypeScript complete, Rust pending)

### Definition of Done
1. Transformation executes inside TEE (or fails when enclave required)
2. SDK returns transformed context with attestation evidence
3. Verification validates measurement, platform auth, and bindings
4. No raw data egress at software and hardware boundaries
5. Reproducible build with published measurements

### Complete (TypeScript Layer)
- Canonical serialization and hashing
- Session management and binding data
- Attestation types, parser, and verifier
- Enclave bridge with simulator mode
- Updated `Axiom.reason()` API and executor routing
- Documentation (README, ARCHITECTURE, SECURITY, INTEGRATION, ENCLAVE_INTERFACE)

### In Progress (Rust Enclave Runner)
- Core transformation pipeline in Rust
- SEV-SNP report generation
- N-API bindings
- Reproducible build tooling
- End-to-end attested integration tests

---

## v1.x (Next) - Hardening & Ecosystem

**Target:** Q2–Q3 2026

### Focus Areas
- Multi-platform TEE support (Intel TDX, Apple Secure Enclave, Arm CCA)
- Remote verification service and measurement registry automation
- Performance optimizations (batching, persistent sessions)
- Developer tooling (CLI, diagnostics, integration adapters)

---

## v2.0 (Future) - Zero-Knowledge & Advanced Privacy

**Target:** 2027

### Research Goals
- Zero-knowledge proofs for semantic claims
- Proof aggregation and privacy-preserving audit trails
- Domain-specific policies and advanced masking
- Differential privacy or homomorphic enhancements where feasible

---

## Maintenance & Support

- v0.x: Maintenance mode after v1.0 stable
- v1.0: Long-term support for critical fixes
- v1.x+: Feature velocity with backward compatibility

---

## Release Schedule (Tentative)

| Version | Target Date | Status |
|---|---|---|
| v0.1.0 | Jan 2026 | Released |
| v1.0.0-beta | Feb 2026 | In progress |
| v1.0.0 | Mar 2026 | Planned |
| v1.1.0 | May 2026 | Planned |
| v1.2.0 | Jul 2026 | Planned |
| v2.0.0-alpha | Q4 2026 | Research |
| v2.0.0 | Q2 2027 | Vision |

---

## Contact

- Issues: https://github.com/axiom-sdk/axiom-sdk/issues
- Security: security@axiom-sdk.dev

