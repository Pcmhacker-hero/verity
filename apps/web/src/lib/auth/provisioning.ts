import { db } from '@verity/database';
import { memberships, users, workspaces } from '@verity/database/schema';
import { eq } from 'drizzle-orm';

type AuthUser = {
  id: string;
  email: string;
  name?: string | null;
};

function workspaceNameFor(user: AuthUser) {
  const displayName = user.name?.trim() || user.email.split('@')[0] || 'User';
  return `${displayName}'s Workspace`;
}

export async function ensureWorkspaceForAuthUser(authUser: AuthUser) {
  return db.transaction(async (tx) => {
    const [existingDomainUser] = await tx
      .select()
      .from(users)
      .where(eq(users.authProviderId, authUser.id))
      .limit(1);

    const [domainUser] = existingDomainUser
      ? [existingDomainUser]
      : await tx
          .insert(users)
          .values({
            email: authUser.email,
            authProviderId: authUser.id,
          })
          .onConflictDoUpdate({
            target: users.email,
            set: { authProviderId: authUser.id },
          })
          .returning();

    if (!domainUser) {
      throw new Error('Failed to provision Verity user after authentication');
    }

    const [existingMembership] = await tx
      .select()
      .from(memberships)
      .where(eq(memberships.userId, domainUser.id))
      .limit(1);

    if (existingMembership) {
      return { userId: domainUser.id, workspaceId: existingMembership.workspaceId };
    }

    const [workspace] = await tx
      .insert(workspaces)
      .values({ name: workspaceNameFor(authUser) })
      .returning();

    if (!workspace) {
      throw new Error('Failed to provision workspace after authentication');
    }

    await tx.insert(memberships).values({
      workspaceId: workspace.id,
      userId: domainUser.id,
      role: 'owner',
    });

    return { userId: domainUser.id, workspaceId: workspace.id };
  });
}
