import { sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  jsonb,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { projects } from './core.js';
import { analysisStatusEnum, analysisStageEnum } from './enums.js';

export const analysisRuns = pgTable(
  'analysis_run',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    status: analysisStatusEnum('status').notNull().default('queued'),
    stage: analysisStageEnum('stage'),
    commitSha: text('commit_sha'),
    progress: integer('progress').notNull().default(0),
    totalFiles: integer('total_files').notNull().default(0),
    processedFiles: integer('processed_files').notNull().default(0),
    resultSummary: jsonb('result_summary'),
    triggeredAt: timestamp('triggered_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    error: text('error'),
  },
  (t) => [
    index('idx_analysis_run_project').on(t.projectId, t.triggeredAt),
  ]
);

export const analysisFileResults = pgTable(
  'analysis_file_result',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    analysisRunId: uuid('analysis_run_id')
      .notNull()
      .references(() => analysisRuns.id, { onDelete: 'cascade' }),
    filePath: text('file_path').notNull(),
    fileHash: text('file_hash').notNull(),
    language: text('language').notNull(),
    dependencies: jsonb('dependencies').notNull().default(sql`'[]'::jsonb`),
    architecture: jsonb('architecture').notNull().default(sql`'[]'::jsonb`),
    codeQuality: jsonb('code_quality').notNull().default(sql`'[]'::jsonb`),
    security: jsonb('security').notNull().default(sql`'[]'::jsonb`),
    performance: jsonb('performance').notNull().default(sql`'[]'::jsonb`),
    documentation: jsonb('documentation').notNull().default(sql`'[]'::jsonb`),
    analyzedAt: timestamp('analyzed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('unq_analysis_run_file').on(t.analysisRunId, t.filePath),
    index('idx_analysis_file_run').on(t.analysisRunId),
  ]
);
