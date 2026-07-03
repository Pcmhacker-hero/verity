/**
 * Retry Engine — Doc 13.
 *
 * Implements exponential backoff for transient provider errors (rate limits, timeouts).
 * Limits max attempts to prevent infinite loops and runaway costs.
 */

import { VerityError } from '@verity/shared/errors';

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffFactor: 2,
};

export class RetryEngine {
  /**
   * Executes a block of code with exponential backoff.
   */
  static async withRetry<T>(
    operation: (attempt: number) => Promise<T>,
    options?: RetryOptions
  ): Promise<T> {
    const config = { ...DEFAULT_OPTIONS, ...options };
    let attempt = 1;
    let delayMs = config.initialDelayMs;

    while (true) {
      try {
        return await operation(attempt);
      } catch (error: any) {
        if (attempt >= config.maxAttempts) {
          throw new VerityError(
            'GENERATION_FAILED',
            `Operation failed after ${attempt} attempts. Last error: ${error.message}`,
            500
          );
        }

        // Determine if error is retryable (e.g., 429 Rate Limit, 503 Service Unavailable, network timeout)
        if (!this.isRetryable(error)) {
          throw error; // Propagate immediately if it's a hard failure (e.g., Auth error)
        }

        console.warn(`[RetryEngine] Attempt ${attempt} failed. Retrying in ${delayMs}ms. Error: ${error.message}`);
        await this.sleep(delayMs);

        attempt++;
        delayMs = Math.min(delayMs * config.backoffFactor, config.maxDelayMs);
      }
    }
  }

  private static isRetryable(error: any): boolean {
    if (error?.code === 'LLM_VALIDATION_ERROR') {
      return true;
    }

    // Basic heuristic: check for common transient HTTP status codes or error messages
    const status = error?.status || error?.statusCode || error?.response?.status;
    if (status && [429, 500, 502, 503, 504].includes(status)) {
      return true;
    }

    const message = (error?.message || '').toLowerCase();
    if (
      message.includes('timeout') ||
      message.includes('rate limit') ||
      message.includes('econnreset') ||
      message.includes('socket hang up')
    ) {
      return true;
    }

    // Default to false for unknown errors (e.g., 400 Bad Request, 401 Unauthorized)
    return false;
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
