# Rust Enclave Runner Development Guide

**Status:** Experimental preview. This runner is opt-in, non-production, and does not provide v0.x guarantees.

## Quick Start

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Clone and build (from repo root)
cd enclave/runner
cargo build

# Run tests
cargo test
```

## Project Structure

```
enclave/runner/
├── Cargo.toml              # Dependencies and configuration
├── build.rs                # N-API build script
├── src/
│   ├── lib.rs              # Public N-API interface
│   ├── types.rs            # Type definitions
│   ├── error.rs            # Error handling
│   ├── enclave.rs          # Enclave coordination
│   ├── transform.rs        # Transformation logic
│   └── attestation.rs      # Attestation generation
└── README.md
```

## Development Workflow

### 1. Simulator Mode Development

```bash
# Default features include simulator
cargo build
cargo test
cargo run --example basic
```

### 2. Adding New Transformations

Edit `src/transform.rs`:

```rust
pub fn transform_context(
    raw_context: &[String],
    policy: &MaskingPolicy,
) -> Result<TransformedContext> {
    // Your transformation logic
}
```

### 3. Testing

```bash
# All tests
cargo test

# Specific module
cargo test transform

# With output
cargo test -- --nocapture
```

### 4. Building for TypeScript

```bash
# From project root
npm run build:enclave

# Verify N-API module
ls enclave/runner/target/release/*.node
```

## AMD SEV-SNP Integration

### Prerequisites

- SEV-SNP capable AMD EPYC CPU (Milan or newer)
- Linux kernel 5.19+ with SEV-SNP support
- AMD SEV SDK installed
- /dev/sev-guest device available

### Building with SEV-SNP

```bash
# Enable SEV-SNP feature
cargo build --release --features sev-snp --no-default-features

# Check availability
cargo run --release --features sev-snp --bin check-sev
```

### Implementing SEV-SNP Support

Edit `src/attestation.rs`:

```rust
#[cfg(feature = "sev-snp")]
pub fn generate_sev_snp_report(...) -> Result<Vec<u8>> {
    // 1. Create report_data with bindings
    let report_data = create_report_data(...)?;
    
    // 2. Call SEV-SNP ioctl
    let fd = std::fs::OpenOptions::new()
        .read(true)
        .write(true)
        .open("/dev/sev-guest")?;
    
    // 3. Request attestation report
    // ... ioctl calls ...
    
    // 4. Return raw report
    Ok(report_bytes)
}
```

## Common Tasks

### Add a New Dependency

```toml
# Cargo.toml
[dependencies]
my-crate = "1.0"
```

```bash
cargo build
```

### Run Benchmarks

```bash
cargo bench
```

### Generate Documentation

```bash
cargo doc --open
```

### Check Code Quality

```bash
# Lint
cargo clippy

# Format
cargo fmt

# Audit dependencies
cargo audit
```

## Debugging

### With GDB

```bash
cargo build
rust-gdb target/debug/axiom-enclave-runner
```

### With Logging

```rust
use log::{info, warn, error};

info!("Transformation started");
warn!("Using simulator mode");
error!("Attestation failed: {}", err);
```

```bash
RUST_LOG=debug cargo test
```

## Performance Optimization

### Profile

```bash
cargo build --release
perf record target/release/axiom-enclave-runner
perf report
```

### Flamegraph

```bash
cargo install flamegraph
cargo flamegraph
```

## Memory Safety

All code must be memory-safe:

```rust
#![forbid(unsafe_code)]  // In lib.rs
```

If `unsafe` is absolutely necessary:

1. Document why it's needed
2. Add safety comments
3. Minimize unsafe blocks
4. Add extra tests

## Error Handling

Always use the `Result` type:

```rust
use crate::error::{EnclaveError, Result};

pub fn my_function() -> Result<Output> {
    let data = some_operation()
        .map_err(|e| EnclaveError::TransformFailed(e.to_string()))?;
    
    Ok(data)
}
```

## Testing Strategy

### Unit Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extraction() {
        let result = extract_entities(&["test"]);
        assert!(result.is_ok());
    }
}
```

### Integration Tests

```rust
// tests/integration.rs
#[test]
fn test_end_to_end() {
    // Full transformation pipeline
}
```

### Property-Based Testing

```rust
use quickcheck_macros::quickcheck;

#[quickcheck]
fn test_deterministic(input: Vec<String>) -> bool {
    let output1 = transform(&input).unwrap();
    let output2 = transform(&input).unwrap();
    output1 == output2
}
```

## Release Checklist

- [ ] All tests passing
- [ ] Clippy clean
- [ ] Formatted with `cargo fmt`
- [ ] Documentation complete
- [ ] Benchmarks run
- [ ] Measurement computed
- [ ] Security review done
- [ ] N-API bindings tested from TypeScript

## Resources

- [Rust Book](https://doc.rust-lang.org/book/)
- [N-API Rust](https://napi.rs/)
- [AMD SEV-SNP](https://www.amd.com/en/developer/sev.html)
- [Axiom Core Docs](../../docs/)

## Getting Help

- GitHub Issues: https://github.com/Axiom-Infra/axiom-core/issues
- Rust Discord: #axiom-core
- Email: dev@axiominfra.cloud

