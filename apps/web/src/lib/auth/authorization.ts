import { NextResponse } from 'next/server';
import { getAuthContext, type AuthContext } from './session';

export function authSessionInvalidResponse() {
  return NextResponse.json(
    {
      error: {
        code: 'AUTH_SESSION_INVALID',
        message: 'Session expired or invalid. Please log in again.',
        action: 'redirect_to_login',
      },
    },
    { status: 401 },
  );
}

export async function requireApiAuth(): Promise<AuthContext | NextResponse> {
  const context = await getAuthContext();
  return context ?? authSessionInvalidResponse();
}

export function canAccessWorkspace(context: AuthContext, workspaceId: string) {
  return context.workspaceId === workspaceId;
}

export function requireOwner(context: AuthContext) {
  return context.role === 'owner';
}

// TODO(Step 4+): add project/resource-specific helpers that return 404 instead
// of 403 by joining each resource through `workspace_id`, per Doc 16 §5.2.
