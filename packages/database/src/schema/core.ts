/**
 * Circular core entities — Doc 10 §4.4, §5.1, §6.1.
 *
 * Project, SpecVersion, and RepoConnection intentionally point at each other:
 * Project has a nullable current SpecVersion and RepoConnection pointer, while
 * SpecVersion and RepoConnection both belong to Project. Keeping them in one
 * module avoids runtime import cycles while preserving database foreign keys.
 */

import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { pgTable, text, timestamp, uuid, integer, index, unique } from 'drizzle-orm/pg-core';
import { specVersionSourceEnum } from './enums.js';
import { workspaces } from './workspaces.js';

export const projects = pgTable(
  'project',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    currentSpecVersionId: uuid('current_spec_version_id').references(
      (): AnyPgColumn => specVersions.id,
      { onDelete: 'restrict' },
    ),
    repoConnectionId: uuid('repo_connection_id').references((): AnyPgColumn => repoConnections.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('idx_project_workspace_updated').on(t.workspaceId, t.updatedAt)],
);

export const specVersions = pgTable(
  'spec_version',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'restrict' }),
    versionNumber: integer('version_number').notNull(),
    source: specVersionSourceEnum('source').notNull(),
    changeSummary: text('change_summary'),
    previousVersionId: uuid('previous_version_id').references((): AnyPgColumn => specVersions.id, {
      onDelete: 'restrict',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.projectId, t.versionNumber), index('idx_spec_version_project').on(t.projectId, t.versionNumber)],
);

export const repoConnections = pgTable(
  'repo_connection',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    githubRepoFullName: text('github_repo_full_name').notNull(),
    oauthTokenRef: text('oauth_token_ref').notNull(),
    connectedAt: timestamp('connected_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.projectId)],
);
