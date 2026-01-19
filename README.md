# Axiom Core (V0.1)

**Local semantic transformation for private AI reasoning.**

The Axiom Core is the open-core, local execution layer of the Axiom system. It enables cloud-based language models to reason over sensitive, local data—**without the raw data ever leaving the device**.

The SDK performs semantic transformation locally: removing identifying information while preserving the relational structure required for reasoning.

---

## What This SDK Is

The Axiom Core is **infrastructure**, not an application.

It is designed to be embedded into systems where:

- Private data cannot be transmitted to the cloud
- Frontier models are still required for reasoning
- Correctness, auditability, and trust boundaries matter

At a high level, the SDK:

- Executes semantic analysis on local input
- Transforms raw data into non-identifying representations
- Preserves entities, roles, and relationships
- Enforces a strict boundary between local context and cloud models

**Raw data never leaves the device.**

---

## What This SDK Is Not

To avoid ambiguity, the Axiom Core is explicitly **not**:

- A hosted service or proxy
- A redaction or PII-masking tool
- A compliance product or legal authority
- A cryptographic encryption system
- A local language model or inference engine
- A cloud routing or billing layer

These concerns are intentionally outside the scope of this repository.

---

## Core Idea: Semantic Transformation

Most privacy approaches treat **identity and meaning as inseparable**.

Axiom is built on a different assumption:

> Language models reason over structure and relationships—not names.

Instead of encrypting or redacting text, the SDK performs **local semantic transformation**:

1. Input is analyzed on-device
2. Entities are extracted and assigned roles
3. Relationships and values are preserved
4. Identifiers are removed before serialization
5. Only transformed context is exposed to cloud models

The transformation is intentionally **lossy**, but controlled. Correctness is measured in **reasoning fidelity**, not textual similarity.

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
│  • Optional hardware-backed execution                           │
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

## Basic Usage

### Quick Start (Local Demo)

```bash
npm install
npm run demo
```

If your shell blocks npm scripts, run:

```bash
node --experimental-strip-types demo/demo.js
```

The public SDK surface is intentionally minimal.

```ts
import { Axiom } from "@axiom/sdk";

const axiom = new Axiom({
  securityTier: "standard",
  enclave: "auto",
  policyVersion: "v1",
});

const result = await axiom.reason({
  context: localDocuments,
  task: "analyze obligations and risks",
  model: "gpt-5",
});
```

### Guarantees

When invoking `axiom.reason(...)`, the SDK provides the following guarantees:

| Guarantee | Description |
|-----------|-------------|
| **No raw data transmission** | Raw input data is never transmitted by the SDK |
| **Local transformation** | All semantic transformation occurs locally |
| **Explicit network calls** | No implicit network calls are performed |
| **Fail-fast boundaries** | Boundary violations fail explicitly and immediately |
| **Local reinflation** | Returned outputs can be reinflated locally by the caller |

The SDK does not silently degrade or bypass these guarantees.

---

## Semantic Pipeline

The Axiom Core applies a deterministic, auditable transformation pipeline:

```
  ┌──────────────────────┐
  │      Raw Input       │
  └──────────┬───────────┘
             ▼
  ┌──────────────────────┐
  │    Normalization     │
  └──────────┬───────────┘
             ▼
  ┌──────────────────────┐
  │  Entity Extraction   │
  └──────────┬───────────┘
             ▼
  ┌──────────────────────┐
  │   Role Assignment    │
  └──────────┬───────────┘
             ▼
  ┌──────────────────────┐
  │  Relationship Graph  │
  └──────────┬───────────┘
             ▼
  ┌──────────────────────┐
  │  Identifier Removal  │
  └──────────┬───────────┘
             ▼
  ┌──────────────────────┐
  │ Context Minimization │
  └──────────┬───────────┘
             ▼
  ╔══════════════════════╗
  ║ Transformed Context  ║
  ╚══════════════════════╝
```

Each stage preserves reasoning-relevant structure while removing identifying information.

---

## Entities, Roles, and Relations

Internally, the SDK does not operate on free-form text.

All semantic structure is represented using:

| Concept | Purpose |
|---------|---------|
| **Entities** | Discrete objects or actors in the context |
| **Roles** | Semantic function of each entity |
| **Relations** | Connections between entities |
| **Values** | Attributes and properties |

This abstraction allows reasoning to survive identity removal while remaining interpretable and auditable. Schemas are explicitly defined and evolve conservatively.

---

## Security Model

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
- Hardware-backed isolation may be available, but is not required

The SDK is **not** designed to be safe under fully compromised host conditions.

---

## Semantic Fidelity & Benchmarks

Because semantic transformation is intentionally lossy, fidelity must be measured.

This repository includes a roadmap for semantic fidelity evaluation focused on:

- Task-level correctness
- Logical consistency
- Reasoning equivalence between raw and transformed context

Benchmarks are domain-specific, limited in scope, and explicitly non-generalized. No claims of universal accuracy are made.

---

## Repository Structure

```
axiom-sdk/
├── src/           # Core SDK implementation
├── demo/          # Demo script
├── artifacts/     # Example evidence/verdicts
├── docs/          # Design notes and specifications
├── tests/         # Unit and boundary tests
├── STATUS.md      # Consolidated project status
├── README.md
├── ARCHITECTURE.md
├── SECURITY.md
├── ROADMAP.md
└── LICENSE
```

---

## Project Status

The Axiom Core is under active development.

**Current focus areas:**

- Stable semantic abstractions
- Deterministic transformation pipelines
- Correct boundary enforcement
- Measurable reasoning fidelity

Public APIs may evolve as constraints are better understood.

---

## Roadmap

A high-level engineering roadmap is maintained in [`ROADMAP.md`](ROADMAP.md).

This roadmap is directional and does not include timelines or commitments.

---

## Contributing

This project maintains high standards for correctness and clarity. Contributions are welcome for improvements to semantic correctness, security guarantees, documentation quality, and developer ergonomics.

---

## License

The Axiom Core is released under the **Apache 2.0 License**.

This repository represents the open-core component of the Axiom system.

---

## Contact

| Channel | Address |
|---------|---------|
| General | hello@axiom-sdk.dev |
| Security | security@axiom-sdk.dev |
| GitHub | [github.com/axiom-sdk/axiom-sdk](https://github.com/axiom-sdk/axiom-sdk) |

---

<p align="center">
  <em>Axiom exists to make advanced reasoning possible<br><strong>without surrendering ownership of data.</strong></em>
</p>
