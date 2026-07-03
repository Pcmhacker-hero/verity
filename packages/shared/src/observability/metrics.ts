import { getRequestContext } from './context.js';
import { logger } from './logger.js';
import { config } from '../config/index.js';

export type MetricType = 'increment' | 'gauge' | 'histogram';

export interface MetricTags {
  [key: string]: string | number | boolean | undefined;
}

export interface MetricPayload {
  name: string;
  value: number;
  type: MetricType;
  tags: MetricTags;
  timestamp: string;
  requestId?: string;
  workspaceId?: string;
  projectId?: string;
}

export interface MetricsProvider {
  increment(name: string, value: number, tags?: MetricTags): void;
  gauge(name: string, value: number, tags?: MetricTags): void;
  histogram(name: string, value: number, tags?: MetricTags): void;
}

/**
 * A provider that writes metrics to the structured logger.
 * These logs can be ingested by Datadog or AWS CloudWatch as "metrics from logs".
 */
class StructuredLogMetricsProvider implements MetricsProvider {
  private formatTags(tags?: MetricTags): MetricTags {
    return tags ? Object.fromEntries(Object.entries(tags).filter(([, v]) => v !== undefined)) : {};
  }

  increment(name: string, value = 1, tags?: MetricTags): void {
    logger.info('metric_increment', { metric: name, value, tags: this.formatTags(tags) });
  }

  gauge(name: string, value: number, tags?: MetricTags): void {
    logger.info('metric_gauge', { metric: name, value, tags: this.formatTags(tags) });
  }

  histogram(name: string, value: number, tags?: MetricTags): void {
    logger.info('metric_histogram', { metric: name, value, tags: this.formatTags(tags) });
  }
}

const providers: MetricsProvider[] = [new StructuredLogMetricsProvider()];

export function registerMetricsProvider(provider: MetricsProvider): void {
  providers.push(provider);
}

function enrichTags(tags: MetricTags = {}): MetricTags {
  const context = getRequestContext();
  return {
    ...tags,
    requestId: tags.requestId ?? context?.requestId,
    workspaceId: tags.workspaceId ?? context?.workspaceId,
    projectId: tags.projectId ?? context?.projectId,
    environment: config.env,
  };
}

export const metrics = {
  /**
   * Tracks a count (e.g., number of requests, errors, items processed).
   */
  increment: (name: string, value = 1, tags?: MetricTags): void => {
    const enrichedTags = enrichTags(tags);
    providers.forEach(p => p.increment(name, value, enrichedTags));
  },

  /**
   * Tracks an absolute value at a point in time (e.g., queue depth, memory usage).
   */
  gauge: (name: string, value: number, tags?: MetricTags): void => {
    const enrichedTags = enrichTags(tags);
    providers.forEach(p => p.gauge(name, value, enrichedTags));
  },

  /**
   * Tracks a distribution of values (e.g., request duration, query latency).
   */
  histogram: (name: string, value: number, tags?: MetricTags): void => {
    const enrichedTags = enrichTags(tags);
    providers.forEach(p => p.histogram(name, value, enrichedTags));
  }
};
