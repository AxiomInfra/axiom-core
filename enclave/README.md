# Enclave (Experimental Preview)

This directory contains **experimental** enclave-related components for a possible v1.x
hardware-attested execution path. These components are **opt-in**, **non-production**,
and **not required** to use the v0.x Axiom Core SDK.

Scope notes:

- No v0.x guarantees are provided here.
- Simulator mode provides **no security guarantees**.
- APIs and behavior may change without notice.

Contents:

- The native Rust runner now lives in the private `axiom-enclave-runner` repository.
  This public repo only includes simulator and attestation interface definitions.

