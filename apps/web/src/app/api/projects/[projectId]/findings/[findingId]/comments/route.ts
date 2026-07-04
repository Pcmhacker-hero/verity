import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { FindingsService } from '@verity/services';
import { auth } from '@/lib/auth/config';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; findingId: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { findingId } = await context.params;
    const comments = await FindingsService.getFindingComments(findingId);

    return NextResponse.json({ comments });
  } catch (error: unknown) {
    console.error('Error fetching comments:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; findingId: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { findingId } = await context.params;
    const { content } = await request.json();

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const comment = await FindingsService.addFindingComment(findingId, session.user.id, content);

    return NextResponse.json({ comment: comment[0] });
  } catch (error: unknown) {
    console.error('Error adding comment:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
