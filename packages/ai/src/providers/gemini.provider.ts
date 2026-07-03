import { GoogleGenAI } from '@google/genai';
import type { LLMProvider, LLMRequest, LLMResponse, ProviderCapabilities } from '../types.js';
import type { ZodSchema } from 'zod';
import { config } from '@verity/shared';
import { zodToJsonSchema } from 'zod-to-json-schema';

export class GeminiProvider implements LLMProvider {
  private client: GoogleGenAI;
  private model: string;

  readonly capabilities: ProviderCapabilities = {
    name: 'gemini',
    maxContextTokens: 2_000_000,
    supportsStructuredOutput: true,
    supportsCaching: true,
  };

  constructor(apiKey?: string, model = 'gemini-2.5-pro') {
    this.client = new GoogleGenAI({ apiKey: apiKey || config.ai.geminiKey });
    this.model = model;
  }

  async generate<T>(request: LLMRequest, schema: ZodSchema<T>): Promise<LLMResponse<T>> {
    const startTime = Date.now();
    const jsonSchema = zodToJsonSchema(schema, 'OutputSchema');

    // Remove $schema for Google GenAI compatibility
    if (jsonSchema && typeof jsonSchema === 'object' && '$schema' in jsonSchema) {
      delete (jsonSchema as any).$schema;
    }

    const response = await this.client.models.generateContent({
      model: this.model,
      contents: request.userPrompt,
      config: {
        systemInstruction: request.systemPrompt,
        temperature: request.temperature ?? 0.2,
        responseMimeType: 'application/json',
        responseSchema: jsonSchema as any,
      }
    });

    const duration_ms = Date.now() - startTime;
    
    if (!response.text) {
      throw new Error('Gemini returned an empty response');
    }

    // Google returns raw JSON string when responseMimeType is set
    const rawData = response.text;

    return {
      data: rawData as unknown as T,
      usage: {
        inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
        estimatedCost: this.estimateCost(
          response.usageMetadata?.promptTokenCount ?? 0, 
          response.usageMetadata?.candidatesTokenCount ?? 0
        ),
        cacheHit: false, // Google supports caching via specific API, but usage data here doesn't flag it simply
      },
      duration_ms,
      model: this.model,
    };
  }

  private estimateCost(inputTokens: number, outputTokens: number): number {
    // Rough estimate for Gemini 1.5 Pro: $1.25 / 1M input, $5.00 / 1M output
    return (inputTokens / 1_000_000) * 1.25 + (outputTokens / 1_000_000) * 5.00;
  }
}
