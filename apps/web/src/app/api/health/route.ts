export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@verity/database';
import { sql } from 'drizzle-orm';
import { logger } from '@verity/shared';

export async function GET() {
  try {
    // Check DB connection
    await db.execute(sql`SELECT 1`);
    
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'up',
        api: 'up'
      }
    });
  } catch (error: any) {
    logger.error('Health check failed', { error: error.message });
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'down',
        api: 'up'
      },
      error: error.message
    }, { status: 503 });
  }
}
