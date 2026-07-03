/**
 * Project types — Doc 10 §4.4, Doc 10 §6.1.
 */

export interface ProjectSummary {
  id: string;
  name: string;
  currentSpecVersion: ProjectSpecVersionSummary | null;
  hasRepoConnection: boolean;
  lastVerificationStatus: LastVerificationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDetail extends ProjectSummary {
  currentSpecVersion: ProjectSpecVersionDetail | null;
  repoConnection: RepoConnectionInfo | null;
  verificationSummary: VerificationSummary | null;
  versionContextStatus: VersionContextStatus;
}

export interface ProjectSpecVersionSummary {
  id: string;
  versionNumber: number;
  createdAt: string;
}

export interface ProjectSpecVersionDetail extends ProjectSpecVersionSummary {
  source: 'generation' | 'edit' | 'regeneration';
  changeSummary: string | null;
}

export interface RepoConnectionInfo {
  id: string;
  githubRepoFullName: string;
  connectedAt: string;
}

export interface VerificationSummary {
  lastRunId: string;
  lastRunStatus: 'queued' | 'running_deterministic' | 'running_semantic' | 'complete' | 'failed';
  lastRunSpecVersionId: string;
  lastRunSpecVersionNumber: number | null;
  completedAt: string | null;
  findingCounts: Record<'critical' | 'high' | 'medium' | 'low' | 'info', number>;
}

export interface WorkspaceResponse {
  id: string;
  name: string;
  createdAt: string;
}

export type LastVerificationStatus = 'clean' | 'findings' | 'failed' | 'never_run';

export type VersionContextStatus =
  | 'verified_clean'
  | 'verified_with_findings'
  | 'spec_changed_since_verification'
  | 'never_verified';

export type ProjectSort = 'updated_at' | 'created_at' | 'name';
export type SortOrder = 'asc' | 'desc';

export const MEMBERSHIP_ROLES = ['owner', 'admin', 'member'] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];
