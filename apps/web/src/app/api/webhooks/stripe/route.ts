import { NextResponse } from 'next/server';
import { BillingService } from '@verity/services';
import { db } from '@verity/database';
import { eq } from 'drizzle-orm';
import { subscriptions } from '@verity/database/schema';
import type { Stripe } from 'stripe';

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing stripe signature or secret' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = BillingService.stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`Webhook signature verification failed: ${errorMessage}`);
    return NextResponse.json({ error: `Webhook Error: ${errorMessage}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === 'subscription' && session.metadata?.workspaceId && session.subscription) {
          const workspaceId = session.metadata.workspaceId;
          const stripeSubscriptionId = session.subscription as string;
          const stripeCustomerId = session.customer as string;

          // Retrieve full subscription object to get current period end and plan
          const subscription = await BillingService.stripe.subscriptions.retrieve(stripeSubscriptionId);
          const planId = subscription.items.data[0]?.price?.id || '';

          await db.insert(subscriptions).values({
            workspaceId,
            stripeCustomerId,
            stripeSubscriptionId,
            planId,
            status: subscription.status,
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
          }).onConflictDoUpdate({
            target: subscriptions.stripeSubscriptionId,
            set: {
              status: subscription.status,
              planId,
              currentPeriodEnd: new Date(subscription.current_period_end * 1000),
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
              updatedAt: new Date(),
            }
          });
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        
        // Find existing DB sub to update
        const existingSub = await db.query.subscriptions.findFirst({
          where: (s, { eq }) => eq(s.stripeSubscriptionId, subscription.id),
        });

        if (existingSub) {
          const planId = subscription.items.data[0]?.price?.id || '';
          
          await db.update(subscriptions)
            .set({
              status: subscription.status,
              planId,
              currentPeriodEnd: new Date(subscription.current_period_end * 1000),
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
              updatedAt: new Date(),
            })
            .where(eq(subscriptions.stripeSubscriptionId, subscription.id));
        }
        break;
      }
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook processing failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
