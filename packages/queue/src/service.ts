/**
 * Queue Service — Doc 11 §4, Doc 14 §4.2, Doc 18 §6.
 *
 * High-level job queue operations:
 * - Job creation (enqueue with idempotency)
 * - Job polling (status, progress, result)
 * - Job cancellation
 * - Queue metrics and monitoring
 * - Worker lifecycle management
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { db } from '@verity/database';
import { jobs, projects } from '@verity/database/schema';
import { eq, and, desc, count } from 'drizzle-orm';
import { createQueueClient, QUEUE_NAMES, QUEUE_CONFIG } from './client.js';
import type { QueueClient } from './client.js';
import type {
  JobType,
  JobStatus,
  CreateJobInput,
  JobStatusResponse,
  AnyJobPayload,
} from '@verity/shared/types';

let queueServiceInstance: QueueService | null = null;

export class QueueService extends EventEmitter {
  private client: QueueClient;
  private isInitialized = false;

  constructor(client: QueueClient) {
    super();
    this.client = client;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Register queue processors with pg-boss
    await this.registerProcessors();

    this.isInitialized = true;
    this.emit('initialized');
  }

  private async registerProcessors(): Promise<void> {
    // Processors register themselves with pg-boss in the worker process.
    // The QueueService (used by the web app) is a pure enqueue/query interface.
    // No-op here — worker startup calls processor.start(boss) directly.
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Job Creation (Enqueue)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Enqueues a repository sync job via pg-boss.
   * Sync jobs use the dedicated repoConnections status column and do not
   * go through the generic jobs table (they have no workspaceId/userId).
   */
  async enqueueSyncJob(data: { projectId: string; githubRepoFullName: string; accessToken: string }): Promise<void> {
    await this.client.send(QUEUE_NAMES.SYNC, data, {
      priority: QUEUE_CONFIG[QUEUE_NAMES.SYNC].priority,
      retryLimit: QUEUE_CONFIG[QUEUE_NAMES.SYNC].retryLimit ?? 2,
      expireInSeconds: QUEUE_CONFIG[QUEUE_NAMES.SYNC].expireInMinutes * 60,
    });
  }

  async createJob(input: CreateJobInput): Promise<JobStatusResponse> {
    const { type, payload, idempotencyKey, maxAttempts = 3 } = input;

    // Validate that the workspace owns the project
    const projectCheck = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, payload.projectId), eq(projects.workspaceId, payload.workspaceId)))
      .limit(1);

    if (projectCheck.length === 0) {
      throw new Error('UNAUTHORIZED_OR_NOT_FOUND');
    }

    // Check for existing job with same idempotency key
    if (idempotencyKey) {
      const existing = await db
        .select()
        .from(jobs)
        .where(eq(jobs.idempotencyKey, idempotencyKey))
        .limit(1);
      
      if (existing.length > 0) {
        return this.mapJobToResponse(existing[0]);
      }
    }

    // Create job record
    const jobId = randomUUID();
    const queueName = type;

    await db.insert(jobs).values({
      id: jobId,
      projectId: payload.projectId,
      workspaceId: payload.workspaceId,
      userId: payload.userId,
      type: queueName,
      status: 'queued',
      payload: payload as any,
      idempotencyKey,
      maxAttempts,
      stepsTotal: type === 'generation-pipeline' ? 7 : (type === 'verification' ? 2 : 1),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Enqueue in pg-boss
    await this.client.send(queueName, { jobId }, {
      priority: QUEUE_CONFIG[queueName].priority,
      retryLimit: maxAttempts - 1,
      retryDelay: QUEUE_CONFIG[queueName].retryDelay * 1000, // Convert to ms
      expireInSeconds: QUEUE_CONFIG[queueName].expireInMinutes * 60,
    });

    // Return job status
    const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
    return this.mapJobToResponse(job);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Job Polling
  // ──────────────────────────────────────────────────────────────────────────

  async getJobStatus(jobId: string, workspaceId: string): Promise<JobStatusResponse> {
    const [job] = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, jobId), eq(jobs.workspaceId, workspaceId)))
      .limit(1);

    if (!job) {
      throw new Error('JOB_NOT_FOUND');
    }

    return this.mapJobToResponse(job);
  }

  async getJobsByProject(projectId: string, workspaceId: string, status?: JobStatus): Promise<JobStatusResponse[]> {
    const conditions = [eq(jobs.projectId, projectId), eq(jobs.workspaceId, workspaceId)];
    if (status) conditions.push(eq(jobs.status, status));

    const jobList = await db
      .select()
      .from(jobs)
      .where(and(...conditions))
      .orderBy(desc(jobs.createdAt))
      .limit(50);

    return jobList.map(this.mapJobToResponse);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Job Cancellation
  // ──────────────────────────────────────────────────────────────────────────

  async cancelJob(jobId: string, workspaceId: string, reason = 'Cancelled by user'): Promise<void> {
    const [job] = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, jobId), eq(jobs.workspaceId, workspaceId)))
      .limit(1);

    if (!job) {
      throw new Error('JOB_NOT_FOUND');
    }

    if (job.status === 'complete' || job.status === 'failed' || job.status === 'cancelled') {
      throw new Error('JOB_ALREADY_TERMINAL');
    }

    // Try to cancel via pg-boss (will stop if not yet started)
    try {
      const queueName = job.type;
      await this.client.cancel(queueName, jobId);
    } catch {
      // pg-boss cancel may fail if job not found in queue
    }

    // Update local record — the running processor observes the cancelled
    // status and aborts at the next checkpoint.
    await db
      .update(jobs)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        cancellationReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, jobId));

    this.emit('job_cancelled', { jobId, reason });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Queue Metrics & Monitoring
  // ──────────────────────────────────────────────────────────────────────────

  async getQueueMetrics(queueName: JobType): Promise<any> {
    // Return basic metrics from database
    const [waiting, active, completed, failed] = await Promise.all([
      db.select({ count: count() }).from(jobs).where(and(eq(jobs.type, queueName), eq(jobs.status, 'queued'))),
      db.select({ count: count() }).from(jobs).where(and(eq(jobs.type, queueName), eq(jobs.status, 'running'))),
      db.select({ count: count() }).from(jobs).where(and(eq(jobs.type, queueName), eq(jobs.status, 'complete'))),
      db.select({ count: count() }).from(jobs).where(and(eq(jobs.type, queueName), eq(jobs.status, 'failed'))),
    ]);

    return {
      queueName,
      waiting: waiting[0]?.count ?? 0,
      active: active[0]?.count ?? 0,
      completed: completed[0]?.count ?? 0,
      failed: failed[0]?.count ?? 0,
      cancelled: 0,
      deadLetter: 0,
      avgProcessingTimeMs: 0,
      throughputPerMinute: 0,
    };
  }

  async getAllQueueMetrics(): Promise<any[]> {
    const queueNames: JobType[] = ['generation-single', 'generation-pipeline', 'verification'];
    return Promise.all(queueNames.map((q) => this.getQueueMetrics(q)));
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Shutdown
  // ──────────────────────────────────────────────────────────────────────────

  async shutdown(): Promise<void> {
    await this.client.stop();
    this.isInitialized = false;
    this.emit('shutdown');
  }

  private mapJobToResponse(job: any): JobStatusResponse {
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
}

// ──────────────────────────────────────────────────────────────────────────────
// Module-level initialization (for app startup)
// ──────────────────────────────────────────────────────────────────────────────

export async function initializeQueueService(connectionString: string): Promise<QueueService> {
  if (queueServiceInstance) return queueServiceInstance;

  const client = await createQueueClient(connectionString);
  queueServiceInstance = new QueueService(client);
  await queueServiceInstance.initialize();
  
  return queueServiceInstance;
}

export function getQueueService(): QueueService | null {
  return queueServiceInstance;
}

export async function shutdownQueueService(): Promise<void> {
  if (queueServiceInstance) {
    await queueServiceInstance.shutdown();
    queueServiceInstance = null;
  }
}