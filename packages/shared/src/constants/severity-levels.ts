/**
 * Severity level display configuration.
 */
export { SEVERITY_LEVELS } from '../types/finding.types.js';

export const SEVERITY_DISPLAY: Record<string, { label: string; color: string; priority: number }> =
  {
    critical: { label: 'Critical', color: '#DC2626', priority: 0 },
    high: { label: 'High', color: '#EA580C', priority: 1 },
    medium: { label: 'Medium', color: '#CA8A04', priority: 2 },
    low: { label: 'Low', color: '#2563EB', priority: 3 },
    info: { label: 'Info', color: '#6B7280', priority: 4 },
  };
