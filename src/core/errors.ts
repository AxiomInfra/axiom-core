/**
 * Thrown when raw data attempts to cross the local-to-cloud boundary.
 * This indicates a critical security violation.
 */
export class BoundaryViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BoundaryViolationError";
    Object.setPrototypeOf(this, BoundaryViolationError.prototype);
  }
}

/**
 * Thrown when semantic transformation fails.
 * This includes distillation, abstraction, or masking failures.
 */
export class TransformationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransformationError";
    Object.setPrototypeOf(this, TransformationError.prototype);
  }
}

/**
 * Thrown when the SDK is configured incorrectly.
 */
export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

/**
 * Thrown when a security invariant is violated.
 * This indicates a fundamental assumption has been broken.
 */
export class SecurityInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecurityInvariantError";
    Object.setPrototypeOf(this, SecurityInvariantError.prototype);
  }
}

