# Axiom Core (Early Access)

**Local semantic transformation for private AI reasoning.**

> **Status:** Early-access infrastructure SDK.  
> APIs, guarantees, behavior, and licensing details may change.

Axiom Core is an early-access execution layer for transforming sensitive local input into **non-identifying semantic representations**, enabling cloud models to reason over structure without access to raw data.

The SDK performs semantic transformation locally by removing identifying information while preserving the relational structure required for reasoning.

This repository is shared for **transparency and early technical validation**, not as a production-ready security boundary.

---

## Table of Contents

- [Overview](#overview)
- [Design Intent](#design-intent)
- [Installation](#installation)
- [Usage](#usage)
- [Design Guarantees (Current Scope)](#design-guarantees-current-scope)
- [What This SDK Is](#what-this-sdk-is)
- [What This SDK Is Not](#what-this-sdk-is-not)
- [High-Level Architecture](#high-level-architecture)
- [Security Model (Current Scope)](#security-model-current-scope)
- [Experimental: Enclave Execution (Preview)](#experimental-enclave-execution-preview)
- [Repository Structure](#repository-structure)
- [Contributing](#contributing)
- [License](#license)
- [Links](#links)

---

## Overview

Many high-value AI workflows are blocked today because sensitive data cannot move to the cloud.

Existing approaches typically:
- redact information and break reasoning
- encrypt data and block inference
- rely on local models with limited quality

Axiom Core explores an alternative approach: **preserving semantic structure while removing identity**, so modern models can reason without seeing raw data.

---

## Design Intent

Axiom Core is built with the following intent:

- Correctness over convenience  
- Deterministic behavior over heuristics  
- Explicit boundaries over implicit trust  
- Known failure modes over undefined behavior  

The SDK is designed to fail explicitly when boundaries are violated and to make assumptions and limitations visible.

---

## Installation

### Requirements

- Node.js >= 20.0.0
- npm >= 9.0.0 (or Yarn / pnpm)

### Install

```bash
npm install @axiom-infra/core
# or
yarn add @axiom-infra/core
```

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

// Only result.transformedContext is intended to be sent to the cloud
```

### Local Demo (from this repository)

```bash
npm install
npm run demo
```

**If your shell blocks npm scripts:**

```bash
node --experimental-strip-types demo/demo.js
```

## Design Guarantees (Current Scope)

The following properties describe intended behavior within the current SDK-controlled execution scope.
They are not contractual guarantees and may evolve as the system matures.

| Property | Description |
|----------|-------------|
| No raw data transmission | Raw input data is not transmitted by the SDK |
| Local transformation | Semantic transformation occurs locally |
| Explicit network calls | No implicit network calls are performed |
| Fail-fast boundaries | Boundary violations fail explicitly |
| No identity mapping output | Raw ↔ transformed mappings are not exposed |

These properties apply only to SDK-controlled execution paths.

## What This SDK Is

Axiom Core is infrastructure, not an application.

It is designed to be embedded in systems where:

- Sensitive data should not be transmitted externally
- Frontier models are still required for reasoning
- Trust boundaries and auditability matter

At a high level, the SDK:

- Performs semantic analysis on local input
- Transforms raw data into non-identifying representations
- Preserves entities, roles, and relationships
- Enforces a strict boundary between local context and external models

## What This SDK Is Not

To avoid ambiguity, Axiom Core is explicitly not:

- A hosted service or proxy
- A redaction or PII-masking tool
- A compliance product or legal authority
- A cryptographic encryption system
- A local language model or inference engine
- A cloud routing, billing, or orchestration layer

These concerns are intentionally out of scope.

## High-Level Architecture

Axiom Core operates entirely on the local side of a strict trust boundary.

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
│  External Model Boundary                                        │
│                                                                 │
│  • Receives non-identifying context only                        │
│  • Performs reasoning using external models                     │
│  • Never receives raw private data                              │
└─────────────────────────────────────────────────────────────────┘

## Security Model (Current Scope)

### Enforced Properties

Within SDK-controlled execution paths, the system enforces:

- No raw text serialization
- No implicit network access
- Explicit local-to-external boundary enforcement
- Zero data retention by default

### Trust Assumptions

The SDK assumes:

- The host operating system is honest-but-curious
- The runtime environment is not actively malicious

The SDK is not designed to be safe under fully compromised host conditions.

## Experimental: Enclave Execution (Preview)

Enclave execution is experimental and not required to use Axiom Core.

This feature does not define the security posture of the SDK.

Notes:

- `enclave: "auto"` may fall back to a simulator
- `enclave: "required"` fails if a native runner is unavailable
- Simulator mode provides no security guarantees and is intended for development only

## Repository Structure
axiom-core/
├── src/           # Core SDK implementation
├── demo/          # Demo script
├── artifacts/     # Example artifacts and outputs
├── docs/          # Design notes and specifications
├── tests/         # Unit and boundary tests
├── STATUS.md      # Project status and maturity notes
├── README.md
├── docs/architecture.md
├── docs/security.md
├── docs/roadmap.md
└── LICENSE

## Contributing

At this stage, Axiom Core is not accepting external code contributions.

Feedback, issues, and discussion are welcome.
Contribution guidelines will be published once the architecture and licensing model are finalized.

## License

Axiom Core is released under the Apache 2.0 License.

This repository represents an early-access, open component of the Axiom system.
Other components may be licensed differently.

## Links

- **Integration Guide:** [docs/INTEGRATION.md](docs/INTEGRATION.md)
- **Architecture:** [docs/architecture.md](docs/architecture.md)
- **Security:** [docs/security.md](docs/security.md)
- **Roadmap:** [docs/roadmap.md](docs/roadmap.md)
- **Status:** [STATUS.md](STATUS.md)
- **Issues:** [https://github.com/Axiom-Infra/axiom-core/issues](https://github.com/Axiom-Infra/axiom-core/issues)
- **Contact:** hello@axiominfra.cloud | security@axiominfra.cloud

---

<p align="center"><em>Axiom exists to preserve intelligence under constraint.</em></p>
