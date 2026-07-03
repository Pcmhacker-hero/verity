'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    async function performLogout() {
      await authClient.signOut();
      router.push('/login');
      router.refresh();
    }
    performLogout();
  }, [router]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold tracking-tight text-center">
          Logging out...
        </CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent" />
      </CardContent>
    </Card>
  );
}
