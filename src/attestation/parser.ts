/**
 * Experimental attestation parser. This is an opt-in preview path and does not
 * provide v0.x guarantees.
 */
import type { ParsedAttestationReport } from "./types.ts";

/**
 * Attestation report parser for AMD SEV-SNP reports.
 * Extracts measurement, custom data, and signature information.
 */

/**
 * Parse a raw AMD SEV-SNP attestation report.
 * @param report - Raw attestation report (1184 bytes for real SEV-SNP)
 * @returns Parsed report structure
 * @throws Error if report structure is invalid
 */
export function parseAttestationReport(
  report: Uint8Array
): ParsedAttestationReport {
  // Check for simulator report (starts with "FAKE")
  const magic = new TextDecoder().decode(report.slice(0, 4));
  if (magic === "FAKE") {
    return parseSimulatorReport(report);
  }

  // Real SEV-SNP report parsing
  return parseRealSEVSNPReport(report);
}

/**
 * Parse a simulator attestation report.
 * @private
 */
function parseSimulatorReport(report: Uint8Array): ParsedAttestationReport {
  if (report.length < 1184) {
    throw new Error("Invalid simulator report: too small");
  }

  // Extract version (offset 4)
  const version = new DataView(report.buffer, report.byteOffset).getUint32(4, true);

  // Extract report_data (offset 8, 32 bytes)
  const reportData = report.slice(8, 40);

  // Simulator measurement (deterministic fake)
  const measurement = "simulator_measurement_" + "0".repeat(42);

  return {
    version,
    guestPolicy: 0, // Simulator
    measurement,
    hostData: new Uint8Array(32), // Empty
    reportData,
    platformVersion: {
      bootLoader: 0,
      tee: 0,
      snp: 0,
      microcode: 0,
    },
    signature: new Uint8Array(64), // Fake signature
    certificates: undefined,
  };
}

/**
 * Parse a real AMD SEV-SNP attestation report.
 * @private
 */
function parseRealSEVSNPReport(report: Uint8Array): ParsedAttestationReport {
  // Real SEV-SNP reports are 1184 bytes
  if (report.length < 1184) {
    throw new Error("Invalid SEV-SNP report: incorrect size");
  }

  const view = new DataView(report.buffer, report.byteOffset);

  // Parse report structure based on AMD SEV-SNP specification
  // Offsets from AMD SEV-SNP ABI Specification

  // Version (offset 0, 4 bytes)
  const version = view.getUint32(0, true);

  // Guest policy (offset 4, 8 bytes)
  const guestPolicy = Number(view.getBigUint64(4, true));

  // Measurement (offset 48, 48 bytes - SHA-384)
  const measurementBytes = report.slice(48, 96);
  const measurement = Array.from(measurementBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Host data (offset 96, 32 bytes)
  const hostData = report.slice(96, 128);

  // Report data (offset 640, 64 bytes)
  const reportData = report.slice(640, 704);

  // Platform version (offset 24-28)
  const platformVersion = {
    bootLoader: view.getUint8(24),
    tee: view.getUint8(25),
    snp: view.getUint8(26),
    microcode: view.getUint8(27),
  };

  // Signature (offset 704, varies - ECDSA P-384)
  const signature = report.slice(704, 768); // Simplified

  return {
    version,
    guestPolicy,
    measurement,
    hostData,
    reportData,
    platformVersion,
    signature,
    certificates: undefined, // Would parse cert chain if present
  };
}

/**
 * Extract measurement from attestation report.
 * @param report - Raw attestation report
 * @returns Hex-encoded measurement string
 */
export function extractMeasurement(report: Uint8Array): string {
  const parsed = parseAttestationReport(report);
  return parsed.measurement;
}

/**
 * Extract report_data field from attestation report.
 * This contains the custom data binding (session_id || config_hash || output_hash).
 * @param report - Raw attestation report
 * @returns Report data buffer (32 or 64 bytes depending on platform)
 */
export function extractReportData(report: Uint8Array): Uint8Array {
  const parsed = parseAttestationReport(report);
  return parsed.reportData;
}

/**
 * Validate the structure of an attestation report.
 * @param report - Raw attestation report
 * @returns True if structure is valid
 */
export function validateReportStructure(report: Uint8Array): boolean {
  try {
    parseAttestationReport(report);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a report is from simulator (for testing).
 * @param report - Raw attestation report
 * @returns True if this is a simulator report
 */
export function isSimulatorReport(report: Uint8Array): boolean {
  if (report.length < 4) return false;
  const magic = new TextDecoder().decode(report.slice(0, 4));
  return magic === "FAKE";
}

/**
 * Extract platform version information.
 * @param report - Raw attestation report
 * @returns Platform version details
 */
export function extractPlatformVersion(report: Uint8Array): {
  bootLoader: number;
  tee: number;
  snp: number;
  microcode: number;
} {
  const parsed = parseAttestationReport(report);
  return parsed.platformVersion;
}

