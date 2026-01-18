/**
 * Memory utilities for best-effort zero-retention.
 *
 * LIMITATIONS (JavaScript/Node.js):
 * - Garbage collection timing is not deterministic
 * - No secure memory erasure (overwriting with zeros does not guarantee physical erasure)
 * - Strings are immutable and may be interned by the runtime
 * - JIT compilation may create copies of values
 * - No control over swap/paging at the OS level
 *
 * These utilities provide best-effort clearing of references to reduce
 * the window during which sensitive data remains in memory. They do NOT
 * provide cryptographic or forensic-level guarantees.
 */

/**
 * Clear all properties of an object reference.
 * Sets each property to undefined and deletes it.
 * This helps the garbage collector reclaim memory sooner.
 *
 * @param ref - Object whose properties should be cleared
 */
export function clearReference(ref: unknown): void {
  if (ref === null || ref === undefined) {
    return;
  }

  if (typeof ref !== "object") {
    return;
  }

  if (Array.isArray(ref)) {
    // Clear array elements
    for (let i = 0; i < ref.length; i++) {
      clearReference(ref[i]);
      ref[i] = undefined;
    }
    ref.length = 0;
    return;
  }

  // Clear object properties
  const obj = ref as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (typeof value === "object" && value !== null) {
      clearReference(value);
    }
    obj[key] = undefined;
    delete obj[key];
  }
}

/**
 * Execute a function and clear intermediate values afterward.
 * The function receives a registry for tracking intermediate objects.
 *
 * @param fn - Function to execute; receives a register function for intermediates
 * @returns The return value of the function
 */
export function withZeroRetention<T>(
  fn: (register: (intermediate: unknown) => void) => T
): T {
  const intermediates: unknown[] = [];

  const register = (intermediate: unknown): void => {
    intermediates.push(intermediate);
  };

  try {
    return fn(register);
  } finally {
    // Clear all registered intermediates
    for (const intermediate of intermediates) {
      clearReference(intermediate);
    }
    intermediates.length = 0;
  }
}

/**
 * Create a scoped context that tracks and clears values on exit.
 * Use this for more complex pipelines where explicit registration is needed.
 */
export class RetentionScope {
  private readonly tracked: unknown[] = [];
  private disposed = false;

  /**
   * Track a value for clearing when the scope exits.
   */
  track<T>(value: T): T {
    if (this.disposed) {
      throw new Error("Cannot track values on disposed RetentionScope");
    }
    this.tracked.push(value);
    return value;
  }

  /**
   * Clear all tracked values and mark scope as disposed.
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    for (const value of this.tracked) {
      clearReference(value);
    }
    this.tracked.length = 0;
    this.disposed = true;
  }
}

