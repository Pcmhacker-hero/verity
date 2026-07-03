/**
 * Worker base class — Doc 11 §4, Doc 18 §6.
 *
 * Abstract base for all job processors. Handles:
 * - Job lifecycle (start, progress, complete, fail)
 * - Progress reporting
 * - Retry with exponential backoff
 * - Cancellation checking
 * - Event emission
 */

import { EventEmitter } from 'events';
import { db } from '@verity/database';
import { jobs } from '@verity/database/schema';
import { eq, and, sql } from 'drizzle-orm';
import type {
  JobStatus,
  JobType,
  GenerationStage,
  VerificationStage,
  JobProgress,
  JobResult,
  JobError,
  AnyJobPayload,
  QueueEvent,
  QueueEventType,
} from '@verity/shared/types';
import { logger, runWithContext, reportError, withSpan } from '@verity/shared/observability';

export interface WorkerOptions {
  workerId: string;
  queueName: JobType;
  concurrency: number;
  pollIntervalMs?: number;
}

export abstract class BaseWorker extends EventEmitter {
  protected readonly workerId: string;
  protected readonly queueName: JobType;
  protected readonly concurrency: number;
  protected readonly pollIntervalMs: number;
  protected isRunning = false;
  protected activeJobs = new Map<string, AbortController>();

  constructor(options: WorkerOptions) {
    super();
    this.workerId = options.workerId;
    this.queueName = options.queueName;
    this.concurrency = options.concurrency;
    this.pollIntervalMs = options.pollIntervalMs ?? 2000;
  }

