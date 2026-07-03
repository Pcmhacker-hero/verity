export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@verity/database';
import { sql } from 'drizzle-orm';
import { checkAllQueuesHealth } from '@verity/queue';
import { logger } from '@verity/shared/observability';

export async function GET() {
  const startTime = Date.now();
  let dbStatus: 'up' | 'down' = 'up';
  let queueStatus: 'up' | 'degraded' | 'down' = 'up';
  let dbLatency = 0;
  
  const errors: string[] = [];

  // 1. Check Database
  try {
    const dbStart = Date.now();
    await db.execute(sql`SELECT 1`);
    dbLatency = Date.now() - dbStart;
  } catch (error) {
    dbStatus = 'down';
    errors.push(`Database connection failed: ${(error as Error).message}`);
    logger.error('Database health check failed', { error: (error as Error).message });
  }

  // 2. Check Queues
  let queues: Awaited<ReturnType<typeof checkAllQueuesHealth>> = [];
  try {
    queues = await checkAllQueuesHealth();
    
    // Determine overall queue status based on individual queues
    for (const queue of queues) {
      if (queue.status === 'unhealthy') {
        queueStatus = 'down';
        errors.push(`Queue ${queue.queueName} is unhealthy`);
      } else if (queue.status === 'degraded' && queueStatus !== 'down') {
        queueStatus = 'degraded';
      }
    }
  } catch (error) {
    queueStatus = 'down';
    errors.push(`Queue health check failed: ${(error as Error).message}`);
    logger.error('Queue health check failed', { error: (error as Error).message });
  }

  const isHealthy = dbStatus === 'up' && queueStatus !== 'down';
  const responseStatus = isHealthy ? 200 : 503;
  
  const payload = {
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    type: 'deep',
    totalLatencyMs: Date.now() - startTime,
    services: {
      api: 'up',
      database: {
        status: dbStatus,
        latencyMs: dbLatency
      },
      queue: {
        status: queueStatus,
        details: queues
      }
    },
    ...(errors.length > 0 && { errors })
  };

  if (!isHealthy) {
    logger.error('Deep health check failed', payload);
  }

  return NextResponse.json(payload, { status: responseStatus });
}
