/**
 * Provider factory — Doc 17 §13.2 (LLM_PROVIDER env var).
 *
 * Creates the appropriate LLM provider based on configuration.
 * LLM_PROVIDER=mock for tests (Doc 15 §3.3).
 * LLM_PROVIDER=anthropic for production.
 */

import type { LLMProvider } from '../types.js';
import { MockProvider } from './mock.provider.js';
import { AnthropicProvider } from './anthropic.provider.js';

export function createProvider(config: {
  provider: string;
  model: string;
  apiKey?: string;
  maxTokens?: number;
}): LLMProvider {
  switch (config.provider) {
    case 'anthropic':
      if (!config.apiKey) {
        throw new Error('CLAUDE_API_KEY is required when LLM_PROVIDER=anthropic');
      }
      return new AnthropicProvider(config.apiKey, config.model);
    case 'mock':
      return new MockProvider();
    default:
      throw new Error(`Unknown LLM provider: ${config.provider}`);
  }
}
