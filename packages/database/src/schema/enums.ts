/**
 * Database enums — Doc 10 §4–6.
 *
 * Postgres native enums for type safety at the database level.
 */

import { pgEnum } from 'drizzle-orm/pg-core';

/** Doc 10 §4.3 — Membership roles */
export const membershipRoleEnum = pgEnum('membership_role', ['owner', 'admin', 'member']);

/** Doc 10 §5.1 — How a SpecVersion was created */
export const specVersionSourceEnum = pgEnum('spec_version_source', [
  'generation',
  'edit',
  'regeneration',
]);

/** Doc 10 §5.5 — HTTP methods for API endpoints */
export const httpMethodEnum = pgEnum('http_method', ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

/** Doc 10 §6.2 — Verification run lifecycle */
export const verificationRunStatusEnum = pgEnum('verification_run_status', [
  'queued',
  'running_deterministic',
  'running_semantic',
  'complete',
  'failed',
]);

/** Doc 10 §6.3, Doc 9 §3 — Finding severity */
export const severityEnum = pgEnum('severity', ['critical', 'high', 'medium', 'low', 'info']);

/** Doc 10 §6.3 — Spec area for finding grouping */
export const specAreaEnum = pgEnum('spec_area', [
  'auth',
  'schema',
  'api_contract',
  'architecture',
  'other',
]);

/** Doc 10 §6.3 — Which verification tier produced the finding */
export const detectionTierEnum = pgEnum('detection_tier', ['deterministic', 'semantic']);

/** Doc 10 §6.3 — Finding status */
export const findingStatusEnum = pgEnum('finding_status', ['open', 'acknowledged']);

/** Doc 11 §4, Doc 14 §4.2 — Async job lifecycle (generic, shared by generation & verification) */
export const jobStatusEnum = pgEnum('job_status', ['queued', 'running', 'complete', 'failed', 'cancelled']);

/** Doc 11 §4, Doc 14 §4.2 — Job type discriminator */
export const jobTypeEnum = pgEnum('job_type', ['generation-single', 'generation-pipeline', 'verification']);

/** Doc 14 §4.2 — Generation stage for progress reporting */
export const generationStageEnum = pgEnum('generation_stage', [
  'prd',
  'architecture',
  'schema',
  'api',
  'repo_structure',
  'roadmap',
  'tasks',
]);

/** Doc 14 §4.2 — Verification stage for progress reporting */
export const verificationStageEnum = pgEnum('verification_stage', [
  'deterministic',
  'semantic',
]);
