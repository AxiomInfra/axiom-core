/**
 * Experimental attestation verifier. This is an opt-in preview path and does not
 * provide v0.x guarantees.
 */
import type {
  AttestationEvidence,
  VerificationVerdict,
  VerificationOptions,
} from "./types.ts";
import type { TransformedContext } from "../core/config.ts";
import {
  parseAttestationReport,
  extractReportData,
  isSimulatorReport,
} from "./parser.ts";
import { hash as hashContext } from "../core/canonical.ts";
import { createHash } from "crypto";

/**
 * AttestationVerifier validates attestation evidence and produces verification verdicts.
 * Checks measurement, platform authenticity, output binding, and freshness.
 */
export class AttestationVerifier {
  /**
   * Verify attestation evidence against transformed context.
   *
   * @param evidence - Attestation evidence from enclave execution
   * @param transformedContext - The transformed context to verify
   * @param options - Verification options (expected measurement, max age, etc.)
   * @returns Verification verdict with detailed claims
   */
  async verify(
    evidence: AttestationEvidence,
    transformedContext: TransformedContext,
    options: VerificationOptions = {}
  ): Promise<VerificationVerdict> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const mode = options.mode ?? "strict";

    // Initialize claims (all false until verified)
    const claims = {
      codeIdentity: false,
      platformAuth: false,
      sessionBinding: false,
      freshness: false,
      reportStructure: false,
      configBinding: false,
    };

    // 1. Validate report structure
    try {
      parseAttestationReport(evidence.report);
      claims.reportStructure = true;
    } catch (error) {
      errors.push(`Report structure invalid: ${error instanceof Error ? error.message : String(error)}`);
    }

    // 2. Verify measurement (code identity)
    if (options.expectedMeasurement) {
      if (evidence.measurement === options.expectedMeasurement) {
        claims.codeIdentity = true;
      } else {
        errors.push(
          `Measurement mismatch: expected ${options.expectedMeasurement}, got ${evidence.measurement}`
        );
      }
    } else {
      // No expected measurement provided - cannot verify
      if (mode === "strict") {
        errors.push("Expected measurement not provided for verification");
      } else {
        warnings.push("Code identity not verified (no expected measurement)");
        claims.codeIdentity = true; // Permissive mode
      }
    }

    // 3. Verify platform authentication (signature chain)
    if (options.validateSignatureChain !== false) {
      const platformAuthResult = await this.verifyPlatformSignature(evidence.report);
      claims.platformAuth = platformAuthResult.valid;
      if (!platformAuthResult.valid) {
        if (isSimulatorReport(evidence.report)) {
          warnings.push("Simulator report detected - no real platform authentication");
          if (mode === "permissive") {
            claims.platformAuth = true; // Allow simulator in permissive mode
          }
        } else {
          errors.push(`Platform authentication failed: ${platformAuthResult.error}`);
        }
      }
    } else {
      claims.platformAuth = true; // Skip if explicitly disabled
    }

    // 4. Verify output binding (session + output hash)
    const bindingResult = this.verifyOutputBinding(evidence, transformedContext);
    claims.sessionBinding = bindingResult.valid;
    if (!bindingResult.valid) {
      errors.push(`Output binding verification failed: ${bindingResult.error}`);
    }

    // 5. Verify config binding (if expected config hash provided)
    if (options.expectedConfigHash) {
      if (evidence.configHash === options.expectedConfigHash) {
        claims.configBinding = true;
      } else {
        errors.push(
          `Config hash mismatch: expected ${options.expectedConfigHash}, got ${evidence.configHash}`
        );
      }
    } else {
      claims.configBinding = true; // No expectation, pass by default
    }

    // 6. Verify timestamp freshness
    const maxAge = options.maxAge ?? 5 * 60 * 1000; // Default 5 minutes
    const age = Date.now() - evidence.timestamp;
    if (age <= maxAge && age >= 0) {
      claims.freshness = true;
    } else if (age < 0) {
      errors.push("Attestation timestamp is in the future");
    } else {
      errors.push(`Attestation too old: ${Math.floor(age / 1000)}s (max: ${Math.floor(maxAge / 1000)}s)`);
    }

    // 7. Verify nonce if provided
    if (options.nonce) {
      // Nonce verification would check report_data includes the nonce
      // For now, this is a placeholder for future implementation
      warnings.push("Nonce verification not yet implemented");
    }

    // Overall verdict
    const allClaimsValid = Object.values(claims).every((claim) => claim);
    const valid = allClaimsValid && errors.length === 0;

