/**
 * Worker Registry — Doc 11 §4, Doc 18 §6.
 *
 * Tracks worker registrations, heartbeats, and health status.
 * Enables monitoring and graceful scaling.
 */

import { EventEmitter } from 'events';
import { db } from '@verity/database';
import { jobs } from '@verity/database/schema';
import { eq, and, sql, count, sum } from 'drizzle-orm';
import type { WorkerRegistration, JobType, QueueMetrics } from '@verity/shared/types';

export class WorkerRegistry extends EventEmitter {
  private workers = new Map<string, WorkerRegistration>();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly heartbeatTtlMs = 30000; // 30 seconds

  register(worker: WorkerRegistration): void {
    this.workers.set(worker.workerId, worker);
    this.emit('worker_registered', worker);
  }

  unregister(workerId: string): void {
    const worker = this.workers.get(workerId);
    if (worker) {
      this.workers.delete(workerId);
      this.emit('worker_unregistered', worker);
    }
  }

  heartbeat(workerId: string): boolean {
    const worker = this.workers.get(workerId);
    if (!worker) return false;
    worker.lastHeartbeat = new Date().toISOString();
    worker.status = 'healthy';
    return true;
  }

  getWorker(workerId: string): WorkerRegistration | undefined {
    return this.workers.get(workerId);
  }

  getWorkersByQueue(queueName: JobType): WorkerRegistration[] {
    return Array.from(this.workers.values()).filter((w) => w.queues.includes(queueName));
  }

  getAllWorkers(): WorkerRegistration[] {
    return Array.from(this.workers.values());
  }

  getHealthyWorkers(): WorkerRegistration[] {
    return Array.from(this.workers.values()).filter((w) => w.status === 'healthy');
  }

  startHeartbeatMonitor(): void {
    if (this.heartbeatInterval) return;
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      for (const [workerId, worker] of this.workers) {
        const lastHeartbeat = new Date(worker.lastHeartbeat).getTime();
        if (now - lastHeartbeat > this.heartbeatTtlMs && worker.status === 'healthy') {
          worker.status = 'unhealthy';
          this.emit('worker_unhealthy', worker);
        }
      }
    }, 10000);
  }

  stopHeartbeatMonitor(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  async getQueueMetrics(queueName: JobType): Promise<QueueMetrics> {
    // Get counts by status
    const counts = await db
      .select({
        status: jobs.status,
        count: count(),
      })
      .from(jobs)
      .where(eq(jobs.type, queueName))
      .groupBy(jobs.status);

    const metrics: Record<string, number> = {};
    for (const row of counts) {
      metrics[row.status] = row.count;
    }

    // Get average processing time for completed jobs in last hour
    const avgTimeResult = await db
      .select({
        avgMs: sql<number>`AVG(EXTRACT(EPOCH FROM (${jobs.completedAt} - ${jobs.startedAt})) * 1000)`,
      })
      .from(jobs)
      .where(
        and(
          eq(jobs.type, queueName),
          eq(jobs.status, 'complete'),
          sql`${jobs.completedAt} > NOW() - INTERVAL '1 hour'`
        )
      );

    // Get throughput (completed per minute) for last hour
    const throughputResult = await db
      .select({
        count: count(),
      })
      .from(jobs)
      .where(
        and(
          eq(jobs.type, queueName),
          eq(jobs.status, 'complete'),
          sql`${jobs.completedAt} > NOW() - INTERVAL '1 hour'`
        )
      );

    return {
      queueName,
      waiting: metrics.queued ?? 0,
      active: metrics.running ?? 0,
      completed: metrics.complete ?? 0,
      failed: metrics.failed ?? 0,
      cancelled: metrics.cancelled ?? 0,
      deadLetter: metrics.dead_letter ?? 0,
      avgProcessingTimeMs: Math.round(avgTimeResult[0]?.avgMs ?? 0),
      throughputPerMinute: Math.round((throughputResult[0]?.count ?? 0) / 60),
    };
  }

  async getAllQueueMetrics(): Promise<QueueMetrics[]> {
    const queueNames: JobType[] = ['generation-single', 'generation-pipeline', 'verification'];
    return Promise.all(queueNames.map((q) => this.getQueueMetrics(q)));
  }
}

export const workerRegistry = new WorkerRegistry();