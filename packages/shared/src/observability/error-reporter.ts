import { getRequestContext } from './context.js';
import { logger } from './logger.js';
import { config } from '../config/index.js';

export type ErrorSeverity = 'fatal' | 'error' | 'warning' | 'info';

export interface ErrorReportMetadata {
  requestId?: string;
  userId?: string;
  workspaceId?: string;
  projectId?: string;
  service?: string;
  environment?: string;
  severity?: ErrorSeverity;
  tags?: Record<string, string | number | boolean>;
  context?: Record<string, unknown>;
}

export interface ErrorReportingProvider {
  captureException(error: Error, metadata: ErrorReportMetadata): void;
  captureMessage(message: string, metadata: ErrorReportMetadata): void;
}

const ERROR_REPORTED_SYMBOL = Symbol.for('verity.error.reported');

function isReported(error: unknown): boolean {
  if (typeof error === 'object' && error !== null) {
    return (error as Record<symbol, unknown>)[ERROR_REPORTED_SYMBOL] === true;
  }
  return false;
}

function markReported(error: Error): void {
  Object.defineProperty(error, ERROR_REPORTED_SYMBOL, {
    value: true,
    enumerable: false,
    configurable: true,
    writable: true,
  });
}

/**
 * A default provider that emits structured logs.
 * This satisfies the abstraction requirement without coupling to Sentry.
 */
class StructuredLogProvider implements ErrorReportingProvider {
  captureException(error: Error, metadata: ErrorReportMetadata): void {
    const level = metadata.severity === 'fatal' ? 'fatal' : metadata.severity === 'warning' ? 'warn' : 'error';
    logger[level]('unhandled_exception_captured', {
      error,
      metadata,
    });
  }

  captureMessage(message: string, metadata: ErrorReportMetadata): void {
    const level = metadata.severity === 'fatal' ? 'fatal' : metadata.severity === 'warning' ? 'warn' : metadata.severity === 'info' ? 'info' : 'error';
    logger[level]('message_captured', {
      message,
      metadata,
    });
  }
}

const providers: ErrorReportingProvider[] = [new StructuredLogProvider()];

export function registerErrorProvider(provider: ErrorReportingProvider): void {
  providers.push(provider);
}

export function reportError(error: unknown, additionalMeta: Partial<ErrorReportMetadata> = {}): void {
  const err = error instanceof Error ? error : new Error(String(error));

  if (isReported(err)) {
    return;
  }
  markReported(err);

  const reqContext = getRequestContext();
  
  const metadata: ErrorReportMetadata = {
    requestId: additionalMeta.requestId ?? reqContext?.requestId,
    userId: additionalMeta.userId ?? reqContext?.userId,
    workspaceId: additionalMeta.workspaceId ?? reqContext?.workspaceId,
    projectId: additionalMeta.projectId ?? reqContext?.projectId,
    service: additionalMeta.service ?? config.serviceName,
    environment: additionalMeta.environment ?? config.env,
    severity: additionalMeta.severity ?? 'error',
    tags: additionalMeta.tags ?? {},
    context: additionalMeta.context ?? {},
  };

  providers.forEach((provider) => {
    try {
      provider.captureException(err, metadata);
    } catch (providerError) {
      // Fallback logging if provider crashes (do not throw to prevent cascading failures)
      console.error('Error reporting provider failed:', providerError);
    }
  });
}
