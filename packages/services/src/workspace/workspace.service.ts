import { NotFoundError, ValidationError } from '@verity/shared/errors';
import type {
  LastVerificationStatus,
  ProjectDetail,
  ProjectSummary,
  SortOrder,
  VerificationSummary,
  VersionContextStatus,
  WorkspaceResponse,
} from '@verity/shared/types';
import {
  WorkspaceRepository,
  type ProjectCursor,
  type ProjectRow,
  type ProjectSort,
  type SpecVersionRow,
  type VerificationRunRow,
} from './workspace.repository.js';

type ListProjectsOptions = {
  workspaceId: string;
  cursor?: string | null;
  limit: number;
  sort: ProjectSort;
  order: SortOrder;
  query?: string;
  hasRepoConnection?: boolean;
};

type ProjectMutationOptions = {
  workspaceId: string;
  projectId: string;
};

const ZERO_FINDING_COUNTS = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };

function toIso(date: Date) {
  return date.toISOString();
}

function encodeCursor(project: ProjectRow, sort: ProjectSort) {
  const value = sort === 'name' ? project.name : toIso(sort === 'created_at' ? project.createdAt : project.updatedAt);
  return Buffer.from(JSON.stringify({ value, id: project.id })).toString('base64url');
}

function decodeCursor(cursor: string | null | undefined, sort: ProjectSort): ProjectCursor | null {
  if (!cursor) return null;

  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as ProjectCursor;
    const isValidDateCursor = sort === 'name' || !Number.isNaN(new Date(parsed.value).getTime());

    if (typeof parsed.value === 'string' && typeof parsed.id === 'string' && isValidDateCursor) {
      return parsed;
    }
  } catch {
    // Fall through to the standardized validation error below.
  }

  throw new ValidationError('Invalid pagination cursor.', { field: 'cursor' });
}

function specVersionSummary(specVersion: SpecVersionRow | null) {
  if (!specVersion) return null;

  return {
    id: specVersion.id,
    versionNumber: specVersion.versionNumber,
    createdAt: toIso(specVersion.createdAt),
  };
}

export class WorkspaceService {
  constructor(private readonly repository = new WorkspaceRepository()) {}

  async getWorkspace(workspaceId: string): Promise<WorkspaceResponse> {
    const workspace = await this.repository.findWorkspace(workspaceId);
    if (!workspace) throw new NotFoundError('Workspace');

    return { id: workspace.id, name: workspace.name, createdAt: toIso(workspace.createdAt) };
  }

  async updateWorkspace(workspaceId: string, name: string): Promise<WorkspaceResponse> {
    const workspace = await this.repository.updateWorkspace(workspaceId, name);
    if (!workspace) throw new NotFoundError('Workspace');

    return { id: workspace.id, name: workspace.name, createdAt: toIso(workspace.createdAt) };
  }

  async listProjects(options: ListProjectsOptions) {
    const rows = await this.repository.listProjects({
      ...options,
      cursor: decodeCursor(options.cursor, options.sort),
    });
    const pageRows = rows.slice(0, options.limit);
    const data = await Promise.all(pageRows.map((project) => this.toProjectSummary(options.workspaceId, project)));
    const last = pageRows.at(-1);

    return {
      data,
      pagination: {
        hasMore: rows.length > options.limit,
        nextCursor: rows.length > options.limit && last ? encodeCursor(last, options.sort) : null,
      },
    };
  }

  async createProject(workspaceId: string, name: string, githubRepoFullName?: string, githubToken?: string): Promise<ProjectSummary> {
    const project = await this.repository.createProject(workspaceId, name, githubRepoFullName, githubToken ? 'github_oauth' : undefined);
    if (!project) throw new NotFoundError('Workspace');

    if (githubRepoFullName && githubToken) {
      const { getQueueService } = await import('@verity/queue');
      const queue = getQueueService();
      if (queue) {
        await queue.enqueueSyncJob({
          projectId: project.id,
          githubRepoFullName,
          accessToken: githubToken,
        });
      }
    }

    return this.toProjectSummary(workspaceId, project);
  }

  async getProjectDetail(options: ProjectMutationOptions): Promise<ProjectDetail> {
    const project = await this.repository.findProjectById(options.workspaceId, options.projectId);
    if (!project) throw new NotFoundError('Project');

    return this.toProjectDetail(options.workspaceId, project);
  }

