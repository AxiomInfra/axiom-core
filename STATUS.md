# Axiom Core Status

**Status:** v1.0 complete; native enclave runner in private repo  
**Date:** 2026-01-21  
**Version:** 1.0.0

---

## Summary

The v1.0 SDK is feature-complete with deterministic transformation, boundary enforcement, and attestation verification (structure + binding checks). The native enclave runner lives in the private repo with simulator support; full SEV-SNP signature chain validation remains in progress. Simulator mode enables end-to-end development and testing without hardware.

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
- SEV-SNP attestation integration and signature chain validation in progress

---

## Test Status

- Test suite includes boundary, canonical, attestation, and attested integration (simulator) tests.

---

## Documentation Status

Core documentation is present and up to date:
- `README.md` (overview and quick start)
- `docs/architecture.md` (system design)
- `docs/security.md` (threat model and guarantees)
- `docs/roadmap.md` (v1.x through v2.x)
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

