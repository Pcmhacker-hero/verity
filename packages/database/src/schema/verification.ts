/**
 * Verification entities — Doc 10 §6.
 *
 * VerificationRun and Finding.
 * Every Finding traces to exactly one SpecVersion and one spec element (Design Principle 4).
 */

import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid, integer, index, check } from 'drizzle-orm/pg-core';
import { projects, specVersions } from './core.js';
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
  },
  (t) => [
    /** Doc 18 §5.3: findings by run + severity (primary filter) */
    index('idx_finding_run_severity').on(t.verificationRunId, t.severity),
    /** Doc 18 §5.3: findings by run + spec area (secondary filter) */
    index('idx_finding_run_spec_area').on(t.verificationRunId, t.specArea),
    check('finding_line_number_positive', sql`${t.lineNumber} IS NULL OR ${t.lineNumber} > 0`),
  ],
);
