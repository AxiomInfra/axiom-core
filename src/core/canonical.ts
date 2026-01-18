import type { TransformedContext } from "./config.ts";
import { createHash } from "crypto";

/**
 * Canonical JSON serialization for Axiom transformed context.
 * Ensures deterministic output for hashing and verification.
 *
 * Rules:
 * - Stable key ordering (alphabetical)
 * - Normalized numeric formats (no trailing zeros, consistent precision)
 * - Stable entity/relation ordering by synthetic ID
 * - No whitespace in output
 * - UTF-8 encoding
 */

/**
 * Canonicalize a transformed context into a deterministic string representation.
 * @param context - The transformed context to canonicalize
 * @returns Canonical JSON string (no whitespace)
 */
export function canonicalize(context: TransformedContext): string {
  // Create a normalized copy with stable ordering
  const normalized = normalizeTransformedContext(context);

  // Serialize with custom replacer for stable key ordering
  return JSON.stringify(normalized, stableStringify);
}

/**
 * Compute SHA-256 hash of the canonical representation.
 * @param context - The transformed context to hash
 * @returns Hex-encoded SHA-256 hash
 */
export function hash(context: TransformedContext): string {
  const canonical = canonicalize(context);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/**
 * Normalize a transformed context for canonical serialization.
 */
function normalizeTransformedContext(
  context: TransformedContext
): Record<string, unknown> {
  return {
    entities: normalizeEntities(context.entities),
    model: context.model ?? null,
    relations: normalizeRelations(context.relations),
    task: context.task,
  };
}

/**
 * Normalize entities array: sort by syntheticId, normalize attributes.
 */
function normalizeEntities(
  entities: TransformedContext["entities"]
): Array<Record<string, unknown>> {
  return entities
    .slice() // Create copy to avoid mutation
    .sort((a, b) => a.syntheticId.localeCompare(b.syntheticId))
    .map((entity) => ({
      attributes: normalizeAttributes(entity.attributes),
      role: entity.role,
      syntheticId: entity.syntheticId,
    }));
}

/**
 * Normalize attributes: stable key ordering, normalized numbers.
 */
function normalizeAttributes(
  attributes: Record<string, string | number>
): Record<string, string | number> {
  const normalized: Record<string, string | number> = {};
  const keys = Object.keys(attributes).sort();

  for (const key of keys) {
    const value = attributes[key];
    if (typeof value === "number") {
      // Normalize numbers: remove trailing zeros, consistent precision
      normalized[key] = normalizeNumber(value);
    } else {
      normalized[key] = value;
    }
  }

  return normalized;
}

/**
 * Normalize relations array: sort by (from, to, type).
 */
function normalizeRelations(
  relations: TransformedContext["relations"]
): Array<Record<string, unknown>> {
  return relations
    .slice()
    .sort((a, b) => {
      // Sort by from, then to, then type
      if (a.from !== b.from) return a.from.localeCompare(b.from);
      if (a.to !== b.to) return a.to.localeCompare(b.to);
      return a.type.localeCompare(b.type);
    })
    .map((relation) => ({
      from: relation.from,
      to: relation.to,
      type: relation.type,
    }));
}

/**
 * Normalize a number for consistent serialization.
 * Handles edge cases like -0, Infinity, and precision.
 */
function normalizeNumber(value: number): number {
  // Handle special values
  if (Object.is(value, -0)) return 0;
  if (!isFinite(value)) return value; // NaN, Infinity, -Infinity

  // Round to avoid floating point precision issues
  // Use 10 decimal places as reasonable precision for most values
  return Math.round(value * 10000000000) / 10000000000;
}

/**
 * Custom JSON replacer for stable key ordering.
 * Ensures object keys are always sorted alphabetically.
 */
function stableStringify(_key: string, value: unknown): unknown {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    // Sort object keys alphabetically
    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(value).sort();
    for (const k of keys) {
      sorted[k] = (value as Record<string, unknown>)[k];
    }
    return sorted;
  }
  return value;
}

/**
 * Verify that two transformed contexts have the same canonical hash.
 * @param context1 - First transformed context
 * @param context2 - Second transformed context
 * @returns True if hashes match (contexts are equivalent)
 */
export function verifyEquivalence(
  context1: TransformedContext,
  context2: TransformedContext
): boolean {
  return hash(context1) === hash(context2);
}

/**
 * Create a verification-friendly digest of a transformed context.
 * Useful for logging and debugging without exposing full context.
 */
export interface ContextDigest {
  hash: string;
  entityCount: number;
  relationCount: number;
  timestamp: number;
}

/**
 * Create a digest of a transformed context for verification/logging.
 * @param context - The transformed context
 * @returns Digest with hash and metadata
 */
export function createDigest(context: TransformedContext): ContextDigest {
  return {
    hash: hash(context),
    entityCount: context.entities.length,
    relationCount: context.relations.length,
    timestamp: Date.now(),
  };
}

