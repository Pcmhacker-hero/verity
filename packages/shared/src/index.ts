/**
 * @verity/shared — Shared types, constants, errors, and validation schemas.
 *
 * Blueprint source: Doc 5 §5 (shared type contract), Doc 11 §8 (type safety).
 * This package is the single source of truth for types consumed by the API layer,
 * the frontend, and the worker — one definition, three consumers.
 */

export * from './types/index.js';
export * from './constants/index.js';
export * from './errors/index.js';
export * from './validation/index.js';
