export const dynamic = 'force-dynamic';
import { WorkspaceService } from '@verity/services';
import { createProjectSchema, listProjectsQuerySchema, projectListResponseSchema, projectSummaryResponseSchema } from '@verity/shared/validation';
import type { NextRequest } from 'next/server';
import type { z } from 'zod';
import { withApiAuth } from '@/lib/api/handler';
import { jsonResponse } from '@/lib/api/responses';
import { parseJsonBody, parseSearchParams } from '@/lib/api/validation';

const workspaceService = new WorkspaceService();

export const GET = withApiAuth(async (request: NextRequest, { auth }) => {
  const query = parseSearchParams(request, listProjectsQuerySchema) as z.infer<typeof listProjectsQuerySchema>;
  const projects = await workspaceService.listProjects({ workspaceId: auth.workspaceId, ...query });
  return jsonResponse(projects, projectListResponseSchema);
});

export const POST = withApiAuth(async (request: NextRequest, { auth }) => {
  const body = await parseJsonBody(request, createProjectSchema);
  const project = await workspaceService.createProject(auth.workspaceId, body.name);
  return jsonResponse(project, projectSummaryResponseSchema, { status: 201 });
});

export type ProjectsListResponse = z.infer<typeof projectListResponseSchema>;
