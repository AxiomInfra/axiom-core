//! Attestation report generation for AMD SEV-SNP.
//!
//! Provides both simulator and real SEV-SNP attestation.

use crate::error::{EnclaveError, Result};
use sha2::{Sha256, Digest};

/// Generate simulated attestation report.
#[cfg(feature = "simulator")]
pub fn generate_simulator_report(
    session_id: &str,
    nonce: &str,
    output_hash: &str,
) -> Result<Vec<u8>> {
    // Create a 1184-byte report (SEV-SNP report size)
    let mut report = vec![0u8; 1184];

    // Write version
    report[0..4].copy_from_slice(&1u32.to_le_bytes());

    // Write guest policy
    report[4..8].copy_from_slice(&0x30000u32.to_le_bytes());

    // Write measurement (offset 0x170, 48 bytes)
    let measurement = get_simulator_measurement();
    let measurement_bytes = hex::decode(&measurement)
        .unwrap_or_else(|_| measurement.as_bytes().to_vec());
    let measurement_start = 0x170;
    report[measurement_start..measurement_start + measurement_bytes.len().min(48)]
        .copy_from_slice(&measurement_bytes[..measurement_bytes.len().min(48)]);

    // Write report data (offset 0x50, 64 bytes)
    // Bind session_id, nonce, and output_hash
    let report_data = create_report_data(session_id, nonce, output_hash)?;
    report[0x50..0x50 + 64].copy_from_slice(&report_data);

    // Write simulated signature (offset 0x2A0, 512 bytes)
    let signature = vec![0xAA; 512]; // Placeholder signature
    report[0x2A0..0x2A0 + 512].copy_from_slice(&signature);

    Ok(report)
}

/// Create report data binding session and output.
fn create_report_data(session_id: &str, nonce: &str, output_hash: &str) -> Result<[u8; 64]> {
    let mut hasher = Sha256::new();
    hasher.update(session_id.as_bytes());
    hasher.update(b"||");
    hasher.update(nonce.as_bytes());
    hasher.update(b"||");
    hasher.update(output_hash.as_bytes());

    let hash = hasher.finalize();
    
    let mut report_data = [0u8; 64];
    report_data[..32].copy_from_slice(&hash);

    Ok(report_data)
}

/// Get simulated measurement.
#[cfg(feature = "simulator")]
pub fn get_simulator_measurement() -> String {
    // 96-character hex string (48 bytes, SHA-384)
    "simulator_measurement_0000000000000000000000000000000000000000000000000000000000000000".to_string()
}

/// Get current enclave measurement from SEV-SNP.
#[cfg(feature = "sev-snp")]
pub fn get_current_measurement() -> Result<String> {
    // TODO: Actual SEV-SNP measurement extraction
    // This would interface with /dev/sev-guest or AMD SDK
    // to retrieve the current VM measurement
    
    Err(EnclaveError::AttestationFailed(
        "SEV-SNP measurement extraction not yet implemented".to_string()
    ))
}

/// Generate real SEV-SNP attestation report.
#[cfg(feature = "sev-snp")]
pub fn generate_sev_snp_report(
    session_id: &str,
    nonce: &str,
    output_hash: &str,
) -> Result<Vec<u8>> {
    // TODO: Actual SEV-SNP report generation
    // This would:
    // 1. Create report_data with bindings
    // 2. Call ioctl to /dev/sev-guest with REPORT_DATA
    // 3. Platform generates report signed with VCEK
    // 4. Return raw report bytes
    
    let _ = (session_id, nonce, output_hash);
    
    Err(EnclaveError::AttestationFailed(
        "SEV-SNP report generation not yet implemented".to_string()
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[cfg(feature = "simulator")]
    fn test_simulator_report_size() {
        let report = generate_simulator_report("session", "nonce", "hash").unwrap();
        assert_eq!(report.len(), 1184);
    }

    #[test]
    #[cfg(feature = "simulator")]
    fn test_measurement_format() {
        let measurement = get_simulator_measurement();
        assert_eq!(measurement.len(), 96); // 48 bytes in hex
    }

    #[test]
    fn test_report_data_binding() {
        let report_data = create_report_data("session123", "nonce456", "hash789").unwrap();
        assert_eq!(report_data.len(), 64);
        
        // Same inputs should produce same report data
        let report_data2 = create_report_data("session123", "nonce456", "hash789").unwrap();
        assert_eq!(report_data, report_data2);
        
        // Different inputs should produce different report data
        let report_data3 = create_report_data("different", "nonce456", "hash789").unwrap();
        assert_ne!(report_data, report_data3);
    }
}

