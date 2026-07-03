export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { logger, monitorRegistry } from '@verity/shared/observability';
import '@verity/database'; // Force DB initialization and health registration
import '@verity/queue'; // Force Queue health registration

export async function GET() {
  const startTime = Date.now();
  
  // This will dynamically evaluate all registered health checks
  // (Database, Queues, etc.)
  const systemHealth = await monitorRegistry.getSystemHealth();
  
  const isHealthy = systemHealth.status !== 'unhealthy';
  const responseStatus = isHealthy ? 200 : 503;
  
  const payload = {
    status: systemHealth.status,
    timestamp: new Date().toISOString(),
    type: 'deep',
    totalLatencyMs: Date.now() - startTime,
    services: systemHealth.results
  };

  if (!isHealthy) {
    logger.error('Deep health check failed', payload);
  }

  return NextResponse.json(payload, { status: responseStatus });
}
