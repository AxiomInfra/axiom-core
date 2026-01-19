# Axiom Core (v0.x)

**Local semantic transformation for private AI reasoning.**

Axiom Core is the v0.x software-only execution layer of the Axiom system. It transforms sensitive local input into non-identifying semantic representations so cloud models can reason over structure without seeing raw data.

The SDK performs semantic transformation locally: removing identifying information while preserving the relational structure required for reasoning.

---

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [Guarantees (v0.x)](#guarantees-v0x)
- [Features](#features)
- [What This SDK Is](#what-this-sdk-is)
- [What This SDK Is Not](#what-this-sdk-is-not)
- [High-Level Architecture](#high-level-architecture)
- [Security Model (v0.x)](#security-model-v0x)
- [Experimental: Enclave Execution (Preview)](#experimental-enclave-execution-preview)
- [Repository Structure](#repository-structure)
- [Contributing](#contributing)
- [License](#license)
- [Links](#links)

---

## Installation

### Requirements

- Node.js >= 20.0.0
- npm >= 9.0.0 (or Yarn/pnpm)

### Install

```bash
npm install @axiom-infra/core
```

```bash
yarn add @axiom-infra/core
```

---

## Usage

### Basic Example

```ts
import { Axiom } from "@axiom-infra/core";

const axiom = new Axiom({
  securityTier: "standard",
  enclave: "none",
  policyVersion: "v1",
});

const result = await axiom.reason({
  context: localDocuments,
  task: "analyze obligations and risks",
  model: "gpt-5",
});

// Send only result.transformedContext to cloud
```

### Local Demo (from this repo)

```bash
npm install
npm run demo
```

If your shell blocks npm scripts, run:

```bash
node --experimental-strip-types demo/demo.js
```

### Advanced Usage (Preview)

```ts
const axiomPreview = new Axiom({
  securityTier: "attested",
  enclave: "auto",
  policyVersion: "v1",
});
```

For full integration details, see `docs/INTEGRATION.md`.

---

## Guarantees (v0.x)

When invoking `axiom.reason(...)` in the **standard** tier, the SDK provides:

| Guarantee | Description |
|-----------|-------------|
| **No raw data transmission** | Raw input data is not transmitted by the SDK |
| **Local transformation** | Semantic transformation occurs locally |
| **Explicit network calls** | No implicit network calls are performed |
| **Fail-fast boundaries** | Boundary violations fail explicitly |
| **Local reinflation** | Returned outputs can be reinflated locally by the caller |

These guarantees apply only to SDK-controlled execution paths.

---

## Features

- Local semantic abstraction pipeline
- Entity and role modeling
- Deterministic canonicalization and hashing
- Explicit boundary enforcement and fail-fast errors
- Zero data retention by default (SDK-controlled paths)

---

## What This SDK Is

Axiom Core is **infrastructure**, not an application.

It is designed to be embedded into systems where:

- Private data should not be transmitted to the cloud
- Frontier models are still required for reasoning
- Trust boundaries and auditability matter

At a high level, the SDK:

- Executes semantic analysis on local input
- Transforms raw data into non-identifying representations
- Preserves entities, roles, and relationships
- Enforces a strict boundary between local context and cloud models

---

## What This SDK Is Not

To avoid ambiguity, Axiom Core is explicitly **not**:

- A hosted service or proxy
- A redaction or PII-masking tool
- A compliance product or legal authority
- A cryptographic encryption system
- A local language model or inference engine
- A cloud routing or billing layer

These concerns are intentionally outside the scope of this repository.

---

## High-Level Architecture

The Axiom system enforces a hard trust boundary.

```
┌─────────────────────────────────────────────────────────────────┐
│  Local Environment (This SDK)                                   │
│                                                                 │
│  • Semantic analysis and transformation                         │
│  • Entity and relationship abstraction                          │
│  • Context filtering and minimization                           │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼ Transformed context only
┌─────────────────────────────────────────────────────────────────┐
│  Cloud Boundary                                                 │
│                                                                 │
│  • Receives non-identifying context only                        │
│  • Performs reasoning using external models                     │
│  • Never receives raw private data                              │
└─────────────────────────────────────────────────────────────────┘
```

This repository operates entirely on the **local side** of that boundary.

---

## Security Model (v0.x)

### Hard Guarantees

Within its execution scope, the SDK enforces:

- ✓ No raw text serialization
- ✓ No implicit network access
- ✓ Explicit local-to-cloud boundary enforcement
- ✓ Zero data retention by default

All guarantees apply only to SDK-controlled execution paths.

### Trust Assumptions

The SDK assumes:

- The host operating system is honest-but-curious
- The runtime environment is not actively malicious

The SDK is **not** designed to be safe under fully compromised host conditions.

---

## Experimental: Enclave Execution (Preview)

A separate enclave runner exists as an **experimental preview** for hardware-backed isolation and attestation. It is **not** part of the v0.x guarantee set and is **not required** to run the core SDK.

If you explore this preview, treat it as opt-in and non-production.

---

## Repository Structure

```
axiom-core/
├── src/           # Core SDK implementation (v0.x)
├── demo/          # Demo script
├── artifacts/     # Example evidence/verdicts
├── docs/          # Design notes and specifications
├── tests/         # Unit and boundary tests
├── STATUS.md      # Consolidated project status
├── README.md
├── docs/architecture.md
├── docs/security.md
├── docs/roadmap.md
└── LICENSE
```

---

## Contributing

This project maintains high standards for correctness and clarity. Contributions are welcome for improvements to semantic correctness, documentation quality, and developer ergonomics.

---

## License

Axiom Core is released under the **Apache 2.0 License**.

This repository represents the open-core component of the Axiom system.

---

## Links

- Integration Guide: [`docs/INTEGRATION.md`](docs/INTEGRATION.md)
- Architecture: [`docs/architecture.md`](docs/architecture.md)
- Security: [`docs/security.md`](docs/security.md)
- Roadmap: [`docs/roadmap.md`](docs/roadmap.md)
- Status: [`STATUS.md`](STATUS.md)
- Issues: [github.com/Axiom-Infra/axiom-core/issues](https://github.com/Axiom-Infra/axiom-core/issues)
- Changelog: [github.com/Axiom-Infra/axiom-core/releases](https://github.com/Axiom-Infra/axiom-core/releases)
- Contact: hello@axiominfra.cloud | security@axiominfra.cloud

---

<p align="center">
  <em>Axiom exists to make advanced reasoning possible<br><strong>without surrendering ownership of data.</strong></em>
</p>
