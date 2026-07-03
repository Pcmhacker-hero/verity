import { BaseWorker } from './base.worker.js';
import { db } from '@verity/database';
import { repoConnections, analysisRuns } from '@verity/database/schema';
import { eq } from 'drizzle-orm';
import { GitHubService, RepoService, AnalysisService } from '@verity/services';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import AdmZip from 'adm-zip';

export type SyncJobData = {
  projectId: string;
  githubRepoFullName: string;
  accessToken: string;
};

export class SyncJobProcessor extends BaseWorker {
  private githubService = new GitHubService();
  private repoService = new RepoService();
  private analysisService = new AnalysisService();

  async process(jobId: string): Promise<void> {
    const job = await this.loadJob(jobId);
    if (!job) return;

    const { projectId, githubRepoFullName, accessToken } = job.payload as SyncJobData;

    // Update status to syncing
    await db.update(repoConnections)
      .set({ syncStatus: 'syncing' })
      .where(eq(repoConnections.projectId, projectId));

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `verity-sync-${projectId}-`));
    const zipPath = path.join(tempDir, 'repo.zip');

    try {
      const repos = await this.githubService.getUserRepositories(accessToken);
      const repo = repos.find((r) => r.full_name === githubRepoFullName);
      const defaultBranch = repo?.default_branch || 'main';

      await this.githubService.downloadRepoZip(
        githubRepoFullName,
        defaultBranch,
        accessToken,
        zipPath
      );

      // Unzip the repository into ephemeral storage
      const extractDir = path.join(tempDir, 'extracted');
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(extractDir, true);

      // Update status to synced
      await db.update(repoConnections)
        .set({ syncStatus: 'synced', lastSyncAt: new Date(), error: null })
        .where(eq(repoConnections.projectId, projectId));

      // Trigger AI analysis pipeline
      const [run] = await db.insert(analysisRuns).values({
        projectId,
        commitSha: 'unknown',
        status: 'running',
        stage: 'ingestion',
      }).returning();

      if (run) {
        await this.analysisService.analyzeRepository(
          run.id,
          projectId,
          extractDir,
          'unknown'
        );
      }

    } catch (error: any) {
      await db.update(repoConnections)
        .set({ syncStatus: 'error', error: error.message })
        .where(eq(repoConnections.projectId, projectId));
      throw error;
    } finally {
      // Security Guideline §4: Ephemeral Isolation — guaranteed cleanup
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }
}

export const syncJobProcessor = new SyncJobProcessor();

