/**
 * Semantic roles that can be assigned to entities.
 * These represent the function of an entity within the context.
 */
export const Role = {
  /**
   * An active agent performing actions.
   */
  Actor: "Actor",

  /**
   * An entity involved in but not driving actions.
   */
  Participant: "Participant",

  /**
   * A requirement, duty, or constraint.
   */
  Obligation: "Obligation",

  /**
   * A numeric or qualitative value.
   */
  Value: "Value",

  /**
   * A time-related entity (dates, durations, deadlines).
   */
  Temporal: "Temporal",
} as const;

/**
 * Type representing valid role values.
 */
export type Role = (typeof Role)[keyof typeof Role];
