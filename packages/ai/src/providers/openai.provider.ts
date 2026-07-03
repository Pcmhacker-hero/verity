import OpenAI from 'openai';
import type { LLMProvider, LLMRequest, LLMResponse, ProviderCapabilities } from '../types.js';
import type { ZodSchema } from 'zod';
import { config } from '@verity/shared';
import { zodToJsonSchema } from 'zod-to-json-schema';

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;

  readonly capabilities: ProviderCapabilities = {
    name: 'openai',
    maxContextTokens: 128_000,
    supportsStructuredOutput: true,
    supportsCaching: false,
  };

  constructor(apiKey?: string, model = 'gpt-4o-2024-08-06') {
    this.client = new OpenAI({ apiKey: apiKey || config.ai.openaiKey });
    this.model = model;
  }

  async generate<T>(request: LLMRequest, schema: ZodSchema<T>): Promise<LLMResponse<T>> {
    const startTime = Date.now();
    const jsonSchema = zodToJsonSchema(schema, 'OutputSchema');

    // Remove $schema to make it compatible with OpenAI strict structured outputs
    if (jsonSchema && typeof jsonSchema === 'object' && '$schema' in jsonSchema) {
      delete (jsonSchema as any).$schema;
    }

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: request.systemPrompt },
        { role: 'user', content: request.userPrompt },
      ],
      max_tokens: request.maxTokens,
      temperature: request.temperature ?? 0.2, // Low temp for spec deterministic behavior
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'OutputSchema',
          strict: true,
          schema: jsonSchema as any,
        },
      },
    });

    const duration_ms = Date.now() - startTime;
    const choice = response.choices[0];
    
    if (!choice || !choice.message.content) {
      throw new Error('OpenAI returned an empty response');
    }

    // We still return raw text; the GenerationEngine and Parser will handle the actual JSON.parse and Zod validation
    // because we need to share the repair/validation logic across all providers equally.
    return {
      data: choice.message.content as unknown as T, // GenerationEngine expects string first before parse
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
        estimatedCost: this.estimateCost(response.usage?.prompt_tokens ?? 0, response.usage?.completion_tokens ?? 0),
        cacheHit: false, // OpenAI doesn't natively expose cache hits in standard usage obj
      },
      duration_ms,
      model: this.model,
    };
  }

  private estimateCost(inputTokens: number, outputTokens: number): number {
    // Rough estimate for gpt-4o: $2.50 / 1M input, $10.00 / 1M output
    return (inputTokens / 1_000_000) * 2.50 + (outputTokens / 1_000_000) * 10.00;
  }
}
