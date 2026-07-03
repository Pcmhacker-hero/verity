/**
 * AI Generation Engine — Doc 13 §3.
 *
 * Orchestrates PromptBuilder → Provider → OutputParser → RetryEngine.
 * Handles validation, cost tracking, and error recovery.
 */

import type { ZodSchema } from 'zod';
import type { LLMProvider, LLMResponse } from './types.js';
import { StructuredOutputParser } from './parser.js';
import { RetryEngine } from './retry.js';
import { LLMValidationError } from '@verity/shared/errors';

export class GenerationEngine {
  private provider: LLMProvider;

  constructor(provider: LLMProvider) {
    this.provider = provider;
  }

  /**
   * Generates a structured artifact matching the Zod schema, with automatic
   * retry and JSON repair built in.
   */
  async generateValidatedOutput<T>(
    systemPrompt: string,
    initialUserPrompt: string,
    schema: ZodSchema<T>
  ): Promise<LLMResponse<T>> {
    let userPrompt = initialUserPrompt;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCost = 0;
    let totalDurationMs = 0;

    return RetryEngine.withRetry(async (attempt) => {
      // 1. Call the underlying provider
      const response = await this.provider.generate(
        { systemPrompt, userPrompt, temperature: 0.2 },
        schema
      );

      // Accumulate metrics
      totalInputTokens += response.usage.inputTokens;
      totalOutputTokens += response.usage.outputTokens;
      totalCost += response.usage.estimatedCost;
      totalDurationMs += response.duration_ms;

      // 2. Parse and Validate the output (since providers return raw string data here for consistency)
      const rawText = response.data as unknown as string;
      const parseResult = StructuredOutputParser.parse(rawText, schema);

      // 3. Handle success or retry
      if (parseResult.success && parseResult.data !== undefined) {
        return {
          data: parseResult.data,
          usage: {
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
            estimatedCost: totalCost,
            cacheHit: response.usage.cacheHit,
          },
          duration_ms: totalDurationMs,
          model: response.model,
        };
      } else {
        // Validation failed. We inject the Zod error as a correction prompt for the next attempt.
        if (parseResult.zodError) {
          userPrompt = StructuredOutputParser.generateCorrectionPrompt(parseResult.zodError);
        } else {
          userPrompt = `Your previous output was completely malformed: ${parseResult.error}. Please output ONLY valid JSON matching the schema.`;
        }

        // Throw an error so RetryEngine catches it and triggers the next attempt with the updated userPrompt
        throw new LLMValidationError(`Output validation failed: ${parseResult.error}`, { zodError: parseResult.zodError });
      }
    });
  }
}
