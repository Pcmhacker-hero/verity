/**
 * Spec + Artifact tables — Doc 10 §5.
 *
 * SpecVersion is immutable (Doc 10 Design Principle 2) — no updated_at field.
 * Artifacts are structured (not prose blobs) to enable deterministic verification.
 *
 * Schema/API artifacts are split into normalized sub-tables for queryability
 * at verification time (Doc 10 §5.4, §5.5).
 */

import { sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  uuid,
  integer,
  jsonb,
  boolean,
  unique,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { specVersions } from './core.js';
import { httpMethodEnum } from './enums.js';

// ──────────────────────────────────────────────────────────────────────────────
// PRD Artifact — Doc 10 §5.2
// ──────────────────────────────────────────────────────────────────────────────

export const prdArtifacts = pgTable(
  'prd_artifact',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    specVersionId: uuid('spec_version_id')
      .notNull()
      .references(() => specVersions.id, { onDelete: 'cascade' }),
    problemStatement: text('problem_statement').notNull(),
    targetUsers: jsonb('target_users').notNull().default([]),
    features: jsonb('features').notNull().default([]),
    nonGoals: jsonb('non_goals').notNull().default([]),
    successCriteria: jsonb('success_criteria').notNull().default([]),
    narrative: text('narrative').notNull().default(''),
  },
  (t) => [unique().on(t.specVersionId)],
);

// ──────────────────────────────────────────────────────────────────────────────
// Architecture Artifact — Doc 10 §5.3
// ──────────────────────────────────────────────────────────────────────────────

export const architectureArtifacts = pgTable(
  'architecture_artifact',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    specVersionId: uuid('spec_version_id')
      .notNull()
      .references(() => specVersions.id, { onDelete: 'cascade' }),
    components: jsonb('components').notNull().default([]),
    dataFlow: jsonb('data_flow').notNull().default([]),
  },
  (t) => [unique().on(t.specVersionId)],
);

// ──────────────────────────────────────────────────────────────────────────────
// Schema Artifact (normalized) — Doc 10 §5.4
// ──────────────────────────────────────────────────────────────────────────────

export const schemaArtifacts = pgTable(
  'schema_artifact',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    specVersionId: uuid('spec_version_id')
      .notNull()
      .references(() => specVersions.id, { onDelete: 'cascade' }),
  },
  (t) => [unique().on(t.specVersionId)],
);

export const schemaEntities = pgTable(
  'schema_entity',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    schemaArtifactId: uuid('schema_artifact_id')
      .notNull()
      .references(() => schemaArtifacts.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    architectureComponentRef: uuid('architecture_component_ref'),
  },
  (t) => [unique().on(t.schemaArtifactId, t.name), index('idx_schema_entity_artifact').on(t.schemaArtifactId)],
);

export const schemaFields = pgTable(
  'schema_field',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    schemaEntityId: uuid('schema_entity_id')
      .notNull()
      .references(() => schemaEntities.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    dataType: text('data_type').notNull(),
    isRequired: boolean('is_required').notNull().default(true),
    isUnique: boolean('is_unique').notNull().default(false),
    foreignKeyRef: uuid('foreign_key_ref').references(() => schemaEntities.id, {
      onDelete: 'restrict',
    }),
  },
  (t) => [unique().on(t.schemaEntityId, t.name), index('idx_schema_field_entity').on(t.schemaEntityId)],
);

// ──────────────────────────────────────────────────────────────────────────────
// API Artifact (normalized) — Doc 10 §5.5
// ──────────────────────────────────────────────────────────────────────────────

export const apiArtifacts = pgTable(
  'api_artifact',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    specVersionId: uuid('spec_version_id')
      .notNull()
      .references(() => specVersions.id, { onDelete: 'cascade' }),
  },
  (t) => [unique().on(t.specVersionId)],
);

export const apiEndpoints = pgTable(
  'api_endpoint',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    apiArtifactId: uuid('api_artifact_id')
      .notNull()
      .references(() => apiArtifacts.id, { onDelete: 'cascade' }),
    method: httpMethodEnum('method').notNull(),
    path: text('path').notNull(),
    requestShape: jsonb('request_shape').notNull().default({}),
    responseShape: jsonb('response_shape').notNull().default({}),
    /** Doc 10 §5.5: explicit, not inferred — Epic E2's most important field */
    authRequired: boolean('auth_required').notNull(),
    requiredRole: text('required_role'),
    schemaEntityRefs: uuid('schema_entity_refs')
      .array()
      .notNull()
      .default(sql`ARRAY[]::uuid[]`),
  },
  (t) => [unique().on(t.apiArtifactId, t.method, t.path), index('idx_api_endpoint_artifact').on(t.apiArtifactId)],
);

// ──────────────────────────────────────────────────────────────────────────────
// Repo Structure, Roadmap, Tasks — Doc 10 §5.6
// ──────────────────────────────────────────────────────────────────────────────

export const repoStructureArtifacts = pgTable(
  'repo_structure_artifact',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    specVersionId: uuid('spec_version_id')
      .notNull()
      .references(() => specVersions.id, { onDelete: 'cascade' }),
    tree: jsonb('tree').notNull().default({}),
  },
  (t) => [unique().on(t.specVersionId)],
);

export const roadmapArtifacts = pgTable(
  'roadmap_artifact',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    specVersionId: uuid('spec_version_id')
      .notNull()
      .references(() => specVersions.id, { onDelete: 'cascade' }),
  },
  (t) => [unique().on(t.specVersionId)],
);

export const roadmapPhases = pgTable(
  'roadmap_phase',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roadmapArtifactId: uuid('roadmap_artifact_id')
      .notNull()
      .references(() => roadmapArtifacts.id, { onDelete: 'cascade' }),
    order: integer('order').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
  },
  (t) => [
    unique().on(t.roadmapArtifactId, t.order),
    index('idx_roadmap_phase_artifact').on(t.roadmapArtifactId),
    check('roadmap_phase_order_positive', sql`${t.order} > 0`),
  ],
);

export const taskArtifacts = pgTable(
  'task_artifact',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    specVersionId: uuid('spec_version_id')
      .notNull()
      .references(() => specVersions.id, { onDelete: 'cascade' }),
  },
  (t) => [unique().on(t.specVersionId)],
);

export const tasks = pgTable(
  'task',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskArtifactId: uuid('task_artifact_id')
      .notNull()
      .references(() => taskArtifacts.id, { onDelete: 'cascade' }),
    roadmapPhaseId: uuid('roadmap_phase_id')
      .notNull()
      .references(() => roadmapPhases.id, { onDelete: 'restrict' }),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    prdFeatureRef: text('prd_feature_ref').notNull(),
    architectureComponentRef: uuid('architecture_component_ref').notNull(),
    schemaEntityRefs: uuid('schema_entity_refs')
      .array()
      .notNull()
      .default(sql`ARRAY[]::uuid[]`),
    apiEndpointRefs: uuid('api_endpoint_refs')
      .array()
      .notNull()
      .default(sql`ARRAY[]::uuid[]`),
  },
  (t) => [index('idx_task_artifact').on(t.taskArtifactId), index('idx_task_roadmap_phase').on(t.roadmapPhaseId)],
);
