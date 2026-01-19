# Axiom Core Roadmap

## Overview

This roadmap outlines the evolution from software-only boundary enforcement (v0.x) to hardware-backed attestation (v1.x) and future privacy goals (v2.x+). It is directional and may change based on hardware availability and integration feedback.

---

## v0.1 (Completed) - Software Boundary MVP

**Status:** Complete  
### Delivered
- Deterministic entity extraction and role assignment
- Synthetic ID masking and boundary validation
- Canonical serialization and hashing
- TypeScript SDK API
- Boundary and determinism test suites

---

## v1.0 (Next) - TEE Integration & Attestation

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

## v1.x (Later) - Hardening & Ecosystem

### Focus Areas
- Multi-platform TEE support (Intel TDX, Apple Secure Enclave, Arm CCA)
- Remote verification service and measurement registry automation
- Performance optimizations (batching, persistent sessions)
- Developer tooling (CLI, diagnostics, integration adapters)

---

## v2.0 (Future) - Zero-Knowledge & Advanced Privacy

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

## Contact

- Issues: https://github.com/Axiom-Infra/axiom-core/issues
- Security: security@axiominfra.cloud

