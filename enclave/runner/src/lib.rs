//! Axiom Enclave Runner
//!
//! Native Rust runner for Axiom Core semantic transformation.
//! Provides TEE isolation via AMD SEV-SNP and N-API bindings for TypeScript.
//!
//! # Architecture
//!
//! ```text
//! TypeScript (Axiom Core)
//!     ↓ (N-API)
//! Rust Runner (this crate)
//!     ↓ (SEV-SNP API)
//! AMD SEV-SNP TEE
//! ```
//!
//! # Features
//!
//! - `simulator`: Simulated enclave for development (default)
//! - `sev-snp`: Real AMD SEV-SNP support (requires hardware)

#![forbid(unsafe_code)]
#![warn(
    missing_docs,
    clippy::all,
    clippy::pedantic,
    clippy::cargo
)]

mod enclave;
mod transform;
mod attestation;
mod types;
mod error;

use napi::bindgen_prelude::*;
use napi_derive::napi;

pub use error::{EnclaveError, Result};
pub use types::{EnclaveRequest, EnclaveResponse};

/// Initialize the enclave runner.
/// Checks for SEV-SNP availability and configures the runtime.
#[napi]
pub fn initialize() -> Result<String> {
    #[cfg(feature = "simulator")]
    {
        log::warn!("Running in SIMULATOR mode - no real TEE guarantees");
        Ok("simulator".to_string())
    }

    #[cfg(feature = "sev-snp")]
    {
        enclave::check_sev_snp_available()?;
        Ok("sev-snp".to_string())
    }
}

/// Transform raw context inside enclave with attestation.
///
/// # Arguments
///
/// * `request_json` - Serialized EnclaveRequest (JSON)
///
/// # Returns
///
/// Serialized EnclaveResponse (JSON) with transformed context and attestation
///
/// # Errors
///
/// Returns error if:
/// - Input is too large (>10MB)
/// - Transformation fails
/// - Attestation generation fails
#[napi]
pub async fn transform(request_json: String) -> Result<String> {
    // 1. Deserialize request
    let request: EnclaveRequest = serde_json::from_str(&request_json)
        .map_err(|e| EnclaveError::InvalidInput(e.to_string()))?;

    // 2. Validate input size
    let total_size = request.raw_context.iter().map(|s| s.len()).sum::<usize>();
    if total_size > 10 * 1024 * 1024 {
        return Err(EnclaveError::InputTooLarge(total_size));
    }

    // 3. Execute transformation in enclave
    let response = enclave::execute_in_enclave(request).await?;

    // 4. Serialize response
    let response_json = serde_json::to_string(&response)
        .map_err(|e| EnclaveError::SerializationFailed(e.to_string()))?;

    Ok(response_json)
}

/// Get enclave measurement for verification.
/// Returns the SHA-384 hash of the enclave binary.
#[napi]
pub fn get_measurement() -> Result<String> {
    #[cfg(feature = "simulator")]
    {
        Ok("simulator_measurement_0000000000000000000000000000000000000000000000000000000000000000".to_string())
    }

    #[cfg(feature = "sev-snp")]
    {
        attestation::get_current_measurement()
    }
}

/// Verify if enclave runner is available and functional.
#[napi]
pub fn check_availability() -> bool {
    #[cfg(feature = "simulator")]
    {
        true
    }

    #[cfg(feature = "sev-snp")]
    {
        enclave::check_sev_snp_available().is_ok()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_simulator_transform() {
        let request = EnclaveRequest {
            raw_context: vec!["John Doe signed a contract".to_string()],
            task_hint: Some("Analyze".to_string()),
            policy: Default::default(),
            session_id: "test_session".to_string(),
            nonce: "test_nonce".to_string(),
        };

        let request_json = serde_json::to_string(&request).unwrap();
        let response_json = transform(request_json).await.unwrap();
        let response: EnclaveResponse = serde_json::from_str(&response_json).unwrap();

        assert!(!response.transformed_context.entities.is_empty());
        assert!(!response.output_hash.is_empty());
    }
}

