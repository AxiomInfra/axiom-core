import type { RawEntity } from "../entities/entity.ts";
import { TransformationError } from "../core/errors.ts";

/**
 * Deterministic semantic distiller.
 * Extracts entities from raw text using heuristic pattern matching.
 * No ML models. No randomness. No network calls.
 */
export class Distiller {
  /**
   * Pattern for capitalized words (potential names).
   * Matches words starting with uppercase, at least 2 characters.
   */
  private static readonly NAME_PATTERN = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g;

  /**
   * Pattern for dates in common formats.
   * Matches: YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, Month DD YYYY, etc.
   */
  private static readonly DATE_PATTERN =
    /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})\b/gi;

  /**
   * Pattern for currency amounts.
   * Matches: $1,234.56, €100, £50.00, etc.
   */
  private static readonly CURRENCY_PATTERN =
    /[$€£¥]\s*\d{1,3}(?:,\d{3})*(?:\.\d{2})?\b|\b\d{1,3}(?:,\d{3})*(?:\.\d{2})?\s*(?:USD|EUR|GBP|JPY)\b/g;

  /**
   * Pattern for standalone numbers.
   * Matches integers and decimals, excluding those already matched as currency/dates.
   */
  private static readonly NUMBER_PATTERN = /\b\d+(?:\.\d+)?\b/g;

  /**
   * Pattern for identifiers (SSN, phone, email-like patterns).
   */
  private static readonly IDENTIFIER_PATTERN =
    /\b(?:\d{3}-\d{2}-\d{4}|\d{3}[-.\s]?\d{3}[-.\s]?\d{4}|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g;

  /**
   * Distill raw input text into extracted entities.
   * @param input - Raw text input (string or array of strings)
   * @returns Array of raw entities with positions and types
   */
  distill(input: string | string[]): RawEntity[] {
    const text = Array.isArray(input) ? input.join("\n") : input;

    if (text.length === 0) {
      throw new TransformationError("Cannot distill empty input");
    }

    const entities: RawEntity[] = [];
    const processedPositions = new Set<string>();

    // Extract in order of specificity to avoid overlaps
    this.extractPattern(
      text,
      Distiller.IDENTIFIER_PATTERN,
      "identifier",
      entities,
      processedPositions
    );
    this.extractPattern(
      text,
      Distiller.DATE_PATTERN,
      "date",
      entities,
      processedPositions
    );
    this.extractPattern(
      text,
      Distiller.CURRENCY_PATTERN,
      "currency",
      entities,
      processedPositions
    );
    this.extractPattern(
      text,
      Distiller.NAME_PATTERN,
      "name",
      entities,
      processedPositions
    );
    this.extractPattern(
      text,
      Distiller.NUMBER_PATTERN,
      "number",
      entities,
      processedPositions
    );

    // Sort by position for deterministic output
    entities.sort((a, b) => a.position - b.position);

    return entities;
  }

  /**
   * Extract entities matching a pattern.
   * Avoids overlapping with already-processed positions.
   */
  private extractPattern(
    text: string,
    pattern: RegExp,
    entityType: RawEntity["entityType"],
    entities: RawEntity[],
    processedPositions: Set<string>
  ): void {
    // Reset regex state for global patterns
    pattern.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const position = match.index;
      const endPosition = position + match[0].length;

      // Check if this range overlaps with any processed position
      let overlaps = false;
      for (let i = position; i < endPosition; i++) {
        if (processedPositions.has(String(i))) {
          overlaps = true;
          break;
        }
      }

      if (!overlaps) {
        entities.push({
          originalText: match[0],
          entityType,
          position,
        });

        // Mark these positions as processed
        for (let i = position; i < endPosition; i++) {
          processedPositions.add(String(i));
        }
      }
    }
  }
}

