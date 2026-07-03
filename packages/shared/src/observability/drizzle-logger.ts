import { metrics } from './metrics.js';
import { getRequestContext } from './context.js';

export interface LogWriter {
  logQuery(query: string, params: unknown[]): void;
}

export class DrizzleMetricsLogger implements LogWriter {
  logQuery(query: string, params: unknown[]): void {
    // Drizzle's default logger does not measure duration.
    // However, we can track query execution counts here.
    // To measure duration precisely without monkey-patching postgres,
    // we would need to wrap queries at the repository level.
    // For now, we log the query count metric.
    
    // We try to extract a rough query type (SELECT, INSERT, UPDATE, DELETE)
    const typeMatch = query.match(/^\s*(SELECT|INSERT|UPDATE|DELETE)/i);
    const queryType = typeMatch?.[1]?.toUpperCase() ?? 'OTHER';
    
    const context = getRequestContext();
    const tags: Record<string, string> = { type: queryType };
    if (context?.traceId) tags.traceId = context.traceId;
    
    metrics.increment('database_query_count', 1, tags);
  }
}
