/**
 * Queue Monitoring & Observability — Doc 11 §8, Doc 18 §20.
 *
 * Utilities for monitoring queue health, performance, and debugging.
 * Integrates with structured logging for cost visibility (Doc 5 §9).
 */

import { db } from '@verity/database';
import { jobs } from '@verity/database/schema';
import { eq, and, desc, count, sql, gte, lt } from 'drizzle-orm';
import type { JobType, JobStatus, QueueMetrics } from '@verity/shared/types';
import { logger } from '@verity/shared/observability';

export interface QueueHealthCheck {
  queueName: JobType;
  status: 'healthy' | 'degraded' | 'unhealthy';
  waiting: number;
  active: number;
  oldestWaitingJobAgeMs: number;
  avgProcessingTimeMs: number;
  failureRate: number; // 0-1
  throughputPerMinute: number;
  issues: string[];
}

export interface JobTimelineEvent {
  timestamp: string;
  event: string;
  details?: Record<string, any>;
}

export interface JobDebugInfo {
  jobId: string;
  timeline: JobTimelineEvent[];
  attempts: number;
  totalDurationMs: number;
  timeInQueueMs: number;
  timeProcessingMs: number;
}

/**
 * Performs a health check on a specific queue.
 */
export async function checkQueueHealth(queueName: JobType): Promise<QueueHealthCheck> {
  const now = Date.now();
  const hourAgo = new Date(now - 60 * 60 * 1000);
  const fiveMinutesAgo = new Date(now - 5 * 60 * 1000);

  const [waiting, active, completed, failed, cancelled, oldestWaiting] = await Promise.all([
    db.select({ count: count() }).from(jobs).where(and(eq(jobs.type, queueName), eq(jobs.status, 'queued'))),
    db.select({ count: count() }).from(jobs).where(and(eq(jobs.type, queueName), eq(jobs.status, 'running'))),
    db.select({ count: count() }).from(jobs).where(and(eq(jobs.type, queueName), eq(jobs.status, 'complete'), gte(jobs.completedAt, hourAgo))),
    db.select({ count: count() }).from(jobs).where(and(eq(jobs.type, queueName), eq(jobs.status, 'failed'), gte(jobs.createdAt, hourAgo))),
    db.select({ count: count() }).from(jobs).where(and(eq(jobs.type, queueName), eq(jobs.status, 'cancelled'), gte(jobs.createdAt, hourAgo))),
    db.select({ createdAt: jobs.createdAt }).from(jobs).where(and(eq(jobs.type, queueName), eq(jobs.status, 'queued'))).orderBy(jobs.createdAt).limit(1),
  ]);

  const waitingCount = waiting[0]?.count ?? 0;
  const activeCount = active[0]?.count ?? 0;
  const completedCount = completed[0]?.count ?? 0;
  const failedCount = failed[0]?.count ?? 0;
  const totalAttempted = completedCount + failedCount;

  // Oldest waiting job age
  const oldestWaitingJobAgeMs = oldestWaiting.length > 0 && oldestWaiting[0]
    ? now - new Date(oldestWaiting[0].createdAt).getTime()
    : 0;

  // Average processing time
  const [avgTime] = await db
    .select({
      avgMs: sql<number>`AVG(EXTRACT(EPOCH FROM (${jobs.completedAt} - ${jobs.startedAt})) * 1000)`,
    })
    .from(jobs)
    .where(and(eq(jobs.type, queueName), eq(jobs.status, 'complete'), gte(jobs.completedAt, hourAgo)));

  const avgProcessingTimeMs = Math.round(avgTime?.avgMs ?? 0);
  const failureRate = totalAttempted > 0 ? failedCount / totalAttempted : 0;
  const throughputPerMinute = completedCount / 60;

  // Determine health status
  const issues: string[] = [];
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  if (waitingCount > 100) {
    issues.push(`High queue backlog: ${waitingCount} waiting jobs`);
    status = 'degraded';
  }
  if (oldestWaitingJobAgeMs > 5 * 60 * 1000) {
    issues.push(`Oldest job waiting ${Math.round(oldestWaitingJobAgeMs / 1000)}s`);
    status = 'degraded';
  }
  if (failureRate > 0.1) {
    issues.push(`High failure rate: ${Math.round(failureRate * 100)}%`);
    status = 'unhealthy';
  }
  if (avgProcessingTimeMs > 120000) {
    issues.push(`Slow processing: ${Math.round(avgProcessingTimeMs / 1000)}s avg`);
    status = 'degraded';
  }
  if (activeCount === 0 && waitingCount > 0) {
    issues.push('No active workers but jobs waiting');
    status = 'unhealthy';
  }

  return {
    queueName,
    status,
    waiting: waitingCount,
    active: activeCount,
    oldestWaitingJobAgeMs,
    avgProcessingTimeMs,
    failureRate,
    throughputPerMinute,
    issues,
  };
}

/**
 * Performs health checks on all queues.
 */
export async function checkAllQueuesHealth(): Promise<QueueHealthCheck[]> {
  const queueNames: JobType[] = ['generation-single', 'generation-pipeline', 'verification'];
  return Promise.all(queueNames.map(checkQueueHealth));
}

/**
 * Gets a debug timeline for a specific job.
 */
