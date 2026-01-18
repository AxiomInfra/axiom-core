/**
 * Configuration for the Axiom SDK.
 * All fields are required. No defaults are applied.
 */
export interface AxiomConfig {
  /**
   * Security tier for the SDK.
   * Currently only "standard" is supported.
   */
  securityTier: "standard";

  /**
   * Enclave execution mode.
   * - "auto": Attempt hardware-backed execution if available
   * - "none": No enclave isolation
   */
  enclave: "auto" | "none";
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
 * Result of semantic transformation.
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