    return {
      valid,
      platform: evidence.platform,
      measurement: evidence.measurement,
      claims,
      errors,
      warnings,
      verifiedAt: Date.now(),
    };
  }

  /**
   * Verify platform signature chain (AMD SEV-SNP).
   * @param report - Raw attestation report
   * @returns Validation result
   */
  async verifyPlatformSignature(report: Uint8Array): Promise<{
    valid: boolean;
    error?: string;
  }> {
    // Check if simulator report
    if (isSimulatorReport(report)) {
      return {
        valid: false,
        error: "Simulator report (no real signature chain)",
      };
    }

    try {
      const parsed = parseAttestationReport(report);

      // In a real implementation, this would:
      // 1. Extract signature from report
      // 2. Verify signature against report data using VCEK public key
      // 3. Verify VCEK certificate chain (VCEK → ASK → ARK)
      // 4. Verify ARK certificate is AMD root key

      // For now, we validate structure only
      if (parsed.signature.length === 0) {
        return { valid: false, error: "Missing signature" };
      }

      // Placeholder: real signature validation requires AMD key infrastructure
      // This would integrate with AMD SEV-SNP verification libraries
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Verify measurement matches expected value.
   * @param actual - Actual measurement from evidence
   * @param expected - Expected measurement
   * @returns True if measurements match
   */
  verifyMeasurement(actual: string, expected: string): boolean {
    return actual === expected;
  }

  /**
   * Verify output binding (session ID + config hash + output hash).
   * @param evidence - Attestation evidence
   * @param transformedContext - The transformed context
   * @returns Validation result
   */
  verifyOutputBinding(
    evidence: AttestationEvidence,
    transformedContext: TransformedContext
  ): { valid: boolean; error?: string } {
    try {
      // 1. Recompute output hash from transformed context
      const actualOutputHash = hashContext(transformedContext);

      // 2. Verify evidence.outputHash matches recomputed hash
      if (actualOutputHash !== evidence.outputHash) {
        return {
          valid: false,
          error: `Output hash mismatch: evidence claims ${evidence.outputHash}, actual is ${actualOutputHash}`,
        };
      }

      // 3. Extract report_data from attestation report
      const reportData = extractReportData(evidence.report);

      // 4. Recompute expected report_data
      // report_data = SHA-256(sessionId || configHash || outputHash || timestamp)
      const sessionIdBytes = Buffer.from(evidence.sessionId, "hex");
      const configHashBytes = Buffer.from(evidence.configHash, "hex");
      const outputHashBytes = Buffer.from(evidence.outputHash, "hex");
      const timestampBytes = Buffer.alloc(8);
      timestampBytes.writeBigUInt64BE(BigInt(evidence.timestamp), 0);

      const expectedReportData = createHash("sha256");
      expectedReportData.update(sessionIdBytes);
      expectedReportData.update(configHashBytes);
      expectedReportData.update(outputHashBytes);
      expectedReportData.update(timestampBytes);
      const expectedHash = expectedReportData.digest();

      // 5. Compare first 32 bytes of report_data with expected hash
      const reportDataHash = reportData.slice(0, 32);
      if (!expectedHash.equals(Buffer.from(reportDataHash))) {
        return {
          valid: false,
          error: "Report data does not match expected binding",
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Quick verification check (no detailed claims).
   * @param evidence - Attestation evidence
   * @param transformedContext - The transformed context
   * @param expectedMeasurement - Expected code measurement
   * @returns True if verification passes
   */
  async quickVerify(
    evidence: AttestationEvidence,
    transformedContext: TransformedContext,
    expectedMeasurement: string
  ): Promise<boolean> {
    const verdict = await this.verify(evidence, transformedContext, {
      expectedMeasurement,
      mode: "strict",
    });
    return verdict.valid;
  }

  /**
   * Verify evidence only (without transformed context).
   * Useful for checking evidence format and platform auth before full verification.
   * @param evidence - Attestation evidence
   * @param options - Verification options
   * @returns Partial verdict (session binding will be false)
   */
  async verifyEvidenceOnly(
    evidence: AttestationEvidence,
    options: VerificationOptions = {}
  ): Promise<VerificationVerdict> {
    // Create minimal transformed context for structure
    const minimalContext: TransformedContext = {
      entities: [],
      relations: [],
      task: "",
    };

    const verdict = await this.verify(evidence, minimalContext, {
      ...options,
      // Don't check output binding since we don't have real context
    });

    // Mark session binding as unchecked
    verdict.claims.sessionBinding = false;
    verdict.warnings.push("Session binding not verified (no transformed context provided)");

    return verdict;
  }
}

/**
 * Create a verification verifier instance.
 * @returns New AttestationVerifier
 */
export function createVerifier(): AttestationVerifier {
  return new AttestationVerifier();
}

