import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldAlert } from 'lucide-react';

export default function UnauthorizedPage() {
  return (
    <Card className="w-full">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <ShieldAlert className="h-12 w-12 text-destructive" />
        </div>
        <CardTitle className="text-2xl font-semibold tracking-tight">
          Access Denied
        </CardTitle>
        <CardDescription>
          You don't have permission to view this page.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center text-sm text-muted-foreground">
        If you believe this is an error, please contact your workspace administrator or support team.
      </CardContent>
      <CardFooter className="flex justify-center space-x-4">
        <Button asChild variant="outline">
          <Link href="/">Return Home</Link>
        </Button>
        <Button asChild>
          <Link href="/login">Sign In</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
