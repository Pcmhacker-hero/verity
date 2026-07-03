/**
 * Database client — Doc 17 §6.2 (connection management).
 *
 * Connection pool: max 10 connections per process (web or worker).
 * Total: 20 connections across both processes, within Railway's default limit.
 *
 * Lazy initialization: the postgres client and Drizzle instance are created on
 * first property access, not at module import time. This allows Next.js to
 * import this module during build (for static analysis) without requiring
 * DATABASE_URL to be present in the build environment.
 * The validation still throws immediately on first use if DATABASE_URL is absent,
 * which surfaces the misconfiguration on the first request — not silently.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

type DB = ReturnType<typeof drizzle<typeof schema>>;

function createClient(): DB {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const client = postgres(connectionString, {
    max: 10, // Doc 17 §6.2: 10 connections per process
  });

  return drizzle(client, { schema });
}

let _db: DB | undefined;

function getInstance(): DB {
  if (!_db) {
    _db = createClient();
  }
  return _db;
}

/**
 * Lazily-initialized Drizzle ORM client.
 * All property accesses (select, insert, update, delete, execute, transaction, etc.)
 * are proxied through getInstance(), which creates the client on first use.
 */
export const db: DB = new Proxy({} as DB, {
  get(_target, prop, receiver) {
    return Reflect.get(getInstance(), prop, receiver);
  },
});

