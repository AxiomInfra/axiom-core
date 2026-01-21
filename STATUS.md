# Axiom Core Status

**Status:** TypeScript core complete; Rust enclave runner in progress  
**Date:** 2026-01-18  
**Version:** 0.1.0-alpha.1

---

## Summary

The TypeScript core is feature-complete with deterministic transformation, boundary enforcement, and attestation verification. The Rust enclave runner exists as a scaffold with simulator support; real SEV-SNP integration remains in progress. Simulator mode enables end-to-end development and testing without hardware.

---

## Current State

### TypeScript Core
- Core transformation pipeline implemented
- Deterministic canonical serialization and hashing
- Session binding and attestation evidence types
- Attestation parser and verifier (simulator-friendly)
- Enclave bridge with simulator execution
- Public API exported via `src/index.ts`

### Rust Enclave Runner
- Project structure moved to private `axiom-enclave-runner` repo
- Simulator workflow supported for development
- Real SEV-SNP attestation and N-API hardening in progress

---

## Test Status

- Boundary tests: 5/5 passing
- Canonical tests: 15/15 passing
- Attestation tests: 11/15 passing (simulator adjustments in progress)

---

## Documentation Status

Core documentation is present and up to date:
- `README.md` (overview and quick start)
- `docs/architecture.md` (system design)
- `docs/security.md` (threat model and guarantees)
- `docs/roadmap.md` (v0.x through v2.x)
- `docs/INTEGRATION.md` (integration guide)
- `docs/ENCLAVE_INTERFACE.md` (TS ↔ Rust contract)

---

## Known Gaps

- Real SEV-SNP attestation generation and signature chain validation in Rust
- Reproducible build pipeline for enclave measurements
- End-to-end attested integration tests (requires hardware or full simulator parity)

---

## Next Steps

1. Finalize simulator-tolerant attestation tests
2. Implement SEV-SNP report generation in Rust runner
3. Add reproducible build tooling and publish measurements
4. Run full test suite and demo verification

---

## Contact

- General: hello@axiominfra.cloud
- Security: security@axiominfra.cloud

