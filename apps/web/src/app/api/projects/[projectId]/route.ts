export const dynamic = 'force-dynamic';
import { WorkspaceService } from '@verity/services';
import { projectDetailResponseSchema, projectIdParamsSchema, updateProjectSchema } from '@verity/shared/validation';
import type { NextRequest } from 'next/server';
import { withApiAuth } from '@/lib/api/handler';
import { jsonResponse, noContentResponse } from '@/lib/api/responses';
import { parseJsonBody, parseParams } from '@/lib/api/validation';

const workspaceService = new WorkspaceService();

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export const GET = withApiAuth<RouteContext>(async (_request: NextRequest, { auth }, routeContext) => {
  const params = parseParams(await routeContext.params, projectIdParamsSchema);
  const project = await workspaceService.getProjectDetail({ workspaceId: auth.workspaceId, projectId: params.projectId });
  return jsonResponse(project, projectDetailResponseSchema);
});

export const PATCH = withApiAuth<RouteContext>(async (request: NextRequest, { auth }, routeContext) => {
  const params = parseParams(await routeContext.params, projectIdParamsSchema);
  const body = await parseJsonBody(request, updateProjectSchema.required({ name: true }));
  const project = await workspaceService.updateProject({
    workspaceId: auth.workspaceId,
    projectId: params.projectId,
    name: body.name,
  });
  return jsonResponse(project, projectDetailResponseSchema);
});

export const DELETE = withApiAuth<RouteContext>(async (_request: NextRequest, { auth }, routeContext) => {
  const params = parseParams(await routeContext.params, projectIdParamsSchema);
  await workspaceService.deleteProject({ workspaceId: auth.workspaceId, projectId: params.projectId });
  return noContentResponse();
});
