import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { BillingService } from '@verity/services';
import { db } from '@verity/database';

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceId } = await req.json();

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    // Verify user belongs to workspace and has admin/owner role
    const membership = await db.query.memberships.findFirst({
      where: (m, { and, eq }) => and(eq(m.workspaceId, workspaceId), eq(m.userId, session.user.id)),
    });

    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const subscription = await db.query.subscriptions.findFirst({
      where: (s, { eq }) => eq(s.workspaceId, workspaceId),
    });

    if (!subscription || !subscription.stripeCustomerId) {
      return NextResponse.json({ error: 'Workspace has no active subscription or customer record' }, { status: 400 });
    }

    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    const portalSession = await BillingService.createCustomerPortalSession(
      subscription.stripeCustomerId,
      `${origin}/settings/billing`
    );

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    console.error('Portal error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
