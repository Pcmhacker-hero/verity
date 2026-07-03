/**
 * Tier 1 Verification Service — Doc 11 §3, §6.
 *
 * Orchestrates deterministic verification:
 * 1. Fetch spec artifacts for the given SpecVersion
 * 2. Ingest repository files (via RepoService)
 * 3. Run all Tier 1 checkers via RuleEngine
 * 3. Persist findings to database
 * 4. Update VerificationRun status throughout execution
 */

import { db } from '@verity/database';
import { verificationRuns, findings, schemaEntities, schemaFields, apiEndpoints, apiArtifacts, schemaArtifacts, repoStructureArtifacts } from '@verity/database/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { VerityError } from '@verity/shared/errors';
import { discoverRepoFiles } from '../utils/ast.js';
import type { SpecArtifacts, RepoStructure, VerificationContext, DeterministicFinding, Tier1Result, SchemaFieldSpec } from './types.js';
import { SchemaChecker } from './schema.checker.js';
import { ApiChecker } from './api.checker.js';
import { AuthChecker } from './auth.checker.js';
import { RepoStructureChecker } from './repo-structure.checker.js';
import { ruleEngine, RuleEngine } from './rule-engine.js';

export class Tier1VerificationService {
  private ruleEngine: RuleEngine;

  constructor(ruleEngine?: RuleEngine) {
    this.ruleEngine = ruleEngine || new RuleEngine();
    this.registerDefaultCheckers();
  }

  private registerDefaultCheckers(): void {
    this.ruleEngine.register({
      name: 'schema-checker',
      version: '1.0.0',
      description: 'Verifies database entities and fields exist in repository',
      checker: new SchemaChecker(),
      enabled: true,
    });

    this.ruleEngine.register({
      name: 'api-checker',
      version: '1.0.0',
      description: 'Verifies API endpoints, methods, paths, and auth requirements',
      checker: new ApiChecker(),
      enabled: true,
      dependsOn: ['schema-checker'],
    });

    this.ruleEngine.register({
      name: 'auth-checker',
      version: '1.0.0',
      description: 'Verifies authentication and authorization implementation',
      checker: new AuthChecker(),
      enabled: true,
    });

    this.ruleEngine.register({
      name: 'repo-structure-checker',
      version: '1.0.0',
      description: 'Verifies repository structure matches spec',
      checker: new RepoStructureChecker(),
      enabled: true,
    });
  }

  /**
   * Execute Tier 1 deterministic verification for a SpecVersion.
   * This is called by the verification job processor.
   */
  async executeTier1(params: {
    verificationRunId: string;
    specVersionId: string;
    repoPath: string;
    commitSha: string;
    signal?: AbortSignal;
    onProgress?: (stage: string, progress: number) => void;
  }): Promise<Tier1Result> {
    const { verificationRunId, specVersionId, repoPath, commitSha, signal, onProgress } = params;

    try {
      // Update status: running deterministic checks
      await this.updateVerificationRunStatus(verificationRunId, 'running_deterministic');
      onProgress?.('loading_spec', 0);

      // 1. Fetch spec artifacts
      const specArtifacts = await this.fetchSpecArtifacts(specVersionId);
      onProgress?.('ingesting_repo', 10);

      // 2. Ingest repository (scan files)
      const repoStructure = discoverRepoFiles(repoPath);
      onProgress?.('running_checkers', 20);

      // 3. Build verification context
      const context: VerificationContext = {
        specVersionId,
        specArtifacts,
        repoStructure,
        commitSha,
      };

      // 4. Run all Tier 1 checkers
      const checkerResults = await this.ruleEngine.runAll(context, {
        signal,
        onProgress: (checkerName, result) => {
          onProgress?.(`checker:${checkerName}`, 0);
        },
      });

      // 5. Aggregate findings
      const allFindings: DeterministicFinding[] = [];
      let totalFilesProcessed = 0;
      const checkersRun: string[] = [];

      for (const [checkerName, result] of checkerResults) {
        checkersRun.push(checkerName);
        allFindings.push(...result.findings);
        totalFilesProcessed += result.filesProcessed;
      }

      onProgress?.('persisting_findings', 80);

      //  // 6. Persist findings
      if (allFindings.length > 0) {
        await this.persistFindings(verificationRunId, allFindings);
      }

      // Update verification run with tier 1 summary
      await this.updateVerificationRunTier1Summary(verificationRunId, allFindings.length);

      return {
        findings: allFindings,
        durationMs: 0, // Will be calculated by caller
        checkersRun,
        filesProcessed: totalFilesProcessed,
      };
    } catch (error) {
      if (error instanceof Error && error.message === 'VERIFICATION_CANCELLED') {
        throw error;
      }
      throw new VerityError(
        'TIER1_VERIFICATION_FAILED',
        `Tier 1 verification failed: ${error instanceof Error ? error.message : String(error)}`,
        500,
      );
    }
  }

