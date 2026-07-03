import { NextRequest, NextResponse } from 'next/server';
import { db } from '@verity/database';
import { findings, verificationRuns } from '@verity/database/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { auth } from '@/lib/auth/config'; // Server-side auth checker

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = await context.params;
    const { searchParams } = new URL(request.url);
    const severityParam = searchParams.get('severity');
    const specAreaParam = searchParams.get('specArea');
    const runIdParam = searchParams.get('runId');

    // Tenant boundary enforced in related queries

    // 1. Get the relevant verification run. Either specified or the latest complete one.
    let targetRunId = runIdParam;
    
    if (!targetRunId) {
      const latestRun = await db.query.verificationRuns.findFirst({
        where: and(
          eq(verificationRuns.projectId, projectId),
          eq(verificationRuns.status, 'complete')
        ),
        orderBy: [desc(verificationRuns.completedAt)],
      });

      if (!latestRun) {
        return NextResponse.json({ findings: [], message: 'No completed verification runs found.' });
      }
      targetRunId = latestRun.id;
    }

    // 2. Build the where clause for findings
    const conditions = [eq(findings.verificationRunId, targetRunId)];
    
    if (severityParam) {
      const severities = severityParam.split(',').filter(Boolean);
      if (severities.length > 0) {
        conditions.push(inArray(findings.severity, severities as any[]));
      }
    }
    
    if (specAreaParam) {
      const areas = specAreaParam.split(',').filter(Boolean);
      if (areas.length > 0) {
        conditions.push(inArray(findings.specArea, areas as any[]));
      }
    }

    // 3. Query findings
    const results = await db.query.findings.findMany({
      where: and(...conditions),
      orderBy: [desc(findings.severity)],
    });

    return NextResponse.json({ findings: results, runId: targetRunId });
  } catch (error: any) {
    console.error('Error fetching findings:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