export async function getJobDebugInfo(jobId: string): Promise<JobDebugInfo | null> {
  const result = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  const job = result[0];
  if (!job) return null;

  const now = Date.now();
  const createdAt = new Date(job.createdAt).getTime();
  const startedAt = job.startedAt ? new Date(job.startedAt).getTime() : null;
  const completedAt = job.completedAt ? new Date(job.completedAt).getTime() : null;

  const timeline: JobTimelineEvent[] = [
    { timestamp: job.createdAt.toISOString(), event: 'job_created', details: { type: job.type, status: 'queued' } },
  ];

  if (startedAt) {
    timeline.push({ timestamp: job.startedAt!.toISOString(), event: 'job_started', details: { attempt: job.attempt } });
  }

  if (job.lastAttemptAt) {
    timeline.push({ timestamp: job.lastAttemptAt.toISOString(), event: 'job_retry_attempt', details: { attempt: job.attempt } });
  }

  if (completedAt) {
    timeline.push({ timestamp: job.completedAt!.toISOString(), event: job.status === 'complete' ? 'job_completed' : 'job_failed', details: { status: job.status } });
  }

  if (job.cancelledAt) {
    timeline.push({ timestamp: job.cancelledAt.toISOString(), event: 'job_cancelled', details: { reason: job.cancellationReason } });
  }

  if (job.deadLetterAt) {
    timeline.push({ timestamp: job.deadLetterAt.toISOString(), event: 'job_dead_lettered', details: { reason: job.deadLetterReason } });
  }

  return {
    jobId: job.id,
    timeline,
    attempts: job.attempt,
    totalDurationMs: completedAt ? completedAt - createdAt : now - createdAt,
    timeInQueueMs: startedAt ? startedAt - createdAt : now - createdAt,
    timeProcessingMs: startedAt && completedAt ? completedAt - startedAt : (startedAt ? now - startedAt : 0),
  };
}

/**
 * Gets aggregated queue metrics for dashboarding.
 */
export async function getQueueDashboardMetrics(): Promise<{
  totalWaiting: number;
  totalActive: number;
  totalCompletedLastHour: number;
  totalFailedLastHour: number;
  avgProcessingTimeMs: number;
  queues: QueueMetrics[];
}> {
  const queueNames: JobType[] = ['generation-single', 'generation-pipeline', 'verification'];
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const queues = await Promise.all(queueNames.map(async (q) => {
    const [waiting, active, completed, failed] = await Promise.all([
      db.select({ count: count() }).from(jobs).where(and(eq(jobs.type, q), eq(jobs.status, 'queued'))),
      db.select({ count: count() }).from(jobs).where(and(eq(jobs.type, q), eq(jobs.status, 'running'))),
      db.select({ count: count() }).from(jobs).where(and(eq(jobs.type, q), eq(jobs.status, 'complete'), gte(jobs.completedAt, hourAgo))),
      db.select({ count: count() }).from(jobs).where(and(eq(jobs.type, q), eq(jobs.status, 'failed'), gte(jobs.createdAt, hourAgo))),
    ]);

    const [avgTime] = await db
      .select({ avgMs: sql<number>`AVG(EXTRACT(EPOCH FROM (${jobs.completedAt} - ${jobs.startedAt})) * 1000)` })
      .from(jobs)
      .where(and(eq(jobs.type, q), eq(jobs.status, 'complete'), gte(jobs.completedAt, hourAgo)));

    return {
      queueName: q,
      waiting: waiting[0]?.count ?? 0,
      active: active[0]?.count ?? 0,
      completed: completed[0]?.count ?? 0,
      failed: failed[0]?.count ?? 0,
      cancelled: 0,
      deadLetter: 0,
      avgProcessingTimeMs: Math.round(avgTime?.avgMs ?? 0),
      throughputPerMinute: (completed[0]?.count ?? 0) / 60,
    };
  }));

  return {
    totalWaiting: queues.reduce((sum, q) => sum + q.waiting, 0),
    totalActive: queues.reduce((sum, q) => sum + q.active, 0),
    totalCompletedLastHour: queues.reduce((sum, q) => sum + q.completed, 0),
    totalFailedLastHour: queues.reduce((sum, q) => sum + q.failed, 0),
    avgProcessingTimeMs: Math.round(queues.reduce((sum, q) => sum + q.avgProcessingTimeMs, 0) / queues.length),
    queues,
  };
}

/**
 * Finds stuck jobs that have been running too long.
 */
export async function findStuckJobs(maxProcessingMs = 300000): Promise<any[]> {
  const cutoff = new Date(Date.now() - maxProcessingMs);
  
  return db
    .select()
    .from(jobs)
    .where(and(eq(jobs.status, 'running'), lt(jobs.startedAt, cutoff)))
    .orderBy(jobs.startedAt);
}

/**
 * Finds jobs that have exceeded their retry budget and are in dead letter.
 */
export async function findDeadLetterJobs(olderThanDays = 7): Promise<any[]> {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  
  return db
    .select()
    .from(jobs)
    .where(and(sql`${jobs.deadLetterAt} IS NOT NULL`, lt(jobs.deadLetterAt, cutoff)))
    .orderBy(desc(jobs.deadLetterAt));
}

/**
 * Logs structured job metrics for observability (Doc 11 §8, Doc 5 §9).
 * Call this periodically or on job completion.
 */
export function logJobMetrics(job: {
  id: string;
  type: JobType;
  status: JobStatus;
  durationMs: number;
  attempt: number;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCost?: number;
}): void {
  logger.info('job_metrics', {
    event: 'job_metrics',
    jobId: job.id,
    jobType: job.type,
    status: job.status,
    durationMs: job.durationMs,
    attempt: job.attempt,
    inputTokens: job.inputTokens ?? 0,
    outputTokens: job.outputTokens ?? 0,
    estimatedCost: job.estimatedCost ?? 0,
  });
}