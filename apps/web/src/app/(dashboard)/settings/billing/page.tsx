'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

// Note: In a real implementation, workspaceId would be fetched from context or layout.
// For now, we mock it or fetch it based on user context.
const WORKSPACE_ID = 'your_workspace_id_here'; // Replace with actual context

export default function BillingPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleUpgrade = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: WORKSPACE_ID, // Provide the actual workspace ID here
          priceId: 'price_pro_example', // In real life, use process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID
        }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Failed to start checkout');
      }
    } catch (error) {
      console.error('Checkout error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManage = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: WORKSPACE_ID,
        }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Failed to open customer portal');
      }
    } catch (error) {
      console.error('Portal error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Billing & Subscription</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Free Plan</CardTitle>
            <CardDescription>
              Perfect for getting started.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$0/month</div>
            <p className="text-xs text-muted-foreground mt-2">
              Includes 1 user, 3 projects, and limited generations.
            </p>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full" disabled>Current Plan</Button>
          </CardFooter>
        </Card>

        <Card className="border-primary">
          <CardHeader>
            <CardTitle>Pro Plan</CardTitle>
            <CardDescription>
              For professional developers.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$15/month</div>
            <p className="text-xs text-muted-foreground mt-2">
              Includes unlimited projects, advanced AI reviews, and priority queue.
            </p>
          </CardContent>
          <CardFooter>
            <Button className="w-full" onClick={handleUpgrade} disabled={isLoading}>
              {isLoading ? 'Processing...' : 'Upgrade to Pro'}
            </Button>
          </CardFooter>
        </Card>
      </div>

      <div className="mt-8">
        <h3 className="text-lg font-medium">Manage Subscription</h3>
        <p className="text-sm text-muted-foreground mb-4">
          View your payment history, update your payment method, or cancel your subscription.
        </p>
        <Button variant="secondary" onClick={handleManage} disabled={isLoading}>
          Open Customer Portal
        </Button>
      </div>
    </div>
  );
}
