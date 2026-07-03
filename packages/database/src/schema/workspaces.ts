/**
 * Workspace + Membership — Doc 10 §4.1, §4.3.
 *
 * Multi-tenancy from day one (Doc 10 Design Principle 1).
 * v1: exactly one user per workspace, owner role only.
 * The Membership join table exists now so team features (Doc 20 Phase 3)
 * don't require a migration touching every downstream table.
 */

import { pgTable, text, timestamp, uuid, unique } from 'drizzle-orm/pg-core';
import { users } from './auth.js';
import { membershipRoleEnum } from './enums.js';

export const workspaces = pgTable('workspace', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const memberships = pgTable(
  'membership',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: membershipRoleEnum('role').notNull().default('owner'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.workspaceId, t.userId)],
);
