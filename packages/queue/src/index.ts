/**
 * @verity/queue — Job queue abstraction.
 *
 * Blueprint source: Doc 18 §6.1 (pg-boss decision), Doc 11 §4 (async job architecture).
 * pg-boss uses the existing Postgres database — no additional infrastructure.
 */

export { createQueueClient } from './client.js';
export { QUEUE_NAMES, QUEUE_CONFIG } from './jobs.js';
export type { QueueClient } from './client.js';

export { BaseWorker } from './worker.js';
export { workerRegistry, WorkerRegistry } from './registry.js';
export { QueueService, initializeQueueService, getQueueService, shutdownQueueService } from './service.js';



export * from './utils/background-tasks.js';
export * from './utils/monitoring.js';
