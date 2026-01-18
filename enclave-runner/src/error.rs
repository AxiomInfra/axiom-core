//! Error types for enclave runner.

use napi::bindgen_prelude::*;
use thiserror::Error;

/// Result type for enclave operations.
pub type Result<T> = std::result::Result<T, EnclaveError>;

/// Errors that can occur during enclave execution.
#[derive(Debug, Error)]
pub enum EnclaveError {
    /// Enclave is not available or initialization failed
    #[error("Enclave unavailable: {0}")]
    EnclaveUnavailable(String),

    /// Transformation failed
    #[error("Transformation failed: {0}")]
    TransformFailed(String),

    /// Attestation generation failed
    #[error("Attestation failed: {0}")]
    AttestationFailed(String),

    /// Input is too large
    #[error("Input too large: {0} bytes")]
    InputTooLarge(usize),

    /// Invalid configuration
    #[error("Invalid configuration: {0}")]
    InvalidConfig(String),

    /// Invalid input format
    #[error("Invalid input: {0}")]
    InvalidInput(String),

    /// Serialization failed
    #[error("Serialization failed: {0}")]
    SerializationFailed(String),

    /// Boundary violation detected
    #[error("Boundary violation: {0}")]
    BoundaryViolation(String),

    /// Security invariant violated
    #[error("Security invariant violated: {0}")]
    SecurityInvariant(String),
}

// Implement conversion to N-API error for TypeScript interop
impl From<EnclaveError> for napi::Error {
    fn from(err: EnclaveError) -> Self {
        let status = match err {
            EnclaveError::EnclaveUnavailable(_) => Status::GenericFailure,
            EnclaveError::TransformFailed(_) => Status::GenericFailure,
            EnclaveError::AttestationFailed(_) => Status::GenericFailure,
            EnclaveError::InputTooLarge(_) => Status::InvalidArg,
            EnclaveError::InvalidConfig(_) => Status::InvalidArg,
            EnclaveError::InvalidInput(_) => Status::InvalidArg,
            EnclaveError::SerializationFailed(_) => Status::GenericFailure,
            EnclaveError::BoundaryViolation(_) => Status::GenericFailure,
            EnclaveError::SecurityInvariant(_) => Status::GenericFailure,
        };

        napi::Error::new(status, err.to_string())
    }
}

