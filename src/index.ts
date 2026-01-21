/**
 * Axiom Core - Local semantic transformation for private AI reasoning.
 *
 * This SDK transforms raw local input into non-identifying semantic
 * representations while enforcing a strict local-to-cloud boundary.
 *
 * v1.0 adds TEE-based execution with cryptographic attestation.
 *
 * @packageDocumentation
 */

export { Axiom } from "./core/axiom.ts";
export { AttestationVerifier, createVerifier } from "./attestation/verifier.ts";
export type {
  AxiomConfig,
  ReasonInput,
  ReasonResult,
  TransformedContext,
  AttestationEvidence,
} from "./core/config.ts";
export type {
  VerificationVerdict,
  VerificationOptions,
  SessionMetadata,
} from "./attestation/types.ts";
export {
  BoundaryViolationError,
  TransformationError,
  ConfigurationError,
  SecurityInvariantError,
} from "./core/errors.ts";

// Utilities for advanced usage
export { hash, canonicalize, verifyEquivalence } from "./core/canonical.ts";
export { Session } from "./runtime/session.ts";

