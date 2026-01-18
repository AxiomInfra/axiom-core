import type { Entity } from "../entities/entity.ts";
import type { Relation } from "../entities/relations.ts";
import type { SemanticRepresentation } from "./abstraction.ts";
import { BoundaryViolationError } from "../core/errors.ts";

/**
 * Masked entity with synthetic ID.
 * No raw identifiers remain.
 */
export interface MaskedEntity {
  /**
   * Synthetic stable ID (e.g., "ENTITY_0001").
   */
  syntheticId: string;

  /**
   * The semantic role.
   */
  role: string;

  /**
   * Attributes with identifiers removed.
   */
  attributes: Record<string, string | number>;
}

/**
 * Masked relation using synthetic IDs.
 */
export interface MaskedRelation {
  /**
   * The type of relationship.
   */
  type: string;

  /**
   * Synthetic ID of source entity.
   */
  from: string;

  /**
   * Synthetic ID of target entity.
   */
  to: string;
}

/**
 * Fully masked representation.
 * Safe to cross the local-to-cloud boundary.
 */
export interface MaskedRepresentation {
  /**
   * Masked entities with synthetic IDs.
   */
  entities: MaskedEntity[];

  /**
   * Relations using synthetic IDs.
   */
  relations: MaskedRelation[];
}

/**
 * Masker removes all identifying information from the semantic representation.
 * Replaces raw identifiers with deterministic synthetic IDs.
 * Fails fast if any raw identifier remains after masking.
 */
export class Masker {
  /**
   * Mapping from original entity IDs to synthetic IDs.
   */
  private idMapping: Map<string, string> = new Map();

  /**
   * Counter for generating synthetic IDs.
   */
  private syntheticIdCounter = 0;

  /**
   * Mask the semantic representation.
   * Removes all raw identifiers and replaces with synthetic IDs.
   *
   * @param representation - Semantic representation with raw identifiers
   * @param rawInputs - Original raw input strings for validation
   * @returns Masked representation safe for boundary crossing
   * @throws BoundaryViolationError if any raw identifier remains
   */
  mask(
    representation: SemanticRepresentation,
    rawInputs: string[]
  ): MaskedRepresentation {
    // Reset state for each mask operation
    this.idMapping.clear();
    this.syntheticIdCounter = 0;

    // Extract all raw identifiers from entities
    const rawIdentifiers = this.extractRawIdentifiers(representation.entities);

    // Build ID mapping
    for (const entity of representation.entities) {
      const syntheticId = this.generateSyntheticId();
      this.idMapping.set(entity.id, syntheticId);
    }

    // Mask entities
    const maskedEntities = representation.entities.map((entity) =>
      this.maskEntity(entity, rawIdentifiers)
    );

    // Mask relations
    const maskedRelations = representation.relations.map((relation) =>
      this.maskRelation(relation)
    );

    const result: MaskedRepresentation = {
      entities: maskedEntities,
      relations: maskedRelations,
    };

    // Verify no raw data leaked
    this.verifyNoRawDataLeakage(result, rawInputs, rawIdentifiers);

    return result;
  }

  /**
   * Generate a deterministic synthetic ID.
   */
  private generateSyntheticId(): string {
    const id = `ENTITY_${String(this.syntheticIdCounter).padStart(4, "0")}`;
    this.syntheticIdCounter++;
    return id;
  }

  /**
   * Extract all raw identifiers from entities.
   */
  private extractRawIdentifiers(entities: Entity[]): Set<string> {
    const identifiers = new Set<string>();

    for (const entity of entities) {
      // The entity ID contains the original text
      const parts = entity.id.split("_");
      if (parts.length >= 3) {
        // Original text is everything after type_index_
        const originalText = parts.slice(2).join("_");
        if (originalText.length > 0) {
          identifiers.add(originalText);
        }
      }

      // Check attributes for string values that might be identifiers
      // Exclude known safe values
      for (const value of Object.values(entity.attributes)) {
        if (
          typeof value === "string" &&
          value.length > 2 &&
          !this.isSafeAttributeValue(value)
        ) {
          identifiers.add(value);
        }
      }
    }

    return identifiers;
  }

