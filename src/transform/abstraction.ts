import type { Entity, RawEntity } from "../entities/entity.ts";
import { Role } from "../entities/roles.ts";
import type { Relation } from "../entities/relations.ts";
import { TransformationError } from "../core/errors.ts";

/**
 * Semantic representation before masking.
 * Contains entities with original identifiers still present.
 */
export interface SemanticRepresentation {
  /**
   * Entities with roles assigned.
   */
  entities: Entity[];

  /**
   * Relations between entities.
   */
  relations: Relation[];
}

/**
 * Abstractor assigns semantic roles to entities and builds relations.
 * No masking is performed at this stage.
 */
export class Abstractor {
  /**
   * Convert raw entities into a semantic representation.
   * Assigns roles based on entity types and builds relations.
   *
   * @param rawEntities - Entities extracted by the distiller
   * @param rawContext - Original context for relation building
   * @returns Semantic representation with entities and relations
   */
  abstract(
    rawEntities: RawEntity[],
    rawContext: string
  ): SemanticRepresentation {
    if (rawEntities.length === 0) {
      throw new TransformationError(
        "Cannot abstract: no entities provided"
      );
    }

    const entities = this.assignRoles(rawEntities);
    const relations = this.buildRelations(entities, rawContext);

    return { entities, relations };
  }

  /**
   * Assign semantic roles to raw entities based on their type.
   */
  private assignRoles(rawEntities: RawEntity[]): Entity[] {
    return rawEntities.map((raw, index) => ({
      id: this.generateEntityId(raw, index),
      role: this.determineRole(raw),
      attributes: this.extractAttributes(raw),
    }));
  }

  /**
   * Generate a deterministic entity ID.
   * Uses the original text and position for uniqueness.
   */
  private generateEntityId(raw: RawEntity, index: number): string {
    return `${raw.entityType}_${index}_${raw.originalText}`;
  }

  /**
   * Determine the semantic role based on entity type.
   */
  private determineRole(raw: RawEntity): Role {
    switch (raw.entityType) {
      case "name":
        return Role.Actor;
      case "date":
        return Role.Temporal;
      case "currency":
        return Role.Value;
      case "number":
        return Role.Value;
      case "identifier":
        return Role.Participant;
      default:
        return Role.Participant;
    }
  }

  /**
   * Extract attributes from the raw entity.
   */
  private extractAttributes(raw: RawEntity): Record<string, string | number> {
    const attributes: Record<string, string | number> = {
      type: raw.entityType,
      position: raw.position,
    };

    // Parse numeric values from currency and number types
    if (raw.entityType === "currency") {
      const numericValue = this.parseCurrencyValue(raw.originalText);
      if (numericValue !== null) {
        attributes.numericValue = numericValue;
      }
    } else if (raw.entityType === "number") {
      const parsed = parseFloat(raw.originalText);
      if (!isNaN(parsed)) {
        attributes.numericValue = parsed;
      }
    }

    return attributes;
  }

  /**
   * Parse numeric value from currency string.
   */
  private parseCurrencyValue(text: string): number | null {
    const cleaned = text.replace(/[$€£¥,\s]|USD|EUR|GBP|JPY/g, "");
    const value = parseFloat(cleaned);
    return isNaN(value) ? null : value;
  }

  /**
   * Build relations between entities based on context proximity.
   * Entities that appear close together in the text are considered related.
   */
  private buildRelations(entities: Entity[], rawContext: string): Relation[] {
    const relations: Relation[] = [];
    const proximityThreshold = 100; // Characters

    for (let i = 0; i < entities.length; i++) {
      const entityA = entities[i];
      const positionA = entityA.attributes.position;
      if (typeof positionA !== "number") continue;

      for (let j = i + 1; j < entities.length; j++) {
        const entityB = entities[j];
        const positionB = entityB.attributes.position;
        if (typeof positionB !== "number") continue;

        const distance = Math.abs(positionB - positionA);

        if (distance <= proximityThreshold) {
          relations.push({
            type: this.inferRelationType(entityA, entityB, rawContext),
            from: entityA.id,
            to: entityB.id,
          });
        }
      }
    }

    return relations;
  }

  /**
   * Infer the type of relation between two entities.
   */
  private inferRelationType(
    entityA: Entity,
    entityB: Entity,
    _rawContext: string
  ): string {
    // Infer based on role combinations
    if (entityA.role === Role.Actor && entityB.role === Role.Value) {
      return "owns";
    }
    if (entityA.role === Role.Actor && entityB.role === Role.Temporal) {
      return "scheduled";
    }
    if (entityA.role === Role.Actor && entityB.role === Role.Participant) {
      return "references";
    }
    if (entityA.role === Role.Value && entityB.role === Role.Temporal) {
      return "dated";
    }
    if (entityA.role === Role.Temporal && entityB.role === Role.Temporal) {
      return "precedes";
    }

    return "related";
  }
}

