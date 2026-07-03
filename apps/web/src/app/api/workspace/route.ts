export const dynamic = 'force-dynamic';
import { WorkspaceService } from '@verity/services';
import { updateWorkspaceSchema, workspaceResponseSchema } from '@verity/shared/validation';
import type { NextRequest } from 'next/server';
import { withApiAuth } from '@/lib/api/handler';
import { jsonResponse } from '@/lib/api/responses';
import { parseJsonBody } from '@/lib/api/validation';

const workspaceService = new WorkspaceService();

export const GET = withApiAuth(async (_request, { auth }) => {
  const workspace = await workspaceService.getWorkspace(auth.workspaceId);
  return jsonResponse(workspace, workspaceResponseSchema);
});

export const PATCH = withApiAuth(async (request: NextRequest, { auth }) => {
  const body = await parseJsonBody(request, updateWorkspaceSchema);
  const workspace = await workspaceService.updateWorkspace(auth.workspaceId, body.name);
  return jsonResponse(workspace, workspaceResponseSchema);
});
