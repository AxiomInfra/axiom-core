import type { TransformedContext, ReasonResult, AxiomConfig } from "../core/config.ts";
import { Distiller } from "../transform/distiller.ts";
import { Abstractor } from "../transform/abstraction.ts";
import { Masker } from "../transform/masking.ts";
import { BoundaryValidator } from "./boundary.ts";
import { clearReference } from "./memory.ts";
import { EnclaveBridge, createEnclaveBridge } from "./enclave-bridge.ts";
import type { Session } from "./session.ts";
import type { EnclaveRequest } from "../attestation/types.ts";
import { ConfigurationError } from "../core/errors.ts";
import { hash as hashContext } from "../core/canonical.ts";

/**
 * Executor coordinates the semantic transformation pipeline.
 * Supports both standard (software-only) and attested (TEE) execution modes.
 * Linear flow: distiller → abstraction → masking → boundary validation.
 * No retries. No concurrency. No side effects.
 */
export class Executor {
  private readonly distiller: Distiller;
  private readonly abstractor: Abstractor;
  private readonly masker: Masker;
  private readonly boundaryValidator: BoundaryValidator;
  private readonly config: AxiomConfig;
  private enclaveBridge?: EnclaveBridge;

  constructor(config: AxiomConfig) {
    this.config = config;
    this.distiller = new Distiller();
    this.abstractor = new Abstractor();
    this.masker = new Masker();
    this.boundaryValidator = new BoundaryValidator();
  }

  /**
   * Execute the semantic transformation pipeline in standard mode.
   *
   * @param context - Raw context input (string or array of strings)
   * @param task - The reasoning task to perform
   * @param model - Optional model identifier
   * @returns Transformed context safe for boundary crossing
   */
  execute(
    context: string | string[],
    task: string,
    model?: string
  ): TransformedContext {
    // Normalize input to array for consistent processing
    const rawInputs = Array.isArray(context) ? context : [context];
    const combinedContext = rawInputs.join("\n");

    // Stage 1: Distillation - extract entities from raw text
    const rawEntities = this.distiller.distill(combinedContext);

    // Stage 2: Abstraction - assign roles and build relations
    const semanticRepresentation = this.abstractor.abstract(
      rawEntities,
      combinedContext
    );

    // Stage 3: Masking - remove identifiers, replace with synthetic IDs
    const maskedRepresentation = this.masker.mask(
      semanticRepresentation,
      rawInputs
    );

    // Stage 4: Boundary validation - ensure no raw data leaks
    this.boundaryValidator.validate(maskedRepresentation, rawInputs);

    // Build the transformed context
    const transformedContext: TransformedContext = {
      entities: maskedRepresentation.entities,
      relations: maskedRepresentation.relations,
      task,
      model,
    };

    // Clear intermediate references (best-effort zero-retention)
    clearReference(rawEntities);
    clearReference(semanticRepresentation);

    return transformedContext;
  }

  /**
   * Execute the semantic transformation pipeline in attested mode (TEE).
   *
   * @param context - Raw context input
   * @param task - The reasoning task
   * @param model - Optional model identifier
   * @param session - Session for binding attestation
   * @returns Result with transformed context and attestation evidence
   */
  async executeAttested(
    context: string | string[],
    task: string,
    model: string | undefined,
    session: Session
  ): Promise<ReasonResult> {
    // Initialize enclave bridge if not already done
    if (!this.enclaveBridge) {
      this.enclaveBridge = await this.initializeEnclaveBridge();
    }

    // Check enclave availability
    const available = await this.enclaveBridge.isAvailable();
    if (!available) {
      if (this.config.enclave === "required") {
        throw new ConfigurationError(
          "Enclave execution required but not available"
        );
      }
      // Fallback to standard execution if enclave is "auto"
      const transformedContext = this.execute(context, task, model);
      return { transformedContext };
    }

    // Prepare enclave request
    const rawInputs = Array.isArray(context) ? context : [context];
    const combinedContext = rawInputs.join("\n");
    
    const request: EnclaveRequest = {
      rawContext: new TextEncoder().encode(combinedContext),
      taskHint: task,
      policy: {
        version: "v1",
        allowCommonWords: true,
        maxInputSize: 10 * 1024 * 1024, // 10 MB
      },
      sessionId: Buffer.from(session.sessionId, "hex"),
      configHash: session.configHash,
      nonce: Buffer.from(session.nonce || "00".repeat(32), "hex"),
      timestamp: session.createdAt,
    };

    // Execute in enclave
    const response = await this.enclaveBridge.execute(request);

    // Parse transformed context from enclave response
    const transformedJson = new TextDecoder().decode(response.transformedContext);
    const transformedContext: TransformedContext = JSON.parse(transformedJson);

    // Add task and model (enclave doesn't include these)
    transformedContext.task = task;
    transformedContext.model = model;

    // Compute and verify output hash
    const outputHash = hashContext(transformedContext);
    session.setOutputHash(outputHash);

    // Mark session as using enclave
    session.setEnclaveUsed(this.enclaveBridge.getPlatform() === "sev-snp" ? "sev-snp" : "sev-snp");

    // Create attestation evidence
    const attestationEvidence = this.enclaveBridge.createEvidence(
      response,
      session.sessionId,
      session.configHash,
      request.timestamp
    );

    // Finalize session
    session.finalize();

    // Return result with evidence
    return {
      transformedContext,
      attestationEvidence,
      verificationHint: {
        expectedMeasurement: response.measurement,
        platform: "sev-snp",
        timestamp: Date.now(),
      },
    };
  }

  /**
   * Initialize enclave bridge based on configuration.
   * @private
   */
  private async initializeEnclaveBridge(): Promise<EnclaveBridge> {
    const preferNative = this.config.enclave !== "none";
    return await createEnclaveBridge(preferNative);
  }
}

