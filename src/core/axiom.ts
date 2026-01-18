import type {
  AxiomConfig,
  ReasonInput,
  TransformedContext,
} from "./config.ts";
import { ConfigurationError } from "./errors.ts";
import { Executor } from "../runtime/executor.ts";
import { assertNoNetworkAccess } from "../security/guarantees.ts";

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
    this.executor = new Executor();

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

    if (config.securityTier !== "standard") {
      throw new ConfigurationError(
        `Invalid securityTier: ${config.securityTier}. Only "standard" is supported.`
      );
    }

    if (config.enclave !== "auto" && config.enclave !== "none") {
      throw new ConfigurationError(
        `Invalid enclave: ${config.enclave}. Must be "auto" or "none".`
      );
    }
  }

  /**
   * Transform raw context into a non-identifying semantic representation.
   *
   * Pipeline: context → distiller → abstraction → masking → boundary validation
   *
   * @param input - Reasoning input with context, task, and optional model
   * @returns Transformed context safe for boundary crossing
   *
   * @remarks
   * - No network calls are performed
   * - No LLMs are called
   * - All transformation is local and deterministic
   * - Raw input never appears in the output
   * - Boundary violations fail explicitly
   */
  async reason(input: ReasonInput): Promise<TransformedContext> {
    this.validateReasonInput(input);

    // Execute the transformation pipeline
    // The executor handles: distill → abstract → mask → validate
    const transformedContext = this.executor.execute(
      input.context,
      input.task,
      input.model
    );

    return transformedContext;
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

