/**
 * LLM provider interface — Doc 13, Doc 20 §5.2.
 *
 * This is the abstraction that enables multi-provider support.
 * Every provider must implement this interface.
 * Zod schemas validate output regardless of which provider generated it.
 */

import type { z, ZodSchema } from 'zod';

export interface ProviderCapabilities {
  name: string;
  maxContextTokens: number;
  supportsStructuredOutput: boolean;
  supportsCaching: boolean;
}

export interface LLMRequest {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMResponse<T = unknown> {
  data: T;
  usage: {
    inputTokens: number;
    outputTokens: number;
    estimatedCost: number;
    cacheHit: boolean;
  };
  duration_ms: number;
  model: string;
}

export interface LLMProvider {
  readonly capabilities: ProviderCapabilities;

  /**
   * Generate a structured response validated against a Zod schema.
   * Doc 5 §5: "Zod schemas used for Claude structured-output validation
   * are the same schemas used for API request/response validation."
   */
  generate<T>(
    request: LLMRequest,
    schema: ZodSchema<T>,
  ): Promise<LLMResponse<T>>;
}
