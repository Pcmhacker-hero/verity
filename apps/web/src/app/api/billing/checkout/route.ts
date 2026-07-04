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

    const { workspaceId, priceId } = await req.json();

    if (!workspaceId || !priceId) {
      return NextResponse.json({ error: 'workspaceId and priceId are required' }, { status: 400 });
    }

    // Verify user belongs to workspace and has admin/owner role
    const membership = await db.query.memberships.findFirst({
      where: (m, { and, eq }) => and(eq(m.workspaceId, workspaceId), eq(m.userId, session.user.id)),
    });

    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if there's already an active subscription
    const existingSub = await db.query.subscriptions.findFirst({
      where: (s, { eq }) => eq(s.workspaceId, workspaceId),
    });

    if (existingSub && existingSub.status === 'active') {
      return NextResponse.json({ error: 'Workspace already has an active subscription' }, { status: 400 });
    }

    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    const checkoutSession = await BillingService.createCheckoutSession(
      workspaceId,
      priceId,
      `${origin}/projects?checkout=success`,
      `${origin}/settings/billing?checkout=canceled`
    );

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
