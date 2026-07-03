/**
 * Mock provider — Doc 15 §3.3.
 *
 * Returns deterministic, schema-valid responses for testing.
 * Used in local development (LLM_PROVIDER=mock) and CI.
 * Zero LLM cost, instant responses, reproducible output.
 */

import type { LLMProvider, LLMRequest, LLMResponse, ProviderCapabilities } from '../types.js';
import type { ZodSchema } from 'zod';

export class MockProvider implements LLMProvider {
  readonly capabilities: ProviderCapabilities = {
    name: 'mock',
    maxContextTokens: 200_000,
    supportsStructuredOutput: true,
    supportsCaching: false,
  };

  async generate<T>(
    _request: LLMRequest,
    _schema: ZodSchema<T>,
  ): Promise<LLMResponse<T>> {
    // Generate deterministic mock data from the schema
    const data = this.generateMockFromSchema(_schema);
    
    return {
      data,
      usage: {
        inputTokens: 10,
        outputTokens: 20,
        estimatedCost: 0,
        cacheHit: false,
      },
      duration_ms: 15,
      model: 'mock-model',
    };
  }

  private generateMockFromSchema(schema: any): any {
    if (!schema || !schema._def) return null;

    const typeName = schema._def.typeName;

    if (typeName === 'ZodObject') {
      const shape = schema._def.shape();
      const obj: any = {};
      for (const key in shape) {
        obj[key] = this.generateMockFromSchema(shape[key]);
      }
      return obj;
    }

    if (typeName === 'ZodArray') {
      return [this.generateMockFromSchema(schema._def.type)];
    }

    if (typeName === 'ZodString') {
      return 'mock_string_value';
    }

    if (typeName === 'ZodNumber') {
      return 42;
    }

    if (typeName === 'ZodBoolean') {
      return true;
    }

    if (typeName === 'ZodEnum') {
      return schema._def.values[0];
    }
    
    if (typeName === 'ZodOptional' || typeName === 'ZodNullable') {
      return this.generateMockFromSchema(schema._def.innerType);
    }
    
    if (typeName === 'ZodDefault') {
      return schema._def.defaultValue();
    }

    if (typeName === 'ZodLiteral') {
      return schema._def.value;
    }

    if (typeName === 'ZodRecord') {
      return { mock_key: this.generateMockFromSchema(schema._def.valueType) };
    }
    
    if (typeName === 'ZodLazy') {
      // Avoid infinite recursion by returning null or a shallow object for lazy schemas
      return null;
    }
    
    if (typeName === 'ZodEffects') {
      return this.generateMockFromSchema(schema._def.schema);
    }

    return null;
  }
}
