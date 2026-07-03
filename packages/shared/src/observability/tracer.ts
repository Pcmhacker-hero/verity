import { randomUUID } from 'node:crypto';
import { getRequestContext, runWithContext, RequestContextData } from './context.js';
import { logger } from './logger.js';
import { metrics } from './metrics.js';
import { reportError } from './error-reporter.js';

export interface SpanContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  requestId?: string;
}

export interface Span {
  name: string;
  context: SpanContext;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  status: 'ok' | 'error';
  metadata: Record<string, unknown>;
}

export interface TracingProvider {
  onSpanStart(span: Span): void;
  onSpanEnd(span: Span): void;
}

/**
 * Default tracing provider that emits structured JSON logs.
 * Compatible with Datadog APM log-based tracing or CloudWatch ServiceLens.
 */
class StructuredLogTracingProvider implements TracingProvider {
  onSpanStart(span: Span): void {
    logger.debug('span_start', { span });
  }

  onSpanEnd(span: Span): void {
    logger.info('span_end', { span });
  }
}

const providers: TracingProvider[] = [new StructuredLogTracingProvider()];

export function registerTracingProvider(provider: TracingProvider): void {
  providers.push(provider);
}

/**
 * Core tracing abstraction. Wraps a function execution in a Trace Span.
 * Automatically propagates Context (traceId, spanId).
 */
export async function withSpan<T>(
  name: string,
  metadata: Record<string, unknown> = {},
  fn: (span: Span) => Promise<T> | T
): Promise<T> {
  const reqContext = getRequestContext() || { requestId: randomUUID() } as RequestContextData;
  
  const parentSpanId = reqContext.spanId;
  const traceId = reqContext.traceId || randomUUID();
  const spanId = randomUUID();

  const span: Span = {
    name,
    context: {
      traceId,
      spanId,
      parentSpanId,
      requestId: reqContext.requestId,
    },
    startTime: Date.now(),
    status: 'ok',
    metadata,
  };

  providers.forEach(p => p.onSpanStart(span));

  // Update Context for nested calls
  const childContext: RequestContextData = {
    ...reqContext,
    traceId,
    spanId,
    parentSpanId,
  };

  try {
    const result = await runWithContext(childContext, () => fn(span));
    span.endTime = Date.now();
    span.durationMs = span.endTime - span.startTime;
    
    // Auto-record metric for the span duration
    metrics.histogram(`trace_span_duration`, span.durationMs, { span_name: name, status: span.status });
    
    providers.forEach(p => p.onSpanEnd(span));
    return result;
  } catch (error) {
    span.endTime = Date.now();
    span.durationMs = span.endTime - span.startTime;
    span.status = 'error';
    span.metadata.error = error instanceof Error ? error.message : String(error);
    
    metrics.histogram(`trace_span_duration`, span.durationMs, { span_name: name, status: span.status });
    
    providers.forEach(p => p.onSpanEnd(span));
    
    // Ensure the error is reported centrally if it hasn't been already
    reportError(error, { 
      tags: { span_name: name, trace_id: traceId, span_id: spanId }
    });
    
    throw error;
  }
}
