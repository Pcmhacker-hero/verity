/**
 * Worker Entry Point — Doc 17 §3 (Production Architecture).
 *
 * Consumes jobs from pg-boss for long-running tasks:
 * 1. AI Generation Pipeline
 * 2. Verification Runs
 *
 * Runs as a separate process from the web app, but shares the same database.
 */

import { createQueueClient, QUEUE_NAMES, QUEUE_CONFIG } from '@verity/queue';
import { envSchema } from '@verity/shared/validation';
import { GenerationService, VerificationService } from '@verity/services';

async function main() {
  console.log('Starting Verity Worker...');

  // Validate env
  const env = envSchema.parse(process.env);

  // Initialize queue client (pg-boss)
  const boss = await createQueueClient(env.DATABASE_URL);
  
  // Initialize services
  const generationService = new GenerationService();
  const verificationService = new VerificationService();

  // Setup graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down worker gracefully...');
    await boss.stop();
    process.exit(0);
  });
  
  // 1. Single artifact generation consumer
  await boss.work(
    QUEUE_NAMES.GENERATION_SINGLE,
    { batchSize: QUEUE_CONFIG[QUEUE_NAMES.GENERATION_SINGLE].concurrency },
    async (jobs) => {
      for (const job of jobs) {
        // TODO: Process job using generationService
      }
    }
  );

  // 2. Full pipeline generation consumer
  await boss.work(
    QUEUE_NAMES.GENERATION_PIPELINE,
    { batchSize: QUEUE_CONFIG[QUEUE_NAMES.GENERATION_PIPELINE].concurrency },
    async (jobs) => {
      for (const job of jobs) {
        // TODO: Process job using generationService
      }
    }
  );

  // 3. Verification consumer
  await boss.work(
    QUEUE_NAMES.VERIFICATION,
    { batchSize: QUEUE_CONFIG[QUEUE_NAMES.VERIFICATION].concurrency },
    async (jobs) => {
      for (const job of jobs) {
        // TODO: Process job using verificationService
      }
    }
  );

  console.log('Worker is listening for jobs.');
}

main().catch((err) => {
  console.error('Worker failed to start:', err);
  process.exit(1);
});
