import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider, LLMRequest, LLMResponse, ProviderCapabilities } from '../types.js';
import type { ZodSchema } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;
  private model: string;

  readonly capabilities: ProviderCapabilities = {
    name: 'anthropic',
    maxContextTokens: 200_000,
    supportsStructuredOutput: true,
    supportsCaching: true,
  };

  constructor(apiKey?: string, model = 'claude-3-7-sonnet-20250219') {
    this.client = new Anthropic({ apiKey: apiKey || process.env.ANTHROPIC_API_KEY });
    this.model = model;
  }

  async generate<T>(request: LLMRequest, schema: ZodSchema<T>): Promise<LLMResponse<T>> {
    const startTime = Date.now();
    const jsonSchema = zodToJsonSchema(schema, 'OutputSchema');

    // Claude handles structured output best via Tool Calling
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: request.maxTokens || 8192,
      temperature: request.temperature ?? 0.2,
      system: request.systemPrompt,
      messages: [
        { role: 'user', content: request.userPrompt }
      ],
      tools: [
        {
          name: 'generate_artifact',
          description: 'Outputs the final requested JSON artifact.',
          input_schema: jsonSchema as any, // Anthropic format
        }
      ],
      tool_choice: { type: 'tool', name: 'generate_artifact' }
    });

    const duration_ms = Date.now() - startTime;
    
    // Find the tool use block
    const toolBlock = response.content.find(block => block.type === 'tool_use');
    if (!toolBlock || toolBlock.type !== 'tool_use') {
      throw new Error('Anthropic did not return the requested tool block.');
    }

    // Anthropic SDK parses the tool input for us, but we return it as a string
    // to pass through the universal Parser (which handles stripping/repair/validation).
    const rawData = JSON.stringify(toolBlock.input);

    return {
      data: rawData as unknown as T,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        estimatedCost: this.estimateCost(response.usage.input_tokens, response.usage.output_tokens),
        cacheHit: !!(response.usage as any).cache_creation_input_tokens || !!(response.usage as any).cache_read_input_tokens,
      },
      duration_ms,
      model: this.model,
    };
  }

  private estimateCost(inputTokens: number, outputTokens: number): number {
    // Rough estimate for Claude 3.7 Sonnet: $3 / 1M input, $15 / 1M output
    return (inputTokens / 1_000_000) * 3.00 + (outputTokens / 1_000_000) * 15.00;
  }
}
