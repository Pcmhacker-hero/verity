/**
 * Finding types — Doc 9 §3, Doc 10 §6.3.
 *
 * Severity taxonomy per Document 9's prioritized taxonomy.
 * spec_area enum powers Document 8's spec-area grouping on the Findings Dashboard.
 * detection_tier tracks which verification tier produced the finding (Doc 11 §6).
 */

export const SEVERITY_LEVELS = ['critical', 'high', 'medium', 'low', 'info'] as const;
export type Severity = (typeof SEVERITY_LEVELS)[number];

export const SPEC_AREAS = ['auth', 'schema', 'api_contract', 'architecture', 'other'] as const;
export type SpecArea = (typeof SPEC_AREAS)[number];

export const DETECTION_TIERS = ['deterministic', 'semantic'] as const;
export type DetectionTier = (typeof DETECTION_TIERS)[number];

export const FINDING_STATUSES = ['open', 'acknowledged'] as const;
export type FindingStatus = (typeof FINDING_STATUSES)[number];

export const VERIFICATION_RUN_STATUSES = [
  'queued',
  'running_deterministic',
  'running_semantic',
  'complete',
  'failed',
] as const;
export type VerificationRunStatus = (typeof VERIFICATION_RUN_STATUSES)[number];
