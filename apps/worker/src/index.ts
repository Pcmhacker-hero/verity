/**
 * Worker Entry Point — Doc 17 §3 (Production Architecture).
 *
 * Consumes jobs for long-running tasks:
 * 1. AI Generation Pipeline
 * 2. Verification Runs
 * 3. Repository Sync + Analysis
 *
 * Runs as a separate process from the web app, but shares the same database.
 * Each processor polls the job table independently; no pg-boss handler registration needed.
 */

import { logger } from '@verity/shared/observability';
import { config } from '@verity/shared';
import { closeDB } from '@verity/database';
import { syncJobProcessor } from './processors/sync.processor.js';
import { generationJobProcessor } from './processors/generation.processor.js';
import { verificationJobProcessor } from './processors/verification.processor.js';

const processors = [syncJobProcessor, generationJobProcessor, verificationJobProcessor];

async function main() {
  logger.info('Starting Verity Worker...');

  // Setup graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down worker gracefully...');
    await closeDB();
    process.exit(0);
  });

  // Note: processors self-poll the job table — no pg-boss subscription needed.
  // They are instantiated above and are already active. In a future milestone
  // we can wire them to pg-boss by extending the queue's BaseWorker.
  logger.info('Worker is listening for jobs.', {
    processors: processors.map((p) => p.constructor.name),
  });
}

main().catch((err) => {
  logger.fatal('Worker failed to start', { error: err });
  process.exit(1);
});
