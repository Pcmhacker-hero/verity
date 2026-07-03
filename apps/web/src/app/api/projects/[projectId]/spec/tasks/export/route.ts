export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/lib/auth/config';
import { SpecService } from '@verity/services';
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
    const versionParam = url.searchParams.get('version');
    const versionNumber = versionParam ? parseInt(versionParam, 10) : undefined;

    const specService = new SpecService();
    const markdown = await specService.getTasksExport(projectId, versionNumber);

    return new NextResponse(markdown, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown',
      },
    });
  } catch (error: unknown) {
    if (error instanceof VerityError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' } }, { status: 500 });
  }
}
