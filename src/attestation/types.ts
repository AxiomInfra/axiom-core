/**
 * Attestation types for Axiom SDK v1.0.
 * Defines evidence format and verification verdicts for TEE attestation.
 */

/**
 * Attestation evidence from TEE execution.
 * Proves that transformation occurred in a trusted execution environment.
 */
export interface AttestationEvidence {
  /**
   * TEE platform type.
   */
  platform: "sev-snp";

  /**
   * Raw attestation report from AMD SEV-SNP platform.
   * Contains measurement, signature chain, and custom data.
   */
  report: Uint8Array;

  /**
   * Measurement of enclave code (hex-encoded SHA-384).
   * This is the hash of the enclave binary that executed.
   */
  measurement: string;

  /**
   * Hash of the AxiomConfig used for this execution.
   * Binds configuration to attestation.
   */
  configHash: string;

  /**
   * Unique session identifier (128-bit random, hex-encoded).
   * Prevents replay attacks.
   */
  sessionId: string;

  /**
   * Hash of the transformed context output (SHA-256, hex-encoded).
   * Binds output to this specific execution.
   */
  outputHash: string;

  /**
   * Unix timestamp (milliseconds) when attestation was generated.
   */
  timestamp: number;

  /**
   * Optional enclave signature over (sessionId || configHash || outputHash).
   * Additional binding when platform supports it.
   */
  signature?: Uint8Array;

  /**
   * Version of the attestation format.
   */
  version: "1.0";
}

/**
 * Verification verdict from attestation validation.
 * Indicates whether the attestation evidence is valid and trusted.
 */
export interface VerificationVerdict {
  /**
   * Overall validation result.
   * True if all critical claims are satisfied.
   */
  valid: boolean;

  /**
   * Platform that generated the attestation.
   */
  platform: "sev-snp";

  /**
   * Actual measurement found in the attestation report.
   */
  measurement: string;

  /**
   * Individual validation claims.
   * Each claim represents a specific security property.
   */
  claims: {
    /**
     * Code identity verification.
     * True if measurement matches expected value.
     */
    codeIdentity: boolean;

    /**
     * Platform authentication.
     * True if AMD SEV-SNP signature chain is valid.
     */
    platformAuth: boolean;

    /**
     * Session binding verification.
     * True if output hash is correctly bound to session.
     */
    sessionBinding: boolean;

    /**
     * Timestamp freshness check.
     * True if attestation timestamp is within acceptable window.
     */
    freshness: boolean;

    /**
     * Report structure validation.
     * True if report format is correct and parseable.
     */
    reportStructure: boolean;

    /**
     * Configuration binding.
     * True if config hash matches expected.
     */
    configBinding: boolean;
  };

  /**
   * Detailed error messages if validation failed.
   * Empty array if valid === true.
   */
  errors: string[];

  /**
   * Warnings (non-critical issues).
   * May be present even when valid === true in permissive mode.
   */
  warnings: string[];

  /**
   * Timestamp when verification was performed.
   */
  verifiedAt: number;
}

/**
 * Verification options for customizing validation behavior.
 */
export interface VerificationOptions {
  /**
   * Expected measurement value.
   * If provided, codeIdentity claim requires exact match.
   */
  expectedMeasurement?: string;

  /**
   * Expected config hash.
   * If provided, configBinding claim requires exact match.
   */
  expectedConfigHash?: string;

  /**
   * Maximum age of attestation in milliseconds.
   * Default: 300000 (5 minutes)
   */
  maxAge?: number;

  /**
   * Whether to validate the full AMD signature chain.
   * Default: true
   */
  validateSignatureChain?: boolean;

  /**
   * Verification mode.
   * - "strict": All claims must pass
   * - "permissive": Some non-critical claims can fail with warnings
   */
  mode?: "strict" | "permissive";

  /**
   * Custom nonce for freshness verification (optional).
   */
  nonce?: string;
}

/**
 * Session metadata tracked during execution.
 * Used internally by the SDK to bind attestation to execution.
 */
export interface SessionMetadata {
  /**
   * Unique session identifier.
   */
  sessionId: string;

  /**
   * Hash of the configuration used.
   */
  configHash: string;

  /**
   * Timestamp when session was created.
   */
  createdAt: number;

  /**
   * Security tier for this session.
   */
  securityTier: "standard" | "attested";

  /**
   * Whether enclave was actually used.
   */
  enclaveUsed: boolean;

  /**
   * Platform type if enclave was used.
   */
  platform?: "sev-snp";
}

/**
 * Enclave execution request.
 * Input to the native enclave runner.
 */
export interface EnclaveRequest {
  /**
   * Raw context to transform (UTF-8 encoded).
   */
  rawContext: Uint8Array;

  /**
   * Task hint (optional, should be non-sensitive).
   */
  taskHint?: string;

  /**
   * Masking policy parameters.
   */
  policy: {
    /**
     * Policy version.
     */
    version: "v1";

    /**
     * Whether to allow common words in output.
     */
    allowCommonWords: boolean;

    /**
     * Maximum input size in bytes.
     */
    maxInputSize: number;
  };

  /**
   * Session ID for this request (128-bit).
   */
  sessionId: Uint8Array;

  /**
   * Configuration hash for binding.
   */
  configHash: string;

  /**
   * Random nonce (256-bit).
   */
  nonce: Uint8Array;

  /**
   * Attestation timestamp for binding (milliseconds since epoch).
   */
  timestamp: number;
}

/**
 * Enclave execution response.
 * Output from the native enclave runner.
 */
export interface EnclaveResponse {
  /**
   * Transformed context (canonical JSON, UTF-8 encoded).
   */
  transformedContext: Uint8Array;

  /**
   * SHA-256 hash of the transformed context.
   */
  outputHash: Uint8Array;

  /**
   * Raw attestation report from platform.
   */
  attestationReport: Uint8Array;

  /**
   * Redaction statistics (counts only, no content).
   */
  redactionStats: {
    /**
     * Number of entities extracted and masked.
     */
    entityCount: number;

    /**
     * Number of relations built.
     */
    relationCount: number;

    /**
     * Number of identifiers replaced.
     */
    identifiersReplaced: number;
  };

  /**
   * Measurement of the enclave code.
   */
  measurement: string;

  /**
   * Optional signature from enclave.
   */
  signature?: Uint8Array;
}

/**
 * Error from enclave execution.
 */
export interface EnclaveError {
  /**
   * Error code.
   */
  code: "ENCLAVE_UNAVAILABLE" | "TRANSFORM_FAILED" | "ATTESTATION_FAILED" | "INPUT_TOO_LARGE" | "INVALID_CONFIG";

  /**
   * Human-readable error message.
   */
  message: string;

  /**
   * Additional context (safe to log).
   */
  details?: Record<string, unknown>;
}

/**
 * Parsed AMD SEV-SNP attestation report structure.
 * Simplified representation of the actual report format.
 */
export interface ParsedAttestationReport {
  /**
   * Report version.
   */
  version: number;

  /**
   * Guest policy.
   */
  guestPolicy: number;

  /**
   * Measurement (SHA-384 of initial state).
   */
  measurement: string;

  /**
   * Host data (custom data embedded in report).
   */
  hostData: Uint8Array;

  /**
   * Report data (custom data embedded in report).
   */
  reportData: Uint8Array;

  /**
   * Platform version.
   */
  platformVersion: {
    bootLoader: number;
    tee: number;
    snp: number;
    microcode: number;
  };

  /**
   * Report signature (ECDSA P-384).
   */
  signature: Uint8Array;

  /**
   * Signing key certificate chain.
   */
  certificates?: Uint8Array[];
}

