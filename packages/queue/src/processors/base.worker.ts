import { EventEmitter } from 'events';
import { db } from '@verity/database';
import { jobs } from '@verity/database/schema';
import { eq } from 'drizzle-orm';
import { VerityError } from '@verity/shared/errors';
import type { JobStatus } from '@verity/shared/types';

export abstract class BaseWorker extends EventEmitter {
  protected isProcessing = false;
  protected currentJobId: string | null = null;

  protected async checkCancellation(jobId: string): Promise<void> {
    const job = await this.loadJob(jobId);
    if (job?.status === 'cancelled') {
      throw new VerityError('JOB_CANCELLED', job.cancellationReason || 'Job cancelled', 499);
    }
  }

  protected async loadJob(jobId: string) {
    const result = await db
      .select()
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .limit(1);
    return result[0];
  }

  protected async updateJobStatus(jobId: string, status: JobStatus, extra: Record<string, any> = {}): Promise<void> {
    await db
      .update(jobs)
      .set({
        status,
        updatedAt: new Date(),
        ...extra,
      })
      .where(eq(jobs.id, jobId));
  }

  protected async updateProgress(jobId: string, progress: any): Promise<void> {
    await db
      .update(jobs)
      .set({
        ...progress,
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, jobId));

    this.emit('progress', { jobId, ...progress });
  }

  protected async updateJobResult(jobId: string, result: Record<string, any>): Promise<void> {
    await db
      .update(jobs)
      .set({
        result,
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, jobId));
  }

  protected async handleFailure(jobId: string, error: Error): Promise<void> {
    const job = await this.loadJob(jobId);
    if (!job) return;

    const attempt = job.attempt + 1;
    const maxAttempts = job.maxAttempts;
    
    // Extract error code if available
    const errorCode = 'code' in error ? (error as any).code : 'JOB_FAILED';

    if (attempt <= maxAttempts) {
      // Schedule retry with exponential backoff
      const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 60000);
      
      await db
        .update(jobs)
        .set({
          status: 'queued',
          attempt,
          lastAttemptAt: new Date(),
          nextRetryAt: new Date(Date.now() + delayMs),
          error: {
            message: error.message,
            code: errorCode,
            attempt,
          },
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, jobId));

      this.emit('job_retry_scheduled', { jobId, attempt, delayMs });
    } else {
      // Max retries exceeded
      await db
        .update(jobs)
        .set({
          status: 'failed',
          deadLetterAt: new Date(),
          deadLetterReason: error.message,
          error: {
            message: error.message,
            code: errorCode,
            attempt,
          },
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, jobId));

      this.emit('job_failed', { jobId, error: error.message, attempt });
    }
  }

  abstract process(jobId: string): Promise<void>;
  
  async cancel(jobId: string, reason = 'Cancelled by user'): Promise<void> {
    if (this.currentJobId === jobId) {
      throw new VerityError('JOB_CANCELLED', reason, 499);
    }
    await this.updateJobStatus(jobId, 'cancelled', {
      cancelledAt: new Date().toISOString(),
      cancellationReason: reason,
    });
  }
}
