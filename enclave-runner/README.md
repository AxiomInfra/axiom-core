# Axiom Enclave Runner

Native Rust component for Axiom SDK providing TEE isolation and attestation.

## Features

- **Simulator Mode** (default): Development without TEE hardware
- **SEV-SNP Mode**: Real AMD SEV-SNP support (requires hardware)

## Building

### Prerequisites

- Rust 1.75+ (`rustup install stable`)
- Node.js 20+ (for N-API)
- Cargo and npm

### Simulator Mode (Development)

```bash
# Build
cargo build --release

# Test
cargo test

# Build N-API module for TypeScript
npm run build:enclave
```

### SEV-SNP Mode (Production)

```bash
# Requires SEV-SNP hardware and AMD SDK
cargo build --release --features sev-snp --no-default-features

# Verify measurement
cargo run --release --features sev-snp --bin measure
```

## Architecture

```
TypeScript (Axiom SDK)
    ↓ N-API
Rust Runner (this crate)
    ↓ SEV-SNP API
AMD SEV-SNP TEE
```

## Modules

- **lib.rs**: N-API entry point and public interface
- **types.rs**: Type definitions matching TypeScript
- **error.rs**: Error types
- **enclave.rs**: Enclave execution coordination
- **transform.rs**: Semantic transformation logic
- **attestation.rs**: Report generation

## N-API Interface

```typescript
// TypeScript usage
import { transform, getMeasurement, checkAvailability } from './enclave-runner';

const request = { rawContext, policy, sessionId, nonce };
const response = await transform(JSON.stringify(request));
```

## Security Properties

- No network access
- No filesystem writes
- Memory wiping on completion
- Explicit error handling
- Boundary validation

## Testing

```bash
# Unit tests
cargo test

# Integration tests
cargo test --test integration

# With SEV-SNP (requires hardware)
cargo test --features sev-snp --no-default-features
```

## Reproducible Builds

```bash
# Build with reproducible profile
cargo build --profile reproducible

# Compute measurement
sha384sum target/reproducible/libaxiom_enclave_runner.so
```

## License

Apache-2.0

