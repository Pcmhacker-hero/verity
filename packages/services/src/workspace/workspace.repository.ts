import { db } from '@verity/database';
import { findings, memberships, projects, repoConnections, specVersions, verificationRuns, workspaces } from '@verity/database/schema';
import { and, asc, desc, eq, gt, ilike, inArray, isNotNull, isNull, lt, or, sql } from 'drizzle-orm';

export type ProjectSort = 'updated_at' | 'created_at' | 'name';
export type SortOrder = 'asc' | 'desc';

export type ProjectCursor = {
  value: string;
  id: string;
};

export type ListProjectsInput = {
  workspaceId: string;
  limit: number;
  sort: ProjectSort;
  order: SortOrder;
  cursor?: ProjectCursor | null;
  query?: string;
  hasRepoConnection?: boolean;
};

export type ProjectRow = typeof projects.$inferSelect;
export type WorkspaceRow = typeof workspaces.$inferSelect;
export type SpecVersionRow = typeof specVersions.$inferSelect;
export type RepoConnectionRow = typeof repoConnections.$inferSelect;
export type VerificationRunRow = typeof verificationRuns.$inferSelect;

function sortColumn(sort: ProjectSort) {
  if (sort === 'created_at') return projects.createdAt;
  if (sort === 'name') return projects.name;
  return projects.updatedAt;
}

function cursorCondition(sort: ProjectSort, order: SortOrder, cursor?: ProjectCursor | null) {
  if (!cursor) return undefined;

  const compare = order === 'asc' ? gt : lt;

  if (sort === 'name') {
    return or(compare(projects.name, cursor.value), and(eq(projects.name, cursor.value), compare(projects.id, cursor.id)));
  }

  const column = sort === 'created_at' ? projects.createdAt : projects.updatedAt;
  const value = new Date(cursor.value);

  return or(compare(column, value), and(eq(column, value), compare(projects.id, cursor.id)));
}

export class WorkspaceRepository {
  async findWorkspace(workspaceId: string) {
    const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
    return workspace ?? null;
  }

  async updateWorkspace(workspaceId: string, name: string) {
    const [workspace] = await db
      .update(workspaces)
      .set({ name })
      .where(eq(workspaces.id, workspaceId))
      .returning();

    return workspace ?? null;
  }

  async listProjects(input: ListProjectsInput) {
    const orderBy = input.order === 'asc' ? asc : desc;
    const cursorWhere = cursorCondition(input.sort, input.order, input.cursor);

    const repoConnectionFilter =
      typeof input.hasRepoConnection === 'boolean'
        ? input.hasRepoConnection
          ? isNotNull(projects.repoConnectionId)
          : isNull(projects.repoConnectionId)
        : undefined;

    return db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.workspaceId, input.workspaceId),
          isNull(projects.deletedAt),
          input.query ? ilike(projects.name, `%${input.query.replace(/([%_])/g, '\\\\$1')}%`) : undefined,
          repoConnectionFilter,
          cursorWhere,
        ),
      )
      .orderBy(orderBy(sortColumn(input.sort)), orderBy(projects.id))
      .limit(input.limit + 1);
  }

  async createProject(workspaceId: string, name: string, githubRepoFullName?: string, oauthTokenRef?: string) {
    return await db.transaction(async (tx) => {
      const [project] = await tx
        .insert(projects)
        .values({ workspaceId, name })
        .returning();
      
      if (!project) return null;

      if (githubRepoFullName && oauthTokenRef) {
        const [connection] = await tx
          .insert(repoConnections)
          .values({
            projectId: project.id,
            githubRepoFullName,
            oauthTokenRef,
          })
          .returning();
        
        if (connection) {
          await tx.update(projects)
            .set({ repoConnectionId: connection.id })
            .where(eq(projects.id, project.id));
        }
      }

      return project;
    });
  }

  async findProjectById(workspaceId: string, projectId: string) {
    const [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId), isNull(projects.deletedAt)))
      .limit(1);

    return project ?? null;
  }

  async updateProject(workspaceId: string, projectId: string, name: string) {
    const [project] = await db
      .update(projects)
      .set({ name, updatedAt: new Date() })
      .where(and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId), isNull(projects.deletedAt)))
      .returning();

    return project ?? null;
  }

  async softDeleteProject(workspaceId: string, projectId: string) {
    const [project] = await db
      .update(projects)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId), isNull(projects.deletedAt)))
      .returning();

    return project ?? null;
  }

  async findSpecVersionById(workspaceId: string, specVersionId: string | null) {
    if (!specVersionId) return null;

    const [row] = await db
      .select({ specVersion: specVersions })
      .from(specVersions)
      .innerJoin(projects, eq(projects.id, specVersions.projectId))
      .where(and(eq(specVersions.id, specVersionId), eq(projects.workspaceId, workspaceId), isNull(projects.deletedAt)))
      .limit(1);

    return row?.specVersion ?? null;
  }

  async findRepoConnection(workspaceId: string, repoConnectionId: string | null) {
    if (!repoConnectionId) return null;

    const [row] = await db
      .select({ connection: repoConnections })
      .from(repoConnections)
      .innerJoin(projects, eq(projects.id, repoConnections.projectId))
      .where(and(eq(repoConnections.id, repoConnectionId), eq(projects.workspaceId, workspaceId), isNull(projects.deletedAt)))
      .limit(1);

    return row?.connection ?? null;
  }

  async findLatestVerificationRun(workspaceId: string, projectId: string) {
    const [run] = await db
      .select({ verificationRun: verificationRuns })
      .from(verificationRuns)
      .innerJoin(projects, eq(projects.id, verificationRuns.projectId))
      .where(and(eq(projects.workspaceId, workspaceId), eq(verificationRuns.projectId, projectId), isNull(projects.deletedAt)))
      .orderBy(desc(verificationRuns.triggeredAt), desc(verificationRuns.id))
      .limit(1);

    return run?.verificationRun ?? null;
  }

  async countFindingsBySeverity(workspaceId: string, verificationRunId: string) {
    return db
      .select({ severity: findings.severity, count: sql<number>`count(*)::int` })
      .from(findings)
      .innerJoin(verificationRuns, eq(verificationRuns.id, findings.verificationRunId))
      .innerJoin(projects, eq(projects.id, verificationRuns.projectId))
      .where(and(eq(findings.verificationRunId, verificationRunId), eq(projects.workspaceId, workspaceId), isNull(projects.deletedAt)))
      .groupBy(findings.severity);
  }

  async countOpenCriticalHighFindings(workspaceId: string, verificationRunId: string) {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(findings)
      .innerJoin(verificationRuns, eq(verificationRuns.id, findings.verificationRunId))
      .innerJoin(projects, eq(projects.id, verificationRuns.projectId))
      .where(
        and(
          eq(findings.verificationRunId, verificationRunId),
          eq(projects.workspaceId, workspaceId),
          isNull(projects.deletedAt),
          eq(findings.status, 'open'),
          inArray(findings.severity, ['critical', 'high']),
        ),
      );

    return result?.count ?? 0;
  }

  async findMembership(userId: string, workspaceId: string) {
    const [membership] = await db
      .select()
      .from(memberships)
      .where(and(eq(memberships.userId, userId), eq(memberships.workspaceId, workspaceId)))
      .limit(1);

    return membership ?? null;
  }
}