  /**
   * Fetch all spec artifacts for a given SpecVersion
   */
  private async fetchSpecArtifacts(specVersionId: string): Promise<SpecArtifacts> {
    // Fetch schema entities and fields
    const entities = await db
      .select()
      .from(schemaEntities)
      .where(eq(schemaEntities.schemaArtifactId, 
        db.select({ id: schemaArtifacts.id })
          .from(schemaArtifacts)
          .where(eq(schemaArtifacts.specVersionId, specVersionId))
          .limit(1)
      ));

    const entityIds = entities.map(e => e.id);
    const fields = entityIds.length > 0
      ? await db.select().from(schemaFields).where(inArray(schemaFields.schemaEntityId, entityIds))
      : [];

    // Group fields by entity and convert to SchemaFieldSpec
    const fieldsByEntity = new Map<string, SchemaFieldSpec[]>();
    for (const field of fields) {
      if (!fieldsByEntity.has(field.schemaEntityId)) {
        fieldsByEntity.set(field.schemaEntityId, []);
      }
      fieldsByEntity.get(field.schemaEntityId)!.push({
        id: field.id,
        schemaEntityId: field.schemaEntityId,
        name: field.name,
        dataType: field.dataType,
        isRequired: field.isRequired,
        isUnique: field.isUnique,
        foreignKeyRef: field.foreignKeyRef || undefined,
      });
    }

    // Fetch API endpoints
    const apiArtifact = await db
      .select({ id: apiArtifacts.id })
      .from(apiArtifacts)
      .where(eq(apiArtifacts.specVersionId, specVersionId))
      .limit(1);

    const endpoints = apiArtifact.length > 0
      ? await db.select().from(apiEndpoints).where(eq(apiEndpoints.apiArtifactId, apiArtifact[0]!.id))
      : [];

    // Fetch repo structure if present
    const repoStructureArtifact = await db
      .select()
      .from(repoStructureArtifacts)
      .where(eq(repoStructureArtifacts.specVersionId, specVersionId))
      .limit(1);

    return {
      schemaEntities: entities.map(e => ({
        id: e.id,
        name: e.name,
        architectureComponentRef: e.architectureComponentRef || undefined,
      })),
      schemaFields: fieldsByEntity,
      apiEndpoints: endpoints.map(e => ({
        id: e.id,
        method: e.method,
        path: e.path,
        requestShape: e.requestShape as Record<string, unknown>,
        responseShape: e.responseShape as Record<string, unknown>,
        authRequired: e.authRequired,
        requiredRole: e.requiredRole || undefined,
        schemaEntityRefs: e.schemaEntityRefs as string[],
      })),
      repoStructure: repoStructureArtifact[0]?.tree as any,
    };
  }

  /**
   * Persist deterministic findings to database
   */
  private async persistFindings(verificationRunId: string, findings_: DeterministicFinding[]): Promise<void> {
    const findingRows = findings_.map(f => ({
      verificationRunId,
      severity: f.severity,
      specArea: f.specArea,
      specElementRef: f.specElementRef,
      filePath: f.filePath || null,
      lineNumber: f.lineNumber || null,
      explanation: f.explanation,
      detectionTier: f.detectionTier as 'deterministic',
      status: f.status as 'open',
    }));

    await db.insert(findings).values(findingRows);
  }

  /**
   * Update VerificationRun status
   */
  private async updateVerificationRunStatus(runId: string, status: string): Promise<void> {
    await db
      .update(verificationRuns)
      .set({ 
        status: status as any,
      })
      .where(eq(verificationRuns.id, runId));
  }

  /**
   * Update VerificationRun with Tier 1 summary
   */
  private async updateVerificationRunTier1Summary(runId: string, findingsCount: number): Promise<void> {
    await db
      .update(verificationRuns)
      .set({ 
        // verificationRuns doesn't have updatedAt - just status change
      })
      .where(eq(verificationRuns.id, runId));
  }
}

// Export singleton instance
export const tier1VerificationService = new Tier1VerificationService();