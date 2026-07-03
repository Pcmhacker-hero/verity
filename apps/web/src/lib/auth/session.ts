import { db } from '@verity/database';
import { memberships, users } from '@verity/database/schema';
import { and, eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from './config';
import { ensureWorkspaceForAuthUser } from './provisioning';

export type AuthContext = {
  authUserId: string;
  userId: string;
  workspaceId: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
};

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const session = await getSession();

  if (!session?.user) {
    return null;
  }

  const provisioned = await ensureWorkspaceForAuthUser({
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
  });

  const [row] = await db
    .select({
      userId: users.id,
      workspaceId: memberships.workspaceId,
      role: memberships.role,
    })
    .from(users)
    .innerJoin(memberships, eq(memberships.userId, users.id))
    .where(and(eq(users.id, provisioned.userId), eq(memberships.workspaceId, provisioned.workspaceId)))
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    authUserId: session.user.id,
    userId: row.userId,
    workspaceId: row.workspaceId,
    email: session.user.email,
    role: row.role,
  };
}

export async function requireAuthContext(): Promise<AuthContext> {
  const context = await getAuthContext();

  if (!context) {
    redirect('/login');
  }

  return context;
}
