/**
 * Background Task Utilities — Doc 11 §4, Doc 13 §11.
 *
 * Reusable utilities for async job patterns:
 * - Idempotent job creation
 * - Progress tracking helpers
 * - Retry orchestration
 * - Timeout/heartbeat utilities
 */

import { randomUUID } from 'crypto';
import { db } from '@verity/database';
import { jobs } from '@verity/database/schema';
import { eq, and } from 'drizzle-orm';
import type { JobType, AnyJobPayload, JobStatusResponse, JobError } from '@verity/shared/types';

/**
 * Creates an idempotency key for a job based on its inputs.
 * Prevents duplicate jobs from being enqueued.
 */
export function createIdempotencyKey(
  type: JobType,
  projectId: string,
  userId: string,
  extra?: string
): string {
  const parts = [type, projectId, userId];
  if (extra) parts.push(extra);
  return parts.join(':');
}

/**
 * Checks if a job with the given idempotency key already exists
 * and is still in a non-terminal state.
 */
export async function getExistingNonTerminalJob(
  idempotencyKey: string
): Promise<{ id: string; status: string } | null> {
  const result = await db
    .select({ id: jobs.id, status: jobs.status })
    .from(jobs)
    .where(and(
      eq(jobs.idempotencyKey, idempotencyKey),
      eq(jobs.status, 'queued')
    ))
    .limit(1);
  
  if (result[0]) return { id: result[0].id, status: result[0].status };

  // Also check running jobs
  const runningResult = await db
    .select({ id: jobs.id, status: jobs.status })
    .from(jobs)
    .where(and(
      eq(jobs.idempotencyKey, idempotencyKey),
      eq(jobs.status, 'running')
    ))
    .limit(1);

  if (runningResult[0]) return { id: runningResult[0].id, status: runningResult[0].status };

  return null;
}

/**
 * Waits for a job to reach a terminal state (complete, failed, cancelled).
 * Useful for testing or synchronous-like flows.
 */
export async function waitForJobCompletion(
  jobId: string,
  workspaceId: string,
  options: {
    pollIntervalMs?: number;
    timeoutMs?: number;
    onProgress?: (status: JobStatusResponse) => void;
  } = {}
): Promise<JobStatusResponse> {
  const { pollIntervalMs = 2000, timeoutMs = 300000, onProgress } = options;
  const startTime = Date.now();

  while (true) {
    const result = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, jobId), eq(jobs.workspaceId, workspaceId)))
      .limit(1);

    if (!result[0]) {
      throw new Error('JOB_NOT_FOUND');
    }

    const job = result[0];
    const response = mapJobToResponse(job);
    
    if (onProgress) {
      onProgress(response);
    }

    if (response.status === 'complete' || response.status === 'failed' || response.status === 'cancelled') {
      return response;
    }

    if (Date.now() - startTime > timeoutMs) {
      throw new Error('JOB_TIMEOUT');
    }

    await sleep(pollIntervalMs);
  }
}

/**
 * Maps a database job record to the API response format.
 */
