/**
 * Repo Service — Doc 11 §3.
 *
 * GitHub OAuth connection, repository ingestion (read-only).
 * CRITICAL: Never executes code from the repo (Doc 1 Principle 5).
 * CRITICAL: Never writes to the repo (Doc 5 §4).
 * Ingestion: reads files into ephemeral storage, never persists raw source.
 */

import { discoverRepoFiles } from '@verity/verification/utils/ast.js';
import type { RepoStructure } from '@verity/verification/tier1';

export class RepoService {
  /**
   * Ingest repository files from a local path.
   * In production, this would clone from GitHub to ephemeral storage.
   */
  async ingestRepo(repoPath: string): Promise<RepoStructure> {
    return discoverRepoFiles(repoPath);
  }

  // TODO: Connect GitHub repo (store RepoConnection with indirect token ref)
  // TODO: Disconnect repo
  // TODO: List accessible repos (via GitHub API)
  // TODO: Validate repo access (check OAuth token still valid)
}