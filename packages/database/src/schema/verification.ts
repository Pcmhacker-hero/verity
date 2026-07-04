/**
 * Verification entities — Doc 10 §6.
 *
 * VerificationRun and Finding.
 * Every Finding traces to exactly one SpecVersion and one spec element (Design Principle 4).
 */

import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid, integer, index, check, jsonb } from 'drizzle-orm/pg-core';
import { projects, specVersions } from './core.js';
import { authUsers } from './auth.js';
import {
  verificationRunStatusEnum,
  severityEnum,
  specAreaEnum,
  detectionTierEnum,
  findingStatusEnum,
} from './enums.js';

// ──────────────────────────────────────────────────────────────────────────────
// VerificationRun — Doc 10 §6.2
// ──────────────────────────────────────────────────────────────────────────────

export const verificationRuns = pgTable(
  'verification_run',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    /** Fixed at trigger time — Doc 10 §6.2, Epic H4 traceability */
    specVersionId: uuid('spec_version_id')
      .notNull()
      .references(() => specVersions.id, { onDelete: 'restrict' }),
    status: verificationRunStatusEnum('status').notNull().default('queued'),
    /** Exact repo state checked, for reproducibility */
    commitSha: text('commit_sha'),
    /** Document 18 §8.1: track file hashes for incremental verification */
    analyzedFileHashes: jsonb('analyzed_file_hashes'),
    triggeredAt: timestamp('triggered_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [index('idx_verification_run_project').on(t.projectId, t.triggeredAt)],
);

// ──────────────────────────────────────────────────────────────────────────────
// Finding — Doc 10 §6.3
// ──────────────────────────────────────────────────────────────────────────────

export const findings = pgTable(
  'finding',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    verificationRunId: uuid('verification_run_id')
      .notNull()
      .references(() => verificationRuns.id, { onDelete: 'cascade' }),
    severity: severityEnum('severity').notNull(),
    specArea: specAreaEnum('spec_area').notNull(),
    /** Points to specific violated element (e.g., APIEndpoint.id) — Design Principle 4 */
    specElementRef: text('spec_element_ref').notNull(),
    filePath: text('file_path'),
    lineNumber: integer('line_number'),
    explanation: text('explanation').notNull(),
    detectionTier: detectionTierEnum('detection_tier').notNull(),
    /** Doc 10 §6.3: column exists now for Epic H6 (Later) — zero-cost future migration */
    status: findingStatusEnum('status').notNull().default('open'),
    assigneeId: text('assignee_id').references(() => authUsers.id, { onDelete: 'set null' }),
  },
  (t) => [
    /** Doc 18 §5.3: findings by run + severity (primary filter) */
    index('idx_finding_run_severity').on(t.verificationRunId, t.severity),
    /** Doc 18 §5.3: findings by run + spec area (secondary filter) */
    index('idx_finding_run_spec_area').on(t.verificationRunId, t.specArea),
    check('finding_line_number_positive', sql`${t.lineNumber} IS NULL OR ${t.lineNumber} > 0`),
  ],
);

// ──────────────────────────────────────────────────────────────────────────────
// Finding Comment — Milestone 8 (Team Collaboration)
// ──────────────────────────────────────────────────────────────────────────────

export const findingComments = pgTable(
  'finding_comment',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    findingId: uuid('finding_id')
      .notNull()
      .references(() => findings.id, { onDelete: 'cascade' }),
    authorId: text('author_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_finding_comment_finding').on(t.findingId, t.createdAt)]
);
