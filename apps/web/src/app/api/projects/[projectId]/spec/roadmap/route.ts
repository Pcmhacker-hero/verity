export const dynamic = 'force-dynamic';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api/handler';
import { WorkspaceService, SpecService } from '@verity/services';


type RouteContext = { params: Promise<{ projectId: string }> };

export const GET = withApiAuth<RouteContext>(async (req: NextRequest, { auth }, routeContext) => {
  const { projectId } = await routeContext.params;
  const workspaceService = new WorkspaceService();
  await workspaceService.getProjectDetail({ workspaceId: auth.workspaceId, projectId });

  const url = new URL(req.url);
  const versionParam = url.searchParams.get('version');
  const versionNumber = versionParam ? parseInt(versionParam, 10) : undefined;

  const specService = new SpecService();
  const result = await specService.getArtifact(projectId, 'roadmap', versionNumber);

  return NextResponse.json(result);
});

// Read-only in v1 MVP per Document 14 §7.7
