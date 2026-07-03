import { Suspense } from 'react';
import { FindingsList } from '@/components/findings/findings-list';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata = {
  title: 'Verification Findings | Verity',
  description: 'View findings from the AI Review Engine',
};

export default async function FindingsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Verification Findings</h2>
      </div>
      <div className="hidden h-full flex-1 flex-col space-y-8 md:flex">
        <p className="text-muted-foreground">
          Review discrepancies between your project's specifications and the current codebase.
        </p>
        
        <Suspense fallback={<div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" /></div>}>
          <FindingsList projectId={projectId} />
        </Suspense>
      </div>
    </div>
  );
}
