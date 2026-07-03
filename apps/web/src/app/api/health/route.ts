export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

import { logger } from '@verity/shared/observability';

export async function GET() {
  try {
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      type: 'liveness',
      service: 'verity-web'
    });
  } catch (error) {
    const err = error as Error;
    logger.error('Liveness check failed', { error: err.message });
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      type: 'liveness',
      error: err.message
    }, { status: 503 });
  }
}
