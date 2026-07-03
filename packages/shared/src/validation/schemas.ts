/**
 * Shared Zod validation schemas — Doc 5 §5 (shared type contract).
 *
 * These schemas are used for API request validation (Doc 14),
 * LLM output validation (Doc 13), and frontend form validation.
 * One definition, three consumers (Doc 11 §8).
 */

import { z } from 'zod';
import { MAX_IDEA_TEXT_LENGTH, MAX_PROJECT_NAME_LENGTH } from '../constants/limits.js';
import { ARTIFACT_TYPES } from '../types/artifact.types.js';
import { SEVERITY_LEVELS, SPEC_AREAS, FINDING_STATUSES } from '../types/finding.types.js';

// ──────────────────────────────────────────────────────────────────────────────
// Project schemas
// ──────────────────────────────────────────────────────────────────────────────

export const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100).trim(),
});

export const createProjectSchema = z.object({
  name: z.string().min(1).max(MAX_PROJECT_NAME_LENGTH).trim(),
  githubRepoFullName: z.string().min(1).max(200).trim().optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(MAX_PROJECT_NAME_LENGTH).trim().optional(),
});

export const projectIdParamsSchema = z.object({
  projectId: z.string().uuid(),
});

export const listProjectsQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sort: z.enum(['updated_at', 'created_at', 'name']).default('updated_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
  query: z.string().trim().min(1).max(100).optional(),
  hasRepoConnection: z
    .preprocess((value) => {
      if (value === 'true') return true;
      if (value === 'false') return false;
      return value;
    }, z.boolean())
    .optional(),
});

const isoDateTimeSchema = z.string().datetime();

export const workspaceResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  createdAt: isoDateTimeSchema,
});

export const projectSpecVersionSummarySchema = z.object({
  id: z.string().uuid(),
  versionNumber: z.number().int().positive(),
  createdAt: isoDateTimeSchema,
});

export const projectSpecVersionDetailSchema = projectSpecVersionSummarySchema.extend({
  source: z.enum(['generation', 'edit', 'regeneration']),
  changeSummary: z.string().nullable(),
});

export const projectSummaryResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  currentSpecVersion: projectSpecVersionSummarySchema.nullable(),
  hasRepoConnection: z.boolean(),
  lastVerificationStatus: z.enum(['clean', 'findings', 'failed', 'never_run']),
  updatedAt: isoDateTimeSchema,
  createdAt: isoDateTimeSchema,
});

export const repoConnectionInfoSchema = z.object({
  id: z.string().uuid(),
  githubRepoFullName: z.string(),
  connectedAt: isoDateTimeSchema,
});

export const verificationSummarySchema = z.object({
  lastRunId: z.string().uuid(),
  lastRunStatus: z.enum(['queued', 'running_deterministic', 'running_semantic', 'complete', 'failed']),
  lastRunSpecVersionId: z.string().uuid(),
  lastRunSpecVersionNumber: z.number().int().positive().nullable(),
  completedAt: isoDateTimeSchema.nullable(),
  findingCounts: z.object({
    critical: z.number().int().nonnegative(),
    high: z.number().int().nonnegative(),
    medium: z.number().int().nonnegative(),
    low: z.number().int().nonnegative(),
    info: z.number().int().nonnegative(),
  }),
});

export const projectDetailResponseSchema = projectSummaryResponseSchema.extend({
  currentSpecVersion: projectSpecVersionDetailSchema.nullable(),
  repoConnection: repoConnectionInfoSchema.nullable(),
  verificationSummary: verificationSummarySchema.nullable(),
  versionContextStatus: z.enum([
    'verified_clean',
    'verified_with_findings',
    'spec_changed_since_verification',
    'never_verified',
  ]),
});

export const projectListResponseSchema = z.object({
  data: z.array(projectSummaryResponseSchema),
  pagination: z.object({
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
  }),
});

// ──────────────────────────────────────────────────────────────────────────────
// Generation schemas
// ──────────────────────────────────────────────────────────────────────────────

export const generatePipelineSchema = z.object({
  ideaText: z.string().min(10).max(MAX_IDEA_TEXT_LENGTH),
});

export const generateSingleSchema = z.object({
  artifactType: z.enum(ARTIFACT_TYPES),
  specVersionId: z.string().uuid().optional(),
});

// ──────────────────────────────────────────────────────────────────────────────
// Verification schemas
// ──────────────────────────────────────────────────────────────────────────────

export const triggerVerificationSchema = z.object({
  specVersionId: z.string().uuid().optional(), // defaults to current
});

// ──────────────────────────────────────────────────────────────────────────────
// Repo connection schemas
// ──────────────────────────────────────────────────────────────────────────────

export const connectRepoSchema = z.object({
  githubRepoFullName: z.string().regex(/^[^/]+\/[^/]+$/, 'Must be in format owner/repo'),
});

