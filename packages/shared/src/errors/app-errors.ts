/**
 * Application error classes — Doc 14 §12 (error taxonomy).
 *
 * Every error has a machine-readable code, HTTP status, and human-readable message.
 * The error taxonomy maps directly to Doc 14's error contract.
 */

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>,
    public readonly action?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/** 400 — request validation failed */
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, 422, details);
    this.name = 'ValidationError';
  }
}

/** 401 — not authenticated */
export class AuthenticationError extends AppError {
  constructor(message = 'Session expired or invalid. Please log in again.') {
    super('AUTH_SESSION_INVALID', message, 401, undefined, 'redirect_to_login');
    this.name = 'AuthenticationError';
  }
}

/** 404 — resource not found (Doc 16 §5.3: 404, not 403, for missing resources) */
export class NotFoundError extends AppError {
  constructor(resource: string) {
    super('RESOURCE_NOT_FOUND', `${resource} not found`, 404);
    this.name = 'NotFoundError';
  }
}

/** 409 — conflict (e.g., duplicate project name) */
export class ConflictError extends AppError {
  constructor(message: string) {
    super('CONFLICT', message, 409);
    this.name = 'ConflictError';
  }
}

/** 429 — rate limited (Doc 14 §13) */
export class RateLimitError extends AppError {
  constructor(retryAfter?: number) {
    super('RATE_LIMITED', 'Rate limit exceeded. Please try again later.', 429, {
      retryAfter,
    }, 'retry');
    this.name = 'RateLimitError';
  }
}

/** 502 — upstream LLM provider failure */
export class LLMProviderError extends AppError {
  constructor(message = 'AI provider is temporarily unavailable') {
    super('LLM_PROVIDER_ERROR', message, 502);
    this.name = 'LLMProviderError';
  }
}

/** LLM Output validation failure */
export class LLMValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('LLM_VALIDATION_ERROR', message, 422, details);
    this.name = 'LLMValidationError';
  }
}

/** Generation-specific failure */
export class GenerationFailedError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('GENERATION_FAILED', message, 500, details);
    this.name = 'GenerationFailedError';
  }
}

/** Verification-specific failure */
export class VerificationFailedError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VERIFICATION_FAILED', message, 500, details);
    this.name = 'VerificationFailedError';
  }
}

/** GitHub connectivity failure */
export class GitHubConnectionError extends AppError {
  constructor(message = 'GitHub repository is not accessible') {
    super('GITHUB_REPO_INACCESSIBLE', message, 422, undefined, 'reconnect_github');
    this.name = 'GitHubConnectionError';
  }
}

/** Alias for backward compatibility - used by queue and worker packages */
export { AppError as VerityError };
