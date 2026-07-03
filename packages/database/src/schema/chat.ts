import { pgTable, text, uuid, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { authUsers } from './auth.js';
import { projects } from './core.js';

export const chatSessions = pgTable(
  'chat_session',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('idx_chat_session_project').on(t.projectId),
    index('idx_chat_session_user').on(t.userId),
  ]
);

export const chatMessages = pgTable(
  'chat_message',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => chatSessions.id, { onDelete: 'cascade' }),
    role: text('role').notNull(), // 'user', 'assistant', 'system'
    content: text('content').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('idx_chat_message_session').on(t.sessionId),
  ]
);

export const chatSessionsRelations = relations(chatSessions, ({ many, one }) => ({
  messages: many(chatMessages),
  project: one(projects, {
    fields: [chatSessions.projectId],
    references: [projects.id],
  }),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  session: one(chatSessions, {
    fields: [chatMessages.sessionId],
    references: [chatSessions.id],
  }),
}));
