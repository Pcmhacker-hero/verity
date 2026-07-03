/**
 * LLM output schemas — Zod schemas for structured output validation.
 * Doc 5 §5: "Zod schemas used for Claude structured-output validation are
 * the same schemas used for API request/response validation."
 *
 * Each schema defines the exact shape the LLM must produce for an artifact.
 */

export {};

// TODO: Define Zod schemas for each artifact's LLM output
// These will be used by:
// 1. The LLM provider for structured output
// 2. The API layer for response validation
// 3. The frontend for type safety