export function mapJobToResponse(job: any): JobStatusResponse {
  const stage = job.generationStage || job.verificationStage;
  const progress = {
    currentStep: job.currentStep || '',
    stepsCompleted: job.stepsCompleted || 0,
    stepsTotal: job.stepsTotal || 1,
    completedSteps: job.completedSteps || [],
  };

  return {
    jobId: job.id,
    type: job.type,
    status: job.status,
    stage,
    progress,
    result: job.result,
    error: job.error,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

/**
 * Simple sleep utility.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Creates a timeout promise that rejects after the given duration.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, timeoutError = new Error('TIMEOUT')): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(timeoutError), ms)),
  ]);
}

/**
 * Runs multiple promises with controlled concurrency.
 */
export async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  processor: (item: T, index: number) => Promise<void>
): Promise<void> {
  const queue = [...items];
  const running: Promise<void>[] = [];

  async function processNext(): Promise<void> {
    if (queue.length === 0) return;
    
    const item = queue.shift()!;
    const index = items.indexOf(item);
    
    const promise = processor(item, index);
    running.push(promise);

    try {
      await promise;
    } finally {
      running.splice(running.indexOf(promise), 1);
      await processNext();
    }
  }

  // Start initial batch
  const initialBatch = Math.min(concurrency, queue.length);
  await Promise.all(
    Array.from({ length: initialBatch }, () => processNext())
  );

  // Wait for all to complete
  await Promise.all(running);
}

/**
 * Batch processor for handling items in chunks with progress reporting.
 */
export async function processInBatches<T, R>(
  items: T[],
  batchSize: number,
  processor: (batch: T[], batchIndex: number) => Promise<R[]>,
  onProgress?: (completed: number, total: number) => void
): Promise<R[]> {
  const results: R[] = [];
  let completed = 0;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchIndex = Math.floor(i / batchSize);
    
    const batchResults = await processor(batch, batchIndex);
    results.push(...batchResults);
    
    completed += batch.length;
    if (onProgress) {
      onProgress(completed, items.length);
    }
  }

  return results;
}

/**
 * Heartbeat utility for long-running jobs to update progress and signal liveness.
 */
export async function sendHeartbeat(jobId: string, progress: {
  currentStep?: string;
  stepsCompleted?: number;
  stepsTotal?: number;
}): Promise<void> {
  await db
    .update(jobs)
    .set({
      ...progress,
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, jobId));
}

/**
 * Validates that a job payload has all required fields for its type.
 */
export function validateJobPayload(type: JobType, payload: AnyJobPayload): { valid: boolean; missing?: string[] } {
  const required: Record<JobType, string[]> = {
    'generation-single': ['projectId', 'workspaceId', 'userId', 'artifactType'],
    'generation-pipeline': ['projectId', 'workspaceId', 'userId', 'ideaText'],
    'verification': ['projectId', 'workspaceId', 'userId', 'specVersionId', 'repoConnectionId'],
  };

  const missing = required[type].filter(field => !(payload as any)[field]);
  
  return {
    valid: missing.length === 0,
    missing: missing.length > 0 ? missing : undefined,
  };
}

/**
 * Calculates exponential backoff delay with jitter.
 */
export function calculateBackoff(attempt: number, baseMs = 1000, maxMs = 60000): number {
  const delay = Math.min(baseMs * Math.pow(2, attempt - 1), maxMs);
  const jitter = delay * 0.25; // ±25%
  return delay + Math.random() * jitter * 2 - jitter;
}

/**
 * Job result builder for consistent result formatting.
 */
export class JobResultBuilder {
  private result: Record<string, any> = {};

  setSpecVersion(id: string, versionNumber: number): this {
    this.result.specVersionId = id;
    this.result.versionNumber = versionNumber;
    return this;
  }

  addArtifact(type: string, data: any): this {
    if (!this.result.artifactsGenerated) this.result.artifactsGenerated = [];
    this.result.artifactsGenerated.push({ type, ...data });
    return this;
  }

  setUsage(inputTokens: number, outputTokens: number, cost: number): this {
    this.result.usage = { inputTokens, outputTokens, cost };
    return this;
  }

  setDuration(ms: number): this {
    this.result.durationMs = ms;
    return this;
  }

  setModel(model: string): this {
    this.result.model = model;
    return this;
  }

  build(): Record<string, any> {
    return this.result;
  }
}

/**
 * Job error builder for consistent error formatting.
 */
export class JobErrorBuilder {
  private error: Record<string, any> = {};

  setCode(code: string): this {
    this.error.code = code;
    return this;
  }

  setMessage(message: string): this {
    this.error.message = message;
    return this;
  }

  setDetails(details: Record<string, any>): this {
    this.error.details = details;
    return this;
  }

  setRetryable(retryable: boolean): this {
    this.error.isRetryable = retryable;
    return this;
  }

  setFailedStage(stage: string): this {
    this.error.failedStage = stage;
    return this;
  }

  build(): JobError {
    return this.error as any;
  }
}