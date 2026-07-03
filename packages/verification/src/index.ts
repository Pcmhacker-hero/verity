/**
 * @verity/verification — Two-tier verification engine.
 *
 * Blueprint source: Doc 11 §6 (verification lifecycle), Doc 18 §8 (batching/scaling).
 * Tier 1: deterministic checks (zero LLM calls) — AST parsing, schema matching.
 * Tier 2: semantic checks (LLM-based) — batched by spec area.
 */

export { VerificationEngine } from './engine.js';
export * from './tier1/index.js';
