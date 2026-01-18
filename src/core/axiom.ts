import type {
  AxiomConfig,
  ReasonInput,
  ReasonResult,
} from "./config.ts";
import { ConfigurationError } from "./errors.ts";
import { Executor } from "../runtime/executor.ts";
import { assertNoNetworkAccess } from "../security/guarantees.ts";
import { Session } from "../runtime/session.ts";

/**
 * Axiom SDK main class.
 * Provides semantic transformation of raw input into non-identifying representations.
 *
 * This class is the primary public API of the SDK.
 * All transformation happens locally. No network calls are made.
 */
export class Axiom {
  private readonly config: AxiomConfig;
  private readonly executor: Executor;

  /**
   * Create a new Axiom instance.
   *
   * @param config - Configuration for the SDK
   * @throws ConfigurationError if configuration is invalid
   */
  constructor(config: AxiomConfig) {
    this.validateConfig(config);
    this.config = config;
    this.executor = new Executor(config);

    // Verify no network access at initialization
    assertNoNetworkAccess();
  }

  /**
   * Validate the provided configuration.
   * @throws ConfigurationError if configuration is invalid
   */
  private validateConfig(config: AxiomConfig): void {
    if (!config) {
      throw new ConfigurationError("Configuration is required");
    }

    if (config.securityTier !== "standard" && config.securityTier !== "attested") {
      throw new ConfigurationError(
        `Invalid securityTier: ${config.securityTier}. Must be "standard" or "attested".`
      );
    }

    if (config.enclave !== "auto" && config.enclave !== "required" && config.enclave !== "none") {
      throw new ConfigurationError(
        `Invalid enclave: ${config.enclave}. Must be "auto", "required", or "none".`
      );
    }

    if (config.policyVersion !== "v1") {
      throw new ConfigurationError(
        `Invalid policyVersion: ${config.policyVersion}. Must be "v1".`
      );
    }

    // Validate enclave + securityTier combinations
    if (config.securityTier === "attested" && config.enclave === "none") {
      throw new ConfigurationError(
        'Invalid configuration: securityTier "attested" requires enclave to be "auto" or "required"'
      );
    }
  }

  /**
   * Transform raw context into a non-identifying semantic representation.
   *
   * Pipeline: context → distiller → abstraction → masking → boundary validation
   *
   * @param input - Reasoning input with context, task, and optional model
   * @returns Result with transformed context and optional attestation evidence
   *
   * @remarks
   * - No network calls are performed
   * - No LLMs are called
   * - All transformation is local and deterministic
   * - Raw input never appears in the output
   * - Boundary violations fail explicitly
   * - Attested tier generates cryptographic attestation evidence
   */
  async reason(input: ReasonInput): Promise<ReasonResult> {
    this.validateReasonInput(input);

    // Create session for this execution
    const session = Session.create(this.config);

    // Route execution based on security tier
    if (this.config.securityTier === "attested") {
      return await this.executeAttested(input, session);
    } else {
      return await this.executeStandard(input, session);
    }
  }

  /**
   * Execute transformation in standard tier (software-only).
   * @private
   */
  private async executeStandard(
    input: ReasonInput,
    session: Session
  ): Promise<ReasonResult> {
    // Execute the transformation pipeline
    const transformedContext = this.executor.execute(
      input.context,
      input.task,
      input.model
    );

    // Compute output hash and bind to session
    const { hash } = await import("./canonical.ts");
    const outputHash = hash(transformedContext);
    session.setOutputHash(outputHash);
    session.finalize();

    // Return result without attestation evidence (standard tier)
    return {
      transformedContext,
      renderedPrompt: undefined, // Could add LLM prompt rendering here
    };
  }

  /**
   * Execute transformation in attested tier (TEE with attestation).
   * @private
   */
  private async executeAttested(
    input: ReasonInput,
    session: Session
  ): Promise<ReasonResult> {
    // Execute via enclave (will be routed by executor in next step)
    const result = await this.executor.executeAttested(
      input.context,
      input.task,
      input.model,
      session
    );

    return result;
  }

  /**
   * Validate the reason input.
   * @throws ConfigurationError if input is invalid
   */
  private validateReasonInput(input: ReasonInput): void {
    if (!input) {
      throw new ConfigurationError("Reason input is required");
    }

    if (!input.context) {
      throw new ConfigurationError("Context is required");
    }

    if (Array.isArray(input.context) && input.context.length === 0) {
      throw new ConfigurationError("Context array cannot be empty");
    }

    if (
      typeof input.context === "string" &&
      input.context.trim().length === 0
    ) {
      throw new ConfigurationError("Context cannot be empty");
    }

    if (!input.task || input.task.trim().length === 0) {
      throw new ConfigurationError("Task is required");
    }
  }

  /**
   * Get the current configuration.
   * Returns a copy to prevent mutation.
   */
  getConfig(): Readonly<AxiomConfig> {
    return { ...this.config };
  }
}

