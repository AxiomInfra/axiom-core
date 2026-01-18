import type { Role } from "./roles.ts";

/**
 * Represents a discrete semantic entity extracted from context.
 * Entities are assigned roles and may carry attributes.
 */
export interface Entity {
  /**
   * Unique identifier for this entity.
   * Before masking: may contain raw identifiers.
   * After masking: contains only synthetic IDs.
   */
  id: string;

  /**
   * The semantic role of this entity.
   */
  role: Role;

  /**
   * Attributes associated with this entity.
   * Keys are attribute names, values are strings or numbers.
   */
  attributes: Record<string, string | number>;
}

/**
 * Internal representation of an extracted entity before role assignment.
 * Used during the distillation phase.
 */
export interface RawEntity {
  /**
   * The original text that was extracted.
   */
  originalText: string;

  /**
   * The type of entity detected by heuristics.
   */
  entityType: "name" | "number" | "date" | "currency" | "identifier";

  /**
   * Position in the original text (for relation building).
   */
  position: number;
}

