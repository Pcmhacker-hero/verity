export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@verity/database';
import { sql } from 'drizzle-orm';
import { logger } from '@verity/shared/observability';

export async function GET() {
  try {
    // Readiness check: Ensure we can connect to the database.
    // We don't check queues here because the API can still accept requests 
    // and enqueue them even if workers are temporarily behind or down.
    await db.execute(sql`SELECT 1`);
    
    return NextResponse.json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      type: 'readiness',
      service: 'verity-web'
    });
  } catch (error) {
    const err = error as Error;
    logger.error('Readiness check failed', { error: err.message });
    return NextResponse.json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      type: 'readiness',
      error: err.message
    }, { status: 503 });
  }
}
