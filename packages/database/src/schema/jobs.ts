/**
 * Job Queue persistence — Doc 11 §4, Doc 14 §4.2, Doc 18 §6.
 *
 * Generic job table for all async work (generation + verification).
 * pg-boss uses its own tables for queue mechanics; this table is the
 * application-level source of truth for job status, progress, and results.
 */

import { sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  jsonb,
  index,
  check,
  boolean,
} from 'drizzle-orm/pg-core';
import { projects } from './core.js';
import { jobStatusEnum, jobTypeEnum, generationStageEnum, verificationStageEnum } from './enums.js';

export const jobs = pgTable(
  'job',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').notNull(),
    userId: uuid('user_id').notNull(),
    type: jobTypeEnum('type').notNull(),
    status: jobStatusEnum('status').notNull().default('queued'),

    // Stage is type-specific: generation_stage for generation jobs,
    // verification_stage for verification jobs. Null when not running.
    generationStage: generationStageEnum('generation_stage'),
    verificationStage: verificationStageEnum('verification_stage'),

    // Progress tracking for polling UI (Doc 14 §4.2)
    currentStep: text('current_step'),
    stepsCompleted: integer('steps_completed').notNull().default(0),
    stepsTotal: integer('steps_total').notNull().default(1),
    completedSteps: jsonb('completed_steps').notNull().default(sql`'[]'::jsonb`),

    // Input payload (JSON-serialized, opaque to queue layer)
    payload: jsonb('payload').notNull(),

    // Result populated on completion
    result: jsonb('result'),

    // Error populated on failure
    error: jsonb('error'),

    // Idempotency key to prevent duplicate enqueues (Doc 11 §4)
    idempotencyKey: text('idempotency_key').unique(),

    // Retry tracking
    attempt: integer('attempt').notNull().default(1),
    maxAttempts: integer('max_attempts').notNull().default(3),
    lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
    nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),

    // Cancellation support
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancellationReason: text('cancellation_reason'),

    // Dead-letter tracking
    deadLetterAt: timestamp('dead_letter_at', { withTimezone: true }),
    deadLetterReason: text('dead_letter_reason'),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [
    index('idx_job_project_status').on(t.projectId, t.status),
    index('idx_job_workspace_status').on(t.workspaceId, t.status),
    index('idx_job_status_next_retry').on(t.status, t.nextRetryAt),
    index('idx_job_idempotency').on(t.idempotencyKey),
    check('job_steps_nonnegative', sql`${t.stepsCompleted} >= 0 AND ${t.stepsTotal} > 0`),
    check('job_attempt_positive', sql`${t.attempt} > 0`),
    check('job_max_attempts_positive', sql`${t.maxAttempts} > 0`),
  ],
);