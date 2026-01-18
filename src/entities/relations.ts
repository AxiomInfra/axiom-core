/**
 * Represents a relationship between two entities.
 * Relations connect entities using their IDs.
 */
export interface Relation {
  /**
   * The type of relationship.
   * Examples: "owns", "references", "precedes", "contains"
   */
  type: string;

  /**
   * The ID of the source entity.
   */
  from: string;

  /**
   * The ID of the target entity.
   */
  to: string;
}

