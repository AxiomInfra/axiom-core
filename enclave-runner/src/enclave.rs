//! Enclave execution logic.
//!
//! Coordinates transformation execution inside TEE with proper isolation.

use crate::error::{EnclaveError, Result};
use crate::types::{EnclaveRequest, EnclaveResponse, RedactionStats};
use crate::transform;
use crate::attestation;

/// Check if SEV-SNP is available on this platform.
#[cfg(feature = "sev-snp")]
pub fn check_sev_snp_available() -> Result<()> {
    // TODO: Actual SEV-SNP availability check
    // This would interface with AMD's SEV-SNP SDK
    // Check for /dev/sev-guest or similar platform indicators
    
    log::info!("Checking SEV-SNP availability...");
    
    // Placeholder implementation
    Err(EnclaveError::EnclaveUnavailable(
        "SEV-SNP support not yet implemented. Use simulator mode.".to_string()
    ))
}

/// Execute transformation inside enclave with attestation.
pub async fn execute_in_enclave(request: EnclaveRequest) -> Result<EnclaveResponse> {
    #[cfg(feature = "simulator")]
    {
        execute_in_simulator(request).await
    }

    #[cfg(feature = "sev-snp")]
    {
        execute_in_sev_snp(request).await
    }
}

/// Execute transformation in simulator mode (no real TEE).
#[cfg(feature = "simulator")]
async fn execute_in_simulator(request: EnclaveRequest) -> Result<EnclaveResponse> {
    log::warn!("Executing in SIMULATOR mode - no real TEE isolation");

    // 1. Run transformation pipeline
    let transformed_context = transform::transform_context(&request.raw_context, &request.policy)?;

    // 2. Compute output hash
    let output_hash = transform::compute_output_hash(&transformed_context)?;

    // 3. Generate simulated attestation report
    let attestation_report = attestation::generate_simulator_report(
        &request.session_id,
        &request.nonce,
        &output_hash,
    )?;

    // 4. Get measurement (simulated)
    let measurement = attestation::get_simulator_measurement();

    // 5. Compute stats
    let redaction_stats = RedactionStats {
        entity_count: transformed_context.entities.len(),
        relation_count: transformed_context.relations.len(),
        identifiers_replaced: transformed_context.entities.len(),
    };

    Ok(EnclaveResponse {
        transformed_context,
        output_hash,
        attestation_report,
        redaction_stats,
        measurement,
        signature: None,
    })
}

/// Execute transformation in real SEV-SNP enclave.
#[cfg(feature = "sev-snp")]
async fn execute_in_sev_snp(request: EnclaveRequest) -> Result<EnclaveResponse> {
    log::info!("Executing in SEV-SNP enclave");

    // TODO: Actual SEV-SNP execution
    // This would:
    // 1. Initialize SEV-SNP session
    // 2. Run transformation in isolated memory
    // 3. Generate real attestation report via platform
    // 4. Bind session data to REPORT_DATA field
    // 5. Request signature from VCEK
    // 6. Wipe all intermediate memory
    
    Err(EnclaveError::EnclaveUnavailable(
        "SEV-SNP execution not yet implemented".to_string()
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::MaskingPolicy;

    #[tokio::test]
    #[cfg(feature = "simulator")]
    async fn test_simulator_execution() {
        let request = EnclaveRequest {
            raw_context: vec!["Test data with Alice and Bob".to_string()],
            task_hint: Some("Analyze".to_string()),
            policy: MaskingPolicy::default(),
            session_id: "test123".to_string(),
            nonce: "nonce456".to_string(),
        };

        let response = execute_in_enclave(request).await.unwrap();

        assert!(!response.transformed_context.entities.is_empty());
        assert!(!response.output_hash.is_empty());
        assert_eq!(response.attestation_report.len(), 1184); // SEV-SNP report size
    }
}

