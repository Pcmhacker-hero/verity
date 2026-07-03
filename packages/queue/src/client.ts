/**
 * Queue client — pg-boss initialization.
 *
 * Doc 18 §6.2: pg-boss configuration.
 * Completed jobs archived after 7 days, failed after 30 days.
 */

import PgBoss from 'pg-boss';
import { QUEUE_NAMES, QUEUE_CONFIG } from './jobs.js';

export type QueueClient = PgBoss;

export { QUEUE_NAMES, QUEUE_CONFIG };

export async function createQueueClient(connectionString: string): Promise<QueueClient> {
  const boss = new PgBoss({
    connectionString,

    // Doc 18 §6.2: job retention
    archiveCompletedAfterSeconds: 60 * 60 * 24 * 7, // 7 days
    archiveFailedAfterSeconds: 60 * 60 * 24 * 30, // 30 days
    deleteAfterSeconds: 60 * 60 * 24 * 30, // 30 days

    // Doc 18 §20: polling interval (start at 2s, tune based on production metrics)
    monitorStateIntervalSeconds: 30,
  });

  await boss.start();
  return boss;
}