  abstract processJob(job: any): Promise<JobResult>;

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.emit('worker_started', { workerId: this.workerId, queueName: this.queueName });
    this.pollLoop();
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    const timeout = 30000;
    const start = Date.now();
    while (this.activeJobs.size > 0 && Date.now() - start < timeout) {
      await this.sleep(100);
    }
    for (const [, controller] of this.activeJobs) {
      controller.abort();
    }
    this.activeJobs.clear();
    this.emit('worker_stopped', { workerId: this.workerId });
  }

  private async pollLoop(): Promise<void> {
    while (this.isRunning) {
      if (this.activeJobs.size >= this.concurrency) {
        await this.sleep(this.pollIntervalMs);
        continue;
      }

      const job = await this.claimNextJob();
      if (!job) {
        await this.sleep(this.pollIntervalMs);
        continue;
      }

      this.executeJob(job);
    }
  }

  private async claimNextJob(): Promise<any | null> {
    const result = await db.transaction(async (tx) => {
      const jobResult = await tx
        .select()
        .from(jobs)
        .where(
          and(
            eq(jobs.type, this.queueName),
            eq(jobs.status, 'queued'),
            sql`${jobs.nextRetryAt} IS NULL OR ${jobs.nextRetryAt} <= NOW()`
          )
        )
        .orderBy(jobs.createdAt)
        .limit(1)
        .for('update', { skipLocked: true });

      const job = jobResult[0];
      if (!job) return null;

      await tx
        .update(jobs)
        .set({
          status: 'running',
          startedAt: new Date(),
          updatedAt: new Date(),
          attempt: job.attempt + 1,
          lastAttemptAt: new Date(),
        })
        .where(eq(jobs.id, job.id));

      return { ...job, status: 'running' as JobStatus, attempt: job.attempt + 1 };
    });

    return result;
  }

  private async executeJob(job: any): Promise<void> {
    const controller = new AbortController();
    this.activeJobs.set(job.id, controller);

    try {
      await runWithContext(
        { 
          requestId: job.id, // Use job ID as the correlation ID for the worker's thread
          jobId: job.id, 
          projectId: job.projectId,
          workspaceId: job.workspaceId
        },
        async () => {
          await withSpan('queue_job_execution', { queue: this.queueName, jobId: job.id, attempt: job.attempt }, async () => {
            this.emitJobEvent('job_started', job);
            logger.info('job_started', { attempt: job.attempt, queueName: this.queueName });

            await this.updateJobProgress(job.id, {
              currentStep: 'Starting...',
              stepsCompleted: 0,
              stepsTotal: job.stepsTotal ?? 1,
              completedSteps: [],
            });

            const result = await this.processJob(job);

            if (controller.signal.aborted) {
              await this.handleCancellation(job);
              logger.warn('job_cancelled', { reason: 'Aborted during processing' });
              return;
            }

            await this.completeJob(job, result);
            this.emitJobEvent('job_completed', job, { result });
            logger.info('job_completed', { result });
          });
        }
      );
    } catch (error) {
      await runWithContext({ requestId: job.id, jobId: job.id, projectId: job.projectId }, async () => {
        if (controller.signal.aborted) {
          await this.handleCancellation(job);
          logger.warn('job_cancelled_during_error', { reason: 'Aborted' });
          return;
        }
        await this.handleJobFailure(job, error);
        
        reportError(error, {
          service: 'verity-worker',
          tags: { queue: this.queueName, attempt: job.attempt },
          severity: 'error'
        });
        
        logger.error('job_failed', { error });
      });
    } finally {
      this.activeJobs.delete(job.id);
    }
  }

  protected async updateJobProgress(jobId: string, progress: Partial<JobProgress>): Promise<void> {
    await db
      .update(jobs)
      .set({
        ...progress,
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, jobId));

    this.emitJobEvent('job_progress', { id: jobId } as any, { progress });
  }

  protected async updateJobStage(jobId: string, stage: GenerationStage | VerificationStage): Promise<void> {
    const isGeneration = this.queueName.startsWith('generation');
    await db
      .update(jobs)
      .set({
        [isGeneration ? 'generationStage' : 'verificationStage']: stage,
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, jobId));
  }

  protected async completeJob(job: any, result: JobResult): Promise<void> {
    await db
      .update(jobs)
      .set({
        status: 'complete',
        result,
        currentStep: 'Completed',
        stepsCompleted: job.stepsTotal ?? 1,
        stepsTotal: job.stepsTotal ?? 1,
        completedSteps: job.completedSteps ?? [],
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, job.id));
  }

  protected async handleJobFailure(job: any, error: unknown): Promise<void> {
    const jobError = this.normalizeError(error);
    const shouldRetry = job.attempt < job.maxAttempts && jobError.isRetryable;

    if (shouldRetry) {
      const delayMs = this.calculateBackoff(job.attempt);
      const nextRetryAt = new Date(Date.now() + delayMs);

      await db
        .update(jobs)
        .set({
          status: 'queued',
          nextRetryAt,
          error: jobError,
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, job.id));

      this.emitJobEvent('job_retry', job, { attempt: job.attempt, nextRetryAt, error: jobError });
    } else {
      await db
        .update(jobs)
        .set({
          status: 'failed',
          error: jobError,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, job.id));

      this.emitJobEvent('job_failed', job, { error: jobError });

      if (job.attempt >= job.maxAttempts) {
        await this.moveToDeadLetter(job, jobError);
      }
    }
  }

  protected async handleCancellation(job: any): Promise<void> {
    await db
      .update(jobs)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        cancellationReason: 'Worker shutdown or explicit cancellation',
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, job.id));

    this.emitJobEvent('job_cancelled', job);
  }

  protected async moveToDeadLetter(job: any, error: JobError): Promise<void> {
    await db
      .update(jobs)
      .set({
        deadLetterAt: new Date(),
        deadLetterReason: error.message,
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, job.id));

    this.emitJobEvent('job_dead_letter', job, { error });
  }

  protected calculateBackoff(attempt: number): number {
    const baseDelay = 1000;
    const maxDelay = 60000;
    const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
    return delay + Math.random() * delay * 0.5 - delay * 0.25;
  }

  protected normalizeError(error: unknown): JobError {
    if (error instanceof Error) {
      return {
        code: 'JOB_EXECUTION_ERROR',
        message: error.message,
        isRetryable: this.isRetryableError(error),
      };
    }
    return {
      code: 'UNKNOWN_ERROR',
      message: String(error),
      isRetryable: false,
    };
  }

  protected isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return (
      message.includes('timeout') ||
      message.includes('rate limit') ||
      message.includes('econnreset') ||
      message.includes('socket hang up') ||
      message.includes('503') ||
      message.includes('504') ||
      message.includes('429')
    );
  }

  private emitJobEvent(type: QueueEventType, job: Partial<any>, extra?: Record<string, unknown>): void {
    const event: QueueEvent = {
      type,
      jobId: job.id!,
      projectId: job.projectId!,
      workspaceId: job.workspaceId!,
      timestamp: new Date().toISOString(),
      payload: extra,
    };
    this.emit('job_event', event);
    this.emit(type, event);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}