  async updateProject(options: ProjectMutationOptions & { name: string }): Promise<ProjectDetail> {
    const project = await this.repository.updateProject(options.workspaceId, options.projectId, options.name);
    if (!project) throw new NotFoundError('Project');

    return this.toProjectDetail(options.workspaceId, project);
  }

  async deleteProject(options: ProjectMutationOptions): Promise<void> {
    const project = await this.repository.softDeleteProject(options.workspaceId, options.projectId);
    if (!project) throw new NotFoundError('Project');
  }

  private async toProjectSummary(workspaceId: string, project: ProjectRow): Promise<ProjectSummary> {
    const currentSpecVersion = await this.repository.findSpecVersionById(workspaceId, project.currentSpecVersionId);
    const latestRun = await this.repository.findLatestVerificationRun(workspaceId, project.id);
    const highSeverityCount = latestRun ? await this.repository.countOpenCriticalHighFindings(workspaceId, latestRun.id) : 0;

    return {
      id: project.id,
      name: project.name,
      currentSpecVersion: specVersionSummary(currentSpecVersion),
      hasRepoConnection: Boolean(project.repoConnectionId),
      lastVerificationStatus: this.lastVerificationStatus(latestRun?.status ?? null, highSeverityCount),
      updatedAt: toIso(project.updatedAt),
      createdAt: toIso(project.createdAt),
    };
  }

  private async toProjectDetail(workspaceId: string, project: ProjectRow): Promise<ProjectDetail> {
    const currentSpecVersion = await this.repository.findSpecVersionById(workspaceId, project.currentSpecVersionId);
    const repoConnection = await this.repository.findRepoConnection(workspaceId, project.repoConnectionId);
    const latestRun = await this.repository.findLatestVerificationRun(workspaceId, project.id);
    const verificationSummary = latestRun ? await this.verificationSummary(workspaceId, latestRun) : null;
    const highSeverityCount = latestRun ? await this.repository.countOpenCriticalHighFindings(workspaceId, latestRun.id) : 0;
    return {
      id: project.id,
      name: project.name,
      hasRepoConnection: Boolean(project.repoConnectionId),
      lastVerificationStatus: this.lastVerificationStatus(latestRun?.status ?? null, highSeverityCount),
      updatedAt: toIso(project.updatedAt),
      createdAt: toIso(project.createdAt),
      currentSpecVersion: currentSpecVersion
        ? {
            ...specVersionSummary(currentSpecVersion)!,
            source: currentSpecVersion.source,
            changeSummary: currentSpecVersion.changeSummary,
          }
        : null,
      repoConnection: repoConnection
        ? {
            id: repoConnection.id,
            githubRepoFullName: repoConnection.githubRepoFullName,
            connectedAt: toIso(repoConnection.connectedAt),
          }
        : null,
      verificationSummary,
      versionContextStatus: this.versionContextStatus(
        project.currentSpecVersionId,
        latestRun?.specVersionId ?? null,
        latestRun?.status ?? null,
        highSeverityCount,
      ),
    };
  }

  private async verificationSummary(workspaceId: string, run: VerificationRunRow): Promise<VerificationSummary> {
    const specVersion = await this.repository.findSpecVersionById(workspaceId, run.specVersionId);
    const latestRunCounts = await this.repository.countFindingsBySeverity(workspaceId, run.id);
    const counts = { ...ZERO_FINDING_COUNTS };

    for (const row of latestRunCounts) {
      counts[row.severity] = row.count;
    }

    return {
      lastRunId: run.id,
      lastRunStatus: run.status,
      lastRunSpecVersionId: run.specVersionId,
      lastRunSpecVersionNumber: specVersion?.versionNumber ?? null,
      completedAt: run.completedAt ? toIso(run.completedAt) : null,
      findingCounts: counts,
    };
  }

  private lastVerificationStatus(status: string | null, highSeverityCount: number): LastVerificationStatus {
    if (!status) return 'never_run';
    if (status === 'failed') return 'failed';
    if (status !== 'complete') return 'never_run';
    return highSeverityCount > 0 ? 'findings' : 'clean';
  }

  private versionContextStatus(
    currentSpecVersionId: string | null,
    latestRunSpecVersionId: string | null,
    latestRunStatus: string | null,
    highSeverityCount: number,
  ): VersionContextStatus {
    if (!latestRunSpecVersionId || latestRunStatus !== 'complete') return 'never_verified';
    if (currentSpecVersionId !== latestRunSpecVersionId) return 'spec_changed_since_verification';
    return highSeverityCount > 0 ? 'verified_with_findings' : 'verified_clean';
  }
}