  /**
   * Mask a single entity.
   */
  private maskEntity(
    entity: Entity,
    rawIdentifiers: Set<string>
  ): MaskedEntity {
    const syntheticId = this.idMapping.get(entity.id);
    if (!syntheticId) {
      throw new BoundaryViolationError(
        "Entity ID not found in mapping - masking state corrupted"
      );
    }

    // Mask attributes - remove any that contain raw identifiers
    const maskedAttributes: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(entity.attributes)) {
      if (typeof value === "number") {
        // Numeric values are safe to pass through
        maskedAttributes[key] = value;
      } else if (typeof value === "string") {
        // Check if the string value is a raw identifier
        if (rawIdentifiers.has(value)) {
          // Skip this attribute - it contains raw data
          continue;
        }
        // Check if it's a safe enumerated value
        if (this.isSafeAttributeValue(value)) {
          maskedAttributes[key] = value;
        }
        // Otherwise, skip the attribute
      }
    }

    return {
      syntheticId,
      role: entity.role,
      attributes: maskedAttributes,
    };
  }

  /**
   * Check if an attribute value is safe to include.
   */
  private isSafeAttributeValue(value: string): boolean {
    // Allow-list of safe attribute values
    const safeValues = new Set([
      "name",
      "number",
      "date",
      "currency",
      "identifier",
    ]);
    return safeValues.has(value);
  }

  /**
   * Mask a relation by replacing entity IDs with synthetic IDs.
   */
  private maskRelation(relation: Relation): MaskedRelation {
    const fromSynthetic = this.idMapping.get(relation.from);
    const toSynthetic = this.idMapping.get(relation.to);

    if (!fromSynthetic || !toSynthetic) {
      throw new BoundaryViolationError(
        "Relation references unknown entity ID - masking state corrupted"
      );
    }

    return {
      type: relation.type,
      from: fromSynthetic,
      to: toSynthetic,
    };
  }

  /**
   * Verify that no raw data leaked into the masked representation.
   * @throws BoundaryViolationError if any raw data is detected
   */
  private verifyNoRawDataLeakage(
    result: MaskedRepresentation,
    rawInputs: string[],
    rawIdentifiers: Set<string>
  ): void {
    const serialized = JSON.stringify(result);

    // Check for any raw identifier in the output
    for (const identifier of rawIdentifiers) {
      if (identifier.length >= 3 && serialized.includes(identifier)) {
        throw new BoundaryViolationError(
          `Raw identifier leaked through masking: detected in output`
        );
      }
    }

    // Check for any significant substring from raw inputs
    for (const input of rawInputs) {
      // Check for substrings of significant length (3+ chars)
      const words = input.match(/\b\w{3,}\b/g) || [];
      for (const word of words) {
        // Skip common words and safe values
        if (this.isCommonWord(word)) continue;

        // Check if this word appears as a capitalized name or identifier
        if (/^[A-Z][a-z]+/.test(word) && serialized.includes(word)) {
          throw new BoundaryViolationError(
            `Raw text leaked through masking: potential name detected`
          );
        }
      }
    }
  }

  /**
   * Check if a word is common enough to not be considered identifying.
   */
  private isCommonWord(word: string): boolean {
    const commonWords = new Set([
      "the",
      "and",
      "for",
      "are",
      "but",
      "not",
      "you",
      "all",
      "can",
      "had",
      "her",
      "was",
      "one",
      "our",
      "out",
      "has",
      "his",
      "how",
      "its",
      "may",
      "new",
      "now",
      "old",
      "see",
      "way",
      "who",
      "did",
      "get",
      "let",
      "put",
      "say",
      "she",
      "too",
      "use",
      "type",
      "role",
      "from",
      "owns",
      "related",
      "scheduled",
      "references",
      "dated",
      "precedes",
      "name",
      "number",
      "date",
      "currency",
      "identifier",
      "position",
      "numericValue",
      "syntheticId",
      "attributes",
      "entities",
      "relations",
      "ENTITY",
    ]);
    return commonWords.has(word.toLowerCase()) || commonWords.has(word);
  }
}

