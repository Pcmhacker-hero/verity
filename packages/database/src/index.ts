/**
 * @verity/database — Drizzle ORM schema and client.
 *
 * Blueprint source: Doc 10 (Data Model), Doc 17 §6 (Database Deployment).
 * Postgres 16 with Drizzle ORM for type-safe queries.
 */

export { db } from './client.js';
export * from './schema/index.js';
