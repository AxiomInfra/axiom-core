import type { MaskedRepresentation } from "../transform/masking.ts";
import { BoundaryViolationError } from "../core/errors.ts";

/**
 * Allow-list of fields that may be serialized.
 * Any field not on this list will cause a boundary violation.
 */
const ALLOWED_SERIALIZABLE_FIELDS = new Set([
  "syntheticId",
  "role",
  "attributes",
  "type",
  "from",
  "to",
  "entities",
  "relations",
  "position",
  "numericValue",
]);

/**
 * Allow-list of attribute values that may be serialized.
 */
const ALLOWED_ATTRIBUTE_VALUES = new Set([
  "name",
  "number",
  "date",
  "currency",
  "identifier",
  "Actor",
  "Participant",
  "Obligation",
  "Value",
  "Temporal",
  "owns",
  "references",
  "scheduled",
  "dated",
  "precedes",
  "related",
]);

/**
 * BoundaryValidator ensures transformed context is safe to cross the local-to-cloud boundary.
 * Validates that no raw input data can be serialized.
 * Enforces explicit allow-list serialization.
 */
export class BoundaryValidator {
  /**
   * Validate that the masked representation is safe for boundary crossing.
   *
   * @param masked - The masked representation to validate
   * @param rawInputs - Original raw input strings
   * @throws BoundaryViolationError if any raw data could leak
   */
  validate(masked: MaskedRepresentation, rawInputs: string[]): void {
    // Validate structure against allow-list
    this.validateStructure(masked);

    // Validate no raw input substrings appear in output
    this.validateNoRawSubstrings(masked, rawInputs);

    // Validate all string values are from allow-list or synthetic IDs
    this.validateStringValues(masked);
  }

  /**
   * Validate the structure of the masked representation.
   */
  private validateStructure(masked: MaskedRepresentation): void {
    // Validate top-level keys
    const topLevelKeys = Object.keys(masked);
    for (const key of topLevelKeys) {
      if (!ALLOWED_SERIALIZABLE_FIELDS.has(key)) {
        throw new BoundaryViolationError(
          `Unexpected field in masked representation: ${key}`
        );
      }
    }

    // Validate entity structure
    for (const entity of masked.entities) {
      const entityKeys = Object.keys(entity);
      for (const key of entityKeys) {
        if (!ALLOWED_SERIALIZABLE_FIELDS.has(key)) {
          throw new BoundaryViolationError(
            `Unexpected field in masked entity: ${key}`
          );
        }
      }

      // Validate attribute keys
      for (const attrKey of Object.keys(entity.attributes)) {
        if (!ALLOWED_SERIALIZABLE_FIELDS.has(attrKey)) {
          throw new BoundaryViolationError(
            `Unexpected attribute key in masked entity: ${attrKey}`
          );
        }
      }
    }

    // Validate relation structure
    for (const relation of masked.relations) {
      const relationKeys = Object.keys(relation);
      for (const key of relationKeys) {
        if (!ALLOWED_SERIALIZABLE_FIELDS.has(key)) {
          throw new BoundaryViolationError(
            `Unexpected field in masked relation: ${key}`
          );
        }
      }
    }
  }

  /**
   * Validate that no raw input substrings appear in the output.
   */
  private validateNoRawSubstrings(
    masked: MaskedRepresentation,
    rawInputs: string[]
  ): void {
    const serialized = JSON.stringify(masked);

    for (const input of rawInputs) {
      // Extract significant substrings (names, identifiers)
      const significantPatterns = [
        /\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]+)*\b/g, // Names
        /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
        /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g, // Email
        /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, // Phone
      ];

      for (const pattern of significantPatterns) {
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(input)) !== null) {
          const potentialLeak = match[0];
          if (
            potentialLeak.length >= 3 &&
            !this.isSafeValue(potentialLeak) &&
            serialized.includes(potentialLeak)
          ) {
            throw new BoundaryViolationError(
              `Raw input substring detected in output: boundary violation`
            );
          }
        }
      }
    }
  }

  /**
   * Validate all string values are from allow-list or are synthetic IDs.
   */
  private validateStringValues(masked: MaskedRepresentation): void {
    for (const entity of masked.entities) {
      // Validate syntheticId format
      if (!this.isSyntheticId(entity.syntheticId)) {
        throw new BoundaryViolationError(
          `Invalid synthetic ID format: ${entity.syntheticId}`
        );
      }

      // Validate role is from allow-list
      if (!ALLOWED_ATTRIBUTE_VALUES.has(entity.role)) {
        throw new BoundaryViolationError(
          `Invalid role value: ${entity.role}`
        );
      }

      // Validate attribute values
      for (const [key, value] of Object.entries(entity.attributes)) {
        if (typeof value === "string" && !ALLOWED_ATTRIBUTE_VALUES.has(value)) {
          throw new BoundaryViolationError(
            `Invalid attribute value for ${key}: not in allow-list`
          );
        }
      }
    }

    for (const relation of masked.relations) {
      // Validate relation type
      if (!ALLOWED_ATTRIBUTE_VALUES.has(relation.type)) {
        throw new BoundaryViolationError(
          `Invalid relation type: ${relation.type}`
        );
      }

      // Validate from/to are synthetic IDs
      if (!this.isSyntheticId(relation.from)) {
        throw new BoundaryViolationError(
          `Invalid synthetic ID in relation.from: ${relation.from}`
        );
      }
      if (!this.isSyntheticId(relation.to)) {
        throw new BoundaryViolationError(
          `Invalid synthetic ID in relation.to: ${relation.to}`
        );
      }
    }
  }

  /**
   * Check if a value is a valid synthetic ID.
   */
  private isSyntheticId(value: string): boolean {
    return /^ENTITY_\d{4}$/.test(value);
  }

  /**
   * Check if a value is safe (in allow-list or synthetic).
   */
  private isSafeValue(value: string): boolean {
    return ALLOWED_ATTRIBUTE_VALUES.has(value) || this.isSyntheticId(value);
  }
}

