/**
 * Configuration for the Axiom SDK.
 * All fields are required. No defaults are applied.
 */
export interface AxiomConfig {
  /**
   * Security tier for the SDK.
   * - "standard": Software boundary enforcement only
   * - "attested": TEE hardware isolation + cryptographic attestation
   */
  securityTier: "standard" | "attested";

  /**
   * Enclave execution mode.
   * - "auto": Attempt hardware-backed execution if available
   * - "required": Fail if enclave unavailable
   * - "none": Explicitly disable enclave (standard tier only)
   */
  enclave: "auto" | "required" | "none";

  /**
   * Policy version identifier.
   * Must be "v1" for current implementation.
   */
  policyVersion: "v1";

  /**
   * Platform-specific configuration (optional).
   */
  platform?: {
    /**
     * TEE platform type.
     */
    type: "sev-snp";

    /**
     * Verification mode for attestation.
     * - "strict": Fail on any verification issue
     * - "permissive": Warn but continue on non-critical issues
     */
    verificationMode: "strict" | "permissive";
  };
}

/**
 * Input parameters for the reason() method.
 */
export interface ReasonInput {
  /**
   * Raw context to be transformed.
   * Can be a single string or an array of strings.
   */
  context: string | string[];

  /**
   * The reasoning task to perform.
   */
  task: string;

  /**
   * Optional model identifier.
   * Note: No network calls are made by the SDK.
   */
  model?: string;
}

/**
 * Result of semantic transformation with optional attestation.
 * Contains only non-identifying information.
 */
export interface TransformedContext {
  /**
   * Synthetic entities with roles assigned.
   */
  entities: Array<{
    syntheticId: string;
    role: string;
    attributes: Record<string, string | number>;
  }>;

  /**
   * Relations between entities (using synthetic IDs).
   */
  relations: Array<{
    type: string;
    from: string;
    to: string;
  }>;

  /**
   * The reasoning task (passed through).
   */
  task: string;

  /**
   * Model identifier if provided (passed through).
   */
  model?: string;
}

/**
 * Result from reason() method including optional attestation evidence.
 */
export interface ReasonResult {
  /**
   * The transformed, de-identified context.
   */
  transformedContext: TransformedContext;

  /**
   * Optional rendered prompt ready for LLM consumption.
   */
  renderedPrompt?: string;

  /**
   * Attestation evidence (present when securityTier is "attested").
   */
  attestationEvidence?: AttestationEvidence;

  /**
   * Verification hint for consumers.
   */
  verificationHint?: {
    expectedMeasurement: string;
    platform: "sev-snp";
    timestamp: number;
  };
}

/**
 * Attestation evidence from TEE execution.
 */
export interface AttestationEvidence {
  /**
   * TEE platform type.
   */
  platform: "sev-snp";

  /**
   * Raw attestation report from platform.
   */
  report: Uint8Array;

  /**
   * Measurement of enclave code (hex-encoded).
   */
  measurement: string;

  /**
   * Hash of the AxiomConfig used for this execution.
   */
  configHash: string;

  /**
   * Unique session identifier (128-bit random).
   */
  sessionId: string;

  /**
   * Hash of the transformed context output.
   */
  outputHash: string;

  /**
   * Unix timestamp (milliseconds).
   */
  timestamp: number;

  /**
   * Optional enclave signature over session data.
   */
  signature?: Uint8Array;
}

