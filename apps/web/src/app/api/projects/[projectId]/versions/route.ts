export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { db } from '@verity/database';
import { specVersions } from '@verity/database/schema';
import { eq, desc } from 'drizzle-orm';
import { VerityError } from '@verity/shared/errors';

export async function GET(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) {
      return NextResponse.json(
        { error: { code: 'AUTH_SESSION_INVALID', message: 'Session expired', action: 'redirect_to_login' } },
        { status: 401 }
      );
    }

    const { projectId } = await params;
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const cursor = url.searchParams.get('cursor'); // In v1, cursor could just be an offset, but let's implement basic for now.
    
    // Quick history fetch implementation (ideally belongs in repository, but placing here for simplicity per Step 5 scope)
    const history = await db
      .select({
        id: specVersions.id,
        versionNumber: specVersions.versionNumber,
        source: specVersions.source,
        changeSummary: specVersions.changeSummary,
        createdAt: specVersions.createdAt,
      })
      .from(specVersions)
      .where(eq(specVersions.projectId, projectId))
      .orderBy(desc(specVersions.versionNumber))
      .limit(limit);

    return NextResponse.json({
      data: history,
      pagination: {
        nextCursor: null, // Basic stub for pagination
        hasMore: false,
      }
    });
  } catch (error: any) {
    if (error instanceof VerityError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' } }, { status: 500 });
  }
}
