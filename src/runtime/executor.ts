import type { TransformedContext } from "../core/config.ts";
import { Distiller } from "../transform/distiller.ts";
import { Abstractor } from "../transform/abstraction.ts";
import { Masker } from "../transform/masking.ts";
import { BoundaryValidator } from "./boundary.ts";
import { clearReference } from "./memory.ts";

/**
 * Executor coordinates the semantic transformation pipeline.
 * Linear flow: distiller → abstraction → masking → boundary validation.
 * No retries. No concurrency. No side effects.
 */
export class Executor {
  private readonly distiller: Distiller;
  private readonly abstractor: Abstractor;
  private readonly masker: Masker;
  private readonly boundaryValidator: BoundaryValidator;

  constructor() {
    this.distiller = new Distiller();
    this.abstractor = new Abstractor();
    this.masker = new Masker();
    this.boundaryValidator = new BoundaryValidator();
  }

  /**
   * Execute the semantic transformation pipeline.
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
}

