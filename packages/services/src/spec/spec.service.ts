/**
 * Spec Service — Doc 11 §3.
 *
 * SpecVersion creation, immutability enforcement, version history, diffing.
 * CRITICAL: SpecVersions are never updated — mutation = new version (Doc 10 Design Principle 2).
 */

import { db } from '@verity/database';
import { SpecRepository } from './spec.repository.js';
import { generateChangeSummary } from './diff.engine.js';
import { VerityError } from '@verity/shared/errors';
import { ARTIFACT_TYPES } from '@verity/shared/types';
import type { SpecVersionSource } from '@verity/shared/types';

export class SpecService {
  private readonly repo: SpecRepository;

  constructor() {
    this.repo = new SpecRepository();
  }

  /**
   * Universal edit method enforcing Document 10 Principle 2 (Immutability).
   * Generates a structural change summary, copies unchanged artifacts,
   * and inserts the new edited artifact.
   */
  async updateArtifact(workspaceId: string, projectId: string, artifactType: string, payload: any, source: SpecVersionSource = 'edit') {
    if (!ARTIFACT_TYPES.includes(artifactType as any)) {
      throw new VerityError(
        'VALIDATION_ERROR',
        `Invalid artifact type: ${artifactType}`,
        400
      );
    }

    const latestVersion = await this.repo.getLatestSpecVersion(workspaceId, projectId);

    // Compute diff against old artifact
    let oldArtifact = null;
    if (latestVersion) {
      if (artifactType === 'prd') oldArtifact = await this.repo.getPrdArtifact(latestVersion.id);
      if (artifactType === 'architecture') oldArtifact = await this.repo.getArchitectureArtifact(latestVersion.id);
      if (artifactType === 'schema') oldArtifact = await this.repo.getSchemaArtifact(latestVersion.id);
      if (artifactType === 'api') oldArtifact = await this.repo.getApiArtifact(latestVersion.id);
    }

    const changeSummary = generateChangeSummary(artifactType, oldArtifact, payload);

    // Execute in a single transaction
    const newVersion = await db.transaction(async (tx) => {
      const version = await this.repo.createSpecVersion(
        tx,
        workspaceId,
        projectId,
        source,
        latestVersion ? latestVersion.id : null,
        changeSummary
      );

      // Insert the new artifact
      if (artifactType === 'prd') await this.repo.insertPrdArtifact(tx, version!.id, payload);
      if (artifactType === 'architecture') await this.repo.insertArchitectureArtifact(tx, version!.id, payload);
      if (artifactType === 'schema') await this.repo.insertSchemaArtifact(tx, version!.id, payload);
      if (artifactType === 'api') await this.repo.insertApiArtifact(tx, version!.id, payload);

      // Copy the rest
      if (latestVersion) {
        await this.repo.copyUnchangedArtifacts(tx, latestVersion.id, version!.id, artifactType);
      }

      return version;
    });

    return newVersion;
  }

  /**
   * Retrieves an artifact by project and version (defaults to latest).
   */
  async getArtifact(workspaceId: string, projectId: string, artifactType: string, versionNumber?: number) {
    let version = null;
    
    if (versionNumber) {
      version = await this.repo.getSpecVersion(workspaceId, projectId, versionNumber);
    } else {
      version = await this.repo.getLatestSpecVersion(workspaceId, projectId);
    }

    if (!version) {
      throw new VerityError(
        'RESOURCE_NOT_FOUND',
        'No spec version found for this project.',
        404
      );
    }

    let artifact = null;
    if (artifactType === 'prd') artifact = await this.repo.getPrdArtifact(version.id);
    if (artifactType === 'architecture') artifact = await this.repo.getArchitectureArtifact(version.id);
    if (artifactType === 'schema') artifact = await this.repo.getSchemaArtifact(version.id);
    if (artifactType === 'api') artifact = await this.repo.getApiArtifact(version.id);
    if (artifactType === 'repo_structure') artifact = await this.repo.getRepoStructureArtifact(version.id);
    if (artifactType === 'roadmap') artifact = await this.repo.getRoadmapArtifact(version.id);
    if (artifactType === 'tasks') artifact = await this.repo.getTasksArtifact(version.id);

    return {
      specVersionId: version.id,
      versionNumber: version.versionNumber,
      [artifactType === 'repo_structure' ? 'repoStructure' : artifactType]: artifact,
    };
  }

  /**
   * Generates a markdown representation of the tasks artifact for a spec version.
   */
  async getTasksExport(workspaceId: string, projectId: string, versionNumber?: number): Promise<string> {
    const version = versionNumber 
      ? await this.repo.getSpecVersion(workspaceId, projectId, versionNumber)
      : await this.repo.getLatestSpecVersion(workspaceId, projectId);

    if (!version) {
      throw new VerityError(
        'RESOURCE_NOT_FOUND',
        'No spec version found for this project.',
        404
      );
    }

    const tasksArtifact = await this.repo.getTasksArtifact(version.id);
    
    // Fallback template if tasks are empty or undefined
    if (!tasksArtifact || !tasksArtifact.data || tasksArtifact.data.length === 0) {
      return `# Implementation Tasks
## Generated from SpecVersion v${version.versionNumber}

No tasks found.
`;
    }

    // Very basic deterministic markdown template
    let markdown = `# Implementation Tasks
## Generated from SpecVersion v${version.versionNumber}

`;

    // Normally we would group by phase. Since we skipped robust denormalization
    // of tasks in the repo layer for simplicity, we just iterate the data array.
    tasksArtifact.data.forEach((task: any, index: number) => {
      markdown += `### Task ${index + 1}: ${task.title}\n`;
      markdown += `**References:** PRD Feature: ${task.prdFeatureRef} | Architecture: ${task.architectureComponentRef}\n`;
      markdown += `**Description:** ${task.description}\n\n`;
    });

    return markdown;
  }
}