// ──────────────────────────────────────────────────────────────────────────────
// Finding filter schemas
// ──────────────────────────────────────────────────────────────────────────────

export const findingsFilterSchema = z.object({
  severity: z.enum(SEVERITY_LEVELS).optional(),
  specArea: z.enum(SPEC_AREAS).optional(),
  status: z.enum(FINDING_STATUSES).optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
});

// ──────────────────────────────────────────────────────────────────────────────
// Specification Artifact Schemas (Doc 10 & 14)
// ──────────────────────────────────────────────────────────────────────────────

const baseArtifactSchema = z.object({
  id: z.string().uuid().optional(),
});

export const prdArtifactSchema = baseArtifactSchema.extend({
  problemStatement: z.string().min(1),
  targetUsers: z.array(
    z.object({
      id: z.string().uuid(),
      description: z.string(),
      priority: z.string().optional(),
    })
  ),
  features: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      description: z.string(),
      priority: z.string().optional(),
    })
  ),
  nonGoals: z.array(
    z.object({
      id: z.string().uuid(),
      description: z.string(),
    })
  ),
  successCriteria: z.array(
    z.object({
      id: z.string().uuid(),
      description: z.string(),
    })
  ),
  narrative: z.string(),
});

export const architectureArtifactSchema = baseArtifactSchema.extend({
  components: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      description: z.string(),
      techChoice: z.string(),
      rationale: z.string(),
      prdFeatureRefs: z.array(z.string().uuid()),
      isManuallyEdited: z.boolean().default(false),
    })
  ),
  dataFlow: z.array(
    z.object({
      from: z.string().uuid(),
      to: z.string().uuid(),
      description: z.string(),
    })
  ),
});

export const schemaFieldSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  dataType: z.string(),
  isRequired: z.boolean(),
  isUnique: z.boolean(),
  foreignKeyRef: z.string().uuid().nullable().optional(),
});

export const schemaEntitySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  architectureComponentRef: z.string().uuid().nullable().optional(),
  fields: z.array(schemaFieldSchema),
});

export const schemaArtifactSchema = baseArtifactSchema.extend({
  entities: z.array(schemaEntitySchema),
});

export const apiEndpointSchema = z.object({
  id: z.string().uuid(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  path: z.string(),
  requestShape: z.record(z.unknown()),
  responseShape: z.record(z.unknown()),
  authRequired: z.boolean(),
  requiredRole: z.string().nullable().optional(),
  schemaEntityRefs: z.array(z.string().uuid()),
});

export const apiArtifactSchema = baseArtifactSchema.extend({
  endpoints: z.array(apiEndpointSchema),
});

export const repoStructureNodeSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    name: z.string(),
    type: z.enum(['directory', 'file']),
    purpose: z.string(),
    children: z.array(repoStructureNodeSchema).optional(),
  })
);

export const repoStructureArtifactSchema = baseArtifactSchema.extend({
  tree: repoStructureNodeSchema,
});

export const roadmapPhaseSchema = z.object({
  id: z.string().uuid(),
  order: z.number().int().positive(),
  name: z.string(),
  description: z.string(),
});

export const roadmapArtifactSchema = baseArtifactSchema.extend({
  phases: z.array(roadmapPhaseSchema),
});

export const taskSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  roadmapPhaseId: z.string().uuid(),
  prdFeatureRef: z.string().uuid(),
  architectureComponentRef: z.string().uuid(),
  schemaEntityRefs: z.array(z.string().uuid()),
  apiEndpointRefs: z.array(z.string().uuid()),
});

export const tasksArtifactSchema = baseArtifactSchema.extend({
  data: z.array(taskSchema),
  pagination: z.object({
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
  }).optional(),
});

// ──────────────────────────────────────────────────────────────────────────────
// Config validation (Doc 17 §13.3 — validated at startup)
// ──────────────────────────────────────────────────────────────────────────────

export const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  BETTER_AUTH_SECRET: z.string().min(32).optional(),
  BETTER_AUTH_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  LLM_PROVIDER: z.enum(['anthropic', 'openai', 'mock']).default('mock'),
  LLM_MODEL: z.string().default('claude-sonnet-4-20250514'),
  LLM_MAX_TOKENS: z.coerce.number().default(8192),
  CLAUDE_API_KEY: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_APP_ID: z.string().optional(),
  GITHUB_APP_PRIVATE_KEY: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(1.0),
  JOB_CONCURRENCY: z.coerce.number().default(5),
  RATE_LIMIT_STANDARD: z.coerce.number().default(60),
  RATE_LIMIT_EXPENSIVE: z.coerce.number().default(10),
  ENABLE_SEMANTIC_VERIFICATION: z.coerce.boolean().default(true),
  ENABLE_EMAIL_VERIFICATION: z.coerce.boolean().default(false),
});

export type EnvConfig = z.infer<typeof envSchema>;
