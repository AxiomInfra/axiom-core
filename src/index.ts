/**
 * Axiom SDK - Local semantic transformation for private AI reasoning.
 *
 * This SDK transforms raw local input into non-identifying semantic
 * representations while enforcing a strict local-to-cloud boundary.
 *
 * @packageDocumentation
 */

export { Axiom } from "./core/axiom.ts";
export type {
  AxiomConfig,
  ReasonInput,
  TransformedContext,
} from "./core/config.ts";
export {
  BoundaryViolationError,
  TransformationError,
  ConfigurationError,
  SecurityInvariantError,
} from "./core/errors.ts";

