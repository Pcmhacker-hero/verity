/**
 * Queue definitions — Doc 18 §6.3.
 *
 * Three queues with different priorities:
 * - generation-single (High): user waiting for single artifact
 * - generation-pipeline (Medium): full 7-stage pipeline
 * - verification (Normal): verification runs
 */

export const QUEUE_NAMES = {
  GENERATION_SINGLE: 'generation-single',
  GENERATION_PIPELINE: 'generation-pipeline',
  VERIFICATION: 'verification',
} as const;

/**
 * Per-queue configuration.
 * Concurrency limits are per worker instance (Doc 18 §6.3).
 */
export const QUEUE_CONFIG = {
  [QUEUE_NAMES.GENERATION_SINGLE]: {
    priority: 3, // Highest
    concurrency: 5,
    retryLimit: 1,
    retryDelay: 4, // seconds
    expireInMinutes: 5,
  },
  [QUEUE_NAMES.GENERATION_PIPELINE]: {
    priority: 2,
    concurrency: 4,
    retryLimit: 1,
    retryDelay: 4,
    expireInMinutes: 15,
  },
  [QUEUE_NAMES.VERIFICATION]: {
    priority: 1,
    concurrency: 5,
    retryLimit: 1,
    retryDelay: 4,
    expireInMinutes: 15,
  },
} as const;
