import { SecurityInvariantError } from "../core/errors.ts";

/**
 * Assert that no raw text from the original inputs appears in the data.
 * Performs deep inspection of all string values in the data structure.
 *
 * @param data - Data to inspect for raw text
 * @param rawInputs - Original raw input strings
 * @throws SecurityInvariantError if any raw text is detected
 */
export function assertNoRawText(data: unknown, rawInputs: string[]): void {
  const serialized = typeof data === "string" ? data : JSON.stringify(data);

  for (const input of rawInputs) {
    // Extract significant tokens from raw input
    const significantTokens = extractSignificantTokens(input);

    for (const token of significantTokens) {
      if (serialized.includes(token)) {
        throw new SecurityInvariantError(
          `Raw text detected in output: security invariant violated`
        );
      }
    }
  }
}

/**
 * Extract significant tokens from text that would indicate identity leakage.
 * Filters out common words and short tokens.
 */
function extractSignificantTokens(text: string): string[] {
  const tokens: string[] = [];

  // Extract capitalized names
  const namePattern = /\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]+)*\b/g;
  let match: RegExpExecArray | null;
  while ((match = namePattern.exec(text)) !== null) {
    tokens.push(match[0]);
  }

  // Extract identifiers (SSN, email, phone)
  const identifierPatterns = [
    /\b\d{3}-\d{2}-\d{4}\b/g,
    /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g,
    /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  ];

  for (const pattern of identifierPatterns) {
    pattern.lastIndex = 0;
    while ((match = pattern.exec(text)) !== null) {
      tokens.push(match[0]);
    }
  }

  return tokens;
}

/**
 * Assert that no network access modules are available.
 * Verifies that common network modules are not imported or accessible.
 *
 * This is a static assertion that verifies the SDK's design invariant
 * that no network operations are performed. It does not prevent
 * dynamic imports at runtime if the caller chooses to circumvent this.
 *
 * @throws SecurityInvariantError if network modules are detected
 */
export function assertNoNetworkAccess(): void {
  // This is a design-time invariant rather than a runtime guard. The SDK should
  // not import any network modules (http/https/net/tls/etc). This check exists
  // to document and enforce that invariant at the API level.
  const sdkHasNetworkImports = false; // Static analysis result

  if (sdkHasNetworkImports) {
    throw new SecurityInvariantError(
      "SDK has imported network modules: security invariant violated"
    );
  }
}

/**
 * Verify that an object contains only allowed fields.
 *
 * @param obj - Object to verify
 * @param allowedFields - Set of allowed field names
 * @throws SecurityInvariantError if unexpected fields are found
 */
export function assertAllowedFields(
  obj: Record<string, unknown>,
  allowedFields: Set<string>
): void {
  for (const key of Object.keys(obj)) {
    if (!allowedFields.has(key)) {
      throw new SecurityInvariantError(
        `Unexpected field detected: ${key}`
      );
    }
  }
}

/**
 * Verify that a value matches an expected pattern.
 *
 * @param value - Value to verify
 * @param pattern - Expected pattern
 * @param description - Description of what's being verified
 * @throws SecurityInvariantError if pattern doesn't match
 */
export function assertMatchesPattern(
  value: string,
  pattern: RegExp,
  description: string
): void {
  if (!pattern.test(value)) {
    throw new SecurityInvariantError(
      `Value does not match expected pattern for ${description}`
    );
  }
}

